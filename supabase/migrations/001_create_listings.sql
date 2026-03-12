-- 왼손 중고 기타 매물 테이블
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price TEXT,
  product_name TEXT,
  image_url TEXT,
  url TEXT NOT NULL,
  description TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_site, external_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_source_site ON listings(source_site);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

-- RLS (Row Level Security) - 공개 읽기 허용
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON listings
  FOR SELECT USING (true);

-- 서비스 역할(크롤 API)은 서버에서 service_role key 사용 시 RLS 우회로 전체 접근

COMMENT ON TABLE listings IS '웹사이트에서 수집한 왼손 중고 기타 매물';
