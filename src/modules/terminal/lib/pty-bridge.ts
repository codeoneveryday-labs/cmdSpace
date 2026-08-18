import { invoke, Channel } from "@tauri-apps/api/core";
import { currentWorkspaceEnv } from "@/modules/workspace";
import { usePreferencesStore } from "@/modules/settings/preferences";

export type PtyHandlers = {
  onData: (bytes: Uint8Array) => void;
  onExit?: (code: number) => void;
};

export type PtySession = {
  id: number;
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  setMetadata: (metadata: {
    title?: string;
    cwd?: string;
    agent?: string;
  }) => Promise<void>;
  close: () => Promise<void>;
};

export async function openPty(
  cols: number,
  rows: number,
  handlers: PtyHandlers,
  cwd?: string,
  initialCommand?: string,
): Promise<PtySession> {
  // Raw bytes — no base64/JSON round-trip; messages arrive as ArrayBuffer.
  const onData = new Channel<ArrayBuffer>();
  const onExit = new Channel<number>();

  let released = false;
  const noop = () => {};
  const releaseHandlers = () => {
    if (released) return;
    released = true;
    onData.onmessage = noop;
    onExit.onmessage = noop;
  };

  onData.onmessage = (buf) => handlers.onData(new Uint8Array(buf));
  onExit.onmessage = (code) => {
    handlers.onExit?.(code);
    releaseHandlers();
  };

  const id = await invoke<number>("pty_open", {
    cols,
    rows,
    cwd: cwd ?? null,
    initialCommand: initialCommand ?? null,
    shell: usePreferencesStore.getState().terminalShell,
    workspace: currentWorkspaceEnv(),
    onData,
    onExit,
  });
  void invoke("pty_register_metadata", {
    id,
    cwd: cwd ?? null,
  });

  let closed = false;

  return {
    id,
    write: (data) => invoke("pty_write", { id, data }),
    resize: (c, r) => invoke("pty_resize", { id, cols: c, rows: r }),
    setMetadata: (metadata) =>
      invoke("pty_register_metadata", {
        id,
        title: metadata.title ?? null,
        cwd: metadata.cwd ?? null,
        agent: metadata.agent ?? null,
      }),
    close: async () => {
      if (closed) return;
      closed = true;
      try {
        await invoke("pty_close", { id });
      } finally {
        releaseHandlers();
      }
    },
  };
}
