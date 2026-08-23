import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AddProjectDialog } from "./AddProjectDialog";
import { ImportSessionSheet } from "./ImportSessionSheet";
import { ProvidersPage } from "./ProvidersPage";
import { RemoteFolderPicker } from "./RemoteFolderPicker";
import { RemoteHomeScreen } from "./RemoteHomeScreen";
import { RemotePasswordScreen } from "./RemotePasswordScreen";
import { RemoteSessionGrid } from "./RemoteSessionGrid";
import { RemoteTerminal } from "./RemoteTerminal";
import {
  RemoteTerminalClient,
  type RemoteProtocolSession,
} from "./remoteClient";
import { remoteFolderName } from "./lib/remoteUtils";

const REMOTE_TOKEN_STORAGE_KEY = "cmdspace.remote.token";
const REMOTE_CWD_STORAGE_KEY = "cmdspace.remote.cwd";
const REMOTE_CREATE_RETRY_MAX_ATTEMPTS = 10;
const REMOTE_CREATE_RETRY_INTERVAL_MS = 1_500;

export function RemoteApp() {
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(REMOTE_TOKEN_STORAGE_KEY),
  );

  const handleAuthenticated = useCallback((token: string) => {
    window.localStorage.removeItem("cmdspace.remote.cwd");
    window.localStorage.removeItem("cmdspace.remote.workspace");
    window.localStorage.setItem(REMOTE_TOKEN_STORAGE_KEY, token);
    setAuthToken(token);
  }, []);
  const handleUnauthorized = useCallback(() => {
    window.localStorage.removeItem(REMOTE_TOKEN_STORAGE_KEY);
    setAuthToken(null);
  }, []);

  if (!authToken) {
    return <RemotePasswordScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AuthenticatedRemoteApp
      authToken={authToken}
      onUnauthorized={handleUnauthorized}
    />
  );
}

