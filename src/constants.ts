export const SHEET_NAME = "JP_일본";

//카테고리에 넣을 국가 코드
export const COUNTRY_CODE = "JP"; //US, KR, DE, JP, IT, ES, GB

export const LANGUAGELIST = ["jp"];
export const TYPE = null; //podcast 또는 radio
export const MODE = "excel"; //excel 또는 rss

//에피소드 개수
export const EPISODE_LIMIT = 4; // 0으로 하면 에피소드 추가 안하고 프로그램 upsert, 카테고리만 매핑

//Excel 헤더 스킵 행 수
export const EXCEL_HEADER_SKIP = 2;

//순위 범위
export const MIN_RANK = 1;
export const MAX_RANK = 20;

//카테고리 매핑 여부
export const SYNC_CATEGORY = true; // false면 카테고리 매핑 건너뜀

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
export const THEME_ID = 16;
