import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Download01Icon,
  FolderCloudIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconActionButton } from "./SourceControlEntryRow";

export function SourceControlRemoteActions({
  fetchBusy,
  pullBusy,
  isRefreshing,
  canFetch,
  canPull,
  isDiverged,
  hasUpstream,
  behind,
  refreshAnimating,
  onFetch,
  onPull,
  onRefresh,
}: {
  fetchBusy: boolean;
  pullBusy: boolean;
  isRefreshing: boolean;
  canFetch: boolean;
  canPull: boolean;
  isDiverged: boolean;
  hasUpstream: boolean;
  behind: number;
  refreshAnimating: boolean;
  onFetch: () => void;
  onPull: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconActionButton label={fetchBusy ? "Fetching…" : "Fetch from remote"} disabled={!canFetch} onClick={onFetch} side="bottom">
        {fetchBusy ? <Spinner className="size-3" /> : <HugeiconsIcon icon={FolderCloudIcon} size={14} strokeWidth={1.85} />}
      </IconActionButton>
      <IconActionButton label={pullBusy ? "Pulling…" : isDiverged ? "Branch diverged — resolve in terminal" : !hasUpstream ? "No upstream configured" : behind === 0 ? "Already up to date" : `Pull ${behind} commits (fast-forward)`} disabled={!canPull} onClick={onPull} side="bottom">
        {pullBusy ? <Spinner className="size-3" /> : <HugeiconsIcon icon={Download01Icon} size={14} strokeWidth={1.9} />}
      </IconActionButton>
      <IconActionButton label="Refresh source control" disabled={isRefreshing} onClick={onRefresh} side="bottom">
        {isRefreshing ? <Spinner className="size-3.5" /> : <HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={1.9} className={cn(refreshAnimating && "animate-spin")} />}
      </IconActionButton>
    </div>
  );
}
