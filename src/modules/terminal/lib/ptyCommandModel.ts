export type PtyWorkspaceEnv =
  | { kind: "local" }
  | { kind: "wsl"; distro: string };

export type PtyOpenPayload<OnData = unknown, OnExit = unknown> = {
  cols: number;
  rows: number;
  cwd: string | null;
  initialCommand: string | null;
  shell: string | null;
  workspace: PtyWorkspaceEnv;
  onData: OnData;
  onExit: OnExit;
};

export type PtyMetadata = {
  title?: string;
  cwd?: string;
  agent?: string;
};

export function buildPtyOpenPayload<OnData, OnExit>({
  cols,
  rows,
  cwd,
  initialCommand,
  shell,
  workspace,
  onData,
  onExit,
}: {
  cols: number;
  rows: number;
  cwd?: string;
  initialCommand?: string;
  shell?: string | null;
  workspace: PtyWorkspaceEnv;
  onData: OnData;
  onExit: OnExit;
}): PtyOpenPayload<OnData, OnExit> {
  return {
    cols,
    rows,
    cwd: cwd ?? null,
    initialCommand: initialCommand ?? null,
    shell: shell ?? null,
    workspace,
    onData,
    onExit,
  };
}

export function buildPtyWritePayload(id: number, data: string) {
  return { id, data };
}

export function buildPtyResizePayload(id: number, cols: number, rows: number) {
  return { id, cols, rows };
}

export function buildPtyMetadataPayload(id: number, metadata: PtyMetadata) {
  return {
    id,
    title: metadata.title ?? null,
    cwd: metadata.cwd ?? null,
    agent: metadata.agent ?? null,
  };
}

export function buildPtyClosePayload(id: number) {
  return { id };
}
