import type {
  ArchitectureTab,
  EditorTab,
  Tab,
  TabPatch,
} from "./tabTypes";

function titleFromUrl(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url || "preview";
  }
}

export function applyTabPatch(tab: Tab, patch: TabPatch): Tab {
  if (tab.kind === "terminal") {
    return {
      ...tab,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.cwd !== undefined && { cwd: patch.cwd }),
    };
  }
  if (tab.kind === "preview") {
    return {
      ...tab,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.url !== undefined && {
        url: patch.url,
        title: patch.title ?? titleFromUrl(patch.url),
      }),
    };
  }
  if (tab.kind === "markdown") {
    return { ...tab, ...(patch.title !== undefined && { title: patch.title }) };
  }
  if (tab.kind === "architecture") {
    return {
      ...tab,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.diagram !== undefined && { diagram: patch.diagram }),
    } as ArchitectureTab;
  }
  if (tab.kind === "agent-chat") {
    return {
      ...tab,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.nativeSessionId !== undefined && {
        nativeSessionId: patch.nativeSessionId,
      }),
      ...(patch.initialDraft !== undefined && { initialDraft: patch.initialDraft }),
    };
  }
  const autoPin = patch.dirty === true && (tab as EditorTab).preview
    ? { preview: false }
    : {};
  return {
    ...tab,
    ...autoPin,
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.dirty !== undefined && { dirty: patch.dirty }),
    ...(patch.path !== undefined && { path: patch.path }),
  };
}
