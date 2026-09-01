import { useEffect, useState, type FormEvent } from "react";

import { remoteApiPath } from "./lib/remoteUtils";
import {
  readRemoteBootstrapSecretFromUrl,
  scrubRemoteBootstrapUrl,
} from "./lib/remoteBootstrapUrl";

export function readRemoteBootstrapSecret(): string {
  if (typeof window === "undefined") return "";
  return readRemoteBootstrapSecretFromUrl(new URL(window.location.href));
}

type RemotePasswordScreenProps = {
  onAuthenticated: (token: string) => void;
};

export function RemotePasswordScreen({ onAuthenticated }: RemotePasswordScreenProps) {
  const [passwordConfigured, setPasswordConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapSecret] = useState(readRemoteBootstrapSecret);

  useEffect(() => {
    if (!bootstrapSecret || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    window.history.replaceState(null, "", scrubRemoteBootstrapUrl(url));
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
