import { describe, expect, it } from "vitest";
import { matchBinding } from "./shortcuts";

describe("shortcut matching", () => {
  it("matches Cmd+> when WebKit reports the shifted period key code", () => {
    const event = {
      key: ".",
      code: "Period",
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      metaKey: true,
    } as KeyboardEvent;

    expect(
      matchBinding(
        event,
        { key: ">", meta: true, shift: true },
        "pane.maximize",
      ),
    ).toBe(true);
  });
});
