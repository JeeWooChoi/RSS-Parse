import { MODE, RSS_URL } from "./constants.js";
import { runFromExcel } from "./jobs/runFromExcel.js";
import { runFromRss } from "./jobs/runFromRss.js";

if (MODE === "excel") {
  await runFromExcel();
} else if (MODE === "rss") {
  await runFromRss(RSS_URL);
} else {
  console.log("Usage: npm start [excel|rss] [rssUrl]");
}
