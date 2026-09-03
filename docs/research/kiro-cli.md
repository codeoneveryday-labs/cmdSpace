# Kiro CLI research

Research date: 2026-09-02

This note uses current first-party Kiro sources from `kiro.dev` and Kiro billing/docs pages. I avoided third-party summaries unless the official docs were missing a detail.

## Bottom line

Kiro CLI is the terminal surface of Kiro's agentic development environment. Kiro presents CLI as one of four main surfaces alongside IDE, Web, and Mobile, all backed by the same unified agent harness, with `.kiro` configuration intended to work across surfaces. Kiro CLI is positioned for terminal-based workflows, custom agents, and deployment pipelines. Sources: [Docs](https://kiro.dev/docs/), [CLI](https://kiro.dev/docs/cli/), [Web](https://kiro.dev/web/), [What's new in CLI 3.0](https://kiro.dev/docs/cli/v3/).

## Availability and installation

Kiro is available as a desktop IDE, a CLI, a web app, a mobile app, and Kiro Crew. The CLI supports macOS, Windows 11 (PowerShell), and Linux (glibc 2.34+ or musl variant). Kiro's install page says to download from `kiro.dev`, run the installer for your platform, sign in, optionally import VS Code settings, and then open a project folder to start. The CLI page also shows the current install command: `curl -fsSL https://cli.kiro.dev/install | bash`. Sources: [Installation](https://kiro.dev/docs/getting-started/installation/), [CLI](https://kiro.dev/docs/cli/), [Kiro homepage](https://kiro.dev/).

The docs also note that Web needs no local installation and that Kiro config is shared across surfaces. Sources: [Installation](https://kiro.dev/docs/getting-started/installation/), [Docs](https://kiro.dev/docs/).

## What Kiro CLI is for

The CLI is the terminal-based Kiro experience. The docs describe it as AI-assisted development in your terminal for building, testing, and deploying with natural-language commands and automated workflows. The CLI page highlights interactive chat, a rich terminal UI, headless mode for CI/CD, voice mode, and ACP support as CLI-specific capabilities. Sources: [CLI](https://kiro.dev/docs/cli/), [Terminal UI](https://kiro.dev/docs/cli/terminal-ui/), [Headless mode](https://kiro.dev/docs/cli/headless/), [ACP](https://kiro.dev/docs/cli/acp/).

## Major commands and workflows

The primary interactive entry point is `kiro-cli` or `kiro-cli chat`. Slash commands are only available in interactive chat mode. Current slash-command docs cover workflows like:

- `/help` for help and guidance
- `/context` for context-file management
- `/model` for switching models
- `/agent` for creating, editing, switching, and setting defaults for agents
- `/upgrade-agent` for migrating older agent configs
- `/spawn` for parallel agent sessions
- `/settings` for theme, keybindings, terminal input, display, and prompt-history options

Related feature docs cover voice mode, tangent side conversations, MCP, and spec workflows. Sources: [Slash commands](https://kiro.dev/docs/reference/slash-commands/), [CLI commands](https://kiro.dev/docs/reference/cli-commands/), [CLI 3.0 changelog](https://kiro.dev/changelog/cli/), [Headless mode](https://kiro.dev/docs/cli/headless/), [Specs](https://kiro.dev/docs/specs/).

Other important commands include:

- `kiro-cli login`, `logout`, and `whoami` for authentication lifecycle
- `kiro-cli settings` for reading and changing configuration
- `kiro-cli diagnostic` for environment and troubleshooting reports
- `kiro-cli inline` for inline suggestion controls
- `kiro-cli acp` for using Kiro as an Agent Client Protocol agent in other editors
- `kiro-cli crew` for the Crew companion surface

Sources: [CLI commands](https://kiro.dev/docs/reference/cli-commands/), [ACP](https://kiro.dev/docs/cli/acp/), [CLI](https://kiro.dev/docs/cli/).

Headless workflows are documented separately. In headless mode, you pass `--no-interactive` plus a prompt, and usually `--trust-all-tools` or `--trust-tools` for approval policy. `--require-mcp-startup` makes the command fail fast if configured MCP servers do not start. `--output-format stream-json` produces JSON Lines for scripting and CI, but it requires V2 or V3. Sources: [Headless mode](https://kiro.dev/docs/cli/headless/), [Exit codes](https://kiro.dev/docs/reference/exit-codes/).

## Spec-driven development

Kiro's specs are structured artifacts that formalize feature and bugfix development, turning high-level ideas into tracked implementation plans. The main documented flows are:

- Requirements-first feature specs, which generate `requirements.md`, then `design.md`, then `tasks.md`
- Design-first feature specs, which start from a design and then proceed into implementation planning
- Bugfix specs, which use the same three-phase workflow but emphasize root-cause analysis, fix design, and regression prevention
- Quick Spec, which collapses requirements, design, and tasks into one pass after clarifying questions
- Plan mode, which is a lighter planning workflow for tasks that are usually about 15-60 minutes of work

CLI 3.0 also says the Spec agent brings structured development to the terminal and that `/spec new <name>` starts the workflow. Sources: [Specs](https://kiro.dev/docs/specs/), [Requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first/), [Design-first](https://kiro.dev/docs/specs/feature-specs/tech-design-first/), [Bugfix Specs](https://kiro.dev/docs/specs/bugfix-specs/), [Quick Spec](https://kiro.dev/docs/specs/quick-spec/), [Plan mode](https://kiro.dev/docs/specs/plan/), [What's new in CLI 3.0](https://kiro.dev/docs/cli/v3/).

## Authentication

Interactive CLI sign-in supports Builder ID, Identity Center, and social login with Google or GitHub. `kiro-cli login` opens the browser flow locally; on SSH/remote terminals it uses device flow. `kiro-cli whoami` reports the current identity and auth status, and `kiro-cli logout` clears tokens, session credentials, and user profile information while preserving agent configs, saved conversations, settings, and MCP server configurations. Sources: [CLI commands](https://kiro.dev/docs/reference/cli-commands/), [Authentication](https://kiro.dev/docs/getting-started/authentication/).

API key auth is documented for CI/CD and automation. The key goes in `KIRO_API_KEY`, and the docs say browser session auth takes precedence over `KIRO_API_KEY`, which takes precedence over an unauthenticated prompt. API key auth supports non-interactive CLI features, while interactive sessions should use browser-based sign-in. Sources: [Authentication](https://kiro.dev/docs/getting-started/authentication/), [Headless mode](https://kiro.dev/docs/cli/headless/).

Enterprise/API-key governance is stricter: the docs say user-provided API keys are disabled by default and must be enabled by an administrator in the Kiro console. Sources: [API keys](https://kiro.dev/docs/enterprise/governance/api-keys/).

## Pricing, credits, quotas, and limits

The current public pricing page lists Free at 50 credits, Pro at 1,000 credits, Pro+ at 2,000 credits, Pro Max at 5,000 credits, and Power at 10,000 credits. The pricing page says the Free tier includes access to open-weight models and Claude Sonnet 4.5 with limits. Paid tiers can buy add-on credits. Sources: [Pricing](https://kiro.dev/pricing/), [Billing overview](https://kiro.dev/docs/billing/).

The billing docs say credits are consumed fractionally and can be charged to the second decimal point, so a task can consume as little as 0.01 credits. Simple prompts may cost less than 1 credit, while more complex tasks such as spec execution usually cost more. Sources: [Billing related questions](https://kiro.dev/docs/billing/related-questions/), [Billing overview](https://kiro.dev/docs/billing/).

Add-on credits are available only on paid tiers. They cost $0.04 per credit, with a minimum purchase of $5 (125 credits), a maximum pack size of $100, and a cap of five add-on packs at a time. Add-on credits expire 12 months after purchase, roll over until used or expired, and are consumed after plan credits. If plan credits and add-on credits are exhausted, Kiro pauses usage until more credits are purchased or the monthly cycle resets. Sources: [Usage beyond plan limits](https://kiro.dev/docs/billing/add-on-credits/).

The FAQ says usage limits reset at the start of each billing month and unused credits do not roll over for monthly plan credits. Sources: [FAQs](https://kiro.dev/faq/).

## IDE vs CLI relationship

Kiro's docs say the same unified harness powers IDE, CLI, Web, and Mobile, so `.kiro` configuration, specs, and steering can move across surfaces. CLI 3.0 specifically says it shares the same harness as Kiro IDE and Kiro Web. The CLI page describes CLI as the terminal surface while the web docs describe IDE as local development with real-time collaboration and CLI as terminal workflows, custom agents, and deployment pipelines. Sources: [Docs](https://kiro.dev/docs/), [What's new in CLI 3.0](https://kiro.dev/docs/cli/v3/), [Web](https://kiro.dev/web/), [CLI](https://kiro.dev/docs/cli/).

Powers and skills also flow across surfaces in v3. The docs say powers installed in the IDE are automatically detected by CLI sessions, and skills are available to CLI v3 as reusable instruction packages. Sources: [New features in 3.0](https://kiro.dev/docs/cli/v3/new-features/), [Powers](https://kiro.dev/docs/powers/), [Skills](https://kiro.dev/docs/skills/).

## Configuration files and layout

Kiro uses three configuration scopes: global in `~/.kiro/`, project in `<project-root>/.kiro/`, and agent in `~/.kiro/agents/` or `.kiro/agents/`. The configuration page lists concrete files for MCP servers, permissions, custom agents, steering, skills, hooks, powers, specs, and CLI settings. Sources: [Configuration scopes](https://kiro.dev/docs/configuration/).

Important file paths called out by the docs:

- `~/.kiro/settings/cli.json` and `.kiro/settings/cli.json` for CLI settings
- `~/.kiro/settings/mcp.json` and `.kiro/settings/mcp.json` for MCP servers
- `~/.kiro/settings/permissions.yaml` for global permissions
- `~/.kiro/agents/` and `.kiro/agents/` for agent configs
- `~/.kiro/steering/` and `.kiro/steering/` for steering files
- `~/.kiro/skills/` and `.kiro/skills/` for skills
- `~/.kiro/hooks/` and `.kiro/hooks/` for hooks
- `.kiro/specs/` for spec artifacts

Sources: [Configuration scopes](https://kiro.dev/docs/configuration/), [Steering](https://kiro.dev/docs/steering/), [Hooks](https://kiro.dev/docs/hooks/), [Skills](https://kiro.dev/docs/skills/).

Agent config format changed in IDE 1.0 / CLI 3.0. The current reference says `permissions` replaces `toolsSettings`, adds `excludedTools`, `includeMcpJson`, `includePowers`, `welcomeMessage`, and expanded `resources` support such as `skill://` and `knowledgeBase`. The agent config reference also documents `mcpServers` with command/args/env/timeout fields. Sources: [Agent configuration reference](https://kiro.dev/docs/custom-agents/configuration-reference/).

Hooks are standalone JSON files in `.kiro/hooks/<id>.json` with a versioned schema, trigger event, optional matcher, and action. The docs say hooks can run commands or agent prompts, and they activate automatically when a session starts. Sources: [Hooks](https://kiro.dev/docs/hooks/).

Steering files live under `.kiro/steering/` or `~/.kiro/steering/`, support workspace/global scope, include modes such as always/fileMatch/manual, and can be created as foundation files `product.md`, `tech.md`, and `structure.md`. Kiro also supports `AGENTS.md` as steering context and automatically picks it up from the workspace root or nested folders. Sources: [Steering](https://kiro.dev/docs/steering/), [CLI changelog](https://kiro.dev/changelog/cli/).

Skills are portable instruction packages following the Agent Skills standard. The docs say workspace skills live in `.kiro/skills/` and global skills in `~/.kiro/skills/`, and custom agents can include skills by adding `skill://` URIs to their `resources` field. Sources: [Skills](https://kiro.dev/docs/skills/), [New features in 3.0](https://kiro.dev/docs/cli/v3/new-features/).

## Compatibility with existing repos and terminal/editor agents

Kiro CLI is designed to work in an existing repository: the CLI docs show `cd my-project` followed by `kiro-cli`, and terminal UI sessions are scoped to the current working directory. Kiro also supports workspace steering, workspace skills, workspace hooks, and workspace agents, so the repo itself is the normal unit of configuration. Sources: [CLI](https://kiro.dev/docs/cli/), [Terminal UI](https://kiro.dev/docs/cli/terminal-ui/), [Configuration scopes](https://kiro.dev/docs/configuration/).

For editor interoperability, Kiro CLI implements the Agent Client Protocol (ACP) and can be run as an ACP agent in JetBrains IDEs, Zed, and any other ACP-compatible editor by spawning `kiro-cli acp` over stdio. Sources: [ACP](https://kiro.dev/docs/cli/acp/).

Kiro also explicitly supports existing repo conventions through `AGENTS.md` steering support. The steering docs say `AGENTS.md` files are always included and can live at the workspace root or inside subdirectories. Sources: [Steering](https://kiro.dev/docs/steering/), [CLI changelog](https://kiro.dev/changelog/cli/).

### Compatibility notes

- Agent creation and editing are available in local V3 sessions, but cloud sessions do not support those operations. Source: [Slash commands](https://kiro.dev/docs/reference/slash-commands/).
- CLI 3.0 does not run on Amazon Linux 2. Source: [What's new in CLI 3.0](https://kiro.dev/docs/cli/v3/).
- The classic non-TUI mode does not support the v3 engine. Source: [What's new in CLI 3.0](https://kiro.dev/docs/cli/v3/).

## Caveats and unknowns

There is one notable doc inconsistency: the terminal UI comparison page still says `/tangent` is not yet available in the terminal UI, while the slash-command reference documents `/tangent` and the CLI changelog says tangent side conversations shipped in CLI 2.16.0 and are part of CLI 3.0. I would treat the comparison page as stale or mode-specific until verified in the running CLI. Sources: [Terminal UI vs classic](https://kiro.dev/docs/cli/terminal-ui/comparison/), [Slash commands](https://kiro.dev/docs/reference/slash-commands/), [CLI changelog](https://kiro.dev/changelog/cli/).

Pricing and credit counts are live-doc values, not fixed guarantees. The pricing page and billing docs should be treated as the authoritative current source for plan names, quotas, and add-on-credit rules. Sources: [Pricing](https://kiro.dev/pricing/), [Billing overview](https://kiro.dev/docs/billing/).

Some features are surface-limited even when they exist elsewhere: for example, interactive slash commands require interactive chat mode, and several agent/config operations are not available in cloud sessions. Sources: [Slash commands](https://kiro.dev/docs/reference/slash-commands/), [Terminal UI vs classic](https://kiro.dev/docs/cli/terminal-ui/comparison/), [Headless mode](https://kiro.dev/docs/cli/headless/).

## Short take

If you need the practical summary: Kiro CLI is the terminal-facing, first-party Kiro surface for interactive chat, spec-driven workflows, headless CI/CD use, ACP editor integration, and repo-local agent/steering/hooks configuration. It is version-sensitive: CLI 3.0 is the current config model, but some docs still mix legacy and current behavior, so feature availability should be checked against the specific surface and mode you plan to use. Sources: [CLI](https://kiro.dev/docs/cli/), [What's new in CLI 3.0](https://kiro.dev/docs/cli/v3/), [Configuration scopes](https://kiro.dev/docs/configuration/).
