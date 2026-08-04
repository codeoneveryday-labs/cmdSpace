import { describe, expect, it } from "vitest";
import { parseSpaceCommand } from "./spaceCommand";

describe("parseSpaceCommand", () => {
  it("turns a Space music request into a direct playback action", () => {
    expect(
      parseSpaceCommand(
        "Hello Space, I need you to create a music terminal and play a Son Tung playlist please",
      ),
    ).toEqual({ kind: "play-music", query: "Son Tung playlist" });
  });

  it("leaves requests without the Space wake phrase for the Voice Agent draft flow", () => {
    expect(
      parseSpaceCommand("Create a music terminal and play a Son Tung playlist"),
    ).toBeNull();
  });
});
