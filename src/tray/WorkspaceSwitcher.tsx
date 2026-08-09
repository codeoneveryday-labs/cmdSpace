import { cn } from "@/lib/utils";
import {
  CanvasIcon,
  ComputerTerminal02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampSelectionIndex,
  filterTrayWorkspaces,
  type TrayWorkspace,
} from "./workspaces";

function workspaceSubtitle(workspace: TrayWorkspace): string {
  if (workspace.workingFolder) return workspace.workingFolder;
  return workspace.workspaceMode === "canvas"
    ? "Canvas workspace"
    : "Terminal workspace";
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<TrayWorkspace[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleWorkspaces = useMemo(
    () => filterTrayWorkspaces(workspaces, query),
    [query, workspaces],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await invoke<TrayWorkspace[]>("db_list_workspaces");
      setWorkspaces(next);
      setSelectedIndex(next.length > 0 ? 0 : -1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  const hide = useCallback(() => {
    void invoke("hide_workspace_switcher");
  }, []);

  const openWorkspace = useCallback((workspaceId: string) => {
    void invoke("open_workspace_from_tray", { workspaceId });
  }, []);

  useEffect(() => {
    void refresh();
    const unlistenOpen = listen("cmdspace:tray-opened", () => {
      setQuery("");
      setSelectedIndex(0);
      void refresh();
      window.setTimeout(() => searchRef.current?.focus(), 0);
    });
    const unlistenFocus = getCurrentWindow().onFocusChanged(
      ({ payload: focused }) => {
        if (!focused) hide();
      },
    );

    return () => {
      void unlistenOpen.then((unlisten) => unlisten());
      void unlistenFocus.then((unlisten) => unlisten());
    };
  }, [hide, refresh]);

  useEffect(() => {
    setSelectedIndex((current) =>
      clampSelectionIndex(current, visibleWorkspaces.length),
    );
  }, [visibleWorkspaces.length]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleWorkspaces.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setSelectedIndex((current) => {
        const next = current < 0 ? 0 : current + delta;
        return (next + visibleWorkspaces.length) % visibleWorkspaces.length;
      });
      return;
    }
    if (event.key === "Enter") {
      const workspace = visibleWorkspaces[selectedIndex];
      if (workspace) {
        event.preventDefault();
        openWorkspace(workspace.id);
      }
    }
  };

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-transparent p-2 pt-3 text-foreground"
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1.5 size-4 -translate-x-1/2 rotate-45 border-l border-t border-border/80 bg-popover"
      />
      <section className="relative flex h-full flex-col overflow-hidden rounded-[18px] border border-border/80 bg-popover/98 shadow-2xl shadow-black/25 supports-backdrop-filter:backdrop-blur-2xl">
        <header className="border-b border-border/70 px-4 pb-3 pt-4">
          <h1 className="text-[15px] font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Jump back into cmdSpace
          </p>
          <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-muted/55 px-3 text-muted-foreground focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
            <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} />
            <input
              ref={searchRef}
              aria-label="Search workspaces"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search workspaces"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
            />
          </label>
        </header>

        <div
          aria-label="Workspace results"
          className="min-h-0 flex-1 overflow-y-auto p-2"
          role="listbox"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading workspaces…
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium">Could not load workspaces</p>
              <button
                className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent"
                onClick={() => void refresh()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : visibleWorkspaces.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {workspaces.length === 0
                ? "No workspaces yet"
                : "No matching workspaces"}
            </div>
          ) : (
            visibleWorkspaces.map((workspace, index) => {
              const canvas = workspace.workspaceMode === "canvas";
              const selected = index === selectedIndex;
              return (
                <button
                  key={workspace.id}
                  aria-selected={selected}
                  className={cn(
                    "group flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/70 focus-visible:bg-muted/70",
                  )}
                  onClick={() => openWorkspace(workspace.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  role="option"
                  type="button"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/70"
                    style={{ color: workspace.accentColor ?? undefined }}
                  >
                    <HugeiconsIcon
                      icon={canvas ? CanvasIcon : ComputerTerminal02Icon}
                      size={18}
                      strokeWidth={1.8}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {workspace.name}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-xs text-muted-foreground"
                      title={workspaceSubtitle(workspace)}
                    >
                      {workspaceSubtitle(workspace)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
                    {workspace.count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
          <span>{workspaces.length} workspaces</span>
          <span>↑↓ Select · ↵ Open · esc Close</span>
        </footer>
      </section>
    </main>
  );
}
