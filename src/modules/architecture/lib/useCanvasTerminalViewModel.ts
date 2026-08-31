import { useMemo } from "react";
import type { ArchitectureTerminalDockGroup } from "./architectureCanvasTypes";
import {
  layoutTerminalDockDividers,
  layoutTerminalDockGroups,
  projectMaximizedTerminalDockGroups,
  type TerminalDockDividerLayout,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";

export function useCanvasTerminalViewModel({
  terminalDockGroups,
  maximizedTerminalId,
  view,
  viewWidth,
  viewHeight,
}: {
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  maximizedTerminalId: string;
  view: { x: number; y: number; scale: number };
  viewWidth: number;
  viewHeight: number;
}): {
  terminalLayouts: TerminalDockStackLayout[];
  terminalLayoutById: Map<string, TerminalDockStackLayout>;
  maximizedTerminalGroupId: string;
  renderedTerminalDockGroups: ArchitectureTerminalDockGroup[];
  renderedTerminalLayouts: TerminalDockStackLayout[];
  renderedTerminalLayoutById: Map<string, TerminalDockStackLayout>;
  renderedTerminalDockDividers: TerminalDockDividerLayout[];
} {
  const terminalLayouts = useMemo(
    () => layoutTerminalDockGroups(terminalDockGroups),
    [terminalDockGroups],
  );
  const terminalLayoutById = useMemo(
    () =>
      new Map(
        terminalLayouts.flatMap((layout) =>
          layout.terminalIds.map((terminalId) => [terminalId, layout] as const),
        ),
      ),
    [terminalLayouts],
  );
  const maximizedTerminalGroupId = maximizedTerminalId
    ? terminalLayoutById.get(maximizedTerminalId)?.groupId ?? ""
    : "";
  const renderedTerminalDockGroups = useMemo(
    () =>
      projectMaximizedTerminalDockGroups(
        terminalDockGroups,
        maximizedTerminalId,
        {
          x: view.x + 32,
          y: view.y + 32,
          width: Math.max(320, viewWidth - 64),
          height: Math.max(200, viewHeight - 64),
        },
      ),
    [
      maximizedTerminalId,
      terminalDockGroups,
      view.x,
      view.y,
      viewHeight,
      viewWidth,
    ],
  );
  const renderedTerminalLayouts = useMemo(
    () => layoutTerminalDockGroups(renderedTerminalDockGroups),
    [renderedTerminalDockGroups],
  );
  const renderedTerminalLayoutById = useMemo(
    () =>
      new Map(
        renderedTerminalLayouts.flatMap((layout) =>
          layout.terminalIds.map((terminalId) => [terminalId, layout] as const),
        ),
      ),
    [renderedTerminalLayouts],
  );
  const renderedTerminalDockDividers = useMemo(
    () => layoutTerminalDockDividers(renderedTerminalDockGroups),
    [renderedTerminalDockGroups],
  );

  return {
    terminalLayouts,
    terminalLayoutById,
    maximizedTerminalGroupId,
    renderedTerminalDockGroups,
    renderedTerminalLayouts,
    renderedTerminalLayoutById,
    renderedTerminalDockDividers,
  };
}
