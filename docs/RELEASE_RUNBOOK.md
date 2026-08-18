# Release Runbook

How a cmdSpace release ships. This runbook is the single source of truth for the
release flow; follow it in order. Every step below was executed for v0.7.55.

## Prerequisites

- `gh` CLI authenticated for `codeoneveryday-labs/cmdSpace`.
- Working tree clean (except intentional changes), on the default branch `main`.
- Read [`AGENT_GITHUB_DELIVERY.md`](AGENT_GITHUB_DELIVERY.md) and
  [`commit_conventional.md`](../commit_conventional.md).

## Version numbers

A release bumps exactly **4 version files**, all to the same version — plus the
root [`CHANGELOG.md`](../CHANGELOG.md) (see Step 3):

| File | Key |
|---|---|
| `package.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version = "..."` |
| `src-tauri/Cargo.lock` | `name = "cmdspace"` → `version = "..."` |
| `src-tauri/tauri.conf.json` | `"version"` |

`src-tauri/tauri.conf.test.ts` (Vitest) enforces that these stay in sync and
that the updater signing key is present — run it before pushing.

## Step 1 — Create the release issue

Mirror the existing pattern (e.g. #77, #83):

```bash
gh issue create --title "chore(release): publish vX.Y.Z" \
  --body "Publish vX.Y.Z with <one-line summary of what ships>.

Acceptance criteria:
- package, Tauri configuration, and Cargo metadata all report vX.Y.Z
- a vX.Y.Z tag triggers the release workflow"
```

## Step 2 — Create the release branch

Branch name must be `chore/<issue-number>-release-v0-7-XX`
(the pattern is `chore/NN-release-v0-7-XX`):

```bash
git checkout main && git pull origin main
git checkout -b chore/<N>-release-v0-7-XX
```

## Step 3 — Update the changelog

Update the root [`CHANGELOG.md`](../CHANGELOG.md) with an entry for the new
version, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the existing format (Added / Changed / Known limitations). Base it on the merged
PRs since the previous release. Keep entries factual and do not describe staged
or fallback-only integrations as fully supported.

The changelog entry MUST land in the same release commit as the version bump —
never stage a release that bumps version files without a matching
`CHANGELOG.md` entry.

## Step 4 — Bump the 4 version files

Edit each of the 4 files above from the current version to the next. Keep every
other line untouched. Verify:

```bash
grep -n '"version"' package.json src-tauri/tauri.conf.json
grep -n '^version' src-tauri/Cargo.toml
grep -A1 'name = "cmdspace"' src-tauri/Cargo.lock
```

All four must report the new version.

## Step 5 — Stage the 5 files and commit

Never `git add -A` — the worktree may contain unrelated changes.

```bash
git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json CHANGELOG.md
git commit -F - <<'EOF'
chore(release): publish vX.Y.Z

<one-line summary of what ships, referencing its PR(s)>

Closes #<release-issue-number>

Tested: pnpm vitest run src-tauri/tauri.conf.test.ts; pnpm build
Confidence: high
Scope-risk: narrow

Co-authored-by: CommandCodeBot <noreply@commandcode.ai>
EOF
```

## Step 6 — Verify before pushing

```bash
pnpm vitest run src-tauri/tauri.conf.test.ts   # version sync + signing key
pnpm build
cd src-tauri && cargo check --all-targets --locked
```

## Step 7 — Push, open PR, merge

```bash
git push -u origin chore/<N>-release-v0-7-XX
gh pr create --title "chore(release): publish vX.Y.Z" \
  --body "Closes #<release-issue-number>

## Summary
- bump cmdSpace release metadata to vX.Y.Z
- update CHANGELOG.md for vX.Y.Z
- ship <PR(s) it contains>

## Verification
- \`pnpm vitest run src-tauri/tauri.conf.test.ts\`
- \`pnpm build\`"
gh pr merge <PR-number> --merge
```

Merge auto-closes the release issue via `Closes #`.

## Step 8 — Tag and trigger the release workflow

```bash
git checkout main && git pull origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

The `v*` tag triggers `.github/workflows/release.yml`, which builds and uploads
installers for macOS (arm64 + x64, signed/notarized), Windows (NSIS + MSI), and
Linux (deb/rpm/AppImage), plus `latest.json` for auto-update.

## Step 9 — Confirm the release

```bash
gh run list --workflow release.yml --limit 3        # expect in_progress then success
gh run view <run-id> --json status,conclusion       # conclusion: "success"
gh release view vX.Y.Z --json tagName,name,assets   # assets present, draft: false
```

The 4 matrix jobs take roughly 10–12 minutes total.

## Rollback / hotfix notes

- A hotfix after release is a new `fix/...` PR followed by a new patch bump
  (vX.Y.(Z+1)) through the same flow — never amend or force-push a released tag.
- If the workflow fails, fix forward on a new commit; do not rewrite history.
