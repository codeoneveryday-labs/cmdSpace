# Updater

cmdSpace checks for updates automatically in packaged app sessions and exposes a
manual update check from Settings.

Development builds do not run automatic update checks. This keeps `pnpm tauri
dev` logs focused on local runtime behavior instead of repeated updater endpoint
errors.

Automatic update checks are throttled. Successful no-update checks and failed
automatic checks both record the last-check timestamp so a temporary endpoint
failure does not produce repeated log noise. Manual checks are not throttled.
