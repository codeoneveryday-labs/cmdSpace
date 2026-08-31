import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SourceControlSummary } from "./useSourceControl";
import { SourceControlChangeList } from "./SourceControlChangeList";
import { SourceControlCommitComposer } from "./SourceControlCommitComposer";
import { SourceControlDiscardDialog } from "./SourceControlDiscardDialog";
import {
  useSourceControlPanel,
} from "./useSourceControlPanel";
import { deriveSourceControlPanelModel } from "./sourceControlPanelModel";
import { SourceControlPanelHeader } from "./SourceControlPanelHeader";

type Props = {
  open: boolean;
  sourceControl: SourceControlSummary;
  onOpenGitGraph?: () => void;
  onOpenDiff: (input: {
    path: string;
    repoRoot: string;
    mode: "+" | "-";
    originalPath: string | null;
    title?: string;
  }) => void;
};

export const SourceControlPanel = memo(function SourceControlPanel({
  open,
  sourceControl,
  onOpenGitGraph,
  onOpenDiff,
}: Props) {
  const scm = useSourceControlPanel(open, sourceControl, onOpenDiff);
  const refreshAnimationRef = useRef<number | null>(null);
  const [refreshAnimating, setRefreshAnimating] = useState(false);

  useEffect(() => {
    return () => {
      if (refreshAnimationRef.current) {
        window.clearTimeout(refreshAnimationRef.current);
      }
    };
  }, []);

  const isRefreshing = scm.panelState === "loading";
  const repoLabel = useMemo(() => {
    if (!scm.status) return "Source Control";
    return scm.status.isDetached ? "detached" : scm.status.branch;
  }, [scm.status]);

  const panelModel = deriveSourceControlPanelModel(scm, sourceControl);

  const handleRefresh = useCallback(() => {
    setRefreshAnimating(true);
    if (refreshAnimationRef.current) {
      window.clearTimeout(refreshAnimationRef.current);
    }
    void scm.refresh().finally(() => {
      refreshAnimationRef.current = window.setTimeout(() => {
        setRefreshAnimating(false);
        refreshAnimationRef.current = null;
      }, 450);
    });
  }, [scm]);

  const handleFetch = useCallback(() => {
    void sourceControl.runRemoteAction("fetch");
  }, [sourceControl]);

  const handlePull = useCallback(() => {
    void sourceControl.runRemoteAction("pull");
  }, [sourceControl]);

  if (!open) return null;

  const fetchBusy = sourceControl.busyAction === "fetch";
  const pullBusy = sourceControl.busyAction === "pull";

  return (
    <TooltipProvider delayDuration={800} skipDelayDuration={300}>
      <aside className="flex h-full min-w-0 flex-col bg-card/80 backdrop-blur [contain:layout_style]">
<SourceControlPanelHeader
          repoLabel={repoLabel}
          ahead={scm.status?.ahead ?? 0}
          behind={scm.status?.behind ?? 0}
          detached={Boolean(scm.status?.isDetached)}
          fetchBusy={fetchBusy}
          pullBusy={pullBusy}
          isRefreshing={isRefreshing}
          canFetch={panelModel.canFetch}
          canPull={panelModel.canPull}
          isDiverged={panelModel.isDiverged}
          hasUpstream={panelModel.hasUpstream}
          refreshAnimating={refreshAnimating}
          onFetch={handleFetch}
          onPull={handlePull}
          onRefresh={handleRefresh}
          onOpenGitGraph={onOpenGitGraph}
        />
        {scm.panelState === "loading" ? (
          <PanelCenter title="Loading repository" />
        ) : null}

        {scm.panelState === "no-repo" ? (
          <PanelCenter
            title="No repository"
            body="The active workspace is not inside a Git repository."
          />
        ) : null}

        {scm.panelState === "error" ? (
          <PanelCenter
            title="Source control error"
            body={scm.statusError ?? "Unknown source control error"}
            action={
              <Button size="sm" onClick={() => void scm.refresh()}>
                Retry
              </Button>
            }
          />
        ) : null}

        {scm.panelState === "ready" && scm.status ? (
          <>
            <div className="relative shrink-0 space-y-2 border-b border-border/40 bg-gradient-to-b from-card/65 to-card/30 px-2.5 pb-2.5 pt-2.5">
            <SourceControlCommitComposer
              commitMessage={scm.commitMessage}
              onCommitMessage={scm.setCommitMessage}
              stagedCount={panelModel.stagedCount}
              canCommit={panelModel.canCommit}
              commitDisabledReason={panelModel.commitDisabledReason}
              actionBusy={scm.actionBusy}
              canPush={scm.canPush}
              pushDisabledReason={panelModel.pushDisabledReason}
              upstreamLabel={panelModel.pushStatusLabel}
              feedback={panelModel.footerFeedback}
              onCommit={() => void scm.commit()}
              onPush={() => void scm.push()}
            />

            {scm.allClean ? (
              <CleanTreeHint repoLabel={repoLabel} />
            ) : (
              <SourceControlChangeList
                fileEntries={scm.fileEntries}
                isDiverged={panelModel.isDiverged}
                selectedPath={scm.selected?.path ?? null}
                actionBusy={scm.actionBusy}
                headerCheckState={scm.headerCheckState}
                onToggleAll={scm.toggleAll}
                onSelectFile={scm.selectFile}
                onToggleStageFile={scm.toggleStageFile}
                onDiscardFile={scm.requestDiscardFile}
                onRefresh={handleRefresh}
              />
            )}
            </div>
          </>
        ) : null}
      </aside>

      <SourceControlDiscardDialog
        pendingDiscard={scm.pendingDiscard}
        onCancel={scm.cancelPendingDiscard}
        onConfirm={() => void scm.confirmPendingDiscard()}
      />
    </TooltipProvider>
  );
});

function PanelCenter({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <div className="text-sm font-medium">{title}</div>
      {body ? (
        <div className="max-w-64 text-[11px] leading-relaxed text-muted-foreground">
          {body}
        </div>
      ) : null}
      {action}
    </div>
  );
}

function CleanTreeHint({ repoLabel }: { repoLabel: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center">
      <div className="flex size-8 items-center justify-center rounded-full border border-border/55 text-muted-foreground">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          size={16}
          strokeWidth={1.6}
        />
      </div>
      <div className="text-[12px] font-medium text-foreground">
        Working tree clean
      </div>
      <div className="text-[10.5px] leading-snug text-muted-foreground">
        on <span className="font-mono text-foreground/80">{repoLabel}</span>
      </div>
    </div>
  );
}
