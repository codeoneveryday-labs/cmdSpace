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

type TabSummary = { id: number; title?: string };

export function UnsavedChangesDialogs({
  tabs,
  pendingCloseTab,
  pendingDeleteTabs,
  onCancelClose,
  onConfirmClose,
  onCancelDelete,
  onConfirmDelete,
}: {
  tabs: readonly TabSummary[];
  pendingCloseTab: number | null;
  pendingDeleteTabs: number[] | null;
  onCancelClose: () => void;
  onConfirmClose: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const pendingCloseTitle = tabs.find((tab) => tab.id === pendingCloseTab)?.title;
  const deletedTitle =
    pendingDeleteTabs?.length === 1
      ? tabs.find((tab) => tab.id === pendingDeleteTabs[0])?.title
      : undefined;

  return (
    <>
      <AlertDialog
        open={pendingCloseTab !== null}
        onOpenChange={(open) => !open && onCancelClose()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCloseTitle
                ? `"${pendingCloseTitle}" has unsaved changes. Close anyway?`
                : "This file has unsaved changes. Close anyway?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmClose}>
              Close Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteTabs !== null}
        onOpenChange={(open) => !open && onCancelDelete()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteTabs?.length === 1
                ? deletedTitle
                  ? `"${deletedTitle}" has unsaved changes. The file has been deleted. Close anyway?`
                  : "This file has unsaved changes. The file has been deleted. Close anyway?"
                : `${pendingDeleteTabs?.length ?? 0} files have unsaved changes. They have been deleted. Close all anyway?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete}>
              Close Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
