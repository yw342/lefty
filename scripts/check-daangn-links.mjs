import { crawlDaangn } from '../api/crawl/daangn.js';

// 실제 크롤러와 동일한 URL (only_on_sale=true)
const url = 'https://www.daangn.com/kr/buy-sell/s/?search=%EC%99%BC%EC%86%90%EA%B8%B0%ED%83%80&only_on_sale=true';
const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' } }).then(r => r.text());
console.log('HTML length:', html.length, 'has product path:', html.includes('/kr/buy-sell/%EC%99%BC'));
const re = /href="([^"]*\/kr\/buy-sell\/([^"]+))"/g;
let m;
const links = [];
while ((m = re.exec(html)) !== null) {
  const slug = m[2].split('?')[0];
  if (slug && slug !== 's' && !slug.startsWith('s?') && slug.length >= 4) links.push({ slug: slug.slice(0, 40), full: m[1].slice(0, 80) });
}
console.log('Product-like links:', links.length);
links.forEach((l, i) => console.log(i + 1, l.slug, l.full));

console.log('\n--- parseListPage ---');
const items = await crawlDaangn({ enrich: false, maxItems: 10 });
console.log('Items:', items.length);
items.forEach((i, idx) => console.log(idx + 1, i.external_id?.slice(0, 30), i.url?.slice(0, 60)));
