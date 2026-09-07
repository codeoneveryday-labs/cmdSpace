#!/usr/bin/env node
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const skillsRoot = join(repositoryRoot, ".agents", "skills");
const claudeSkillsRoot = join(repositoryRoot, ".claude", "skills");
const errors = [];

function report(path, message) {
  errors.push(`${path}: ${message}`);
}

function validateSkill(skillName) {
  const skillPath = join(skillsRoot, skillName, "SKILL.md");
  if (!existsSync(skillPath)) {
    report(`.agents/skills/${skillName}`, "missing SKILL.md");
    return;
  }

  const content = readFileSync(skillPath, "utf8");
  if (content.trim().length === 0) {
    report(`.agents/skills/${skillName}/SKILL.md`, "file is empty");
    return;
  }

  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) {
    report(`.agents/skills/${skillName}/SKILL.md`, "missing YAML frontmatter");
    return;
  }

  for (const field of ["name", "description"]) {
    const fieldPattern = new RegExp(`^${field}:\\s*(.+)$`, "m");
    const match = frontmatter[1].match(fieldPattern);
    if (!match || match[1].trim() === "") {
      report(`.agents/skills/${skillName}/SKILL.md`, `frontmatter missing ${field}`);
    }
  }
}

if (!existsSync(skillsRoot)) {
  report(".agents/skills", "directory is missing");
} else {
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) validateSkill(entry.name);
  }
}

if (existsSync(claudeSkillsRoot)) {
  for (const entry of readdirSync(claudeSkillsRoot, { withFileTypes: true })) {
    const linkPath = join(claudeSkillsRoot, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        realpathSync(linkPath);
      } catch {
        report(`.claude/skills/${entry.name}`, "broken symlink");
      }
    } else if (lstatSync(linkPath).isDirectory()) {
      report(`.claude/skills/${entry.name}`, "expected symlink to .agents/skills");
    }
  }
}

if (errors.length > 0) {
  console.error(`Skill validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Agent skill validation passed.");
}
