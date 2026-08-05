# ADR 0003: macOS IME Bridge — Normalize Spaces at the Boundary

Status: accepted
Date: 2026-08-05

## Context

On macOS, WebKit's text bridge can surface an intended **space** as a C1
control (U+0080–U+009F) or a Unicode space lookalike (NBSP U+00A0, thin/medium
spaces, narrow NBSP, word joiner, ideographic space) in xterm's textarea. The
shell does not split on those, so typed words fuse into one token
(`git clone <url>` failed as `git: 'clone <url>' is not a git command`), and a
C1/NBSP space followed by a real space made the diff writer emit a spurious
DEL — deleting the character before the space (issues #79, #81).

## Decision

Normalize corrupted separators **at the IME boundary**, in
`src/modules/terminal/lib/macImeBridge.ts`:

- `normalizeMacTerminalInput` collapses C1 controls and every Unicode space
  lookalike into a regular space.
- `writeDiff` compares **both sides normalized** before computing the
  common-prefix diff, so a C1/NBSP space in the stored `lastValue` never diffs
  into a spurious DEL against a real space in the textarea.

The same bridge serves both the renderer pool and canvas terminals.

## Consequences

- Typed and pasted input both round-trip correctly on macOS.
- Shell history recall is no longer corrupted by OSC 10/11 color reports
  arriving on the input channel (stripped in `rendererPool.ts`).
- The textarea-diff heuristic is the most delicate code in the terminal
  subsystem; it should be hardened with DOM-level integration tests.

## Rejected Alternatives

- Special-casing individual CLIs (e.g. `mcli`) — rejected: masks a
  terminal-wide input corruption.
- Normalizing inside zsh/PTY init scripts — rejected: fix at the source
  boundary, not in every shell.

## Verification

- `macImeBridge.test.ts` covers C1 runs, NBSP, and C1-vs-regular-space equality.
- Manual macOS reproduction: `mcli␣⌫␣` yields `mcli `; typed `git clone <url>`
  runs.
- Regression history: #79 (paste C1), #81 (typed C1/NBSP + spurious DEL).
