import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAgentSwitchCommand } from "./TerminalAgentSwitcher";

const here = path.dirname(new URL(import.meta.url).pathname);
const switcherSource = readFileSync(
  path.join(here, "TerminalAgentSwitcher.tsx"),
  "utf8",
);

describe("resolveAgentSwitchCommand", () => {
  it("prefers the Settings override", () => {
    expect(resolveAgentSwitchCommand("codex", { codex: "codex --fast" })).toBe(
      "codex --fast",
    );
  });

  it("uses the catalog launch command without an override", () => {
    expect(resolveAgentSwitchCommand("codex", {})).toBeTruthy();
  });

  it("does not replay the persisted legacy OMP shell bootstrap", () => {
    expect(
      resolveAgentSwitchCommand("omp", {
        omp: 'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"; omp',
      }),
    ).toBe("omp");
  });

  it("uses no command for Terminal", () => {
    expect(resolveAgentSwitchCommand(null, {})).toBeNull();
  });
});

describe("TerminalAgentSwitcher debouncing and controlled menu", () => {
  it("guards selectAgent with pendingSwitchRef and closes the menu on select", () => {
    expect(switcherSource).toContain("const [open, setOpen] = useState(false);");
    expect(switcherSource).toContain("const pendingSwitchRef = useRef(false);");
    expect(switcherSource).toContain("if (pendingSwitchRef.current) return;");
    expect(switcherSource).toContain("pendingSwitchRef.current = true;");
    expect(switcherSource).toContain("setOpen(false);");
    expect(switcherSource).toContain("<DropdownMenu open={open} onOpenChange={setOpen}>");
  });
});
