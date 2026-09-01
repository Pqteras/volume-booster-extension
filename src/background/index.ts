import {
  DEFAULT_VOLUME,
  MESSAGE_ACTIONS,
  OFFSCREEN_DOCUMENT_PATH,
  clampVolume,
  tabStorageKey,
} from "../constants";
import type {
  ExtensionMessage,
  OffscreenResponse,
  SetVolumeResponse,
  VolumeState,
} from "../types";

const DEFAULT_STATE: VolumeState = {
  volume: DEFAULT_VOLUME,
  muted: false,
};

let isCreatingOffscreenDocument = false;
const tabOperationLocks = new Map<number, Promise<SetVolumeResponse>>();

const isOffscreenDocumentOpen = async (): Promise<boolean> => {
  if (typeof chrome.offscreen?.hasDocument === "function") {
    return chrome.offscreen.hasDocument();
  }

  if (typeof chrome.runtime?.getContexts === "function") {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return contexts.length > 0;
  }

  return false;
};

const pingOffscreenDocument = async (): Promise<boolean> => {
  try {
    const response = (await chrome.runtime.sendMessage({
      target: "offscreen",
      type: MESSAGE_ACTIONS.OFFSCREEN_PING,
    })) as OffscreenResponse | undefined;
    return Boolean(response?.pong);
  } catch {
    return false;
  }
};

const ensureOffscreenDocument = async (): Promise<void> => {
  const isOpen = await isOffscreenDocumentOpen();

  if (!isOpen) {
    if (isCreatingOffscreenDocument) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return;
    }

    isCreatingOffscreenDocument = true;
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [
          chrome.offscreen.Reason.USER_MEDIA,
          chrome.offscreen.Reason.AUDIO_PLAYBACK,
        ],
        justification: "Tab audio amplification and volume boosting",
      });
    } catch (error: unknown) {
      const errorString = String(error);
      const isAlreadyCreated = errorString.includes(
        "Only a single offscreen document may be created"
      );
      if (!isAlreadyCreated) {
        throw error;
      }
    } finally {
      isCreatingOffscreenDocument = false;
    }
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const isReady = await pingOffscreenDocument();
    if (isReady) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

const getCapturedTabs = async (): Promise<number[]> => {
  try {
    const result = await chrome.storage.session.get("activeCapturedTabs");
    return Array.isArray(result.activeCapturedTabs)
      ? result.activeCapturedTabs
      : [];
  } catch {
    return [];
  }
};

const setTabCapturedStatus = async (
  tabId: number,
  isCaptured: boolean
): Promise<void> => {
  try {
    const tabs = await getCapturedTabs();
    const set = new Set(tabs);
    if (isCaptured) {
      set.add(tabId);
    } else {
      set.delete(tabId);
    }
    await chrome.storage.session.set({ activeCapturedTabs: [...set] });
  } catch {
    // Ignore storage write failure
  }
};

const isTabCaptured = async (tabId: number): Promise<boolean> => {
  const tabs = await getCapturedTabs();
  if (tabs.includes(tabId)) {
    return true;
  }

  const isOpen = await isOffscreenDocumentOpen();
  if (!isOpen) {
    return false;
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      target: "offscreen",
      type: MESSAGE_ACTIONS.OFFSCREEN_GET_STATUS,
      tabId,
    })) as OffscreenResponse | undefined;

    const capturedInOffscreen = Boolean(response?.isCaptured);
    if (capturedInOffscreen) {
      await setTabCapturedStatus(tabId, true);
    }
    return capturedInOffscreen;
  } catch {
    return false;
  }
};

const getTabState = async (tabId: number): Promise<VolumeState> => {
  const key = tabStorageKey(tabId);
  const result = await chrome.storage.session.get(key);
  const stored = result[key] as VolumeState | undefined;

  if (!stored) {
    return { ...DEFAULT_STATE };
  }

  return {
    volume: clampVolume(stored.volume),
    muted: Boolean(stored.muted),
  };
};

const setTabState = async (
  tabId: number,
  state: VolumeState
): Promise<void> => {
  await chrome.storage.session.set({
    [tabStorageKey(tabId)]: {
      volume: clampVolume(state.volume),
      muted: Boolean(state.muted),
    },
  });
};

