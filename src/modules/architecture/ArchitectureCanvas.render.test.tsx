import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ArchitectureDiagram } from "@/modules/tabs";
import { ThemeProvider } from "@/modules/theme";

import {
  ArchitectureCanvas,
  findNearestTerminalInDirection,
} from "./ArchitectureCanvas";

vi.mock("./CanvasTerminalNode", () => ({
  CanvasTerminalNode: ({
    initialCommand,
    initialCwd,
    stackTabs,
    visible,
  }: {
    initialCommand?: string;
    initialCwd?: string;
    stackTabs?: Array<{ id: string; label: string }>;
    visible?: boolean;
  }) => (
    <div
      data-initial-command={initialCommand}
      data-initial-cwd={initialCwd}
      data-stack-tabs={stackTabs?.map((tab) => tab.id).join(",")}
      data-visible={String(visible)}
    />
  ),
}));

describe("ArchitectureCanvas", () => {
  it("renders a canvas-only workspace with a floating bottom dock", () => {
    const markup = renderToStaticMarkup(
      <ArchitectureCanvas active tabId={1} title="Architecture" />,
    );

    expect(markup).toContain("bottom-6 left-1/2");
    expect(markup).toContain("rounded-[2.5rem]");
    expect(markup).toContain('aria-label="Zoom out"');
    expect(markup).toContain('aria-label="Zoom in"');
    expect(markup).toContain('aria-label="Current zoom: 100%"');
    expect(markup).toContain("dark:bg-zinc-950");
    expect(markup).toContain("dark:stroke-zinc-800");
    expect(markup).not.toContain('aria-label="Collapse shape palette"');
    expect(markup).not.toContain('aria-label="Collapse inspector"');
    expect(markup).not.toContain('aria-label="Maximize architecture canvas"');
    expect(markup).not.toContain("Architecture canvas");
  });

  it("offers a bottom-right control for focusing the canvas", () => {
    const markup = renderToStaticMarkup(
      <ArchitectureCanvas
        active
        tabId={1}
        title="Architecture"
        onToggleCanvasFocus={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Focus canvas"');
    expect(markup).toContain("bottom-3 right-3");
    expect(markup).toContain('viewBox="0 0 24 24"');
  });

  it("keeps selection and a hand pan control in the simplified dock", () => {
    const markup = renderToStaticMarkup(
      <ArchitectureCanvas active tabId={1} title="Architecture" />,
    );

    expect(markup.match(/aria-label="Select \(V\)"/g)).toHaveLength(1);
    expect(markup.match(/aria-label="Pan \(H\)"/g)).toHaveLength(1);
    expect(markup).not.toContain('aria-label="Connect (C)"');
    expect(markup).not.toContain('aria-label="Arrow (A)"');
    expect(markup).not.toContain('aria-label="Eraser (E)"');
  });

  it("ignores stale node kinds from a saved diagram", () => {
    const staleSeed = {
      nodes: [
        {
          id: "legacy-node",
          kind: "legacy-service",
          label: "Legacy service",
          technology: "",
          x: 0,
          y: 0,
          width: 160,
          height: 88,
        },
      ],
      edges: [],
    } as unknown as ArchitectureDiagram;

    expect(() =>
      renderToStaticMarkup(
        <ArchitectureCanvas
          active
          tabId={1}
          title="Architecture"
          seed={staleSeed}
        />,
      ),
    ).not.toThrow();
  });

  it("keeps legacy image data loadable while recognizing terminal nodes", () => {
    const seed = {
      nodes: [
        {
          id: "legacy-image",
          kind: "image",
          label: "Old image",
          technology: "",
          imageUrl: "data:image/png;base64,old",
          x: 0,
          y: 0,
          width: 160,
          height: 88,
        },
        {
          id: "terminal-1",
          kind: "terminal",
          label: "Shell",
          technology: "zsh",
          cwd: "/tmp",
          x: 240,
          y: 120,
          width: 420,
          height: 280,
        },
      ],
      edges: [],
    } as unknown as ArchitectureDiagram;

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ArchitectureCanvas active tabId={1} title="Architecture" seed={seed} />
      </ThemeProvider>,
    );

    expect(markup).toContain("data:image/png;base64,old");
    expect(markup).toContain("tmp");
  });

  it("preserves a canvas terminal launch command while normalizing its seed", () => {
    const seed = {
      nodes: [
        {
          id: "terminal-with-agent",
          kind: "terminal",
          label: "Codex",
          technology: "zsh",
          cwd: "/tmp/project",
          initialCommand: "codex --dangerously-bypass-approvals-and-sandbox",
          x: 240,
          y: 120,
          width: 640,
          height: 400,
        },
      ],
      edges: [],
    } as ArchitectureDiagram;

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ArchitectureCanvas active tabId={1} title="Architecture" seed={seed} />
      </ThemeProvider>,
    );

    expect(markup).toContain(
      'data-initial-command="codex --dangerously-bypass-approvals-and-sandbox"',
    );
  });

  it("keeps every docked terminal mounted and exposes only the active tab", () => {
    const seed: ArchitectureDiagram = {
      nodes: [
        {
          ...terminalNode("terminal-1", "/tmp/one"),
          x: 100,
        },
        {
          ...terminalNode("terminal-2", "/tmp/two"),
          x: 740,
        },
      ],
      edges: [],
      terminalDockGroups: [
        {
          id: "group-1",
          x: 100,
          y: 120,
          width: 800,
          height: 500,
          root: {
            id: "stack-1",
            kind: "tabs",
            terminalIds: ["terminal-1", "terminal-2"],
            activeTerminalId: "terminal-2",
          },
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ArchitectureCanvas active tabId={1} title="Architecture" seed={seed} />
      </ThemeProvider>,
    );

    expect(markup.match(/data-stack-tabs="terminal-1,terminal-2"/g)).toHaveLength(
      2,
    );
    expect(markup.match(/data-visible="true"/g)).toHaveLength(1);
    expect(markup.match(/data-visible="false"/g)).toHaveLength(1);
  });

  it("keeps canvas terminals hidden while another task is active", () => {
    const seed: ArchitectureDiagram = {
      nodes: [terminalNode("terminal-1", "/tmp/project")],
      edges: [],
    };

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ArchitectureCanvas active={false} tabId={1} title="Architecture" seed={seed} />
      </ThemeProvider>,
    );

    expect(markup).toContain('data-visible="false"');
    expect(markup).not.toContain('data-visible="true"');
  });

  it("renders terminals in a transformed canvas-space layer without resizing xterm during zoom", () => {
    const seed: ArchitectureDiagram = {
      nodes: [
        {
          ...terminalNode("terminal-1", "/tmp/project"),
          x: 100,
          y: 120,
        },
      ],
      edges: [],
    };

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ArchitectureCanvas active tabId={1} title="Architecture" seed={seed} />
      </ThemeProvider>,
    );

    expect(markup).toContain('data-canvas-terminal-world="true"');
    expect(markup).toContain(
      "transform:translate3d(0px, 0px, 0) scale(1)",
    );
    expect(markup).toContain(
      "left:100px;top:120px;width:640px;height:400px",
    );
  });
});

