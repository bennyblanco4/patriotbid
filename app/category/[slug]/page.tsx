import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supplyGroups } from "../../fsc";
import { RfqList } from "../../rfq-list";
import { SiteShell } from "../../site-shell";
import styles from "../../content.module.css";
import shell from "../../landing.module.css";
import { todayEt } from "../../../lib/opportunities";
import { loadGroupRows } from "../../../lib/store";

// Read from the database only, refreshed at most hourly.
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

const load = cache(async (slug: string) => {
  const group = supplyGroups.find((g) => g.slug === slug);
  if (!group) return null;
  const { open, rows } = await loadGroupRows(group.code, todayEt());
  return { group, open, rows };
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Category not found", robots: { index: false } };
  const { group, open, rows } = data;
  const title = `${group.label} RFQs on DIBBS`;
  const description = open
    ? `${rows.length} open DLA requests for quotes in ${group.label.toLowerCase()} (FSG ${group.code}), with quantities, set-asides and deadlines.`
    : `Recent DLA requests for quotes in ${group.label.toLowerCase()} (FSG ${group.code}), with quantities, set-asides and deadlines.`;
  return {
    title,
    description,
    alternates: { canonical: `/category/${group.slug}` },
    robots: { index: rows.length > 0, follow: true },
    openGraph: { title: `${title} | Bid Prospect`, description, url: `/category/${group.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { group, open, rows } = data;

  return (
    <SiteShell>
      <main className={`${styles.page} ${shell.alt}`}>
        <div className={shell.wrap}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <a href="/">Bid Prospect</a>
            <span>/</span>
            <a href="/category">Categories</a>
            <span>/</span>
            <span>{group.label}</span>
          </nav>
          <h1 className={styles.title}>{group.label} RFQs</h1>
          <p className={styles.lede}>
            {open
              ? `DLA requests for quotes in federal supply group ${group.code} that are still open, soonest deadline first.`
              : `Nothing in federal supply group ${group.code} is open right now. These are the latest requests saved.`}{" "}
            Select a part to see its NSN page with past awards and approved sources.
          </p>
          <section className={styles.section}>
            {rows.length ? (
              <RfqList rows={rows} total={rows.length} />
            ) : (
              <p className={styles.note}>
                No requests in this group have been saved yet.{" "}
                <a className={styles.link} href="/dashboard">
                  See today's full list
                </a>
              </p>
            )}
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
