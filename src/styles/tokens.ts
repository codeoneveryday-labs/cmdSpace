export type TerminalTokens = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  ansiBlack: string;
  ansiRed: string;
  ansiGreen: string;
  ansiYellow: string;
  ansiBlue: string;
  ansiMagenta: string;
  ansiCyan: string;
  ansiWhite: string;
  ansiBrightBlack: string;
  ansiBrightRed: string;
  ansiBrightGreen: string;
  ansiBrightYellow: string;
  ansiBrightBlue: string;
  ansiBrightMagenta: string;
  ansiBrightCyan: string;
  ansiBrightWhite: string;
};

const VAR_BY_KEY: Record<keyof TerminalTokens, string> = {
  background: "--terminal-background",
  foreground: "--terminal-foreground",
  cursor: "--terminal-cursor",
  cursorAccent: "--terminal-cursor-accent",
  selection: "--terminal-selection",
  ansiBlack: "--terminal-ansi-black",
  ansiRed: "--terminal-ansi-red",
  ansiGreen: "--terminal-ansi-green",
  ansiYellow: "--terminal-ansi-yellow",
  ansiBlue: "--terminal-ansi-blue",
  ansiMagenta: "--terminal-ansi-magenta",
  ansiCyan: "--terminal-ansi-cyan",
  ansiWhite: "--terminal-ansi-white",
  ansiBrightBlack: "--terminal-ansi-bright-black",
  ansiBrightRed: "--terminal-ansi-bright-red",
  ansiBrightGreen: "--terminal-ansi-bright-green",
  ansiBrightYellow: "--terminal-ansi-bright-yellow",
  ansiBrightBlue: "--terminal-ansi-bright-blue",
  ansiBrightMagenta: "--terminal-ansi-bright-magenta",
  ansiBrightCyan: "--terminal-ansi-bright-cyan",
  ansiBrightWhite: "--terminal-ansi-bright-white",
};

const KEYS = Object.keys(VAR_BY_KEY) as (keyof TerminalTokens)[];

let probe: HTMLDivElement | null = null;

function getProbe(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (probe && probe.isConnected) return probe;
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;contain:strict;width:0;height:0;";
  document.body.appendChild(el);
  probe = el;
  return el;
}

function resolve(el: HTMLDivElement, varName: string): string {
  el.style.color = `var(${varName})`;
  return getComputedStyle(el).color;
}

export function readTerminalTokens(): TerminalTokens {
  const el = getProbe();
  if (!el) {
    return {
      background: "#09090b",
      foreground: "#fafafa",
      cursor: "#fafafa",
      cursorAccent: "#09090b",
      selection: "rgba(255, 255, 255, 0.2)",
      ansiBlack: "#18181b",
      ansiRed: "#ef4444",
      ansiGreen: "#22c55e",
      ansiYellow: "#eab308",
      ansiBlue: "#3b82f6",
      ansiMagenta: "#a855f7",
      ansiCyan: "#06b6d4",
      ansiWhite: "#e4e4e7",
      ansiBrightBlack: "#52525b",
      ansiBrightRed: "#f87171",
      ansiBrightGreen: "#4ade80",
      ansiBrightYellow: "#facc15",
      ansiBrightBlue: "#60a5fa",
      ansiBrightMagenta: "#c084fc",
      ansiBrightCyan: "#22d3ee",
      ansiBrightWhite: "#fafafa",
    };
  }
  const out = {} as TerminalTokens;
  for (const k of KEYS) {
    out[k] = resolve(el, VAR_BY_KEY[k]);
  }
  return out;
}
