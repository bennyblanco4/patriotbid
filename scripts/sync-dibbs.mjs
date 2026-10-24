// Imports a DIBBS issue date into the live database by walking every page
// through the site's own API, the same way the dashboard does in a browser.
// The server saves the day once it has seen the last page.
//
//   node scripts/sync-dibbs.mjs [base-url] [MM-DD-YYYY]
//
// Without a date it imports the newest list DIBBS has posted.

const base = (process.argv[2] || "https://bidprospect.com").replace(/\/$/, "");
const date = process.argv[3] || "";
if (date && !/^\d{2}-\d{2}-\d{4}$/.test(date)) {
  console.error(`Invalid date "${date}". Use MM-DD-YYYY.`);
  process.exit(1);
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchPage(page) {
  const query = new URLSearchParams({ page: String(page) });
  if (date) query.set("date", date);
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`${base}/api/opportunities?${query}`, {
        signal: AbortSignal.timeout(90000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
      return body;
    } catch (error) {
      if (attempt >= 4) throw error;
      console.log(`Page ${page} failed (${error.message}), retrying`);
      // The first request also wakes the Heroku dyno, which can take a while.
      await wait(attempt * 10000);
    }
  }
}

const first = await fetchPage(1);
if (first.skipped) {
  console.log(`${first.date} was already saved and is final; nothing to do.`);
  process.exit(0);
}
console.log(`${first.date}: ${first.total} requests on ${first.pages} pages`);

let last = first;
for (let page = 2; page <= first.pages; page++) {
  await wait(1000);
  last = await fetchPage(page);
  if (page % 10 === 0) console.log(`Page ${page} of ${first.pages}`);
}

if (!last.stored) {
  console.error(`${first.date} did not finish saving. Run the sync again.`);
  process.exit(1);
}
console.log(`Saved ${first.date}.`);
