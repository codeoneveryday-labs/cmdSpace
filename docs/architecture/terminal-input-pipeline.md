# Terminal Input Pipeline

How keystrokes and paste flow from the webview into the PTY, and how the macOS
IME bridge keeps it correct. Read this before debugging any terminal input bug.

## The two input paths

There are **two** ways bytes reach the PTY, and mixing them up is the source of
most terminal-input bugs:

## Focus ownership and recovery

The active pane state and the browser's actual input focus are separate pieces
of state. A pane can still render a blinking xterm cursor while its hidden
helper textarea is not `document.activeElement`; in that state keyboard events
do not reach either input path.

Standard terminal focus is therefore restored at every renderer boundary:

- pane-body activation updates the active leaf and refocuses the hydrated
  `TerminalPane` on the next animation frame;
- renderer-slot unhide/rebind explicitly focuses the xterm helper textarea;
- returning to the app window refocuses the active visible session even when it
  already owns a renderer slot;
- pane-header buttons and drag handles are excluded from body focus capture so
  slash/permission controls and T/B actions retain their own focus behavior.

Canvas terminals keep their private xterm/PTY focus lifecycle and do not use the
standard renderer pool recovery path.

### Path A — xterm `onData` (control keys + everything xterm handles itself)

Control keys (Backspace/DEL, arrows, Enter, Ctrl+*, Escape) do **not** go
through the IME bridge. xterm's `_keyDown` → `evaluateKeyboardEvent` produces
the byte sequence and fires `term.onData`. The renderer pool's `onData` handler
(`rendererPool.ts`) then:

1. Strips OSC 10/11 color reports (they corrupt zsh history recall).
2. Drops printable single chars via `shouldIgnoreMacPrintableTerminalData`
   (length-1, >= 0x20, not DEL) — these are handled by the bridge instead.
3. Normalizes C1/NBSP on macOS, then calls `writeToPty`.

### Path B — the macOS IME bridge (`macImeBridge.ts`)

Printable characters (letters, spaces, IME composition) go through xterm's
hidden textarea. The bridge intercepts `input` events, diffs the textarea
against its stored `lastValue`, and writes the diff to the PTY:

```
keydown (printable, no modifiers)
  → attachCustomKeyEventHandler returns false   (shouldUseMacTextInputPath)
  → xterm does NOT fire onData
  → textarea.value updated by the browser
  → 'input' event → bridge writeDiff(lastValue, textarea.value)
  → backspaces (DEL) + appended text → writeToPty
```

## The diff algorithm (`writeDiff`)

```ts
const from = normalizeMacTerminalInput(fromValue); // stored lastValue
const to   = normalizeMacTerminalInput(textarea.value);
// common-prefix length over normalized strings
// backspaces = from.length - commonPrefixLen
// appendText = to.slice(commonPrefixLen)
// data = "\x7f".repeat(backspaces) + appendText
```

**Critical:** both sides MUST be normalized before the diff. WebKit stores an
intended space as C1 (0x80–0x9F) or NBSP (0xA0) in the textarea; if `lastValue`
holds a C1 space and the next keystroke is a real space, the raw diff sees a
mismatch at that position and emits a spurious DEL — deleting the previous
character (issue #81).

## macOS space corruption

WebKit's macOS text bridge can surface a space as any of:

| Code point | Name |
|---|---|
| U+0080–U+009F | C1 controls |
| U+00A0 | No-break space (NBSP) |
| U+2000–U+200A | Thin/medium/etc. spaces |
| U+202F | Narrow no-break space |
| U+2060 | Word joiner |
| U+3000 | Ideographic space |

`normalizeMacTerminalInput` collapses all of them into `" "`. The shell cannot
split on any of these, so an unnormalized one fuses two words into one token.

## Where bytes are written

Every write funnels through `writeToSessionPty` in `useTerminalSession.ts`
which also feeds `trackPromptInput` (the input buffer used to detect CLI
coding agents like `claude`, `codex`, `mcli`, ...).

## Debugging recipe

Terminal input bugs are invisible to the eye (C1/NBSP look like spaces). Log
with **hex dumps** at the PTY boundary:

```ts
const hex = Array.from(data).map(c => c.charCodeAt(0).toString(16).padStart(4, "0")).join(" ");
console.warn("[ime-debug]", JSON.stringify(data), "hex=", hex);
```

Never trust `JSON.stringify` alone — it renders C1/NBSP as plain spaces.

When the cursor is visible but typing is ignored, inspect focus separately from
pane state before investigating the PTY:

```ts
const textarea = terminal.textarea;
console.warn("[terminal-focus]", {
  paneFocused: session.focusedNow,
  textareaFocused: textarea?.ownerDocument.activeElement === textarea,
});
```

The slash/permission controls and T/B actions write through the existing
imperative terminal handle, so they can still work while the DOM keyboard path
is broken. That distinction rules out a dead PTY and points to focus ownership
or the xterm input bridge.

## Related

- `rendererPool.ts` — `attachCustomKeyEventHandler`, `onData`, pool lifecycle.
- `PaneTreeView.tsx` — pane activation and control-vs-body focus boundaries.
- `rendererSlotLifecycle.ts` — slot unhide/rebind focus restoration.
- `macImeBridge.ts` — `normalizeMacTerminalInput`, `writeDiff`, `lastValue`.
- `useTerminalSession.ts` — `writeToSessionPty`, `trackPromptInput`.
- `terminalSessionRuntime.ts` — visible-session wake/focus recovery.
- `CanvasTerminalNode.tsx` — canvas terminals own a private xterm + their own
  `attachMacImeBridge`; same normalization rules apply.
