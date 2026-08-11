import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const workspacePath = path.join(here, "src/modules/workspace.rs");
const shellInitPath = path.join(here, "src/modules/pty/shell_init.rs");

describe("Rust Windows path helper boundaries", () => {
  it("keeps drvfs drive-letter normalization and UNC fallback in workspace resolution", () => {
    const workspace = readFileSync(workspacePath, "utf8");

    expect(workspace).toContain("let normalized = path.replace('\\\\', \"/\");");
    expect(workspace).toContain('let rest = normalized.strip_prefix("/mnt/")?;');
    expect(workspace).toContain("let mut host = format!(\"{}:\\\\\", drive.to_ascii_uppercase());");
    expect(workspace).toContain("let suffix = parts.next().unwrap_or(\"\").replace('/', \"\\\\\");");
    expect(workspace).toContain(
      "wsl_drvfs_to_windows(path).unwrap_or_else(|| wsl_path_to_unc(distro, path))",
    );
  });

  it("keeps Windows shell lookup ordered from pwsh to PowerShell 5 to cmd.exe", () => {
    const shellInit = readFileSync(shellInitPath, "utf8");

    expect(shellInit).toContain('if let Some(p) = which_in_path("pwsh.exe") {');
    expect(shellInit).toContain('let candidate = pf.join("PowerShell").join("7").join("pwsh.exe");');
    expect(shellInit).toContain(
      '.join("WindowsPowerShell")\n        .join("v1.0")\n        .join("powershell.exe");',
    );
    expect(shellInit).toContain('system32.join("cmd.exe")');
  });
});
