import {
  DEFAULT_VOLUME,
  MAX_VOLUME,
  MIN_VOLUME,
  VOLUME_STEP,
  MESSAGE_ACTIONS,
  clampVolume,
} from "../constants";
import type { SetVolumeResponse, VolumeState } from "../types";

const getElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
};

const volumeSlider = getElement<HTMLInputElement>("volumeSlider");
const volumeValue = getElement("volumeValue");
const meterFill = getElement("meterFill");
const muteButton = getElement<HTMLButtonElement>("muteButton");
const muteIcon = getElement("muteIcon");
const visualizer = getElement("visualizer");
const statusText = getElement("statusText");
const statusDot = getElement("statusDot");
const statusPing = getElement("statusPing");
const statusBadge = getElement("statusBadge");
const statusBadgeIcon = getElement("statusBadgeIcon");
const statusBadgeText = getElement("statusBadgeText");
const decreaseButton = getElement<HTMLButtonElement>("decreaseButton");
const increaseButton = getElement<HTMLButtonElement>("increaseButton");
const resetButton = getElement<HTMLButtonElement>("resetButton");
const maxButton = getElement<HTMLButtonElement>("maxButton");
const maxLabel = document.getElementById("maxLabel");

volumeSlider.min = String(MIN_VOLUME);
volumeSlider.max = String(MAX_VOLUME);
if (maxLabel) {
  maxLabel.textContent = `${MAX_VOLUME}%`;
}

let activeTabId: number | undefined;
let muted = false;
let isAudible = false;
let sendVolumeDebounceTimer = 0;

const updateVisualizer = (): void => {
  const hasVolume = clampVolume(Number(volumeSlider.value)) > 0 && !muted;
  visualizer.classList.toggle("is-paused", !(hasVolume && isAudible));
};

const setStatus = (message: string, isError = false): void => {
  statusText.textContent = message;
  statusDot.classList.toggle("error", isError);
  statusPing.classList.toggle("error", isError);
  statusBadge.classList.toggle("error", isError);

  if (isError) {
    statusBadgeText.textContent = "CONFLICT";
    statusBadgeIcon.className = "fa-solid fa-circle-exclamation text-[8px] text-[#f47f7f]";
  } else if (muted) {
    statusBadgeText.textContent = "MUTED";
    statusBadgeIcon.className = "fa-solid fa-volume-xmark text-[8px] text-warm";
  } else {
    statusBadgeText.textContent = "ACTIVE";
    statusBadgeIcon.className = "fa-solid fa-bolt text-[8px] text-accent";
  }
};

const render = (volume: number): void => {
  const normalized = clampVolume(volume);
  const percentage = (normalized / MAX_VOLUME) * 100;

  volumeSlider.value = String(normalized);
  volumeValue.textContent = String(normalized);
  meterFill.style.width = `${percentage}%`;
  volumeSlider.style.setProperty("--range-progress", `${percentage}%`);
  updateVisualizer();
};

const renderMuteButton = (): void => {
  muteButton.classList.toggle("is-muted", muted);
  const label = muted ? "Unmute" : "Mute";
  muteButton.setAttribute("aria-label", label);
  muteButton.title = label;

  if (muted) {
    muteIcon.className = "fa-solid fa-volume-xmark text-sm text-warm transition-transform";
  } else {
    const currentVal = Number(volumeSlider.value) || 0;
    if (currentVal === 0) {
      muteIcon.className = "fa-solid fa-volume-off text-sm transition-transform";
    } else if (currentVal < 100) {
      muteIcon.className = "fa-solid fa-volume-low text-sm transition-transform";
    } else {
      muteIcon.className = "fa-solid fa-volume-high text-sm transition-transform";
    }
  }

  updateVisualizer();
};

const sendVolume = async (
  volume: number | string,
  nextMuted: boolean = muted
): Promise<void> => {
  if (!activeTabId) {
    return;
  }

  const settings: VolumeState = {
    volume: clampVolume(Number(volume)),
    muted: nextMuted,
  };

  muted = settings.muted;
  render(settings.volume);
  renderMuteButton();

  try {
    const response = (await chrome.runtime.sendMessage({
      target: "background",
      type: MESSAGE_ACTIONS.SET_VOLUME,
      tabId: activeTabId,
      volume: settings.volume,
      muted: settings.muted,
    })) as SetVolumeResponse | undefined;

    if (response?.ok) {
      setStatus(muted ? "Muted" : "Ready");
      return;
    }

    const rawError = response?.error || "This page can't be controlled";
    let userFriendlyError = rawError;

    if (rawError.includes("Cannot capture a tab with an active stream")) {
      userFriendlyError = "Another booster extension is capturing this tab (disable it and refresh)";
    }

    console.error("Volume set failed:", rawError);
    setStatus(userFriendlyError, true);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "This page can't be controlled";
    console.error("Volume error:", message);
    setStatus(message, true);
  }
};

const queueSendVolume = (
  volume: number | string,
  nextMuted: boolean = muted
): void => {
  const normalized = clampVolume(Number(volume));
  muted = nextMuted;
  render(normalized);
  renderMuteButton();

  window.clearTimeout(sendVolumeDebounceTimer);
  sendVolumeDebounceTimer = window.setTimeout(() => {
    void sendVolume(normalized, nextMuted);
  }, 40);
};

const loadTab = async (): Promise<void> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id;
  isAudible = Boolean(tab?.audible);

  if (!activeTabId) {
    setStatus("No active tab", true);
    return;
  }

  let stored: VolumeState = { volume: DEFAULT_VOLUME, muted: false };
  try {
    stored = (await chrome.runtime.sendMessage({
      target: "background",
      type: MESSAGE_ACTIONS.GET_VOLUME,
      tabId: activeTabId,
    })) as VolumeState;
  } catch {
    stored = { volume: DEFAULT_VOLUME, muted: false };
  }

  muted = stored?.muted ?? false;
  render(stored?.volume ?? DEFAULT_VOLUME);
  renderMuteButton();
  setStatus(muted ? "Muted" : "Ready");
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo): void => {
  if (tabId === activeTabId && typeof changeInfo.audible === "boolean") {
    isAudible = changeInfo.audible;
    updateVisualizer();
  }
});

volumeSlider.addEventListener("input", (): void => {
  queueSendVolume(volumeSlider.value);
});

decreaseButton.addEventListener("click", (): void => {
  void sendVolume(Number(volumeSlider.value) - VOLUME_STEP);
});

increaseButton.addEventListener("click", (): void => {
  void sendVolume(Number(volumeSlider.value) + VOLUME_STEP);
});

resetButton.addEventListener("click", (): void => {
  void sendVolume(DEFAULT_VOLUME, false);
});

maxButton.addEventListener("click", (): void => {
  void sendVolume(MAX_VOLUME);
});

muteButton.addEventListener("click", (): void => {
  void sendVolume(volumeSlider.value, !muted);
});

void loadTab();
