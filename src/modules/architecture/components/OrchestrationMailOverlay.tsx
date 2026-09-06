import { useEffect, useRef } from "react";

import type { ArchitectureNode } from "../lib/architectureCanvasTypes";
import {
  resolveMailFlightEndpoints,
  type OrchestrationMailFlight,
} from "../lib/orchestrationMailFlights";
import type { OrchestrationMailFlightSeed } from "../lib/useCanvasOrchestrationRun";
import type { OrchestrationRun } from "../lib/orchestrationRuntime";

const FLIGHT_MS = 1150;
const ARC_LIFT = 60;

function MailEnvelope({
  flight,
  view,
  viewWidth,
  viewHeight,
  onDone,
}: {
  flight: OrchestrationMailFlight;
  view: { x: number; y: number };
  viewWidth: number;
  viewHeight: number;
  onDone: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const element = ref.current;
      if (!element) return;
      const progress = Math.min(1, (now - startedAt) / FLIGHT_MS);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      const x = flight.from.x + (flight.to.x - flight.from.x) * eased;
      const y =
        flight.from.y +
        (flight.to.y - flight.from.y) * eased -
        Math.sin(progress * Math.PI) * ARC_LIFT;
      const opacity = progress < 0.15 ? progress / 0.15 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
      element.style.left = `${((x - view.x) / viewWidth) * 100}%`;
      element.style.top = `${((y - view.y) / viewHeight) * 100}%`;
      element.style.opacity = `${Math.max(0, Math.min(1, opacity))}`;
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        onDone(flight.key);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [flight, view.x, view.y, viewWidth, viewHeight, onDone]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute z-20"
      style={{ transform: "translate(-50%, -50%)" }}
    >
      <svg width="30" height="20" viewBox="0 0 30 20" style={{ display: "block" }}>
        <rect x="1" y="1" width="28" height="18" rx="2.5" fill={flight.tint} />
        <path
          d="M2 3 L15 12 L28 3"
          fill="none"
          stroke="#0b0c10"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * Mail envelopes flying between worker terminal nodes when the hive routes
 * a message — sender desk to recipient desk, tinted by speech act. Pure
 * overlay: pointer-events-none, capped upstream, self-removing on arrival.
 */
export function OrchestrationMailOverlay({
  run,
  nodes,
  flights,
  view,
  viewWidth,
  viewHeight,
  onFlightDone,
}: {
  run: OrchestrationRun | null;
  nodes: readonly ArchitectureNode[];
  flights: OrchestrationMailFlightSeed[];
  view: { x: number; y: number };
  viewWidth: number;
  viewHeight: number;
  onFlightDone: (key: string) => void;
}) {
  if (!run || flights.length === 0) return null;
  const resolved = flights.flatMap((seed) =>
    resolveMailFlightEndpoints(run, nodes, seed.from, seed.to, seed.act),
  );
  if (resolved.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {resolved.map((flight) => (
        <MailEnvelope
          key={flight.key}
          flight={flight}
          view={view}
          viewWidth={viewWidth}
          viewHeight={viewHeight}
          onDone={onFlightDone}
        />
      ))}
    </div>
  );
}
