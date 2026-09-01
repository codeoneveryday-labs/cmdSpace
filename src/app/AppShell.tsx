import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/modules/theme";
import type { ReactNode, RefObject } from "react";

export type AppShellProps = {
  mainShellRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/**
 * Owns the stable application shell boundary. Surface composition remains
 * owned by App.tsx; this component only guarantees provider and root-DOM
 * identity across workspace/tab state changes.
 */
export function AppShell({ mainShellRef, children }: AppShellProps) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div
          ref={mainShellRef}
          className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
        >
          {children}
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}
