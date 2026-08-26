import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CanvasTerminalNode } from "./CanvasTerminalNode";

vi.mock("@/lib/fonts", () => ({
  ensureMonoFontsLoaded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/settings/preferences", () => ({
  usePreferencesStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      terminalFontFamily: "JetBrains Mono",
      terminalFontSize: 13,
      terminalLetterSpacing: 0,
      terminalScrollback: 5000,
      backgroundKind: "none",
      backgroundImageId: null,
      zoomLevel: 1,
      terminalCopyOnSelection: false,
    }),
}));

vi.mock("@/modules/theme", () => ({
  useTheme: () => ({
    resolvedMode: "dark",
    themeId: "default",
    customThemes: [],
  }),
}));

vi.mock("@/modules/terminal/AgentCliIcon", () => ({
  AgentCliIcon: ({ agent }: { agent: string }) => (
    <span data-agent-icon={agent} />
  ),
}));

vi.mock("@/modules/terminal/TerminalAgentSwitcher", () => ({
  TerminalAgentSwitcher: ({
    trigger,
  }: {
    trigger: React.ReactNode;
  }) => <span data-agent-switcher="true">{trigger}</span>,
}));

describe("CanvasTerminalNode", () => {
  it("keeps per-tab agent icons visible even when the tab is inactive", () => {
    const markup = renderToStaticMarkup(
      <CanvasTerminalNode
        terminalId="terminal-1"
        initialCwd="/tmp/codex"
        initialCommand="codex --yolo"
        stackTabs={[
          {
            id: "terminal-1",
            kind: "terminal",
            label: "Codex",
            agent: "codex",
          } as never,
          {
            id: "terminal-2",
            kind: "terminal",
            label: "Claude",
            agent: "claude",
          } as never,
          {
            id: "browser-1",
            kind: "browser",
            label: "Browser",
          } as never,
        ]}
        activeTabId="terminal-1"
        visible
        onActivate={() => undefined}
        onActivateTab={() => undefined}
        onTabPointerDown={() => undefined}
        onRequestCloseTab={() => undefined}
        onAddTab={() => undefined}
        onSplitRight={() => undefined}
        singleTerminalGroup={false}
        terminalGroupLocked={false}
        maximized={false}
        onToggleTerminalGroupLock={() => undefined}
        onToggleTerminalGroupMaximize={() => undefined}
        onRequestCloseTerminalGroup={() => undefined}
        onHeaderPointerDown={() => undefined}
        onCwdChange={() => undefined}
        cornerClassName=""
        resizePaused={false}
        panning={false}
        onCanvasPanStart={() => undefined}
        onCanvasPanMove={() => undefined}
        onCanvasPanEnd={() => undefined}
        onCanvasWheel={() => undefined}
      />,
    );

    expect(markup).toContain('data-agent-switcher="true"');
    expect(markup).toContain('data-agent-icon="codex"');
    expect(markup).toContain('data-agent-icon="claude"');
    expect(markup).toContain('data-canvas-surface-tab-kind="browser"');
  });
});
