import Parser from "rss-parser";

import { formatDateYYMMDD, formatDuration } from "../utils.js";
import { supabase } from "../supabase.js";
import {
  EPISODE_LIMIT,
  LANGUAGELIST,
  SKIP_DUPLICATES,
  TYPE,
} from "../constants.js";

const parser = new Parser();

export async function syncPodcastFromRss(rssUrl: string) {
  const feed = await parser.parseURL(rssUrl);

  /* ---------------- 프로그램 ---------------- */

  const programTitle = feed.title ?? "";
  const programImage = feed.itunes?.image ?? feed.image?.url ?? null;

  const { data: program, error: programError } = await supabase
    .from("programs_test")
    .upsert(
      {
        title: programTitle,
        img_url: programImage,
        type: TYPE,
        language: LANGUAGELIST,
      },
      { onConflict: "title", ignoreDuplicates: SKIP_DUPLICATES },
    )
    .select()
    .maybeSingle();

  if (programError) throw programError;

  let finalProgram = program;

  // 중복으로 skip된 경우 기존 데이터 가져오기
  if (!finalProgram) {
    const { data: existingProgram, error: selectError } = await supabase
      .from("programs_test")
      .select()
      .eq("title", programTitle)
      .single();

    if (selectError) throw selectError;
    finalProgram = existingProgram;
    console.log(`✅ 프로그램 이미 존재: ${programTitle}`);
  }

  /* ---------------- 에피소드 (최근 5개) ---------------- */

  const recentItems = feed.items.slice(0, EPISODE_LIMIT);

  for (const item of recentItems) {
    const episodeImage = item.itunes?.image ?? programImage;

    const { error } = await supabase.from("episodes_test").upsert(
      {
        program_id: finalProgram.id,
        title: item.title ?? "",
        img_url: episodeImage,
        audio_file: item.enclosure?.url ?? null,
        date: formatDateYYMMDD(item.pubDate),
        duration: formatDuration(item.itunes?.duration),
        type: TYPE,
        language: LANGUAGELIST,
      },
      {
        onConflict: "title",
        ignoreDuplicates: SKIP_DUPLICATES,
      },
    );

    if (error) {
      console.error("❌ EPISODE INSERT ERROR:", item.title, error.message);
    }
  }

  console.log(`✅ synced: ${programTitle}`);
}
