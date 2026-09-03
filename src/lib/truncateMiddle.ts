export type TruncateMiddleOptions = {
  /** Maximum total string length including ellipsis and extension. Defaults to 26. */
  maxLength?: number;
  /** Delimiter used in the middle. Defaults to "..." */
  ellipsis?: string;
  /** Fraction of budget given to prefix vs suffix (0 to 1). Defaults to 0.6 (60% start, 40% end). */
  prefixRatio?: number;
  /** Whether to detect and preserve file extensions (e.g., ".tsx", ".tar.gz"). Defaults to true. */
  preserveExtension?: boolean;
};

/**
 * Truncates a string in the middle ("start...end"), preserving file extensions
 * when present ("start...end.ext").
 *
 * Examples:
 * - "Super long nameaaaaaaaaaaaaaaaaaaaa" -> "Super long nam...aaaaaaaaa"
 * - "SuperLongComponentController.tsx" -> "SuperLongCom...roller.tsx"
 * - "archive-backup-2026.tar.gz" -> "archive-...2026.tar.gz"
 */
export function truncateMiddle(
  text: string | null | undefined,
  maxLength = 26,
  options: TruncateMiddleOptions = {},
): string {
  if (!text) return "";
  const targetMax = options.maxLength ?? maxLength;
  if (text.length <= targetMax) return text;

  const ellipsis = options.ellipsis ?? "...";
  if (targetMax <= ellipsis.length) {
    return ellipsis.slice(0, targetMax);
  }

  const preserveExtension = options.preserveExtension ?? true;
  const prefixRatio = Math.max(0.2, Math.min(0.8, options.prefixRatio ?? 0.6));

  let ext = "";
  let base = text;

  if (preserveExtension) {
    // Check known compound extensions first (.tar.gz, .d.ts, .test.tsx, .config.js, etc.)
    const compoundMatch = text.match(
      /\.(?:tar\.gz|d\.ts|test\.[a-z0-9]+|spec\.[a-z0-9]+|config\.[a-z0-9]+)$/i,
    );
    if (compoundMatch && text.length > compoundMatch[0].length + 2) {
      ext = compoundMatch[0];
      base = text.slice(0, -ext.length);
    } else {
      const lastDot = text.lastIndexOf(".");
      // Extension must be 1-8 chars, alphanumeric, not starting at index 0 (e.g. .gitignore)
      if (lastDot > 0 && lastDot < text.length - 1) {
        const candidateExt = text.slice(lastDot);
        if (candidateExt.length <= 8 && /^\.[a-zA-Z0-9]+$/.test(candidateExt)) {
          ext = candidateExt;
          base = text.slice(0, lastDot);
        }
      }
    }
  }

  const budget = targetMax - ellipsis.length - ext.length;
  if (budget <= 2) {
    const minPrefix = Math.max(1, targetMax - ellipsis.length - ext.length);
    return `${text.slice(0, minPrefix)}${ellipsis}${ext}`;
  }

  const prefixLen = Math.max(1, Math.round(budget * prefixRatio));
  const suffixLen = Math.max(1, budget - prefixLen);

  const prefix = base.slice(0, prefixLen);
  const suffix = base.slice(-suffixLen);

  return `${prefix}${ellipsis}${suffix}${ext}`;
}
