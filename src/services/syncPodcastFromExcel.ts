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
  SYNC_CATEGORY,
  SYNC_THEMES,
  THEMES_PROGRAMS_TABLE,
  TYPE,
  THEME_ID,
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
  orderPopular?: number;
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
  orderPopular,
}: SyncPodcastParams) {
  /* ---------------- 기존 프로그램 조회 ---------------- */

  const { data: existingProgram } = await supabase
    .from(PROGRAMS_TABLE)
    .select("id")
    .eq("title", programTitle)
    .maybeSingle();

  /* ---------------- 에피소드 개수 사전 체크 ---------------- */

  if (existingProgram) {
    const { count } = await supabase
      .from(EPISODES_TABLE)
      .select("*", { count: "exact", head: true })
      .eq("program_id", existingProgram.id);

    const currentCount = count ?? 0;

    if (currentCount >= EPISODE_LIMIT) {
      console.log(
        `⏭ ${programTitle}: 이미 ${currentCount}개 → EPISODE_LIMIT(${EPISODE_LIMIT}) 충족`,
      );

      // 카테고리 매핑 진행
      if (SYNC_CATEGORY && categoryId !== undefined) {
        const { error: categoryError } = await supabase
          .from(PROGRAMS_CATEGORIES_TABLE)
          .upsert(
            {
              program_id: existingProgram.id,
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
        } else {
          console.log(`✅ 카테고리 매핑 완료: ${programTitle}`);
        }
      }

      // 테마 매핑 진행
      if (SYNC_THEMES && orderPopular !== undefined) {
        const { error: themeError } = await supabase
          .from(THEMES_PROGRAMS_TABLE)
          .upsert(
            {
              program_id: existingProgram.id,
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
          console.log(
            `✅ 테마 순위 저장: ${programTitle} (order: ${orderPopular})`,
          );
        }
      }

      return;
    }
  }

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

  /* ---------------- 테마 프로그램 매핑 (themes_programs) ---------------- */

  if (SYNC_THEMES && orderPopular !== undefined) {
    const { error: themeError } = await supabase
      .from(THEMES_PROGRAMS_TABLE)
      .upsert(
        {
          program_id: finalProgram.id,
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
      console.log(
        `✅ 테마 순위 저장: ${programTitle} (order: ${orderPopular})`,
      );
    }
  }

  /* ---------------- 다운로드 기본 경로 ---------------- */

  const baseDir = path.join(
    process.cwd(),
    "downloads",
    sanitizeFileName(programTitle),
  );

  /* ---------------- 현재 에피소드 개수 재확인 ---------------- */

  const { count } = await supabase
    .from(EPISODES_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("program_id", finalProgram.id);

  const currentCount = count ?? 0;
  const needCount = EPISODE_LIMIT - currentCount;

  console.log(`📦 현재 ${currentCount}개 → ${needCount}개 추가 필요`);

  /* ---------------- 에피소드 처리 ---------------- */

  /* ---------------- 기존 episode 조회 ---------------- */

  const { data: existingEpisodes } = await supabase
    .from(EPISODES_TABLE)
    .select("title")
    .eq("program_id", finalProgram.id);

  const existingTitles = new Set(existingEpisodes?.map((e) => e.title));

  /* ---------------- 신규 RSS 아이템 필터 ---------------- */

  const newItems = feed.items.filter(
    (item) => item.title && !existingTitles.has(item.title),
  );

  /* ---------------- 부족한 개수만 선택 ---------------- */

  const recentItems = newItems.slice(0, needCount);

  /* ---------------- DB 저장 (순차) ---------------- */

  for (const item of recentItems) {
    const episodeTitle = item.title ?? "untitled";
    const episodeImage = item.itunes?.image ?? programImage ?? null;

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
        onConflict: "program_id,title",
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
  }

  /* ---------------- 다운로드 (병렬) ---------------- */

  const downloadTasks = recentItems.flatMap((item) => {
    const episodeTitle = item.title ?? "untitled";
    const safeTitle = sanitizeFileName(episodeTitle);
    const episodeImage = item.itunes?.image ?? programImage ?? null;
    const tasks = [];

    // MP3 다운로드
    if (item.enclosure?.url) {
      const mp3Path = path.join(baseDir, `${safeTitle}.mp3`);
      tasks.push(downloadFile(item.enclosure.url, mp3Path));
    }

    // 이미지 다운로드
    if (episodeImage) {
      const ext = episodeImage.split(".").pop()?.split("?")[0] ?? "jpg";
      const imagePath = path.join(baseDir, `${safeTitle}.${ext}`);
      tasks.push(downloadFile(episodeImage, imagePath));
    }

    return tasks;
  });

  await Promise.all(downloadTasks);

  console.log(`🎉 synced + downloaded 완료: ${programTitle}`);
}
