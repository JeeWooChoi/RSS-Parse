import Parser from "rss-parser";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

import { supabase } from "../supabase.js";
import {
  EPISODE_LIMIT,
  EPISODES_TABLE,
  SKIP_DUPLICATES,
  PROGRAMS_CATEGORIES_TABLE,
  PROGRAMS_TABLE,
  TYPE,
} from "../constants.js";

import { formatDateYYMMDD, formatDuration, retryAsync } from "../utils.js";

const parser = new Parser();

/* =========================================================
   파일명 정리 (공백 유지 + 윈도우 금지문자만 제거)
========================================================= */
function sanitizeFileName(name: string) {
  return name.replace(/[\/\\:*?"<>|]/g, "").trim();
}

/* =========================================================
   파일 다운로드 (이미 있으면 스킵)
========================================================= */
async function downloadFile(url: string, filePath: string) {
  if (fs.existsSync(filePath)) {
    console.log("⏭ 이미 존재해서 스킵:", filePath);
    return;
  }

  try {
    const res = await fetch(url);

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
   타입 정의
========================================================= */
type SyncPodcastParams = {
  rssUrl: string;
  programTitle: string;
  subtitle?: string | null;
  language: string[];
  country: string;
  categoryId?: string | number;
};

/* =========================================================
   메인 함수
========================================================= */
export async function syncPodcastFromExcel({
  rssUrl,
  programTitle,
  subtitle,
  language,
  country,
  categoryId,
}: SyncPodcastParams) {
  /* ---------------- RSS 파싱 ---------------- */

  const feed = await retryAsync(() => parser.parseURL(rssUrl), 2, 1500);

  /* ---------------- 프로그램 처리 ---------------- */

  const programImage = feed.itunes?.image ?? feed.image?.url ?? null;

  const { data: program, error: programError } = await supabase
    .from(PROGRAMS_TABLE)
    .upsert(
      {
        title: programTitle,
        subtitle: subtitle ?? null,
        img_url: programImage,
        type: TYPE,
        language,
      },
      {
        onConflict: "title",
        ignoreDuplicates: SKIP_DUPLICATES,
      },
    )
    .select()
    .maybeSingle();

  if (programError) throw programError;

  let finalProgram = program;

  // skip 된 경우 기존 데이터 조회
  if (!finalProgram) {
    const { data: existingProgram, error } = await supabase
      .from(PROGRAMS_TABLE)
      .select()
      .eq("title", programTitle)
      .single();

    if (error) throw error;
    finalProgram = existingProgram;
  }

  console.log(`✅ 프로그램 확보: ${programTitle}`);

  /* ---------------- 카테고리 연결 ---------------- */

  if (categoryId !== undefined) {
    const { error: categoryError } = await supabase
      .from(PROGRAMS_CATEGORIES_TABLE)
      .upsert(
        {
          program_id: finalProgram.id,
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

  /* ---------------- 다운로드 기본 경로 ---------------- */

  const baseDir = path.join(
    process.cwd(),
    "downloads",
    sanitizeFileName(programTitle),
  );

  /* ---------------- 에피소드 처리 ---------------- */

  const recentItems = feed.items.slice(0, EPISODE_LIMIT);

  for (const item of recentItems) {
    const episodeTitle = item.title ?? "untitled";
    const safeTitle = sanitizeFileName(episodeTitle);

    const episodeImage = item.itunes?.image ?? programImage ?? null;

    /* ---------- DB 저장 ---------- */

    const { error: episodeError } = await supabase.from(EPISODES_TABLE).upsert(
      {
        program_id: finalProgram.id,
        title: episodeTitle,
        img_url: episodeImage,
        audio_file: item.enclosure?.url ?? null,
        date: formatDateYYMMDD(item.pubDate),
        duration: formatDuration(item.itunes?.duration),
        type: TYPE,
        language,
      },
      {
        onConflict: "title",
        ignoreDuplicates: SKIP_DUPLICATES,
      },
    );

    if (episodeError) {
      console.error(
        "❌ EPISODE INSERT ERROR:",
        episodeTitle,
        episodeError.message,
      );
    }

    /* ---------- MP3 다운로드 ---------- */

    if (item.enclosure?.url) {
      const mp3Path = path.join(baseDir, `${safeTitle}.mp3`);

      await downloadFile(item.enclosure.url, mp3Path);
    }

    /* ---------- 이미지 다운로드 ---------- */

    if (episodeImage) {
      const ext = episodeImage.split(".").pop()?.split("?")[0] ?? "jpg";

      const imagePath = path.join(baseDir, `${safeTitle}.${ext}`);

      await downloadFile(episodeImage, imagePath);
    }
  }

  console.log(`🎉 synced + downloaded 완료: ${programTitle}`);
}
