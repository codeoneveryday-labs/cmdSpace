import { tool } from "ai";
import { z } from "zod";
import { checkShellCommand } from "../lib/security";
import type { ToolContext } from "./context";

export function buildTerminalTools(ctx: ToolContext) {
  return {
    get_terminal_agents: tool({
      description:
        "List the terminal panes in the active terminal tab so the Helper can plan work across the agents the user already opened. Returns pane indexes, current directories, last launched commands, and whether each pane is currently available. This is read-only and does not send anything.",
      inputSchema: z.object({}),
      execute: async () => {
        const panes = ctx.getActiveTerminalAgents();
        return {
          terminal_count: panes.length,
          panes,
          note:
            panes.length === 0
              ? "No active terminal tab with panes is available."
              : "Use paneIndex values exactly when dispatching work.",
        };
      },
    }),

    dispatch_to_terminals: tool({
      description:
        "Send a refined prompt directly to coding-agent terminal panes in the active terminal tab. For the default focused-pane dispatch, provide summary and prompt and omit assignments; the tool discovers the focused pane itself. For separate work or explicit broadcast, provide assignments. It only types the prompts into the selected terminals and does not create chats, call the agents' APIs, merge branches, or send follow-up messages.",
      inputSchema: z.object({
        summary: z.string().min(1).max(240),
        prompt: z.string().min(20).max(12_000).optional(),
        assignments: z
          .array(
            z.object({
              pane_index: z.number().int().min(0).max(11),
              task: z.string().min(1).max(100),
              prompt: z.string().min(20).max(12_000),
            }),
          )
          .min(1)
          .max(12),
      }).partial({ assignments: true }).refine(
        ({ prompt, assignments }) => Boolean(prompt) || Boolean(assignments?.length),
        { message: "Provide prompt for all panes or assignments for selected panes" },
      ),
      needsApproval: false,
      execute: async ({ summary, prompt, assignments }) => {
        const available = ctx
          .getActiveTerminalAgents()
          .filter((pane) => pane.available);
        const focused =
          available.find(
            (pane) =>
              pane.paneIndex === ctx.getActiveTerminalPaneIndex(),
          ) ?? available[0];
        const resolvedAssignments = assignments ?? (focused
          ? [
              {
                pane_index: focused.paneIndex,
                task: "Prompt-engineered request",
                prompt: prompt!,
              },
            ]
          : []);
        const invalid = resolvedAssignments.find(({ prompt: taskPrompt }) =>
          /[\x00\x1b\x07]/.test(taskPrompt),
        );
        if (invalid) {
          return {
            error: `Prompt for pane ${invalid.pane_index} contains unsupported control bytes`,
          };
        }
        const results = ctx.dispatchPromptsToTerminals(
          resolvedAssignments.map(({ pane_index, prompt: taskPrompt }) => ({
            paneIndex: pane_index,
            prompt: taskPrompt,
          })),
        );
        return { ok: results.every((result) => result.sent), summary, assignments: resolvedAssignments, results };
      },
    }),

    suggest_command: tool({
      description:
        "Propose a single shell command. Renders a card in chat with an 'Insert' button — the command is NOT written to any terminal automatically; only the user's click inserts it at the prompt without executing. Use this when the answer IS a command.",
      inputSchema: z.object({
        command: z
          .string()
          .describe("The shell command. Single line, no trailing newline."),
        explanation: z
          .string()
          .optional()
          .describe("Optional one-line note shown beside the command."),
      }),
      execute: async ({ command, explanation }) => {
        const safety = checkShellCommand(command);
        if (!safety.ok) return { error: safety.reason };
        // Reject control bytes — the user inserts via click, but the rendered
        // command must reflect exactly what will land at the prompt.
        if (/[\n\r\x00\x1b\x07]/.test(command)) {
          return { error: "command must be a single line without control bytes" };
        }
        return { command, explanation };
      },
    }),

    get_terminal_output: tool({
      description:
        "Return the tail of the active terminal's scrollback. Use this when the user references 'this error', 'the last command', or you need to interpret recent terminal output. Default is 80 lines; raise it only when you genuinely need more. Returns an empty string if there is no active terminal; refuses if the terminal is in Privacy mode.",
      inputSchema: z.object({
        lines: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe("Number of trailing lines to return. Default 80."),
      }),
      execute: async ({ lines }) => {
        if (ctx.isActiveTerminalPrivate()) {
          return {
            error:
              "active terminal is in Privacy mode; its buffer is withheld. Ask the user to switch to a regular tab if they want you to see it.",
          };
        }
        const buffer = ctx.getTerminalContext();
        if (!buffer) return { output: "", note: "no active terminal" };
        const n = lines ?? 80;
        const parts = buffer.split("\n");
        const sliced = parts.length <= n ? buffer : parts.slice(parts.length - n).join("\n");
        const MAX = 24_000;
        const capped =
          sliced.length > MAX ? `…[truncated]…\n${sliced.slice(sliced.length - MAX)}` : sliced;
        return { output: capped, lines_returned: Math.min(parts.length, n) };
      },
    }),

    open_preview: tool({
      description:
        "Open a preview tab (in-app iframe) at the given URL — restricted to localhost/loopback addresses for the local dev server. Use this after starting a dev server (e.g. `pnpm dev`, `npm run dev`) to surface the rendered page next to the terminal. To preview external sites, the user should paste the URL into the preview address bar themselves.",
      inputSchema: z.object({
        url: z
          .url()
          .describe(
            "Full URL to load (e.g. http://localhost:5173). Must include scheme. Only http/https on loopback hosts are accepted.",
          ),
      }),
      execute: async ({ url }) => {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return { error: "invalid URL", url };
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return { error: "only http/https URLs are allowed", url };
        }
        const host = parsed.hostname;
        const isLocal =
          host === "localhost" ||
          host === "127.0.0.1" ||
          host === "0.0.0.0" ||
          host === "[::1]" ||
          host === "::1" ||
          host.endsWith(".localhost");
        if (!isLocal) {
          return {
            error:
              "open_preview is restricted to localhost URLs. Ask the user to paste the external URL into the preview address bar instead.",
            url,
          };
        }
        const ok = ctx.openPreview(url);
        if (!ok) return { error: "preview surface unavailable", url };
        return { url, ok: true };
      },
    }),

  } as const;
}
