import type { GitChangedFile } from "@/modules/ai/lib/native";
import type { DiffMode } from "./sourceControlEntriesModel";

export type DiffSelection = {
  path: string;
  mode: DiffMode;
};

export type SelectionTransition = "none" | "moved-group" | "reset";

export function sameDiffSelection(
  left: DiffSelection | null,
  right: DiffSelection | null,
): boolean {
  return !!left && !!right && left.path === right.path && left.mode === right.mode;
}

export function reconcileDiffSelection(
  current: DiffSelection | null,
  changedFiles: readonly GitChangedFile[],
): { selection: DiffSelection | null; transition: SelectionTransition } {
  if (!current) return { selection: null, transition: "none" };
  const exists = changedFiles.some(
    (file) => file.path === current.path && (current.mode === "+" ? file.staged : file.unstaged),
  );
  if (exists) return { selection: current, transition: "none" };

  const samePathOtherMode = changedFiles.find(
    (file) => file.path === current.path && (current.mode === "+" ? file.unstaged : file.staged),
  );
  if (!samePathOtherMode) return { selection: null, transition: "reset" };

  return {
    selection: {
      path: samePathOtherMode.path,
      mode: current.mode === "+" ? "-" : "+",
    },
    transition: "moved-group",
  };
}
