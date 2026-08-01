import {
  readBgFastPath,
  usePreferencesStore,
} from "@/modules/settings/preferences";
import { BG_OPACITY_RENDER_FACTOR } from "@/modules/settings/store";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackgroundVideoPlayback } from "./backgroundVideoPlayback";

const OVERLAY_Z = 2147483646;
const RESIZE_IDLE_MS = 280;
const FADE_IN_MS = 200;

export function SurfaceLayer() {
  const [fastPath] = useState(readBgFastPath);
  const storeActive = usePreferencesStore(
    (s) => s.backgroundKind === "image" && !!s.backgroundImageId,
  );
  const hydrated = usePreferencesStore((s) => s.hydrated);
  const active = hydrated ? storeActive : fastPath.active;
  if (!active) return null;
  return <BackgroundMedia fastImageId={fastPath.imageId} />;
}

function BackgroundMedia({ fastImageId }: { fastImageId: string | null }) {
  const storeImageId = usePreferencesStore((s) => s.backgroundImageId);
  const hydrated = usePreferencesStore((s) => s.hydrated);
  const imageId = hydrated ? storeImageId : fastImageId;
  const opacity = usePreferencesStore((s) => s.backgroundOpacity);
  const blur = usePreferencesStore((s) => s.backgroundBlur);
  const [media, setMedia] = useState<{
    url: string;
    type: string;
    animated: boolean;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const lastUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resizing = useWindowResizing(RESIZE_IDLE_MS);
  const docHidden = useDocumentHidden();

  useEffect(() => {
    if (!imageId) return;
    let alive = true;
    let rafId: number | null = null;
    setVisible(false);
    void (async () => {
      const { getBgImage } = await import("./bgImageStore");
      const blob = await getBgImage(imageId).catch(() => null);
      if (!alive || !blob) return;
      const url = URL.createObjectURL(blob);
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = url;
      const t = blob.type.toLowerCase();
      const animated =
        t === "image/gif" || t === "image/apng" || t === "image/webp";
      setMedia({ url, type: t, animated });
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (alive) setVisible(true);
      });
    })();
    return () => {
      alive = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [imageId]);

  useBackgroundVideoPlayback(
    videoRef,
    media?.type.startsWith("video/") === true ? media.url : null,
  );

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
    };
  }, []);

  if (!media || typeof document === "undefined") return null;
  const { url, animated } = media;
  const isVideo = media.type.startsWith("video/");

  const suspendAnimated = animated && (resizing || docHidden);
  const blurActive = !animated && blur > 0 && !resizing;
  const renderedOpacity =
    visible && !suspendAnimated ? opacity * BG_OPACITY_RENDER_FACTOR : 0;

  return createPortal(
    <div
      aria-hidden
      className="cmdspace-bg-surface"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: OVERLAY_Z,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundImage:
          isVideo || suspendAnimated ? "none" : `url(${url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: renderedOpacity,
        filter: blurActive ? `blur(${blur}px)` : undefined,
        transform: "translateZ(0)",
        transition: `opacity ${FADE_IN_MS}ms ease-out`,
      }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
      ) : null}
    </div>,
    document.body,
  );
}

function useWindowResizing(idleMs: number): boolean {
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    let timer: number | null = null;
    let active = false;
    const onResize = () => {
      if (!active) {
        active = true;
        setResizing(true);
      }
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        active = false;
        setResizing(false);
        timer = null;
      }, idleMs);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [idleMs]);
  return resizing;
}

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return hidden;
}