function AuthenticatedRemoteApp({
  authToken,
  onUnauthorized,
}: {
  authToken: string;
  onUnauthorized: () => void;
}) {
  const [remoteCwd, setRemoteCwd] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(REMOTE_CWD_STORAGE_KEY),
  );
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showImportSession, setShowImportSession] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const [hostname, setHostname] = useState("");
  const [client, setClient] = useState<RemoteTerminalClient | null>(null);
  const [sessions, setSessions] = useState<RemoteProtocolSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [screen, setScreen] = useState<"sessions" | "terminal">("terminal");
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined"
      ? 0
      : Math.round(window.visualViewport?.height ?? window.innerHeight),
  );
  useEffect(() => {
    const viewport = window.visualViewport;
    const updateHeight = () =>
      setViewportHeight(Math.round(viewport?.height ?? window.innerHeight));

    updateHeight();
    viewport?.addEventListener("resize", updateHeight);
    viewport?.addEventListener("scroll", updateHeight);
    window.addEventListener("resize", updateHeight);
    return () => {
      viewport?.removeEventListener("resize", updateHeight);
      viewport?.removeEventListener("scroll", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  useEffect(() => {
    const next = new RemoteTerminalClient({ token: authToken, onUnauthorized });
    const unsubscribe = next.subscribeMessages((message) => {
      if (message.type === "authenticated") {
        if (remoteCwd) next.listSessions();
      } else if (message.type === "sessions") {
        setSessions(message.sessions);
        setSessionsLoaded(true);
      } else if (message.type === "exit") {
        next.listSessions();
      }
    });
    setClient(next);
    next.connect();
    return () => {
      unsubscribe();
      next.dispose();
      setClient(null);
      setSessionsLoaded(false);
    };
  }, [authToken, onUnauthorized, remoteCwd]);

  useEffect(() => {
    if (!remoteCwd) return;
    const poll = window.setInterval(() => client?.listSessions(), 3_000);
    return () => window.clearInterval(poll);
  }, [client, remoteCwd]);

  const cwdSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.cwd &&
          remoteCwd &&
          session.cwd.replace(/\/+$/, "") === remoteCwd.replace(/\/+$/, ""),
      ),
    [remoteCwd, sessions],
  );

  useEffect(() => {
    if (!client || !remoteCwd || !sessionsLoaded) return;
    if (cwdSessions.length === 0) {
      client.createSession(remoteCwd);
      let attempts = 0;
      const retry = window.setInterval(() => {
        attempts += 1;
        if (attempts >= REMOTE_CREATE_RETRY_MAX_ATTEMPTS) {
          window.clearInterval(retry);
          return;
        }
        client.createSession(remoteCwd);
      }, REMOTE_CREATE_RETRY_INTERVAL_MS);
      return () => window.clearInterval(retry);
    }
    setActiveSessionId((current) =>
      current && cwdSessions.some((session) => session.id === current)
        ? current
        : cwdSessions[0]?.id ?? null,
    );
  }, [client, cwdSessions, remoteCwd, sessionsLoaded]);

  const sendKey = useCallback((value: string) => {
    if (client && activeSessionId !== null) client.sendInput(activeSessionId, value);
  }, [activeSessionId, client]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/remote/state", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const state = (await response.json()) as { hostname?: string };
        if (!cancelled && state.hostname) setHostname(state.hostname);
      })
      .catch(() => {
        // The hostname is cosmetic; fall back to an empty title.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!remoteCwd) {
    if (!choosingFolder) {
      if (showProviders) {
        return (
          <ProvidersPage
            authToken={authToken}
            onBack={() => setShowProviders(false)}
          />
        );
      }
      return (
        <>
          <RemoteHomeScreen
            onAddProject={() => setShowAddProject(true)}
            onImportSession={() => setShowImportSession(true)}
            onSetupProviders={() => setShowProviders(true)}
          />
          {showAddProject ? (
            <AddProjectDialog
              hostname={hostname}
              onClose={() => setShowAddProject(false)}
              onSearchDirectory={() => {
                setShowAddProject(false);
                setChoosingFolder(true);
              }}
            />
          ) : null}
          {showImportSession && client ? (
            <ImportSessionSheet
              client={client}
              onClose={() => setShowImportSession(false)}
              onImported={() => setShowImportSession(false)}
            />
          ) : null}
        </>
      );
    }
    return (
      <RemoteFolderPicker
        authToken={authToken}
        onUnauthorized={onUnauthorized}
        onSelect={(path) => {
          window.localStorage.setItem(REMOTE_CWD_STORAGE_KEY, path);
          setRemoteCwd(path);
        }}
        onBack={() => setChoosingFolder(false)}
      />
    );
  }

  const activeSession = cwdSessions.find((session) => session.id === activeSessionId) ?? null;

  return (
    <main className="remote-shell" style={{ height: `${viewportHeight}px` }}>
      <header className="remote-topbar">
        <div className="remote-traffic-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <button className="remote-title" type="button" onClick={() => setScreen("terminal")}>
          <span>{activeSession?.title || remoteFolderName(remoteCwd)}</span>
          <small>{remoteFolderName(remoteCwd)}</small>
        </button>
        <nav className="remote-topbar-actions" aria-label="Remote terminal controls">
          <button type="button" aria-label="Sessions" onClick={() => setScreen("sessions")}>▦</button>
          <button
            type="button"
            aria-label="Change folder"
            onClick={() => {
              window.localStorage.removeItem(REMOTE_CWD_STORAGE_KEY);
              setRemoteCwd(null);
            }}
          >⚙</button>
        </nav>
      </header>

      {screen === "sessions" ? (
        <RemoteSessionGrid
          cwd={remoteCwd}
          sessions={cwdSessions}
          activeSessionId={activeSessionId}
          onOpen={(sessionId) => {
            setActiveSessionId(sessionId);
            setScreen("terminal");
          }}
          onCreate={() => client?.createSession(remoteCwd)}
          onClose={(sessionId) => client?.closeSession(sessionId)}
        />
      ) : (
        <section className="remote-terminal-screen">
          <div className="remote-terminal-stage">
            {client && activeSession ? (
              <RemoteTerminal
                client={client}
                sessionId={activeSession.id}
              />
            ) : (
              <div className="remote-terminal-loading">
                <div>Starting terminal…</div>
                <button
                  type="button"
                  className="remote-retry-btn"
                  onClick={() => client?.createSession(remoteCwd)}
                >
                  Retry Session
                </button>
              </div>
            )}
          </div>
          <div className="remote-context-strip" aria-label="Terminal shortcuts">
            <Shortcut label="esc" value={"\u001b"} onSend={sendKey} danger />
            <Shortcut label="tab" value={"\t"} onSend={sendKey} />
            <Shortcut label="←" value={"\u001b[D"} onSend={sendKey} />
            <Shortcut label="↓" value={"\u001b[B"} onSend={sendKey} />
            <Shortcut label="↑" value={"\u001b[A"} onSend={sendKey} />
            <Shortcut label="→" value={"\u001b[C"} onSend={sendKey} />
            <Shortcut label="↵" value={"\r"} onSend={sendKey} />
            <Shortcut label="F1" value={"\u001bOP"} onSend={sendKey} />
            <Shortcut label="F2" value={"\u001bOQ"} onSend={sendKey} />
            <Shortcut label="F3" value={"\u001bOR"} onSend={sendKey} />
            <Shortcut label="F5" value={"\u001b[15~"} onSend={sendKey} />
            <Shortcut label="ctrl-c" value={"\u0003"} onSend={sendKey} />
            <Shortcut label="commit" value="git commit " onSend={sendKey} />
            <Shortcut label="diff" value="git diff\r" onSend={sendKey} />
          </div>
        </section>
      )}
    </main>
  );
}

function Shortcut({
  label,
  value,
  onSend,
  danger = false,
}: {
  label: string;
  value: string;
  onSend: (value: string) => void;
  danger?: boolean;
}) {
  const lastSentRef = useRef<{ value: string; at: number } | null>(null);

  const trigger = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    const lastSent = lastSentRef.current;
    if (lastSent && lastSent.value === value && now - lastSent.at < 150) return;
    lastSentRef.current = { value, at: now };
    onSend(value);
  };

  return (
    <button
      type="button"
      data-danger={danger || undefined}
      onClick={trigger}
    >
      {label}
    </button>
  );
}
