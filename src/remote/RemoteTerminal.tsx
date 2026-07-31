import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

import type { RemoteTerminalClient } from "./remoteClient";

type RemoteTerminalProps = {
  client: RemoteTerminalClient;
  sessionId: number;
};

export function RemoteTerminal({ client, sessionId }: RemoteTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      disableStdin: true,
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 1.08,
      scrollback: 3_000,
      theme: {
        background: "#050505",
        foreground: "#e8e8e8",
        cursor: "#ff8a00",
        cursorAccent: "#050505",
        selectionBackground: "#ff8a0033",
        black: "#191919",
        red: "#ff5f57",
        green: "#65d46e",
        yellow: "#ffbd2e",
        blue: "#57a8ff",
        magenta: "#d987ff",
        cyan: "#4dd9e8",
        white: "#e8e8e8",
        brightBlack: "#767676",
        brightRed: "#ff7b75",
        brightGreen: "#8be28f",
        brightYellow: "#ffd06a",
        brightBlue: "#82bdff",
        brightMagenta: "#e3a8ff",
        brightCyan: "#7ce6ef",
        brightWhite: "#ffffff",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    let disposed = false;
    let onDataUnsubscribe: { dispose(): void } | null = null;
    let unsubscribe: (() => void) | null = null;
    let observer: ResizeObserver | null = null;
    let resizeFrame = 0;
    let lastSize = { cols: 0, rows: 0 };
    const fitAndResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!container.isConnected || container.clientWidth < 2 || container.clientHeight < 2) return;
        try {
          fit.fit();
        } catch {
          return;
        }
        if (terminal.cols === lastSize.cols && terminal.rows === lastSize.rows) return;
        lastSize = { cols: terminal.cols, rows: terminal.rows };
        client.resize(sessionId, terminal.cols, terminal.rows);
      });
    };
    const handleViewportResize = () => fitAndResize();
    let touchY: number | null = null;
    let velocity = 0;
    let momentumFrame = 0;
    const stopMomentum = () => cancelAnimationFrame(momentumFrame);
    const beginTouch = (event: TouchEvent) => {
      stopMomentum();
      touchY = event.touches[0]?.clientY ?? null;
      velocity = 0;
    };
    const moveTouch = (event: TouchEvent) => {
      const nextY = event.touches[0]?.clientY;
      if (touchY === null || nextY === undefined) return;
      const delta = touchY - nextY;
      touchY = nextY;
      velocity = delta;
      if (Math.abs(delta) > 1) {
        terminal.scrollLines(Math.round(delta / Math.max(terminal.options.fontSize ?? 13, 10)));
        event.preventDefault();
      }
    };
    const endTouch = () => {
      touchY = null;
      const coast = () => {
        velocity *= 0.88;
        if (Math.abs(velocity) < 0.7) return;
        terminal.scrollLines(Math.round(velocity / Math.max(terminal.options.fontSize ?? 13, 10)));
        momentumFrame = requestAnimationFrame(coast);
      };
      momentumFrame = requestAnimationFrame(coast);
    };

    const initialize = async () => {
      try {
        await document.fonts?.load('13px "JetBrains Mono"');
      } catch {
        // The browser will use the monospace fallback when the webfont is unavailable.
      }
      if (disposed || !container.isConnected) return;

      terminal.open(container);
      onDataUnsubscribe = terminal.onData((data) => client.sendInput(sessionId, data));

      const useWebgl = window.matchMedia("(pointer: fine)").matches;
      if (useWebgl) {
        try {
          const webgl = new WebglAddon();
          webgl.onContextLoss(() => webgl.dispose());
          terminal.loadAddon(webgl);
        } catch {
          // The built-in renderer remains active when WebGL is unavailable.
        }
      }

      // Match clsh: output is pushed straight into xterm. A requestAnimationFrame
      // queue can remain suspended on mobile Chrome while keyboard interactions are
      // active, making a live PTY look like it has stopped accepting input.
      unsubscribe = client.subscribeTerminal(sessionId, (data) => terminal.write(data));
      observer = new ResizeObserver(fitAndResize);
      observer.observe(container);
      queueMicrotask(fitAndResize);
      window.visualViewport?.addEventListener("resize", handleViewportResize);
      container.addEventListener("touchstart", beginTouch, { passive: true });
      container.addEventListener("touchmove", moveTouch, { passive: false });
      container.addEventListener("touchend", endTouch, { passive: true });
    };
    void initialize();

    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      stopMomentum();
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      container.removeEventListener("touchstart", beginTouch);
      container.removeEventListener("touchmove", moveTouch);
      container.removeEventListener("touchend", endTouch);
      onDataUnsubscribe?.dispose();
      unsubscribe?.();
      terminal.dispose();
    };
  }, [client, sessionId]);

  return <div ref={containerRef} className="remote-terminal" data-remote-terminal />;
}
