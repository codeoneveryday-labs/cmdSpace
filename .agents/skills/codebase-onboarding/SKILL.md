---
name: codebase-onboarding
description: Use when analyzing an unfamiliar repository, joining a project, setting up Claude Code, generating an onboarding guide, or creating or enhancing a project CLAUDE.md.
metadata:
  origin: ECC
---

# Codebase Onboarding

Systematically analyze an unfamiliar codebase and produce a concise, evidence-based onboarding guide. Use this for developers joining a project or setting up Claude Code in an existing repository.

## When to Use

- First time opening a project with Claude Code
- Joining a new team or repository
- User asks to understand, learn, map, or onboard a codebase
- User asks to generate or update `CLAUDE.md`
- User says “onboard me” or “walk me through this repo”

## Phase 1: Reconnaissance

Gather raw signals without reading every file. Run independent checks in parallel:

1. **Package manifests** — detect `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `mix.exs`, or `pubspec.yaml`.
2. **Framework fingerprints** — detect framework config such as `next.config.*`, `nuxt.config.*`, `angular.json`, `vite.config.*`, Django settings, Flask app factories, FastAPI entrypoints, or Rails config.
3. **Entry points** — locate `main.*`, `index.*`, `app.*`, `server.*`, `cmd/`, and `src/main/`.
4. **Directory snapshot** — inspect the top two levels, excluding dependency, build, VCS, and cache directories.
5. **Tooling/config** — locate ESLint, Prettier, TypeScript, Make, Docker, Compose, CI workflows, environment examples, and test-runner configs.
6. **Tests** — locate `tests/`, `test/`, `__tests__/`, `*_test.go`, `*.spec.ts`, `*.test.js`, and runner configuration.

Prefer repository inspection tools such as Glob, Grep, and targeted Read. Do not read every file.

## Phase 2: Architecture Mapping

From the reconnaissance evidence, identify:

### Tech Stack

Record languages and version constraints, frameworks, major libraries, databases/ORMs, build tools, bundlers, and CI/CD platform. List only technologies that shape development or operation.

### Architecture Pattern

Classify the system as monolith, monorepo, microservices, serverless, frontend/backend split, or another evidence-backed shape. Identify API style when applicable: REST, GraphQL, gRPC, tRPC, or none.

### Key Directories

Map important directories to responsibilities, for example:

```text
src/components/ → UI components
src/api/        → API handlers
src/lib/        → shared utilities
src/db/         → persistence and models
tests/          → test suites
scripts/        → build and operational scripts
```

Only include directories confirmed by the repository.

### Data or Request Flow

Trace one real path from entry to result:

```text
entrypoint → validation/guards → business logic → persistence/external service → response or UI effect
```

For desktop or CLI applications, trace the equivalent operational path, such as UI action → IPC/command → native operation → event/result.

## Phase 3: Convention Detection

Identify existing conventions from code, tests, configuration, and history:

- **Naming:** file, component/class, function, and test naming patterns.
- **Code patterns:** error handling, dependency injection versus direct imports, state management, async patterns, and boundary conventions.
- **Testing:** runner, file placement, focused commands, integration boundaries, and coverage configuration if present.
- **Git:** branch naming, commit format, merge/PR workflow, and history depth. If history is unavailable or shallow, say so explicitly.

Do not turn a single example into a repository-wide rule. Mark uncertain findings as unknown.

## Phase 4: Generate Onboarding Artifacts

Produce the requested artifact(s). If the user asks to learn or understand the codebase, provide the onboarding guide in the response. If they ask for a project `CLAUDE.md`, write or update it only when authorized by the request.

### Output 1: Onboarding Guide

Use this structure and keep it scannable:

```markdown
# Onboarding Guide: [Project Name]

## Overview
[2–3 factual sentences]

## Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|

## Architecture
[Short description or diagram]

## Key Entry Points
- **[Area]**: `[path]` — [responsibility]

## Directory Map
[Important top-level and second-level directories]

## Request or Data Lifecycle
[One traced real path]

## Conventions
- [Verified convention]

## Common Tasks
- **[Task]**: `[verified command]`

## Where to Look
| I want to... | Look at... |
|--------------|------------|
```

### Output 2: Starter `CLAUDE.md`

If `CLAUDE.md` exists, read it first and preserve its project-specific instructions. Enhance it rather than replacing it, and clearly identify additions. Keep the result under 100 lines when possible.

```markdown
# Project Instructions

## Tech Stack
[Detected stack summary]

## Code Style
- [Detected naming and implementation patterns]

## Testing
- Run tests: `[verified command]`
- Test pattern: [verified convention]

## Build & Run
- Dev: `[verified command]`
- Build: `[verified command]`
- Lint: `[verified command or unknown]`

## Project Structure
[Key directory map]

## Conventions
- [Verified commit, PR, error-handling, or boundary convention]
```

## Evidence Rules

- Verify claims against repository sources; do not guess.
- Cite exact paths, and line ranges when useful.
- Distinguish **Authoritative** documentation from **Observed** code/configuration and **Derived** consequences.
- Mark unresolved questions as **Unknown** rather than inventing policy.
- Commands documented for CI, release, or containers do not automatically become local developer commands.
- Existing instructions, security boundaries, lifecycle rules, and source-of-truth declarations take precedence over generic examples.
- Do not copy the README; add structural insight from code and configuration.

## Best Practices

1. Do not read everything; use reconnaissance plus selective inspection.
2. Trust implementation over a stale framework/config signal.
3. Preserve existing `CLAUDE.md` instructions.
4. Keep the guide concise enough to scan in two minutes.
5. Flag unknowns explicitly.
6. Do not mutate the repository for an answer or report unless the user explicitly requests an artifact file.

## Common Mistakes

| Mistake | Correction |
|---|---|
| Listing every dependency | Highlight only architecture-shaping dependencies. |
| Treating directory names as proof | Confirm purpose from imports, entrypoints, and tests. |
| Inventing a request lifecycle for a non-web app | Trace the app’s actual UI, CLI, IPC, or worker path. |
| Replacing an existing `CLAUDE.md` | Merge additions and preserve existing rules. |
| Claiming a convention from one file | Require multiple supporting signals or mark it uncertain. |
| Adding unverified commands | Report the command as unknown until confirmed. |

## Anti-Patterns

- Do not generate a `CLAUDE.md` longer than 100 lines unless the repository genuinely requires it.
- Do not describe obvious directory names without evidence of their role.
- Do not claim databases, APIs, migrations, or deployment systems that were not found.
- Do not add project policy based only on this skill or the user’s example template.
