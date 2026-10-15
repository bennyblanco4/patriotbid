import { fetchDailyRfqs, type Feed } from "../../../lib/dibbs";
import type { Opportunity } from "../../../lib/opportunities";
import {
  loadDates,
  loadDayRaw,
  saveDates,
  saveDay,
  savedPastDay,
  type RawDay,
} from "../../../lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;
const cache = new Map<string, { feed: Feed; at: number }>();
const pending = new Map<string, Promise<Feed>>();
// Rows gathered per issue date while the browser walks the source pages, so
// the server can save the finished day itself instead of the browser
// uploading every row back after the import.
const imports = new Map<string, Map<number, Opportunity[]>>();
const noStore = { "Cache-Control": "no-store" };

function isOpportunity(value: unknown): value is Opportunity {
  if (!value || typeof value !== "object") return false;
  const row = value as Opportunity;
  return (
    typeof row.id === "string" &&
    typeof row.solicitation === "string" &&
    typeof row.nsn === "string" &&
    typeof row.title === "string" &&
    typeof row.url === "string" &&
    row.url.startsWith("https://www.dibbs.bsm.dla.mil/")
  );
}

// Stored rows are already JSON text; splice them in rather than parsing and
// re-serializing the whole day.
function dayResponse(day: RawDay | null, fields: Record<string, unknown>) {
  const meta = JSON.stringify({
    total: day?.total ?? 0,
    pages: day?.pages ?? 0,
    fetchedAt: day?.fetchedAt ?? null,
    source: day?.source ?? "",
    ...fields,
  });
  return new Response(`${meta.slice(0, -1)},"rows":${day?.rowsJson ?? "[]"}}`, {
    headers: { "Content-Type": "application/json", ...noStore },
  });
}

async function collect(feed: Feed) {
  let pages = imports.get(feed.date);
  if (!pages || feed.page === 1) {
    pages = new Map();
    imports.delete(feed.date);
    if (imports.size >= 5) imports.delete(imports.keys().next().value!);
    imports.set(feed.date, pages);
  }
  pages.set(feed.page, feed.rows);
  if (feed.page < feed.pages) return false;
  for (let page = 1; page <= feed.pages; page++)
    if (!pages.has(page)) return false;
  const rows = new Map<string, Opportunity>();
  for (let page = 1; page <= feed.pages; page++)
    for (const row of pages.get(page)!) rows.set(row.id, row);
  imports.delete(feed.date);
  await saveDay({
    date: feed.date,
    rows: [...rows.values()],
    total: feed.total,
    pages: feed.pages,
    fetchedAt: feed.fetchedAt,
    source: feed.source,
  });
  return true;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") || undefined;
  const pageParam = params.get("page");
  if (date && !/^\d{2}-\d{2}-\d{4}$/.test(date))
    return Response.json({ message: "Invalid date or page." }, { status: 400 });

  if (pageParam) {
    const page = Number(pageParam);
    if (!Number.isInteger(page) || page < 1 || page > 200)
      return Response.json(
        { message: "Invalid date or page." },
        { status: 400 },
      );
    const saved = date ? await savedPastDay(date) : null;
    if (saved)
      return dayResponse(saved, {
        stored: true,
        skipped: true,
        date: saved.date,
        pages: 1,
        dates: await loadDates(),
      });
    const key = `${date || "latest"}:${page}`;
    const entry = cache.get(key);
    if (entry && Date.now() - entry.at < 300000) {
      const stored = await collect(entry.feed);
      return Response.json(
        { ...entry.feed, cached: true, stored },
        { headers: noStore },
      );
    }
    try {
      if (!pending.has(key)) pending.set(key, fetchDailyRfqs(date, page));
      const feed = await pending.get(key)!;
      cache.delete(key);
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(key, { feed, at: Date.now() });
      if (page === 1 && feed.dates.length) await saveDates(feed.dates);
      const stored = await collect(feed);
      return Response.json(
        { ...feed, cached: false, stored },
        { headers: noStore },
      );
    } catch (error) {
      return Response.json(
        {
          message:
            error instanceof Error ? error.message : "Unable to contact DIBBS.",
        },
        { status: 502 },
      );
    } finally {
      pending.delete(key);
    }
  }

  const dates = await loadDates();
  const selected = date || dates[0] || "";
  const day = selected ? await loadDayRaw(selected) : null;
  return dayResponse(day, { dates, date: selected, stored: !!day });
}

// Fallback for imports the server could not assemble itself (for example
// after a restart mid-import).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid listing." }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return Response.json({ message: "Invalid listing." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.date !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(data.date))
    return Response.json({ message: "Invalid date." }, { status: 400 });
  if (!Array.isArray(data.rows) || data.rows.length > 20000)
    return Response.json({ message: "Invalid listing." }, { status: 400 });
  const rows = data.rows.filter(isOpportunity);
  const existing = await savedPastDay(data.date);
  if (existing)
    return Response.json(
      { ok: true, skipped: true, date: existing.date, count: existing.count },
      { headers: noStore },
    );
  await saveDay({
    date: data.date,
    rows,
    total: typeof data.total === "number" ? data.total : rows.length,
    pages: typeof data.pages === "number" ? data.pages : 1,
    fetchedAt:
      typeof data.fetchedAt === "string"
        ? data.fetchedAt
        : new Date().toISOString(),
    source: typeof data.source === "string" ? data.source : "",
  });
  if (Array.isArray(data.dates))
    await saveDates(
      data.dates.filter((date): date is string => typeof date === "string"),
    );
  return Response.json(
    { ok: true, date: data.date, count: rows.length },
    { headers: noStore },
  );
}
