export const MIN_VOLUME = 0;
export const DEFAULT_VOLUME = 100;
export const MAX_VOLUME = 670;
export const MAX_GAIN = MAX_VOLUME / 100;
export const VOLUME_STEP = 5;

export const MESSAGE_ACTIONS = {
  SET_VOLUME: "SET_VOLUME",
  GET_VOLUME: "GET_VOLUME",
} as const;

export const clampVolume = (value: number): number =>
  Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, Number(value) || 0));

export const tabStorageKey = (tabId: number): `tab-${number}` => `tab-${tabId}`;
