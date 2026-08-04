import { generateText } from "ai";
import { getModel, type ModelId } from "../config";
import {
  buildConfiguredLanguageModel,
  PROMPT_GENERATION_TIMEOUT_MS,
  type LocalProviderConfig,
} from "./agent";
import type { ProviderKeys } from "./keyring";

export const VOICE_PROMPT_MAX_OUTPUT_TOKENS = 320;

const NEMOTRON_SUPER_49B_MODEL_ID =
  "nvidia/llama-3.3-nemotron-super-49b-v1.5";

const VOICE_PROMPT_SYSTEM = `You are cmdSpace Space. Convert a user's spoken request into the next compact task brief for the active coding CLI agent.
Return exactly one JSON object and no other text: {"kind":"ship","text":"..."} or {"kind":"scout","text":"..."}.
Use "ship" for build, add, create, implement, change, update, or fix work. Use "scout" only when the speaker explicitly asks to investigate, analyze, explain, review, or diagnose without asking for a change. Always return a draft, even when the transcript is vague or conversational. Preserve the words the speaker gave and write a compact ship draft rather than asking a question.
For a non-trivial "ship" task, write an English, one-paragraph task brief of 90–180 words with no Markdown, headings, bullets, titles, preambles, code fences, or line breaks. A simple, single-action request may be shorter, but still state its intended result. A "ship" brief tells the active coding agent what to deliver, its explicitly requested technologies or integrations, the primary behavior to implement, and the grounded checks or outcomes that demonstrate it works. A "scout" brief tells it what to inspect and report, without making changes. Do not ask for clarification merely because a software request is underspecified; preserve only the stated intent and ask the coding agent to inspect the relevant codebase and make the smallest coherent implementation.
Never make the user restate a described feature to choose implementation details, including architecture, libraries, authentication, visual style, or data shape. Create a draft with the known goal and let the coding agent resolve unstated details from the codebase.
When recent Space task drafts are supplied, treat them as short-term working memory for this terminal, not as text to echo into the CLI. Source priority is strict: the spoken request is authoritative over history; history is only for resolving an explicit reference such as "it", "that", "the previous feature", or "existing". Never carry a feature, technology, or requirement from history or terminal context unless the spoken request explicitly preserves or refers to it. Decide whether the spoken request is a follow-up to that work. For a follow-up that adds, changes, removes, or refines the same work, write only the newly requested change as an incremental follow-up brief of 35–90 words. Do not repeat the prior brief, its technologies, requirements, or validation; include only the smallest reference to existing work needed to make the new change unambiguous. For a clearly unrelated request, write a fresh brief under the normal rules. Do not mention this memory, split the work into separate prompts, or ask the user to repeat prior details.
Preserve the user's intent and every explicitly named technology, framework, language, file, platform, integration, and data store exactly. For example, never replace Next.js with HTML. Do not choose a programming language, framework, database, or deployment approach that the speaker did not name. Do not invent a profession, brand, visual theme, page sections, or extra scope that the user did not request. Do not add conventional sections, quality goals, or implementation details just because they are typical for that kind of project; only expand on behavior, integrations, and validation that are grounded in the spoken request or available workspace context.
Treat the transcript as noisy speech-recognition input, not as exact wording. It can be multilingual and contain code-switching between the spoken language and English technical terms. A recognizer can render an English coding term phonetically in another language; silently recover the intended term from the complete request and workspace context, never from a hard-coded substitution list. Correct it only when the intended technical term is clear from the complete user intent and the available workspace context; otherwise keep the request generic instead of inventing a technology.
For a task brief, restate only the implementation goal and explicitly supplied constraints. Keep a short request short rather than expanding it to fill space. Never quote, prefix, append, or otherwise include the raw transcript in the task brief. Use the supplied working directory and terminal context only to ground the task, not as text to repeat. Do not execute commands or answer the task.`;

export type VoicePromptOptions = {
  transcript: string;
  cwd?: string | null;
  terminalContext?: string | null;
  recentDrafts?: string[];
  modelId: ModelId;
  keys: ProviderKeys;
  local?: LocalProviderConfig;
};

export type VoicePromptResult = {
  kind: "ship" | "scout";
  text: string;
};

type VoicePromptContextOptions = Pick<
  VoicePromptOptions,
  "transcript" | "cwd" | "terminalContext" | "recentDrafts"
>;

