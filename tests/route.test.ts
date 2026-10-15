import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRfqHtml } from "../lib/dibbs";
import {
  awardMethod,
  daysLeft,
  filterRows,
  initialFilters,
  isPastIssueDate,
  todayEt,
} from "../lib/opportunities";

process.env.RFQ_DB_PATH = join(mkdtempSync(join(tmpdir(), "rfq-")), "rfqs.sqlite");
delete process.env.DATABASE_URL;

const rows = parseRfqHtml(
  readFileSync(new URL("./dibbs-real-page.html", import.meta.url), "utf8"),
);
const url = (query: string) =>
  new Request(`http://localhost/api/opportunities${query}`);

test("stored days are served as valid JSON with every row intact", async () => {
  const { saveDay, saveDates } = await import("../lib/store");
  const { GET } = await import("../app/api/opportunities/route");
  await saveDates(["09-29-2026", "09-28-2026"]);
  await saveDay({
    date: "09-28-2026",
    rows,
    total: rows.length,
    pages: 1,
    fetchedAt: "2026-09-28T12:00:00.000Z",
    source: "https://www.dibbs.bsm.dla.mil/RFQ/",
  });
  const day = await (await GET(url("?date=09-28-2026"))).json();
  assert.equal(day.stored, true);
  assert.equal(day.date, "09-28-2026");
  assert.deepEqual(day.dates, ["09-29-2026", "09-28-2026"]);
  assert.deepEqual(day.rows, rows);
  assert.equal(day.total, 50);

  const empty = await (await GET(url("?date=09-29-2026"))).json();
  assert.equal(empty.stored, false);
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.fetchedAt, null);

  const latest = await (await GET(url(""))).json();
  assert.equal(latest.date, "09-29-2026");
});

test("a complete past day skips the source and keeps its rows", async () => {
  const { GET } = await import("../app/api/opportunities/route");
  const res = await GET(url("?date=09-28-2026&page=3"));
  const body = await res.json();
  assert.equal(body.skipped, true);
  assert.equal(body.pages, 1);
  assert.equal(body.rows.length, 50);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});

test("rejects malformed dates and pages before any work", async () => {
  const { GET } = await import("../app/api/opportunities/route");
  assert.equal((await GET(url("?date=2026-09-28"))).status, 400);
  assert.equal((await GET(url("?date=09-28-2026&page=0"))).status, 400);
  assert.equal((await GET(url("?date=09-28-2026&page=201"))).status, 400);
  assert.equal((await GET(url("?date=09-28-2026&page=1.5"))).status, 400);
});

test("upload fallback saves only valid rows and never overwrites a full past day", async () => {
  const { POST, GET } = await import("../app/api/opportunities/route");
  const post = (body: unknown) =>
    POST(
      new Request("http://localhost/api/opportunities", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  const bad = { ...rows[0], id: "bad", url: "https://evil.test/" };
  const saved = await (
    await post({ date: "09-20-2026", rows: [rows[0], bad], total: 1 })
  ).json();
  assert.equal(saved.count, 1);
  const day = await (await GET(url("?date=09-20-2026"))).json();
  assert.deepEqual(
    day.rows.map((r: { id: string }) => r.id),
    [rows[0].id],
  );
  const kept = await (
    await post({ date: "09-28-2026", rows: [], total: 0 })
  ).json();
  assert.equal(kept.skipped, true);
  assert.equal(kept.count, 50);
  assert.equal((await post({ date: "nope", rows: [] })).status, 400);
});

test("saving the same issue dates twice is a no-op and changes still apply", async () => {
  const { saveDates, loadDates } = await import("../lib/store");
  await saveDates(["10-01-2026", "09-30-2026"]);
  await saveDates(["10-01-2026", "09-30-2026"]);
  assert.deepEqual(await loadDates(), ["10-01-2026", "09-30-2026"]);
  await saveDates(["10-02-2026", "10-01-2026"]);
  assert.deepEqual(await loadDates(), ["10-02-2026", "10-01-2026"]);
});

test("cached today matches the eastern calendar date", () => {
  const expected = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
  assert.equal(todayEt(), expected);
  assert.equal(daysLeft(expected), 0);
  assert.equal(isPastIssueDate("01-01-2000"), true);
  assert.equal(isPastIssueDate("01-01-2999"), false);
});

test("open filter keeps today's deadline and drops yesterday's", () => {
  const row = rows[0];
  const open = (due: string | null) =>
    filterRows([{ ...row, due }], { ...initialFilters, open: true }, "2026-10-08")
      .length;
  assert.equal(open("2026-10-08"), 1);
  assert.equal(open("2026-10-07"), 0);
  assert.equal(open(null), 1);
});

test("search stays correct across repeated queries on the same rows", () => {
  const find = (search: string) =>
    filterRows(rows, { ...initialFilters, search }).length;
  assert.equal(find("8465016903107"), 1);
  assert.equal(find("  BAG, individual "), find("bag, individual"));
  assert.equal(find(""), rows.length);
  assert.equal(find("zzzz-not-there"), 0);
});

test("award method reads the 9th character of the solicitation number", () => {
  assert.equal(awardMethod("SPE4A6-26-T-1492"), "Automated, lowest price wins");
  assert.equal(awardMethod("SPE7M126U0001"), "Automated, long-term contract");
  assert.equal(awardMethod("SPE2DS-26-Q-0101"), "Reviewed by a buyer");
  assert.equal(awardMethod(""), null);
});
