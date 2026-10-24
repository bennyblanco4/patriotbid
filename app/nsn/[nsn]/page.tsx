import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryLabel, supplyGroup, supplyGroups } from "../../fsc";
import { dueText, formatDate, setAsideParts } from "../../rfq-list";
import { SiteShell } from "../../site-shell";
import styles from "../../content.module.css";
import shell from "../../landing.module.css";
import {
  awardMethod,
  daysLeft,
  isNsn,
  pdfLink,
  techDocsLink,
} from "../../../lib/opportunities";
import type { PartInfo } from "../../../lib/parts";
import { loadNsnRows, loadPart } from "../../../lib/store";
import { unitName } from "../../../lib/units";

// Built on the first visit and refreshed at most hourly, from the database
// only: rows the dashboard already saved and any part details read for them.
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

const load = cache(async (nsn: string) => {
  const rows = await loadNsnRows(nsn);
  if (!rows.length) return null;
  rows.sort((a, b) => (b.issued || "").localeCompare(a.issued || ""));
  const saved = await loadPart(nsn);
  const part = (saved?.data ?? null) as PartInfo | null;
  const sources = part?.sources ?? [];
  const awards = part?.awards ?? [];
  return {
    rows,
    sources,
    awards,
    unit: part?.unit ?? null,
    name: titleCase(rows[0].title),
    fsc: rows[0].fsc,
    // Pages without supplier or award details are too thin to index yet.
    indexable: sources.length > 0 || awards.length > 0,
  };
});

const titleCase = (value: string) =>
  value.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  });

const fullDate = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function country(nsn: string) {
  const code = nsn.slice(5, 7);
  return code === "00" || code === "01" ? "United States" : `Country code ${code}`;
}

type Props = { params: Promise<{ nsn: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nsn } = await params;
  const data = isNsn(nsn) ? await load(nsn) : null;
  if (!data) return { title: "NSN not found", robots: { index: false } };
  const title = `NSN ${nsn}: ${data.name}`;
  const extras = [
    data.awards.length ? "past award prices" : "",
    data.sources.length ? "approved sources" : "",
  ].filter(Boolean);
  const description = `DLA requests for quotes on ${data.name} (NSN ${nsn}): quantities, deadlines and who can bid${
    extras.length ? `, plus ${extras.join(" and ")}` : ""
  }.`;
  return {
    title,
    description,
    alternates: { canonical: `/nsn/${nsn}` },
    robots: { index: data.indexable, follow: true },
    openGraph: { title: `${title} | Bid Prospect`, description, url: `/nsn/${nsn}` },
  };
}

