import {
  Building2,
  Clock3,
  FileText,
  Heart,
  MapPin,
  Medal,
  Unlock,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CategoryLabel } from "./fsc";
import {
  daysLeft,
  isNsn,
  techDocsLink,
  todayEt,
  type Opportunity,
} from "../lib/opportunities";

export const PREVIEW_COUNT = 10;

export function sortLikeDashboard(rows: Opportunity[], today = todayEt()) {
  return [...rows].sort((a, b) => {
    const past = (row: Opportunity) => (row.due && row.due < today ? 1 : 0);
    return (
      past(a) - past(b) || (a.due || "9999").localeCompare(b.due || "9999")
    );
  });
}

export const formatDate = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "No date";

export function dueText(days: number | null) {
  if (days === null) return "Date not listed";
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Due today";
  return days === 1 ? "1 day left" : `${days} days left`;
}

export function setAsideParts(
  value: string,
): { label: string; icon: LucideIcon | null; open: boolean }[] {
  const text = value.toLowerCase();
  const parts: { label: string; icon: LucideIcon | null; open: boolean }[] = [];
  if (text.includes("veteran"))
    parts.push({ label: "Veterans", icon: Medal, open: false });
  if (text.includes("woman"))
    parts.push({ label: "Women-owned", icon: Heart, open: false });
  if (text.includes("hubzone"))
    parts.push({ label: "HUBZone areas", icon: MapPin, open: false });
  if (/8\s*\(?a\)?/.test(text))
    parts.push({ label: "8(a) businesses", icon: Building2, open: false });
  if (text.includes("small business"))
    parts.push({ label: "Small businesses", icon: Users, open: false });
  if (text.includes("unrestricted"))
    parts.push({ label: "Open to anyone", icon: Unlock, open: true });
  if (!parts.length)
    parts.push({
      label: value.replace(/\s+set-aside$/i, "").trim() || "Not listed",
      icon: null,
      open: false,
    });
  return parts;
}

export function RfqList({
  rows,
  total,
}: {
  rows: Opportunity[];
  total: number;
}) {
  if (!rows.length) {
    return (
      <section className="results card" aria-label="Today's requests">
        <div className="empty">
          <h3>Today's list is not here yet</h3>
          <p>Open the full list once, and these rows will show up here too.</p>
          <a className="button" href="/dashboard">
            See today's full list
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="results card" aria-label="Results">
      <div className="table-scroll">
        <table className="list">
          <thead>
            <tr>
              <th>Part</th>
              <th>Type</th>
              <th className="num">How many</th>
              <th>Who can bid</th>
              <th>Drawings</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const days = daysLeft(row.due);
              const docs = row.docs && techDocsLink(row.solicitation);
              return (
                <tr key={row.id} className={days !== null && days < 0 ? "past" : ""}>
                  <td className="item">
                    <div className="item-wrap">
                      {isNsn(row.nsn) ? (
                        <a className="open" href={`/nsn/${row.nsn}`}>
                          {row.title}
                        </a>
                      ) : (
                        <a className="open" href={row.url} target="_blank" rel="noreferrer">
                          {row.title}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="category">
                    <CategoryLabel fsc={row.fsc} />
                  </td>
                  <td className="num">{row.quantity?.toLocaleString() ?? "–"}</td>
                  <td className="aside">
                    <span className="set-asides">
                      {setAsideParts(row.setAside).map((part) => {
                        const Icon = part.icon;
                        return (
                          <span
                            key={part.label}
                            className={`badge ${part.open ? "neutral" : "blue"}`}
                          >
                            {Icon ? <Icon size={12} aria-hidden="true" /> : null}
                            {part.label}
                          </span>
                        );
                      })}
                    </span>
                  </td>
                  <td className="docs">
                    {docs ? (
                      <a
                        className="badge docs docs-link"
                        href={docs}
                        target="_blank"
                        rel="noreferrer"
                        title="Open the drawings"
                        aria-label={`Open the drawings for ${row.title}`}
                      >
                        <FileText size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="due">
                    <strong>{formatDate(row.due)}</strong>
                    {days !== null && days < 0 ? (
                      <span className="badge red">
                        <Clock3 size={11} aria-hidden="true" /> Deadline passed
                      </span>
                    ) : (
                      <span className={days !== null && days <= 3 ? "soon" : ""}>
                        {dueText(days)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>
          Showing {rows.length} of {total.toLocaleString()}
        </span>
        <div>
          <span>See all</span>
          <a className="page-button" href="/dashboard" aria-label="Open the full list">
            <Chevron />
          </a>
        </div>
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
