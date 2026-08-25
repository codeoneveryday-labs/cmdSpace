import { describe, expect, it } from "vitest";
import { detectAgentSpinnerState } from "./agentSpinner";

describe("detectAgentSpinnerState", () => {
  it("recognizes Codex and Claude spinner titles", () => {
    expect(detectAgentSpinnerState("\x1b]0;⠋ Working…\x1b\\")).toBe("working");
    expect(detectAgentSpinnerState("\x1b]2;◐ Thinking…\x1b\\")).toBe("working");
    expect(detectAgentSpinnerState("\x1b]0;⠿ Working…\x1b\\")).toBe("working");
  });

  it("recognizes Codex buffer fallback and blocked prompts", () => {
    expect(detectAgentSpinnerState("• Working (3s · esc to interrupt)")).toBe("working");
    expect(detectAgentSpinnerState("\x1b]0;Action Required\x1b\\")).toBe("blocked");
    expect(detectAgentSpinnerState("△ Permission required")).toBe("blocked");
  });

  it("accepts generic agent working prompts for the provider catalog", () => {
    expect(detectAgentSpinnerState("thinking…")).toBe("working");
    expect(detectAgentSpinnerState("press esc to interrupt")).toBe("working");
  });
});
