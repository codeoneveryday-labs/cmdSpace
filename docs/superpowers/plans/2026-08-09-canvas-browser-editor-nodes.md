# Canvas Browser and Editor Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live Browser and Editor nodes as first-class peers of Terminal on Architecture Canvas and ship them in cmdSpace v0.7.80.

**Architecture:** Extend the canvas diagram metadata with `browser` and `editor` node kinds, then render focused adapters that reuse `SidebarBrowserPane` and `EditorPane`. `ArchitectureCanvas` continues owning geometry, history, selection, and SQLite-backed diagram persistence; terminal docking and PTY lifecycle remain isolated.

**Tech Stack:** React 19, TypeScript, CodeMirror 6, Tauri 2 child webviews, Vitest, Tailwind CSS v4, GitHub Actions release workflow.

---

### Task 1: Extend canvas metadata and geometry rules

**Files:**
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Test: `src/modules/architecture/canvasWorkspacePersistence.test.ts`
- Test: `src/modules/architecture/ArchitectureCanvas.docking.source.test.ts`

- [x] **Step 1: Write failing metadata and source-contract tests**

Add restored diagrams containing:

```ts
{ id: "browser-1", kind: "browser", url: "https://example.com", ...bounds }
{ id: "editor-1", kind: "editor", path: "/tmp/example.ts", ...bounds }
```

Assert round-trip persistence retains `url` and `path`, both kinds are resizable,
and only terminal nodes enter terminal docking calculations.

- [x] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/modules/architecture/canvasWorkspacePersistence.test.ts src/modules/architecture/ArchitectureCanvas.docking.source.test.ts
```

Expected: failure because Browser/Editor canvas types and interactive geometry rules do not exist.

- [x] **Step 3: Add minimal diagram fields and node-kind rules**

Extend `ArchitectureShapeKind` with `browser | editor`, add optional `url` and
`path`, introduce 720×480 defaults and 400×300 minimums, include both kinds in
rectangular resize/frame behavior, and explicitly exclude them from terminal
docking and PTY navigation.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

### Task 2: Add a reusable canvas Browser adapter

**Files:**
- Create: `src/modules/architecture/CanvasBrowserNode.tsx`
- Modify: `src/modules/preview/SidebarBrowserPane.tsx`
- Modify: `src/modules/preview/index.ts`
- Test: `src/modules/architecture/CanvasBrowserNode.test.tsx`
- Test: `src/modules/preview/SidebarBrowserPane.test.ts`

- [x] **Step 1: Write failing Browser lifecycle tests**

Render the adapter with an empty URL, submit `example.com`, and assert
`onUrlChange("https://example.com")`. Add a source contract asserting the
browser exposes an interaction-blocked input and closes its child webview on
unmount.

- [x] **Step 2: Run Browser tests and verify RED**

```bash
pnpm vitest run src/modules/architecture/CanvasBrowserNode.test.tsx src/modules/preview/SidebarBrowserPane.test.ts
```

Expected: failure because `CanvasBrowserNode` and the canvas visibility contract are absent.

- [x] **Step 3: Implement the minimal adapter**

Export URL normalization as a shared helper, add an optional
`interactionBlocked` prop to `SidebarBrowserPane`, and create
`CanvasBrowserNode` with:

```tsx
<SidebarBrowserPane
  url={url}
  visible={active}
  resizing={interactionBlocked}
  onUrlChange={onUrlChange}
/>
```

Keep native bounds driven by the existing DOM measurement path and preserve the
sandboxed iframe fallback.

- [x] **Step 4: Run Browser tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

### Task 3: Add a reusable canvas Editor adapter

**Files:**
- Create: `src/modules/architecture/CanvasEditorNode.tsx`
- Modify: `src/modules/editor/EditorPane.tsx`
- Modify: `src/modules/editor/index.ts`
- Test: `src/modules/architecture/CanvasEditorNode.test.tsx`

- [x] **Step 1: Write failing Editor tests**

Test the empty state, file-picker callback, basename title, dirty indicator, and
path propagation without mocking document read/write behavior beyond the native
dialog boundary.

- [x] **Step 2: Run Editor tests and verify RED**

```bash
pnpm vitest run src/modules/architecture/CanvasEditorNode.test.tsx
```

Expected: failure because `CanvasEditorNode` does not exist.

- [x] **Step 3: Implement the minimal adapter**

Use an inline path entry so the feature reuses the existing document bridge
without adding a new dependency. Render a labeled empty state when `path` is
absent and otherwise render:

```tsx
<EditorPane
  ref={editorRef}
  path={path}
  onDirtyChange={setDirty}
  onSaved={() => setDirty(false)}
