import type { SerializeAddon } from "@xterm/addon-serialize";
import type { Terminal } from "@xterm/xterm";

export type RendererSerializeOutput = {
  snapshot: string | null;
  cols: number;
  rows: number;
  altScreen: boolean;
};

type SerializableRendererSlot = {
  term: Terminal;
  serializeAddon: SerializeAddon;
};

export function serializeRendererSlot(
  slot: SerializableRendererSlot,
  scrollback: number,
  altScreen: boolean,
): RendererSerializeOutput {
  let snapshot: string | null = null;
  try {
    snapshot = slot.serializeAddon.serialize({ scrollback });
  } catch (error) {
    console.warn("[cmdspace] serialize failed:", error);
  }
  return {
    snapshot,
    cols: slot.term.cols,
    rows: slot.term.rows,
    altScreen,
  };
}
