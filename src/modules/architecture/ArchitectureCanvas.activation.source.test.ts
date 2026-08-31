import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(
  path.join(here, "ArchitectureCanvas.tsx"),
  "utf8",
);
const terminalInteractionModelSource = readFileSync(
  path.join(here, "lib/canvasTerminalInteractionModel.ts"),
  "utf8",
);
const terminalInteractionCommitSource = readFileSync(
  path.join(here, "lib/canvasTerminalInteractionCommit.ts"),
  "utf8",
);
const terminalTabStateSource = readFileSync(
  path.join(here, "lib/useCanvasTerminalTabState.ts"),
  "utf8",
);
const terminalLayerSource = readFileSync(
  path.join(here, "components/CanvasTerminalLayer.tsx"),
  "utf8",
);
const terminalLayerActionsSource = readFileSync(
  path.join(here, "lib/useCanvasTerminalLayerActions.ts"),
  "utf8",
);
const sourceWithTerminalLayer = [
  source,
  terminalLayerSource,
  terminalLayerActionsSource,
].join("\n");

describe("ArchitectureCanvas terminal activation integration", () => {
  it("delegates active-terminal state and tab callbacks to the extracted module", () => {
    expect(source).toContain("./lib/useCanvasTerminalTabState");
    expect(source).toContain("useCanvasTerminalTabState");
    expect(source).toContain(
      "const terminalInteractions = useCanvasTerminalTabState({",
    );
    expect(source).not.toContain(
      'const [activeTerminalId, setActiveTerminalId] = useState("")',
    );
    expect(source).not.toContain(
      "onActiveTerminalChange?.(tabId, activeTerminalId || null)",
    );

    expect(terminalTabStateSource).toContain(
      "export function useCanvasTerminalTabState",
    );
    expect(terminalInteractionModelSource).toContain(
      "export function resolveTerminalDropResult",
    );
    expect(terminalInteractionCommitSource).toContain(
      "export function commitTerminalDropResult",
    );
  });

  it("routes terminal activation, tab switching, and drag-end drop resolution through the extracted module", () => {
    expect(sourceWithTerminalLayer).toContain(
      "onActivateTerminal: terminalInteractions.activateTerminal",
    );
    expect(sourceWithTerminalLayer).toContain(
      "onActivateTab: terminalInteractions.activateTerminalTab",
    );
    expect(sourceWithTerminalLayer).toContain("terminalInteractions.closeTerminalTab(args)");
    expect(terminalInteractionModelSource).toContain("resolveTerminalDropResult({");
    expect(terminalTabStateSource).toContain("activateTerminalTab");
  });
});
