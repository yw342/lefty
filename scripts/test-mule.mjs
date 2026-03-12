/**
 * 뮬 크롤러 검증 (로컬)
 * node scripts/test-mule.mjs
 */
import { crawlMule } from '../api/crawl/mule.js';

async function main() {
  console.log('뮬 왼손 기타 크롤링 테스트 (판매중만, soldout=n)...');
  try {
    const items = await crawlMule({ maxItems: 5, maxPages: 1 });
    console.log('수집 건수:', items.length);
    items.forEach((item, i) => {
      console.log(`\n[${i + 1}]`, item.title);
      console.log('  가격:', item.price);
      console.log('  URL:', item.url);
    });
  } catch (e) {
    console.error('실패:', e.message);
    process.exit(1);
  }
}

main();
