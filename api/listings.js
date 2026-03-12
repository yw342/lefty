/**
 * 목록 조회 API
 * GET /api/listings?page=1&limit=12
 * 항상 JSON 응답 보장 (Content-Type: application/json)
 */
import { createClient } from '@supabase/supabase-js';

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return sendJson(res, 500, { error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: list, error: listError } = await supabase
      .from('listings')
      .select('id, source_site, external_id, title, price, product_name, image_url, url, location, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (listError) {
      return sendJson(res, 500, { error: listError.message });
    }

    const { count, error: countError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true });

    const total = countError ? (list?.length ?? 0) : count;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return sendJson(res, 200, {
      data: list ?? [],
      pagination: { page, limit, total, totalPages },
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || String(err) });
  }
}
