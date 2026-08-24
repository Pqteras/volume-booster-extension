import { DEFAULT_VOLUME, MESSAGE_ACTIONS, clampVolume } from "../constants";
import type { ExtensionMessage, VolumeState } from "../types";
import { applyGainToAddedNode, applyGainToAllMedia, pruneDisconnectedMedia } from "./audio-engine";

let currentVolume = DEFAULT_VOLUME;
let isMuted = false;
let applyTimer = 0;

const applyCurrentSettings = (): void => {
  applyGainToAllMedia(currentVolume, isMuted);
};

const scheduleApply = (): void => {
  window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(applyCurrentSettings, 40);
};

const updateSettings = (settings: Partial<VolumeState>): void => {
  if (typeof settings.volume === "number") {
    currentVolume = clampVolume(settings.volume);
  }
  if (typeof settings.muted === "boolean") {
    isMuted = settings.muted;
  }
  applyCurrentSettings();
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage): void => {
  if (message.type === MESSAGE_ACTIONS.SET_VOLUME) {
    updateSettings(message);
  }
});

void chrome.runtime
  .sendMessage({ type: MESSAGE_ACTIONS.GET_VOLUME })
  .then((state: VolumeState | undefined) => {
    if (state) {
      updateSettings(state);
    }
  })
  .catch(() => undefined);

const observer = new MutationObserver((mutations: MutationRecord[]): void => {
  let shouldScan = false;

  for (const mutation of mutations) {
    if (mutation.removedNodes.length > 0) {
      pruneDisconnectedMedia();
    }

    for (const node of mutation.addedNodes) {
      applyGainToAddedNode(node, currentVolume, isMuted);
      shouldScan = true;
    }
  }

  if (shouldScan && (currentVolume !== DEFAULT_VOLUME || isMuted)) {
    scheduleApply();
  }
});

observer.observe(document.documentElement ?? document, {
  childList: true,
  subtree: true,
});
