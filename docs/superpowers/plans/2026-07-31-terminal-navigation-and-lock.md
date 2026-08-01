# Shared Terminal Navigation and Canvas Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Canvas and Cmd+I terminals the standard directory/branch picker and a Cate-style canvas-layout lock.

**Architecture:** Extract the existing directory and Git branch switching UI from `FloatingTerminalOverlay` into one terminal-header component. Each caller supplies its current CWD and a callback that writes a command into its own PTY. Canvas lock reuses the persisted `ArchitectureNode.locked` field; it does not change terminal stdin.

**Tech Stack:** React 19, TypeScript, Tauri invoke, xterm.js, Vitest, Tailwind.

---

### Task 1: Establish shared header-control proof

**Files:**

- Create: `src/modules/terminal/TerminalNavigationControls.tsx`
- Create: `src/modules/terminal/TerminalNavigationControls.source.test.ts`
- Modify: `src/modules/terminal/PaneTreeView.test.ts`

- [x] **Step 1: Write the failing source test**

```ts
expect(source).toContain('invoke<string[]>("list_subdirs"');
expect(source).toContain("native.gitResolveRepo(cwd)");
expect(source).toContain("wouldCheckoutReloadDevApp");
expect(source).toContain("emitGitRepoChanged(repoRoot)");
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/modules/terminal/TerminalNavigationControls.source.test.ts`

Expected: FAIL because the shared control does not exist.

- [ ] **Step 3: Extract the minimal shared control**

```tsx
<TerminalNavigationControls
  cwd={cwd}
  onChangeDirectory={(path) => onCd(path)}
/>
```

The control owns only folder/branch popovers and the existing git refresh
logic. Callers retain focus and PTY ownership.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run src/modules/terminal/TerminalNavigationControls.source.test.ts src/modules/terminal/PaneTreeView.test.ts`

Expected: PASS.

### Task 2: Wire both isolated terminal surfaces

**Files:**

- Modify: `src/modules/architecture/CanvasTerminalNode.tsx`
- Modify: `src/modules/terminal/BottomTerminalDrawer.tsx`
- Modify: `src/modules/architecture/CanvasTerminalNode.source.test.ts`
- Modify: `src/modules/terminal/BottomTerminalDrawer.source.test.ts`

- [x] **Step 1: Write failing source assertions**

```ts
expect(source).toContain("TerminalNavigationControls");
expect(source).toContain("cd ${shellQuote(path)}\\r");
```

- [x] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run src/modules/architecture/CanvasTerminalNode.source.test.ts src/modules/terminal/BottomTerminalDrawer.source.test.ts`

Expected: FAIL because the controls are absent.

- [ ] **Step 3: Add callback wiring**

```ts
const changeDirectory = (path: string) =>
  void sessionRef.current?.write(`cd ${shellQuote(path)}\r`);
```

Render the shared controls in each terminal header and preserve their existing
pointer propagation boundaries.

- [x] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run src/modules/architecture/CanvasTerminalNode.source.test.ts src/modules/terminal/BottomTerminalDrawer.source.test.ts`

Expected: PASS.

### Task 3: Add the Cate-style Canvas lock button

**Files:**

- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/CanvasTerminalNode.tsx`
- Modify: `src/modules/architecture/CanvasTerminalNode.source.test.ts`
- Modify: `src/modules/architecture/ArchitectureCanvas.docking.source.test.ts`

- [x] **Step 1: Write failing source assertions**

```ts
expect(source).toContain("locked: boolean");
expect(source).toContain("onToggleLock");
expect(source).toContain('aria-label={locked ? "Unlock terminal" : "Lock terminal"}');
```

- [x] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run src/modules/architecture/CanvasTerminalNode.source.test.ts src/modules/architecture/ArchitectureCanvas.docking.source.test.ts`

Expected: FAIL because terminal headers do not expose the lock action.

- [x] **Step 3: Reuse the existing node lock state**

```ts
onToggleLock={() =>
  setNodes((current) => current.map((item) =>
    item.id === node.id ? { ...item, locked: !item.locked } : item,
  ))
}
```

Render a LockOpen/Lock icon before maximize. The action pushes history and
keeps stdin enabled, matching Cate's pin behavior.

- [x] **Step 4: Run all focused tests and build**

Run: `pnpm vitest run src/modules/terminal/TerminalNavigationControls.source.test.ts src/modules/terminal/PaneTreeView.test.ts src/modules/terminal/BottomTerminalDrawer.source.test.ts src/modules/architecture/CanvasTerminalNode.source.test.ts src/modules/architecture/ArchitectureCanvas.docking.source.test.ts && pnpm build && git diff --check`

Expected: PASS with no TypeScript, bundle, or whitespace errors.
