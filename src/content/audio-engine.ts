import { DEFAULT_VOLUME, MAX_GAIN } from "../constants";
import type { AudioPipelineNode } from "../types";

const mediaNodes = new Map<HTMLMediaElement, AudioPipelineNode>();
const failedMedia = new WeakSet<HTMLMediaElement>();

let lastVolume = DEFAULT_VOLUME;
let lastMuted = false;

const isIncognito = chrome.extension.inIncognitoContext;

const AudioContextClass =
  window.AudioContext ||
  (window as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;

const resumeAudioContext = (context: AudioContext): void => {
  if (context.state !== "suspended") {
    return;
  }

  context.resume().catch(() => undefined);
};

const resumeAllContexts = (): void => {
  mediaNodes.forEach((node) => resumeAudioContext(node.context));
};

const retryPendingGain = (): void => {
  if (lastVolume === DEFAULT_VOLUME && !lastMuted) {
    return;
  }

  applyGainToAllMedia(lastVolume, lastMuted);
};

const gestureEvents = ["click", "keydown", "pointerdown", "touchstart"] as const;
for (const eventName of gestureEvents) {
  window.addEventListener(
    eventName,
    () => {
      resumeAllContexts();
      if (isIncognito) {
        retryPendingGain();
      }
    },
    { capture: true, passive: true }
  );
}

if (isIncognito) {
  document.addEventListener(
    "play",
    () => {
      resumeAllContexts();
      retryPendingGain();
    },
    { capture: true, passive: true }
  );
}

const closePipeline = (media: HTMLMediaElement, node: AudioPipelineNode): void => {
  node.abort.abort();

  try {
    node.source.disconnect();
    node.gain.disconnect();
  } catch {
    // Already disconnected.
  }

  void node.context.close().catch(() => undefined);
  mediaNodes.delete(media);
};

export const pruneDisconnectedMedia = (): void => {
  for (const [media, node] of mediaNodes) {
    if (!media.isConnected) {
      closePipeline(media, node);
    }
  }
};

const getOrCreatePipelineNode = (media: HTMLMediaElement): AudioPipelineNode | null => {
  const existingNode = mediaNodes.get(media);
  if (existingNode) {
    return existingNode;
  }

  if (failedMedia.has(media) || !AudioContextClass) {
    return null;
  }

  try {
    const context = new AudioContextClass();
    resumeAudioContext(context);

    // Incognito: hooking while suspended permanently silences the element.
    if (isIncognito && context.state !== "running") {
      void context.close().catch(() => undefined);
      return null;
    }

    let source: MediaElementAudioSourceNode;

    try {
      source = context.createMediaElementSource(media);
    } catch (error) {
      void context.close().catch(() => undefined);
      throw error;
    }

    const gain = context.createGain();
    const abort = new AbortController();

    source.connect(gain).connect(context.destination);

    const handlePlay = (): void => resumeAudioContext(context);
    media.addEventListener("play", handlePlay, { passive: true, signal: abort.signal });
    media.addEventListener("playing", handlePlay, { passive: true, signal: abort.signal });

    const node: AudioPipelineNode = { context, gain, source, abort };
    mediaNodes.set(media, node);
    resumeAudioContext(context);
    return node;
  } catch (error) {
    if (error instanceof DOMException && error.name === "InvalidStateError") {
      failedMedia.add(media);
    }
    return null;
  }
};

export const applyGainToMedia = (
  media: HTMLMediaElement,
  volume: number,
  isMuted: boolean
): void => {
  const isDefaultState = volume === DEFAULT_VOLUME && !isMuted;
  if (isDefaultState && !mediaNodes.has(media)) {
    return;
  }

  const node = getOrCreatePipelineNode(media);
  if (!node) {
    return;
  }

  resumeAudioContext(node.context);

  const gainValue = isMuted ? 0 : Math.max(0, Math.min(MAX_GAIN, volume / 100));
  const now = node.context.currentTime;
  node.gain.gain.cancelScheduledValues(now);
  node.gain.gain.setTargetAtTime(gainValue, now, 0.015);
};

const collectMedia = (root: ParentNode | HTMLMediaElement): HTMLMediaElement[] => {
  if (root instanceof HTMLMediaElement) {
    return [root];
  }

  return [...root.querySelectorAll<HTMLMediaElement>("audio, video")];
};

export const applyGainToAllMedia = (volume: number, isMuted: boolean): void => {
  lastVolume = volume;
  lastMuted = isMuted;

  pruneDisconnectedMedia();
  collectMedia(document).forEach((media) => applyGainToMedia(media, volume, isMuted));
};

export const applyGainToAddedNode = (
  node: Node,
  volume: number,
  isMuted: boolean
): void => {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  lastVolume = volume;
  lastMuted = isMuted;
  collectMedia(node).forEach((media) => applyGainToMedia(media, volume, isMuted));
};
