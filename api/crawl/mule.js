/**
 * 뮬(mule.co.kr) 중고악기 장터 - 왼손 기타 검색 결과 크롤링
 * soldout=n → 판매중만 (판매완료 제외)
 *
 * 403 우회: 환경변수 SCRAPER_API_KEY 가 있으면 ScraperAPI로 요청 (프록시 경유)
 * - 무료 크레딧 5000회: https://www.scraperapi.com
 */

const MULE_LIST_URL = 'https://www.mule.co.kr/bbs/market/sell';
const MULE_BASE = 'https://www.mule.co.kr';

function buildListUrl(page = 1) {
  const params = new URLSearchParams({
    qf: 'title',
    qs: '왼손',
    mode: 'list',
    map: 'list',
    soldout: 'n',  // 판매중만 (판매완료 제외)
    page: String(page),
    of: 'wdate',
    od: 'desc',
  });
  return `${MULE_LIST_URL}?${params.toString()}`;
}

/** SCRAPER_API_KEY 있으면 프록시 경유 fetch, 없으면 직접 fetch */
function createFetcher() {
  const apiKey = typeof process !== 'undefined' && process.env && process.env.SCRAPER_API_KEY;
  if (apiKey) {
    return async (url) => {
      const res = await fetch(
        `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(25000) }
      );
      if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}: ${url}`);
      return res.text();
    };
  }
  return async (url) => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://www.mule.co.kr/bbs/market/sell',
        'Origin': 'https://www.mule.co.kr',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.text();
  };
}

/**
 * 목록 HTML에서 게시글 행 파싱
 * - href 내 idx=숫자 추출 (매칭: &amp; 또는 & 사용)
 * - 제목·가격은 링크 텍스트 또는 인근 텍스트에서 추출
 */
function parseListPage(html) {
  const items = [];
  const seen = new Set();

  // 1) href="...bbs/market/sell?...idx=123..."> 텍스트 (공백/개행 허용)
  const linkRegex = /href="([^"]*\/bbs\/market\/sell\?[^"]*idx=(\d+)[^"]*)"[^>]*>\s*([^<]*)</g;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const idx = m[2];
    let text = (m[3] || '').trim().replace(/\s+/g, ' ');

    if (seen.has(idx)) continue;
    if (/\[필독\]|뮬지기3?|^공지\s/i.test(text)) continue;
    if (/판매\s*완료|판매완료/i.test(text)) continue;

    seen.add(idx);
    const cleanUrl = `${MULE_BASE}/bbs/market/sell?idx=${idx}&v=v`;

    let price = null;
    const priceSuffix = text.match(/\s*\[\d+\]\s*(\d+(?:\.\d+)?)\s*만원\s*$/);
    if (priceSuffix) {
      price = `${priceSuffix[1]}만원`;
      text = text.replace(/\s*\[\d+\]\s*\d+(?:\.\d+)?\s*만원\s*$/, '').trim();
    } else {
      const priceOnly = text.match(/(\d+(?:\.\d+)?)\s*만원\s*$|(\d{1,3}(?:,\d{3})*)\s*원\s*$/);
      if (priceOnly) {
        if (priceOnly[1]) price = `${priceOnly[1]}만원`;
        else if (priceOnly[2]) price = priceOnly[2].trim() + '원';
        text = text.replace(/\s*\d+(?:\.\d+)?\s*만원\s*$|\s*\d{1,3}(?:,\d{3})*\s*원\s*$/, '').trim();
      }
    }
    const title = text.replace(/\s*\[\d+\]\s*$/, '').trim() || `왼손 기타 ${idx}`;

    items.push({
      source_site: 'mule',
      external_id: idx,
      title,
      price,
      product_name: title,
      image_url: null,
      url: cleanUrl,
      description: null,
      location: null,
    });
  }

  return items;
}

/**
 * 뮬 목록 1~N페이지 크롤 (판매중만, soldout=n)
 * options.scraperApiKey: 있으면 해당 키로 ScraperAPI 사용 (403 우회)
 */
export async function crawlMule(options = {}) {
  const { maxItems = 30, maxPages = 2, scraperApiKey } = options;
  const all = [];
  const fetchFn = scraperApiKey
    ? async (url) => {
        const res = await fetch(
          `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`,
          { signal: AbortSignal.timeout(25000) }
        );
        if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}: ${url}`);
        return res.text();
      }
    : createFetcher();

  for (let page = 1; page <= maxPages; page++) {
    try {
      const html = await fetchFn(buildListUrl(page));
      const items = parseListPage(html);
      for (const item of items) {
        if (all.length >= maxItems) break;
        all.push(item);
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
