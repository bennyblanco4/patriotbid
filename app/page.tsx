"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  daysLeft,
  filterRows,
  initialFilters,
  isPastIssueDate,
  pdfLink,
  todayEt,
  type Filters,
  type Opportunity,
} from "../lib/opportunities";
type Listing = {
  date: string;
  total: number;
  fetchedAt: string | null;
  stored: boolean;
};
// Only a handful of distinct set-aside strings exist, but this runs per row
// for filtering and rendering.
const setAsideCache = new Map<string, string[]>();
function setAsideParts(value: string): string[] {
  let parts = setAsideCache.get(value);
  if (!parts) {
    const text = value.toLowerCase();
    parts = [];
    if (text.includes("veteran")) parts.push("Veteran");
    if (text.includes("woman")) parts.push("Woman owned");
    if (text.includes("hubzone")) parts.push("HUBZone");
    if (/8\s*\(?a\)?/.test(text)) parts.push("8(a)");
    if (text.includes("small business")) parts.push("Small business");
    if (text.includes("unrestricted")) parts.push("Unrestricted");
    if (setAsideCache.size < 500) setAsideCache.set(value, parts);
  }
  return parts;
}
function SetAside({ value }: { value: string }) {
  const parts = setAsideParts(value);
  if (!parts.length)
    return (
      <span className="tag">
        {value.replace(/\s+set-aside$/i, "").trim() || "Not specified"}
      </span>
    );
  return (
    <span className="tags">
      {parts.map((part) => (
        <span
          key={part}
          className={part === "Unrestricted" ? "tag" : "tag tint"}
        >
          {part}
        </span>
      ))}
    </span>
  );
}
const formatDate = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not provided";
function formatIssue(value: string) {
  const [month, day, year] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function dueText(days: number | null) {
  if (days === null) return "Check source";
  if (days < 0) return "Past due";
  if (days === 0) return "Due today";
  return days === 1 ? "1 day left" : `${days} days left`;
}
type Sort = { key: "title" | "quantity" | "docs" | "due"; dir: "asc" | "desc" };
const sorts: { value: string; label: string }[] = [
  { value: "due:asc", label: "Due soonest" },
  { value: "due:desc", label: "Due latest" },
  { value: "quantity:desc", label: "Highest qty" },
  { value: "quantity:asc", label: "Lowest qty" },
  { value: "title:asc", label: "Name A to Z" },
  { value: "docs:desc", label: "Tech docs first" },
];
function compareRows(a: Opportunity, b: Opportunity, sort: Sort, today: string) {
  const dir = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "title") return a.title.localeCompare(b.title) * dir;
  if (sort.key === "quantity") {
    if (a.quantity == null && b.quantity == null) return 0;
    if (a.quantity == null) return 1;
    if (b.quantity == null) return -1;
    return (a.quantity - b.quantity) * dir;
  }
  if (sort.key === "docs")
    return (Number(a.docs === true) - Number(b.docs === true)) * dir;
  return (
    (Number(!!a.due && a.due < today) - Number(!!b.due && b.due < today) ||
      (a.due || "9999").localeCompare(b.due || "9999")) * dir
  );
}
export default function Home() {
  const [rows, setRows] = useState<Opportunity[]>([]),
    [listing, setListing] = useState<Listing | null>(null),
    [dates, setDates] = useState<string[]>([]),
    [syncing, setSyncing] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Filters>(initialFilters),
    [view, setView] = useState("all"),
    [saved, setSaved] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [sort, setSort] = useState<Sort>({ key: "due", dir: "asc" }),
    [selected, setSelected] = useState<Opportunity | null>(null);
  const run = useRef(0);
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("patriotbid-saved") || "[]"));
    } catch {}
    void open();
    return () => {
      run.current++;
    };
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  function applyListing(data: {
    date?: string;
    rows?: Opportunity[];
    total?: number;
    fetchedAt?: string | null;
    stored?: boolean;
    dates?: string[];
  }) {
    if (data.dates?.length) setDates(data.dates);
    setListing({
      date: data.date || "",
      total: data.total || 0,
      fetchedAt: data.fetchedAt || null,
      stored: !!data.stored,
    });
    setRows(data.rows || []);
    setPage(1);
  }
  async function open(date?: string) {
    const id = ++run.current;
    setError("");
    const response = await fetch(
      `/api/opportunities${date ? `?date=${encodeURIComponent(date)}` : ""}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (id !== run.current) return;
    if (!response.ok) {
      setError(data.message || "Could not open the saved listing.");
      setReady(true);
      return;
    }
    if (data.date) applyListing(data);
    setReady(true);
    try {
      // Refresh the issue dates before scraping anything: the saved list can
      // be days old, and its newest entry is then not the latest listing.
      const listed = await fetch("/api/dates", { cache: "no-store" });
      const body = await listed.json();
      if (id !== run.current) return;
      if (!listed.ok && !body.dates?.length)
        throw new Error(body.message || "Could not load issue dates.");
      if (body.dates?.length) setDates(body.dates);
      if (data.date && body.dates?.[0] && body.dates[0] !== data.date) {
        void choose(body.dates[0]);
        return;
      }
      if (data.date && !data.stored) void pull(data.date, id, false);
      if (!data.date && body.dates?.[0]) {
        const next = await fetch(
          `/api/opportunities?date=${encodeURIComponent(body.dates[0])}`,
          { cache: "no-store" },
        );
        const day = await next.json();
        if (id !== run.current) return;
        if (!next.ok)
          throw new Error(day.message || "Could not open the saved listing.");
        applyListing({ ...day, date: body.dates[0] });
        if (!day.stored) void pull(body.dates[0], id, false);
      }
    } catch (e) {
      if (id !== run.current) return;
      if (data.date && !data.stored) void pull(data.date, id, false);
      if (!data.date)
        setError(
          e instanceof Error ? e.message : "Could not load issue dates.",
        );
    }
  }
  async function choose(date: string) {
    if (date === listing?.date) return;
    const id = ++run.current;
    setError("");
    setSyncing(false);
    const response = await fetch(
      `/api/opportunities?date=${encodeURIComponent(date)}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (id !== run.current) return;
    if (!response.ok) {
      setError(data.message || "Could not open this date.");
      return;
    }
    applyListing({ ...data, date });
    if (!data.stored) void pull(date, id, false);
  }
  async function pull(date: string, id: number, keepCurrent: boolean) {
    if (isPastIssueDate(date) && listing?.stored && listing.date === date) return;
    setSyncing(true);
    setError("");
    const all = new Map<string, Opportunity>();
    let storedByServer = false;
    let total = 0;
    let pages = 1;
    let fetchedAt = new Date().toISOString();
    let source = "";
    let issueDates: string[] = [];
    try {
      for (let sourcePage = 1; sourcePage <= 200; sourcePage++) {
        const response = await fetch(
          `/api/opportunities?page=${sourcePage}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (id !== run.current) return;
        if (!response.ok)
          throw new Error(data.message || "Could not load DIBBS.");
        if (data.skipped) {
          setRows(data.rows || []);
          setListing({
            date,
            total: data.total || 0,
            fetchedAt: data.fetchedAt || null,
            stored: true,
          });
          return;
        }
        issueDates = data.dates?.length ? data.dates : issueDates;
        if (issueDates.length) setDates(issueDates);
        total = data.total;
        pages = data.pages;
        fetchedAt = data.fetchedAt;
        source = data.source;
        for (const r of data.rows as Opportunity[]) all.set(r.id, r);
        storedByServer = !!data.stored;
        if (!keepCurrent) {
          setRows([...all.values()]);
          if (sourcePage === 1) setPage(1);
        }
        if (sourcePage >= data.pages) break;
      }
      // The server saves the day as it serves the last page; upload the rows
      // only when it could not assemble them (e.g. it restarted mid-import).
      if (!storedByServer) {
        const save = await fetch("/api/opportunities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            rows: [...all.values()],
            total,
            pages,
            fetchedAt,
            source,
            dates: issueDates,
          }),
        });
        const saved = await save.json();
        if (id !== run.current) return;
        if (!save.ok)
          throw new Error(saved.message || "Could not save this date.");
      }
      setRows([...all.values()]);
      setListing({ date, total, fetchedAt, stored: true });
      if (keepCurrent) setPage(1);
    } catch (e) {
      if (id === run.current)
        setError(e instanceof Error ? e.message : "Could not load DIBBS.");
    } finally {
      if (id === run.current) setSyncing(false);
    }
  }
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  function toggleSaved(id: string) {
    const next = saved.includes(id)
      ? saved.filter((s) => s !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("patriotbid-saved", JSON.stringify(next));
    } catch {}
  }
  const savedSet = useMemo(() => new Set(saved), [saved]);
  // Typing stays responsive while a large listing re-filters in the background.
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => {
    const today = todayEt();
    const f = deferredFilters;
    return filterRows(rows, { ...f, setAside: "" }, today)
      .filter(
        (r) =>
          (!f.setAside || setAsideParts(r.setAside).includes(f.setAside)) &&
          (view !== "saved" || savedSet.has(r.id)),
      )
      .sort((a, b) => compareRows(a, b, sort, today));
  }, [rows, deferredFilters, view, savedSet, sort]);
  const savedCount = useMemo(
    () => rows.filter((r) => savedSet.has(r.id)).length,
    [rows, savedSet],
  );
  const fscOptions = useMemo(
    () => [...new Set(rows.map((r) => r.fsc))].sort(),
    [rows],
  );
  const setAsideOptions = useMemo(
    () => setAsideParts([...new Set(rows.map((r) => r.setAside))].join(" ")),
    [rows],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const dueSoon = useMemo(() => {
    const today = todayEt();
    return filtered.filter((r) => {
      const d = daysLeft(r.due, today);
      return d !== null && d >= 0 && d <= 7;
    }).length;
  }, [filtered]);
  const narrowed = filtered.length !== rows.length;
  const active = Object.entries(filters).filter(
    ([key, value]) => key !== "open" && !!value,
  ).length;
  const dateOptions =
    listing?.date && !dates.includes(listing.date)
      ? [listing.date, ...dates]
      : dates;
  function exportCsv() {
    const keys = [
      "title",
      "nsn",
      "fsc",
      "solicitation",
      "purchaseRequest",
      "quantity",
      "setAside",
      "issued",
      "due",
      "status",
      "url",
      "pdf",
    ] as const;
    const csv = [
      keys.join(","),
      ...filtered.map((r) =>
        keys
          .map((k) => {
            const value =
              k === "pdf" ? r.pdf || pdfLink(r.solicitation) : r[k];
            return (
              '"' +
              String(value ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"'
            );
          })
          .join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `dibbs-${listing?.date || "rfqs"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function show(r: Opportunity) {
    setSelected(r);
    dialog.current?.showModal();
  }
  const sortValue = `${sort.key}:${sort.dir}`;
  const pdf = selected ? selected.pdf || pdfLink(selected.solicitation) : null;
  return (
    <>
      <header className="bar">
        <div className="bar-inner">
          <a className="brand" href="/">
            PatriotBid
          </a>
          <div className="segmented" role="group" aria-label="View">
            <button
              aria-pressed={view === "all"}
              onClick={() => {
                setView("all");
                setPage(1);
              }}
            >
              All
            </button>
            <button
              aria-pressed={view === "saved"}
              onClick={() => {
                setView("saved");
                setPage(1);
              }}
            >
              Watchlist{saved.length ? ` (${saved.length})` : ""}
            </button>
          </div>
          <a
            className="bar-link"
            href="https://www.dibbs.bsm.dla.mil/RFQ/"
            target="_blank"
            rel="noreferrer"
          >
            DIBBS <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </header>
      <main>
        <div className="title-row">
          <div>
            <h1>{view === "saved" ? "Watchlist" : "Opportunities"}</h1>
            <p className="summary">
              {filtered.length.toLocaleString()}{" "}
              {filtered.length === 1 ? "RFQ" : "RFQs"}
              {narrowed && rows.length
                ? ` of ${rows.length.toLocaleString()}`
                : ""}
              {dueSoon ? ` · ${dueSoon.toLocaleString()} due within 7 days` : ""}
              {view !== "saved" && savedCount
                ? ` · ${savedCount} saved`
                : ""}
              {syncing && (
                <span className="status">
                  <span className="spinner" aria-hidden="true" /> Updating
                </span>
              )}
            </p>
          </div>
          <label className="field date-pick">
            <span>Issue date</span>
            <select
              value={listing?.date || ""}
              disabled={!dateOptions.length}
              onChange={(e) => void choose(e.target.value)}
            >
              {!dateOptions.length && <option value="">Loading…</option>}
              {dateOptions.map((d) => (
                <option key={d} value={d}>
                  {formatIssue(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="toolbar">
          <div className="search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={search}
              type="search"
              aria-label="Search"
              placeholder="Item, NSN, or solicitation"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
            {filters.search && (
              <button aria-label="Clear search" onClick={() => update("search", "")}>
                <X size={14} />
              </button>
            )}
          </div>
          <button className="button filters-button" popoverTarget="filters">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters{active ? ` (${active})` : ""}
          </button>
          <label className="field sort">
            <span className="sr-only">Sort</span>
            <select
              value={sortValue}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort({ key, dir } as Sort);
                setPage(1);
              }}
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button export"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            Export
          </button>
        </div>
        <div className="layout">
          <aside id="filters" className="filters" popover="auto">
            <div className="sheet-head">
              <h2>Filters</h2>
              <button
                className="link"
                popoverTarget="filters"
                popoverTargetAction="hide"
              >
                Done
              </button>
            </div>
            <div className="group">
              <label className="row">
                <span>Due by</span>
                <input
                  type="date"
                  value={filters.due}
                  onChange={(e) => update("due", e.target.value)}
                />
              </label>
              <label className="row">
                <span>Supply class</span>
                <select
                  value={filters.fsc}
                  onChange={(e) => update("fsc", e.target.value)}
                >
                  <option value="">All</option>
                  {fscOptions.map((f) => (
                    <option key={f} value={f}>
                      FSC {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row">
                <span>Set-aside</span>
                <select
                  value={filters.setAside}
                  onChange={(e) => update("setAside", e.target.value)}
                >
                  <option value="">All</option>
                  {setAsideOptions.map((part) => (
                    <option key={part} value={part}>
                      {part}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row">
                <span>Min. quantity</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="Any"
                  value={filters.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                />
              </label>
            </div>
            <div className="group">
              <label className="row">
                <span>Open RFQs only</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={filters.open}
                  onChange={(e) => update("open", e.target.checked)}
                />
              </label>
              <label className="row">
                <span>Has tech documents</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={filters.docs}
                  onChange={(e) => update("docs", e.target.checked)}
                />
              </label>
            </div>
            <button
              className="link reset"
              disabled={!active && !filters.open}
              onClick={() => {
                setFilters(initialFilters);
                setPage(1);
              }}
            >
              Reset filters
            </button>
          </aside>
          <section className="results" aria-label="Results">
            {error && (
              <div className="notice" role="alert">
                <div>
                  <strong>Couldn’t load this date</strong>
                  <span>{error}</span>
                </div>
                <button
                  className="button"
                  disabled={syncing || !listing?.date}
                  onClick={() => {
                    if (!listing?.date) return;
                    void pull(listing.date, ++run.current, rows.length > 0);
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
            {visible.length > 0 && (
              <table className="list">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th>Set-aside</th>
                    <th>Return by</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const days = daysLeft(r.due);
                    const isSaved = savedSet.has(r.id);
                    return (
                      <tr key={r.id} className={days !== null && days < 0 ? "past" : ""}>
                        <td className="item">
                          <button className="open" onClick={() => show(r)}>
                            {r.title}
                          </button>
                          <span className="meta">
                            <span className="mono">{r.nsn}</span>
                            {" · "}
                            <span className="nowrap">{r.solicitation}</span>
                            {r.docs ? " · Tech docs" : ""}
                          </span>
                        </td>
                        <td className="num">
                          {r.quantity?.toLocaleString() ?? "–"}
                          <span className="unit">qty</span>
                        </td>
                        <td className="aside">
                          <SetAside value={r.setAside} />
                        </td>
                        <td className="due">
                          {formatDate(r.due)}
                          <span
                            className={
                              days !== null && days < 0
                                ? "late"
                                : days !== null && days <= 3
                                  ? "soon"
                                  : ""
                            }
                          >
                            {dueText(days)}
                          </span>
                        </td>
                        <td className="actions">
                          <button
                            className="icon"
                            aria-label={`${isSaved ? "Remove" : "Save"} ${r.title}`}
                            aria-pressed={isSaved}
                            onClick={() => toggleSaved(r.id)}
                          >
                            <Bookmark
                              size={18}
                              fill={isSaved ? "currentColor" : "none"}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!visible.length && (
              <div className="empty">
                {!ready || (syncing && !rows.length) ? (
                  <>
                    <span className="spinner large" aria-hidden="true" />
                    <h3>Loading Listing</h3>
                    <p>RFQs appear here as DIBBS returns them.</p>
                  </>
                ) : (
                  <>
                    <h3>
                      {error && !rows.length
                        ? "No Listing"
                        : view === "saved" && !saved.length
                          ? "No Saved RFQs"
                          : "No Results"}
                    </h3>
                    <p>
                      {view === "saved" && !saved.length
                        ? "Tap the bookmark on an RFQ to save it here."
                        : "Try a different search or adjust the filters."}
                    </p>
                    {(active > 0 || view === "saved") && (
                      <button
                        className="button"
                        onClick={() => {
                          setFilters(initialFilters);
                          setView("all");
                          setPage(1);
                        }}
                      >
                        Show All
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {pageCount > 1 && (
              <nav className="pager" aria-label="Pages">
                <button
                  className="icon"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {(currentPage - 1) * 25 + 1}–
                  {Math.min(currentPage * 25, filtered.length)} of{" "}
                  {filtered.length.toLocaleString()}
                </span>
                <button
                  className="icon"
                  aria-label="Next page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
            )}
            <p className="footnote">
              Public data from DLA DIBBS
              {listing?.fetchedAt &&
                ` · Updated ${new Date(listing.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
            </p>
          </section>
        </div>
      </main>
      <dialog
        ref={dialog}
        className="sheet"
        aria-label="RFQ details"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        {selected && (
          <>
            <div className="sheet-head">
              <button
                className="link"
                onClick={() => toggleSaved(selected.id)}
              >
                {savedSet.has(selected.id) ? "Saved" : "Save"}
              </button>
              <button
                className="link strong"
                onClick={() => dialog.current?.close()}
              >
                Done
              </button>
            </div>
            <h2>{selected.title}</h2>
            <p className="meta mono">{selected.nsn}</p>
            <dl className="group">
              {(
                [
                  ["Solicitation", selected.solicitation],
                  ["Purchase request", selected.purchaseRequest],
                  ["Supply class", `FSC ${selected.fsc}`],
                  ["Quantity", selected.quantity?.toLocaleString() ?? "Not provided"],
                  ["Set-aside", selected.setAside],
                  ["Issued", formatDate(selected.issued)],
                  ["Return by", `${formatDate(selected.due)} · ${dueText(daysLeft(selected.due))}`],
                  ["Status", selected.status],
                  [
                    "Tech documents",
                    selected.docs ? "Available" : selected.docs === false ? "None listed" : "Unknown",
                  ],
                ] as const
              ).map(([k, v]) => (
                <div className="row" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="footnote">
              Confirm unit of issue, delivery, specifications, and eligibility
              in the original solicitation.
            </p>
            <div className="sheet-actions">
              <a
                className="button primary"
                href={selected.url}
                target="_blank"
                rel="noreferrer"
              >
                View on DIBBS
              </a>
              {pdf && (
                <a className="button" href={pdf} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
