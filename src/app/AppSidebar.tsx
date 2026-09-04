import type { ComponentProps } from "react";
import { FileExplorer } from "@/modules/explorer";
import { SourceControlPanel } from "@/modules/source-control";
import { EditorSidebarRail, SidebarRail } from "@/modules/sidebar";

type Props = {
  sidebarView: ComponentProps<typeof SidebarRail>["activeView"];
  editorSidebarView: ComponentProps<typeof EditorSidebarRail>["activeView"];
  sidebarRail: Omit<ComponentProps<typeof SidebarRail>, "activeView">;
  editorRail: Omit<ComponentProps<typeof EditorSidebarRail>, "activeView">;
  explorer: ComponentProps<typeof FileExplorer>;
  sourceControl: ComponentProps<typeof SourceControlPanel>;
};

export function AppSidebar({
  sidebarView,
  editorSidebarView,
  sidebarRail,
  editorRail,
  explorer,
  sourceControl,
}: Props) {
  return (
    <>
      <SidebarRail {...sidebarRail} activeView={sidebarView} />
      <div className="min-h-0 flex-1">
        {sidebarView === "editor" ? (
          editorSidebarView === "files" ? (
            <FileExplorer {...explorer} />
          ) : (
            <SourceControlPanel {...sourceControl} />
          )
        ) : (
          <div className="h-full min-h-0" />
        )}
      </div>
      {sidebarView === "editor" ? (
        <EditorSidebarRail {...editorRail} activeView={editorSidebarView} />
      ) : null}
    </>
  );
}
