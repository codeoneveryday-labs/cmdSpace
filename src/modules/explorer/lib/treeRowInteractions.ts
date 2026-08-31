import { hasExceededDragThreshold } from "./internalDrag";

export type PointerDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

export function beginPointerDrag(
  button: number,
  pointerId: number,
  startX: number,
  startY: number,
): PointerDragState | null {
  if (button !== 0) return null;
  return {
    pointerId,
    startX,
    startY,
    dragging: false,
  };
}

export function updatePointerDrag(
  state: PointerDragState | null,
  pointerId: number,
  clientX: number,
  clientY: number,
): {
  handled: boolean;
  state: PointerDragState | null;
  didStartDragging: boolean;
  shouldNotifyMove: boolean;
} {
  if (!state || state.pointerId !== pointerId) {
    return {
      handled: false,
      state,
      didStartDragging: false,
      shouldNotifyMove: false,
    };
  }

  if (
    !state.dragging &&
    !hasExceededDragThreshold(
      { x: state.startX, y: state.startY },
      { x: clientX, y: clientY },
    )
  ) {
    return {
      handled: true,
      state,
      didStartDragging: false,
      shouldNotifyMove: false,
    };
  }

  if (state.dragging) {
    return {
      handled: true,
      state,
      didStartDragging: false,
      shouldNotifyMove: true,
    };
  }

  return {
    handled: true,
    state: { ...state, dragging: true },
    didStartDragging: true,
    shouldNotifyMove: true,
  };
}

export function finishPointerDrag(
  state: PointerDragState | null,
  pointerId: number,
): {
  handled: boolean;
  state: PointerDragState | null;
  shouldEnd: boolean;
  shouldSuppressClick: boolean;
} {
  if (!state || state.pointerId !== pointerId) {
    return {
      handled: false,
      state,
      shouldEnd: false,
      shouldSuppressClick: false,
    };
  }

  return {
    handled: true,
    state: null,
    shouldEnd: state.dragging,
    shouldSuppressClick: state.dragging,
  };
}

export function cancelPointerDrag(
  state: PointerDragState | null,
  pointerId: number,
): {
  handled: boolean;
  state: PointerDragState | null;
  shouldCancel: boolean;
} {
  if (!state || state.pointerId !== pointerId) {
    return {
      handled: false,
      state,
      shouldCancel: false,
    };
  }

  return {
    handled: true,
    state: null,
    shouldCancel: state.dragging,
  };
}

export function advanceDeleteConfirmation(isConfirming: boolean): {
  isConfirming: boolean;
  shouldDelete: boolean;
} {
  return isConfirming
    ? { isConfirming: false, shouldDelete: true }
    : { isConfirming: true, shouldDelete: false };
}
