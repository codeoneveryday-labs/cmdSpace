import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLayoutEffect, type RefObject } from "react";

const PLAY_RETRY_MS = 250;

type BackgroundVideoPlayback = {
  resume: () => void;
  dispose: () => void;
};

export function startBackgroundVideoPlayback(
  video: HTMLVideoElement,
  sourceUrl: string,
): BackgroundVideoPlayback {
  let disposed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetry = () => {
    if (retryTimer === null) return;
    clearTimeout(retryTimer);
    retryTimer = null;
  };

  const scheduleRetry = () => {
    if (disposed || !video.paused || retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      resume();
    }, PLAY_RETRY_MS);
  };

  const resume = () => {
    if (disposed || !video.paused) return;
    clearRetry();
    const currentAttempt = ++attempt;
    const playResult = video.play();

    // WKWebView can leave play() pending while another app window owns focus.
    // Retry until the element emits `playing`, then the timer is cancelled.
    scheduleRetry();
    void playResult
      .then(() => {
        if (disposed || currentAttempt !== attempt) return;
        if (video.paused) scheduleRetry();
        else clearRetry();
      })
      .catch(() => {
        if (disposed || currentAttempt !== attempt) return;
        scheduleRetry();
      });
  };

  const onPlaying = () => {
    attempt += 1;
    clearRetry();
  };
  const onPause = () => scheduleRetry();

  // Configure silence before assigning src. WebKit evaluates autoplay as soon
  // as media loading begins and blocks videos with an audio track otherwise.
  video.defaultMuted = true;
  video.muted = true;
  video.setAttribute("muted", "");
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.addEventListener("loadedmetadata", resume);
  video.addEventListener("loadeddata", resume);
  video.addEventListener("canplay", resume);
  video.addEventListener("playing", onPlaying);
  video.addEventListener("pause", onPause);
  video.src = sourceUrl;
  video.load();
  resume();

  return {
    resume,
    dispose: () => {
      disposed = true;
      clearRetry();
      video.removeEventListener("loadedmetadata", resume);
      video.removeEventListener("loadeddata", resume);
      video.removeEventListener("canplay", resume);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
    },
  };
}

export function useBackgroundVideoPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  sourceUrl: string | null,
): void {
  useLayoutEffect(() => {
    if (!sourceUrl || !videoRef.current) return;
    const playback = startBackgroundVideoPlayback(videoRef.current, sourceUrl);
    let disposed = false;
    let unlistenNativeFocus: (() => void) | undefined;
    const resumeWhenVisible = () => {
      if (!document.hidden) playback.resume();
    };

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) playback.resume();
      })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        unlistenNativeFocus = unlisten;
        void getCurrentWindow()
          .isFocused()
          .then((focused) => {
            if (!disposed && focused) playback.resume();
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);

    window.addEventListener("focus", playback.resume);
    document.addEventListener("visibilitychange", resumeWhenVisible);
    return () => {
      disposed = true;
      unlistenNativeFocus?.();
      window.removeEventListener("focus", playback.resume);
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      playback.dispose();
    };
  }, [sourceUrl, videoRef]);
}
