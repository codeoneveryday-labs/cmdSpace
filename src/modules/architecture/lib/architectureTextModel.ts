import type { ArchitectureNode } from "./architectureCanvasTypes";

export function cloneNodes(nodes: ArchitectureNode[]): ArchitectureNode[] {
  return nodes.map(cloneNode);
}

export function cloneNode(item: ArchitectureNode): ArchitectureNode {
  return {
    ...item,
    points: item.points ? item.points.map((point) => ({ ...point })) : undefined,
  };
}

export function textNodeLines(value: string): string[] {
  const lines = value.split(/\r?\n/);
  return lines.length ? lines.map((line) => line || " ") : [" "];
}

export function measureTextNodeSize(label: string): { width: number; height: number } {
  const lines = textNodeLines(label || "Text");
  const maxChars = Math.max(...lines.map((line) => line.trimEnd().length), 4);
  return {
    width: Math.max(112, Math.ceil(maxChars * 14 + 28)),
    height: Math.max(40, lines.length * 30 + 10),
  };
}

export function fitTextNode(node: ArchitectureNode): ArchitectureNode {
  if (node.kind !== "text") return node;
  const size = measureTextNodeSize(node.label);
  return { ...node, width: size.width, height: size.height };
}
