import { MODE } from "./constants.js";
import { runFromExcel } from "./jobs/runFromExcel.js";
import { runFromRss } from "./jobs/runFromRss.js";

const rssUrl = "https://example.com/rss";

if (MODE === "excel") {
  await runFromExcel();
} else if (MODE === "rss") {
  await runFromRss(rssUrl);
} else {
  console.log("Usage: npm start [excel|rss] [rssUrl]");
}
