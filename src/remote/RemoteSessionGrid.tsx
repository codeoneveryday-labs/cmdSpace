import type { RemoteProtocolSession } from "./remoteClient";
import { remoteFolderName } from "./lib/remoteUtils";

type RemoteSessionGridProps = {
  cwd: string;
  sessions: RemoteProtocolSession[];
  activeSessionId: number | null;
  onOpen: (sessionId: number) => void;
  onCreate: () => void;
  onClose: (sessionId: number) => void;
};

export function RemoteSessionGrid({
  cwd,
  sessions,
  activeSessionId,
  onOpen,
  onCreate,
  onClose,
}: RemoteSessionGridProps) {
  return (
    <section className="remote-session-screen">
      <div className="remote-session-heading">
        <div>
          <p>cmdSpace sessions</p>
          <h1>{remoteFolderName(cwd)}</h1>
        </div>
        <button type="button" onClick={onCreate}>+ New terminal</button>
      </div>
      <div className="remote-session-grid">
        {sessions.map((session) => (
          <article key={session.id} data-active={session.id === activeSessionId || undefined}>
            <button type="button" className="remote-session-card" onClick={() => onOpen(session.id)}>
              <span className="remote-session-prompt">~</span>
              <strong>{session.title || `Terminal ${session.id}`}</strong>
              <small>{session.agent || "zsh"} · session {session.id}</small>
            </button>
            <button type="button" className="remote-session-close" aria-label={`Close ${session.title}`} onClick={() => onClose(session.id)}>×</button>
          </article>
        ))}
      </div>
    </section>
  );
}
