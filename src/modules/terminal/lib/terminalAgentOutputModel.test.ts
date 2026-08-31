import { describe, expect, it } from "vitest";
import { resolveAgentOutputActivity } from "./terminalAgentOutputModel";

describe("terminalAgentOutputModel", () => {
  it("distinguishes blocked, working and quiet agent output", () => {
    expect(
      resolveAgentOutputActivity({
        responseRequested: true,
        spinnerState: "blocked",
        outputIsUserEcho: false,
      }),
    ).toEqual({ kind: "blocked" });
    expect(
      resolveAgentOutputActivity({
        responseRequested: true,
        spinnerState: "working",
        outputIsUserEcho: false,
      }),
    ).toEqual({ kind: "working" });
    expect(
      resolveAgentOutputActivity({
        responseRequested: true,
        spinnerState: "idle",
        outputIsUserEcho: false,
      }),
    ).toEqual({ kind: "quiet" });
  });

  it("ignores output that is not a response or is a user echo", () => {
    expect(
      resolveAgentOutputActivity({
        responseRequested: false,
        spinnerState: "working",
        outputIsUserEcho: false,
      }),
    ).toEqual({ kind: "ignore" });
    expect(
      resolveAgentOutputActivity({
        responseRequested: true,
        spinnerState: "working",
        outputIsUserEcho: true,
      }),
    ).toEqual({ kind: "ignore" });
  });
});
