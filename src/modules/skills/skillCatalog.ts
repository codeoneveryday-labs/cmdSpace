export const SKILL_CATEGORIES = [
  "All",
  "Lifestyle Services",
  "Development Tools",
  "Investment & Finance",
  "Content Creation",
  "Data Analysis",
  "Productivity Tools",
  "Collaboration",
  "Business Operations",
  "Knowledge & Learning",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export type SkillCatalogTab = "recommended" | "plugins";
export type SkillCatalogKind = "skill" | "plugin";
export type SkillIconName =
  | "book"
  | "code"
  | "document"
  | "group"
  | "palette"
  | "search"
  | "spark"
  | "table";

export type SkillCatalogEntry = {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  category: Exclude<SkillCategory, "All">;
  kind: SkillCatalogKind;
  icon: SkillIconName;
  iconTone: string;
  featured?: boolean;
  deprecated?: boolean;
};

export const SKILL_CATALOG: readonly SkillCatalogEntry[] = [
  {
    id: "obra-superpowers",
    name: "Superpowers",
    description: "Composable coding-agent skills for planning, implementation, testing, and review.",
    repositoryUrl: "https://github.com/obra/superpowers",
    category: "Development Tools",
    kind: "skill",
    icon: "spark",
    iconTone: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    featured: true,
  },
  {
    id: "mattpocock-skills",
    name: "Skills for Real Engineers",
    description: "Practical engineering skills built from a working .agents directory.",
    repositoryUrl: "https://github.com/mattpocock/skills",
    category: "Development Tools",
    kind: "skill",
    icon: "code",
    iconTone: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    featured: true,
  },
  {
    id: "anthropics-skills",
    name: "Anthropic Agent Skills",
    description: "Official examples and specification material for reusable Agent Skills.",
    repositoryUrl: "https://github.com/anthropics/skills",
    category: "Knowledge & Learning",
    kind: "skill",
    icon: "book",
    iconTone: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  {
    id: "ui-ux-pro-max-skill",
    name: "UI/UX Pro Max",
    description: "Design intelligence for building polished UI/UX across multiple platforms.",
    repositoryUrl: "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill",
    category: "Development Tools",
    kind: "skill",
    icon: "palette",
    iconTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  {
    id: "addyosmani-agent-skills",
    name: "Addy Osmani Agent Skills",
    description: "Production engineering workflows, quality gates, and best practices for coding agents.",
    repositoryUrl: "https://github.com/addyosmani/agent-skills",
    category: "Development Tools",
    kind: "skill",
    icon: "group",
    iconTone: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  },
  {
    id: "composio-awesome-claude-skills",
    name: "Awesome Claude Skills",
    description: "Curated Claude skills, resources, and tools for extending AI workflows.",
    repositoryUrl: "https://github.com/ComposioHQ/awesome-claude-skills",
    category: "Knowledge & Learning",
    kind: "skill",
    icon: "book",
    iconTone: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  },
  {
    id: "sickn33-agentic-awesome-skills",
    name: "Agentic Awesome Skills",
    description: "A local catalog and planning control plane for discovering and validating a large library of agentic skills.",
    repositoryUrl: "https://github.com/sickn33/agentic-awesome-skills",
    category: "Development Tools",
    kind: "skill",
    icon: "spark",
    iconTone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  },
  {
    id: "kdense-scientific-agent-skills",
    name: "Scientific Agent Skills",
    description: "Scientific research skills and database workflows for biology, chemistry, medicine, and drug discovery.",
    repositoryUrl: "https://github.com/K-Dense-AI/scientific-agent-skills",
    category: "Data Analysis",
    kind: "skill",
    icon: "table",
    iconTone: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  },
  {
    id: "blader-humanizer",
    name: "Humanizer",
    description: "Rewrite AI-generated prose so it reads more natural and human.",
    repositoryUrl: "https://github.com/blader/humanizer",
    category: "Content Creation",
    kind: "skill",
    icon: "document",
    iconTone: "bg-pink-500/15 text-pink-600 dark:text-pink-300",
  },
  {
    id: "voltagent-awesome-agent-skills",
    name: "Awesome Agent Skills",
    description: "Curated agent skills from official teams and community maintainers.",
    repositoryUrl: "https://github.com/VoltAgent/awesome-agent-skills",
    category: "Development Tools",
    kind: "skill",
    icon: "group",
    iconTone: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  },
  {
    id: "davila7-claude-code-templates",
    name: "Claude Code Templates",
    description: "CLI tooling for configuring and monitoring Claude Code.",
    repositoryUrl: "https://github.com/davila7/claude-code-templates",
    category: "Development Tools",
    kind: "skill",
    icon: "document",
    iconTone: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
  },
  {
    id: "mvanhorn-last30days-skill",
    name: "Last 30 Days",
    description: "Research topics across Reddit, X, YouTube, Hacker News, Polymarket, and the web, then synthesize a grounded brief.",
    repositoryUrl: "https://github.com/mvanhorn/last30days-skill",
    category: "Knowledge & Learning",
    kind: "skill",
    icon: "search",
    iconTone: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  },
  {
    id: "agentskills-specification",
    name: "Agent Skills Specification",
    description: "Open specification and documentation for portable Agent Skills.",
    repositoryUrl: "https://github.com/agentskills/agentskills",
    category: "Knowledge & Learning",
    kind: "skill",
    icon: "document",
    iconTone: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
  {
    id: "openai-plugin",
    name: "OpenAI Plugin (Deprecated)",
    description: "Deprecated Codex plugin catalog retained as historical reference.",
    repositoryUrl: "https://github.com/openai/plugin",
    category: "Development Tools",
    kind: "skill",
    icon: "code",
    iconTone: "bg-red-500/15 text-red-600 dark:text-red-300",
    deprecated: true,
  },
  {
    id: "leonxlnx-taste-skill",
    name: "Taste-Skill",
    description: "Improve AI-generated interfaces and copy by steering away from generic, boring output.",
    repositoryUrl: "https://github.com/Leonxlnx/taste-skill",
    category: "Content Creation",
    kind: "skill",
    icon: "palette",
    iconTone: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  },
  {
    id: "zarazhangrui-frontend-slides",
    name: "Frontend Slides",
    description: "Create polished HTML presentations with a coding agent's frontend skills.",
    repositoryUrl: "https://github.com/zarazhangrui/frontend-slides",
    category: "Content Creation",
    kind: "skill",
    icon: "document",
    iconTone: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-300",
  },
  {
    id: "orchestra-ai-research-skills",
    name: "AI Research Skills",
    description: "Open-source AI research and engineering workflows for coding agents.",
    repositoryUrl: "https://github.com/Orchestra-Research/AI-Research-SKILLs",
    category: "Knowledge & Learning",
    kind: "skill",
    icon: "book",
    iconTone: "bg-green-500/15 text-green-600 dark:text-green-300",
  },
] as const;

export function getFeaturedSkills(): SkillCatalogEntry[] {
  return SKILL_CATALOG.filter((skill) => skill.featured && skill.kind === "skill");
}

export function filterSkillCatalog(
  tab: SkillCatalogTab,
  category: SkillCategory,
): SkillCatalogEntry[] {
  const kind: SkillCatalogKind = tab === "plugins" ? "plugin" : "skill";
  return SKILL_CATALOG.filter(
    (skill) =>
      skill.kind === kind && (category === "All" || skill.category === category),
  );
}

export function getSkillById(id: string): SkillCatalogEntry | null {
  return SKILL_CATALOG.find((skill) => skill.id === id) ?? null;
}
