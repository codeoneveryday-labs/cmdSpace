#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseline = {
  testFiles: 479,
  sourceGuards: 280,
  executableTests: 199,
  baselineCommit: "82e439a8c",
};

const warnings = [];

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    }).trim();
  } catch (error) {
    const stdout = error.stdout?.toString().trim();
    const stderr = error.stderr?.toString().trim();
    return { failed: true, stdout, stderr, status: error.status ?? 1 };
  }
}

function countFiles(patterns) {
  const normalized = Array.isArray(patterns) ? patterns : [patterns];
  const result = run("git", ["ls-files", "--", ...normalized]);
  if (typeof result !== "string") {
    warnings.push(`Could not count ${normalized.join(", ")}: git ls-files failed.`);
    return 0;
  }
  return result ? result.split("\n").filter(Boolean).length : 0;
}

function warn(message) {
  warnings.push(message);
  console.warn(`WARN quality-gates: ${message}`);
}

console.log("Quality gates (warn-only)");
console.log(`Canonical scope: src/; baseline: ${baseline.baselineCommit}`);

const tsTestFiles = countFiles(["src/**/*.test.ts", "src/*.test.ts"]);
const renderFiles = countFiles(["src/**/*.test.tsx", "src/*.test.tsx"]);
const testFiles = tsTestFiles + renderFiles;
const sourceGuards = countFiles(["src/**/*.source.test.ts", "src/*.source.test.ts"]);
const contractFiles = countFiles(["src/**/*.contract.test.ts", "src/*.contract.test.ts"]);
const executableTests = testFiles - sourceGuards;

console.log(
  `Test files: ${testFiles} total; ${sourceGuards} structural guards; ` +
    `${executableTests} executable (${renderFiles} render, ${contractFiles} contract).`,
);

if (testFiles !== baseline.testFiles) {
  warn(`test-file count changed from ${baseline.testFiles} to ${testFiles}.`);
}
if (sourceGuards > baseline.sourceGuards) {
  warn(
    `structural guards increased from ${baseline.sourceGuards} to ${sourceGuards}; ` +
      "A6 is not blocking yet.",
  );
}
if (executableTests !== testFiles - sourceGuards) {
  warn("test taxonomy arithmetic could not be classified.");
}

const baseSha = process.env.GITHUB_BASE_SHA || "HEAD~1";
const changedGuards = run("git", [
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  `${baseSha}...HEAD`,
  "--",
  "src/**/*.source.test.ts",
]);
if (typeof changedGuards === "string" && changedGuards) {
  warn(
    `${changedGuards.split("\n").length} structural-guard file(s) changed since ${baseSha}; ` +
      "replace behavior guards with executable proof where practical.",
  );
} else if (changedGuards?.failed) {
  warn(`could not inspect changed structural guards against ${baseSha}.`);
}

const optionalTools = [
  ["eslint", ["--version"], "ESLint is not installed; lint gate is reporting-only."],
  ["prettier", ["--version"], "Prettier is not installed; formatting gate is reporting-only."],
  ["c8", ["--version"], "Coverage CLI is not installed; coverage baseline is not measured."],
];
for (const [tool, args, message] of optionalTools) {
  const result = run(tool, args);
  if (typeof result !== "string") warn(message);
  else console.log(`${tool}: ${result}`);
}

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
if (packageJson.scripts?.lint) console.log("lint script: configured");
else warn("no lint script is configured; A5 remains warn-only.");

console.log(
  warnings.length
    ? `Quality gates completed with ${warnings.length} warning(s); exit status remains 0.`
    : "Quality gates completed without warnings.",
);
process.exitCode = 0;
