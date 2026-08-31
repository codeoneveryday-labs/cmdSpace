import {
  FileAddIcon,
  FolderAddIcon,
  Refresh01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { folderIconUrl } from "./lib/iconResolver";

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export function FileExplorerHeader({
  rootPath,
  onToggleSearch,
  onCreateFile,
  onCreateFolder,
  onRefresh,
}: {
  rootPath: string;
  onToggleSearch: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 px-2">
      <span
        className="flex flex-1 items-center truncate text-xs font-medium text-foreground/80"
        title={rootPath}
      >
        <img
          src={folderIconUrl(basename(rootPath), false)}
          alt=""
          height={15}
          width={15}
          className="mx-1.5"
        />
        {basename(rootPath)}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        onClick={onToggleSearch}
        title="Search files"
        aria-label="Search files"
      >
        <HugeiconsIcon icon={Search01Icon} size={13} strokeWidth={2} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        onClick={onCreateFile}
        title="New file"
      >
        <HugeiconsIcon icon={FileAddIcon} size={13} strokeWidth={2} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        onClick={onCreateFolder}
        title="New folder"
      >
        <HugeiconsIcon icon={FolderAddIcon} size={13} strokeWidth={2} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        onClick={onRefresh}
        title="Refresh"
      >
        <HugeiconsIcon icon={Refresh01Icon} size={12} strokeWidth={2} />
      </Button>
    </div>
  );
}
