/**
 * Shared registry of on-screen native browser rects.
 *
 * External URLs render in a native Tauri child webview (OS layer) that always
 * paints above all DOM, so no CSS z-index can lift floating UI (e.g. the
 * voice pill) over it. Browser panes publish their visible native bounds
 * here; floating elements read them to steer clear instead of sliding
 * underneath.
 */
export type NativeBrowserRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type NativeBrowserPoint = {
  left: number;
  top: number;
};

export type NativeBrowserSize = {
  width: number;
  height: number;
};

const published = new Map<string, NativeBrowserRect>();
const listeners = new Set<() => void>();

function sameRect(a: NativeBrowserRect, b: NativeBrowserRect): boolean {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

export function publishNativeBrowserBounds(
  id: string,
  rect: NativeBrowserRect | null,
): void {
  if (rect === null) {
    if (!published.delete(id)) return;
  } else {
    const prev = published.get(id);
    if (prev && sameRect(prev, rect)) return;
    published.set(id, { ...rect });
  }
  listeners.forEach((notify) => notify());
}

export function readNativeBrowserBounds(): NativeBrowserRect[] {
  return Array.from(published.values());
}

export function subscribeNativeBrowserBounds(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function clearNativeBrowserBoundsForTests(): void {
  published.clear();
  listeners.clear();
}

export function rectsOverlap(
  a: NativeBrowserRect,
  b: NativeBrowserRect,
): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/**
 * Pushes an overlapping moving rect out of an obstacle along the
 * smallest-penetration axis so the resting position stays fully visible.
 */
export function pushRectOutOf(
  moving: NativeBrowserRect,
  obstacle: NativeBrowserRect,
): NativeBrowserPoint {
  const moveRight = obstacle.left + obstacle.width - moving.left;
  const moveLeft = moving.left + moving.width - obstacle.left;
  const moveDown = obstacle.top + obstacle.height - moving.top;
  const moveUp = moving.top + moving.height - obstacle.top;
  const min = Math.min(moveRight, moveLeft, moveDown, moveUp);
  if (min === moveRight) return { left: moving.left + moveRight, top: moving.top };
  if (min === moveLeft) return { left: moving.left - moveLeft, top: moving.top };
  if (min === moveDown) return { left: moving.left, top: moving.top + moveDown };
  return { left: moving.left, top: moving.top - moveUp };
}

/**
 * Resolves a desired top-left against every obstacle rect. Runs a bounded
 * number of passes so pushing out of one browser cannot land inside another.
 */
export function avoidNativeBrowserBounds(
  desired: NativeBrowserPoint,
  size: NativeBrowserSize,
  obstacles: readonly NativeBrowserRect[],
): NativeBrowserPoint {
  let next = { ...desired };
  for (let pass = 0; pass <= obstacles.length; pass += 1) {
    let moved = false;
    for (const obstacle of obstacles) {
      const rect = { ...next, ...size };
      if (rectsOverlap(rect, obstacle)) {
        next = pushRectOutOf(rect, obstacle);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}
