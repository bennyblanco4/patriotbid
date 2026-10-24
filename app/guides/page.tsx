import { guides } from "./content";
import { SiteShell } from "../site-shell";
import styles from "../content.module.css";
import shell from "../landing.module.css";

const title = "DIBBS guides";
const description =
  "Short guides to quoting on DLA's bid board: registering on DIBBS, CAGE codes, reading an NSN and how RFQs are awarded.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/guides" },
  openGraph: { title: `${title} | Bid Prospect`, description, url: "/guides" },
};

export default function GuidesPage() {
  return (
    <SiteShell>
      <main className={`${styles.page} ${shell.alt}`}>
        <div className={shell.wrap}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <a href="/">Bid Prospect</a>
            <span>/</span>
            <span>Guides</span>
          </nav>
          <h1 className={styles.title}>DIBBS guides</h1>
          <p className={styles.lede}>{description}</p>
          <div className={styles.grid}>
            {guides.map((guide) => (
              <a key={guide.slug} className={styles.tile} href={`/guides/${guide.slug}`}>
                <strong>{guide.title}</strong>
                <span>{guide.description}</span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
