import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { setAgentLaunchCommands } from "@/modules/settings/store";

export function useWorkspaceSetupCommandPersistence() {
  const storedAgentCommands = usePreferencesStore(
    (state) => state.agentLaunchCommands,
  );
  const [agentCommandDrafts, setAgentCommandDrafts] = useState<
    Record<string, string>
  >(() => ({}));
  const [customCommand, setCustomCommand] = useState("");
  const [customCommandLoaded, setCustomCommandLoaded] = useState(false);
  const customCommandEditedRef = useRef(false);

  const persistCustomCommand = useCallback((command: string) => {
    void invoke("db_save_workspace_setup_custom_command", { command }).catch(
      (error) => {
        console.error("Failed to save custom agent CLI command:", error);
      },
    );
  }, []);

  const persistAgentCommand = useCallback(
    (id: string, value: string) => {
      const trimmed = value.trim();
      setAgentCommandDrafts((current) => ({
        ...current,
        [id]: trimmed,
      }));
      const next = { ...storedAgentCommands, [id]: trimmed };
      void setAgentLaunchCommands(next).catch((error) => {
        console.error("Failed to save agent launch command:", error);
      });
    },
    [storedAgentCommands],
  );

  const handleCustomCommandChange = useCallback(
    (value: Parameters<typeof setCustomCommand>[0]) => {
      customCommandEditedRef.current = true;
      setCustomCommand(value);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    invoke<string>("db_load_workspace_setup_custom_command")
      .then((command) => {
        if (cancelled) return;
        if (!customCommandEditedRef.current) setCustomCommand(command);
        setCustomCommandLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load custom agent CLI command:", error);
        if (!cancelled) setCustomCommandLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customCommandLoaded || !customCommandEditedRef.current) return;
    const timeout = window.setTimeout(
      () => persistCustomCommand(customCommand),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [customCommand, customCommandLoaded, persistCustomCommand]);

  return {
    storedAgentCommands,
    agentCommandDrafts,
    setAgentCommandDrafts,
    customCommand,
    customCommandLoaded,
    handleCustomCommandChange,
    persistAgentCommand,
    persistCustomCommand,
  };
}
