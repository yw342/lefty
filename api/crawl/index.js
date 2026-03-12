/**
 * 크롤링 트리거 API
 * GET /api/crawl - 수집 실행 후 DB에 upsert (중고나라 + 뮬 + 당근마켓, 판매중만)
 * 항상 JSON 응답 보장. 타임아웃 방지로 수집량 축소.
 */
import { createClient } from '@supabase/supabase-js';
import { crawlJoongna } from './joongna.js';
import { crawlMule } from './mule.js';
import { crawlDaangn } from './daangn.js';

export const config = { maxDuration: 60 };

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).end(JSON.stringify(body));
}

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
  const results = {
    joongna: { count: 0, error: null },
    mule: { count: 0, error: null },
    daangn: { count: 0, error: null },
    total: 0,
  };

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return sendJson(res, 500, { ok: false, results, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const allRows = [];

    // 중고나라 (수치 축소로 타임아웃 방지)
    try {
      const joongnaItems = await crawlJoongna({ enrich: true, maxItems: 10 });
      allRows.push(...joongnaItems.map(toRow));
      results.joongna.count = joongnaItems.length;
    } catch (e) {
      results.joongna.error = e.message || String(e);
    }

    // 뮬 (SCRAPER_API_KEY 없으면 403으로 0건)
    try {
      const muleItems = await crawlMule({
        maxItems: 15,
        maxPages: 2,
        scraperApiKey: process.env.SCRAPER_API_KEY,
      });
      allRows.push(...muleItems.map(toRow));
      results.mule.count = muleItems.length;
    } catch (e) {
      results.mule.error = e.message || String(e);
    }

    // 당근마켓 (검색 결과가 지역별로 적을 수 있음)
    try {
      const daangnItems = await crawlDaangn({ enrich: true, maxItems: 10 });
      allRows.push(...daangnItems.map(toRow));
      results.daangn.count = daangnItems.length;
    } catch (e) {
      results.daangn.error = e.message || String(e);
    }

    if (allRows.length === 0) {
      return sendJson(res, 200, { ok: true, message: 'No items to upsert', results });
    }

    const { error } = await supabase.from('listings').upsert(allRows, {
      onConflict: 'source_site,external_id',
      ignoreDuplicates: false,
    });

    if (error) {
      return sendJson(res, 500, { ok: false, results, error: error.message });
    }

    results.total = allRows.length;
    return sendJson(res, 200, { ok: true, message: `Upserted ${allRows.length} listings`, results });
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      results,
      error: err.message || String(err),
    });
  }
}
