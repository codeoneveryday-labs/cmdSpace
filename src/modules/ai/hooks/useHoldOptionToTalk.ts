import { useEffect } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { SpeechInputTarget } from "../lib/voiceTranscriptInsertionModel";

export type HoldOptionKeyEvent = {
  code: string;
  key: string;
  repeat?: boolean;
};

type HoldOptionControllerOptions = {
  isEnabled: () => boolean;
  captureTarget: () => SpeechInputTarget | null;
  start: (target: SpeechInputTarget) => void | Promise<void>;
  stop: () => void;
  armMs?: number;
};

export function createHoldOptionController({
  isEnabled,
  captureTarget,
  start,
  stop,
  armMs = 320,
}: HoldOptionControllerOptions) {
  let optionDown = false;
  let armed = false;
  let disqualified = false;
  let armTimer: ReturnType<typeof setTimeout> | null = null;

  const isOptionKey = (event: HoldOptionKeyEvent) =>
    event.code === "AltLeft" ||
    event.code === "AltRight" ||
    event.key === "Alt" ||
    event.key === "AltGraph";

  const clearArm = () => {
    if (armTimer === null) return;
    clearTimeout(armTimer);
    armTimer = null;
  };

  const reset = () => {
    clearArm();
    if (armed) stop();
    optionDown = false;
    armed = false;
    disqualified = false;
  };

  const keydown = (event: HoldOptionKeyEvent) => {
    if (!isEnabled()) return;
    if (isOptionKey(event)) {
      if (event.repeat || optionDown) return;
      optionDown = true;
      disqualified = false;
      const target = captureTarget();
      if (!target) {
        disqualified = true;
        return;
      }
      armTimer = setTimeout(() => {
        armTimer = null;
        if (!optionDown || disqualified || !isEnabled()) return;
        armed = true;
        void start(target);
      }, armMs);
      return;
    }
    if (optionDown && !armed) {
      disqualified = true;
      clearArm();
    }
  };

  const keyup = (event: HoldOptionKeyEvent) => {
    if (!isOptionKey(event)) return;
    clearArm();
    if (armed) stop();
    optionDown = false;
    armed = false;
    disqualified = false;
  };

  return { keydown, keyup, blur: reset, dispose: reset };
}

export function useHoldOptionToTalk({
  captureTarget,
  start,
  stop,
}: {
  captureTarget: () => SpeechInputTarget | null;
  start: (target: SpeechInputTarget) => void | Promise<void>;
  stop: () => void;
}): void {
  useEffect(() => {
    const controller = createHoldOptionController({
      isEnabled: () => usePreferencesStore.getState().floatingVoiceAgentEnabled,
      captureTarget,
      start,
      stop,
    });
    const onKeyDown = (event: KeyboardEvent) => controller.keydown(event);
    const onKeyUp = (event: KeyboardEvent) => controller.keyup(event);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", controller.blur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", controller.blur);
      controller.dispose();
    };
  }, [captureTarget, start, stop]);
}
