"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Filter,
  Heart,
  MapPin,
  Medal,
  PackageOpen,
  Radio,
  Repeat,
  Search,
  SlidersHorizontal,
  Unlock,
  UserCheck,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  awardMethod,
  isNsn,
  daysLeft,
  filterRows,
  initialFilters,
  isPastIssueDate,
  pdfLink,
  techDocsLink,
  todayEt,
  type Filters,
  type Opportunity,
} from "../../lib/opportunities";
import { CategoryLabel, supplyGroup } from "../fsc";
import { unitName } from "../../lib/units";
import type { Award } from "../../lib/parts";
type Part = {
  nsn: string;
  loading: boolean;
  sources: { name: string; cage: string; partNumber: string }[];
  unit: string | null;
  awards: Award[];
  error: string;
};
type Listing = {
  date: string;
  total: number;
  fetchedAt: string | null;
  stored: boolean;
};
// Icons for the award methods awardMethod() reads from solicitation numbers.
const awardMethodIcons: [string, LucideIcon][] = [
  ["Automated, lowest price wins", Zap],
  ["Automated, long-term contract", Repeat],
  ["Reviewed by a buyer", UserCheck],
];
function setAsideName(value: string) {
  return value.replace(/\s+set-aside$/i, "").trim();
}
// Only a handful of distinct set-aside strings exist, but this runs per row
// for filtering and rendering.
const setAsideCache = new Map<string, { label: string; icon: LucideIcon }[]>();
function setAsideParts(value: string): { label: string; icon: LucideIcon }[] {
  let parts = setAsideCache.get(value);
  if (!parts) {
    parts = readSetAside(value);
    if (setAsideCache.size < 500) setAsideCache.set(value, parts);
  }
  return parts;
}
function readSetAside(value: string): { label: string; icon: LucideIcon }[] {
  const text = value.toLowerCase();
  const parts: { label: string; icon: LucideIcon }[] = [];
  if (text.includes("veteran")) parts.push({ label: "Veteran", icon: Medal });
  if (text.includes("woman"))
    parts.push({ label: "Woman owned", icon: Heart });
  if (text.includes("hubzone")) parts.push({ label: "HUBZone", icon: MapPin });
  if (/8\s*\(?a\)?/.test(text)) parts.push({ label: "8(a)", icon: Building2 });
  if (text.includes("small business"))
    parts.push({ label: "Small business", icon: Users });
  if (text.includes("unrestricted"))
    parts.push({ label: "Unrestricted", icon: Unlock });
  return parts;
}
function SetAsideLabel({ value }: { value: string }) {
  const parts = setAsideParts(value);
  const boxes =
    parts.length > 0
      ? parts
      : [{ label: setAsideName(value) || "Not specified", icon: null }];
  return (
    <span className="set-asides">
      {boxes.map((part) => {
        const Icon = part.icon;
        return (
          <span
            key={part.label}
            className={`badge ${part.label === "Unrestricted" ? "neutral" : "blue"}`}
          >
            {Icon ? <Icon size={12} aria-hidden="true" /> : null}
            {part.label}
          </span>
        );
      })}
    </span>
  );
}
const countActive = (f: Filters) =>
  Object.entries(f).filter(([key, value]) => key !== "open" && !!value).length;
