export function formatDateYYMMDD(pubDate?: string) {
  if (!pubDate) return null;

  const d = new Date(pubDate);
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  return `${yy}.${mm}.${dd}`;
}

export function formatDuration(duration?: string) {
  if (!duration) return null;

  // ':' 없는 값은 무시
  if (!duration.includes(":")) {
    return null;
  }

  return duration;
}
