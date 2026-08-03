# GitHub delivery rules for agents

Apply this workflow whenever a task will be delivered through a GitHub branch,
commit, issue, or pull request.

## 1. Create or identify the issue

- Use an existing relevant issue, or create one before implementation.
- The issue must state user impact, root cause or requested outcome, scope, and
  acceptance criteria.
- Do not create public issues for security vulnerabilities; follow
  `SECURITY.md` instead.

## 2. Create a conventional issue branch

- Branch from the current remote default branch unless the task explicitly
  continues an existing issue branch.
- Name the branch exactly as `type/<issue-number>-short-kebab-case-slug`.
- Allowed `type` values are: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`,
  `build`, `ci`, `chore`, and `revert`.
- Use the numeric issue number without the `#` character. For example:
  `fix/22-macos-microphone-entitlement`.
- Never use generic or agent-branded branch names such as `codex/foo`,
  `wip`, `update`, or `misc`.

## 3. Keep the change scoped

- Inspect the worktree before staging.
- Stage only files that belong to the issue. Never use `git add -A` when the
  worktree contains unrelated changes.
- Do not amend, force-push, rebase, or rewrite shared history unless the user
  explicitly asks.

## 4. Commit and verify

- Follow `commit_conventional.md` for every commit, including the required
  decision and validation trailers.
- Run the focused tests and relevant build checks before pushing.
- Do not claim the issue is fixed until verification output supports that claim.

## 5. Open a reviewable pull request

- Push the issue branch and open a pull request against the default branch.
- Use a Conventional Commit-style PR title.
- Start the PR body with `Closes #<issue-number>` so GitHub closes the issue on
  merge.
- Describe the user impact, root cause, implementation, validation, and any
  remaining release or manual-verification risk.
- Leave the PR ready for the user to review and merge. Do not merge it unless
  the user explicitly asks.
