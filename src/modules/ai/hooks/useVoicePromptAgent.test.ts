import { describe, expect, it } from "vitest";
import {
  isMicrophonePermissionError,
  MACOS_MICROPHONE_SETTINGS_URL,
} from "./useVoicePromptAgent";

describe("microphone permission retry", () => {
  it("recognizes the macOS microphone denial message", () => {
    expect(
      isMicrophonePermissionError(
        "Microphone access is blocked. Allow cmdSpace in macOS Settings → Privacy & Security → Microphone, then try again.",
      ),
    ).toBe(true);
    expect(isMicrophonePermissionError("Speech recognition failed.")).toBe(false);
  });

  it("targets the macOS microphone privacy pane", () => {
    expect(MACOS_MICROPHONE_SETTINGS_URL).toBe(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
    );
  });
});
