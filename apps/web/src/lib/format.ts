export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = date.getTime() - Date.now();
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), "second");
  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60_000), "minute");
  const absHr = Math.round(absMin / 60);
  if (absHr < 24) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  const absDay = Math.round(absHr / 24);
  if (absDay < 30) return rtf.format(Math.round(diffMs / 86_400_000), "day");
  return date.toLocaleDateString();
}

export function truncate(text: string | null | undefined, max = 72): string {
  if (!text?.trim()) return "";
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
