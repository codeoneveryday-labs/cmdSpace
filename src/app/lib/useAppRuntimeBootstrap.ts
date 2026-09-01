import { homeDir } from "@tauri-apps/api/path";
import { useEffect } from "react";
import { getAllKeys, type ProviderKeys } from "@/modules/ai/lib/keyring";
import { onKeysChanged } from "@/modules/settings/store";
import { native } from "@/modules/ai/lib/native";
import { remoteAccessStart, remoteAccessStatus } from "@/modules/settings/remoteAccess";

type AppRuntimeBootstrapProps = {
  onHomeChange: (home: string | null) => void;
  onLaunchCwdChange: (cwd: string | null) => void;
  onLaunchCwdResolved: (resolved: boolean) => void;
  onApiKeysChange: (keys: ProviderKeys) => void;
  initPrefs: () => void | Promise<void>;
  prefsHydrated: boolean;
  remoteAccessEnabled: boolean;
};

export function useAppRuntimeBootstrap({
  onHomeChange,
  onLaunchCwdChange,
  onLaunchCwdResolved,
  onApiKeysChange,
  initPrefs,
  prefsHydrated,
  remoteAccessEnabled,
}: AppRuntimeBootstrapProps): void {
  useEffect(() => {
    homeDir()
      .then(async (path) => {
        const normalized = path.replace(/\\/g, "/");
        onHomeChange(normalized);
        try {
          await native.workspaceAuthorize(normalized);
        } catch {
          // Bootstrap already authorizes home from Rust; ignore.
        }
      })
      .catch(() => onHomeChange(null));
  }, [onHomeChange]);

  useEffect(() => {
    native
      .workspaceCurrentDir()
      .then(onLaunchCwdChange)
      .catch(() => onLaunchCwdChange(null))
      .finally(() => onLaunchCwdResolved(true));
  }, [onLaunchCwdChange, onLaunchCwdResolved]);

  useEffect(() => {
    let alive = true;
    const reload = () => {
      void getAllKeys().then((keys) => {
        if (alive) onApiKeysChange(keys);
      });
    };
    reload();
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    const unlistenP = onKeysChanged(reload);
    return () => {
      alive = false;
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
      void unlistenP.then((dispose) => dispose());
    };
  }, [onApiKeysChange]);

  useEffect(() => {
    void initPrefs();
  }, [initPrefs]);

  useEffect(() => {
    if (!prefsHydrated || !remoteAccessEnabled) return;
    let alive = true;
    const startRemoteAccess = () => {
      void remoteAccessStart().catch((error) => {
        console.error("remote access auto-start failed", error);
      });
    };
    void remoteAccessStatus()
      .then((status) => {
        if (alive && !status.enabled) startRemoteAccess();
      })
      .catch(() => {
        if (alive) startRemoteAccess();
      });
    return () => {
      alive = false;
    };
  }, [prefsHydrated, remoteAccessEnabled]);
}
