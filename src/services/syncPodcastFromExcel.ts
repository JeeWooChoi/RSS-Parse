import Parser from "rss-parser";

import { supabase } from "../supabase.js";
import {
  EPISODE_LIMIT,
  EPISODES_TABLE,
  SKIP_DUPLICATES,
  PROGRAMS_CATEGORIES_TABLE,
  PROGRAMS_TABLE,
  TYPE,
} from "../constants.js";
import { formatDateYYMMDD, formatDuration } from "../utils.js";

const parser = new Parser();

type SyncPodcastParams = {
  rssUrl: string;
  programTitle: string;
  subtitle?: string;
  language: string[];
  country: string;
  categoryId?: string | number;
};

export async function syncPodcastFromExcel({
  rssUrl,
  programTitle,
  subtitle,
  language,
  country,
  categoryId,
}: SyncPodcastParams) {
  const feed = await parser.parseURL(rssUrl);

  /* ---------------- 프로그램 ---------------- */

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

  // 중복으로 skip된 경우 기존 데이터 가져오기
  if (!finalProgram) {
    const { data: existingProgram, error: selectError } = await supabase
      .from(PROGRAMS_TABLE)
      .select()
      .eq("title", programTitle)
      .single();

    if (selectError) throw selectError;
    finalProgram = existingProgram;
    console.log(`✅ 프로그램 이미 존재: ${programTitle}`);
  }

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
          ignoreDuplicates: SKIP_DUPLICATES,
        },
      );

    if (categoryError) {
      console.error(
        "❌ PROGRAM_CATEGORY INSERT ERROR:",
        programTitle,
        categoryError.message,
      );
    }
  }

  /* ---------------- 에피소드 (최근 5개) ---------------- */

  const recentItems = feed.items.slice(0, EPISODE_LIMIT);

  for (const item of recentItems) {
    const { error } = await supabase.from(EPISODES_TABLE).upsert(
      {
        program_id: finalProgram.id,
        title: item.title ?? null,
        img_url: item.itunes?.image ?? null,
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

    if (error) {
      console.error("❌ EPISODE INSERT ERROR:", item.title, error.message);
    }
  }

  console.log(`✅ synced: ${programTitle}`);
}
