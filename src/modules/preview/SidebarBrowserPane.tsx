import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Alert02Icon,
  Globe02Icon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PreviewAddressBar,
  type PreviewAddressBarHandle,
} from "./PreviewAddressBar";
import { intersectBrowserBounds } from "./browserBounds";

type Props = {
  url: string;
  visible: boolean;
  resizing?: boolean;
  boundsRevision?: string | number;
  onUrlChange: (url: string) => void;
};

export function SidebarBrowserPane({
  url,
  visible,
  resizing = false,
  boundsRevision,
  onUrlChange,
}: Props) {
  const addressRef = useRef<PreviewAddressBarHandle>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<Webview | null>(null);
  const webviewUrlRef = useRef("");
  const webviewLabelRef = useRef(
    `sidebar-browser-${Math.random().toString(36).slice(2)}`,
  );
  const normalizedUrl = useMemo(() => normalizeBrowserUrl(url), [url]);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const useNativeWebview = hasTauriWebviewRuntime();
  const nativeLayerBlocked = useNativeLayerBlocker();
  const nativeInteractionBlocked = nativeLayerBlocked || resizing;
  const [history, setHistory] = useState<string[]>(() =>
    normalizedUrl ? [normalizedUrl] : [],
  );
  const [historyIndex, setHistoryIndex] = useState(() =>
    normalizedUrl ? 0 : -1,
  );
  const historyUrl =
    historyIndex >= 0 && historyIndex < history.length
      ? history[historyIndex]
      : "";
  const canGoBack = historyIndex > 0;
  const canGoForward =
    historyIndex >= 0 && historyIndex < history.length - 1;

  const pushHistory = useCallback(
    (nextUrl: string) => {
      if (!nextUrl || nextUrl === historyUrl) return;
      setHistory((current) => [
        ...current.slice(0, Math.max(historyIndex + 1, 0)),
        nextUrl,
      ]);
      setHistoryIndex((index) => Math.max(index + 1, 0));
    },
    [historyIndex, historyUrl],
  );

  useEffect(() => {
    if (!normalizedUrl || normalizedUrl === historyUrl) return;
    pushHistory(normalizedUrl);
  }, [historyUrl, normalizedUrl, pushHistory]);

  const handleSubmitUrl = useCallback(
    (nextUrl: string) => {
      const normalized = normalizeBrowserUrl(nextUrl);
      if (!normalized) return;
      pushHistory(normalized);
      onUrlChange(normalized);
    },
    [onUrlChange, pushHistory],
  );

  const handleBack = useCallback(() => {
    if (!canGoBack) return;
    const nextIndex = historyIndex - 1;
    const nextUrl = history[nextIndex];
    if (!nextUrl) return;
    setHistoryIndex(nextIndex);
    onUrlChange(nextUrl);
  }, [canGoBack, history, historyIndex, onUrlChange]);

  const handleForward = useCallback(() => {
    if (!canGoForward) return;
    const nextIndex = historyIndex + 1;
    const nextUrl = history[nextIndex];
    if (!nextUrl) return;
    setHistoryIndex(nextIndex);
    onUrlChange(nextUrl);
  }, [canGoForward, history, historyIndex, onUrlChange]);

  const handleReload = useCallback(() => {
    if (!normalizedUrl) return;
    if (useNativeWebview) {
      webviewUrlRef.current = "";
    }
    setReloadNonce((value) => value + 1);
  }, [normalizedUrl, useNativeWebview]);

  useEffect(() => {
    setError(null);
  }, [normalizedUrl, reloadNonce]);

  const getVisibleNativeBounds = useCallback(() => {
    const host = hostRef.current;
    if (!host) return null;

    const rect = host.getBoundingClientRect();
    const viewport = host.closest<HTMLElement>(
      '[data-canvas-surface-viewport="true"]',
    );
    if (!viewport) return rect;

    return intersectBrowserBounds(rect, viewport.getBoundingClientRect());
  }, []);

  const syncNativeBounds = useCallback(async (): Promise<boolean> => {
    const webview = webviewRef.current;
    if (!webview) return false;

    const visibleBounds = getVisibleNativeBounds();
    if (!visibleBounds) {
      await webview.hide().catch(() => {});
      return false;
    }

    await Promise.all([
      webview.setPosition(
        new LogicalPosition(visibleBounds.left, visibleBounds.top),
      ),
      webview.setSize(
        new LogicalSize(visibleBounds.width, visibleBounds.height),
      ),
    ]);
    return true;
  }, [getVisibleNativeBounds]);

  const closeNativeWebview = useCallback(async () => {
    const webview = webviewRef.current;
    webviewRef.current = null;
    webviewUrlRef.current = "";
    if (webview) await webview.close().catch(() => {});
  }, []);

  useEffect(() => {
    if (!useNativeWebview) return;
    if (!visible || !normalizedUrl || nativeInteractionBlocked) {
      void webviewRef.current?.hide().catch(() => {});
      return;
    }

    let cancelled = false;

    const show = async () => {
      try {
        if (webviewRef.current && webviewUrlRef.current !== normalizedUrl) {
          await closeNativeWebview();
        }

        if (!webviewRef.current) {
          const visibleBounds = getVisibleNativeBounds();
          if (!visibleBounds) return;
          const webview = new Webview(
            getCurrentWindow(),
            webviewLabelRef.current,
            {
              url: normalizedUrl,
              x: visibleBounds.left,
              y: visibleBounds.top,
              width: visibleBounds.width,
              height: visibleBounds.height,
              focus: false,
              dragDropEnabled: false,
            },
          );
          webviewRef.current = webview;
          webviewUrlRef.current = normalizedUrl;
          webview.once("tauri://error", (event) => {
            setError(String(event.payload ?? "Unable to create browser view."));
          });
          webview.once("tauri://created", () => {
            if (cancelled) {
              void webview.hide().catch(() => {});
              return;
            }
            void invoke("set_webview_corner_radius", {
              label: webviewLabelRef.current,
              radius: 12,
            })
              .then(syncNativeBounds)
              .then((inViewport) =>
                inViewport ? webview.show() : undefined,
              )
              .catch((reason) => setError(String(reason)));
          });
          return;
        }

        const inViewport = await syncNativeBounds();
        if (!cancelled && inViewport) await webviewRef.current.show();
      } catch (reason) {
        setError(String(reason));
      }
    };

    void show();
    return () => {
      cancelled = true;
    };
  }, [
    closeNativeWebview,
    boundsRevision,
    getVisibleNativeBounds,
    normalizedUrl,
    reloadNonce,
    nativeInteractionBlocked,
    syncNativeBounds,
    useNativeWebview,
    visible,
  ]);

  useEffect(() => {
    if (!useNativeWebview) return;
    const host = hostRef.current;
    if (!host) return;

    const resizeObserver = new ResizeObserver(() => {
      void syncNativeBounds().catch(() => {});
    });
    resizeObserver.observe(host);
    const viewport = host.closest<HTMLElement>(
      '[data-canvas-surface-viewport="true"]',
    );
    if (viewport) resizeObserver.observe(viewport);

    const onWindowChange = () => {
      void syncNativeBounds().catch(() => {});
    };
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [syncNativeBounds, useNativeWebview]);

  useEffect(() => {
    if (!useNativeWebview) return;
    void syncNativeBounds().catch(() => {});
  }, [boundsRevision, syncNativeBounds, useNativeWebview]);

  useEffect(() => {
    return () => {
      void closeNativeWebview();
    };
  }, [closeNativeWebview]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border/60 bg-background">
      <PreviewAddressBar
        ref={addressRef}
        url={url}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={handleBack}
        onForward={handleForward}
        onSubmit={handleSubmitUrl}
        onReload={handleReload}
      />
      {error ? <BrowserError message={error} url={normalizedUrl} /> : null}
      <div
        ref={hostRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-white"
      >
        {!normalizedUrl ? (
          <EmptyBrowserState />
        ) : useNativeWebview ? (
          <NativeBrowserState url={normalizedUrl} />
        ) : visible ? (
          <iframe
            key={`${normalizedUrl}:${reloadNonce}`}
            title="Sidebar browser"
            src={normalizedUrl}
            className={cn(
              "h-full w-full border-0 bg-white",
              resizing && "pointer-events-none",
            )}
            sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            onError={() => setError("Unable to load page in sidebar browser.")}
          />
        ) : null}
        {resizing ? (
          <div className="absolute inset-0 z-10 cursor-col-resize" />
        ) : null}
      </div>
    </div>
  );
}

function NativeBrowserState({ url }: { url: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-white">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void openUrl(url).catch(console.error)}
        className="pointer-events-auto m-3 h-7 gap-1.5 bg-background/85 text-[11px] shadow"
      >
        <HugeiconsIcon icon={LinkSquare02Icon} size={13} strokeWidth={1.75} />
        External
      </Button>
    </div>
  );
}

function EmptyBrowserState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-card text-muted-foreground">
        <HugeiconsIcon icon={Globe02Icon} size={20} strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Open a browser</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Type a URL above or use Ports for a running local dev server.
        </p>
      </div>
    </div>
  );
}

