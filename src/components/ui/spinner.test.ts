import cliSpinners from "cli-spinners";
import { describe, expect, it } from "vitest";
import {
  SPINNER_FRAMES,
  SPINNER_FRAME_INTERVAL,
  spinnerFrame,
} from "./spinner";

describe("Spinner", () => {
  it("uses cli-spinners dots as the shared loading sequence", () => {
    expect(SPINNER_FRAMES).toEqual(cliSpinners.dots.frames);
    expect(SPINNER_FRAME_INTERVAL).toBe(cliSpinners.dots.interval);
    expect(spinnerFrame(0)).toBe(cliSpinners.dots.frames[0]);
    expect(spinnerFrame(cliSpinners.dots.frames.length)).toBe(
      cliSpinners.dots.frames[0],
    );
  });
});
