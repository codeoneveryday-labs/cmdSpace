import { describe, expect, it } from "vitest";
import {
  createInitialCompositionCommitState,
  evaluateCommitForward,
  isPrintableAsciiCharacter,
  isPrintableData,
  normalizeTerminalWhitespace,
} from "./imeCompositionModel";

describe("imeCompositionModel", () => {
  describe("normalizeTerminalWhitespace", () => {
    it("normalizes C1 controls and NBSP to normal space", () => {
      // U+00A0 (NBSP)
      expect(normalizeTerminalWhitespace("git\u00a0status")).toBe("git status");
      // U+2000 (En quad), U+3000 (Ideographic space)
      expect(normalizeTerminalWhitespace("cd\u2000dir\u3000test")).toBe("cd dir test");
      // Multiple consecutive special spaces
      expect(normalizeTerminalWhitespace("npm\u00a0\u00a0run\u202fbuild")).toBe("npm run build");
    });

    it("leaves standard ASCII text unchanged", () => {
      expect(normalizeTerminalWhitespace("ls -la /tmp")).toBe("ls -la /tmp");
    });
  });

  describe("isPrintableData & isPrintableAsciiCharacter", () => {
    it("recognizes ASCII printable characters", () => {
      expect(isPrintableAsciiCharacter(0x20)).toBe(true); // Space
      expect(isPrintableAsciiCharacter(0x41)).toBe(true); // 'A'
      expect(isPrintableAsciiCharacter(0x7f)).toBe(false); // DEL
      expect(isPrintableAsciiCharacter(0x0a)).toBe(false); // LF
    });

    it("evaluates printable data strings", () => {
      expect(isPrintableData("hello")).toBe(true);
      expect(isPrintableData("")).toBe(false);
      expect(isPrintableData("hello\n")).toBe(false);
    });
  });

  describe("evaluateCommitForward", () => {
    it("always forwards when not finalizing", () => {
      const state = createInitialCompositionCommitState();
      const result = evaluateCommitForward(state, "test");
      expect(result.shouldForward).toBe(true);
    });

    it("forwards the first commit during finalization and suppresses duplicate commit", () => {
      const state = {
        finalizing: true,
        firstCommit: null,
        generation: 1,
        windowBlurred: false,
      };

      const first = evaluateCommitForward(state, "a");
      expect(first.shouldForward).toBe(true);
      expect(first.nextFirstCommit).toBe("a");

      const second = evaluateCommitForward({ ...state, firstCommit: "a" }, "a");
      expect(second.shouldForward).toBe(false);

      const different = evaluateCommitForward({ ...state, firstCommit: "a" }, "b");
      expect(different.shouldForward).toBe(true);
    });
  });
});
