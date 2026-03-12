/**
 * 크롤러 검증 테스트 (로컬)
 * node scripts/test-crawl.mjs
 */
import { crawlJoongna } from '../api/crawl/joongna.js';

async function main() {
  console.log('중고나라 왼손 기타 크롤링 테스트...');
  try {
    const items = await crawlJoongna({ enrich: true, maxItems: 3 });
    console.log('수집 건수:', items.length);
    items.forEach((item, i) => {
      console.log(`\n[${i + 1}]`, item.title);
      console.log('  가격:', item.price);
      console.log('  URL:', item.url);
      console.log('  이미지:', item.image_url ? '있음' : '없음');
    });
  } catch (e) {
    console.error('실패:', e.message);
    process.exit(1);
  }
}

main();
