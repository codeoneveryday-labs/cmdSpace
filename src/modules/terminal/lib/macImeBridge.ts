import {
  createMacCompositionCommitFilter as createFilter,
  normalizeTerminalWhitespace,
  type ScheduleCompositionClear,
} from "./imeCompositionModel";

export const IS_MAC_TEXT_INPUT_PLATFORM =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export function createMacCompositionCommitFilter(
  scheduleClear?: ScheduleCompositionClear,
) {
  return createFilter(scheduleClear);
}

export function normalizeMacTerminalInput(value: string): string {
  return normalizeTerminalWhitespace(value);
}
