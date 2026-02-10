import { syncPodcastFromRss } from "../services/syncPodcastFromRss.js";

async function runFromRss(rssUrl: string) {
  try {
    await syncPodcastFromRss(rssUrl);
    console.log(`✅ synced: ${rssUrl}`);
  } catch (e) {
    console.error("❌ RSS 처리 실패:", rssUrl, e);
  }
}

export { runFromRss };
