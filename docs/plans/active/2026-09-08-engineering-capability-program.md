# Execution Plan: Engineering Capability & Code Quality Program

Date: 2026-09-08

## Status

Active

## Outcome

A measurable, staged program that raises the team's engineering capability and
makes code quality **enforced by tooling rather than by memory**. Concretely:
every merge passes a written checklist, CI blocks on lint + behavior tests +
coverage ratchet, coding standards exist as config files rather than prose, and
every engineer has a defined level, a learning path, and a mentoring routine.

## Context

### Baseline pin — read this before trusting any number

**Baseline commit: `9f390ad83c54965540ffedc769abe55406beda4b` (`9f390ad83`)**
Branch `chore/398-add-ecc-project-skills`. Measured 2026-09-08.

Every baseline figure in this plan is measured **against that commit**, not
against the working tree. This matters because the working tree is being
actively modified and has already drifted twice during a single working
session:

| Snapshot | Test files | Structural guards | Rust files (`src-tauri/src`) | Tree state |
|---|---|---|---|---|
| **HEAD `9f390ad83` (pinned — authoritative)** | **498** | **289** | **218** | committed |
| Working tree @ 17:00 | 479 | 280 | 185 | 79 D / 54 M |
| Working tree @ 17:30 | 479 | 280 | 185 | 93 D / 59 M / 3 ?? |

The ~33-file Rust delta and ~19-file test delta between HEAD and the working
tree are almost entirely the **uncommitted removal of
`src-tauri/src/modules/orchestration/`** (27 files · 6,666 LOC at HEAD) plus its
frontend counterparts. Any figure measured from the working tree is therefore a
statement about *work in progress*, not about the product.

Reproduce the pinned baseline:

```bash
git archive 9f390ad83 | tar -x -C /tmp/cmdspace-baseline
cd /tmp/cmdspace-baseline && find src -name '*.test.ts*' | wc -l
```

**Do not update these numbers from the working tree.** Re-pin the whole table
to a new SHA when the tree is clean.

### Verified evidence at the pinned baseline

Full read recorded in [`docs/CODEBASE_MAP.md`](../../CODEBASE_MAP.md) — note
that file carries its own snapshot marker; see §"Evidence status" below.

| Evidence | Value at `9f390ad83` |
|---|---|
| Frontend production | 611 files · 71,771 LOC |
| Frontend tests | 498 files · 25,713 LOC |
| Rust (`src-tauri/src`) | 218 files · 37,660 LOC |
| — of which `orchestration/` | 27 files · 6,666 LOC (present at HEAD, absent in working tree) |
| Tauri commands registered | 117 |
| Test files that **execute code** | **209 of 498 (42.0%)** |
| — of those, rendering React (`.test.tsx`) | 8 |
| — IPC contract tests | 1 |
| Test files that assert **source text** | **289 of 498 (58.0%)** (`*.source.test.ts`) |
| E2E runner | **none installed** |
| Linters installed | **none** (no ESLint, Prettier, Biome, husky, commitlint) |
| Coverage tooling | **none** |
| `CODEOWNERS` | every path → `@crynta` (single owner) |
| Working tree vs HEAD | 93 deleted / 59 modified / 3 untracked — **volatile, see above** |
| Existing quality seams | [`docs/MERGE_BLOCKERS.md`](../../MERGE_BLOCKERS.md), `docs/architecture/design-patterns.md`, `commit_conventional.md`, [`.github/PULL_REQUEST_TEMPLATE.md`](../../../.github/PULL_REQUEST_TEMPLATE.md), `src/lib/tauriCommandRegistry.contract.test.ts`, `.github/workflows/ci.yml` |

> **Path note:** the PR template lives at **`.github/PULL_REQUEST_TEMPLATE.md`**
> (not repo root). All relative links in this plan are written from
> `docs/plans/active/`.

> **Evidence status:** this plan cites `docs/CODEBASE_MAP.md` as its evidence
> base. That document was generated from the *working tree*, so its
> `orchestration` section and a few counts reflect WIP rather than
> `9f390ad83`. **This plan's own baseline table above is authoritative where
> the two disagree.** Reconciling `CODEBASE_MAP.md` is tracked as **[A12]**.

Reused seams: `MERGE_BLOCKERS.md` (already the merge gate), the pattern
contract in `design-patterns.md` (already mandatory), the IPC contract test
(already detects frontend/Rust drift), and the exec-plan workflow in
`docs/WORKFLOW.md`. This plan fills gaps; it does not build parallel process.

---

## Assumptions

Stated explicitly because every downstream recommendation depends on them.
**Correct these first if they are wrong — they change the plan.**

