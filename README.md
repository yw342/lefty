# 왼손 중고 기타 매물 트래커

웹에서 **왼손 중고 기타** 매물을 수집해 한 화면에서 페이징으로 보는 서비스입니다.

## 사용 기술

- **저장소**: GitHub
- **프론트**: HTML, JavaScript
- **배포**: Vercel
- **DB**: Supabase

## 수집 소스 (판매중만)

- **중고나라** (web.joongna.com) – 검색어 "왼손기타 기타". 상세 페이지에서 "판매완료" 여부를 확인해 **판매중인 매물만** DB에 저장.
- **뮬** (mule.co.kr) – 악기장터 검색어 "왼손", `soldout=n`(판매중만) 적용. 제목에 "판매완료"가 포함된 행은 제외.
- **당근마켓** (daangn.com) – 검색어 "왼손기타". 상세에서 "판매완료"면 제외. 제목이 기타/베이스 관련인 경우만 저장.
- **번개장터** (m.bunjang.co.kr) – 검색어 "왼손기타". 검색·상세가 JS 렌더링이라 **ScraperAPI** 사용 시에만 수집 가능. 기타/베이스 관련·판매중만 저장.

### 뮬 / 번개장터 403·JS 렌더링 우회

뮬은 서버에서 요청 시 **403**을 반환할 수 있습니다(봇 차단). 아래 중 하나를 사용하면 우회할 수 있습니다.

1. **ScraperAPI** (권장): [scraperapi.com](https://www.scraperapi.com) 가입 후 API 키 발급. 무료 크레딧 5,000회 제공.
   - Vercel/로컬 환경변수에 `SCRAPER_API_KEY=발급받은키` 추가.
   - 크롤 시 **뮬**·**번개장터** 요청을 ScraperAPI 프록시로 보냅니다.
2. **Vercel Cron**: 배포 후 Vercel IP에서 주기적으로 `/api/crawl` 호출 시, 환경에 따라 403이 나오지 않을 수 있습니다.
3. **GitHub Actions** 등 다른 호스트에서 주기적으로 크롤을 돌리면 IP가 달라 403이 해제될 수 있습니다.

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에서 `supabase/migrations/001_create_listings.sql` 내용 실행
3. **Settings → API**에서 다음 값 확인:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (크롤 API용)
   - `anon` key → `SUPABASE_ANON_KEY` (목록 조회용, 선택)

### 3. 환경 변수

프로젝트 루트에 `.env` 생성 (또는 Vercel에 설정):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 뮬 403 우회용 (선택) - ScraperAPI 키 설정 시 뮬 수집 가능
# SCRAPER_API_KEY=your-scraperapi-key
```

### 4. 로컬 서버 (Vercel CLI)

```bash
npx vercel dev
```

브라우저에서 `http://localhost:3000` 접속.

### 5. 크롤러 검증 테스트

```bash
node scripts/test-crawl.mjs   # 중고나라
node scripts/test-mule.mjs    # 뮬 (로컬에서 403 나올 수 있음)
```

## 배포 (Vercel)

1. GitHub에 저장소 푸시
2. [Vercel](https://vercel.com)에서 해당 저장소 Import
3. **Environment Variables**에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 추가. (뮬 수집 시 403 나오면 `SCRAPER_API_KEY` 추가)
4. Deploy

## API

| 경로 | 설명 |
|------|------|
| `GET /api/listings?page=1&limit=12` | DB에 저장된 매물 목록 (페이징) |
| `GET /api/crawl` | 중고나라 + 뮬 + 당근마켓 + 번개장터에서 매물 수집(판매중만) 후 DB에 upsert |

## DB 스키마 요약

- **listings**: `source_site`, `external_id`, `title`, `price`, `product_name`, `image_url`, `url`, `description`, `location`, `created_at`, `updated_at`
- `(source_site, external_id)` 유니크로 중복 방지

## 주의사항

- 크롤링은 해당 사이트 이용약관 및 robots.txt를 확인한 뒤 사용하세요.
- 수집 빈도는 적당히 유지해 서버에 부담을 주지 않도록 하세요.
