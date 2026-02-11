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

// 재시도 로직이 있는 함수
export async function retryAsync<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  ⏳ 재시도 ${i + 1}/${retries - 1}...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Retry failed");
}
