import {
  Cancel01Icon,
  FilterIcon,
  RefreshIcon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RemoteProtocolImportableSession } from "./protocol";
import type { RemoteTerminalClient } from "./remoteClient";

type ImportSessionSheetProps = {
  client: RemoteTerminalClient;
  onClose: () => void;
  onImported: () => void;
};

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function folderBasename(cwd: string): string {
  const normalized = cwd.replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? cwd;
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    claude: "Claude Code",
    codex: "Codex",
    gemini: "Gemini CLI",
    opencode: "OpenCode",
    copilot: "GitHub Copilot",
    cursor: "Cursor Agent",
    aider: "Aider",
    pi: "π",
    amp: "AMP",
    cline: "Cline",
    goose: "Goose",
    qwen: "Qwen",
    kimi: "Kimi",
    openhands: "OpenHands",
    kiro: "Kiro",
    grok: "Grok",
    herdr: "Herdr",
    cmd: "cmd",
  };
  return labels[provider] ?? provider;
}

export function ImportSessionSheet({
  client,
  onClose,
  onImported,
}: ImportSessionSheetProps) {
  const [sessions, setSessions] = useState<RemoteProtocolImportableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [importing, setImporting] = useState<string | null>(null);
  const listRequestedRef = useRef(false);

  const load = useCallback(() => {
    if (listRequestedRef.current) return;
    listRequestedRef.current = true;
    setLoading(true);
    setError(null);
    client.listImportableSessions(false);
  }, [client]);

  useEffect(() => {
    load();
    const unsubscribe = client.subscribeMessages((message) => {
      if (message.type === "importableSessions") {
        setSessions(message.sessions);
        setLoading(false);
        listRequestedRef.current = false;
      } else if (message.type === "error") {
        setError(message.message);
        setLoading(false);
        listRequestedRef.current = false;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [client, load]);

  const providers = useMemo(() => {
    const names = new Set(sessions.map((session) => session.provider));
    return ["All", ...Array.from(names).sort()];
  }, [sessions]);

  const filteredSessions = useMemo(
    () =>
      filter === "All"
        ? sessions
        : sessions.filter((session) => session.provider === filter),
    [sessions, filter],
  );

  const handleImport = async (session: RemoteProtocolImportableSession) => {
    setImporting(session.sessionId);
    setError(null);
    client.importSession(session.provider, session.sessionId);
    onImported();
    setImporting(null);
  };

  return (
    <div className="remote-sheet-backdrop" onClick={onClose}>
      <section
        className="remote-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Import session"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="remote-sheet-handle" />
        <header className="remote-sheet-header">
          <h2>Import session</h2>
          <div className="remote-sheet-actions">
            <button type="button" className="remote-sheet-icon-btn" aria-label="Refresh" onClick={load}>
              <HugeiconsIcon icon={RefreshIcon} size={17} />
            </button>
            <button type="button" className="remote-sheet-icon-btn" aria-label="Close" onClick={onClose}>
              <HugeiconsIcon icon={Cancel01Icon} size={17} />
            </button>
          </div>
        </header>

        <div className="remote-sheet-filter">
          <button
            type="button"
            className="remote-sheet-filter-btn"
            onClick={() => {
              const index = providers.indexOf(filter);
              setFilter(providers[(index + 1) % providers.length] ?? "All");
            }}
          >
            <HugeiconsIcon icon={FilterIcon} size={15} />
            <span>{filter === "All" ? "All" : providerLabel(filter)}</span>
            <span className="remote-sheet-filter-caret">▾</span>
          </button>
        </div>

        <div className="remote-sheet-list">
          {loading ? (
            <p className="remote-sheet-message">Loading sessions…</p>
          ) : error ? (
            <p className="remote-sheet-message remote-sheet-error">{error}</p>
          ) : filteredSessions.length === 0 ? (
            <p className="remote-sheet-message">
              {filter === "All"
                ? "No recent CLI sessions found on this Mac."
                : `No ${providerLabel(filter)} sessions found.`}
            </p>
          ) : (
            filteredSessions.map((session) => (
              <button
                key={`${session.provider}:${session.sessionId}`}
                type="button"
                className="remote-sheet-session"
                onClick={() => handleImport(session)}
                disabled={session.active || importing !== null}
              >
                <span className="remote-sheet-session-icon">
                  <HugeiconsIcon icon={TerminalIcon} size={18} />
                </span>
                <span className="remote-sheet-session-body">
                  <span className="remote-sheet-session-top">
                    <strong>{session.title || providerLabel(session.provider)}</strong>
                    <small>{timeAgo(session.lastActivityAt)}</small>
                  </span>
                  <span className="remote-sheet-session-preview">
                    {session.preview || `Resume ${providerLabel(session.provider)} session`}
                  </span>
                  <span className="remote-sheet-session-cwd">
                    {folderBasename(session.cwd)} · {providerLabel(session.provider)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
