/**
 * 목록 조회 API
 * GET /api/listings?page=1&limit=12
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Missing Supabase credentials',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: list, error: listError } = await supabase
      .from('listings')
      .select('id, source_site, external_id, title, price, product_name, image_url, url, location, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (listError) {
      return res.status(500).json({ error: listError.message });
    }

    const { count, error: countError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true });

    const total = countError ? list.length : count;
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      data: list,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
