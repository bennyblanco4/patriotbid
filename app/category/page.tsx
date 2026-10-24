import { supplyGroups } from "../fsc";
import { SiteShell } from "../site-shell";
import styles from "../content.module.css";
import shell from "../landing.module.css";
import { todayEt } from "../../lib/opportunities";
import { groupCounts } from "../../lib/store";

export const revalidate = 3600;

const title = "DIBBS RFQs by category";
const description =
  "Browse DLA requests for quotes on DIBBS by federal supply group, from bearings and hardware to medical and clothing, with the number open in each.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/category" },
  openGraph: { title: `${title} | Bid Prospect`, description, url: "/category" },
};

async function counts() {
  try {
    return await groupCounts(todayEt());
  } catch {
    return new Map<string, { total: number; open: number }>();
  }
}

export default async function CategoriesPage() {
  const byGroup = await counts();
  const groups = supplyGroups
    .map((group) => ({ ...group, ...(byGroup.get(group.code) ?? { total: 0, open: 0 }) }))
    .filter((group) => group.total > 0)
    .sort((a, b) => b.open - a.open || a.label.localeCompare(b.label));

  return (
    <SiteShell>
      <main className={`${styles.page} ${shell.alt}`}>
        <div className={shell.wrap}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <a href="/">Bid Prospect</a>
            <span>/</span>
            <span>Categories</span>
          </nav>
          <h1 className={styles.title}>DIBBS RFQs by category</h1>
          <p className={styles.lede}>
            Every NSN belongs to a federal supply group, named by the first two digits of its
            supply class. Pick a group to see its open requests.
          </p>
          <div className={styles.grid}>
            {groups.map((group) => (
              <a key={group.code} className={styles.tile} href={`/category/${group.slug}`}>
                <strong>{group.label}</strong>
                <span>
                  FSG {group.code} ·{" "}
                  {group.open
                    ? `${group.open.toLocaleString()} open`
                    : `${group.total.toLocaleString()} saved, none open`}
                </span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
