export type VolumeState = {
  volume: number;
  muted: boolean;
};

export type SetVolumeMessage = {
  type: "SET_VOLUME";
  tabId?: number;
  volume: number;
  muted: boolean;
};

export type GetVolumeMessage = {
  type: "GET_VOLUME";
  tabId?: number;
};

export type SetVolumeResponse = {
  ok: boolean;
};

export type ExtensionMessage = SetVolumeMessage | GetVolumeMessage;

export type AudioPipelineNode = {
  context: AudioContext;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
  abort: AbortController;
};