const executeApplyVolume = async (
  tabId: number,
  state: VolumeState
): Promise<SetVolumeResponse> => {
  const isDefaultPlayback = state.volume === DEFAULT_VOLUME && !state.muted;

  if (isDefaultPlayback) {
    const currentlyCaptured = await isTabCaptured(tabId);
    if (currentlyCaptured) {
      await setTabCapturedStatus(tabId, false);
      const isOpen = await isOffscreenDocumentOpen();
      if (isOpen) {
        await chrome.runtime
          .sendMessage({
            target: "offscreen",
            type: MESSAGE_ACTIONS.OFFSCREEN_STOP_CAPTURE,
            tabId,
          })
          .catch(() => undefined);
      }
    }
    return { ok: true };
  }

  await ensureOffscreenDocument();

  const alreadyCaptured = await isTabCaptured(tabId);
  if (alreadyCaptured) {
    const response = (await chrome.runtime
      .sendMessage({
        target: "offscreen",
        type: MESSAGE_ACTIONS.OFFSCREEN_SET_VOLUME,
        tabId,
        volume: state.volume,
        muted: state.muted,
      })
      .catch(() => ({ ok: false }))) as OffscreenResponse;

    if (response?.ok) {
      return { ok: true };
    }
  }

  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    const response = (await chrome.runtime
      .sendMessage({
        target: "offscreen",
        type: MESSAGE_ACTIONS.OFFSCREEN_START_CAPTURE,
        tabId,
        streamId,
        volume: state.volume,
        muted: state.muted,
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message };
      })) as OffscreenResponse;

    if (response?.ok) {
      await setTabCapturedStatus(tabId, true);
      return { ok: true };
    }

    return {
      ok: false,
      error: response?.error || "Failed to start audio capture in offscreen engine",
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("Cannot capture a tab with an active stream")) {
      const updateResponse = (await chrome.runtime
        .sendMessage({
          target: "offscreen",
          type: MESSAGE_ACTIONS.OFFSCREEN_SET_VOLUME,
          tabId,
          volume: state.volume,
          muted: state.muted,
        })
        .catch(() => ({ ok: false }))) as OffscreenResponse;

      if (updateResponse?.ok) {
        await setTabCapturedStatus(tabId, true);
        return { ok: true };
      }
    }

    return { ok: false, error: errorMessage };
  }
};

const applyVolumeToTab = async (
  tabId: number,
  state: VolumeState
): Promise<SetVolumeResponse> => {
  const existingLock = tabOperationLocks.get(tabId);
  if (existingLock) {
    try {
      await existingLock;
    } catch {
      // Ignore previous lock failure and proceed
    }
  }

  const currentOperation = executeApplyVolume(tabId, state);
  tabOperationLocks.set(tabId, currentOperation);

  try {
    return await currentOperation;
  } finally {
    if (tabOperationLocks.get(tabId) === currentOperation) {
      tabOperationLocks.delete(tabId);
    }
  }
};

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean | void => {
    if (message.target && message.target !== "background") {
      return false;
    }

    if (message.type === "TAB_CAPTURE_ENDED") {
      void setTabCapturedStatus(message.tabId, false);
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === MESSAGE_ACTIONS.GET_VOLUME) {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId == null) {
        sendResponse(DEFAULT_STATE);
        return true;
      }

      void getTabState(tabId).then(sendResponse);
      return true;
    }

    if (message.type === MESSAGE_ACTIONS.SET_VOLUME) {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId == null) {
        const response: SetVolumeResponse = {
          ok: false,
          error: "Missing tab ID",
        };
        sendResponse(response);
        return true;
      }

      const state: VolumeState = {
        volume: clampVolume(message.volume),
        muted: Boolean(message.muted),
      };

      void setTabState(tabId, state)
        .then(() => applyVolumeToTab(tabId, state))
        .then(sendResponse);
      return true;
    }
  }
);

chrome.tabs.onRemoved.addListener(async (tabId: number): Promise<void> => {
  tabOperationLocks.delete(tabId);
  await setTabCapturedStatus(tabId, false);
  const isOpen = await isOffscreenDocumentOpen();
  if (isOpen) {
    await chrome.runtime
      .sendMessage({
        target: "offscreen",
        type: MESSAGE_ACTIONS.OFFSCREEN_STOP_CAPTURE,
        tabId,
      })
      .catch(() => undefined);
  }

  void chrome.storage.session.remove(tabStorageKey(tabId));
});

chrome.tabs.onUpdated.addListener(
  async (
    tabId: number,
    changeInfo: { status?: string; audible?: boolean }
  ): Promise<void> => {
    if (changeInfo.status === "loading") {
      tabOperationLocks.delete(tabId);
      await setTabCapturedStatus(tabId, false);
      const isOpen = await isOffscreenDocumentOpen();
      if (isOpen) {
        await chrome.runtime
          .sendMessage({
            target: "offscreen",
            type: MESSAGE_ACTIONS.OFFSCREEN_STOP_CAPTURE,
            tabId,
          })
          .catch(() => undefined);
      }
    }
  }
);

chrome.runtime.onInstalled.addListener(async (): Promise<void> => {
  const isOpen = await isOffscreenDocumentOpen();
  if (isOpen) {
    await chrome.offscreen.closeDocument().catch(() => undefined);
  }
  await chrome.storage.session.clear().catch(() => undefined);
});
