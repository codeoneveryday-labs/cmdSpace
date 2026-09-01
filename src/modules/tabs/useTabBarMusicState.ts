import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Tab } from "./lib/tabTypes";

export function useTabBarMusicState(tabs: Tab[]) {
  const hasMusicTab = tabs.some(
    (tab) => tab.kind === "terminal" && tab.title === "Music CLI",
  );
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!hasMusicTab) {
      setIsPlaying(false);
      return;
    }

    let disposed = false;
    const refresh = () => {
      void invoke<boolean>("music_is_playing")
        .then((playing) => {
          if (!disposed) setIsPlaying(playing);
        })
        .catch(() => {
          if (!disposed) setIsPlaying(false);
        });
    };
    refresh();
    const intervalId = window.setInterval(refresh, 2_000);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [hasMusicTab]);

  return isPlaying;
}
