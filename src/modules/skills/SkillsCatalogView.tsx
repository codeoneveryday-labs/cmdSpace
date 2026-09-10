import { cn } from "@/lib/utils";
import {
  Book01Icon,
  CodeIcon,
  File02Icon,
  PaintBoardIcon,
  Search01Icon,
  SparklesIcon,
  TableIcon,
  UserGroupIcon,
  Cancel01Icon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
  getFeaturedSkills,
  getSkillById,
  SKILL_CATALOG,
  type SkillCatalogEntry,
  type SkillIconName,
} from "./skillCatalog";

const SKILL_ICONS: Record<SkillIconName, typeof Book01Icon> = {
  book: Book01Icon,
  code: CodeIcon,
  document: File02Icon,
  group: UserGroupIcon,
  palette: PaintBoardIcon,
  search: Search01Icon,
  spark: SparklesIcon,
  table: TableIcon,
};

function SkillIcon({ skill, size = 20 }: { skill: SkillCatalogEntry; size?: number }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size >= 24 ? "size-10" : "size-8",
        skill.iconTone,
      )}
      aria-hidden="true"
    >
      <HugeiconsIcon icon={SKILL_ICONS[skill.icon]} size={size} strokeWidth={1.8} />
    </span>
  );
}

function SkillCard({
  skill,
  onSelect,
}: {
  skill: SkillCatalogEntry;
  onSelect: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className="group flex min-h-36 cursor-pointer flex-col rounded-2xl border border-border/60 bg-card/65 p-4 text-left shadow-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/35 hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start gap-3">
        <SkillIcon skill={skill} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate pt-0.5 text-sm font-semibold text-foreground">
            {skill.name}
          </h3>
          <p className="mt-1 truncate text-[11px] text-muted-foreground/75">
            {skill.repositoryUrl.replace("https://github.com/", "")}
          </p>
          {skill.deprecated ? (
            <span className="mt-1 inline-flex w-fit rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              Deprecated
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-xs leading-5 text-muted-foreground">
        {skill.description}
      </p>
    </article>
  );
}

function SkillDetail({
  skill,
  onClose,
}: {
  skill: SkillCatalogEntry;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label={`${skill.name} details`}
      className="flex w-full shrink-0 flex-col border-t border-border/60 bg-card/70 p-5 lg:w-80 lg:border-t-0 lg:border-l"
    >
      <div className="flex items-start justify-between gap-3">
        <SkillIcon skill={skill} size={24} />
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Close skill details"
          title="Close skill details"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} />
        </button>
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{skill.name}</h2>
      <span className="mt-2 w-fit rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
        {skill.deprecated ? "Deprecated" : skill.category}
      </span>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{skill.description}</p>
      <a
        href={skill.repositoryUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-auto inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-border/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <HugeiconsIcon icon={LinkSquare02Icon} size={15} strokeWidth={1.8} />
        View on GitHub
      </a>
    </aside>
  );
}

export function SkillsCatalogView() {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const featuredSkills = getFeaturedSkills();
  const visibleSkills = SKILL_CATALOG;
  const selectedSkill = selectedSkillId ? getSkillById(selectedSkillId) : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center border-b border-border/60 px-5 py-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={SparklesIcon} size={18} strokeWidth={1.8} />
          <h1 className="truncate text-sm font-semibold">Skill & Plugin</h1>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <section aria-labelledby="featured-skills-heading">
              <h2 id="featured-skills-heading" className="text-base font-semibold">
                Featured
              </h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {featuredSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onSelect={() => setSelectedSkillId(skill.id)}
                  />
                ))}
              </div>
            </section>

            <div className="mt-8 flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
              <h2 className="text-sm font-semibold text-foreground">Skills</h2>
              <span className="text-xs text-muted-foreground">
                {visibleSkills.length} curated repositories
              </span>
            </div>

            <section aria-label="Skills list" className="mt-4">
              {visibleSkills.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleSkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onSelect={() => setSelectedSkillId(skill.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  No skills in this category yet.
                </div>
              )}
            </section>
          </div>
        </main>

        {selectedSkill ? (
          <SkillDetail
            skill={selectedSkill}
            onClose={() => setSelectedSkillId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
