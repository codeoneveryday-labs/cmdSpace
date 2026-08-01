export function nextDiagramIdSequence(
  ids: readonly string[],
  prefix: "n" | "e",
): number {
  let next = 1;

  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const suffix = id.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    next = Math.max(next, Number(suffix) + 1);
  }

  return next;
}
