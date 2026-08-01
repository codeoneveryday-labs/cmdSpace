import type { UIMessage } from "@ai-sdk/react";
import { createUIMessageStream } from "ai";
import { type ModelId } from "../config";
import {
  generatePromptText,
  runAgentStream,
  type AgentUsageDelta,
} from "./agent";
import type { ProviderKeys } from "./keyring";

export { isCompletePromptBrief } from "./agent";
import { native } from "./native";
import type { ToolContext } from "../tools/tools";

const CMDSPACE_MD_MAX_BYTES = 32 * 1024;
type MemoryCacheEntry = { content: string | null; mtime: number };
const projectMemoryCache = new Map<string, MemoryCacheEntry>();

async function readCmdspaceMd(workspaceRoot: string | null): Promise<string | null> {
  if (!workspaceRoot) return null;
  const path = `${workspaceRoot.replace(/\/$/, "")}/CMDSPACE.md`;
  const cached = projectMemoryCache.get(workspaceRoot);
  if (cached && Date.now() - cached.mtime < 30_000) return cached.content;
  try {
    const r = await native.readFile(path);
    if (r.kind !== "text") {
      projectMemoryCache.set(workspaceRoot, { content: null, mtime: Date.now() });
      return null;
    }
    const content =
      r.content.length > CMDSPACE_MD_MAX_BYTES
        ? r.content.slice(0, CMDSPACE_MD_MAX_BYTES)
        : r.content;
    projectMemoryCache.set(workspaceRoot, { content, mtime: Date.now() });
    return content;
  } catch {
    projectMemoryCache.set(workspaceRoot, { content: null, mtime: Date.now() });
    return null;
  }
}

type LiveSnapshot = {
  cwd: string | null;
  terminalPrivate: boolean;
  workspaceRoot: string | null;
  activeFile: string | null;
};

type Deps = {
  getKeys: () => ProviderKeys;
  toolContext: ToolContext;
  getModelId: () => ModelId;
  getCustomInstructions: () => string;
  getAgentPersona: () => { name: string; instructions: string } | null;
  getLive: () => LiveSnapshot;
  getLmstudioBaseURL?: () => string | undefined;
  getLmstudioModelId?: () => string | undefined;
  getMlxBaseURL?: () => string | undefined;
  getMlxModelId?: () => string | undefined;
  getOllamaBaseURL?: () => string | undefined;
  getOllamaModelId?: () => string | undefined;
  getOpenaiCompatibleBaseURL?: () => string | undefined;
  getOpenaiCompatibleModelId?: () => string | undefined;
  getOpenaiCompatibleContextLimit?: () => number | undefined;
  onStep?: (step: string | null) => void;
  onUsage?: (delta: AgentUsageDelta) => void;
  onCompact?: (info: { droppedCount: number }) => void;
  onFinishMeta?: (info: { hitStepCap: boolean; finishReason: string }) => void;
  getPlanMode?: () => boolean;
};

type SendOptions = {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  [k: string]: unknown;
};

export function createContextAwareTransport(deps: Deps) {
  const run = async (options: SendOptions) => {
    const persona = deps.getAgentPersona();
    const promptRequest = latestUserText(options.messages);
    if (persona?.name === "Prompt Engineer" && promptRequest) {
      return runPromptEngineerDispatch(deps, promptRequest, options.messages);
    }

    const live = deps.getLive();
    const projectMemory = await readCmdspaceMd(live.workspaceRoot);
    const envBlock = formatEnvBlock(live);
    const messagesForRun = envBlock
      ? injectEnvIntoLastUser(options.messages, envBlock)
      : options.messages;
    const result = await runAgentStream({
      keys: deps.getKeys(),
      modelId: deps.getModelId(),
      customInstructions: deps.getCustomInstructions(),
      agentPersona: deps.getAgentPersona(),
      toolContext: deps.toolContext,
      onStep: deps.onStep,
      onUsage: deps.onUsage,
      onCompact: deps.onCompact,
      onFinishMeta: deps.onFinishMeta,
      lmstudioBaseURL: deps.getLmstudioBaseURL?.(),
      lmstudioModelId: deps.getLmstudioModelId?.(),
      mlxBaseURL: deps.getMlxBaseURL?.(),
      mlxModelId: deps.getMlxModelId?.(),
      ollamaBaseURL: deps.getOllamaBaseURL?.(),
      ollamaModelId: deps.getOllamaModelId?.(),
      openaiCompatibleBaseURL: deps.getOpenaiCompatibleBaseURL?.(),
      openaiCompatibleModelId: deps.getOpenaiCompatibleModelId?.(),
      openaiCompatibleContextLimit: deps.getOpenaiCompatibleContextLimit?.(),
      planMode: deps.getPlanMode?.(),
      projectMemory,
      uiMessages: messagesForRun,
      abortSignal: options.abortSignal,
    });
    return result.toUIMessageStream({
      originalMessages: options.messages,
    });
  };

  return {
    sendMessages: run,
    async reconnectToStream(): Promise<null> {
      return null;
    },
  };
}

