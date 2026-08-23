import {
  ArrowRight01Icon,
  File01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { RemoteTerminal } from "./RemoteTerminal";
import {
  RemoteTerminalClient,
  type RemoteProtocolSession,
} from "./remoteClient";

const REMOTE_TOKEN_STORAGE_KEY = "cmdspace.remote.token";
const REMOTE_CWD_STORAGE_KEY = "cmdspace.remote.cwd";

type RemoteFolder = {
  name: string;
  path: string;
};

type RemoteFile = {
  name: string;
  path: string;
  parent: string;
};

type RemoteFolderState = {
  current: string;
  parent?: string | null;
  folders: RemoteFolder[];
  files: RemoteFile[];
};

function remoteApiPath(path: string): string {
  return path;
}

function remoteAuthorizationHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function remoteFolderName(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function readRemoteBootstrapSecret(): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.slice(1));
  const pathMatch = url.pathname.match(/^\/setup\/([^/]+)\/?$/);
  let pathSecret = "";
  if (pathMatch?.[1]) {
    try {
      pathSecret = decodeURIComponent(pathMatch[1]);
    } catch {
      pathSecret = "";
    }
  }
  return (
    pathSecret ||
    url.searchParams.get("bootstrap") ||
    hashParams.get("bootstrap") ||
    ""
  );
}

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

