import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft01Icon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  Globe02Icon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { PORT_PRESETS } from "./constants";
import { normalizePreviewUrl } from "./normalizePreviewUrl";

export type PreviewAddressBarHandle = {
  focus: () => void;
};

type Props = {
  url: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  onSubmit: (url: string) => void;
  onReload: () => void;
};

export const PreviewAddressBar = forwardRef<PreviewAddressBarHandle, Props>(
  function PreviewAddressBar({
    url,
    canGoBack = false,
    canGoForward = false,
    onBack,
    onForward,
    onSubmit,
    onReload,
  }, ref) {
    const [draft, setDraft] = useState(url);
    const inputRef = useRef<HTMLInputElement>(null);
    const portsButtonRef = useRef<HTMLButtonElement>(null);

    // Keep draft in sync when the parent updates the URL externally
    // (AI tool, detected localhost chip, etc.).
    useEffect(() => {
      setDraft(url);
    }, [url]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          el.select();
        },
      }),
      [],
    );

    const [notice, setNotice] = useState<string | null>(null);
    const [checkingPort, setCheckingPort] = useState<number | null>(null);

    const submit = () => {
      const next = normalizePreviewUrl(draft);
      if (!next) {
        setNotice("Enter a URL or pick a port preset.");
        return;
      }
      setNotice(null);
      if (next !== url) onSubmit(next);
      else onReload();
    };

    const tryPort = async (port: number) => {
      setNotice(null);
      setCheckingPort(port);
      const url = `http://localhost:${port}`;
      const ok = await probeUrl(url);
      setCheckingPort(null);
      if (!ok) {
        setNotice(`No server listening on :${port}.`);
        return;
      }
      setDraft(url);
      onSubmit(url);
    };

    const openPortsMenu = async () => {
      setNotice(null);
      const menu = await Menu.new({
        items: PORT_PRESETS.map((preset) => ({
          id: `preview-port-${preset.port}`,
          text: `${preset.label}    :${preset.port}`,
          action: () => {
            void tryPort(preset.port);
          },
        })),
      });
      const rect = portsButtonRef.current?.getBoundingClientRect();
      await menu.popup(
        rect
          ? new LogicalPosition(Math.round(rect.left), Math.round(rect.bottom + 4))
          : undefined,
      );
    };

    return (
      <div className="shrink-0 border-b border-border/60">
        <div className="flex h-9 items-center gap-1 bg-card/40 px-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            title="Back"
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35"
            disabled={!canGoBack}
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={14}
              strokeWidth={1.75}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onForward}
            title="Forward"
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35"
            disabled={!canGoForward}
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={14}
              strokeWidth={1.75}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onReload}
            title="Reload"
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon
              icon={ArrowReloadHorizontalIcon}
              size={14}
              strokeWidth={1.75}
            />
          </Button>
          <Button
            ref={portsButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            title="Common dev-server ports"
            onClick={() => void openPortsMenu().catch(console.error)}
            className="h-7 shrink-0 gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Globe02Icon} size={13} strokeWidth={1.75} />
            <span className="hidden sm:inline">
              {checkingPort ? `:${checkingPort}` : "Ports"}
            </span>
          </Button>
          <div className="flex min-w-0 flex-1 items-center">
            <Input
              ref={inputRef}
              value={draft}
              placeholder="http://localhost:3000"
              spellCheck={false}
              autoComplete="off"
              className="h-7 w-full bg-muted/60 px-2 text-xs placeholder:text-muted-foreground/70 focus-visible:ring-0"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setDraft(url);
                  inputRef.current?.blur();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (url) void openUrl(url).catch(console.error);
            }}
            title="Open in system browser"
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            disabled={!url}
          >
            <HugeiconsIcon
              icon={LinkSquare02Icon}
              size={14}
              strokeWidth={1.75}
            />
          </Button>
        </div>
        {notice ? (
          <div className="flex items-center gap-1.5 bg-amber-500/8 px-3 py-1 text-[11px] text-amber-600 dark:text-amber-400">
            <span className="truncate">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="ml-auto rounded px-1 text-[10px] opacity-80 hover:bg-accent hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    );
  },
);

async function probeUrl(url: string): Promise<boolean> {
  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(900),
    });
    return true;
  } catch {
    return false;
  }
}
