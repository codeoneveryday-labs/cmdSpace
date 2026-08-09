import "@fontsource-variable/inter";
import "../styles/globals.css";

import {
  hasTauriRuntime,
  renderBrowserRuntimeNotice,
} from "@/lib/tauriRuntime";

if (!hasTauriRuntime()) {
  renderBrowserRuntimeNotice("tray-root");
} else {
  const [ReactDOM, { ThemeProvider }, { WorkspaceSwitcher }] =
    await Promise.all([
      import("react-dom/client"),
      import("@/modules/theme"),
      import("./WorkspaceSwitcher"),
    ]);

  ReactDOM.createRoot(
    document.getElementById("tray-root") as HTMLElement,
  ).render(
    <ThemeProvider>
      <WorkspaceSwitcher />
    </ThemeProvider>,
  );
}
