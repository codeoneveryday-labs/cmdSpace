import { useRef, useState } from "react";

export function useCanvasHistory<T>({
  capture,
  restore,
  maxHistory,
}: {
  capture: () => T;
  restore: (snapshot: T) => void;
  maxHistory: number;
}) {
  const historyRef = useRef<T[]>([]);
  const [historySize, setHistorySize] = useState(0);

  const pushHistory = () => {
    historyRef.current = [
      ...historyRef.current.slice(-maxHistory + 1),
      capture(),
    ];
    setHistorySize(historyRef.current.length);
  };

  const undoCanvas = () => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    restore(snapshot);
    setHistorySize(historyRef.current.length);
  };

  return {
    historySize,
    canUndo: historyRef.current.length > 0,
    pushHistory,
    undoCanvas,
  };
}
