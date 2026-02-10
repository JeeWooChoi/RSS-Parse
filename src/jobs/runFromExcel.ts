import XLSX from "xlsx";
import { LANGUAGELIST, SHEET_NAME } from "../constants.js";
import { syncPodcastFromExcel } from "../services/syncPodcastFromExcel.js";

/* -------------------- Types -------------------- */

type ExcelRow = {
  RSS?: string;
  채널명?: string;
  제작사?: string;
  "픽클 카테고리 ID"?: "" | number;
};

//엑셀 기반 RSS 동기화
async function runFromExcel() {
  const workbook = XLSX.readFile("rss_list.xlsx");
  const sheetName = workbook.SheetNames.find((name) => name === SHEET_NAME);

  if (!sheetName) {
    throw new Error(`Sheet not found: ${SHEET_NAME}`);
  }
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEET_NAME}`);
  }
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  console.log(`총 ${rows.length}개의 행 로드 완료`);

  // 타입 좁히기 (RSS, 채널명 확실히 string)
  const germanRows = rows.filter(
    (row): row is Required<Pick<ExcelRow, "RSS" | "채널명">> & ExcelRow =>
      typeof row.RSS === "string" && typeof row.채널명 === "string",
  );

  console.log(`${SHEET_NAME} RSS ${germanRows.length}개 처리 시작`);

  for (const row of germanRows) {
    try {
      const rawCategoryId = row["픽클 카테고리 ID"];
      const categoryId = rawCategoryId === "" ? undefined : rawCategoryId;

      await syncPodcastFromExcel({
        rssUrl: row.RSS, // string
        programTitle: row.채널명, // string
        language: LANGUAGELIST,
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(row.제작사 ? { subtitle: row.제작사 } : {}),
      });
    } catch (e) {
      console.error("❌ RSS 처리 실패:", row.RSS, e);
    }
  }

  console.log(`🎉 엑셀 기반 ${SHEET_NAME} RSS 동기화 완료`);
}
export { runFromExcel };