const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  });
const formatDate = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not provided";
const formatFullDate = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
function issueToIso(value: string) {
  const [month, day, year] = value.split("-");
  return `${year}-${month}-${day}`;
}
function isoToIssue(value: string) {
  const [year, month, day] = value.split("-");
  return `${month}-${day}-${year}`;
}
function monthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}
function toIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function DateMenu({
  label,
  value,
  onChange,
  allowed,
  emptyLabel,
  clearLabel,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  allowed?: string[];
  emptyLabel?: string;
  clearLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() =>
    value ? monthStart(value) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  useEffect(() => {
    if (open && value) setCursor(monthStart(value));
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const allowedSet = allowed ? new Set(allowed) : null;
  return (
    <div className="date-field" ref={root}>
      <span>{label}</span>
      <button
        type="button"
        className="date-button"
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value ? formatFullDate(value) : emptyLabel}</span>
        <CalendarDays size={14} />
      </button>
      {open && (
        <div className="calendar" role="dialog" aria-label={`${label} calendar`}>
          <div className="calendar-head">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <strong>
              {cursor.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="calendar-week">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: leading }, (_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const iso = toIso(new Date(year, month, index + 1));
              const blocked = allowedSet ? !allowedSet.has(iso) : false;
              return (
                <button
                  type="button"
                  key={iso}
                  disabled={blocked}
                  className={iso === value ? "selected" : ""}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          {clearLabel && (
            <button
              type="button"
              className="calendar-clear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function OptionIcons({ icons }: { icons?: LucideIcon[] }) {
  if (!icons?.length) return null;
  return (
    <span className="menu-icons">
      {icons.map((Icon, index) => (
        <Icon key={`${index}`} size={12} aria-hidden="true" />
      ))}
    </span>
  );
}
function OptionMenu({
  label,
  value,
  placeholder,
  options,
  onChange,
  search,
  hideLabel,
  required,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string; icons?: LucideIcon[] }[];
  onChange: (value: string) => void;
  search?: boolean;
  hideLabel?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    root = useRef<HTMLDivElement>(null),
    searchBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const frame = requestAnimationFrame(() => searchBox.current?.focus());
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const shown = options.filter(
    (option) =>
      !needle ||
      option.label.toLowerCase().includes(needle) ||
      option.value.toLowerCase().includes(needle),
  );
  return (
    <div className="date-field" ref={root}>
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      <button
        type="button"
        className="date-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="menu-value">
          {selected ? <OptionIcons icons={selected.icons} /> : null}
          <span>{selected?.label || placeholder}</span>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="option-menu" role="listbox" aria-label={label}>
          {search && (
            <input
              ref={searchBox}
              className="menu-search"
              placeholder="Search"
              value={query}
              aria-label={`Search ${label}`}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
          {!required && (
          <button
            type="button"
            className={value ? "" : "selected"}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </button>
          )}
          <div className="option-list">
            {shown.map((option) => (
              <button
                type="button"
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <OptionIcons icons={option.icons} />
                <span>{option.label}</span>
              </button>
            ))}
            {!shown.length && <p className="menu-empty">No matches</p>}
          </div>
        </div>
      )}
    </div>
  );
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
  const [part, setPart] = useState<Part | null>(null);
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
    [selected, setSelected] = useState<Opportunity | null>(null),
    // Filters being edited in the phone sheet; Done applies them.
    [draft, setDraft] = useState<Filters | null>(null);
  const shown = draft ?? filters;
  const sheetOpen = draft !== null;
  const sheet = useRef<HTMLElement>(null);
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
    edit((f) => ({ ...f, [key]: value }));
  }
  function edit(change: (f: Filters) => Filters) {
    if (draft) {
      setDraft((d) => (d ? change(d) : d));
      return;
    }
    setFilters(change);
    setPage(1);
  }
  // Slide the sheet down, then take it out of the top layer.
  function closeSheet() {
    const el = sheet.current;
    if (!el?.matches(":popover-open") || el.classList.contains("closing"))
      return;
    const finish = () => {
      el.hidePopover();
      el.classList.remove("closing");
    };
    el.style.transition = "";
    el.style.transform = "";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    el.classList.add("closing");
    setTimeout(finish, 300);
  }
  // While the sheet is open: tap outside or Escape closes it, and it can be
  // dragged down from anywhere when its content is scrolled to the top.
  useEffect(() => {
    const el = sheet.current;
    if (!sheetOpen || !el) return;
    let startY = 0,
      lastY = 0,
      lastT = 0,
      speed = 0,
      tracking = false,
      dragging = false;
    const outside = (e: MouseEvent) => {
      if (el.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      closeSheet();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    const start = (e: TouchEvent) => {
      tracking =
        el.scrollTop <= 0 &&
        !(e.target as Element).closest(".option-menu");
      dragging = false;
      speed = 0;
      startY = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const y = e.touches[0].clientY;
      if (!dragging) {
        if (y - startY < -6) tracking = false;
        if (y - startY < 6) return;
        dragging = true;
      }
      e.preventDefault();
      speed = (y - lastY) / Math.max(1, e.timeStamp - lastT);
      lastY = y;
      lastT = e.timeStamp;
      el.style.transition = "none";
      el.style.transform = `translateY(${Math.max(0, y - startY)}px)`;
    };
    const end = () => {
      if (!dragging) return;
      dragging = tracking = false;
      if (lastY - startY > el.offsetHeight * 0.3 || speed > 0.4) closeSheet();
      else {
        el.style.transition = "";
        el.style.transform = "";
      }
    };
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", key);
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      document.removeEventListener("click", outside, true);
      document.removeEventListener("keydown", key);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [sheetOpen]);
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
          (!f.category || supplyGroup(r.fsc).label === f.category) &&
          (!f.setAside ||
            setAsideParts(r.setAside).some((part) => part.label === f.setAside)) &&
          (view !== "saved" || savedSet.has(r.id)),
      )
      .sort((a, b) => compareRows(a, b, sort, today));
  }, [rows, deferredFilters, view, savedSet, sort]);
  const savedCount = useMemo(
    () => rows.filter((r) => savedSet.has(r.id)).length,
    [rows, savedSet],
  );
  const categoryOptions = useMemo(() => {
    const groups = new Map<string, LucideIcon>();
    for (const r of rows) {
      const { label, icon } = supplyGroup(r.fsc);
      groups.set(label, icon);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  const fscOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .filter(
              (r) =>
                !shown.category ||
                supplyGroup(r.fsc).label === shown.category,
            )
            .map((r) => r.fsc),
        ),
      ].sort(),
    [rows, shown.category],
  );
  const setAsideOptions = useMemo(
    () => setAsideParts([...new Set(rows.map((r) => r.setAside))].join(" ")),
    [rows],
  );
  const awardMethodOptions = useMemo(() => {
    const present = new Set(rows.map((r) => awardMethod(r.solicitation)));
    return awardMethodIcons.filter(([label]) => present.has(label));
  }, [rows]);
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
  const active = countActive(filters);
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
  async function loadPart(r: Opportunity) {
    const pdf = r.pdf || pdfLink(r.solicitation);
    setPart({ nsn: r.nsn, loading: !!pdf, sources: [], unit: null, awards: [], error: pdf ? "" : "No solicitation PDF." });
    if (!pdf) return;
    try {
      const res = await fetch(
        `/api/part?nsn=${encodeURIComponent(r.nsn)}&pdf=${encodeURIComponent(pdf)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not read the solicitation.");
      setPart((current) =>
        current?.nsn === r.nsn
          ? { nsn: r.nsn, loading: false, sources: data.sources || [], unit: data.unit || null, awards: data.awards || [], error: "" }
          : current,
      );
    } catch (e) {
      setPart((current) =>
        current?.nsn === r.nsn
          ? { ...current, loading: false, error: e instanceof Error ? e.message : "Could not read the solicitation." }
          : current,
      );
    }
  }
  function show(r: Opportunity) {
    setSelected(r);
    dialog.current?.showModal();
    void loadPart(r);
  }
  const sortValue = `${sort.key}:${sort.dir}`;
  const pdf = selected ? selected.pdf || pdfLink(selected.solicitation) : null;
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Bid Prospect">
            <img src="/logo.svg" alt="" />
          </a>
          <nav aria-label="Main navigation">
            <button
              className={view === "all" ? "active" : ""}
              onClick={() => {
                setView("all");
                setPage(1);
              }}
            >
              Opportunities
            </button>
            <button
              className={view === "saved" ? "active" : ""}
              onClick={() => {
                setView("saved");
                setPage(1);
              }}
            >
              Watchlist <span className="count">{saved.length}</span>
            </button>
          </nav>
          <a
            className="source-link"
            href="https://www.dibbs.bsm.dla.mil/RFQ/"
            target="_blank"
            rel="noreferrer"
          >
            Open DIBBS <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </header>
      <main>
        <section className="heading">
          <div>
            <h1>
              {view === "saved" ? "Your watchlist" : "Find your next opportunity."}
            </h1>
            <p>
              {view === "saved"
                ? "Your saved RFQs from the selected daily listing."
                : "A clearer view of DIBBS. Find the parts you supply and the RFQs worth quoting."}
              {syncing && (
                <span className="status">
                  <span className="spinner" aria-hidden="true" /> Updating
                </span>
              )}
            </p>
          </div>
          <div className="date-pick">
            <DateMenu
              label="Issue date"
              value={listing?.date ? issueToIso(listing.date) : ""}
              allowed={dateOptions.map(issueToIso)}
              emptyLabel="Loading dates…"
              disabled={!dateOptions.length}
              onChange={(iso) => void choose(isoToIssue(iso))}
            />
          </div>
        </section>
        {view !== "saved" && (
          <section className="stats" aria-label="Listing overview">
            <div>
              <span>
                Opportunities <PackageOpen size={16} aria-hidden="true" />
              </span>
              <strong>{filtered.length.toLocaleString()}</strong>
              <small>
                {narrowed && rows.length
                  ? `Of ${rows.length.toLocaleString()} in this listing`
                  : "In this listing"}
              </small>
            </div>
            <div>
              <span>
                Due in 7 days <Clock3 size={16} aria-hidden="true" />
              </span>
              <strong className={dueSoon ? "warn" : ""}>
                {dueSoon.toLocaleString()}
              </strong>
              <small>{narrowed ? "Matching these filters" : "Time sensitive"}</small>
            </div>
            <div>
              <span>
                Saved <Bookmark size={16} aria-hidden="true" />
              </span>
              <strong>{savedCount}</strong>
              <small>Watchlist for this issue date</small>
            </div>
          </section>
        )}
        <div className="layout">
          <aside
            id="filters"
            ref={sheet}
            className="filters card"
            popover="manual"
            onToggle={(e) =>
              setDraft(
                e.newState === "open" && matchMedia("(max-width: 999px)").matches
                  ? filters
                  : null,
              )
            }
          >
            <span className="sheet-handle" aria-hidden="true" />
            <div className="filter-title">
              <h2>
                <Filter size={14} aria-hidden="true" /> Filters
              </h2>
              <button
                className="text-button"
                disabled={!countActive(shown) && !shown.open}
                onClick={() => edit(() => initialFilters)}
              >
                Reset
              </button>
              <button
                className="text-button done"
                onClick={() => {
                  if (draft) {
                    setFilters(draft);
                    setPage(1);
                  }
                  closeSheet();
                }}
              >
                Done
              </button>
            </div>
            <DateMenu
              label="Quote deadline"
              value={shown.due}
              emptyLabel="Any deadline"
              clearLabel="Any deadline"
              onChange={(iso) => update("due", iso)}
            />
            <OptionMenu
              label="Category"
              value={shown.category}
              placeholder="All categories"
              search
              options={categoryOptions.map(([label, icon]) => ({
                value: label,
                label,
                icons: [icon],
              }))}
              onChange={(category) =>
                edit((f) => ({
                  ...f,
                  category,
                  fsc:
                    category && f.fsc && supplyGroup(f.fsc).label !== category
                      ? ""
                      : f.fsc,
                }))
              }
            />
            <OptionMenu
              label="Federal supply class"
              value={shown.fsc}
              placeholder="All classes"
              search
              options={fscOptions.map((f) => ({ value: f, label: `FSC ${f}` }))}
              onChange={(fsc) => update("fsc", fsc)}
            />
            <OptionMenu
              label="Set-aside"
              value={shown.setAside}
              placeholder="All set-asides"
              options={setAsideOptions.map((part) => ({
                value: part.label,
                label: part.label,
                icons: [part.icon],
              }))}
              onChange={(setAside) => update("setAside", setAside)}
            />
            <OptionMenu
              label="Award method"
              value={shown.awardMethod}
              placeholder="All award methods"
              options={awardMethodOptions.map(([label, icon]) => ({
                value: label,
                label,
                icons: [icon],
              }))}
              onChange={(method) => update("awardMethod", method)}
            />
            <label className="field">
              <span>Minimum quantity</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Any quantity"
                value={shown.quantity}
                onChange={(e) => update("quantity", e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={shown.open}
                onChange={(e) => update("open", e.target.checked)}
              />
              Open RFQs only
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={shown.docs}
                onChange={(e) => update("docs", e.target.checked)}
              />
              Technical documents available
            </label>
          </aside>
          <section className="results card" aria-label="Results">
            <div className="toolbar">
              <div className="search">
                <Search size={15} aria-hidden="true" />
                <input
                  ref={search}
                  type="search"
                  aria-label="Search"
                  placeholder="Item, NSN, or solicitation"
                  value={filters.search}
                  onChange={(e) => update("search", e.target.value)}
                />
                {filters.search && (
                  <button
                    aria-label="Clear search"
                    onClick={() => update("search", "")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button className="button filters-button" popoverTarget="filters">
                <SlidersHorizontal size={14} aria-hidden="true" />
                Filters{active ? ` (${active})` : ""}
              </button>
              <div className="sort">
                <OptionMenu
                  label="Sort"
                  hideLabel
                  required
                  value={sortValue}
                  placeholder="Sort"
                  options={sorts}
                  onChange={(value) => {
                    const [key, dir] = value.split(":");
                    setSort({ key, dir } as Sort);
                    setPage(1);
                  }}
                />
              </div>
              <button
                className="button export"
                onClick={exportCsv}
                disabled={!filtered.length}
              >
                <Download size={14} aria-hidden="true" />
                <span className="export-label">Export</span>
              </button>
            </div>
            {error && (
              <div className="notice" role="alert">
                <div>
                  <strong>Could not load this date</strong>
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
                  Try again
                </button>
              </div>
            )}
            {visible.length > 0 && (
              <div className="table-scroll">
                <table className="list">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>CATEGORY</th>
                      <th className="num">QTY</th>
                      <th>SET-ASIDE</th>
                      <th>TECH DOCS</th>
                      <th>RETURN BY</th>
                      <th>
                        <span className="sr-only">Save</span>
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
                            <div className="item-wrap">
                              <div>
                                <button className="open" onClick={() => show(r)}>
                                  {r.title}
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="category">
                            <CategoryLabel fsc={r.fsc} />
                          </td>
                          <td className="num">
                            {r.quantity?.toLocaleString() ?? "–"}
                          </td>
                          <td className="aside">
                            <SetAsideLabel value={r.setAside} />
                          </td>
                          <td className="docs">
                            {r.docs && techDocsLink(r.solicitation) ? (
                              <a
                                className="badge docs docs-link"
                                href={techDocsLink(r.solicitation)!}
                                target="_blank"
                                rel="noreferrer"
                                title="Open tech docs"
                                aria-label={`Open tech docs for ${r.title}`}
                              >
                                <FileText size={14} aria-hidden="true" />
                              </a>
                            ) : (
                              "–"
                            )}
                          </td>
                          <td className="due">
                            <strong>{formatDate(r.due)}</strong>
                            {days !== null && days < 0 ? (
                              <span className="badge red">
                                <Clock3 size={11} aria-hidden="true" /> Past due
                              </span>
                            ) : (
                              <span className={days !== null && days <= 3 ? "soon" : ""}>
                                {dueText(days)}
                              </span>
                            )}
                          </td>
                          <td className="actions">
                            <button
                              className={`save${isSaved ? " saved" : ""}`}
                              aria-label={`${isSaved ? "Remove" : "Save"} ${r.title}`}
                              aria-pressed={isSaved}
                              onClick={() => toggleSaved(r.id)}
                            >
                              <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!visible.length && (
              <div className="empty">
                {!ready || (syncing && !rows.length) ? (
                  <>
                    <span className="spinner large" aria-hidden="true" />
                    <h3>Loading this issue date</h3>
                    <p>RFQs appear here as DIBBS returns them.</p>
                  </>
                ) : (
                  <>
                    <h3>
                      {error && !rows.length
                        ? "This date could not be loaded"
                        : view === "saved" && !saved.length
                          ? "No saved RFQs yet"
                          : "No matching opportunities"}
                    </h3>
                    <p>
                      {view === "saved" && !saved.length
                        ? "Use the bookmark on an RFQ to save it here."
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
                        Clear filters
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="pager">
              <span>
                {filtered.length
                  ? `${(currentPage - 1) * 25 + 1}–${Math.min(currentPage * 25, filtered.length)} of ${filtered.length.toLocaleString()}`
                  : "0 opportunities"}
              </span>
              <div>
                <button
                  className="page-button"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  className="page-button"
                  aria-label="Next page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>
        <footer>
          <Radio size={12} aria-hidden="true" /> Public data from DLA DIBBS
          {listing?.fetchedAt &&
            ` · Saved ${new Date(listing.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="sheet"
        aria-label="RFQ details"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="sheet-body">
        {selected && (
          <>
            <button
              className="dialog-close"
              aria-label="Close details"
              onClick={() => dialog.current?.close()}
            >
              <X size={18} />
            </button>
            <div className="eyebrow">SOLICITATION DETAILS</div>
            <h2>{selected.title}</h2>
            <p className="mono muted">
              {isNsn(selected.nsn) ? (
                <a href={`/nsn/${selected.nsn}`}>{selected.nsn}</a>
              ) : (
                selected.nsn
              )}
            </p>
            <dl>
              {(
                [
                  ["Solicitation", selected.solicitation],
                  ["Purchase request", selected.purchaseRequest],
                  ["Award method", awardMethod(selected.solicitation) ?? "Not shown"],
                  ["Supply class", `FSC ${selected.fsc} · ${supplyGroup(selected.fsc).label}`],
                  [
                    "Quantity",
                    selected.quantity === null
                      ? "Not provided"
                      : `${selected.quantity.toLocaleString()}${
                          part?.nsn === selected.nsn && part.unit
                            ? ` ${unitName(part.unit)}`
                            : ""
                        }`,
                  ],
                  ["Set-aside", selected.setAside],
                  ["Issued", formatDate(selected.issued)],
                  ["Return by", `${formatDate(selected.due)} · ${dueText(daysLeft(selected.due))}`],
                  ["Status", selected.status],
                  [
                    "Technical documents",
                    selected.docs && techDocsLink(selected.solicitation) ? (
                      <a href={techDocsLink(selected.solicitation)!} target="_blank" rel="noreferrer">
                        Open tech docs
                      </a>
                    ) : selected.docs ? (
                      "Available"
                    ) : selected.docs === false ? (
                      "None listed"
                    ) : (
                      "Unknown"
                    ),
                  ],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <section className="sources" aria-label="Past awards">
              <h3>Past awards</h3>
              {part?.nsn === selected.nsn && part.loading ? (
                <span className="skeleton" />
              ) : part?.nsn === selected.nsn && part.error ? (
                <p className="note">Could not read the award history.</p>
              ) : part?.nsn === selected.nsn && part.awards.length ? (
                <>
                  <ul>
                    {part.awards.slice(0, 5).map((award) => {
                      const winner = part.sources.find((src) => src.cage === award.cage);
                      return (
                        <li key={`${award.contract}:${award.date}`}>
                          <strong>
                            {money(award.unitCost)} each · {award.quantity.toLocaleString()}
                            {part.unit ? ` ${unitName(part.unit)}` : ""}
                          </strong>
                          <span>
                            {formatFullDate(award.date)} ·{" "}
                            {winner ? `${winner.name} (CAGE ${award.cage})` : `CAGE ${award.cage}`}
                            {award.surplus ? " · Surplus" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {part.awards.length > 5 && (
                    <p className="note">
                      {part.awards.length - 5} earlier award
                      {part.awards.length - 5 === 1 ? "" : "s"} in the solicitation.
                    </p>
                  )}
                </>
              ) : (
                <p className="note">This solicitation lists no award history.</p>
              )}
            </section>
            <section className="sources" aria-label="Approved sources">
              <h3>Approved sources</h3>
              {part?.nsn === selected.nsn && part.loading ? (
                <>
                  <span className="skeleton" />
                  <span className="skeleton short" />
                </>
              ) : part?.nsn === selected.nsn && part.error ? (
                <p className="note">Could not read the solicitation PDF. {part.error}</p>
              ) : part?.nsn === selected.nsn && part.sources.length ? (
                <ul>
                  {part.sources.map((src) => (
                    <li key={`${src.cage}:${src.partNumber}`}>
                      <strong>{src.name}</strong>
                      <span>
                        CAGE {src.cage} · P/N <span className="mono">{src.partNumber}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="note">
                  No approved part number listed. This item is likely bought to a
                  specification; check the solicitation.
                </p>
              )}
            </section>
            <p className="note">
              Confirm the unit of issue, delivery schedule, specifications, and
              eligibility in the original solicitation.
            </p>
            <div className="sheet-actions">
              <button
                className="button"
                onClick={() => toggleSaved(selected.id)}
              >
                <Bookmark
                  size={14}
                  fill={savedSet.has(selected.id) ? "currentColor" : "none"}
                />
                {savedSet.has(selected.id) ? "Saved" : "Save"}
              </button>
              {pdf && (
                <a className="button" href={pdf} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              )}
              <a
                className="button primary"
                href={selected.url}
                target="_blank"
                rel="noreferrer"
              >
                View on DIBBS <ArrowUpRight size={14} />
              </a>
            </div>
          </>
        )}
        </div>
      </dialog>
    </>
  );
}
