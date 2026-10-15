export type Opportunity = {
  purchaseRequest: string;
  status: string;
  id: string;
  solicitation: string;
  nsn: string;
  fsc: string;
  title: string;
  quantity: number | null;
  unit: string;
  setAside: string;
  issued: string | null;
  due: string | null;
  docs: boolean | null;
  url: string;
  pdf?: string | null;
};
export function pdfLink(solicitation: string): string | null {
  const id = solicitation.replace(/[^A-Za-z0-9]/g, "");
  if (!/^[A-Z0-9]{13,}$/i.test(id)) return null;
  const name = id.toUpperCase();
  return `https://dibbs2.bsm.dla.mil/Downloads/RFQ/${name.slice(-1)}/${name}.PDF`;
}
// Building an Intl formatter is expensive; daysLeft runs per row and per
// sort comparison, so build it once.
const easternDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
});
export const todayEt = () => easternDate.format(new Date());
export function daysLeft(date: string | null, today = todayEt()) {
  return date
    ? Math.round((Date.parse(date) - Date.parse(today)) / 86400000)
    : null;
}
export function isPastIssueDate(date: string, today = todayEt()) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
  if (!match) return false;
  const left = daysLeft(`${match[3]}-${match[1]}-${match[2]}`, today);
  return left !== null && left < 0;
}
export type Filters = {
  search: string;
  category: string;
  fsc: string;
  setAside: string;
  due: string;
  docs: boolean;
  quantity: string;
  open: boolean;
};
export const initialFilters: Filters = {
  search: "",
  category: "",
  fsc: "",
  setAside: "",
  due: "",
  docs: false,
  quantity: "",
  open: false,
};
const haystacks = new WeakMap<Opportunity, string>();
function haystack(r: Opportunity) {
  let text = haystacks.get(r);
  if (text === undefined) {
    text =
      `${r.title} ${r.nsn} ${r.solicitation} ${r.nsn.replaceAll("-", "")}`.toLowerCase();
    haystacks.set(r, text);
  }
  return text;
}
export function filterRows(rows: Opportunity[], f: Filters, today = todayEt()) {
  const q = f.search.toLowerCase().trim();
  const min = f.quantity ? Number(f.quantity) : null;
  return rows.filter(
    (r) =>
      (!q || haystack(r).includes(q)) &&
      (!f.fsc || r.fsc === f.fsc) &&
      (!f.setAside || r.setAside === f.setAside) &&
      (!f.due || r.due === f.due) &&
      (!f.docs || r.docs === true) &&
      (min === null || (r.quantity !== null && r.quantity >= min)) &&
      (!f.open || (r.status === "Open" && (r.due === null || r.due >= today))),
  );
}
