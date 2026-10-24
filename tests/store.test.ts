import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Opportunity } from "../lib/opportunities";

process.env.RFQ_DB_PATH = join(mkdtempSync(join(tmpdir(), "rfq-")), "rfqs.sqlite");

const row: Opportunity = {
  purchaseRequest: "1",
  status: "Open",
  id: "SPE1C1-26-T-1800:8465-01-690-3107:1",
  solicitation: "SPE1C1-26-T-1800",
  nsn: "8465-01-690-3107",
  fsc: "8465",
  title: "BAG, INDIVIDUAL EQUI",
  quantity: 2,
  unit: "",
  setAside: "Unrestricted",
  issued: "2026-09-28",
  due: "2026-10-08",
  docs: false,
  url: "https://www.dibbs.bsm.dla.mil/RFQ/rfqrec.aspx?sn=SPE1C126T1800",
};

test("saves a daily listing and the other issue dates", async () => {
  const { saveDates, loadDates, saveDay, loadDay, savedPastDay } = await import(
    "../lib/store"
  );
  await saveDates(["09-28-2026", "09-27-2026"]);
  assert.deepEqual(await loadDates(), ["09-28-2026", "09-27-2026"]);
  await saveDay({
    date: "09-27-2026",
    rows: [row],
    total: 1,
    pages: 1,
    fetchedAt: "2026-09-28T12:00:00.000Z",
    source: "https://www.dibbs.bsm.dla.mil/RFQ/",
  });
  assert.equal(await loadDay("09-28-2026"), null);
  assert.equal((await loadDay("09-27-2026"))?.rows[0].solicitation, row.solicitation);
  await saveDates(["09-26-2026"]);
  assert.deepEqual(await loadDates(), ["09-26-2026"]);
  assert.equal((await savedPastDay("09-27-2026", "2026-09-28"))?.count, 1);
  assert.equal(await savedPastDay("09-28-2026", "2026-09-28"), null);
  await saveDay({
    date: "09-26-2026",
    rows: [row],
    total: 10,
    pages: 1,
    fetchedAt: "2026-09-28T12:00:00.000Z",
    source: "https://www.dibbs.bsm.dla.mil/RFQ/",
  });
  assert.equal(await savedPastDay("09-26-2026", "2026-09-28"), null);
});

test("saved days fill the listings that NSN and category pages read", async () => {
  const { saveDay, loadNsnRows, loadGroupRows, groupCounts } = await import("../lib/store");
  const day = {
    date: "09-26-2026",
    total: 1,
    pages: 1,
    fetchedAt: "2026-09-27T12:00:00.000Z",
    source: "https://www.dibbs.bsm.dla.mil/RFQ/",
  };
  const other = { ...row, id: "SPE1C1-26-T-1801:8465-01-690-3107:2", solicitation: "SPE1C1-26-T-1801" };
  await saveDay({ ...day, rows: [row, other] });
  assert.equal((await loadNsnRows(row.nsn)).length, 2);
  const group = await loadGroupRows("84", "2026-10-01");
  assert.equal(group.open, true);
  assert.ok(group.rows.some((r) => r.id === row.id));
  assert.ok(((await groupCounts("2026-10-01")).get("84")?.open ?? 0) >= 2);
  assert.equal((await loadGroupRows("84", "2026-12-01")).open, false);

  // Saving the day again replaces its rows rather than keeping stale ones.
  await saveDay({ ...day, rows: [row] });
  assert.deepEqual(
    (await loadNsnRows(row.nsn)).map((r) => r.id).sort(),
    [row.id],
  );
});
