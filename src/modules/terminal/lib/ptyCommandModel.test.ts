import { describe, expect, it } from "vitest";

import {
  buildPtyClosePayload,
  buildPtyMetadataPayload,
  buildPtyOpenPayload,
  buildPtyResizePayload,
  buildPtyWritePayload,
} from "./ptyCommandModel";

describe("PTY command payload model", () => {
  it("keeps open payload casing and explicit nulls aligned with Rust", () => {
    const onData = {};
    const onExit = {};

    expect(
      buildPtyOpenPayload({
        cols: 120,
        rows: 40,
        cwd: undefined,
        initialCommand: "codex",
        shell: "zsh",
        workspace: { kind: "local" },
        onData,
        onExit,
      }),
    ).toEqual({
      cols: 120,
      rows: 40,
      cwd: null,
      initialCommand: "codex",
      shell: "zsh",
      workspace: { kind: "local" },
      onData,
      onExit,
    });
  });

  it("uses the Rust command parameter names for write, resize, metadata and close", () => {
    expect(buildPtyWritePayload(7, "ls\r")).toEqual({ id: 7, data: "ls\r" });
    expect(buildPtyResizePayload(7, 100, 30)).toEqual({
      id: 7,
      cols: 100,
      rows: 30,
    });
    expect(buildPtyMetadataPayload(7, {})).toEqual({
      id: 7,
      title: null,
      cwd: null,
      agent: null,
    });
    expect(buildPtyClosePayload(7)).toEqual({ id: 7 });
  });
});
