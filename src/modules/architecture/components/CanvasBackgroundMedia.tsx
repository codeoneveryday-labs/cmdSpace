import { getBgImage } from "@/modules/theme/bgImageStore";
import { useBackgroundVideoPlayback } from "@/modules/theme/backgroundVideoPlayback";
import { useEffect, useRef, useState } from "react";

export function CanvasBackgroundMedia({ imageId }: { imageId: string | null }) {
  const [media, setMedia] = useState<{ url: string; type: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setMedia(null);
    if (!imageId) return;

    void getBgImage(imageId)
      .then((blob) => {
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        if (alive) setMedia({ url: objectUrl, type: blob.type });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  useBackgroundVideoPlayback(
    videoRef,
    media?.type.startsWith("video/") === true ? media.url : null,
  );

  if (!media) return null;
  if (media.type.startsWith("video/")) {
    return (
      <video
        ref={videoRef}
        aria-hidden
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        disablePictureInPicture
        preload="auto"
        className="cmdspace-canvas-background-video pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${media.url})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        pointerEvents: "none",
      }}
    />
  );
}
