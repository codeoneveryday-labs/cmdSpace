import type {
  ArchitectureNode,
  CanvasMode,
  LiveSurfaceKind,
  ResizableShapeKind,
  ShapeDrawingMode,
  ShapeKind,
} from "./architectureCanvasTypes";

export function isShapeDrawingMode(mode: CanvasMode): mode is ShapeDrawingMode {
  return [
    "rectangle",
    "circle",
    "line",
    "arrow",
    "pen",
    "text",
    "image",
    "frame",
  ].includes(mode);
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".xterm")) return true;
  const tag = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tag === "input" ||
    tag === "textarea" ||
    tag === "select"
  );
}

export function isCanvasNavBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".xterm")) return false;
  const tag = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tag === "input" ||
    tag === "textarea" ||
    tag === "select"
  );
}

export function isResizableShapeKind(kind: ShapeKind): kind is ResizableShapeKind {
  return [
    "rectangle",
    "circle",
    "frame",
    "text",
    "image",
    "terminal",
    "browser",
  ].includes(kind);
}

export function isFrameAttachableKind(kind: ShapeKind): boolean {
  return kind === "terminal" || kind === "browser";
}

export function isLiveSurfaceKind(kind: ShapeKind): kind is LiveSurfaceKind {
  return kind === "terminal" || kind === "browser";
}

export function isLiveSurfaceNode(node: ArchitectureNode): boolean {
  return isLiveSurfaceKind(node.kind);
}

export function isFreehandKind(kind: ShapeKind): boolean {
  return kind === "pen";
}

export function isDrawingOnlyKind(kind: ShapeKind): boolean {
  return kind === "line" || kind === "arrow" || kind === "pen";
}
