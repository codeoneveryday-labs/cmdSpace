import { tool } from "ai";
import { z } from "zod";
import type { ArchitectureDiagram } from "@/modules/tabs";
import type { ToolContext } from "./context";
import {
  CLI_AGENT_BY_ID,
  CLI_AGENT_IDS,
  type CliAgent,
} from "@/modules/terminal/lib/cliAgents";

const absolutePath = z.string().refine(
  (value) => value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value),
  "folder must be an absolute path",
);

const agentCli = z.enum(CLI_AGENT_IDS);

const AGENT_CLI_COMMANDS = Object.fromEntries(
  CLI_AGENT_IDS.map((agent) => [agent, CLI_AGENT_BY_ID[agent].launch]),
) as Record<CliAgent, string>;

function initialCommandsForWorkspace(input: {
  terminal_count: number;
  initial_command?: string;
  agent_commands?: Array<z.infer<typeof agentCli>>;
}): string[] {
  if (input.agent_commands?.length) {
    if (input.agent_commands.length !== input.terminal_count) {
      throw new Error(
        `agent_commands must contain exactly ${input.terminal_count} entries (one CLI per terminal)`,
      );
    }
    return input.agent_commands.map((agent) => AGENT_CLI_COMMANDS[agent]);
  }
  const command = input.initial_command?.trim() ?? "";
  return command
    ? Array.from({ length: input.terminal_count }, () => command)
    : [];
}

const planStep = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("workspace"),
    name: z.string().min(1).max(80).optional(),
    folder: absolutePath,
    terminal_count: z.number().int().min(1).max(12),
    initial_command: z.string().trim().max(400).optional(),
    agent_commands: z.array(agentCli).max(12).optional(),
  }),
  z.object({ kind: z.literal("architecture") }),
  z.object({
    kind: z.literal("mindmap"),
    title: z.string().min(1).max(120),
    center: z.string().min(1).max(160),
    branches: z.array(z.object({
      label: z.string().min(1).max(120),
      children: z.array(z.string().min(1).max(120)).max(8).optional(),
    })).min(1).max(20),
  }),
  z.object({ kind: z.literal("browser"), url: z.string().url() }),
]);

type MindMapInput = {
  title: string;
  center: string;
  branches: Array<{ label: string; children?: string[] }>;
};

export function buildMindMapDiagram(input: MindMapInput): ArchitectureDiagram {
  const nodes: ArchitectureDiagram["nodes"] = [];
  const edges: ArchitectureDiagram["edges"] = [];
  const centerX = 72;
  const branchX = 430;
  const childX = 790;
  const branchWidth = 250;
  const childWidth = 330;
  const childHeight = 48;
  const childGap = 16;
  const branchGap = 32;
  const childStep = childHeight + childGap;
  const subtreeHeights = input.branches.map((branch) =>
    Math.max(84, (branch.children?.length ?? 0) * childStep),
  );
  const totalHeight =
    subtreeHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, input.branches.length - 1) * branchGap;
  let cursorY = Math.max(48, (720 - totalHeight) / 2);
  const centerY = cursorY + totalHeight / 2 - 42;

  const centerId = "mindmap-center";
  nodes.push({
    id: centerId,
    kind: "circle",
    label: input.center,
    technology: "Mind map",
    x: centerX,
    y: centerY,
    width: 220,
    height: 84,
  });

  input.branches.forEach((branch, branchIndex) => {
    const branchId = `mindmap-branch-${branchIndex + 1}`;
    const subtreeHeight = subtreeHeights[branchIndex];
    const branchY = cursorY + subtreeHeight / 2 - 32;
    nodes.push({
      id: branchId,
      kind: "rectangle",
      label: branch.label,
      technology: "Branch",
      x: branchX,
      y: branchY,
      width: branchWidth,
      height: 64,
    });
    edges.push({
      id: `mindmap-edge-center-${branchIndex + 1}`,
      from: centerId,
      to: branchId,
      label: "",
    });
    (branch.children ?? []).forEach((child, childIndex) => {
      const childId = `mindmap-child-${branchIndex + 1}-${childIndex + 1}`;
      const childrenHeight = (branch.children?.length ?? 0) * childStep - childGap;
      const childrenStartY =
        cursorY + Math.max(0, (subtreeHeight - childrenHeight) / 2) - childHeight / 2;
      nodes.push({
        id: childId,
        kind: "text",
        label: child,
        technology: "Detail",
        x: childX,
        y: childrenStartY + childIndex * childStep,
        width: childWidth,
        height: childHeight,
      });
      edges.push({
        id: `mindmap-edge-child-${branchIndex + 1}-${childIndex + 1}`,
        from: branchId,
        to: childId,
        label: "",
      });
    });
    cursorY += subtreeHeight + branchGap;
  });
  return { nodes, edges };
}

