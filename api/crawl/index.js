/**
 * 크롤링 트리거 API
 * GET /api/crawl - 수집 실행 후 DB에 upsert (중고나라 + 뮬 + 당근마켓, 판매중만)
 * 뮬 403 시: 환경변수 SCRAPER_API_KEY 설정 시 ScraperAPI 경유 요청
 */
import { createClient } from '@supabase/supabase-js';
import { crawlJoongna } from './joongna.js';
import { crawlMule } from './mule.js';
import { crawlDaangn } from './daangn.js';

export const config = { maxDuration: 60 };

function toRow(item) {
  return {
    source_site: item.source_site,
    external_id: item.external_id,
    title: item.title,
    price: item.price,
    product_name: item.product_name,
    image_url: item.image_url,
    url: item.url,
    description: item.description,
    location: item.location,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results = {
    joongna: { count: 0, error: null },
    mule: { count: 0, error: null },
    daangn: { count: 0, error: null },
    total: 0,
  };
  const allRows = [];

  try {
    // 중고나라: 판매완료는 상세 페이지에서 제외
    try {
      const joongnaItems = await crawlJoongna({ enrich: true, maxItems: 15 });
      allRows.push(...joongnaItems.map(toRow));
      results.joongna.count = joongnaItems.length;
    } catch (e) {
      results.joongna.error = e.message;
    }

    // 뮬: soldout=n 판매중만. 403 우회: SCRAPER_API_KEY 있으면 ScraperAPI 사용
    try {
      const muleItems = await crawlMule({
        maxItems: 20,
        maxPages: 2,
        scraperApiKey: process.env.SCRAPER_API_KEY,
      });
      allRows.push(...muleItems.map(toRow));
      results.mule.count = muleItems.length;
    } catch (e) {
      results.mule.error = e.message;
    }

    // 당근마켓: 검색어 "왼손기타", 판매완료 상세에서 제외
    try {
      const daangnItems = await crawlDaangn({ enrich: true, maxItems: 10 });
      allRows.push(...daangnItems.map(toRow));
      results.daangn.count = daangnItems.length;
    } catch (e) {
      results.daangn.error = e.message;
    }

    if (allRows.length === 0) {
      return res.status(200).json({
        ok: true,
        message: 'No items to upsert',
        results,
      });
    }

    const { error } = await supabase.from('listings').upsert(allRows, {
      onConflict: 'source_site,external_id',
      ignoreDuplicates: false,
    });

    if (error) {
      return res.status(500).json({ ok: false, results, error: error.message });
    }

    results.total = allRows.length;

    return res.status(200).json({
      ok: true,
      message: `Upserted ${allRows.length} listings`,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      results,
      error: err.message,
    });
  }
}
