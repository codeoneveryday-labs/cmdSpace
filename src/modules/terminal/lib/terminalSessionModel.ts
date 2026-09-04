import type { SearchAddon } from "@xterm/addon-search";
import { DormantRing } from "./dormantRing";
import type { PtySession } from "./pty-bridge";
import type { ShellIntegrationState } from "./osc-handlers";
import {
  detectCliAgent,
  isInteractiveCodingAgentCommand,
  type CliAgent,
} from "./cliAgents";

export type TerminalSessionCallbacks = {
  onSearchReady?: (addon: SearchAddon) => void;
  onExit?: (code: number) => void;
  onCwd?: (cwd: string) => void;
  onCommand?: (cmd: string) => void;
  onAgentActivity?: (responding: boolean) => void;
  onOutputActivity?: (active: boolean) => void;
};

export type TerminalSession = {
  startedAtMs: number;
  pty: PtySession | null;
  ptyOpening: boolean;
  initialCwd: string | undefined;
  initialCommand: string | undefined;
  launchCommand: string | undefined;
  lastCwd: string | null;
  pendingExit: number | null;
  shellExited: boolean;
  callbacks: TerminalSessionCallbacks;
  visibleNow: boolean;
  focusedNow: boolean;
  disposed: boolean;
  ready: Promise<void>;
  cols: number;
  rows: number;
  container: HTMLDivElement | null;
  snapshot: string | null;
  searchQuery: string | null;
  dormantRing: DormantRing;
  hasSlot: boolean;
  altScreenAtRelease: boolean;
  inputBuffer: string;
  agentLaunchBuffer: string;
  agentOutputTail: string;
  interactiveCodingAgent: boolean;
  cliAgent: CliAgent | null;
  agentResponseRequested: boolean;
  shellState: ShellIntegrationState | null;
  initialCommandFallbackTimer: number | null;
  agentActivityTimer: number | null;
  outputActivityTimer: number | null;
  lastLocalInputAt: number;
  respawning: boolean;
};

export function createTerminalSession(
  initialCwd?: string,
  initialCommand?: string,
): TerminalSession {
  return {
    startedAtMs: Date.now(),
    pty: null,
    ptyOpening: false,
    initialCwd,
    initialCommand,
    launchCommand: initialCommand,
    lastCwd: null,
    pendingExit: null,
    shellExited: false,
    callbacks: {},
    visibleNow: false,
    focusedNow: false,
    disposed: false,
    ready: Promise.resolve(),
    cols: 0,
    rows: 0,
    container: null,
    snapshot: null,
    searchQuery: null,
    dormantRing: new DormantRing(),
    hasSlot: false,
    altScreenAtRelease: false,
    inputBuffer: "",
    agentLaunchBuffer: "",
    agentOutputTail: "",
    interactiveCodingAgent: isInteractiveCodingAgentCommand(initialCommand),
    cliAgent: detectCliAgent(initialCommand),
    agentResponseRequested: false,
    shellState: null,
    initialCommandFallbackTimer: null,
    agentActivityTimer: null,
    outputActivityTimer: null,
    lastLocalInputAt: 0,
    respawning: false,
  };
}