function RemotePasswordScreen({
  onAuthenticated,
}: {
  onAuthenticated: (token: string) => void;
}) {
  const [passwordConfigured, setPasswordConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapSecret] = useState(readRemoteBootstrapSecret);

  useEffect(() => {
    if (!bootstrapSecret || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.searchParams.delete("bootstrap");
    url.hash = "";
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [bootstrapSecret]);

  useEffect(() => {
    let cancelled = false;
    void fetch(remoteApiPath("/api/remote/auth/status"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Authentication status is unavailable");
        return response.json() as Promise<{ passwordConfigured: boolean }>;
      })
      .then((status) => {
        if (!cancelled) setPasswordConfigured(status.passwordConfigured);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || busy || passwordConfigured === null) return;
    const settingUp = !passwordConfigured;
    if (settingUp && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (settingUp && !bootstrapSecret) {
      setError("Scan the QR shown in cmdSpace to create the first password");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        remoteApiPath(settingUp ? "/api/remote/auth/setup" : "/api/remote/auth/login"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(settingUp ? { secret: bootstrapSecret } : {}),
            password,
            device: navigator.userAgent.slice(0, 80),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { token?: string; error?: string }
        | null;
      if (!response.ok || !payload?.token) {
        throw new Error(payload?.error || "Password authentication failed");
      }
      if (settingUp) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      }
      onAuthenticated(payload.token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const settingUp = passwordConfigured === false;
  const missingSetupLink = settingUp && !bootstrapSecret;

  return (
    <main className="remote-auth-screen">
      <form onSubmit={submit} className="remote-auth-card">
        <div className="remote-auth-mark">
          <img src="/logo.png" alt="cmdSpace" className="remote-auth-logo" />
        </div>
        <h1>{settingUp ? "Secure your session" : "Welcome back"}</h1>
        <p>
          {settingUp
            ? "Create one password for cmdSpace Remote on every device."
            : "Enter your cmdSpace Remote password."}
        </p>

        {missingSetupLink ? (
          <div className="remote-auth-notice">
            Open Settings → General on your Mac and scan the public QR to set the first password.
          </div>
        ) : null}

        <label htmlFor="remote-password">Password</label>
        <input
          id="remote-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={settingUp ? "new-password" : "current-password"}
          minLength={8}
          placeholder="At least 8 characters"
          disabled={busy}
        />
        {settingUp ? (
          <>
            <label htmlFor="remote-confirm-password">Confirm password</label>
            <input
              id="remote-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              placeholder="Re-enter password"
              disabled={busy}
            />
          </>
        ) : null}
        {error ? <p role="alert" className="remote-auth-error">{error}</p> : null}
        <button
          type="submit"
          disabled={
            passwordConfigured === null ||
            password.length < 8 ||
            (settingUp && (password !== confirmPassword || !bootstrapSecret)) ||
            busy
          }
        >
          {busy ? "Securing..." : settingUp ? "Set password" : "Unlock terminal"}
        </button>
      </form>
    </main>
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
    if (!remoteCwd) return;
    const next = new RemoteTerminalClient({ token: authToken, onUnauthorized });
    const unsubscribe = next.subscribeMessages((message) => {
      if (message.type === "authenticated") {
        next.listSessions();
      } else if (message.type === "sessions") {
        setSessions(message.sessions);
        setSessionsLoaded(true);
      } else if (message.type === "exit") {
        next.listSessions();
      }
    });
    setClient(next);
    next.connect();
    const poll = window.setInterval(() => next.listSessions(), 3_000);
    return () => {
      window.clearInterval(poll);
      unsubscribe();
      next.dispose();
      setClient(null);
      setSessionsLoaded(false);
    };
  }, [authToken, onUnauthorized, remoteCwd]);

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
      const retry = window.setInterval(() => client.createSession(remoteCwd), 1_500);
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

  if (!remoteCwd) {
    return (
      <RemoteFolderPicker
        authToken={authToken}
        onUnauthorized={onUnauthorized}
        onSelect={(path) => {
          window.localStorage.setItem(REMOTE_CWD_STORAGE_KEY, path);
          setRemoteCwd(path);
        }}
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

function RemoteFolderPicker({
  authToken,
  onUnauthorized,
  onSelect,
}: {
  authToken: string;
  onUnauthorized: () => void;
  onSelect: (path: string) => void;
}) {
  const [folderState, setFolderState] = useState<RemoteFolderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const folderCacheRef = useRef(new Map<string, RemoteFolderState>());

  const load = useCallback((path?: string) => {
    requestRef.current?.abort();
    setSearchQuery("");
    if (path) {
      const cached = folderCacheRef.current.get(path);
      if (cached) {
        setFolderState(cached);
        setLoading(false);
        setError(null);
        return;
      }
      setFolderState((current) =>
        current ? { ...current, current: path, folders: [], files: [] } : current,
      );
    }
    const request = new AbortController();
    requestRef.current = request;
    setLoading(true);
    setError(null);
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    void fetch(remoteApiPath(`/api/remote/folders${query}`), {
      cache: "no-store",
      headers: remoteAuthorizationHeaders(authToken),
      signal: request.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          onUnauthorized();
          throw new Error("Remote access expired");
        }
        if (!response.ok) throw new Error((await response.text()) || "Folder load failed");
        return response.json() as Promise<RemoteFolderState>;
      })
      .then((state) => {
        folderCacheRef.current.set(state.current, state);
        if (requestRef.current === request) setFolderState(state);
      })
      .catch((reason) => {
        if (
          requestRef.current === request &&
          !(reason instanceof DOMException && reason.name === "AbortError")
        ) {
          setError(String(reason));
        }
      })
      .finally(() => {
        if (requestRef.current === request) setLoading(false);
      });
  }, [authToken, onUnauthorized]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredFolders = useMemo(
    () => folderState?.folders.filter((folder) => folder.name.toLowerCase().includes(normalizedSearch)) ?? [],
    [folderState, normalizedSearch],
  );
  const filteredFiles = useMemo(
    () => folderState?.files.filter((file) => file.name.toLowerCase().includes(normalizedSearch)) ?? [],
    [folderState, normalizedSearch],
  );

  return (
    <main className="remote-folder-picker">
      <header className="remote-folder-header">
        <div>
          <button type="button" disabled={!folderState?.parent || loading} onClick={() => load(folderState?.parent ?? undefined)}>←</button>
          <span>
            <strong>{folderState ? remoteFolderName(folderState.current) : "Browse this Mac"}</strong>
            <small>{folderState?.current ?? "Loading folders…"}</small>
          </span>
        </div>
        <label className="remote-folder-search">
          <span>⌕</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search this folder"
            aria-label="Search folders and files"
          />
        </label>
      </header>

      <section className="remote-folder-picker-scroll">
        <div className="remote-folder-list">
          {loading ? <div className="remote-folder-message">Loading folders from desktop…</div> : null}
          {error ? (
            <div className="remote-folder-message remote-folder-error">
              <p>{error}</p>
              <button type="button" onClick={() => load(folderState?.current)}>Try again</button>
            </div>
          ) : null}
          {!error && folderState && !loading ? (
            <>
              {filteredFolders.map((folder) => (
                <button key={folder.path} type="button" onClick={() => load(folder.path)}>
                  <span className="remote-folder-icon"><HugeiconsIcon icon={Folder01Icon} size={20} /></span>
                  <strong>{folder.name}</strong>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={17} />
                </button>
              ))}
              {filteredFiles.map((file) => (
                <button key={file.path} type="button" onClick={() => onSelect(file.parent)}>
                  <span className="remote-folder-icon"><HugeiconsIcon icon={File01Icon} size={19} /></span>
                  <strong>{file.name}</strong>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={17} />
                </button>
              ))}
              {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                <div className="remote-folder-message">
                  {normalizedSearch ? "No matching folders or files." : "This folder is empty."}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <footer className="remote-folder-footer">
        <span>
          <small>Terminal location</small>
          <strong>{folderState?.current ?? "No folder selected"}</strong>
        </span>
        <button type="button" disabled={!folderState || loading} onClick={() => folderState && onSelect(folderState.current)}>
          Open current folder
        </button>
      </footer>
    </main>
  );
}

function RemoteSessionGrid({
  cwd,
  sessions,
  activeSessionId,
  onOpen,
  onCreate,
  onClose,
}: {
  cwd: string;
  sessions: RemoteProtocolSession[];
  activeSessionId: number | null;
  onOpen: (sessionId: number) => void;
  onCreate: () => void;
  onClose: (sessionId: number) => void;
}) {
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
  const lastPressedRef = useState(() => ({ current: 0 }))[0];

  const trigger = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    if (now - lastPressedRef.current < 150) return;
    lastPressedRef.current = now;
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
