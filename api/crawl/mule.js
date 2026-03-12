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

/** 프록시 경유 fetch (403 우회용). 우선 ScraperAPI, 없으면 공개 프록시 시도 */
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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Referer': 'https://www.mule.co.kr/bbs/market/sell',
    };
    let res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (res.status === 403 || res.status === 0) {
      for (const proxy of [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
      ]) {
        try {
          const r = await fetch(proxy, { signal: AbortSignal.timeout(15000) });
          if (r.ok) {
            res = r;
            break;
          }
        } catch (_) {}
      }
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.text();
  };
}

/**
 * 링크 텍스트에서 제목·가격 추출
 */
function parseTitlePrice(text) {
  let title = (text || '').trim().replace(/\s+/g, ' ');
  let price = null;
  const priceSuffix = title.match(/\s*\[\d+\]\s*(\d+(?:\.\d+)?)\s*만원\s*$/);
  if (priceSuffix) {
    price = `${priceSuffix[1]}만원`;
    title = title.replace(/\s*\[\d+\]\s*\d+(?:\.\d+)?\s*만원\s*$/, '').trim();
  } else {
    const priceOnly = title.match(/(\d+(?:\.\d+)?)\s*만원\s*$|(\d{1,3}(?:,\d{3})*)\s*원\s*$/);
    if (priceOnly) {
      if (priceOnly[1]) price = `${priceOnly[1]}만원`;
      else if (priceOnly[2]) price = priceOnly[2].trim() + '원';
      title = title.replace(/\s*\d+(?:\.\d+)?\s*만원\s*$|\s*\d{1,3}(?:,\d{3})*\s*원\s*$/, '').trim();
    }
  }
  title = title.replace(/\s*\[\d+\]\s*$/, '').trim();
  return { title: title || null, price };
}

/**
 * 목록 HTML에서 게시글 행 파싱
 * - href="..." 또는 href='...' 또는 ](url) 마크다운 스타일 지원
 */
function parseListPage(html) {
  const items = [];
  const seen = new Set();

  function addItem(idx, linkText) {
    if (seen.has(idx)) return;
    if (/\[필독\]|뮬지기3?|^공지\s/i.test(linkText || '')) return;
    if (/판매\s*완료|판매완료/i.test(linkText || '')) return;
    seen.add(idx);

    const { title: parsedTitle, price } = parseTitlePrice(linkText);
    const title = parsedTitle || `왼손 기타 ${idx}`;

    items.push({
      source_site: 'mule',
      external_id: idx,
      title,
      price,
      product_name: title,
      image_url: null,
      url: `${MULE_BASE}/bbs/market/sell?idx=${idx}&v=v`,
      description: null,
      location: null,
    });
  }

  // 1) href="...idx=123..."> 텍스트
  let m;
  const re1 = /href="([^"]*\/bbs\/market\/sell\?[^"]*idx=(\d+)[^"]*)"[^>]*>\s*([^<]*)</g;
  while ((m = re1.exec(html)) !== null) addItem(m[2], m[3]);

  // 2) href='...idx=123...'> (단일 따옴표)
  const re2 = /href='([^']*\/bbs\/market\/sell\?[^']*idx=(\d+)[^']*)'[^>]*>\s*([^<]*)</g;
  while ((m = re2.exec(html)) !== null) addItem(m[2], m[3]);

  // 3) 마크다운 스타일 ](url)...  제목](url)
  const re3 = /\]\((https?:\/\/[^)]*\/bbs\/market\/sell\?[^)]*idx=(\d+)[^)]*)\)\s*\|/g;
  while ((m = re3.exec(html)) !== null) addItem(m[2], null);

  // 4) ](url) 직전 텍스트가 이전 매치 끝에서부터인 경우: [...제목 [1] 25만원](url)
  const re4 = /\[([^\]]{10,}?)\]\s*\((https?:\/\/[^)]*\/bbs\/market\/sell\?[^)]*idx=(\d+)[^)]*)\)/g;
  while ((m = re4.exec(html)) !== null) addItem(m[3], m[1]);

  // 5) 폴백: href 어딘가에 idx=숫자만 있어도 수집 (공지 대부분 66xxxxx 이하이므로 67xxxxx 이상만)
  const re5 = /\/bbs\/market\/sell\?[^"'>]*idx=(\d+)/g;
  while ((m = re5.exec(html)) !== null) {
    const idx = m[1];
    if (seen.has(idx)) continue;
    const num = parseInt(idx, 10);
    if (num >= 67000000) {
      seen.add(idx);
      items.push({
        source_site: 'mule',
        external_id: idx,
        title: `왼손 기타 ${idx}`,
        price: null,
        product_name: null,
        image_url: null,
        url: `${MULE_BASE}/bbs/market/sell?idx=${idx}&v=v`,
        description: null,
        location: null,
      });
    }
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