describe("findNearestTerminalInDirection", () => {
  const t = (id: string, x: number, y: number) => ({
    id,
    kind: "terminal" as const,
    label: "Terminal",
    technology: "zsh",
    cwd: `/tmp/${id}`,
    x,
    y,
    width: 200,
    height: 100,
  });
  const current = t("current", 400, 300);

  it("picks the nearest terminal to the right", () => {
    const candidates = [t("far", 900, 300), t("near", 700, 320)];
    expect(findNearestTerminalInDirection(current, candidates, "right")?.id).toBe(
      "near",
    );
  });

  it("picks the nearest terminal above", () => {
    const candidates = [t("far", 100, 40), t("near", 420, 180)];
    expect(findNearestTerminalInDirection(current, candidates, "up")?.id).toBe(
      "near",
    );
  });

  it("returns null when nothing lies in that direction", () => {
    const candidates = [t("left", 100, 300)];
    expect(findNearestTerminalInDirection(current, candidates, "down")).toBeNull();
  });

  it("does not select the node itself as a candidate", () => {
    const candidates = [t("current-copy", 400, 300)];
    expect(
      findNearestTerminalInDirection(current, candidates, "left"),
    ).toBeNull();
  });
});

function terminalNode(id: string, cwd: string) {
  return {
    id,
    kind: "terminal" as const,
    label: "Terminal",
    technology: "zsh",
    cwd,
    x: 0,
    y: 120,
    width: 640,
    height: 400,
  };
}
