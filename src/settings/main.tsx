import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/cyrillic-400.css";
import "@fontsource/jetbrains-mono/cyrillic-700.css";
import "../styles/globals.css";

import {
  hasTauriRuntime,
  renderBrowserRuntimeNotice,
} from "@/lib/tauriRuntime";

if (!hasTauriRuntime()) {
  renderBrowserRuntimeNotice("settings-root");
} else {
  const [{ getCurrentWindow }, ReactDOM, { ThemeProvider }, platform, { SettingsApp }] =
    await Promise.all([
      import("@tauri-apps/api/window"),
      import("react-dom/client"),
      import("@/modules/theme"),
      import("@/lib/platform"),
      import("./SettingsApp"),
    ]);

  if (platform.USE_CUSTOM_WINDOW_CONTROLS) {
    document.documentElement.dataset.chrome = "borderless";
  }

  ReactDOM.createRoot(
    document.getElementById("settings-root") as HTMLElement,
  ).render(
    <ThemeProvider>
      <SettingsApp />
    </ThemeProvider>,
  );

  const showWindow = () => {
    getCurrentWindow()
      .show()
      .catch((e) => console.error("settings show failed:", e));
  };
  setTimeout(showWindow, 50);
  setTimeout(showWindow, 500);
}
