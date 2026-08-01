# Remote Finder Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clipped remote path-selection card with a compact Finder-style browser whose list scrolls correctly on mobile.

**Architecture:** Keep the existing authenticated `/api/remote/folders` data flow and selection callback. Reshape only the remote React view into a viewport-constrained header/list/footer grid; the list becomes the single touch-scroll owner so the desktop-wide `body { overflow: hidden; }` rule remains untouched.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest source-contract tests, Vite.

---

### Task 1: Lock the mobile scroll and path-selection contract

**Files:**
- Modify: `src/remote/RemoteApp.source.test.ts`
- Test: `src/remote/RemoteApp.source.test.ts`

- [ ] **Step 1: Write the failing regression test**

Add assertions to the existing picker test:

```ts
expect(source).toContain("remote-folder-picker grid h-dvh min-h-0");
expect(source).toContain("remote-folder-picker-scroll min-h-0 overflow-y-auto");
expect(source).toContain("Open current folder");
expect(source).not.toContain("Choose a file or folder");
expect(source).not.toContain("mx-auto mb-5 grid size-20");
```

Keep the existing assertions for `load(folder.path)`, `onSelect(file.parent)`, `AbortController`, and request cancellation.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test -- src/remote/RemoteApp.source.test.ts
```

Expected: FAIL because the picker still uses a growing `min-h-dvh overflow-y-auto` card and still renders the oversized heading/icon.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add src/remote/RemoteApp.source.test.ts
git commit -m "Prevent remote path picker from regressing to clipped page scroll"
```

### Task 2: Replace the card with a Finder-style viewport

**Files:**
- Modify: `src/remote/RemoteApp.tsx:753-894`
- Modify: `src/remote/remote.css:1-6`
- Test: `src/remote/RemoteApp.source.test.ts`

- [ ] **Step 1: Add a current-folder label helper**

Place this pure helper next to the remote folder types:

```ts
function remoteFolderName(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  return normalized.split("/").filter(Boolean).at(-1) ?? path;
}
```

- [ ] **Step 2: Constrain the picker to the visual viewport**

Replace the card wrapper with this three-row shell:

```tsx
<main className="remote-folder-picker grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#101116] text-white">
  <header className="border-b border-white/10 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
    {/* parent navigation, current folder name, and truncated full path */}
  </header>
  <section className="remote-folder-picker-scroll min-h-0 overflow-y-auto px-3 py-2">
    {/* loading/error/empty state plus compact folder and file rows */}
  </section>
  <footer className="border-t border-white/10 bg-[#15161b]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
    {/* selected path and Open current folder button */}
  </footer>
</main>
```

The header Back button calls `load(folderState.parent)` only when a parent exists. The footer button calls `onSelect(folderState.current)`. Folder rows retain `load(folder.path)`, and file rows retain `onSelect(file.parent)`.

- [ ] **Step 3: Make rows compact and touch-safe**

Use one border-separated list surface rather than individual cards:

```tsx
className="flex min-h-12 w-full items-center gap-3 border-b border-white/[0.07] px-3 py-2.5 text-left transition last:border-b-0 active:bg-white/[0.08]"
```

Folder rows show the folder icon, name, and chevron. File rows show the file icon, name, and `Containing folder` as secondary text. Remove the command icon, explanatory hero copy, card shadow, and per-row rounded cards.

- [ ] **Step 4: Assign touch scrolling to the list only**

Replace the existing picker CSS with:

```css
.remote-folder-picker-scroll {
  touch-action: pan-y;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
pnpm test -- src/remote/RemoteApp.source.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/remote/RemoteApp.tsx src/remote/remote.css
git commit -m "Make remote path selection feel native on mobile"
```

### Task 3: Verify the remote UI remains buildable

**Files:**
- Verify: `src/remote/RemoteApp.tsx`
- Verify: `src/remote/remote.css`
- Verify: `src/remote/RemoteApp.source.test.ts`

- [ ] **Step 1: Run the complete frontend test suite**

```bash
pnpm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run typecheck and production build**

```bash
pnpm build
```

Expected: TypeScript compilation and Vite production build both exit successfully.

- [ ] **Step 3: Inspect the responsive layout**

At an Android-sized viewport, verify that the top and bottom bars remain visible while a long home-directory listing scrolls under the finger. At desktop width, verify that the list remains centered/readable and does not stretch row text beyond a comfortable width.

- [ ] **Step 4: Commit any verification-only correction**

Only if validation required a correction:

```bash
git add src/remote/RemoteApp.tsx src/remote/remote.css src/remote/RemoteApp.source.test.ts
git commit -m "Polish remote Finder picker after responsive verification"
```
