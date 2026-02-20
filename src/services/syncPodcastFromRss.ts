import Parser from "rss-parser";
import path from "path";

import { formatDateYYMMDD, formatDuration, retryAsync } from "../utils.js";
import { supabase } from "../supabase.js";
import {
  EPISODE_LIMIT,
  LANGUAGELIST,
  SKIP_DUPLICATES,
  TYPE,
  DOWNLOAD_FILES,
  DOWNLOAD_LIMIT,
  EPISODES_TABLE,
  PROGRAMS_TABLE,
} from "../constants.js";
import {
  sanitizeFileName,
  downloadEpisodesFromDb,
  downloadEpisodeFiles,
} from "./syncPodcastCommon.js";

const parser = new Parser();

export async function syncPodcastFromRss(rssUrl: string) {
  /* ---------------- 기존 프로그램 조회 (사전 체크) ---------------- */

  // 먼저 RSS 피드 파싱 (프로그램명 확인용)
  const feed = await retryAsync(() => parser.parseURL(rssUrl), 2, 1500);
  const programTitle = feed.title ?? "";
  const programImage = feed.itunes?.image ?? feed.image?.url ?? null;

  const { data: existingProgram } = await supabase
    .from(PROGRAMS_TABLE)
    .select("id,img_url")
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

      // 다운로드만 진행 (DB 기준)
      if (DOWNLOAD_FILES) {
        console.log(`📥 에피소드 충족, 다운로드만 진행: ${programTitle}`);
        await downloadEpisodesFromDb(
          existingProgram.id,
          programTitle,
          existingProgram.img_url ?? null,
          DOWNLOAD_LIMIT,
        );
      }

      return;
    }
  }

  /* ---------------- 프로그램 처리 (새로 추가 또는 기존 데이터 사용) ---------------- */

  const { data: program, error: programError } = await supabase
    .from(PROGRAMS_TABLE)
    .upsert(
      {
        title: programTitle,
        img_url: programImage,
        type: TYPE,
        language: LANGUAGELIST,
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
    const { data: existingProgramData, error } = await supabase
      .from(PROGRAMS_TABLE)
      .select()
      .eq("title", programTitle)
      .single();

    if (error) throw error;
    finalProgram = existingProgramData;
    console.log(`✅ 프로그램 이미 존재: ${programTitle}`);
  } else {
    console.log(`✅ 프로그램 확보: ${programTitle}`);
  }

  /* ---------------- 현재 에피소드 개수 확인 ---------------- */

  const { count } = await supabase
    .from(EPISODES_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("program_id", finalProgram.id);

  const currentCount = count ?? 0;
  const needCount = EPISODE_LIMIT - currentCount;

  console.log(`📦 현재 ${currentCount}개 → ${needCount}개 추가 필요`);

  /* ---------------- 기존 에피소드 조회 (중복 제거 용) ---------------- */

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

  const savedEpisodes: Array<{
    title: string;
    audio_file: string | null;
    img_url: string | null;
  }> = [];

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
        language: LANGUAGELIST,
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
    } else {
      savedEpisodes.push({
        title: episodeTitle,
        audio_file: item.enclosure?.url ?? null,
        img_url: episodeImage,
      });
    }
  }

  /* ---------------- 다운로드 (병렬) ---- --------*/

  if (!DOWNLOAD_FILES) {
    console.log(`⏭ 다운로드 스킵: ${programTitle}`);
    return;
  }

  const baseDir = path.join(
    process.cwd(),
    "downloads",
    sanitizeFileName(programTitle),
  );

  // 다운로드 대상 선택 (실제 DB에 추가된 에피소드만)
  const downloadItems =
    DOWNLOAD_LIMIT > 0 ? savedEpisodes.slice(0, DOWNLOAD_LIMIT) : savedEpisodes;

  await downloadEpisodeFiles(
    baseDir,
    downloadItems,
    programImage,
    programTitle,
  );

  console.log(`🎉 synced + downloaded 완료: ${programTitle}`);
}
