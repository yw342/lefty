/**
 * 전체 크롤러 통합 테스트
 * node scripts/test-all-crawlers.mjs
 * (뮬/번개장터 테스트 시 로컬에서 SCRAPER_API_KEY 설정 필요)
 */
import { crawlJoongna } from '../api/crawl/joongna.js';
import { crawlMule } from '../api/crawl/mule.js';
import { crawlDaangn } from '../api/crawl/daangn.js';
import { crawlBunjang } from '../api/crawl/bunjang.js';

async function main() {
  console.log('=== 중고나라 ===');
  let joongna = [];
  try {
    joongna = await crawlJoongna({ enrich: true, maxItems: 3 });
    console.log('수집:', joongna.length, '건');
    joongna.slice(0, 2).forEach((i, idx) => console.log(' ', idx + 1, i.title, i.price));
  } catch (e) {
    console.log('실패:', e.message);
  }

  console.log('\n=== 뮬 ===');
  let mule = [];
  try {
    mule = await crawlMule({
      maxItems: 5,
      maxPages: 1,
      scraperApiKey: process.env.SCRAPER_API_KEY,
    });
    console.log('수집:', mule.length, '건');
    mule.slice(0, 2).forEach((i, idx) => console.log(' ', idx + 1, i.title, i.price));
  } catch (e) {
    console.log('실패:', e.message);
  }

  console.log('\n=== 당근마켓 ===');
  let daangn = [];
  try {
    daangn = await crawlDaangn({ enrich: false, maxItems: 5 });
    console.log('목록 파싱:', daangn.length, '건');
    if (daangn.length > 0) {
      daangn = await crawlDaangn({ enrich: true, maxItems: 3 });
      console.log('enrich 후:', daangn.length, '건');
      daangn.slice(0, 2).forEach((i, idx) => console.log(' ', idx + 1, i.title, i.price));
    }
  } catch (e) {
    console.log('실패:', e.message);
  }

  console.log('\n=== 번개장터 ===');
  let bunjang = [];
  try {
    bunjang = await crawlBunjang({
      maxItems: 5,
      scraperApiKey: process.env.SCRAPER_API_KEY,
    });
    console.log('수집:', bunjang.length, '건');
    bunjang.slice(0, 2).forEach((i, idx) => console.log(' ', idx + 1, i.title, i.price));
  } catch (e) {
    console.log('실패:', e.message);
  }

  console.log('\n--- 요약 ---');
  console.log('중고나라:', joongna.length, '| 뮬:', mule.length, '| 당근:', daangn.length, '| 번개장터:', bunjang.length);
  const total = joongna.length + mule.length + daangn.length + bunjang.length;
  if (total === 0) {
    console.log('수집된 매물 없음. 뮬/번개장터는 SCRAPER_API_KEY 설정 시 재시도.');
    process.exitCode = 1;
  } else {
    console.log('총', total, '건 수집됨');
  }
}

main();
