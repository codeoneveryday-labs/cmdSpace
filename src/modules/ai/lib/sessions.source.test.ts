import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sessionsPath = path.join(here, "sessions.ts");
const chatStorePath = path.join(here, "../store/chatStore.ts");

describe("AI session persistence", () => {
  it("namespaces session records by workspace scope", () => {
    const source = readFileSync(sessionsPath, "utf8");

    expect(source).toContain("scopeKey: string");
    expect(source).toContain("`sessions:${encodedScope(scopeKey)}`");
    expect(source).toContain("`messages:${encodedScope(scopeKey)}:${id}`");
    expect(source).toContain("`activeId:${encodedScope(scopeKey)}`");
    expect(source).toContain("legacyMessagesKey");
    expect(source).toContain('scopeKey === "global"');
  });

  it("does not create another empty chat when the current chat is still new", () => {
    const source = readFileSync(chatStorePath, "utf8");

    expect(source).toContain('current.title === "New chat"');
    expect(source).toContain("return current.id;");
  });
});
