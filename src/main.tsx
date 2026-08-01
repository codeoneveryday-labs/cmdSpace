import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/cyrillic-400.css";
import "@fontsource/jetbrains-mono/cyrillic-700.css";
import "@xterm/xterm/css/xterm.css";
import "./styles/globals.css";

import {
  hasTauriRuntime,
  renderBrowserRuntimeNotice,
} from "./lib/tauriRuntime";

if (!hasTauriRuntime()) {
  renderBrowserRuntimeNotice("root");
} else {
  const isDesktopBlurOverlay = new URLSearchParams(window.location.search).has(
    "desktop-blur-overlay",
  );
  if (isDesktopBlurOverlay) {
    const { listen } = await import("@tauri-apps/api/event");
    document.documentElement.dataset.desktopBlurOverlay = "true";
    document.documentElement.dataset.desktopBlurState = "on";
    const surface = document.createElement("div");
    surface.className = "desktop-blur-overlay-surface";
    document.getElementById("root")?.replaceChildren(surface);
    await listen("cmdspace:desktop-blur-transition", (event) => {
      document.documentElement.dataset.desktopBlurState =
        event.payload === "on" ? "on" : "off";
    });
  } else {
    const [{ getCurrentWindow }, ReactDOM, { default: App }, { initLaunchDir }, platform] =
      await Promise.all([
        import("@tauri-apps/api/window"),
        import("react-dom/client"),
        import("./app/App"),
        import("./lib/launchDir"),
        import("./lib/platform"),
      ]);
    if (platform.USE_CUSTOM_WINDOW_CONTROLS) {
      document.documentElement.dataset.chrome = "borderless";
    }

    // Seed before first paint so default tab mounts at target cwd (no flicker).
    await initLaunchDir();

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <App />,
    );

    // Window starts hidden (per tauri.conf.json) so users never see a transparent
    // shadow-only frame before React paints. Use setTimeout because rAF is
    // throttled while the window is hidden and would never fire.
    const showWindow = () => {
      getCurrentWindow()
        .show()
        .catch((e) => console.error("window.show failed:", e));
    };
    setTimeout(showWindow, 50);
    // Safety net: if the first show somehow fails to take effect, force again.
    setTimeout(showWindow, 500);
  }
}
