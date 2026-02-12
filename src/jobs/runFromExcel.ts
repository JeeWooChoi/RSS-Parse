import XLSX from "xlsx";
import {
  COUNTRY_CODE,
  EXCEL_HEADER_SKIP,
  LANGUAGELIST,
  MAX_RANK,
  MIN_RANK,
  SHEET_NAME,
} from "../constants.js";
import { syncPodcastFromExcel } from "../services/syncPodcastFromExcel.js";

/* -------------------- Types -------------------- */

type ExcelRow = {
  RSS?: string;
  채널명?: string;
  제작사?: string;
  "픽클 카테고리 ID"?: "" | number;
  "현 데모 순위"?: number;
  rank?: number;
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
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { range: EXCEL_HEADER_SKIP });

  console.log(`총 ${rows.length}개의 행 로드 완료`);

  // 타입 좁히기 (RSS, 채널명 확실히 string, rank 범위)
  const germanRows = rows.filter(
    (row): row is Required<Pick<ExcelRow, "RSS" | "채널명">> & ExcelRow =>
      typeof row.RSS === "string" &&
      typeof row.채널명 === "string" &&
      typeof row.rank === "number" &&
      (MIN_RANK === null || row.rank >= MIN_RANK) &&
      (MAX_RANK === null || row.rank <= MAX_RANK),
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
        country: COUNTRY_CODE,
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(row.제작사 ? { subtitle: row.제작사 } : {}),
        ...(row["현 데모 순위"] !== undefined
          ? { orderPopular: row["현 데모 순위"] }
          : {}),
      });
    } catch (e) {
      console.error("❌ RSS 처리 실패:", row.RSS, e);
    }
  }

  console.log(`🎉 엑셀 기반 ${SHEET_NAME} RSS 동기화 완료`);
}
export { runFromExcel };