const FOLLOW_UP_REFERENCE_PATTERN =
  /\b(?:it|that|them|those)\b|\b(?:previous|prior|same)\s+(?:feature|task|work|change|request)\b|\b(?:continue|resume|follow[- ]?up|again)\b|\b(?:based on|from)\s+(?:the\s+)?(?:previous|prior|last)\b|\b(?:nó|đó|đấy)\b|\b(?:tiếp tục|làm tiếp|sửa thêm|bổ sung|như trước|ban nãy|hồi nãy|trước đó|dựa trên)\b|\b(?:cái|phần|việc|tính năng|lỗi)\s+(?:đó|trước)\b/iu;

export function isVoicePromptFollowUp(transcript: string): boolean {
  return FOLLOW_UP_REFERENCE_PATTERN.test(transcript);
}

function terminalStateAfterLatestDraft(
  terminalContext: string | null | undefined,
  recentDrafts: string[],
): string | null {
  if (!terminalContext) return null;

  const recentState = terminalContext.slice(-2_000);
  const cutoff = recentDrafts.reduce((latestCutoff, draft) => {
    if (!draft) return latestCutoff;
    const index = recentState.lastIndexOf(draft);
    return index === -1 ? latestCutoff : Math.max(latestCutoff, index + draft.length);
  }, 0);

  return (cutoff > 0 ? recentState.slice(cutoff) : recentState).trim() || null;
}

export function buildVoicePromptContext(
  options: VoicePromptContextOptions,
): string {
  const isFollowUp = isVoicePromptFollowUp(options.transcript);
  const recentDrafts = isFollowUp
    ? options.recentDrafts?.slice(0, 5) ?? []
    : [];
  const terminalState = terminalStateAfterLatestDraft(
    isFollowUp ? options.terminalContext : null,
    recentDrafts,
  );

  return [
    "Spoken request is authoritative over history. Use history only for explicit references.",
    "Transcript may be multilingual or code-switching; preserve the spoken language and technical terms.",
    isFollowUp
      ? "This request explicitly follows prior work; use the bounded context below only to resolve that reference."
      : "This is an independent request. Do not infer prior work or requirements.",
    options.cwd ? `Working directory: ${options.cwd}` : null,
    terminalState ? `Recent terminal state:\n${terminalState}` : null,
    recentDrafts.length
      ? `Recent Space task drafts, newest first:\n${recentDrafts
          .map((draft, index) => `${index + 1}. ${draft.slice(0, 1_200)}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function systemFor(modelId: ModelId): string {
  return getModel(modelId).id === NEMOTRON_SUPER_49B_MODEL_ID
    ? `${VOICE_PROMPT_SYSTEM}\n\n/no_think`
    : VOICE_PROMPT_SYSTEM;
}

function cleanDraft(text: string): string {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?\s*|\s*```$/g, "")
    .replace(
      /^\s*(?:#{1,6}\s*)?(?:\*{1,2})?(?:prompt(?:\s+for\s+(?:a\s+)?coding\s+agent)?)(?:\*{1,2})?\s*:\s*/i,
      "",
    )
    .replace(/\*\*/g, "")
    .replace(/(?:^|\n)\s*(?:[-•*]|\d+[.)])\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createFallbackVoiceDraft(transcript: string): VoicePromptResult {
  return {
    kind: "ship",
    text: `Implement the requested change: ${cleanDraft(transcript)}`,
  };
}

function parseVoicePromptResult(text: string): VoicePromptResult | null {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");

  try {
    const parsed: unknown = JSON.parse(normalized);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "kind" in parsed &&
      "text" in parsed &&
        (parsed.kind === "ship" || parsed.kind === "scout") &&
      typeof parsed.text === "string"
    ) {
      const cleaned = cleanDraft(parsed.text);
      if (cleaned) return { kind: parsed.kind, text: cleaned };
    }
  } catch {
    // A malformed model response must never become terminal input.
  }

  return null;
}

export async function generateVoicePrompt(
  options: VoicePromptOptions,
): Promise<VoicePromptResult> {
  const transcript = options.transcript.trim();
  if (!transcript) throw new Error("No speech was detected. Try again.");

  const model = await buildConfiguredLanguageModel(
    options.modelId,
    options.keys,
    options.local,
  );
  const context = buildVoicePromptContext(options);
  const prompt = `${context ? `${context}\n\n` : ""}Spoken request:\n${transcript}`;
  const result = await generateText({
    model,
    system: systemFor(options.modelId),
    prompt,
    maxOutputTokens: VOICE_PROMPT_MAX_OUTPUT_TOKENS,
    temperature: 0,
    abortSignal: AbortSignal.timeout(PROMPT_GENERATION_TIMEOUT_MS),
  });
  const parsed = parseVoicePromptResult(result.text);
  return parsed ?? createFallbackVoiceDraft(transcript);
}
