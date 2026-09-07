import { cn } from "@/lib/utils";
import cliSpinners from "cli-spinners";
import { useEffect, useState } from "react";

export const SPINNER_FRAMES = cliSpinners.dots.frames;
export const SPINNER_FRAME_INTERVAL = cliSpinners.dots.interval;

export function spinnerFrame(index: number): string {
  return SPINNER_FRAMES[index % SPINNER_FRAMES.length] ?? SPINNER_FRAMES[0];
}

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setFrameIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % SPINNER_FRAMES.length);
    }, SPINNER_FRAME_INTERVAL);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "relative inline-flex h-4 w-3 shrink-0 items-center justify-center",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="font-mono leading-none">
        {spinnerFrame(frameIndex)}
      </span>
    </span>
  );
}

export { Spinner };