async function runPromptEngineerDispatch(
  deps: Deps,
  request: string,
  originalMessages: UIMessage[],
) {
  const panes = deps.toolContext
    .getActiveTerminalAgents()
    .filter((pane) => pane.available);
  const activePaneIndex = deps.toolContext.getActiveTerminalPaneIndex();
  const targetPane =
    panes.find((pane) => pane.paneIndex === activePaneIndex) ?? panes[0];
  if (!targetPane) {
    throw new Error("No available coding-agent terminal panes are open.");
  }

  deps.onStep?.("Writing prompt");
  const generationStartedAt = Date.now();
  let prompt: string;
  let usedFallback = false;
  try {
    prompt = await generatePromptText({
      keys: deps.getKeys(),
      modelId: deps.getModelId(),
      request,
      local: {
        lmstudioBaseURL: deps.getLmstudioBaseURL?.(),
        lmstudioModelId: deps.getLmstudioModelId?.(),
        mlxBaseURL: deps.getMlxBaseURL?.(),
        mlxModelId: deps.getMlxModelId?.(),
        ollamaBaseURL: deps.getOllamaBaseURL?.(),
        ollamaModelId: deps.getOllamaModelId?.(),
        openaiCompatibleBaseURL: deps.getOpenaiCompatibleBaseURL?.(),
        openaiCompatibleModelId: deps.getOpenaiCompatibleModelId?.(),
      },
    });
  } catch (error) {
    usedFallback = true;
    console.warn(
      "Prompt Engineer generation failed; sending structured fallback.",
      error,
    );
    prompt = buildPromptEngineerFallback(request);
  }
  const generationMs = Date.now() - generationStartedAt;

  const dispatchStartedAt = Date.now();
  const results = deps.toolContext.dispatchPromptsToTerminals(
    [{ paneIndex: targetPane.paneIndex, prompt }],
  );
  const sent = results.filter((result) => result.sent).length;
  const dispatchMs = Date.now() - dispatchStartedAt;
  console.info("Prompt Engineer timing", {
    modelId: deps.getModelId(),
    generationMs,
    dispatchMs,
    usedFallback,
    requestChars: request.length,
    promptChars: prompt.length,
  });
  deps.onStep?.(null);
  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const id = `prompt-dispatch-${Date.now()}`;
      writer.write({ type: "text-start", id });
      writer.write({
        type: "text-delta",
        id,
        delta: formatPromptEngineerDispatchMessage({
          sent,
          usedFallback,
          generationMs,
          dispatchMs,
        }),
      });
      writer.write({ type: "text-end", id });
    },
  });
  return stream;
}

export function formatPromptEngineerDispatchMessage({
  sent,
  usedFallback,
  generationMs,
  dispatchMs,
}: {
  sent: number;
  usedFallback: boolean;
  generationMs: number;
  dispatchMs: number;
}): string {
  if (!sent) return "No coding-agent terminal accepted the prompt.";

  const timing = `AI ${formatElapsed(generationMs)} · terminal ${formatElapsed(dispatchMs)}`;
  const summary = usedFallback
    ? "Prompt generation was unavailable, so a structured fallback was sent to the active coding-agent terminal pane (1 pane)."
    : "Prompt generated in English and sent to the active coding-agent terminal pane (1 pane).";
  return `${summary} (${timing})`;
}

