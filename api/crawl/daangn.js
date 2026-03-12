/**
 * 당근마켓(daangn.com) 왼손 기타 검색 결과 크롤링
 * 검색어: 왼손기타 (지역별 결과가 다를 수 있음)
 * 수집 시 제목이 기타/베이스 관련인 경우만 포함 (골프 등 무관 매물 제외)
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

/** 제목이 기타/베이스 관련인지 여부 (골프 등 무관 매물 제외) */
function isGuitarRelated(title) {
  if (!title || typeof title !== 'string') return false;
  const t = title.trim();
  if (/골프|자동차|부동산|의류|가구|식품/i.test(t)) return false;
  return /기타|베이스|일렉|통기타|어쿠스틱|레스폴|스트랫|펜더|깁슨|야마하|이바네즈|아이바네즈|왼손\s*잡이|왼손\s*기타/i.test(t);
}

/**
 * 목록/검색 페이지에서 상품 링크 추출
 * 당근 상품 URL: /kr/buy-sell/슬러그 (쿼리 없는 경로, 슬러그가 상품 고유)
 */
function parseListPage(html) {
  const items = [];
  const seen = new Set();
  // /kr/buy-sell/슬러그 (검색 /s, /s? 제외)
  const linkRegex = /href="([^"]*\/kr\/buy-sell\/([^"]+))"/gi;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    let pathOrFull = m[1];
    let slug = (m[2] || '').trim().split('?')[0];
    if (!slug || slug === 's' || slug.startsWith('s?')) continue;
    if (slug.length < 4) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const path = pathOrFull.startsWith('http') ? pathOrFull.replace(/^https?:\/\/[^/]+/, '').split('?')[0] : pathOrFull.split('?')[0];
    const finalUrl = (path.startsWith('/') ? DAANGN_BASE + path : DAANGN_BASE + '/' + path) + (path.endsWith('/') ? '' : '/');

    items.push({
      source_site: 'daangn',
      external_id: slug,
      title: null,
      price: null,
      product_name: null,
      image_url: null,
      url: finalUrl,
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
      let item = null;
      if (enriched != null) {
        item = enriched;
      } else {
        const fallback = { ...items[i] };
        try {
          fallback.title = decodeURIComponent(fallback.external_id.replace(/-/g, ' ')).slice(0, 60) || `왼손 기타`;
        } catch (_) {
          fallback.title = '왼손 기타 (당근)';
        }
        fallback.product_name = fallback.title;
        item = fallback;
      }
      if (item && isGuitarRelated(item.title)) out.push(item);
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    return out;
  }

  return items;
}
