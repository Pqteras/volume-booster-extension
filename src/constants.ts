export const MIN_VOLUME = 0;
export const DEFAULT_VOLUME = 100;
export const MAX_VOLUME = 670;
export const MAX_GAIN = MAX_VOLUME / 100;
export const VOLUME_STEP = 5;

export const MESSAGE_ACTIONS = {
  SET_VOLUME: "SET_VOLUME",
  GET_VOLUME: "GET_VOLUME",
  OFFSCREEN_PING: "OFFSCREEN_PING",
  OFFSCREEN_START_CAPTURE: "OFFSCREEN_START_CAPTURE",
  OFFSCREEN_SET_VOLUME: "OFFSCREEN_SET_VOLUME",
  OFFSCREEN_STOP_CAPTURE: "OFFSCREEN_STOP_CAPTURE",
  OFFSCREEN_GET_STATUS: "OFFSCREEN_GET_STATUS",
} as const;

export const clampVolume = (value: number): number =>
  Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, Number(value) || 0));

export const tabStorageKey = (tabId: number): `tab-${number}` => `tab-${tabId}`;

export const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
