/**
 * 중고나라(web.joongna.com) 왼손 기타 검색 결과 크롤링
 * 검색어: 왼손기타 기타
 * 판매완료 제외: 상세 페이지 HTML에 "판매완료" 등이 있으면 해당 매물은 수집하지 않음 (판매중만 저장)
 */

const JOONGNA_SEARCH_URL = 'https://web.joongna.com/search/%EC%99%BC%EC%86%90%EA%B8%B0%ED%83%80%20%EA%B8%B0%ED%83%80';

async function fetchWithHeaders(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

/**
 * 목록 페이지 HTML에서 상품 ID와 URL만 추출 (안정적)
 * 상세는 enrichFromDetail에서 보강
 */
function parseListPage(html) {
  const productLinkRegex = /href="(https?:\/\/[^"]*\/product\/(\d+)[^"]*)"|href="(\/product\/(\d+)[^"]*)"/g;
  const seen = new Set();
  const items = [];

  let m;
  while ((m = productLinkRegex.exec(html)) !== null) {
    const externalId = m[2] || m[4];
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const path = m[3] || m[1];
    const url = path.startsWith('http') ? path : `https://web.joongna.com${path.startsWith('/') ? path : '/' + path}`;

    items.push({
      source_site: 'joongna',
      external_id: externalId,
      title: null,
      price: null,
      product_name: null,
      image_url: null,
      url: url.replace(/\/product\/\d+.*/, `/product/${externalId}`),
      description: null,
      location: null,
    });
  }

  return items;
}

/**
 * 상품 상세 페이지에서 제목, 가격, 이미지 보강
 * @returns {Promise<object|null>} 판매중이면 item, 판매완료면 null
 */
async function enrichFromDetail(item) {
  try {
    const html = await fetchWithHeaders(item.url);

    // 판매완료 매물 제외: 상세 페이지에 판매완료 표시가 있으면 수집하지 않음
    if (/판매\s*완료|판매완료|거래\s*완료|sold\s*out/i.test(html)) {
      return null;
    }

    const priceMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*원/);
    if (priceMatch) item.price = priceMatch[0].trim();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const raw = titleMatch[1].replace(/\s*\|\s*중고나라.*$/i, '').trim();
      if (raw) {
        item.title = raw;
        item.product_name = raw;
      }
    }
    if (!item.title) item.title = `왼손 기타 ${item.external_id}`;
    if (!item.product_name) item.product_name = item.title;

    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || html.match(/content="([^"]+)"[^>]+property="og:image"/);
    if (ogImage) item.image_url = ogImage[1];
  } catch (_) {
    if (!item.title) item.title = `왼손 기타 ${item.external_id}`;
    if (!item.product_name) item.product_name = item.title;
  }
  return item;
}

export async function crawlJoongna(options = {}) {
  const { enrich = false, maxItems = 20 } = options;
  const html = await fetchWithHeaders(JOONGNA_SEARCH_URL);
  let items = parseListPage(html);

  if (items.length > maxItems) items = items.slice(0, maxItems);

  if (enrich) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const enriched = await enrichFromDetail(items[i]);
      if (enriched != null) out.push(enriched);
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    return out;
  }

  return items;
}
