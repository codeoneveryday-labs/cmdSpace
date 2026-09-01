import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function WorkspaceDeleteDialog({
  open,
  workspaceName,
  doNotAskAgain,
  onDoNotAskAgainChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  workspaceName: string;
  doNotAskAgain: boolean;
  onDoNotAskAgainChange: (checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent
        className="max-w-[calc(100%-2rem)] gap-5 rounded-[28px] p-5 shadow-2xl shadow-black/15 ring-black/5 sm:max-w-[420px]"
        overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-[2px]"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
            <HugeiconsIcon icon={Delete02Icon} size={20} strokeWidth={1.8} />
          </div>
          <AlertDialogHeader className="min-w-0 place-items-start gap-1 text-left sm:place-items-start sm:text-left">
            <AlertDialogTitle className="text-base leading-6 font-semibold">
              Delete workspace?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-5">
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{workspaceName}</span>{" "}
              and close its terminal panes.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <Label className="group flex min-h-10 cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
          <Checkbox
            checked={doNotAskAgain}
            onCheckedChange={(checked) => onDoNotAskAgainChange(checked === true)}
            aria-label="Do not ask again before deleting workspaces"
            className="bg-background shadow-sm group-hover:border-border"
          />
          <span>Do not ask again</span>
        </Label>

        <AlertDialogFooter className="gap-2 sm:justify-end">
          <AlertDialogCancel variant="ghost" onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="bg-destructive px-4 text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90 focus-visible:border-destructive/50 focus-visible:ring-destructive/25"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
