import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(
  path.join(here, "ArchitectureCanvas.tsx"),
  "utf8",
);
const terminalInteractionSource = readFileSync(
  path.join(here, "lib/useCanvasTerminalInteractions.ts"),
  "utf8",
);

describe("ArchitectureCanvas terminal activation integration", () => {
  it("delegates active-terminal state and tab callbacks to the extracted module", () => {
    expect(source).toContain("./lib/useCanvasTerminalInteractions");
    expect(source).toContain("useCanvasTerminalInteractions");
    expect(source).toContain(
      "const terminalInteractions = useCanvasTerminalInteractions({",
    );
    expect(source).not.toContain(
      'const [activeTerminalId, setActiveTerminalId] = useState("")',
    );
    expect(source).not.toContain(
      "onActiveTerminalChange?.(tabId, activeTerminalId || null)",
    );

    expect(terminalInteractionSource).toContain(
      "export function useCanvasTerminalInteractions",
    );
    expect(terminalInteractionSource).toContain(
      "export function resolveTerminalDropResult",
    );
  });

  it("routes terminal activation, tab switching, and drag-end drop resolution through the extracted module", () => {
    expect(source).toContain("terminalInteractions.activateTerminal(node.id)");
    expect(source).toContain(
      "terminalInteractions.activateTerminalTab({",
    );
    expect(source).toContain("terminalInteractions.closeTerminalTab({");
    expect(source).toContain("resolveTerminalDropResult({");
  });
});