export default async function NsnPage({ params }: Props) {
  const { nsn } = await params;
  if (/^\d{13}$/.test(nsn))
    permanentRedirect(
      `/nsn/${nsn.slice(0, 4)}-${nsn.slice(4, 6)}-${nsn.slice(6, 9)}-${nsn.slice(9)}`,
    );
  const data = isNsn(nsn) ? await load(nsn) : null;
  if (!data) notFound();

  const group = supplyGroup(data.fsc);
  const category = supplyGroups.find((g) => g.code === data.fsc.slice(0, 2));
  const unit = data.unit ? unitName(data.unit) : null;
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Bid Prospect", item: "https://bidprospect.com/" },
      ...(category
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: category.label,
              item: `https://bidprospect.com/category/${category.slug}`,
            },
          ]
        : []),
      { "@type": "ListItem", position: category ? 3 : 2, name: `NSN ${nsn}` },
    ],
  };

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c"),
        }}
      />
      <main className={`${styles.page} ${shell.alt}`}>
        <div className={shell.wrap}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <a href="/">Bid Prospect</a>
            <span>/</span>
            {category && (
              <>
                <a href={`/category/${category.slug}`}>{category.label}</a>
                <span>/</span>
              </>
            )}
            <span>NSN {nsn}</span>
          </nav>
          <h1 className={styles.title}>{data.name}</h1>
          <p className={styles.lede}>
            NSN {nsn} appears in {data.rows.length} DLA{" "}
            {data.rows.length === 1 ? "request" : "requests"} for quotes saved by Bid
            Prospect.
          </p>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>NSN</dt>
              <dd>{nsn}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Supply class</dt>
              <dd>
                FSC {data.fsc} · {group.label}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>NIIN</dt>
              <dd>{nsn.slice(5)}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Assigned by</dt>
              <dd>{country(nsn)}</dd>
            </div>
            {unit && (
              <div className={styles.fact}>
                <dt>Unit of issue</dt>
                <dd>{unit}</dd>
              </div>
            )}
          </dl>

          <section className={styles.section}>
            <h2>Requests for quotes</h2>
            <div className="results card">
              <div className="table-scroll">
                <table className="list">
                  <thead>
                    <tr>
                      <th>Solicitation</th>
                      <th className="num">How many</th>
                      <th>Who can bid</th>
                      <th>How it's awarded</th>
                      <th>Due</th>
                      <th>Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => {
                      const days = daysLeft(row.due);
                      const pdf = row.pdf ?? pdfLink(row.solicitation);
                      const docs = row.docs && techDocsLink(row.solicitation);
                      return (
                        <tr key={row.id} className={days !== null && days < 0 ? "past" : ""}>
                          <td className="item">
                            <a className="open" href={row.url} target="_blank" rel="noreferrer">
                              {row.solicitation}
                            </a>
                          </td>
                          <td className="num">{row.quantity?.toLocaleString() ?? "–"}</td>
                          <td className="aside">
                            <span className="set-asides">
                              {setAsideParts(row.setAside).map((part) => (
                                <span
                                  key={part.label}
                                  className={`badge ${part.open ? "neutral" : "blue"}`}
                                >
                                  {part.label}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td>{awardMethod(row.solicitation) ?? "Not shown"}</td>
                          <td className="due">
                            <strong>{formatDate(row.due)}</strong>
                            <span className={days !== null && days >= 0 && days <= 3 ? "soon" : ""}>
                              {dueText(days)}
                            </span>
                          </td>
                          <td>
                            {pdf && (
                              <a className={styles.link} href={pdf} target="_blank" rel="noreferrer">
                                PDF
                              </a>
                            )}
                            {docs && (
                              <>
                                {pdf ? " · " : ""}
                                <a className={styles.link} href={docs} target="_blank" rel="noreferrer">
                                  Drawings
                                </a>
                              </>
                            )}
                            {!pdf && !docs && "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {data.awards.length > 0 && (
            <section className={styles.section}>
              <h2>Past awards</h2>
              <p className={styles.note}>
                From the procurement history printed in the latest solicitation.
              </p>
              <div className="results card">
                <div className="table-scroll">
                  <table className="list">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="num">Unit price</th>
                        <th className="num">Quantity</th>
                        <th>Winner</th>
                        <th>Contract</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.awards.map((award) => {
                        const winner = data.sources.find((s) => s.cage === award.cage);
                        return (
                          <tr key={`${award.contract}:${award.date}`}>
                            <td>{fullDate(award.date)}</td>
                            <td className="num">{money(award.unitCost)}</td>
                            <td className="num">
                              {award.quantity.toLocaleString()}
                              {unit ? ` ${unit}` : ""}
                            </td>
                            <td>
                              {winner ? `${winner.name} (CAGE ${award.cage})` : `CAGE ${award.cage}`}
                              {award.surplus ? " · Surplus" : ""}
                            </td>
                            <td className="mono">{award.contract}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {data.sources.length > 0 && (
            <section className={styles.section}>
              <h2>Approved sources</h2>
              <p className={styles.note}>
                The manufacturers and part numbers the solicitation says DLA will accept.
              </p>
              <div className="results card">
                <div className="table-scroll">
                  <table className="list">
                    <thead>
                      <tr>
                        <th>Manufacturer</th>
                        <th>CAGE</th>
                        <th>Part number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sources.map((source) => (
                        <tr key={`${source.cage}:${source.partNumber}`}>
                          <td>{source.name}</td>
                          <td className="mono">{source.cage}</td>
                          <td className="mono">{source.partNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {!data.indexable && (
            <p className={`${styles.note} ${styles.section}`}>
              Approved sources and past award prices appear here once the solicitation PDF
              has been opened in the{" "}
              <a className={styles.link} href="/dashboard">
                full list
              </a>
              .
            </p>
          )}

          <p className={`${styles.note} ${styles.section}`}>
            <CategoryLabel fsc={data.fsc} />{" "}
            {category && (
              <a className={styles.link} href={`/category/${category.slug}`}>
                See open {category.label.toLowerCase()} requests
              </a>
            )}
            {" · "}
            <a className={styles.link} href="/guides/what-is-an-nsn">
              How to read an NSN
            </a>
          </p>
        </div>
      </main>
    </SiteShell>
  );
}
