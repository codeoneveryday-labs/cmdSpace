type RebindVisibleLeaves = () => void;

let installed = false;

export function installTerminalWakeRebind(
  rebindVisibleLeaves: RebindVisibleLeaves,
): void {
  if (
    installed ||
    typeof document === "undefined" ||
    typeof window === "undefined"
  ) {
    return;
  }
  installed = true;

  const rebindWhenVisible = () => {
    if (document.visibilityState === "visible") rebindVisibleLeaves();
  };
  document.addEventListener("visibilitychange", rebindWhenVisible);
  window.addEventListener("focus", rebindVisibleLeaves);
}
