# Native command registration

This note records how `src-tauri/src/lib.rs` keeps the single Tauri invoke
boundary explicit while making command registration easier to navigate by
domain.

## Registration rule

- `run()` owns the single `.invoke_handler(...)` call.
- The handler list is expanded through `cmdspace_commands!()`.
- `cmdspace_commands!()` must preserve the exact `tauri::generate_handler![...]`
  semantics: same command names, same command functions, same ordering
  expectations, and no alternate IPC path.
- Registrations are grouped by domain sections inside the macro so contributors
  can add or review commands without scanning one unstructured block.

Current domains:

- Agent usage
- PTY
- Filesystem
- Git
- Shell
- Workspace
- Window surfaces
- Secrets
- Network / AI transport
- Music
- Remote access
- Speech
- Database / persistence

## Command contract pattern

Every new Tauri command should be documented at its owning module boundary,
not in `lib.rs`. The registration site stays as composition only.

For each command, capture:

1. Command name
   - The frontend `invoke()` string and the Rust function path.

2. Input and output types
   - Request arguments, return type, and any serialized wire structs.
   - If the command streams through a `Channel`, call that out explicitly.

3. Workspace and security assumptions
   - Which paths, session ids, or workspace roots are trusted.
   - Whether the command requires prior authorization, keychain access, shell
     access, network access, or OS-specific privileges.

4. Error behavior
   - Returned `Result` error shape or string contract.
   - Whether failures are user-actionable, authorization failures, validation
     failures, or transport/runtime failures.

5. Capability changes
   - Whether the command requires plugin wiring in `src-tauri/src/lib.rs`.
   - Whether `src-tauri/capabilities/default.json` or another capability file
     must change.

## Editing guidance

- Add commands inside the correct domain section of `cmdspace_commands!()`.
- Keep `lib.rs` focused on registration and app wiring; command behavior belongs
  in the owning module.
- Do not rename a registered command, change its signature, or reorder behavior
  implicitly during registration cleanup.
- If a feature introduces a new privilege boundary, update the owning module
  docs and the relevant capability file in the same change.
