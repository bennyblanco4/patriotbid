import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type Pool as PgPool } from "pg";
import { isPastIssueDate, type Opportunity } from "./opportunities";

export type StoredDay = {
  date: string;
  rows: Opportunity[];
  total: number;
  pages: number;
  fetchedAt: string;
  source: string;
};

const globalDb = globalThis as unknown as {
  rfqDb?: DatabaseSync;
  rfqPg?: PgPool;
  rfqPgReady?: Promise<void>;
  rfqDatesKey?: string;
  rfqListingsReady?: Promise<void>;
};

function usePostgres() {
  return Boolean(process.env.DATABASE_URL);
}

function sqlite() {
  if (!globalDb.rfqDb) {
    const file =
      process.env.RFQ_DB_PATH || join(process.cwd(), "data", "rfqs.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec(`
      CREATE TABLE IF NOT EXISTS days (
        issue_date TEXT PRIMARY KEY,
        total INTEGER NOT NULL,
        pages INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        source TEXT NOT NULL,
        rows_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS issue_dates (
        issue_date TEXT PRIMARY KEY,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS parts (
        nsn TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        checked_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        nsn TEXT NOT NULL,
        fsc TEXT NOT NULL,
        due TEXT,
        issue_date TEXT NOT NULL,
        row_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS listings_nsn ON listings (nsn);
      CREATE INDEX IF NOT EXISTS listings_fsc ON listings (fsc);
    `);
    globalDb.rfqDb = db;
  }
  return globalDb.rfqDb;
}

function postgres() {
  if (!globalDb.rfqPg) {
    globalDb.rfqPg = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalDb.rfqPg;
}

async function ready() {
  if (!usePostgres()) return;
  if (!globalDb.rfqPgReady) {
    globalDb.rfqPgReady = postgres().query(`
      CREATE TABLE IF NOT EXISTS days (
        issue_date TEXT PRIMARY KEY,
        total INTEGER NOT NULL,
        pages INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        source TEXT NOT NULL,
        rows_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS issue_dates (
        issue_date TEXT PRIMARY KEY,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS parts (
        nsn TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        checked_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        nsn TEXT NOT NULL,
        fsc TEXT NOT NULL,
        due TEXT,
        issue_date TEXT NOT NULL,
        row_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS listings_nsn ON listings (nsn);
      CREATE INDEX IF NOT EXISTS listings_fsc ON listings (fsc);
    `).then(() => undefined);
  }
  await globalDb.rfqPgReady;
}

function cleanDates(dates: string[]) {
  return [
    ...new Set(dates.filter((date) => /^\d{2}-\d{2}-\d{4}$/.test(date))),
  ];
}

export async function saveDates(dates: string[]) {
  const clean = cleanDates(dates);
  // Every first page and every dates request saves the list; skip the
  // rewrite when nothing changed.
  const key = clean.join(",");
  if (!clean.length || globalDb.rfqDatesKey === key) return;
  if (!usePostgres()) {
    const db = sqlite();
    const insert = db.prepare(
      "INSERT INTO issue_dates (issue_date, position) VALUES (?, ?)",
    );
    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM issue_dates");
      clean.forEach((date, index) => insert.run(date, index));
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    globalDb.rfqDatesKey = key;
    return;
  }
  await ready();
  const client = await postgres().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM issue_dates");
    await client.query(
      `INSERT INTO issue_dates (issue_date, position)
       SELECT date, position - 1 FROM unnest($1::text[]) WITH ORDINALITY AS t(date, position)`,
      [clean],
    );
    await client.query("COMMIT");
    globalDb.rfqDatesKey = key;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loadDates() {
  if (!usePostgres()) {
    return sqlite()
      .prepare("SELECT issue_date FROM issue_dates ORDER BY position")
      .all()
      .map((row) => String(row.issue_date));
  }
  await ready();
  const result = await postgres().query(
    "SELECT issue_date FROM issue_dates ORDER BY position",
  );
  return result.rows.map((row) => String(row.issue_date));
}

export async function saveDay(day: StoredDay) {
  const rowsJson = JSON.stringify(day.rows);
  if (!usePostgres()) {
    sqlite()
      .prepare(
        `INSERT INTO days (issue_date, total, pages, fetched_at, source, rows_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(issue_date) DO UPDATE SET
           total = excluded.total,
           pages = excluded.pages,
           fetched_at = excluded.fetched_at,
           source = excluded.source,
           rows_json = excluded.rows_json`,
      )
      .run(
        day.date,
        day.total,
        day.pages,
        day.fetchedAt,
        day.source,
        rowsJson,
      );
    await syncListings(day.date);
    return;
  }
  await ready();
  await postgres().query(
    `INSERT INTO days (issue_date, total, pages, fetched_at, source, rows_json)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (issue_date) DO UPDATE SET
       total = EXCLUDED.total,
       pages = EXCLUDED.pages,
       fetched_at = EXCLUDED.fetched_at,
       source = EXCLUDED.source,
       rows_json = EXCLUDED.rows_json`,
    [day.date, day.total, day.pages, day.fetchedAt, day.source, rowsJson],
  );
  await syncListings(day.date);
}

export type RawDay = Omit<StoredDay, "rows"> & {
  rowsJson: string;
  count: number;
};

// Rows stay as the stored JSON text so a read can go straight to the
// response without a parse and re-serialize of the whole day.
export async function loadDayRaw(date: string): Promise<RawDay | null> {
  let row: Record<string, unknown> | undefined;
  if (!usePostgres()) {
    row = sqlite()
      .prepare(
        "SELECT issue_date, total, pages, fetched_at, source, rows_json, json_array_length(rows_json) AS count FROM days WHERE issue_date = ?",
      )
      .get(date);
  } else {
    await ready();
    const result = await postgres().query(
      "SELECT issue_date, total, pages, fetched_at, source, rows_json, json_array_length(rows_json::json) AS count FROM days WHERE issue_date = $1",
      [date],
    );
    row = result.rows[0];
  }
  if (!row) return null;
  return {
    date: String(row.issue_date),
    rowsJson: String(row.rows_json),
    count: Number(row.count),
    total: Number(row.total),
    pages: Number(row.pages),
    fetchedAt: String(row.fetched_at),
    source: String(row.source),
  };
}

export async function loadDay(date: string): Promise<StoredDay | null> {
  const raw = await loadDayRaw(date);
  if (!raw) return null;
  const { rowsJson, count, ...day } = raw;
  const rows = JSON.parse(rowsJson) as Opportunity[];
  return { ...day, rows: Array.isArray(rows) ? rows : [] };
}

export async function savedPastDay(
  date: string,
  today?: string,
): Promise<RawDay | null> {
  if (!isPastIssueDate(date, today)) return null;
  const day = await loadDayRaw(date);
  if (!day || day.total < 1 || day.count < day.total) return null;
  return day;
}

// Approved sources and verified photos per NSN, looked up once.
export async function loadPart(nsn: string) {
  if (!usePostgres()) {
    const row = sqlite()
      .prepare("SELECT data_json, checked_at FROM parts WHERE nsn = ?")
      .get(nsn);
    return row
      ? { data: JSON.parse(String(row.data_json)), checkedAt: String(row.checked_at) }
      : null;
  }
  await ready();
  const { rows } = await postgres().query(
    "SELECT data_json, checked_at FROM parts WHERE nsn = $1",
    [nsn],
  );
  return rows[0]
    ? { data: JSON.parse(String(rows[0].data_json)), checkedAt: String(rows[0].checked_at) }
    : null;
}

export async function savePart(nsn: string, data: unknown) {
  const json = JSON.stringify(data);
  const at = new Date().toISOString();
  if (!usePostgres()) {
    sqlite()
      .prepare(
        `INSERT INTO parts (nsn, data_json, checked_at) VALUES (?, ?, ?)
         ON CONFLICT(nsn) DO UPDATE SET data_json = excluded.data_json, checked_at = excluded.checked_at`,
      )
      .run(nsn, json, at);
    return;
  }
  await ready();
  await postgres().query(
    `INSERT INTO parts (nsn, data_json, checked_at) VALUES ($1, $2, $3)
     ON CONFLICT (nsn) DO UPDATE SET data_json = EXCLUDED.data_json, checked_at = EXCLUDED.checked_at`,
    [nsn, json, at],
  );
}

export async function loadParts(nsns: string[]) {
  if (!nsns.length) return [];
  if (!usePostgres()) {
    const marks = nsns.map(() => "?").join(",");
    return sqlite()
      .prepare(`SELECT nsn, data_json FROM parts WHERE nsn IN (${marks})`)
      .all(...nsns)
      .map((row) => ({ nsn: String(row.nsn), data: JSON.parse(String(row.data_json)) }));
  }
  await ready();
  const { rows } = await postgres().query(
    "SELECT nsn, data_json FROM parts WHERE nsn = ANY($1::text[])",
    [nsns],
  );
  return rows.map((row) => ({ nsn: String(row.nsn), data: JSON.parse(String(row.data_json)) }));
}


// One row per request, copied out of the stored days so NSN and category
// pages can look rows up by NSN or supply class without reading every day.
// These pages only ever read the database; nothing here contacts DIBBS.

async function run(sql: string, params: unknown[] = []) {
  if (!usePostgres()) {
    sqlite().prepare(sql).run(...(params as string[]));
    return;
  }
  await ready();
  let n = 0;
  await postgres().query(sql.replace(/\?/g, () => `$${++n}`), params);
}

async function all(sql: string, params: unknown[] = []) {
  if (!usePostgres())
    return sqlite().prepare(sql).all(...(params as string[])) as Record<string, unknown>[];
  await ready();
  let n = 0;
  const { rows } = await postgres().query(sql.replace(/\?/g, () => `$${++n}`), params);
  return rows as Record<string, unknown>[];
}

function copyRows(where: string, onConflict: string) {
  const update = `DO UPDATE SET nsn = excluded.nsn, fsc = excluded.fsc, due = excluded.due,
    issue_date = excluded.issue_date, row_json = excluded.row_json`;
  const action = onConflict === "update" ? update : "DO NOTHING";
  if (!usePostgres())
    return `INSERT INTO listings (id, nsn, fsc, due, issue_date, row_json)
      SELECT json_extract(r.value, '$.id'), json_extract(r.value, '$.nsn'),
        json_extract(r.value, '$.fsc'), json_extract(r.value, '$.due'), d.issue_date, r.value
      FROM days d, json_each(d.rows_json) r
      WHERE ${where} AND json_extract(r.value, '$.id') IS NOT NULL
      ON CONFLICT(id) ${action}`;
  return `INSERT INTO listings (id, nsn, fsc, due, issue_date, row_json)
    SELECT r->>'id', COALESCE(r->>'nsn', ''), COALESCE(r->>'fsc', ''), r->>'due', d.issue_date, r::text
    FROM days d, json_array_elements(d.rows_json::json) r
    WHERE ${where} AND r->>'id' IS NOT NULL
    ON CONFLICT (id) ${action}`;
}

async function syncListings(date: string) {
  await listingsReady();
  await run("DELETE FROM listings WHERE issue_date = ?", [date]);
  await run(copyRows("d.issue_date = ?", "update"), [date]);
}

// Days saved before the listings table existed are copied over once per
// process; a request seen on several days keeps its first copy.
function listingsReady() {
  if (!globalDb.rfqListingsReady)
    globalDb.rfqListingsReady = run(
      copyRows("d.issue_date NOT IN (SELECT DISTINCT issue_date FROM listings)", "skip"),
    ).catch((error) => {
      globalDb.rfqListingsReady = undefined;
      throw error;
    });
  return globalDb.rfqListingsReady;
}

const parseRow = (row: Record<string, unknown>) =>
  JSON.parse(String(row.row_json)) as Opportunity;

export async function loadNsnRows(nsn: string) {
  await listingsReady();
  return (await all("SELECT row_json FROM listings WHERE nsn = ?", [nsn])).map(parseRow);
}

// Requests in one federal supply group (the first two digits of the FSC):
// still open ones first by deadline, or the latest ones when none are open.
export async function loadGroupRows(group: string, today: string, limit = 200) {
  await listingsReady();
  const open = (
    await all(
      `SELECT row_json FROM listings WHERE fsc LIKE ? AND (due IS NULL OR due >= ?)
       ORDER BY due LIMIT ?`,
      [`${group}%`, today, limit],
    )
  ).map(parseRow);
  if (open.length) return { open: true, rows: open };
  const recent = (
    await all("SELECT row_json FROM listings WHERE fsc LIKE ? ORDER BY due DESC LIMIT ?", [
      `${group}%`,
      50,
    ])
  ).map(parseRow);
  return { open: false, rows: recent };
}

export async function groupCounts(today: string) {
  await listingsReady();
  const rows = await all(
    `SELECT substr(fsc, 1, 2) AS grp, COUNT(*) AS total,
       SUM(CASE WHEN due IS NULL OR due >= ? THEN 1 ELSE 0 END) AS open
     FROM listings GROUP BY substr(fsc, 1, 2)`,
    [today],
  );
  return new Map(
    rows.map((row) => [String(row.grp), { total: Number(row.total), open: Number(row.open) }]),
  );
}

// Part details saved for NSNs that have at least one stored request.
export async function listedParts() {
  await listingsReady();
  const rows = await all(
    `SELECT p.nsn, p.data_json, p.checked_at FROM parts p
     WHERE EXISTS (SELECT 1 FROM listings l WHERE l.nsn = p.nsn)`,
  );
  return rows.map((row) => ({
    nsn: String(row.nsn),
    data: JSON.parse(String(row.data_json)),
    checkedAt: String(row.checked_at),
  }));
}
