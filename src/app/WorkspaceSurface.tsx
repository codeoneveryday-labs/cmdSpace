import { cn } from "@/lib/utils";
import {
  ArchitectureStack,
  type CanvasTerminalHandle,
} from "@/modules/architecture";
import {
  AiDiffStack,
  EditorStack,
  GitDiffStack,
} from "@/modules/editor";
import { GitHistoryStack } from "@/modules/git-history";
import { MarkdownStack } from "@/modules/markdown";
import type {
  ArchitectureDiagram,
  Tab,
} from "@/modules/tabs";
import {
  TerminalStack,
} from "@/modules/terminal";
import type { ComponentProps } from "react";

type TerminalStackProps = ComponentProps<typeof TerminalStack>;

export type WorkspaceSurfaceProps = {
  tabs: Tab[];
  activeId: number;
  hideBootstrapShell: boolean;
  isTerminalTab: boolean;
  isEditorTab: boolean;
  isMarkdownTab: boolean;
  isAiDiffTab: boolean;
  isGitDiffTab: boolean;
  isGitHistoryTab: boolean;
  isArchitectureTab: boolean;
  canvasFocused: boolean;
  activeWorkspaceAccentColor: string;
  workspaces: Array<{
    id: string;
    tabId: number | null;
    canvasTabId?: number | null;
    workingFolder?: string | null;
  }>;
  terminalProps: Omit<TerminalStackProps, "tabs" | "activeId" | "focusAccentColor">;
  onDiagramChange?: (tabId: number, diagram: ArchitectureDiagram) => void;
  onRegisterTerminalCreator?: (
    tabId: number,
    creator: ((initialCommand?: string) => boolean) | null,
  ) => void;
  onTerminalHandleChange?: (
    tabId: number,
    terminalId: string,
    handle: CanvasTerminalHandle | null,
  ) => void;
  onActiveTerminalChange?: (tabId: number, terminalId: string | null) => void;
  onToggleCanvasFocus?: () => void;
  registerEditorHandle: ComponentProps<typeof EditorStack>["registerHandle"];
  onEditorDirty: ComponentProps<typeof EditorStack>["onDirtyChange"];
  onCloseEditorTab: ComponentProps<typeof EditorStack>["onCloseTab"];
  onOpenCommitFile: ComponentProps<typeof GitHistoryStack>["onOpenCommitFile"];
  onGitHistorySearchHandle: ComponentProps<typeof GitHistoryStack>["onSearchHandle"];
};

export function WorkspaceSurface({
  tabs,
  activeId,
  hideBootstrapShell,
  isTerminalTab,
  isEditorTab,
  isMarkdownTab,
  isAiDiffTab,
  isGitDiffTab,
  isGitHistoryTab,
  isArchitectureTab,
  canvasFocused,
  activeWorkspaceAccentColor,
  workspaces,
  terminalProps,
  onDiagramChange,
  onRegisterTerminalCreator,
  onTerminalHandleChange,
  onActiveTerminalChange,
  onToggleCanvasFocus,
  registerEditorHandle,
  onEditorDirty,
  onCloseEditorTab,
  onOpenCommitFile,
  onGitHistorySearchHandle,
}: WorkspaceSurfaceProps) {
  return (
    <div className="relative h-full min-h-0">
      <div
        className={cn(
          "absolute inset-0",
          (!isTerminalTab || hideBootstrapShell) && "invisible pointer-events-none",
        )}
        aria-hidden={!isTerminalTab || hideBootstrapShell}
      >
        <TerminalStack
          {...terminalProps}
          tabs={tabs}
          activeId={activeId}
          focusAccentColor={activeWorkspaceAccentColor}
        />
      </div>

      <div
        data-editor-file-drop-region
        className={cn("absolute inset-0", !isEditorTab && "invisible pointer-events-none")}
        aria-hidden={!isEditorTab}
      >
        <EditorStack
          tabs={tabs}
          activeId={activeId}
          registerHandle={registerEditorHandle}
          onDirtyChange={onEditorDirty}
          onCloseTab={onCloseEditorTab}
        />
      </div>

      <div
        className={cn("absolute inset-0", !isMarkdownTab && "invisible pointer-events-none")}
        aria-hidden={!isMarkdownTab}
      >
        <MarkdownStack tabs={tabs} activeId={activeId} />
      </div>

      <div
        className={cn("absolute inset-0", !isAiDiffTab && "invisible pointer-events-none")}
        aria-hidden={!isAiDiffTab}
      >
        <AiDiffStack tabs={tabs} activeId={activeId} onAccept={() => undefined} onReject={() => undefined} />
      </div>

      <div
        className={cn("absolute inset-0", !isGitDiffTab && "invisible pointer-events-none")}
        aria-hidden={!isGitDiffTab}
      >
        <GitDiffStack tabs={tabs} activeId={activeId} />
      </div>

      <div
        className={cn("absolute inset-0", !isGitHistoryTab && "invisible pointer-events-none")}
        aria-hidden={!isGitHistoryTab}
      >
        <GitHistoryStack
          tabs={tabs}
          activeId={activeId}
          onOpenCommitFile={onOpenCommitFile}
          onSearchHandle={onGitHistorySearchHandle}
        />
      </div>

      <div
        className={cn("absolute inset-0", !isArchitectureTab && "hidden pointer-events-none")}
        aria-hidden={!isArchitectureTab}
      >
        <ArchitectureStack
          tabs={tabs}
          activeId={activeId}
          canvasWorkspaceByTab={Object.fromEntries(
            workspaces.flatMap((workspace) =>
              workspace.canvasTabId === null || workspace.canvasTabId === undefined
                ? []
                : [[workspace.canvasTabId, { id: workspace.id, cwd: workspace.workingFolder ?? null }]],
            ),
          )}
          onDiagramChange={onDiagramChange}
          onRegisterTerminalCreator={onRegisterTerminalCreator}
          onTerminalHandleChange={onTerminalHandleChange}
          onActiveTerminalChange={onActiveTerminalChange}
          canvasFocused={canvasFocused}
          onToggleCanvasFocus={onToggleCanvasFocus}
        />
      </div>
    </div>
  );
}
