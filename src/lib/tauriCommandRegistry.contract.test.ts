import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const frontendRoot = path.join(root, "src");
const backendRoot = path.join(root, "src-tauri/src");
const registryPath = path.join(root, "src-tauri/src/commands.rs");

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(target);
    if (
      !entry.isFile() ||
      !/\.(?:ts|tsx)$/.test(entry.name) ||
      /\.test\.(?:ts|tsx)$/.test(entry.name)
    ) {
      return [];
    }
    return [target];
  });
}

function rustSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return rustSourceFiles(target);
    return entry.isFile() && entry.name.endsWith(".rs") ? [target] : [];
  });
}

function registeredCommandNames(source: string): Set<string> {
  const start = source.indexOf("tauri::generate_handler![");
  const end = source.indexOf("]", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  const handler = source.slice(start, end);
  return new Set(
    [...handler.matchAll(/(?:[A-Za-z_]\w*::)+([A-Za-z_]\w*)\s*,/g)].map(
      (match) => match[1],
    ),
  );
}

function invokedCommandNames(source: string): string[] {
  return [
    ...source.matchAll(
      /\binvoke(?:<[^>]*>)?\s*\(\s*["']([a-z][a-z0-9_]*)["']/g,
    ),
  ].map((match) => match[1]);
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function commandParametersByName(): Map<string, Set<string>> {
  const parameters = new Map<string, Set<string>>();
  const commandPattern =
    /#\[tauri::command\](?:\s*#\[[\s\S]*?\])*\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:->|where|\{)/g;

  for (const file of rustSourceFiles(backendRoot)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(commandPattern)) {
      const name = match[1];
      const names = parameters.get(name) ?? new Set<string>();
      for (const parameter of match[2].split(",")) {
        const parameterName = parameter.trim().split(":", 1)[0]?.trim();
        if (parameterName && /^[A-Za-z_]\w*$/.test(parameterName)) {
          names.add(parameterName.replace(/^_+/, ""));
        }
      }
      parameters.set(name, names);
    }
  }
  return parameters;
}

function balancedObjectBody(source: string, start: number): string | null {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  return null;
}

function topLevelObjectKeys(body: string): string[] {
  const segments: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let index = 0; index <= body.length; index += 1) {
    const character = body[index];
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{" || character === "[" || character === "(") depth += 1;
    if (character === "}" || character === "]" || character === ")") depth -= 1;
    if ((character === "," && depth === 0) || index === body.length) {
      segments.push(body.slice(start, index));
      start = index + 1;
    }
  }
  return segments.flatMap((segment) => {
    const match = segment.trim().match(/^([A-Za-z_]\w*)\s*(?::|$)/);
    return match ? [match[1]] : [];
  });
}

function staticPayloadKeys(source: string): Array<{ command: string; keys: string[] }> {
  const calls: Array<{ command: string; keys: string[] }> = [];
  const callPattern =
    /\binvoke(?:<[^>]*>)?\s*\(\s*["']([a-z][a-z0-9_]*)["']/g;

  for (const match of source.matchAll(callPattern)) {
    let payloadStart = match.index + match[0].length;
    while (/\s/.test(source[payloadStart] ?? "")) payloadStart += 1;
    if (source[payloadStart] !== ",") continue;
    payloadStart += 1;
    while (/\s/.test(source[payloadStart] ?? "")) payloadStart += 1;
    if (source[payloadStart] !== "{") continue;
    const body = balancedObjectBody(source, payloadStart);
    if (body !== null) {
      calls.push({ command: match[1], keys: topLevelObjectKeys(body) });
    }
  }
  return calls;
}

describe("Tauri command registry contract", () => {
  it("registers every statically invoked production command", () => {
    const registered = registeredCommandNames(readFileSync(registryPath, "utf8"));
    const invoked = new Set(
      productionSourceFiles(frontendRoot).flatMap((file) =>
        invokedCommandNames(readFileSync(file, "utf8")),
      ),
    );

    const unregistered = [...invoked].filter((command) => !registered.has(command));

    expect(invoked.size).toBeGreaterThan(0);
    expect(unregistered).toEqual([]);
  });

  it("uses registered Rust parameter names for static invoke payload fields", () => {
    const registered = registeredCommandNames(readFileSync(registryPath, "utf8"));
    const parameters = commandParametersByName();
    const mismatches = productionSourceFiles(frontendRoot).flatMap((file) =>
      staticPayloadKeys(readFileSync(file, "utf8")).flatMap(({ command, keys }) => {
        if (!registered.has(command)) return [];
        const commandParameters = parameters.get(command);
        if (!commandParameters) return [`${command}: Rust command declaration not found`];
        return keys
          .filter((key) => !commandParameters.has(camelToSnake(key)))
          .map((key) => `${command}.${key}`);
      }),
    );

    expect(mismatches).toEqual([]);
  });
});
