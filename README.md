# RSS-Parse

팟캐스트/라디오 RSS 피드를 파싱하여 프로그램 정보 및 에피소드 데이터를 Supabase DB에 저장하고, 음성/이미지 파일을 다운로드하는 도구입니다.

## 📋 기능

- **RSS 피드 파싱**: 팟캐스트/라디오 RSS URL에서 프로그램 및 에피소드 정보 추출
- **Excel 기반 배치 처리**: Excel 파일의 팟캐스트 목록을 일괄 동기화
- **Supabase DB 연동**: 프로그램, 에피소드, 카테고리, 테마 데이터 저장
- **선택적 파일 다운로드**: 에피소드 음성파일(mp3) 및 이미지(jpg) 다운로드
- **중복 제거**: 기존 데이터 중복 저장 방지
- **지능형 처리**: 에피소드 충분 시 다운로드만 진행, 부족 시 RSS 파싱 후 저장

## 🎯 프로젝트 구조

```

├── package.json              # 프로젝트 설정
├── tsconfig.json             # TypeScript 설정
├── rss_list.xlsx             # Excel 파일 (팟캐스트 목록, SHEET_NAME에서 지정)
│
├── src/
│   ├── index.ts              # 메인 진입점
│   ├── constants.ts          # 설정 상수
│   ├── utils.ts              # 유틸리티 함수
│   ├── supabase.ts           # Supabase 클라이언트
│   ├── syncPodcastRSS.ts     # RSS 파싱 함수
│   ├── config/
│   │   └── index.ts          # 프로젝트 설정
│   ├── jobs/
│   │   ├── runFromExcel.ts   # Excel 파일 기반 동기화 작업
│   │   └── runFromRss.ts     # RSS URL 기반 동기화 작업
│   └── services/
│       ├── syncPodcastCommon.ts      # 공통 함수 (카테고리/테마 매핑, 파일 다운로드)
│       ├── syncPodcastFromExcel.ts   # Excel 데이터 동기화 로직
│       └── syncPodcastFromRss.ts     # RSS 데이터 동기화 로직
│
└── downloads/                # 다운로드된 파일 저장 디렉토리
    ├── [프로그램명1]/        # 각 프로그램별 폴더
    │   ├── episode1.mp3
    │   ├── episode1.jpg
    │   └── ...
    └── [프로그램명2]/
        └── ...
```

**Excel 파일 형식:**

- 파일명: `rss_list.xlsx`
- 시트명: `constants.ts`의 `SHEET_NAME` 값과 동일 (예: `"JP_일본"`)

**Excel 컬럼:**

| 컬럼명           | 설명                                     |
| ---------------- | ---------------------------------------- |
| RSS              | 팟캐스트 RSS URL                         |
| 채널명           | 프로그램 제목                            |
| rank             | 순위 (MIN_RANK ~ MAX_RANK 범위로 필터링) |
| 제작사           | 부제목/제작사                            |
| 픽클 카테고리 ID | 카테고리 ID (65는 글로벌, 매핑 제외)     |
| 현 데모 순위     | 인기도 순위 (테마 매핑)                  |

## ⚙️ 설정 파일 (constants.ts)

### 기본 설정

| 상수           | 설명                           | 예시                                |
| -------------- | ------------------------------ | ----------------------------------- |
| `SHEET_NAME`   | Excel 시트명                   | `"JP_일본"`                         |
| `COUNTRY_CODE` | 카테고리 매핑 시 국가 코드     | `"JP"` (JP, US, KR, DE, IT, ES, GB) |
| `LANGUAGELIST` | 프로그램/에피소드 저장 시 언어 | `["jp"]`                            |
| `TYPE`         | 팟캐스트/라디오 구분           | `null`, `"podcast"`, `"radio"`      |
| `MODE`         | 실행 모드                      | `"excel"` 또는 `"rss"`              |
| `RSS_URL`      | RSS URL (MODE=rss일 때)        | `"https://example.com/rss"`         |

### 에피소드 처리

| 상수             | 설명                               | 기본값 |
| ---------------- | ---------------------------------- | ------ |
| `EPISODE_LIMIT`  | 프로그램당 저장할 최대 에피소드 수 | `4`    |
| `DOWNLOAD_FILES` | 파일 다운로드 여부                 | `true` |
| `DOWNLOAD_LIMIT` | 다운로드할 최대 에피소드 수        | `10`   |

**EPISODE_LIMIT 동작:**

- `0`: 프로그램 정보만 저장, 에피소드 미저장
- `> 0`: 지정된 개수만큼 에피소드 저장
- 이미 충분한 에피소드가 있으면 → RSS 파싱 스킵, 다운로드만 진행

### 카테고리 & 테마

| 상수                 | 설명                      | 기본값 |
| -------------------- | ------------------------- | ------ |
| `SYNC_CATEGORY`      | 카테고리 매핑 여부        | `true` |
| `GLOBAL_CATEGORY_ID` | 글로벌 카테고리 ID (제외) | `65`   |
| `SYNC_THEMES`        | 테마(인기채널) 매핑 여부  | `true` |
| `THEME_ID`           | 테마 ID (인기채널)        | `16`   |

