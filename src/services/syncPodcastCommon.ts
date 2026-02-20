import fetch from "node-fetch";
import fs from "fs";
import path from "path";

import { supabase } from "../supabase.js";
import {
  PROGRAMS_CATEGORIES_TABLE,
  SYNC_CATEGORY,
  GLOBAL_CATEGORY_ID,
  SYNC_THEMES,
  THEMES_PROGRAMS_TABLE,
  THEME_ID,
  DOWNLOAD_FILES,
  EPISODES_TABLE,
} from "../constants.js";

/* =========================================================
   카테고리 매핑 (이름 → ID)
========================================================= */
export const CATEGORY_NAME_TO_ID: Record<string, number> = {
  엔터테인먼트: 59,
  "뉴스·시사": 60,
  "비즈니스·경제": 61,
  "교육·자기계발": 62,
  "지식·교양": 63,
  오디오드라마: 64,
  "웰니스(종교·철학)": 66,
};

export function normalizeCategoryName(value: string) {
  return value.replace(/\s+/g, "").replace(/・/g, "·");
}

export function resolveCategoryId(
  categoryId: string | number | undefined,
  categoryName: string | undefined,
): string | number | undefined {
  if (categoryId !== undefined && categoryId !== "") {
    return categoryId;
  }

  if (typeof categoryName !== "string" || categoryName.trim() === "") {
    return undefined;
  }

  const normalizedName = normalizeCategoryName(categoryName);
  return CATEGORY_NAME_TO_ID[normalizedName];
}

/* =========================================================
   파일명 정리 (공백 유지 + 윈도우 금지문자만 제거)
========================================================= */
export function sanitizeFileName(name: string) {
  return name.replace(/[\/\\:*?"<>|]/g, "").trim();
}

export function getUrlExtension(url: string, fallback: string) {
  const cleanUrl = url.split("?")[0];
  const ext = cleanUrl?.split(".").pop();

  if (!ext || ext.length > 6) {
    return fallback;
  }

  return ext;
}

/* =========================================================
   파일 다운로드 (이미 있으면 스킵, 타임아웃 10초)
========================================================= */
export async function downloadFile(url: string, filePath: string) {
  if (fs.existsSync(filePath)) {
    console.log("⏭ 이미 존재해서 스킵:", filePath);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("❌ 다운로드 실패:", url);
      return;
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);

    console.log("✅ 파일 저장:", filePath);
  } catch (err) {
    console.error("❌ 파일 다운로드 오류:", url);
  }
}

/* =========================================================
   카테고리 매핑
========================================================= */
export async function syncCategoryMapping(
  programId: number,
  categoryId: string | number | undefined,
  country: string,
  programTitle: string,
) {
  if (
    !SYNC_CATEGORY ||
    categoryId === undefined ||
    categoryId === GLOBAL_CATEGORY_ID
  ) {
    return;
  }

  const { error: categoryError } = await supabase
    .from(PROGRAMS_CATEGORIES_TABLE)
    .upsert(
      {
        program_id: programId,
        category_id: categoryId,
        country,
      },
      {
        onConflict: "program_id,category_id,country",
      },
    );

  if (categoryError) {
    console.error(
      "❌ PROGRAM_CATEGORY ERROR:",
      programTitle,
      categoryError.message,
    );
  }
}

/* =========================================================
   테마 매핑
========================================================= */
export async function syncThemeMapping(
  programId: number,
  orderPopular: number | undefined,
  programTitle: string,
) {
  if (!SYNC_THEMES || orderPopular === undefined) {
    return;
  }

  const { error: themeError } = await supabase
    .from(THEMES_PROGRAMS_TABLE)
    .upsert(
      {
        program_id: programId,
        theme_id: THEME_ID,
        order: orderPopular,
      },
      {
        onConflict: "program_id,theme_id",
      },
    );

  if (themeError) {
    console.error(
      "❌ THEMES_PROGRAMS ERROR:",
      programTitle,
      themeError.message,
    );
  } else {
    console.log(`✅ 테마 순위 저장: ${programTitle} (order: ${orderPopular})`);
  }
}

/* =========================================================
   에피소드 파일 다운로드
========================================================= */
export async function downloadEpisodeFiles(
  baseDir: string,
  episodes: Array<{
    title: string;
    audio_file: string | null;
    img_url: string | null;
  }>,
  programImage: string | null,
  programTitle: string,
) {
  if (!DOWNLOAD_FILES) {
    return;
  }

  const downloadTasks = episodes.flatMap((episode) => {
    const episodeTitle = episode.title ?? "untitled";
    const safeTitle = sanitizeFileName(episodeTitle);
    const tasks = [];

    // MP3 다운로드
    if (episode.audio_file) {
      const ext = getUrlExtension(episode.audio_file, "mp3");
      const mp3Path = path.join(baseDir, `${safeTitle}.${ext}`);
      tasks.push(downloadFile(episode.audio_file, mp3Path));
    }

    // 이미지 다운로드
    if (episode.img_url) {
      const ext = getUrlExtension(episode.img_url, "jpg");
      const imagePath = path.join(baseDir, `${safeTitle}.${ext}`);
      tasks.push(downloadFile(episode.img_url, imagePath));
    }

    return tasks;
  });

  // 프로그램 이미지 다운로드 (한 번만)
  if (programImage) {
    const ext = getUrlExtension(programImage, "jpg");
    const programImagePath = path.join(
      baseDir,
      `${sanitizeFileName(programTitle)}.${ext}`,
    );
    downloadTasks.push(downloadFile(programImage, programImagePath));
  }

  await Promise.allSettled(downloadTasks);
}

/* =========================================================
   DB에서 에피소드 조회 및 다운로드
========================================================= */
export async function downloadEpisodesFromDb(
  programId: number,
  programTitle: string,
  programImage: string | null,
  downloadLimit: number,
) {
  const baseDir = path.join(
    process.cwd(),
    "downloads",
    sanitizeFileName(programTitle),
  );

  let dbEpisodesQuery = supabase
    .from(EPISODES_TABLE)
    .select("title,audio_file,img_url,date")
    .eq("program_id", programId)
    .order("date", { ascending: false });

  if (downloadLimit > 0) {
    dbEpisodesQuery = dbEpisodesQuery.limit(downloadLimit);
  }

  const { data: dbEpisodes, error: dbEpisodesError } = await dbEpisodesQuery;

  if (dbEpisodesError) {
    console.error(
      "❌ DB EPISODES DOWNLOAD ERROR:",
      programTitle,
      dbEpisodesError.message,
    );
    return;
  }

  await downloadEpisodeFiles(
    baseDir,
    dbEpisodes ?? [],
    programImage,
    programTitle,
  );
}
