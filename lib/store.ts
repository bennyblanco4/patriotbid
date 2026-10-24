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

