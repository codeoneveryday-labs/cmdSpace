import { describe, expect, it } from "vitest";
import {
  cleanCommitMessage,
  isValidCommitMessage,
  truncateDiff,
} from "./commitGenerator";

describe("commitGenerator helpers", () => {
  describe("cleanCommitMessage", () => {
    it("strips markdown code blocks", () => {
      const input = "```markdown\nfeat(terminal): resolve key duplication\n```";
      expect(cleanCommitMessage(input)).toBe("feat(terminal): resolve key duplication");
    });

    it("strips double quotes and backticks from first line", () => {
      const input = '"fix(telex): correct capturing event"';
      expect(cleanCommitMessage(input)).toBe("fix(telex): correct capturing event");
    });

    it("returns empty string if raw is empty or whitespace only", () => {
      expect(cleanCommitMessage("   ")).toBe("");
    });
  });

  describe("isValidCommitMessage", () => {
    it("identifies valid conventional commits", () => {
      expect(isValidCommitMessage("feat(terminal): add search")).toBe(true);
      expect(isValidCommitMessage("fix: correct regression")).toBe(true);
      expect(isValidCommitMessage("chore(ci): update workflow")).toBe(true);
    });

    it("identifies invalid conventional commits", () => {
      expect(isValidCommitMessage("feat terminal: add search")).toBe(false);
      expect(isValidCommitMessage("added new search option")).toBe(false);
      expect(isValidCommitMessage("fix(telex)")).toBe(false);
    });
  });

  describe("truncateDiff", () => {
    it("keeps diff unchanged if below char limit", () => {
      const diff = "some clean git diff output here";
      const result = truncateDiff(diff);
      expect(result.text).toBe(diff);
      expect(result.truncated).toBe(false);
    });

    it("truncates diff if above char limit", () => {
      const diff = "a".repeat(70_000);
      const result = truncateDiff(diff);
      expect(result.text.length).toBe(60_000);
      expect(result.truncated).toBe(true);
    });
  });
});
