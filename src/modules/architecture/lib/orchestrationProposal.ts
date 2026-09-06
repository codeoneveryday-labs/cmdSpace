import {
  validateOrchestrationManifest,
  type OrchestrationManifestV1,
  type OrchestrationProvider,
} from "./orchestrationManifest";

const PROPOSAL_PATTERN = /<cmdspace-orchestration>\s*([\s\S]*?)\s*<\/cmdspace-orchestration>/g;

export function extractOrchestrationProposal(
  response: string,
): OrchestrationManifestV1 {
  const matches = [...response.matchAll(PROPOSAL_PATTERN)];
  if (matches.length !== 1) {
    throw new Error("Orchestrator response did not include a tagged manifest");
  }
  return parseOrchestrationManifestJson(matches[0]![1]);
}

export function parseOrchestrationManifestJson(
  source: string,
): OrchestrationManifestV1 {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Orchestrator manifest is not valid JSON");
  }
  const manifest = parseManifest(value);
  const validation = validateOrchestrationManifest(manifest);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }
  return manifest;
}

function parseManifest(value: unknown): OrchestrationManifestV1 {
  const record = asRecord(value, "Orchestrator manifest must be an object");
  return {
    version: numberAt(record, "version"),
    title: stringAt(record, "title"),
    goal: stringAt(record, "goal"),
    orchestrator: parseOrchestrator(asRecord(record.orchestrator, "Orchestrator is required")),
    agents: arrayAt(record, "agents").map((agent) => parseAgent(asRecord(agent, "Agent must be an object"))),
    tasks: arrayAt(record, "tasks").map((task) => parseTask(asRecord(task, "Task must be an object"))),
  } as OrchestrationManifestV1;
}

function parseOrchestrator(record: Record<string, unknown>) {
  return {
    provider: stringAt(record, "provider") as OrchestrationProvider,
    ...(typeof record.model === "string" ? { model: record.model } : {}),
  };
}

function parseAgent(record: Record<string, unknown>) {
  return {
    id: stringAt(record, "id"),
    name: stringAt(record, "name"),
    role: stringAt(record, "role"),
    provider: stringAt(record, "provider") as OrchestrationProvider,
    ...(typeof record.model === "string" ? { model: record.model } : {}),
  };
}

function parseTask(record: Record<string, unknown>) {
  const validationCommands = arrayAt(record, "validationCommands").map((command) => {
    if (typeof command !== "string") throw new Error("Validation command must be a string");
    return command;
  });
  return {
    id: stringAt(record, "id"),
    title: stringAt(record, "title"),
    instructions: stringAt(record, "instructions"),
    assigneeId: stringAt(record, "assigneeId"),
    dependsOn: arrayAt(record, "dependsOn").map((dependency) => {
      if (typeof dependency !== "string") throw new Error("Task dependency must be a string");
      return dependency;
    }),
    writeAccess: booleanAt(record, "writeAccess"),
    doneWhen: stringAt(record, "doneWhen"),
    validationCommands,
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function arrayAt(record: Record<string, unknown>, key: string): unknown[] {
  if (!Array.isArray(record[key])) throw new Error(`Orchestrator manifest field '${key}' must be an array`);
  return record[key];
}

function stringAt(record: Record<string, unknown>, key: string): string {
  if (typeof record[key] !== "string") throw new Error(`Orchestrator manifest field '${key}' must be a string`);
  return record[key];
}

function numberAt(record: Record<string, unknown>, key: string): number {
  if (typeof record[key] !== "number") throw new Error(`Orchestrator manifest field '${key}' must be a number`);
  return record[key];
}

function booleanAt(record: Record<string, unknown>, key: string): boolean {
  if (typeof record[key] !== "boolean") throw new Error(`Orchestrator manifest field '${key}' must be a boolean`);
  return record[key];
}
