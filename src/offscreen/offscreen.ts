import { MAX_GAIN, MESSAGE_ACTIONS } from "../constants";
import type { ExtensionMessage, OffscreenResponse } from "../types";

type TabAudioPipeline = {
  stream: MediaStream;
  context: AudioContext;
  gainNode: GainNode;
  sourceNode: MediaStreamAudioSourceNode;
};

const activePipelines = new Map<number, TabAudioPipeline>();

const calculateGainValue = (volume: number, isMuted: boolean): number => {
  if (isMuted) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_GAIN, volume / 100));
};

const handleStopCapture = (tabId: number): void => {
  const pipeline = activePipelines.get(tabId);
  if (!pipeline) {
    return;
  }

  pipeline.stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Track may already be stopped.
    }
  });

  try {
    pipeline.sourceNode.disconnect();
    pipeline.gainNode.disconnect();
  } catch {
    // Nodes may already be disconnected.
  }

  void pipeline.context.close().catch(() => undefined);
  activePipelines.delete(tabId);
};

const handleSetVolume = (
  tabId: number,
  volume: number,
  isMuted: boolean
): boolean => {
  const pipeline = activePipelines.get(tabId);
  if (!pipeline) {
    return false;
  }

  if (pipeline.context.state !== "running") {
    void pipeline.context.resume().catch(() => undefined);
  }

  const gainValue = calculateGainValue(volume, isMuted);
  pipeline.gainNode.gain.value = gainValue;
  return true;
};

const handleStartCapture = async (
  tabId: number,
  streamId: string,
  volume: number,
  isMuted: boolean
): Promise<boolean> => {
  if (activePipelines.has(tabId)) {
    return handleSetVolume(tabId, volume, isMuted);
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    } as unknown as MediaTrackConstraints,
    video: false,
  });

  const context = new AudioContext();
  if (context.state !== "running") {
    try {
      await context.resume();
    } catch {
      // Ignore if resume is pending.
    }
  }

  const sourceNode = context.createMediaStreamSource(stream);
  const gainNode = context.createGain();

  const gainValue = calculateGainValue(volume, isMuted);
  gainNode.gain.value = gainValue;

  sourceNode.connect(gainNode).connect(context.destination);

  const audioTracks = stream.getAudioTracks();
  for (const track of audioTracks) {
    track.addEventListener("ended", () => {
      handleStopCapture(tabId);
      void chrome.runtime
        .sendMessage({
          target: "background",
          type: "TAB_CAPTURE_ENDED",
          tabId,
        })
        .catch(() => undefined);
    });
  }

  activePipelines.set(tabId, {
    stream,
    context,
    gainNode,
    sourceNode,
  });

  return true;
};

if (typeof chrome.tabCapture?.onStatusChanged?.addListener === "function") {
  chrome.tabCapture.onStatusChanged.addListener((info) => {
    if (typeof info?.tabId === "number" && typeof info?.fullscreen === "boolean") {
      void chrome.runtime
        .sendMessage({
          target: "background",
          type: "TAB_FULLSCREEN_CHANGE",
          tabId: info.tabId,
          fullscreen: info.fullscreen,
        })
        .catch(() => undefined);
    }
  });
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: OffscreenResponse) => void
  ): boolean | void => {
    if (message.target && message.target !== "offscreen") {
      return false;
    }

    if (message.type === MESSAGE_ACTIONS.OFFSCREEN_PING) {
      sendResponse({ ok: true, pong: true });
      return true;
    }

    if (message.type === MESSAGE_ACTIONS.OFFSCREEN_GET_STATUS) {
      const isCaptured = activePipelines.has(message.tabId);
      sendResponse({ ok: true, isCaptured });
      return true;
    }

    if (message.type === MESSAGE_ACTIONS.OFFSCREEN_START_CAPTURE) {
      handleStartCapture(
        message.tabId,
        message.streamId,
        message.volume,
        message.muted
      )
        .then((ok) => sendResponse({ ok }))
        .catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("Offscreen capture error:", errorMessage);
          sendResponse({ ok: false, error: errorMessage });
        });
      return true;
    }

    if (message.type === MESSAGE_ACTIONS.OFFSCREEN_SET_VOLUME) {
      const ok = handleSetVolume(message.tabId, message.volume, message.muted);
      sendResponse({ ok });
      return true;
    }

    if (message.type === MESSAGE_ACTIONS.OFFSCREEN_STOP_CAPTURE) {
      handleStopCapture(message.tabId);
      sendResponse({ ok: true });
      return true;
    }
  }
);
