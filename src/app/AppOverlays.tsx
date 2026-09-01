import type { MutableRefObject } from "react";
import type { ProviderKeys } from "@/modules/ai/lib/keyring";
import {
  FloatingVoiceAgent,
  type FloatingVoiceAgentHandle,
  type SpeechInputTarget,
} from "@/modules/ai/components/FloatingVoiceAgent";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceEnv } from "@/modules/workspace";
import type { ImportableAgentSession } from "@/modules/workspaces";
import type { WorkspaceRecord } from "./lib/useWorkspaceController";
import { ImportSessionDialog } from "@/modules/workspaces";
import { StatusBar } from "@/modules/statusbar";
import { ShortcutsDialog } from "@/modules/shortcuts";
import { NewEditorDialog } from "@/modules/editor";
import { UpdaterDialog } from "@/modules/updater";
import { UnsavedChangesDialogs } from "./UnsavedChangesDialogs";
import { WorkspaceDeleteDialog } from "./WorkspaceDeleteDialog";

export function AppOverlays({
  importSessionOpen,
  setImportSessionOpen,
  activeWorkspace,
  activeWorkspaceFolder,
  handleImportAgentSession,
  activeCwd,
  activeFilePath,
  home,
  changeTerminalDirectory,
  switchWorkspace,
  toggleBottomTerminal,
  activeTab,
  voiceAgentRef,
  captureVoiceTarget,
  captureVoiceVocabulary,
  apiKeys,
  insertVoiceDraft,
  shortcutsOpen,
  setShortcutsOpen,
  newEditorOpen,
  setNewEditorOpen,
  explorerRoot,
  openFileTab,
  tabs,
  pendingCloseTab,
  pendingDeleteTabs,
  cancelClose,
  confirmClose,
  cancelDeleteClose,
  confirmDeleteClose,
  pendingDeleteWorkspaceId,
  pendingDeleteWorkspace,
  workspaceDeleteDoNotAskAgain,
  setWorkspaceDeleteDoNotAskAgain,
  cancelDeleteWorkspace,
  confirmDeleteWorkspace,
}: {
  importSessionOpen: boolean;
  setImportSessionOpen: (open: boolean) => void;
  activeWorkspace: WorkspaceRecord | null;
  activeWorkspaceFolder: string | null;
  handleImportAgentSession: (session: ImportableAgentSession) => Promise<boolean>;
  activeCwd: string | null;
  activeFilePath: string | null;
  home: string | null;
  changeTerminalDirectory: (cwd: string) => void;
  switchWorkspace: (env: WorkspaceEnv) => void;
  toggleBottomTerminal: () => void;
  activeTab: Tab | undefined;
  voiceAgentRef: MutableRefObject<FloatingVoiceAgentHandle | null>;
  captureVoiceTarget: () => SpeechInputTarget | null;
  captureVoiceVocabulary: () => Promise<string>;
  apiKeys: ProviderKeys;
  insertVoiceDraft: (target: SpeechInputTarget, transcript: string) => boolean;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  newEditorOpen: boolean;
  setNewEditorOpen: (open: boolean) => void;
  explorerRoot: string | null;
  openFileTab: (path: string) => void;
  tabs: Tab[];
  pendingCloseTab: number | null;
  pendingDeleteTabs: number[] | null;
  cancelClose: () => void;
  confirmClose: () => void;
  cancelDeleteClose: () => void;
  confirmDeleteClose: () => void;
  pendingDeleteWorkspaceId: string | null;
  pendingDeleteWorkspace: WorkspaceRecord | null;
  workspaceDeleteDoNotAskAgain: boolean;
  setWorkspaceDeleteDoNotAskAgain: (value: boolean) => void;
  cancelDeleteWorkspace: () => void;
  confirmDeleteWorkspace: () => void;
}) {
  return (
    <>
      <ImportSessionDialog
        open={importSessionOpen}
        onOpenChange={setImportSessionOpen}
        workspaceName={activeWorkspace?.name ?? null}
        workspaceCwd={activeWorkspaceFolder}
        onImport={handleImportAgentSession}
      />
      <StatusBar
        cwd={activeCwd}
        filePath={activeFilePath}
        home={home}
        workspaceFolder={activeWorkspaceFolder}
        onCd={changeTerminalDirectory}
        onWorkspaceChange={switchWorkspace}
        onToggleTerminal={toggleBottomTerminal}
        privateActive={activeTab?.kind === "terminal" && activeTab.private === true}
      />
      <FloatingVoiceAgent
        ref={voiceAgentRef}
        captureTarget={captureVoiceTarget}
        captureVocabulary={captureVoiceVocabulary}
        apiKeys={apiKeys}
        insertTranscript={insertVoiceDraft}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <NewEditorDialog
        open={newEditorOpen}
        onOpenChange={setNewEditorOpen}
        rootPath={explorerRoot ?? home}
        onCreated={(path) => {
          setNewEditorOpen(false);
          openFileTab(path);
        }}
      />
      <UpdaterDialog autoCheck={false} />
      <UnsavedChangesDialogs
        tabs={tabs}
        pendingCloseTab={pendingCloseTab}
        pendingDeleteTabs={pendingDeleteTabs}
        onCancelClose={cancelClose}
        onConfirmClose={confirmClose}
        onCancelDelete={cancelDeleteClose}
        onConfirmDelete={confirmDeleteClose}
      />
      <WorkspaceDeleteDialog
        open={pendingDeleteWorkspaceId !== null}
        workspaceName={pendingDeleteWorkspace?.name ?? "this workspace"}
        doNotAskAgain={workspaceDeleteDoNotAskAgain}
        onDoNotAskAgainChange={setWorkspaceDeleteDoNotAskAgain}
        onCancel={cancelDeleteWorkspace}
        onConfirm={confirmDeleteWorkspace}
      />
    </>
  );
}
