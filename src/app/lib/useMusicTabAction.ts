import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

export function useMusicTabAction({
  newTab,
  inheritedCwdForNewTab,
}: {
  newTab: (cwd?: string, command?: string, title?: string) => number;
  inheritedCwdForNewTab: () => string | undefined;
}) {
  return useCallback(async () => {
    try {
      await invoke("install_music_cli_script");
    } catch (error) {
      console.error("Failed to install Music CLI script:", error);
    }
    newTab(
      inheritedCwdForNewTab(),
      'source "$HOME/.cmdspace/music-cli.zsh"',
      "Music CLI",
    );
  }, [inheritedCwdForNewTab, newTab]);
}
