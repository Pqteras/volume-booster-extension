import { DEFAULT_VOLUME, MESSAGE_ACTIONS, clampVolume, tabStorageKey } from "../constants";
import type { ExtensionMessage, SetVolumeResponse, VolumeState } from "../types";

const DEFAULT_STATE: VolumeState = {
  volume: DEFAULT_VOLUME,
  muted: false,
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

const setTabState = async (tabId: number, state: VolumeState): Promise<void> => {
  await chrome.storage.session.set({
    [tabStorageKey(tabId)]: {
      volume: clampVolume(state.volume),
      muted: Boolean(state.muted),
    },
  });
};

const applyToTab = async (tabId: number, state: VolumeState): Promise<boolean> => {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_ACTIONS.SET_VOLUME,
      volume: state.volume,
      muted: state.muted,
    });
    return true;
  } catch {
    return false;
  }
};

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse): boolean | void => {
    if (message.type === MESSAGE_ACTIONS.GET_VOLUME) {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId == null) {
        sendResponse(DEFAULT_STATE);
        return;
      }

      void getTabState(tabId).then(sendResponse);
      return true;
    }

    if (message.type === MESSAGE_ACTIONS.SET_VOLUME) {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId == null) {
        const response: SetVolumeResponse = { ok: false };
        sendResponse(response);
        return;
      }

      const state: VolumeState = {
        volume: clampVolume(message.volume),
        muted: Boolean(message.muted),
      };

      void setTabState(tabId, state)
        .then(() => applyToTab(tabId, state))
        .then((ok) => {
          const response: SetVolumeResponse = { ok };
          sendResponse(response);
        });
      return true;
    }
  }
);

chrome.tabs.onRemoved.addListener((tabId: number): void => {
  void chrome.storage.session.remove(tabStorageKey(tabId));
});
