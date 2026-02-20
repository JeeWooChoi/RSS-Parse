export const SHEET_NAME = "JP_일본";

//카테고리에 넣을 국가 코드
export const COUNTRY_CODE = "JP"; //US, KR, DE, JP, IT, ES, GB

export const LANGUAGELIST = ["jp"];
export const TYPE = null; //podcast 또는 radio
export const MODE = "rss"; //excel 또는 rss

//에피소드 개수
export const EPISODE_LIMIT = 0; // 0으로 하면 에피소드 추가 안하고 프로그램 upsert, 카테고리만 매핑
//파일 다운로드 여부 및 개수
export const DOWNLOAD_FILES = false; // false면 파일 다운로드 건너뜀
export const DOWNLOAD_LIMIT = 10; // 다운로드할 최대 에피소드 개수 (0이면 RSS의 모든 아이템)
//Excel 헤더 스킵 행 수
export const EXCEL_HEADER_SKIP = 2;

//순위 범위
export const MIN_RANK = 21;
export const MAX_RANK = 40;

//카테고리 매핑 여부
export const SYNC_CATEGORY = false; // false면 카테고리 매핑 건너뜀

// 글로벌 카테고리 ID (매핑 제외)
export const GLOBAL_CATEGORY_ID = 65; // 65는 글로벌 카테고리로 매핑하지 않음

//인기채널(테마) 매핑 여부
export const SYNC_THEMES = true; // false면 인기채널 매핑 건너뜀

//테이블 이름
export const PROGRAMS_TABLE = "programs_test";
export const PROGRAMS_CATEGORIES_TABLE = "programs_categories_test";
export const EPISODES_TABLE = "episodes_test";
export const THEMES_PROGRAMS_TABLE = "themes_programs_test";

//기존 데이터 스킵할지 여부
export const SKIP_DUPLICATES = true; // true면 건너뛰기, false면 새로운 데이터로 덮어쓰기

// 테마 아이디
export const THEME_ID = 16; //일본 인기 채널

// RSS URL (MODE = "rss"일 때 사용)
export const RSS_URL =
  "https://feeds.acast.com/public/shows/646cbb0bb160e00011df3980";
