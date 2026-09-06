---
name: skill
description: "[OMX] Manage local skills - list, add, remove, search, edit, setup wizard"
argument-hint: "<command> [args]"
---

# Skill Management

Manage local `SKILL.md` files with `/skill` commands. Shared execution, delegation,
state, hook, team, cancellation, verification, and escalation invariants live in
`templates/AGENTS.md`; follow that contract instead of repeating it here.

<Purpose>
Create, inspect, validate, update, and organize user- or project-scoped skills.
Keep each skill specific, actionable, evidence-based, and useful to this codebase.
</Purpose>

<Use_When>
- The user asks to list, add, edit, remove, search, inspect, sync, set up, scan, or validate skills.
- A durable, codebase-specific solution or workflow should be captured as a skill.
</Use_When>

<Do_Not_Use_When>
- Use `/learner` to extract a skill from a conversation and `/note` for a short note.
- Do not use this prompt to change runtime code, catalogs, hooks, or installation logic.
</Do_Not_Use_When>

## Scopes and commands

Canonical roots are `${CODEX_HOME:-$HOME/.codex}/skills/` (user) and `.codex/skills/`
(project). A skill lives at `<root>/<name>/SKILL.md`.

| Command | Contract |
|---|---|
| `/skill list` | Scan both roots, parse frontmatter, and show name, description, triggers, scope, and quality/usage (`N/A` when unavailable). |
| `/skill add [name]` | Run the authoring wizard, validate the name, choose scope, create `SKILL.md`, and report its path. |
| `/skill edit <name>` | Find one scope, show metadata, then update description, triggers, argument hint, body, or rename and report the change. |
| `/skill remove <name>` | Find the skill, show scope and metadata, confirm explicitly, then remove its directory. |
| `/skill search <query>` | Case-insensitively search name, description, triggers, and body; rank name/trigger matches first and show context. |
| `/skill info <name>` | Show parsed metadata, scope, path, and full body; suggest `/skill search` when absent. |
| `/skill sync` | Compare user/project skills, show user-only/project-only/common entries, and confirm every copy or overwrite. |
| `/skill setup` | Ensure both roots exist, scan them, then offer add, list, pattern scan, import, or done. |
| `/skill scan` | Run setup's scan/inventory without its interactive menu. |
| `/skill validate` | Validate every skill in both roots and report each path's pass/fail result; never rewrite files. |

With an argument, use direct command mode; without one, use the guided setup menu.

## Authoring contract

Ask for any missing values:
1. `name`: lowercase letters/digits separated by single hyphens (`[a-z0-9]+(?:-[a-z0-9]+)*`).
2. `description`: a concise, non-empty one-line purpose.
3. `triggers`: comma-separated recognition terms.
4. `argument-hint`: optional invocation arguments.
5. `scope`: `user` or `project`.

Write this frontmatter at the start of every skill; optional metadata may add `id`,
`source`, and `quality` without replacing required fields:

```yaml
---
name: <name>
description: <one-line purpose>
triggers: [<trigger1>, <trigger2>]
argument-hint: "<args>"
# optional: id, source, quality
---
```

Use an actionable body. The minimum recommended shape is:

```markdown
# <Skill title>

## Purpose
What durable, codebase-specific outcome does this skill provide?

## When to Activate
Recognition signals, scope, and explicit non-goals.

## Workflow
1. Inspect the named files or inputs.
2. Apply the precise approach and record important assumptions.
3. Verify observable behavior and report evidence.

## Examples / Gotchas
Concrete invocation, edge cases, and failure recovery.
```

Prefer hard-won, non-obvious knowledge over generic programming advice. Include
exact paths, commands, error text, and expected evidence when they materially help.

## Validation and errors

Before reporting success, check that the file exists, starts with `---` frontmatter,
has non-empty `name` and `description`, uses a valid name, and has a non-empty body.
Reject malformed or unterminated YAML, multiline required scalar values, duplicate
names in one scope, missing directories/files, permission failures, and invalid
arguments. Report errors consistently:

```text
✗ Error: <clear message>
→ Suggestion: <specific next step>
```

## Exit contract

Every command ends with one concise result: `✓` plus the affected skill/path and
next action, or `✗` plus the error and suggestion. Preserve files on cancel or
validation-only runs. For add/edit/sync, report changed scope and metadata; for
list/search/info/scan/validate, report counts or matched paths and any failures.
