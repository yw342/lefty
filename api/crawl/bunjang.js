/**
 * 번개장터(m.bunjang.co.kr) 왼손 기타 검색 결과 크롤링
 * 검색/상세가 JS 렌더링이라 SCRAPER_API_KEY 있으면 ScraperAPI로 목록·상세 수집
 * 기타/베이스 관련 제목만 저장, 판매완료 제외
 */

const BUNJANG_SEARCH_BASE = 'https://m.bunjang.co.kr/search/products';
const BUNJANG_BASE = 'https://m.bunjang.co.kr';

function buildSearchUrl(page = 1) {
  const params = new URLSearchParams({
    q: '왼손기타',
    page: String(page),
  });
  return `${BUNJANG_SEARCH_BASE}?${params.toString()}`;
}

/** 제목이 기타/베이스 관련인지 (당근과 동일 기준) */
function isGuitarRelated(title) {
  if (!title || typeof title !== 'string') return false;
  const t = title.trim();
  if (/골프|자동차|부동산|의류|가구|식품/i.test(t)) return false;
  return /기타|베이스|일렉|통기타|어쿠스틱|레스폴|스트랫|펜더|깁슨|야마하|이바네즈|아이바네즈|왼손\s*잡이|왼손\s*기타/i.test(t);
}

/**
 * 검색 결과 HTML에서 상품 pid 추출
 * 링크 형식: /products/123456 또는 m.bunjang.co.kr/products/123456
 */
function parseListPage(html) {
  const items = [];
  const seen = new Set();
  const re = /\/products\/(\d+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const pid = m[1];
    if (seen.has(pid)) continue;
    seen.add(pid);
    items.push({
      source_site: 'bunjang',
      external_id: pid,
      title: null,
      price: null,
      product_name: null,
      image_url: null,
      url: `${BUNJANG_BASE}/products/${pid}`,
      description: null,
      location: null,
    });
  }
  return items;
}

/**
 * 상세 페이지에서 제목, 가격, 이미지 추출. 판매완료면 null
 */
async function enrichFromDetail(item, fetchFn) {
  try {
    const html = await fetchFn(item.url);
    if (/판매\s*완료|판매완료|거래\s*완료|삭제된\s*상품/i.test(html)) return null;

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const raw = titleMatch[1].replace(/\s*[\|\-]\s*번개장터.*$/i, '').trim();
      if (raw) {
        item.title = raw;
        item.product_name = raw;
      }
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

/**
 * 번개장터 크롤
 * options.scraperApiKey: 있으면 ScraperAPI로 검색·상세 요청 (JS 렌더링 대응)
 */
export async function crawlBunjang(options = {}) {
  const { maxItems = 15, scraperApiKey } = options;
  const apiKey = scraperApiKey || (typeof process !== 'undefined' && process.env && process.env.SCRAPER_API_KEY);

  const fetchFn = apiKey
    ? async (url) => {
        const res = await fetch(
          `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`,
          { signal: AbortSignal.timeout(25000) }
        );
        if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}: ${url}`);
        return res.text();
      }
    : async (url) => {
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
      };

  const all = [];
  for (let page = 1; page <= 3; page++) {
    try {
      const html = await fetchFn(buildSearchUrl(page));
      const items = parseListPage(html);
      for (const item of items) {
        if (all.length >= maxItems) break;
        const enriched = await enrichFromDetail(item, fetchFn);
        if (enriched != null && isGuitarRelated(enriched.title)) all.push(enriched);
        await new Promise(r => setTimeout(r, 500));
      }
      if (items.length === 0) break;
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      if (page === 1) throw e;
      break;
    }
  }

  return all.slice(0, maxItems);
}