function formatElapsed(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1_000));
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function buildPromptEngineerFallback(request: string): string {
  const rawRequest = request.trim();
  if (isSnakeGameRequest(rawRequest)) {
    return `## Task
Build a complete, playable Snake game that runs in the browser.

## Context
Create a focused, polished browser game with immediate feedback and controls that feel responsive on desktop and mobile.

## Requirements
- Use HTML, CSS, and vanilla JavaScript only; do not add dependencies.
- Render a clear grid-based game board, snake, food, live score, and game-over state.
- Support Arrow keys and WASD. Prevent the snake from reversing directly into itself.
- Move the snake on a consistent timer, grow it and increase the score when food is eaten, and spawn food only on empty cells.
- End the game on wall or self collision and provide an obvious Restart action. Keep the score reset behavior correct.
- Make the layout responsive and readable on desktop and mobile.

## Constraints
- Inspect the existing repository and reuse its current structure and styling before creating files.
- Keep the game state and rendering logic reliable without external libraries.

## Validation
- Verify movement, reverse-direction blocking, food placement, wall collision, self collision, score updates, and restart on desktop and mobile.`;
  }

  if (isThreeJsPortfolioRequest(rawRequest)) {
    return `## Task
Build a responsive portfolio landing page with an interactive Three.js hero scene.

## Context
The page should feel like a personal creative portfolio: strong first impression, lightweight motion, and clear project storytelling without letting the 3D scene overwhelm the content.

## Requirements
- Create a hero section with a performant interactive Three.js scene, such as an abstract animated object or a rotating project-focused composition.
- Add a concise introduction, featured project work, capabilities or services, and a clear contact call to action.
- Use scroll-linked reveals and subtle hover or pointer interactions that support the content rather than distract from it.
- Keep typography, spacing, color, and project cards visually cohesive.
- Provide graceful behavior when WebGL is unavailable or reduced motion is preferred.
- Make navigation, content, and calls to action usable on mobile as well as desktop.

## Constraints
- Inspect the existing codebase first and integrate with its established stack and styling.
- Use Three.js only if it is already available or required by the request; avoid unrelated dependencies.

## Validation
- Verify the scene initializes without console errors, reacts smoothly to input, respects responsive layouts, and does not block reading or navigation.`;
  }

  return `## Task
Implement the requested feature directly: ${rawRequest}

## Context
Interpret the request before coding, inspect the relevant area of the existing codebase, and fit the result into the current architecture and visual conventions.

## Requirements
- Deliver the requested behavior as a complete, usable flow rather than a placeholder.
- Preserve existing behavior unless the request explicitly changes it.
- Include focused loading, empty, or error states when the feature needs them.

## Constraints
- Reuse existing utilities and components where appropriate; do not add dependencies unless they are necessary.
- Keep the change focused and avoid unrelated refactors or speculative features.

## Validation
- Run the most relevant existing checks for the changed area.
- Manually verify the user-facing flow and confirm that existing behavior still works.`;
}

function isSnakeGameRequest(request: string): boolean {
  return /\bsnake\b|game\s*rắn|trò\s*chơi\s*rắn/i.test(request);
}

function isThreeJsPortfolioRequest(request: string): boolean {
  return /three\.?(?:js)?/i.test(request) && /port?folio|landing\s*page/i.test(request);
}

function latestUserText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    const text = messages[i].parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n")
      .trim();
    if (text) return text;
  }
  return null;
}

function injectEnvIntoLastUser(
  messages: UIMessage[],
  envBlock: string,
): UIMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = m.parts as ReadonlyArray<{ type: string; text?: string }>;
    let textIdx = -1;
    for (let j = 0; j < parts.length; j++) {
      if (parts[j].type === "text") {
        textIdx = j;
        break;
      }
    }
    const nextParts =
      textIdx === -1
        ? [{ type: "text", text: envBlock }, ...parts]
        : parts.map((p, idx) =>
            idx === textIdx
              ? { ...p, text: `${envBlock}\n\n${p.text ?? ""}` }
              : p,
          );
    const out = messages.slice();
    out[i] = { ...m, parts: nextParts } as UIMessage;
    return out;
  }
  return messages;
}

function formatEnvBlock(live: LiveSnapshot): string | null {
  const lines: string[] = [];
  if (live.workspaceRoot) lines.push(`workspace_root: ${live.workspaceRoot}`);
  if (live.cwd) lines.push(`active_terminal_cwd: ${live.cwd}`);
  if (live.activeFile) lines.push(`active_file: ${live.activeFile}`);
  if (live.terminalPrivate) lines.push("active_terminal_mode: private");
  if (lines.length === 0) return null;
  return `<env>\n${lines.join("\n")}\n</env>`;
}

export const CONTEXT_BLOCK_RE =
  /^<terminal-context[^>]*>[\s\S]*?<\/terminal-context>\n*/;

export function stripContextBlock(text: string): string {
  return text.replace(CONTEXT_BLOCK_RE, "");
}
