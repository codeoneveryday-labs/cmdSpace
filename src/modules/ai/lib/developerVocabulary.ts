type WorkspaceManifest = { name: string; content: string };

const MAX_TERMS = 72;
const MAX_VOCABULARY_LENGTH = 900;

function workspaceName(path: string): string | null {
  const parts = path.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1]?.trim();
  return name && /^[\w.@/-]+$/u.test(name) ? name : null;
}

function addPackageJsonTerms(terms: Set<string>, content: string): void {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null) return;
    const record = parsed as Record<string, unknown>;
    if (typeof record.name === "string") terms.add(record.name);
    for (const field of ["dependencies", "devDependencies", "peerDependencies"] as const) {
      const dependencies = record[field];
      if (typeof dependencies !== "object" || dependencies === null) continue;
      Object.keys(dependencies).forEach((name) => terms.add(name));
    }
    if (typeof record.scripts === "object" && record.scripts !== null) {
      Object.keys(record.scripts).forEach((name) => terms.add(name));
    }
  } catch {
    // Malformed manifests are ignored; their raw content must never become STT context.
  }
}

function addTomlTerms(terms: Set<string>, content: string): void {
  const packageName = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(content)?.[1];
  if (packageName) terms.add(packageName);
  let inDependencies = false;
  for (const line of content.split(/\r?\n/)) {
    const section = /^\s*\[([^\]]+)\]\s*$/.exec(line)?.[1];
    if (section) {
      inDependencies = /^(?:workspace\.)?(?:dependencies|dev-dependencies)$/.test(section);
      continue;
    }
    if (!inDependencies) continue;
    const dependency = /^\s*([\w.-]+)\s*=/.exec(line)?.[1];
    if (dependency) terms.add(dependency);
  }
}

function addGoTerms(terms: Set<string>, content: string): void {
  const module = /^\s*module\s+([^\s]+)$/m.exec(content)?.[1];
  if (module) terms.add(module);
  for (const match of content.matchAll(/^\s*([\w.-]+(?:\/[\w.-]+)+)\s+v\S+/gm)) {
    terms.add(match[1]);
  }
}

function addPyprojectTerms(terms: Set<string>, content: string): void {
  const name = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(content)?.[1];
  if (name) terms.add(name);
  for (const match of content.matchAll(/["']([A-Za-z][A-Za-z0-9_.-]+)(?:[<>=!~].*?)?["']/g)) {
    terms.add(match[1]);
  }
}

/**
 * Extracts only package and dependency identifiers from safe workspace
 * manifests. It never sends manifest contents, scripts, or arbitrary values.
 */
export function developerVocabularyFromWorkspace(
  path: string,
  manifests: readonly WorkspaceManifest[],
): string {
  const terms = new Set<string>();
  const name = workspaceName(path);
  if (name) terms.add(name);

  for (const manifest of manifests) {
    if (manifest.name === "package.json") addPackageJsonTerms(terms, manifest.content);
    if (manifest.name === "Cargo.toml") addTomlTerms(terms, manifest.content);
    if (manifest.name === "go.mod") addGoTerms(terms, manifest.content);
    if (manifest.name === "pyproject.toml") addPyprojectTerms(terms, manifest.content);
  }

  return [...terms]
    .filter((term) => /^[\w@./-]+$/u.test(term))
    .slice(0, MAX_TERMS)
    .join(", ")
    .slice(0, MAX_VOCABULARY_LENGTH);
}
