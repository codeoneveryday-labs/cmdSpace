---
name: cancel
description: "[OMX] Cancel any active OMX mode (autopilot, ralph, ultrawork, ecomode, ultraqa, swarm, ultrapilot, pipeline, team)"
---

# Cancel Skill

## When to use

Use `/cancel` (or `cancelomc` / `stopomc`) to stop an active OMX mode and perform its documented cleanup. Read `AGENTS.md#durable-runtime-invariants-canonical-ssot` first; it is the invariant authority for scope, ownership, hooks, and Team cleanup.

## Inputs and preconditions

- Accepted forms are `/cancel` and `/cancel --force`.
- Reject `--all`, unknown flags, repeated flags, and mixed flags before mutation.
- Discover the current session/root with the state read surfaces before cleanup:
  ```bash
  omx state list-active --json
  omx state get-status --mode <mode> --json
  ```
- Confirm the current session/root and exact target before cleanup; stop when the required evidence is missing.

## Operational steps

1. Parse and validate arguments; select one exact session/root scope.
2. Inspect active modes in dependency order:
   `autopilot → ralph → ultrawork → ecomode → ultraqa → swarm → ultrapilot → pipeline → team → plan-consensus`.
3. Cancel Autopilot while preserving its resumable state; clean only linked child modes it owns.
4. For Ralph, terminalize the target state (`active:false`, `current_phase:"cancelled"`, `completed_at`) and terminalize a proven linked Ultrawork/Ecomode state in the same scope. Confirm the post-conditions in `docs/contracts/ralph-cancel-contract.md`.
5. Clear standalone modes only after proving they are not linked to another active mode.
6. For Team, inspect the runtime with `omx team status <team> --json`; use `omx team shutdown <team>` after the normal completion gate, or follow the explicit abort path.
7. Clear only the selected mode/session state through the state API, for example:
   ```bash
   omx state clear --input '{"mode":"<mode>","session_id":"<session>"}' --json
   ```
8. With `--force`, perform its documented native-stop cleanup. Report rollback or cleanup failures rather than claiming success.

## Exit and evidence

Report one result per selected mode: mode, scope/session, terminal phase, preserved state, linked cleanup, and any refusal reason. A clean no-op reports `No active OMX modes detected.` Include Team status and shutdown evidence when Team was selected.
