/**
 * 당근마켓(daangn.com) 왼손 기타 검색 결과 크롤링
 * 검색어: 왼손기타 (지역별 결과가 다를 수 있음)
 */

const DAANGN_SEARCH_URL = 'https://www.daangn.com/kr/buy-sell/s/?search=%EC%99%BC%EC%86%90%EA%B8%B0%ED%83%80';
const DAANGN_BASE = 'https://www.daangn.com';

async function fetchWithHeaders(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

/**
 * 목록/검색 페이지에서 상품 링크 추출
 * 당근 상품 URL: /kr/buy-sell/슬러그-id/
 */
function parseListPage(html) {
  const items = [];
  const seen = new Set();
  // /kr/buy-sell/...-id/ 형태 (id는 영문+숫자 끝)
  const linkRegex = /href="(https?:\/\/[^"]*\/kr\/buy-sell\/[^"]+-([a-z0-9]+)\/?)"[^>]*>/gi;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const fullUrl = m[1];
    const id = m[2];
    if (seen.has(id)) continue;
    if (id.length < 8) continue; // slug 일부만 잡힌 경우 스킵
    seen.add(id);

    const url = fullUrl.startsWith('http') ? fullUrl : `${DAANGN_BASE}${fullUrl}`;

    items.push({
      source_site: 'daangn',
      external_id: id,
      title: null,
      price: null,
      product_name: null,
      image_url: null,
      url,
      description: null,
      location: null,
    });
  }

  return items;
}

/**
 * 상세 페이지에서 제목, 가격, 이미지 보강 (판매완료면 null 반환)
 */
async function enrichFromDetail(item) {
  try {
    const html = await fetchWithHeaders(item.url);
    if (/판매\s*완료|판매완료|거래\s*완료/i.test(html)) return null;

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const raw = titleMatch[1].replace(/\s*[\|\-]\s*당근.*$/i, '').trim();
      if (raw) item.title = raw;
      item.product_name = item.title;
    }
    if (!item.title) item.title = `왼손 기타 ${item.external_id}`;
    if (!item.product_name) item.product_name = item.title;

    const priceMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*원/);
    if (priceMatch) item.price = priceMatch[0].trim();

    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || html.match(/content="([^"]+)"[^>]+property="og:image"/);
    if (ogImage) item.image_url = ogImage[1];
  } catch (_) {
    if (!item.title) item.title = `왼손 기타 ${item.external_id}`;
    if (!item.product_name) item.product_name = item.title;
  }
  return item;
}

export async function crawlDaangn(options = {}) {
  const { enrich = false, maxItems = 15 } = options;
  const html = await fetchWithHeaders(DAANGN_SEARCH_URL);
  let items = parseListPage(html);

  if (items.length > maxItems) items = items.slice(0, maxItems);

  if (enrich) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const enriched = await enrichFromDetail(items[i]);
      if (enriched != null) out.push(enriched);
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    return out;
  }

  return items;
}
