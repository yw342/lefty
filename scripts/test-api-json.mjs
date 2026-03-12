/**
 * API가 항상 유효한 JSON을 반환하는지 검증
 * node scripts/test-api-json.mjs
 */
import listingsHandler from '../api/listings.js';
import crawlHandler from '../api/crawl/index.js';

function mockRes() {
  const out = { statusCode: null, headers: {}, body: null };
  return {
    setHeader(name, value) {
      out.headers[name] = value;
    },
    status(code) {
      out.statusCode = code;
      return this;
    },
    end(data) {
      out.body = data;
      return this;
    },
    getOut() {
      return out;
    },
  };
}

async function testListings() {
  const res = mockRes();
  await listingsHandler({ method: 'GET', query: { page: '1', limit: '2' } }, res);
  const out = res.getOut();
  const parsed = JSON.parse(out.body);
  if (!parsed.pagination && !parsed.error) throw new Error('listings: unexpected shape');
  console.log('listings:', out.statusCode, Object.keys(parsed));
}

async function testCrawl() {
  const res = mockRes();
  await crawlHandler({ method: 'GET' }, res);
  const out = res.getOut();
  const parsed = JSON.parse(out.body);
  if (parsed.ok === undefined && !parsed.error) throw new Error('crawl: unexpected shape');
  console.log('crawl:', out.statusCode, 'ok=', parsed.ok, 'results.total=', parsed.results?.total);
}

(async () => {
  try {
    await testListings();
    await testCrawl();
    console.log('OK: both APIs returned valid JSON');
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  }
})();
