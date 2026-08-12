# Merge Blockers

A **gate**: things that must be closed before a PR ships, or that mark a known
defect which must not be papered over. Modeled on the eidetic_engine_cli
practice of a single explicit blocker list with a landing order.

## Method

Each entry states **why it blocks**, the **proposed fix** (with file anchors
where known), and its **landing order**. A PR that touches a blocked area must
either close the blocker or explicitly call out that it does not and why.

---

## Blockers

### B1 (P1) — IME bridge lacks DOM-level integration tests

**Why blocking:** `macImeBridge.ts` is the most delicate code in the terminal
subsystem. Its `writeDiff` heuristic depends on the exact ordering of
`keydown → keypress → input` events and on `lastValue` staying in sync with the
textarea — both of which only manifest in a real browser. Current tests cover
only the pure `normalizeMacTerminalInput` function. The C1/NBSP space-corruption
bug (#79/#81) shipped twice because unit tests could not reproduce the event
sequence.

**Proposed fix:**
- Add `jsdom` (or `happy-dom`) as a dev dependency and a Vitest `environment`
  override for `macImeBridge` tests.
- Drive the real textarea: `m`, `c`, `l`, `i`, space, backspace, space and
  assert the exact byte sequence reaching the mock `writeToPty` (hex-verified).
- Assert both paths: C1/NBSP space in `lastValue` + real space in textarea must
  NOT produce a DEL (regression for #81).

**Landing order:** first — everything else in this list is easier to verify
once the bridge is covered.

### B2 (P1) — `docs/ARCHITECTURE.md` + `docs/GLOSSARY.md` are stale Harness boilerplate

**Why blocking:** Both predate the app ("No application stack is selected
yet"). An agent that reads them (they sit at `docs/` root, prominent) gets
actively wrong architecture info, and `CMDSPACE.md` is the real truth. This
caused real friction during onboarding.

**Proposed fix:**
- Either delete them (with permission) or replace their content with a one-line
  pointer to `CMDSPACE.md` and `COMPREHENSIVE_PLAN.md`.
- Keep `docs/WORKFLOW.md` (still the Harness workflow authority).

**Landing order:** second — cheap, removes a known wrong-source trap.

### B3 (P2) — Branding drift: `cmdSpace` vs legacy names

**Why blocking:** Product, bundle, identifier, and source must consistently say
`cmdSpace`. Any legacy identifier makes contributors spend cycles reconciling
the mismatch and can cause release metadata drift.

**Proposed fix:**
- Decide the canonical name (product: cmdSpace) and document it in
  `COMPREHENSIVE_PLAN.md` §3.
- Migrate `AGENTS.md` heading + stray references to the canonical name.

**Landing order:** third — documentation-only, no code risk.

### B4 (P2) — Live terminal sessions are not restored across restarts

**Why blocking:** Tabs themselves are not persisted; only workspaces + pane
launch plans are. Losing all open shells on quit is surprising for a "terminal
workspace" product and is a known open product question.

**Proposed fix:**
- Product decision: is session restore in scope for the next milestone? If yes,
  ADR + design for serializing PTY scrollback + cwd + working dir on quit and
  respawning on boot.
- If out of scope, state it explicitly in `ROADMAP.md` so it is not treated as
  a regression.

**Landing order:** fourth — needs a product decision first.

---

## Not blockers (tracked elsewhere)

- Issue #66 (canvas video play overlay) — code already merged; issue just needs
  closing.
- `docs/decisions/*` use a different (Harness) format than `docs/adr/*` — by
  design, do not migrate.