1. **Team size: 3–6 engineers**, mixed seniority (1 senior/lead, 1–3 mid,
   1–2 junior), plus substantial AI-agent-authored code. Inferred from
   `CODEOWNERS` (one owner, comment says "until additional reviewer handles are
   explicitly authorized") and from 30+ concurrently active plans in
   `docs/plans/active/`.
2. **Tech stack**: Tauri 2 · Rust (edition 2021) · React 19 · TypeScript 5.8 ·
   Vite 7 · Tailwind v4 · xterm.js 6 · CodeMirror 6 · Vercel AI SDK v6 ·
   SQLite (rusqlite) · Vitest. Desktop, cross-platform (macOS/Linux/Windows).
3. **The product is shipping** (v0.7.105) — this is not greenfield. Standards
   must be introduced as ratchets, not big-bang rewrites.
4. **AI agents author a large share of diffs.** This changes review practice:
   the dominant risk is plausible-looking code that no one traced, plus
   structural tests that pass without proving behavior.
5. **`@crynta` is currently the only reviewer.** Any policy requiring two human
   approvers is fantasy until delegation happens — Phase 1 therefore targets
   *automated gates* first, human process second.
6. CI runs on GitHub Actions; branch protection settings are **not** verifiable
   from the repo and are assumed unset or partial.

### Ownership legend

Only one individual is identifiable from the repository (`.github/CODEOWNERS`
assigns every path to them). Every other role is therefore `TBD` rather than
given a fictional name.

| Marker | Meaning |
|---|---|
| `@crynta` | Named individual. Sole current code owner; defaults to approving anything marked `TBD`. |
| `TBD` | **Role not yet assigned.** Work is blocked on naming a person, not on the technical design. Until delegated, `@crynta` owns it. |
| `[A#]` | Policy requiring explicit approval before execution — see **Part 7**. |

Assigning a `TBD` is a prerequisite for several roadmap rows; do not start that
work by assuming `@crynta` absorbed it silently.

---

## Part 0 — Impact-ordered summary

Ordered by expected risk reduction per unit of effort:

| # | Action | Why first | Owner |
|---|---|---|---|
| 1 | Working-tree & branch hygiene (clear the 133-file WIP) | Unreviewable diffs make every other control meaningless | `@crynta` |
| 2 | Add ESLint + Prettier (or Biome) + pre-commit | Zero static analysis is the single largest gap | `TBD` |
| 3 | Install jsdom; unblock `MERGE_BLOCKERS` B1 | The most delicate code (IME bridge) is unverified | `TBD` |
| 4 | Ban new `*.source.test.ts`; behavior-test rule | 58% of the suite proves nothing about behavior | All engineers |
| 5 | Coverage ratchet (no global target) | Makes coverage improve monotonically without a rewrite | `TBD` |
| 6 | Written review checklist + PR size limit | Turns "senior taste" into a repeatable gate | `@crynta` |
| 7 | Coding standards as config + short written doc | Enforcement beats documentation | `@crynta` |
| 8 | Delegate CODEOWNERS to per-area owners | Removes the single-reviewer bottleneck | `@crynta` |
| 9 | Leveling framework + learning paths | Capability growth is the actual goal | `@crynta` |
| 10 | Mentoring routines (pairing, tech talks, ADR club) | Only durable mechanism for mixed seniority | All engineers |

---

## Part 1 — Assessment framework

### 1.1 What to do

Assess on **four axes**, not one. A team can be strong on tooling and weak on
design.

**Axis A — Codebase health (objective, measured from the repo)**

**All values measured at pinned baseline `9f390ad83`** (not the working tree —
see the pin table in Context). See §2.5.1 for the test taxonomy: **"executable"
is not the same as "render"**, and an earlier draft conflated the two.

| Metric | Baseline @ `9f390ad83` | Target (90 days) |
|---|---|---|
| Frontend test files, total | **498** | — |
| — **structural guards** (`*.source.test.ts`) | **289 (58.0%)** | ≤ 289 (no new); −50 by day 90 |
| — **executable tests** | **209 (42.0%)** | ≥ 310 |
| — — unit / pure logic (`.test.ts`) | 200 | — |
| — — render / component (`.test.tsx`) | 8 | ≥ 25 |
| — — IPC contract (`*.contract.test.ts`) | 1 | ≥ 3 |
| E2E tests | **0** (no runner installed) | 1 pilot flow |
| Rust `#[test]` functions | ~341 | ≥ 400 |
| Rust `#[tokio::test]` | 0 | as needed |
| Lint errors | **n/a — no linter installed** | 0 (blocking) |
| Coverage | **unmeasured — no tool installed** | baseline wk 2; ratchet wk 6 |
| Largest module LOC (prod) | `architecture/` ~10.3k | ≤ 8,000 |
| Dead modules | 1 (`src/modules/git/`) | 0 |
| Stale doc artifacts | ≥ 4 (`ARCHITECTURE.md`, `GLOSSARY.md`, `TEST_MATRIX.md`, `components.json`) | 0 |
| Working tree vs HEAD | 93 D / 59 M / 3 ?? at 17:30 — **not a baseline** | < 20 typical |

**Two caveats on this table:**

1. Rust `#[test]` count, module LOCs, and the unit/render split are carried over
   from the working-tree measurement and marked `~`. Re-derive them from
   `9f390ad83` when **[A12]** reconciles `CODEBASE_MAP.md`.
2. **Do not re-measure from the working tree.** It changed twice in one session
   (79D/54M → 93D/59M). Re-pin to a new SHA once the tree is clean (§6A week 1,
   **[A1]**).

**Axis B — Engineering practice (measured from PR history)**

- PR cycle time (open → merge), median and p90.
- First-review latency.
- PR diff size (LOC) — enforce < 400 LOC.
- Revert / hotfix rate within 7 days of merge.
- Change-failure rate (DORA).
- % PRs where CI was red at least once after review started.

**Axis C — Individual capability (leveling matrix)**

Four levels, calibrated to *this* stack. Each level requires evidence, not
tenure.

| | L1 Junior | L2 Mid | L3 Senior | L4 Staff/Lead |
|---|---|---|---|---|
| **Scope** | Well-defined task, one module | Feature across 2–3 modules | Subsystem end-to-end; sets its direction | Cross-cutting; defines standards |
| **Rust/TS** | Writes correct code with review | Fluent both sides; adds Tauri commands safely | Holds the two-process invariant instinctively | Removes a pattern seam safely |
| **Testing** | Writes unit tests for own code | Writes regression tests that fail first | Chooses the right proof level per change | Sets proof strategy |
| **Design** | Follows existing seam | Recognizes and reuses seams | Names the pattern and its invariant | Decides when a new seam is warranted |
| **Review** | Reviews with checklist | Catches lifecycle & error-handling gaps | Catches design and invariant violations | Catches missing proof and product risk |
| **Autonomy** | Needs task breakdown | Needs direction, not steps | Needs outcome only | Defines the outcome |

Calibration method: every engineer self-assesses, then the lead calibrates
against two real PRs. Re-calibrate quarterly.

**Axis D — Skill gaps (predicted from this codebase — validate in week 1)**

Ranked gaps this stack reliably produces:

1. **Test design** — writing tests that prove behavior instead of restating
   implementation. Directly evidenced by 289 source-text guards.
2. **The two-process boundary** — knowing what belongs in Rust vs React, and
   keeping `invoke` contracts synchronized (`commands.rs`, capabilities,
   frontend client).
3. **Lifecycle & resource ownership** — PTY, renderer pool, subscriptions. The
   repo's own invariant list calls this out; leaks show up as orphan processes.
4. **Error handling across the IPC seam** — typed errors, no swallowed
   failures, user-visible surfacing.
5. **Concurrency / async correctness in Rust** — `RwLock` state, `Channel`
   streaming, Job Objects on Windows.
6. **Reading and critiquing AI-generated code** — tracing a plausible diff to
   its actual behavior.
7. **Incremental design in large modules** — `architecture/` and `terminal/`
   are past the size where ad-hoc additions stay coherent.

### 1.2 Who owns it

- **`@crynta`** — defines the axes, runs calibration, keeps the
  leveling matrix honest.
- **Each engineer** — self-assessment + two PRs as evidence.
- **`TBD`** — automates Axis A and Axis B metrics so they are collected,
  not manually gathered.

### 1.3 How progress is measured

- Baseline recorded in this plan within **5 working days** (Axis A already done
  above; Axis B needs a PR-history query).
- Axis A re-measured **weekly**, automatically, in CI (a `metrics` job writing
  to a build artifact).
- Axis C re-assessed **quarterly**; movement of ≥1 level for ≥50% of engineers
  within 2 quarters is the success bar.
- Axis D validated by **one structured 1:1 per engineer in week 1**.

---

## Part 2 — Coding standards

**Principle: standards live in config files first, prose second.** A rule that
cannot fail CI will not survive a deadline.

### 2.1 Naming

| Kind | Rule | Enforced by |
|---|---|---|
| TS files | `kebab-case.ts` | ESLint / Biome |
| TS components | `PascalCase.tsx` | ESLint |
| Hooks | `useXxx.ts`, function `useXxx` | ESLint (`react-hooks`) |
| TS types/interfaces | `PascalCase`, no `I` prefix | ESLint |
| Constants | `UPPER_SNAKE_CASE` at module scope | ESLint |
| Rust modules / fns / vars | `snake_case` | clippy + `rustfmt` |
| Rust types / traits | `PascalCase` | clippy |
| Tauri commands | `{domain}_{verb}_{object}` — e.g. `fs_read_file`, `pty_open` | IPC contract test |
| Test files | `<unit>.test.ts` colocated; `*.source.test.ts` **banned for new files** | ESLint rule + CI grep gate |

**Banned identifiers** (they signal an unfocused module): `utils`, `helpers`,
`misc`, `common`, `manager`, `handler` without a qualifier, `data`, `temp`,
`foo`. Exception: `@/lib/utils.ts` (existing, holds only `cn()`).

**Repo-specific naming rules:**
- Product name is **always** `cmdSpace` in product, bundle, and source
  surfaces. (`AGENTS.md` §3; merge blocker B3.)
- Frontend canonical path form is **forward-slash**. Convert at the native
  boundary, never mid-layer.
- Workspace env scope: every IPC call passes `currentWorkspaceEnv()`.

### 2.2 Project structure

- Features live in `src/modules/<name>/` with:
  - `index.ts` barrel (thin — exports, no logic). **`ai/`, `settings/`,
    `git/` are missing barrels; add them.**
  - `lib/` for hooks and pure logic, `components/` for UI.
- Coordination stays in `src/app/`. Feature modules must not hold
  workspace/tab/pane state (single-source-of-truth invariant).
- Cross-module imports: always `@/…`. Never `../../modules/x`.
- Rust: keep the established **facade + `#[path]`** pattern (`net.rs` →
  `net_http.rs` + `net_security.rs`). Document it in `CMDSPACE.md` once, then
  follow it.
- **Soft size cap: 5,000 LOC production per module.** `architecture/` (10,322)
  and `terminal/` (8,377) are over. Do not freeze them — require that new work
  extract a seam rather than grow them, and track LOC as a CI metric.
- Dead code: `src/modules/git/` (43 LOC, zero importers) — remove with explicit
  permission per `AGENTS.md`, or formally adopt it as the git event bus. Pick
  one; do not leave it.

### 2.3 Error handling

- **Rust**: return `Result<T, AppError>` using `thiserror`. No `.unwrap()` /
  `.expect()` outside tests — add `#![warn(clippy::unwrap_used)]` and
  `clippy::expect_used` to make clippy enforce it (currently only default
  clippy runs under `-D warnings`).
- Never swallow: every `Err` is logged at the boundary **with context** or
  converted to a typed error. No `let _ = ...;`.
- **TS**: no empty `catch`. Every `catch` either rethrows, surfaces to the UI,
  or logs with a reason comment. Type IPC failures rather than treating them as
  `unknown` forever.
- **At the Tauri seam**: commands currently return `Result<T, String>`. Move to
  a structured error type so the frontend can distinguish
  `NotFound` / `PermissionDenied` / `Io` instead of string-matching.
- **Security paths**: `ai/lib/security.ts` deny-list applies to **both** read
  and write; `net_security.rs` SSRF guard applies to every outbound AI request.
  No bypass, no second caller path.

### 2.4 Comments

- Comment **why**, never **what**. If the code needs a "what" comment, rename
  or extract instead.
- Required prefixes for non-obvious code:
  - `// WHY:` — rationale not visible in the code.
  - `// SAFETY:` — unsafe blocks (must state the invariant upheld).
  - `// INVARIANT:` — a rule that other code depends on.
  - `// PLATFORM:` — platform-specific behavior (Windows ConPTY, macOS IME).
- No commented-out code. Git is the archive.
- Rust: doc comments on every `pub` item and **every Tauri command** (they are
  the public API surface for the webview).
- Every non-obvious invariant gets a pointer to its ADR or to
  `design-patterns.md` §6.

### 2.5 Testing conventions

#### 2.5.1 Test taxonomy

Two orthogonal axes. **Every test file must be classifiable on both**, and the
class must be visible from the filename.

**Axis 1 — Strength: what does it actually prove?**

| Class | Definition | Counts toward coverage & DoD? | @ `9f390ad83` |
|---|---|---|---|
| **Executable** | Runs the code under test, asserts on its output or observable behavior | **Yes** | **209 (42.0%)** |
| **Structural guard** | Reads source text and asserts on its contents — `expect(source).toContain(...)` | **No** | **289 (58.0%)** |

A structural guard is a lint rule wearing a test costume. It can catch an
accidental deletion; **it cannot catch wrong behavior**. It is never acceptable
as the only proof for a bug fix, and it must never be counted as coverage.

This distinction is the reason an earlier baseline of "1.3% behavior tests" was
wrong: it counted only the 8 files that *render React*, ignoring the ~200 unit
tests that execute code perfectly well. Correct baseline at `9f390ad83` is
**209 executable / 498 total (42.0%)**.

**Axis 2 — Scope: where does it run?**

Pick the **lowest** scope that proves the behavior. Component tests are not
"better" than unit tests — they are just more expensive.

| Class | Scope | Tooling | FE today | Rust today |
|---|---|---|---|---|
| **Unit** | One function / reducer / parser / state machine | Vitest (node env) | 193 | 341 `#[test]` |
| **Component** | Renders React, asserts DOM + behavior | Vitest + **jsdom (not installed)** | 6 | — |
| **Contract** | Cross-layer agreement (frontend `invoke` ↔ Rust `generate_handler`) | Vitest + filesystem scan | 1 | — |
| **Integration** | Rust command + SQLite + real parser/provider | `cargo test` | 0 | colocated |
| **E2E** | User-visible desktop flow, end to end | **none installed** | 0 | 0 |
| **Platform** | Only what lower layers cannot prove: shell init, PTY, IME, ConPTY / Job Objects | targeted + manual | 0 | partial |

**Filename convention:**

| Suffix | Class |
|---|---|
| `<unit>.test.ts` | Unit |
| `<Component>.test.tsx` | Component (requires jsdom) |
| `<thing>.contract.test.ts` | Contract (cross-layer) |
| `<thing>.integration.test.rs`, `*_test.rs` | Rust integration |
| `*.source.test.ts` | **Structural guard — deprecated, do not add** |

#### 2.5.2 Rules

**The headline rule: test behavior, not source text.**

- **No new `*.source.test.ts`.** Existing 289 are grandfathered; delete them
  opportunistically when the covered code changes. Add a CI grep gate so the
  count cannot rise.
- **Every bug fix ships an executable test that fails before the fix and passes
  after.** A structural guard does not satisfy this.
- **Install `jsdom`** (unblocks merge blocker B1 — the IME bridge is unverified
  and the C1/NBSP bug shipped twice). Add `environment: 'jsdom'` per-file via
  a Vitest docblock, not globally.
- Naming: `describe('<unit>')` → `it('does X when Y')`. The sentence must
  describe observable behavior.
- **Every bug fix ships a regression test that fails before the fix and passes
  after.** State this in the PR; reviewers verify it.
- Rust: colocated `#[cfg(test)]` for unit; `*_test.rs` for cross-module. 56
  `#[cfg(test)]` modules exist today; keep co-location.
- **`src/lib/tauriCommandRegistry.contract.test.ts` must stay green.** It is
  the only automated guard against frontend/Rust IPC drift across 111 commands.

### 2.6 Who owns it

- **`@crynta`** — approves the standard, owns the written doc.
- **`TBD`** — ESLint/Prettier (or Biome) config, TS rules.
- **`TBD`** — clippy lints (`unwrap_used`, `expect_used`), rustfmt,
  Rust doc-comment rule.
- **All engineers** — follow it; propose changes via PR, not verbal convention.

### 2.7 How progress is measured

- Lint config merged and CI-blocking → **binary, week 2**.
- New `*.source.test.ts` files per sprint = **0** (CI gate).
- Doc comments on Tauri commands: 0 → 117 (track; target 100% in 2 quarters).
- Module LOC trend for `architecture/` and `terminal/`: flat or down.
- Rust `unwrap`/`expect` in non-test code: 0 after lint lands.

---

## Part 3 — Code review checklist and workflow

### 3.1 The workflow

Given a single current reviewer, sequence it honestly:

**Stage 1 (now — weeks 1–4): automated gates carry the load**
1. Author fills the PR template **including the self-review checklist** (§3.2).
2. CI must be green: `tsc --noEmit`, ESLint, `pnpm test`, `pnpm build`,
   `cargo check --all-targets --locked`, `cargo clippy -- -D warnings`.
3. `@crynta` reviews. Focus review time on design and invariants — the machine
   already checked the mechanical parts.
4. Merge.

**Stage 2 (weeks 4–12): delegation**
5. CODEOWNERS split into per-area owners (terminal, canvas, AI, native,
   remote). Each owner reviews their area; `@crynta` reviews only
   cross-cutting and `src/app/`, `lib.rs`, `capabilities/`.
6. Second reviewer required for: security surfaces (`fs/`, `net.rs`,
   `secrets.rs`, `shell/`, `speech.rs`), anything touching the two-process
   boundary, and any change > 400 LOC.
7. Branch protection: require CI, require CODEOWNERS review, block force-push
   to `main`.

**Rules that apply at every stage:**
- **PR size limit: 400 LOC diff** (excluding generated files and lockfiles).
  Oversize PRs get split. This is the highest-leverage review rule that exists.
- **First-review SLA: 1 working day.** Beyond that, escalate — a stalled PR is
  a process bug, not an author problem.
- **Author merges** after approval. Reviewer never merges (keeps ownership
  with the author).
- **No unrelated files.** The current 133-file working tree is exactly the
  failure mode this prevents.
- **Review AI-authored diffs the same way, plus one extra step**: the author
  must state which parts they traced themselves and which they did not.

### 3.2 The checklist

Copy into `.github/PULL_REQUEST_TEMPLATE.md`. Reviewer walks it in order; any
**blocker** is a hard stop.

**Correctness**
- [ ] Does the change do what the PR says? Trace it, don't assume.
- [ ] Is there a test that **fails without this change**?
- [ ] Are edge cases covered (empty, null, boundary, concurrent, platform)?
- [ ] **Blocker**: Does it break an existing behavior without a stated reason?

**Architecture (from `design-patterns.md` §6 — non-negotiable invariants)**
- [ ] **Two-process**: every FS / process / shell / secret / network operation
      crosses the Rust seam. No parallel privileged path.
- [ ] **Single source of truth**: does this duplicate state already owned by
      `App.tsx`, `useTabs`, or a store?
- [ ] **Pattern named**: does the PR name the pattern it touches and preserve
      the invariant? (If it changes one → stop, needs an ADR.)
- [ ] **Lifecycle symmetry**: every open/spawn/subscribe has a matching
      close/dispose/detach. Check cleanup on *failure* paths too.
- [ ] **Serializable snapshots**: no live PTY / process handle in any persisted
      payload or undo entry.
- [ ] **Terminal ownership**: standard terminals use the renderer pool; canvas
      terminals own private xterm + PTY. Not mixed.
- [ ] **Camera isolation**: canvas transforms do not trigger PTY fit/resize.

**Security**
- [ ] **Security proxy**: path guards and SSRF defenses apply to **both** read
      and write; no second bypass path.
- [ ] No secret written to disk, settings store, or `localStorage`. Keys
      through `secrets_*` only.
- [ ] New Tauri command → capability allowlist updated? Is the scope minimal?
- [ ] Untrusted input (shell output, OSC 7 cwd, remote client) validated or
      ignored, never trusted.

**Code quality**
- [ ] Naming follows §2.1. No banned identifiers.
- [ ] Error handling follows §2.3. No empty `catch`, no unreachable `unwrap`.
- [ ] Comments explain why. No commented-out code.
- [ ] No dead code added. Does this make an existing module dead?
- [ ] Canonical paths: forward-slash in frontend, converted at the boundary.

**Testing & proof**
- [ ] Tests assert **behavior**, not source text (executable, not structural
      guard — §2.5.1).
- [ ] Coverage: changed executable lines covered; carve-outs declared **and**
      not on the critical-path list (§4.2.1).
- [ ] `pnpm exec tsc --noEmit` clean.
- [ ] Rust touched → `cargo check` + `clippy` clean.
- [ ] IPC touched → contract test green.
- [ ] **Blocker**: does the change weaken or remove existing validation?

**Delivery hygiene**
- [ ] Conventional Commit title; `Tested:` / `Not-tested:` trailers present.
- [ ] Only files belonging to this change are staged.
- [ ] Docs updated if behavior or architecture changed (`CMDSPACE.md` and
      `design-patterns.md` before any other doc).
- [ ] User-visible change → `CHANGELOG.md` entry in the same commit.
- [ ] Does this touch a `docs/MERGE_BLOCKERS.md` entry? If so, does it close
      or explicitly excuse it?

### 3.3 Who owns it

- **`@crynta`** — owns the checklist content, enforces it until delegation.
- **Per-area owners (`TBD`)** (from week 4) — enforce in their area.
- **`TBD`** — makes every mechanically-checkable item a CI check so the
  human checklist shrinks over time.

### 3.4 How progress is measured

- % PRs with the checklist filled: target 100% (CI can require the template).
- Median first-review latency: target < 1 working day.
- Median PR size: target < 400 LOC.
- Escaped defects (found after merge) per sprint: trend to 0.
- Reviewer count: 1 → ≥3 by week 12.
- Checklist items converted to automated checks: ≥6 by week 12.

---

## Part 4 — Quality control (BLOCKING GATES)

> **Boundary — read this before editing.**
>
> This plan covers two fundamentally different kinds of work, and they must not
> be tracked or enforced the same way:
>
> | | **Quality gates** (Parts 2, 3, 4) | **Capability & mentoring** (Parts 1, 5) |
> |---|---|---|
> | Nature | Rules and automated checks | People development |
> | Blocks a merge? | **Yes** | **Never** |
> | Failure mode | A defect ships | A person doesn't grow |
> | Measured by | CI status, coverage, PR metrics | Level movement, session completion |
> | Lives in | CI config, `.github/`, lint configs | Calendar, docs, 1:1s |
> | Owner can be | The pipeline (automated) | Only a human |
>
> **Rule: no capability or mentoring item may ever appear as a merge
> requirement.** Missing a tech talk is a management conversation, not a failed
> build. Conversely, no quality gate may be waived because "we're still
> learning" — that is what the staged rollout in §6A is for.
>
> If these two tracks need separate documents later, split here: Parts 2–4 +
> §6A become the quality charter; Parts 1, 5 + §6B become the capability plan.

### 4.1 Automated checks — what to add

Current CI already runs: `tsc --noEmit`, `pnpm test`, `pnpm build`,
`cargo check --all-targets --locked`, `cargo clippy -- -D warnings` (Ubuntu +
Windows). **Missing and required:**

| # | Check | Where | Blocks merge |
|---|---|---|---|
| 1 | ESLint (TS/React rules, naming, no-empty-catch, no-console) | new CI job | yes, from week 3 |
| 2 | Prettier / Biome format check | new CI job | yes, from week 3 |
| 3 | `cargo fmt --check` | CI `rust` job | yes |
| 4 | Clippy pedantic lints `unwrap_used`, `expect_used` | `lib.rs` lint attrs | yes, from week 4 |
| 5 | Coverage ratchet (§4.2) | new CI job | yes, from week 6 |
| 6 | Gate: no **new** `*.source.test.ts` | CI grep | yes, from week 2 |
| 7 | Gate: module LOC budget | CI metric (warn first, block later) | warn |
| 8 | Gate: no uncommitted-file sprawl on the branch | CI | no (dashboard) |
| 9 | `pnpm audit` / `cargo audit` for advisories | scheduled CI | yes for high/critical |
| 10 | Dependency freshness (Dependabot/Renovate) | bot | no |

**Pre-commit (husky + lint-staged)**: `tsc --noEmit` on changed files,
ESLint `--fix`, Prettier, `cargo fmt` on staged Rust. Keep it under ~5 seconds
or people will `--no-verify`.

### 4.2 Test coverage expectations

**Do not set a global percentage target on a 72k LOC codebase.** That produces
coverage theater — exactly the failure mode the 289 source-text tests
represent. Use a **ratchet** plus **critical-path floors**:

1. **Instrument now**: add `@vitest/coverage-v8` and `cargo-llvm-cov`. Publish
   a baseline number. Baseline = first measured value, however low.
2. **Ratchet**: CI fails if coverage decreases versus `main`. Coverage can only
   go up. No exceptions without an explicit PR comment.
3. **Primary target — changed *executable* lines, not whole files.** A file-level
   percentage is the wrong unit: it punishes large files that are mostly type
   declarations or re-exports, and it rewards padding a trivial file to 100%.
   Target: **≥ 70% of the executable lines you added or changed** are covered by
   an executable test (§2.5.1). Enforce in CI as a *diff* check
   (`coverage.report-changed-lines`), not a whole-file check.
4. **Critical-path floors (6 months)**: 80% line coverage on the security and
   lifecycle surfaces — `src-tauri/src/modules/fs/`, `net*.rs`, `secrets.rs`,
   `shell/`, `pty/session*.rs`, `src/modules/ai/lib/security.ts`,
   `proxyFetch.ts`, `macImeBridge.ts`, `rendererPool.ts`. **No carve-out applies
   to this list** — these are the modules where a missed branch leaks a secret
   or orphans a process.
5. **Executable-test ratio**: executable tests ÷ total test files. 42.0% at
   `9f390ad83` (209/498) → 65% at 90 days → 85% at 6 months. Structural guards
   do not count as coverage (§2.5.1).

#### 4.2.1 Coverage carve-outs

A blanket "every new file ≥ 70%" rule produces **coverage theater** exactly
where it is cheapest to fake and least useful to have. These categories are
exempt from rules 3 and 4; they still must compile, type-check, and lint.

| Carve-out | Applies to | Why | What replaces the number |
|---|---|---|---|
| **Generated** | `*.d.ts`, codegen output, `explorer/lib/fileIcons.ts` (2.7k LOC icon map), protobuf/serde derives, `*.generated.*` | Testing generated output tests the generator's output, not your logic | Excluded from coverage denominators entirely |
| **Config & wiring** | `vite.config.ts`, `tailwind` config, `components.json`, `tauri.conf.json`, barrel `index.ts` re-exports, DI/registration files | No branch logic to cover; a "test" here asserts that a line exists | Excluded; covered instead by the build succeeding |
| **Contract-only** | `*.contract.test.ts` and the source it guards | Its whole job is comparing two surfaces; coverage of it is meaningless | Excluded; the contract test *is* the proof |
| **Adapters & thin bridges** | `pty-bridge.ts`, `native.ts` (thin `invoke` wrappers), `#[path]` facade re-exports | Crossing a boundary — best proven by integration/platform tests, not line coverage | Prove with one integration or contract test, not a % |
| **Type-only & constants** | Files with no runtime behavior | Zero executable lines | Auto-excluded (no executable lines to cover) |
| **Platform-gated** | `#[cfg(windows)]` / `#[cfg(target_os = "macos")]` arms | CI runs one OS; the other arm is uncoverable in that job | Excluded per-job; must be proven on its own platform job or marked `Not-tested:` |
| **UI layout only** | Pure presentational components with no logic | Snapshot/DOM assertions add churn without catching bugs | Excluded; visual review in PR screenshots instead |

**Rules of engagement:**

- Carve-outs are **declared in the PR**, not silently assumed. Add
  `Coverage: carve-out — <category>` to the PR body; the reviewer confirms.
- Carve-outs **never** apply to the critical-path list in rule 4.
- Anything in `src-tauri/src/modules/{fs,shell,net*,secrets}` and the AI
  security path is **never** a carve-out.
- If a file is disputed, default to **not** carved out and write one executable
  test. A cheap real test beats an argued exemption.
- Revisit the list at 90 days: if a category is being over-claimed, tighten it.

**Definition of Done** (a change is done only when all of these hold):

- [ ] Behavior is implemented and manually verified in the running app
      (`pnpm tauri dev`), not just in tests.
- [ ] Automated proof exists at the appropriate level and **fails without the
      change**.
- [ ] All CI checks green (§4.1).
- [ ] Coverage did not decrease; **≥ 70% of changed executable lines** are
      covered (§4.2 rule 3). Any carve-out declared as
      `Coverage: carve-out — <category>` and confirmed by the reviewer
      (§4.2.1); carve-outs never apply to the critical-path list.
- [ ] Self-review checklist complete; review approved.
- [ ] Error paths and failure modes exercised, not just the happy path.
- [ ] Docs updated (`CMDSPACE.md` / `design-patterns.md` if architecture
      changed; `CHANGELOG.md` if user-visible).
- [ ] No new dead code, no new `TODO` without a linked issue.
- [ ] Conventional Commit with `Tested:` trailer.
- [ ] For AI-authored code: author states what they traced and what they did
      not.
- [ ] No known defect is knowingly shipped — or it is recorded in
      `docs/MERGE_BLOCKERS.md` with an owner and a date.

### 4.3 Who owns it

- **`TBD`** — CI pipeline, coverage tooling, ratchet, audit jobs.
- **`TBD`** — `cargo fmt`, clippy lints, `cargo-llvm-cov`.
- **`TBD`** — ESLint/Prettier, `@vitest/coverage-v8`, jsdom.
- **`@crynta`** — the Definition of Done; adjudicates ratchet exceptions.

### 4.4 How progress is measured

- CI job count enforcing quality: 3 (today) → 10 (week 6).
- Coverage baseline published by **week 2**; ratchet active by **week 6**.
- Build success rate on `main`: target ≥ 95%.
- Escaped defects per release: baseline then trend down.
- Time from merge to release-blocking regression detected: trend down.

---

## Part 5 — Staged learning path and mentoring (NON-BLOCKING)

> **This part never blocks a merge.** See the boundary note at the top of
> Part 4. Everything below is people development: tracked on the calendar and
> in 1:1s, never in CI. The only overlap with Part 4 is that learning sessions
> *produce* artifacts (tests, ADRs) which then pass through the normal gates
> like any other change.

Designed for mixed seniority where the senior engineer is also the bottleneck.
Every routine must therefore be **asynchronous-first and reusable** — a talk
recorded once teaches forever; a 1:1 teaches one person.

### 5.1 Staged path

**Stage 1 — Foundations (weeks 1–4). Everyone, including seniors.**
Goal: shared vocabulary, so review comments stop being re-explained.
- Read, in order: `AGENTS.md` → `CMDSPACE.md` → `COMPREHENSIVE_PLAN.md` →
  `docs/architecture/design-patterns.md` →
  `docs/CODEBASE_MAP.md` → `docs/adr/`.
- Exercise: each engineer adds one row to `docs/TEST_MATRIX.md` (currently
  empty boilerplate) for a behavior they own. This teaches the proof model and
  makes the matrix real.
- **Measure**: 100% completion; matrix has ≥1 real row per engineer.

**Stage 2 — The hard seams (weeks 5–12).**
Goal: turn the invariant list into instinct. One module per two weeks, each
taught by whoever knows it:
1. Terminal input pipeline (PTY → OSC → IME) — includes shipping the jsdom
   tests for blocker B1.
2. Renderer pool and terminal lifecycle (Flyweight + lifecycle symmetry).
3. The two-process boundary: adding a Tauri command end-to-end (Rust command →
   `commands.rs` → capability → frontend client → contract test).
4. Canvas: camera isolation, private PTY, serializable snapshots.
5. AI subsystem: tools, approval flow, security proxy.
6. Persistence: SQLite schema, migrations, metadata-only snapshots.
- **Format**: 60-min session = 20 min walkthrough + 40 min live exercise.
- **Measure**: each engineer ships ≥1 PR touching ≥3 of the 6 areas.

**Stage 3 — Design fluency (months 4–6).**
- Reading group on `design-patterns.md`: one pattern per session, find it in
  the codebase, then find a place it is *violated*.
- Every engineer writes one ADR (`docs/adr/`) for a real decision they made.
- Rotation: every engineer spends one sprint owning a module outside their
  comfort zone (frontend engineers in Rust and vice versa).
- **Measure**: ≥1 ADR per engineer; ≥1 cross-stack PR per engineer.

**Stage 4 — Teaching (ongoing).**
- L3+ engineers are expected to run a Stage 2 session. Teaching is the leveling
  gate for senior, not a favor.

### 5.2 Mentoring routines

| Routine | Cadence | Who | Format | Measure |
|---|---|---|---|---|
| **Pair programming** | 2 × 90 min/week | Mixed pairs (senior+mid, mid+junior) | Real work, driver rotates every 25 min; navigator reviews against the checklist live | Sessions logged; junior PR self-sufficiency up |
| **Tech talks** | Biweekly, 45 min | Rotating; L3+ must present once/quarter | Recorded + notes in `docs/`; one talk = one artifact | ≥1/quarter per L3+; attendance ≥70% |
| **ADR club** | Monthly, 45 min | All | Review last month's ADRs; argue with the decision, not the author | ≥1 ADR/month reviewed |
| **Review apprenticeship** | Weekly, 30 min | Junior shadows a senior review | Senior reviews aloud, thinking out loud | Junior passes a calibration review alone by month 3 |
| **1:1** | Biweekly, 30 min | Lead ↔ each engineer | Level assessment, gap plan, blockers | Level movement tracked quarterly |
| **Retro on escaped defects** | Per escaped defect | Whoever fixed it + lead | Blameless: why did the gate miss it, what check would have caught it | ≥1 new automated check per escaped defect |

**The single highest-value routine for this codebase**: the escaped-defect
retro coupled to "what check would have caught it". Every incident must produce
a new automated gate. That is how the checklist shrinks and quality compounds.

### 5.3 Who owns it

- **`@crynta`** — curriculum, leveling, 1:1s, presentation roster.
- **Module owners (`TBD`)** — own their Stage 2 session and its artifact.
- **All engineers** — attend, present, pair.
- **`TBD`** — recording, notes, and the metrics dashboard.

### 5.4 How progress is measured

- Stage completion: 100% Stage 1 by week 4; Stage 2 by week 12.
- Level movement: ≥50% of engineers move ≥1 level within 2 quarters.
- Cross-stack PRs: ≥1 per engineer by month 6.
- Reviewer count: 1 → ≥3 by week 12 (unblocks the whole workflow).
- New automated checks generated by retros: ≥1 per escaped defect, 100%.

---

## Part 6A — Quality gate roadmap (BLOCKING)

Every row here ends in a check that either passes or fails. Slipping a row means
the corresponding gate is simply not yet enforced.

| Window | Deliverable | Owner | Approval | Exit criteria |
|---|---|---|---|---|
| **Week 1** | Resolve the 133-file working tree; decide restore vs. commit for `orchestration`; update or delete orphaned orchestration docs | `@crynta` | **[A1]** | Clean tree; docs match code |
| **Week 1** | Publish Axis B baseline (PR cycle time, size, latency) | TBD (`@crynta`) | — | Numbers recorded in this plan |
| **Week 2** | ESLint + Prettier (or Biome) merged, **warn-only** | TBD (`@crynta`) | **[A5]** | CI reports counts |
| **Week 2** | `@vitest/coverage-v8` + `cargo-llvm-cov`; publish baseline | TBD (`@crynta`) | — | Baseline recorded |
| **Week 2** | Gate: no new `*.source.test.ts` | TBD (`@crynta`) | **[A6]** | CI blocks |
| **Week 3** | ESLint **blocking**; `cargo fmt --check`; pre-commit hooks | TBD (`@crynta`) | **[A5]** | CI green and enforced |
| **Week 3** | jsdom installed; IME bridge DOM tests land (**closes blocker B1**) | TBD (`@crynta`) | — | B1 closed in `MERGE_BLOCKERS.md` |
| **Week 4** | Review checklist merged into PR template; PR size limit live | `@crynta` | **[A4]** | 100% PRs use it |
| **Week 4** | Clippy `unwrap_used` / `expect_used` enabled | TBD (`@crynta`) | **[A5]** | Zero violations |
| **Week 4–6** | CODEOWNERS delegated per area; branch protection on | `@crynta` | **[A3]** | ≥3 reviewers active |
| **Week 6** | Coverage ratchet blocking | TBD (`@crynta`) | **[A2]** | Coverage cannot regress |
| **Month 6** | Critical-path coverage floors (80%) | TBD (`@crynta`) | — | Measured |

## Part 6B — Capability & mentoring roadmap (NON-BLOCKING)

Tracked on the calendar, never in CI. Missing a row is a management
conversation, not a failed build.

| Window | Deliverable | Owner | Measure |
|---|---|---|---|
| **Week 1** | Level calibration 1:1s for every engineer (Axis C + Axis D) | `@crynta` | Self-assessment + 2 PRs each |
| **Week 1–4** | Stage 1 foundations: reading order + one real row each in `docs/TEST_MATRIX.md` | All engineers | 100% completion; ≥1 row per engineer |
| **Week 5–12** | Stage 2 hard-seam track (6 modules, one per two weeks) | Module owners (`TBD`) | Sessions held; each engineer ships ≥1 PR in ≥3 areas |
| **Week 4+** | Pair programming 2 × 90 min/week, mixed pairs | All engineers | Sessions logged |
| **Week 4+** | Tech talks biweekly, recorded | Rotating (`TBD`) | ≥1/quarter per L3+; ≥70% attendance |
| **Month 2+** | ADR club monthly | `@crynta` | ≥1 ADR reviewed/month |
| **Month 4–6** | Stage 3: one ADR per engineer; cross-stack rotation | `@crynta` | ≥1 ADR each; ≥1 cross-stack PR each |
| **Quarterly** | Level re-calibration | `@crynta` | ≥50% move ≥1 level in 2 quarters |

---

## Part 7 — Policies requiring approval

**No item in this list may be executed on this plan's authority alone.** Each
needs an explicit decision recorded in the PR body or in this table before work
starts. `AGENTS.md` Rule 1 forbids file deletion without express written
permission, and several rows below are deletions.

| ID | Policy | Why approval is needed | Approver | Status |
|---|---|---|---|---|
| **[A1]** | Resolve `orchestration`: restore the 30 deleted files vs. commit the deletion | 32 files / ~6.9k LOC, 36 removed commands, 7 orphaned docs. Irreversible either way | `@crynta` | **Pending** |
| **[A2]** | Coverage ratchet blocks merges | Changes the merge contract; can block urgent fixes | `@crynta` | **Pending** |
| **[A3]** | Rewrite `CODEOWNERS`; enable branch protection | Access-control change; affects who can merge | `@crynta` (repo admin) | **Pending** |
| **[A4]** | Mandatory PR checklist + 400 LOC size limit | Process change affecting every contributor | `@crynta` + team | **Pending** |
| **[A5]** | Add ESLint/Prettier, clippy `unwrap_used`, `cargo fmt --check` as **blocking** | Will fail CI on existing code until cleaned; may block releases | `@crynta` | **Pending** |
| **[A6]** | CI gate banning new `*.source.test.ts` | Rejects PRs on a naming rule | `@crynta` | **Pending** |
| **[A7]** | Delete dead module `src/modules/git/` (43 LOC, 0 importers) | **`AGENTS.md` Rule 1 — deletion requires express permission** | `@crynta` | **Pending** |
| **[A8]** | Delete or replace stale docs: `docs/ARCHITECTURE.md`, `docs/GLOSSARY.md`, `docs/TEST_MATRIX.md` | Deletion rule; also merge blocker B2 already asks for this | `@crynta` | **Pending** |
| **[A9]** | Delete grandfathered `*.source.test.ts` files opportunistically | Deletion rule; 289 files affected over time | `@crynta` | **Pending** |
| **[A10]** | Choose ESLint+Prettier vs. Biome | Toolchain lock-in; expensive to reverse | TBD (`@crynta`) | **Pending** |
| **[A11]** | Ratchet exception process (who can waive, for how long) | Defines the escape hatch; needs a named adjudicator | `@crynta` | **Pending** |
| **[A12]** | Reconcile `docs/CODEBASE_MAP.md`: stamp its snapshot SHA and correct its `orchestration` / working-tree figures | That doc is this plan's cited evidence base but was generated from the working tree; it currently contradicts the pinned baseline | `@crynta` | **Pending** |
| **[A13]** | Commit this plan (currently untracked) and pin a clean-tree SHA once **[A1]** resolves | Untracked file can be lost; also blocks re-pinning the baseline | `@crynta` | **Pending** |

**Recording an approval:** add the approver's verbatim instruction plus date to
the `## Decisions` section below, then flip Status to `Approved YYYY-MM-DD`.
Do not start the work before both are present.

---

## Risks And Recovery

| Risk | Mitigation | Recovery |
|---|---|---|
| Standards stall because they are "someone else's job" | Every item has a named role; roles default to `@crynta` only after explicit delegation | If a window slips twice, cut scope to the top 3 items of Part 0 |
| Lint on 72k LOC produces thousands of errors | Land warn-only first, fix by directory, then flip to blocking | `eslint-disable` file-level legacy baseline (`eslint.suppressions`) for old code; new code always clean |
| Coverage ratchet blocks urgent fixes | Ratchet compares per-file for changed files; hotfix path with explicit `Not-tested:` trailer | Lead can wave one PR with a written reason and a follow-up issue |
| Single reviewer becomes a harder bottleneck once gates add review work | Automate everything mechanical first (Part 0 items 2–5) so human review shrinks | Delegate CODEOWNERS by week 6 even if owners are junior — juniors can review with a checklist |
| Process overhead slows a shipping product | PR limit 400 LOC and async-first mentoring; no meeting-heavy ceremony | Measure cycle time; if median rises > 20%, drop Stage 3 before Stage 2 |
| AI-authored diffs sneak through as "reviewed" | Author must declare what they traced | Sample-audit 1 PR/week as a pair exercise |
| `AGENTS.md` forbids file deletion without permission | Orchestration and dead-code removals need explicit sign-off | Record the authorization text in the PR body before restoring or deleting |

## Decisions

- 2026-09-08: Chose **coverage ratchet over a global percentage target**. A
  72k LOC codebase where 58.0% of test files prove nothing about behavior
  would game any fixed
  target; a ratchet plus new-code rule improves monotonically and is
  enforceable immediately.
- 2026-09-08: Chose to **reuse** `MERGE_BLOCKERS.md` as the merge gate rather
  than create a new quality document. One gate, not two.
- 2026-09-08: Chose **ESLint + Prettier** over Biome (larger ecosystem, better
  React 19 and TypeScript 5.8 support today). Revisit if Biome matures.
- 2026-09-08: Sequencing puts **automated gates before human process** because
  `CODEOWNERS` currently names exactly one reviewer.
- 2026-09-08: **Corrected the test baseline.** An earlier draft reported
  "1.3% behavior tests", counting only the 6 files that render React. That
  conflated *executable* with *render*. All downstream targets restated against
  the §2.5.1 taxonomy. (Those figures were measured from the working tree; see
  the re-pin decision immediately below for the authoritative numbers.)
- 2026-09-08: **Split quality gates from capability work.** Gates (Parts 2–4,
  §6A) block merges; capability and mentoring (Parts 1, 5, §6B) never do.
  Rationale: the two have different owners, cadences, and failure modes, and
  mixing them leads either to unblockable builds or to fake compliance.
- 2026-09-08: **Structural guards do not count as coverage.** Only executable
  tests count toward coverage and the Definition of Done (§2.5.1, §4.2).
- 2026-09-08: **Re-pinned the entire baseline to commit `9f390ad83`.** The
  working tree changed twice during a single session (79D/54M → 93D/59M), so
  working-tree figures were never reproducible. Authoritative figures: 498 test
  files, 289 structural guards, 209 executable (42.0%), 218 Rust files,
  71,771 LOC frontend production. Command to reproduce is in Context. Any
  future update must re-pin to a new SHA, never re-measure the tree.
- 2026-09-08: **Coverage target is changed *executable lines*, not whole
  files.** A file-level "≥70%" is gamed by padding trivial files and punishes
  large type-heavy ones. Whole-file percentages remain only for the
  critical-path floors, where no carve-out applies (§4.2, §4.2.1).
- 2026-09-08: **Added 7 coverage carve-outs** (generated, config/wiring,
  contract-only, adapters/thin bridges, type-only, platform-gated, UI-layout)
  because a blanket rule produces coverage theater precisely where it is
  cheapest to fake. Carve-outs must be declared in the PR and confirmed by the
  reviewer; they never apply to `fs`, `shell`, `net*`, `secrets`, or the AI
  security path.
- 2026-09-08: **`docs/CODEBASE_MAP.md` is not authoritative for figures.** It
  was generated from the working tree; it now carries a snapshot banner
  pointing here. Reconciling it is **[A12]**.

## Progress

### Quality gates (blocking)

- [x] Full codebase read; Axis A baseline recorded (2026-09-08)
- [x] Test taxonomy defined; baseline corrected (2026-09-08)
- [x] **Baseline re-pinned to commit `9f390ad83`** with reproduction command
- [x] Coverage carve-outs defined; target changed to changed-executable-lines
- [x] Owners normalised to `@crynta` / `TBD`; approval register created
- [x] `CODEBASE_MAP.md` stamped with snapshot warning (reconcile = **[A12]**)
- [ ] **Commit this plan file — currently untracked** **[A13]**
- [ ] Confirm team size, seniority mix, and assign every `TBD` role
- [ ] Resolve the working-tree divergence from HEAD **[A1]**
- [ ] Publish Axis B (PR history) baseline
- [ ] ESLint + Prettier merged (warn-only) **[A5]**
- [ ] Coverage baseline published
- [ ] Ban new `*.source.test.ts` in CI **[A6]**
- [ ] jsdom + IME bridge tests (closes blocker B1)
- [ ] Review checklist in `.github/PULL_REQUEST_TEMPLATE.md` **[A4]**
- [ ] CODEOWNERS delegation + branch protection **[A3]**
- [ ] Coverage ratchet blocking **[A2]**

### Capability & mentoring (non-blocking)

- [ ] Level calibration 1:1s (Axis C + Axis D)
- [ ] Stage 1 foundations; one real row each in `docs/TEST_MATRIX.md` **[A8]**
- [ ] Stage 2 hard-seam track (6 modules)
- [ ] Pair programming and tech talk cadence running

## Validation

- Focused proof: each new automated check has a deliberately-failing fixture
  proving it actually blocks.
- Integration proof: CI green on a PR that violates each gate (must fail).
- Repository-required checks: `pnpm exec tsc --noEmit`, `pnpm test`,
  `pnpm build`, `cd src-tauri && cargo check --all-targets --locked`,
  `cargo clippy --all-targets --locked -- -D warnings`.
- Behavioral proof: median PR cycle time and escaped-defect rate trend down
  over two consecutive months.

## Result

Pending.