**GLOBAL_CATEGORY_ID 동작:**

- `65` (글로벌): 카테고리 매핑에서 제외됨
- 다른 ID: 정상적으로 카테고리 매핑 진행

### Excel 처리

| 상수                | 설명                  | 기본값 |
| ------------------- | --------------------- | ------ |
| `EXCEL_HEADER_SKIP` | Excel 헤더 스킵 행 수 | `2`    |
| `MIN_RANK`          | 순위 범위 최솟값      | `1`    |
| `MAX_RANK`          | 순위 범위 최댓값      | `100`  |

### 데이터베이스

| 상수                        | 설명                          |
| --------------------------- | ----------------------------- |
| `PROGRAMS_TABLE`            | 프로그램 테이블명             |
| `PROGRAMS_CATEGORIES_TABLE` | 프로그램-카테고리 연결 테이블 |
| `EPISODES_TABLE`            | 에피소드 테이블명             |
| `THEMES_PROGRAMS_TABLE`     | 테마-프로그램 연결 테이블     |

### 중복 처리

| 상수              | 설명                  | 기본값 |
| ----------------- | --------------------- | ------ |
| `SKIP_DUPLICATES` | 기존 데이터 스킵 여부 | `true` |

- `true`: 중복 데이터 건너뛰기 (기존 데이터 유지)
- `false`: 중복 데이터 덮어쓰기 (최신 정보로 업데이트)

## 🚀 사용 방법

### 설치

```bash
npm install
```

### 환경 변수 설정

`.env` 파일 생성 (Supabase 연결 정보):

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Excel 기반 동기화

1. **constants.ts 설정**

   ```typescript
   export const MODE = "excel";
   export const EPISODE_LIMIT = 4;
   export const DOWNLOAD_FILES = true;
   export const DOWNLOAD_LIMIT = 10;
   ...
   ```

2. **실행**
   ```bash
   npm start
   ```

### RSS URL 기반 동기화

```typescript
import { syncPodcastFromRss } from "./services/syncPodcastFromRss.js";

await syncPodcastFromRss("https://example.com/podcast.xml");
```

## 📊 동작 흐름

### 케이스 1: 에피소드 충분 (EPISODE_LIMIT 이상 존재)

```
기존 프로그램 확인
  ↓
에피소드 개수 체크 (currentCount >= EPISODE_LIMIT)
  ↓
✅ RSS 파싱 스킵
✅ 카테고리/테마 매핑만 진행 (설정 시)
✅ DB의 기존 에피소드만 읽어서 파일 다운로드
✅ 종료 (return)
```

### 케이스 2: 에피소드 부족 (EPISODE_LIMIT 미만)

```
프로그램 정보 조회
  ↓
✅ RSS 피드 파싱
✅ 프로그램 정보 DB 저장
✅ 신규 에피소드만 필터링 (중복 제거)
✅ 부족한 개수만큼 DB 저장
✅ 설정된 개수만큼 파일 다운로드
```

## 🔧 커스터마이징

### 특정 국가 팟캐스트만 처리

```typescript
export const COUNTRY_CODE = "KR";
export const LANGUAGELIST = ["ko"];
export const SHEET_NAME = "KR_한국";
export const THEME_ID = 5; // 한국 테마 ID
```

### 테스트 테이블 사용

```typescript
export const PROGRAMS_TABLE = "programs_test";
export const EPISODES_TABLE = "episodes_test";
```

### 모든 에피소드 다운로드 (제한 없음)

```typescript
export const DOWNLOAD_LIMIT = 0; // 0이면 제한 없음
```

## 📝 로그 해석

| 로그                                | 의미                         |
| ----------------------------------- | ---------------------------- |
| `✅ 프로그램 확보`                  | 프로그램이 DB에 저장됨       |
| `📦 현재 N개 → M개 추가 필요`       | N개 있고 M개 더 필요         |
| `❌ EPISODE INSERT ERROR`           | 에피소드 저장 실패 (중복 등) |
| `⏭ 이미 존재해서 스킵`             | 파일이 이미 다운로드됨       |
| `✅ 파일 저장`                      | 파일 다운로드 완료           |
| `📥 에피소드 충족, 다운로드만 진행` | DB의 에피소드만 다운로드     |

## ⚠️ 주의사항

1. **비활성 모드**: `MODE = "rss"` 설정 시 Excel 파일 미사용
2. **다운로드 용량**: 대량 에피소드 다운로드 시 디스크 용량 확인 필요
3. **타임아웃**: 파일 다운로드 기본 타임아웃 10초
4. **DB 제약**: `episodes` 테이블에서 `(program_id, title)` 복합 유니크 필수

## 📦 의존성

- `rss-parser`: RSS 피드 파싱
- `@supabase/supabase-js`: Supabase 데이터베이스
- `node-fetch`: 파일 다운로드
- `excel-parser`: Excel 파일 처리 (custom 구현)
