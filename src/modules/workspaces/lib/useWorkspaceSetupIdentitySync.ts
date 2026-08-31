import { useEffect } from "react";
import { normalizeWorkspaceAccentColor } from "../WorkspaceRowPrimitives";

export function useWorkspaceSetupIdentitySync({
  suggestedWorkspaceName,
  suggestedWorkspaceColor,
  setWorkspaceName,
  setWorkspaceColor,
}: {
  suggestedWorkspaceName: string;
  suggestedWorkspaceColor: string;
  setWorkspaceName: (name: string) => void;
  setWorkspaceColor: (color: string) => void;
}) {
  useEffect(() => {
    setWorkspaceName(suggestedWorkspaceName);
  }, [setWorkspaceName, suggestedWorkspaceName]);

  useEffect(() => {
    setWorkspaceColor(normalizeWorkspaceAccentColor(suggestedWorkspaceColor));
  }, [setWorkspaceColor, suggestedWorkspaceColor]);
}
