# Conventional Commit Rules

Every commit in this repository must follow Conventional Commits.

## Required Format

```text
<type>(<optional-scope>): <imperative summary>

<optional body explaining why the change is needed>

<optional git trailers>
```

The subject line must be lowercase after the colon, use the imperative mood,
contain no trailing period, and stay under 72 characters when practical.

## Allowed Types

- `feat`: user-visible functionality
- `fix`: user-visible bug fix
- `refactor`: internal restructuring without behavior changes
- `perf`: measurable performance improvement
- `test`: tests only
- `docs`: documentation only
- `build`: build system or dependency changes
- `ci`: continuous integration changes
- `chore`: maintenance that does not fit another type
- `revert`: revert an earlier commit

Use `!` before the colon for a breaking change and add a `BREAKING CHANGE:`
trailer describing the migration.

## Project Requirements

1. Describe why the commit exists, not a file inventory.
2. Keep each commit focused on one coherent outcome.
3. Never use vague subjects such as `update`, `changes`, `fix stuff`, or `wip`.
4. Record verification with a `Tested:` trailer for substantive changes.
5. Add `Not-tested:` when relevant validation could not be performed.
6. Preserve useful decision trailers such as `Constraint:`, `Rejected:`,
   `Confidence:`, `Scope-risk:`, and `Directive:`.
7. Do not amend, force-push, or rewrite shared history unless explicitly asked.

## Examples

```text
feat(terminal): add configurable coding agent workspaces

Tested: pnpm vitest run; pnpm build
Confidence: high
Scope-risk: moderate
```

```text
fix(music): preserve subcommands after interrupted input

Rejected: Keep the zsh alias | aliases are parse-time and failed intermittently
Tested: Music CLI regression tests; cargo test; pnpm build
Confidence: high
Scope-risk: narrow
```
