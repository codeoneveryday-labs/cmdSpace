import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@xterm/xterm/css/xterm.css";
import "./remote.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { RemoteApp } from "./RemoteApp";

ReactDOM.createRoot(document.getElementById("remote-root") as HTMLElement).render(
  <React.StrictMode>
    <RemoteApp />
  </React.StrictMode>,
);
