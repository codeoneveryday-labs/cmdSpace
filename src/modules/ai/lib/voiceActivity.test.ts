import { describe, expect, it } from "vitest";
import { hasDetectedVoiceActivity } from "./voiceActivity";

describe("hasDetectedVoiceActivity", () => {
  it("rejects a silent microphone signal", () => {
    expect(hasDetectedVoiceActivity(0)).toBe(false);
    expect(hasDetectedVoiceActivity(0.02)).toBe(false);
  });

  it("accepts a microphone signal above the voice floor", () => {
    expect(hasDetectedVoiceActivity(0.03)).toBe(true);
  });
});
