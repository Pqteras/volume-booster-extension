export type VolumeState = {
  volume: number;
  muted: boolean;
};

export type SetVolumeMessage = {
  target?: "background";
  type: "SET_VOLUME";
  tabId?: number;
  volume: number;
  muted: boolean;
};

export type GetVolumeMessage = {
  target?: "background";
  type: "GET_VOLUME";
  tabId?: number;
};

export type TabCaptureEndedMessage = {
  target?: "background";
  type: "TAB_CAPTURE_ENDED";
  tabId: number;
};

export type SetVolumeResponse = {
  ok: boolean;
  error?: string;
};

export type OffscreenPingMessage = {
  target?: "offscreen";
  type: "OFFSCREEN_PING";
};

export type OffscreenStartCaptureMessage = {
  target?: "offscreen";
  type: "OFFSCREEN_START_CAPTURE";
  tabId: number;
  streamId: string;
  volume: number;
  muted: boolean;
};

export type OffscreenSetVolumeMessage = {
  target?: "offscreen";
  type: "OFFSCREEN_SET_VOLUME";
  tabId: number;
  volume: number;
  muted: boolean;
};

export type OffscreenStopCaptureMessage = {
  target?: "offscreen";
  type: "OFFSCREEN_STOP_CAPTURE";
  tabId: number;
};

export type OffscreenGetStatusMessage = {
  target?: "offscreen";
  type: "OFFSCREEN_GET_STATUS";
  tabId: number;
};

export type OffscreenMessage =
  | OffscreenPingMessage
  | OffscreenStartCaptureMessage
  | OffscreenSetVolumeMessage
  | OffscreenStopCaptureMessage
  | OffscreenGetStatusMessage;

export type ExtensionMessage =
  | SetVolumeMessage
  | GetVolumeMessage
  | TabCaptureEndedMessage
  | OffscreenMessage;

export type OffscreenResponse = {
  ok: boolean;
  pong?: boolean;
  error?: string;
  isCaptured?: boolean;
};
