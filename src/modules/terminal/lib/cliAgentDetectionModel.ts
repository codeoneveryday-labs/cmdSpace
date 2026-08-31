import type { CliAgent, CliAgentDefinition } from "./cliAgents";

export function parseCommandSegmentExecutable(segment: string): string | null {
  const words = segment.trim().split(/\s+/);
  let index = 0;
  while (
    words[index] === "command" ||
    words[index] === "exec" ||
    words[index] === "sudo" ||
    words[index]?.includes("=")
  ) {
    index += 1;
  }
  return words[index]?.replace(/^['"]|['"]$/g, "") ?? null;
}

export function isCommandCodeCliSegment(segment: string): boolean {
  const words = segment.trim().split(/\s+/);
  if (words[0] !== "cmd") return false;
  const arg = words[1];
  if (!arg) return true;
  return arg.startsWith("--");
}

export function splitCommandSegments(command: string): string[] {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function matchCliAgentByExecutable(
  command: string,
  definitions: readonly CliAgentDefinition[],
): CliAgent | null {
  if (!command) return null;
  const segments = splitCommandSegments(command);

  for (const { executable, id } of definitions) {
    const matched = segments.some((segment) => {
      if (parseCommandSegmentExecutable(segment) !== executable) return false;
      if (id === "cmd") return isCommandCodeCliSegment(segment);
      return true;
    });
    if (matched) return id;
  }
  return null;
}

export function matchCliAgentBannerPattern(
  text: string,
  definitions: readonly CliAgentDefinition[],
): CliAgent | null {
  for (const { id, bannerPatterns } of definitions) {
    if (bannerPatterns.some((pattern) => pattern.test(text))) {
      return id;
    }
  }
  return null;
}