export function buildOrchestrationTools(ctx: ToolContext) {
  return {
    execute_plan: tool({
      description:
        `Execute a reviewed multi-step app plan as one atomic approval flow. Use this whenever the user's request requires two or more app side effects, such as creating a workspace then opening Architecture and a website. For coding agents, set agent_commands with one entry per pane. Supported agents are ${CLI_AGENT_IDS.join(", ")}. Put the exact ordered steps in the plan; after approval, execute them sequentially and stop on the first failure. Requires one user approval.`,
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        steps: z.array(planStep).min(2).max(12),
      }),
      needsApproval: true,
      execute: async ({ title, steps }) => {
        const results: Array<Record<string, unknown>> = [];
        for (const step of steps) {
          try {
            if (step.kind === "workspace") {
              results.push({
                kind: step.kind,
                ok: true,
                ...await ctx.createWorkspace({
                  name: step.name,
                  folder: step.folder,
                  terminalCount: step.terminal_count,
                initialCommands: initialCommandsForWorkspace(step),
                }),
              });
            } else if (step.kind === "architecture") {
              results.push({ kind: step.kind, ok: ctx.openArchitecture() });
            } else if (step.kind === "mindmap") {
              const result = await ctx.createMindMap({
                title: step.title,
                diagram: buildMindMapDiagram(step),
              });
              results.push({ kind: step.kind, ok: true, ...result });
            } else {
              results.push({
                kind: step.kind,
                url: step.url,
                ok: ctx.openBrowser(step.url),
              });
            }
            if (results[results.length - 1]?.ok !== true) break;
          } catch (error) {
            results.push({ kind: step.kind, ok: false, error: String(error) });
            break;
          }
        }
        return {
          title,
          ok: results.length === steps.length && results.every((r) => r.ok),
          completed_steps: results.length,
          results,
        };
      },
    }),
    create_mindmap: tool({
      description:
        "Create an editable mind map in the Architecture canvas. Use a concise center topic and branches with optional child topics. The app lays out nodes and connections automatically, then the user can drag, edit, connect, undo, and export Mermaid. Requires approval.",
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        center: z.string().min(1).max(160),
        branches: z.array(z.object({
          label: z.string().min(1).max(120),
          children: z.array(z.string().min(1).max(120)).max(8).optional(),
        })).min(1).max(20),
      }),
      needsApproval: true,
      execute: async (input) => {
        const result = await ctx.createMindMap({
          title: input.title,
          diagram: buildMindMapDiagram(input),
        });
        return { ok: true, ...result };
      },
    }),
    create_workspace: tool({
      description:
        `Create a cmdSpace workspace at an absolute folder path with the requested number of terminal panes. Each coding agent gets an isolated Git worktree and branch by default, so parallel terminals cannot overwrite each other's files. Pass task_labels with one task name per terminal when the user describes separate work (for example [feature-auth, feature-dashboard]). Set isolated_worktrees false only when terminals intentionally share the same checkout. Each initial command is launched in its corresponding pane. For requests like '4 terminals with 2 Claude and 2 Codex', pass agent_commands: [claude, claude, codex, codex]. Supported agents: ${CLI_AGENT_IDS.join(", ")}. Do not emulate this with mkdir or a shell loop. Requires user approval.`,
      inputSchema: z.object({
        name: z.string().min(1).max(80).optional(),
        folder: absolutePath,
        terminal_count: z.number().int().min(1).max(12),
        initial_command: z.string().trim().max(400).optional(),
        agent_commands: z
          .array(agentCli)
          .max(12)
          .optional(),
      }),
      needsApproval: true,
      execute: async (input) => {
        const result = await ctx.createWorkspace({
          name: input.name,
          folder: input.folder,
          terminalCount: input.terminal_count,
          initialCommands: initialCommandsForWorkspace(input),
        });
        return { ok: true, folder: input.folder, ...result };
      },
    }),
    open_architecture: tool({
      description:
        "Open cmdSpace's architecture/design surface for the user. Requires approval because it changes the visible app surface.",
      inputSchema: z.object({}),
      needsApproval: true,
      execute: async () => ({ ok: ctx.openArchitecture() }),
    }),
    open_browser: tool({
      description:
        "Navigate cmdSpace's browser sidebar to a web URL. Use this when the user asks to visit or inspect a website. Requires approval and keeps the exact URL visible.",
      inputSchema: z.object({ url: z.string().url() }),
      needsApproval: true,
      execute: async ({ url }) => ({ url, ok: ctx.openBrowser(url) }),
    }),
  } as const;
}