function BrowserError({ message, url }: { message: string; url: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
      <HugeiconsIcon
        icon={Alert02Icon}
        size={13}
        strokeWidth={1.75}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate">{message}</span>
      {url ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void openUrl(url).catch(console.error)}
          className="h-6 shrink-0 gap-1 px-1.5 text-[11px] text-destructive hover:bg-destructive/10"
        >
          <HugeiconsIcon icon={LinkSquare02Icon} size={12} strokeWidth={1.75} />
          Open
        </Button>
      ) : null}
    </div>
  );
}

const BLOCKING_DIALOG_SELECTOR = [
  '[data-slot="dialog-content"][data-state="open"]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
].join(", ");

function useNativeLayerBlocker(): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateBlocked = () => {
      setBlocked(document.querySelector(BLOCKING_DIALOG_SELECTOR) !== null);
    };

    updateBlocked();

    if (typeof MutationObserver === "undefined") return;

    const target = document.body ?? document.documentElement;
    if (!target) return;

    const observer = new MutationObserver(updateBlocked);
    observer.observe(target, {
      attributeFilter: ["data-state", "role"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return blocked;
}

function normalizeBrowserUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(:|\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  if (/^\d{1,3}(\.\d{1,3}){3}(:|\/|$)/.test(trimmed)) {
    return `http://${trimmed}`;
  }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function hasTauriWebviewRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    typeof window.ResizeObserver !== "undefined"
  );
}
