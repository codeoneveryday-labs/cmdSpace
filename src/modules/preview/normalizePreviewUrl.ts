export function normalizePreviewUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(:|\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  if (/^\d{1,3}(\.\d{1,3}){3}(:|\/|$)/.test(trimmed)) {
    return `http://${trimmed}`;
  }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}
