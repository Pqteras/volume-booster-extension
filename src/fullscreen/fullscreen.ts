import type { TabFullscreenChangeMessage } from "../types";

const handleFullscreenChange = (): void => {
  const isFullscreen = Boolean(document.fullscreenElement);
  const message: TabFullscreenChangeMessage = {
    target: "background",
    type: "TAB_FULLSCREEN_CHANGE",
    fullscreen: isFullscreen,
  };

  void chrome.runtime.sendMessage(message).catch(() => undefined);
};

document.addEventListener("fullscreenchange", handleFullscreenChange, {
  passive: true,
});
