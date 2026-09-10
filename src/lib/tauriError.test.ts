import { describe, expect, it } from "vitest";
import { parseIpcError, TauriIpcError, toTauriIpcError } from "./tauriError";

describe("tauri IPC errors", () => {
  it("preserves structured native codes and messages", () => {
    expect(parseIpcError({ code: "FS_NOT_FOUND", message: "missing" })).toEqual({
      code: "FS_NOT_FOUND",
      message: "missing",
    });
  });

  it("keeps legacy errors readable while adding a stable unknown code", () => {
    const error = toTauriIpcError(new Error("offline"));

    expect(error).toBeInstanceOf(TauriIpcError);
    expect(error.code).toBe("UNKNOWN");
    expect(error.message).toBe("offline");
    expect(String(error)).toContain("offline");
  });
});
