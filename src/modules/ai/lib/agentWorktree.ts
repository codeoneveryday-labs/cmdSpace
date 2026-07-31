const WORKTREE_SLUG_LENGTH = 40;

export function worktreeSlug(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, WORKTREE_SLUG_LENGTH);
  return slug || fallback;
}

export function isolatedAgentCommand(
  command: string,
  taskLabel: string,
  worktreeGroup: string,
): string {
  const taskSlug = worktreeSlug(taskLabel, "task");
  const branchSlug = worktreeSlug(`${worktreeGroup}-${taskSlug}`, taskSlug);
  return [
    'repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "cmdSpace: isolated agent requires a Git repository"; exec "${SHELL:-/bin/sh}"; }',
    'repo_name="$(basename "$repo_root")"',
    `worktree_parent="$HOME/.cmdspace/worktrees/$repo_name/${worktreeSlug(worktreeGroup, "session")}"`,
    `worktree_path="$worktree_parent/${taskSlug}"`,
    `branch_name="cmdspace/${branchSlug}"`,
    'mkdir -p "$worktree_parent"',
    'if [ -e "$worktree_path/.git" ]; then :; elif [ -e "$worktree_path" ]; then echo "cmdSpace: worktree path already exists: $worktree_path"; exec "${SHELL:-/bin/sh}"; elif git show-ref --verify --quiet "refs/heads/$branch_name"; then git worktree add "$worktree_path" "$branch_name"; else git worktree add -b "$branch_name" "$worktree_path" HEAD; fi',
    'cd "$worktree_path"',
    `export CMDSPACE_WORKTREE="$worktree_path" CMDSPACE_TASK="${taskSlug}" CMDSPACE_BRANCH="$branch_name"`,
    command,
  ].join("; ");
}

export function worktreeGroup(): string {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