/>
```

The adapter emits path/title changes to the diagram owner and uses the existing
`EditorPane` save shortcut and Rust document bridge.

- [x] **Step 4: Run Editor tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

### Task 4: Wire toolbar creation, rendering, and canvas interactions

**Files:**
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/index.ts`
- Test: `src/modules/architecture/ArchitectureCanvas.render.test.tsx`
- Test: `src/modules/architecture/ArchitectureCanvas.docking.source.test.ts`

- [x] **Step 1: Write failing toolbar/render tests**

Assert the toolbar exposes accessible `Add browser` and `Add editor` buttons,
clicking creates the corresponding node, restored metadata reaches each adapter,
interactive content stops pointer propagation, and terminal docking stays scoped
to terminal nodes.

- [x] **Step 2: Run canvas tests and verify RED**

```bash
pnpm vitest run src/modules/architecture/ArchitectureCanvas.render.test.tsx src/modules/architecture/ArchitectureCanvas.docking.source.test.ts
```

Expected: failure because toolbar controls and adapter rendering are absent.

- [x] **Step 3: Implement canvas wiring**

Add Globe and Document icons after Terminal. A click calls one shared rectangular
placement helper near active content, commits history, selects the new node, and
returns to select mode. Render Browser/Editor in the transformed HTML world with
the same geometry as terminal nodes, but without terminal docking. Update node
metadata through immutable `setNodes` callbacks so `onDiagramChange` persists it.

- [x] **Step 4: Run canvas tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

### Task 5: Document and verify the feature

**Files:**
- Create: `CHANGELOG.md`
- Modify: focused tests only if verification exposes a regression

- [x] **Step 1: Add release changelog**

Use Keep a Changelog headings with `[Unreleased]` and `[0.7.80] - 2026-08-09`.
Under Added, document live Browser and Editor nodes on Architecture Canvas.

- [x] **Step 2: Run focused and complete frontend proof**

```bash
pnpm vitest run src/modules/architecture src/modules/preview/SidebarBrowserPane.test.ts
pnpm test
pnpm build
```

Expected: all tests pass and Vite production build exits 0.

- [x] **Step 3: Run native release proof**

```bash
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
```

Expected: both commands exit 0 without warnings.

- [x] **Step 4: Review the scoped diff**

Run `git diff --check`, inspect `git status --short`, and stage only issue #199
files. Preserve all pre-existing `.commandcode`, `paseo.json`, plan/spec files,
and the modified Cate skill file.

### Task 6: Deliver feature PR and release v0.7.80

**Files:**
- Modify in release branch only: `package.json`
- Modify in release branch only: `src-tauri/Cargo.toml`
- Modify in release branch only: `src-tauri/Cargo.lock`
- Modify in release branch only: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Commit, push, and open feature PR**

Commit issue #199 changes using the Lore/Conventional format, push
`feat/199-canvas-browser-editor-nodes`, and create a ready PR whose body starts
with `Closes #199` and records exact verification.

- [ ] **Step 2: Merge feature PR after checks pass**

Use a normal merge commit. Pull updated `main` without rewriting history.

- [ ] **Step 3: Create v0.7.80 release issue and branch**

Create `chore(release): publish v0.7.80`, branch
`chore/<issue>-release-v0-7-80`, and bump exactly the four runbook files.

- [ ] **Step 4: Verify, deliver, and merge release PR**

Run `pnpm vitest run src-tauri/tauri.conf.test.ts`, `pnpm build`, and
`cargo check --all-targets --locked`; then push, open the release PR, and merge.

- [ ] **Step 5: Tag and verify installers**

Tag merged `main` as `v0.7.80`, push the tag, wait for all release matrix jobs,
and verify the non-draft GitHub release includes `latest.json` plus macOS,
Windows, and Linux installers.
