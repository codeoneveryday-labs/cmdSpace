import { describe, expect, it } from "vitest";
import {
  INTERNAL_PATHS_MIME,
  INTERNAL_PATHS_TEXT_PREFIX,
  readInternalPaths,
  writeInternalPaths,
} from "./internalDrag";

function transfer(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get types() {
      return [...values.keys()];
    },
    getData(type: string) {
      return values.get(type) ?? "";
    },
    setData(type: string, value: string) {
      values.set(type, value);
    },
  };
}

describe("Explorer internal drag payload", () => {
  it("writes both custom MIME and prefixed text fallbacks", () => {
    const dataTransfer = transfer();

    writeInternalPaths(dataTransfer, ["/workspace/a.txt", "/workspace/assets"]);

    expect(dataTransfer.getData(INTERNAL_PATHS_MIME)).toBe(
      '["/workspace/a.txt","/workspace/assets"]',
    );
    expect(dataTransfer.getData("text/plain")).toBe(
      `${INTERNAL_PATHS_TEXT_PREFIX}["/workspace/a.txt","/workspace/assets"]`,
    );
  });

  it("reads the text fallback when WebKit strips custom MIME data", () => {
    const dataTransfer = transfer({
      "text/plain": `${INTERNAL_PATHS_TEXT_PREFIX}["/workspace/a.txt"]`,
    });

    expect(readInternalPaths(dataTransfer)).toEqual(["/workspace/a.txt"]);
  });

  it("ignores unrelated text and malformed path payloads", () => {
    expect(readInternalPaths(transfer({ "text/plain": "ordinary text" }))).toEqual([]);
    expect(
      readInternalPaths(
        transfer({ "text/plain": `${INTERNAL_PATHS_TEXT_PREFIX}[1,2]` }),
      ),
    ).toEqual([]);
  });
});
