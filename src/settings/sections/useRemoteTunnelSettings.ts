import {
  remoteAccessResetPassword,
  remoteAccessStart,
  remoteAccessStatus,
  remoteAccessStop,
} from "@/modules/settings/remoteAccess";
import type { RemoteTunnelState } from "@/modules/settings/remoteAccess";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { setRemoteAccessEnabled } from "@/modules/settings/store";
import { useEffect, useRef, useState } from "react";

function remoteSetupUrl(publicUrl: string, bootstrapSecret: string): string {
  if (!publicUrl || !bootstrapSecret) return publicUrl;
  const url = new URL(publicUrl);
  url.pathname = `/setup/${encodeURIComponent(bootstrapSecret)}`;
  return url.toString();
}

export function useRemoteTunnelSettings() {
  const remoteAccessEnabled = usePreferencesStore(
    (state) => state.remoteAccessEnabled,
  );
  const [enabledDraft, setEnabledDraft] = useState(remoteAccessEnabled);
  const [lanUrl, setLanUrl] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [tunnelState, setTunnelState] = useState<RemoteTunnelState>("stopped");
  const [tunnelError, setTunnelError] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState("");
  const [copiedLink, setCopiedLink] = useState<
    "public" | "lan" | "device" | null
  >(null);
  const copyTimeoutRef = useRef<number>(0);

  useEffect(
    () => () => window.clearTimeout(copyTimeoutRef.current),
    [],
  );

  useEffect(() => {
    if (busy) return;
    setEnabledDraft(remoteAccessEnabled);
  }, [remoteAccessEnabled, busy]);

  useEffect(() => {
    let alive = true;
    void remoteAccessStatus()
      .then(async (status) => {
        if (!alive) return;
        let nextStatus = status;
        if (
          !status.enabled &&
          usePreferencesStore.getState().remoteAccessEnabled
        ) {
          nextStatus = await remoteAccessStart();
          if (!alive) return;
        }
        setLanUrl(nextStatus.lanUrl);
        setPublicUrl(nextStatus.publicUrl ?? "");
        setTunnelState(nextStatus.tunnelState);
        setTunnelError(nextStatus.tunnelError ?? "");
        setBootstrapSecret(nextStatus.bootstrapSecret ?? "");
        setEnabledDraft(nextStatus.enabled);
        if (
          nextStatus.enabled !==
          usePreferencesStore.getState().remoteAccessEnabled
        ) {
          void setRemoteAccessEnabled(nextStatus.enabled);
        }
        setError(null);
      })
      .catch((cause) => {
        console.error("remote access status failed", cause);
        if (!alive) return;
        setError(String(cause));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!enabledDraft || busy) return;
    let alive = true;
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      void remoteAccessStatus()
        .then((status) => {
          if (!alive) return;
          setLanUrl(status.lanUrl);
          setPublicUrl(status.publicUrl ?? "");
          setTunnelState(status.tunnelState);
          setTunnelError(status.tunnelError ?? "");
          setBootstrapSecret(status.bootstrapSecret ?? "");
          setEnabledDraft(status.enabled);
          if (
            status.enabled !==
            usePreferencesStore.getState().remoteAccessEnabled
          ) {
            void setRemoteAccessEnabled(status.enabled);
          }
          setError(null);
        })
        .catch((cause) => {
          if (!alive) return;
          setError(String(cause));
        })
        .finally(() => {
          pending = false;
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [busy, enabledDraft]);

  const toggle = async (next: boolean) => {
    setEnabledDraft(next);
    setBusy(true);
    try {
      setError(null);
      await setRemoteAccessEnabled(next);
      const status = next
        ? await remoteAccessStart()
        : await remoteAccessStop();
      setLanUrl(status.lanUrl);
      setPublicUrl(status.publicUrl ?? "");
      setTunnelState(status.tunnelState);
      setTunnelError(status.tunnelError ?? "");
      setBootstrapSecret(status.bootstrapSecret ?? "");
      setEnabledDraft(status.enabled);
      await setRemoteAccessEnabled(status.enabled);
    } catch (cause) {
      console.error("remote access toggle failed", cause);
      setError(String(cause));
      setEnabledDraft(false);
      await setRemoteAccessEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!enabledDraft || busy) return;
    setResetDialogOpen(false);
    setBusy(true);
    setError(null);
    setResetNotice("");
    try {
      const status = await remoteAccessResetPassword();
      setLanUrl(status.lanUrl);
      setPublicUrl(status.publicUrl ?? "");
      setTunnelState(status.tunnelState);
      setTunnelError(status.tunnelError ?? "");
      setBootstrapSecret(status.bootstrapSecret ?? "");
      setEnabledDraft(status.enabled);
      setResetNotice("Password reset. Scan the new QR to set a password.");
    } catch (cause) {
      console.error("remote password reset failed", cause);
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (
    kind: "public" | "lan" | "device",
    value: string,
  ) => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
      window.clearTimeout(copyTimeoutRef.current);
      setCopiedLink(kind);
      copyTimeoutRef.current = window.setTimeout(
        () => setCopiedLink(null),
        1500,
      );
    } catch {
      // Clipboard access can be denied outside a secure context.
    }
  };

  return {
    enabled: enabledDraft,
    lanUrl,
    publicUrl,
    tunnelState,
    tunnelError,
    bootstrapSecret,
    busy,
    error,
    setError,
    resetDialogOpen,
    resetNotice,
    copiedLink,
    setupQrUrl: remoteSetupUrl(publicUrl, bootstrapSecret),
    copyLink,
    resetPassword,
    setResetDialogOpen,
    toggle,
  };
}
