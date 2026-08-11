# CLI Agents Settings

## Outcome

Replace the persona-management UI in the Settings `Agents` tab with a `CLI Agents` manager modeled after Paseo. Users can see configured CLI agents, inspect installation status, enable or disable them, search the remaining catalog, and add agents to cmdSpace.

## Behavior

- `Add` registers an agent with cmdSpace and enables it; it never installs software.
- Missing executables show `Not installed` and link to official installation instructions when available.
- Enabled configured agents are the only agents offered by Workspace Setup.
- Terminal detection continues recognizing every supported CLI so an already-running terminal remains identifiable.
- Existing AI persona/snippet storage and chat behavior remain intact, but their management UI is removed from Settings.
- The Settings tab keeps the route id `agents` for compatibility and changes its visible label to `CLI Agents`.

## Persistence

Store configured CLI ids and disabled CLI ids in the existing Tauri preferences store. Unknown or duplicate ids are ignored on load. Existing installs begin with Claude, Codex, Gemini, Copilot, OpenCode, and Pi configured and enabled.

## Verification

Unit-test catalog normalization, search, and enabled filtering. Source tests verify the Settings replacement and Workspace Setup integration. Run focused Vitest coverage, `pnpm build`, and Rust checks only if the native command changes.
