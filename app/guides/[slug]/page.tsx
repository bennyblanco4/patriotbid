import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { guides } from "../content";
import { SiteShell } from "../../site-shell";
import styles from "../../content.module.css";
import shell from "../../landing.module.css";

export const dynamicParams = false;
export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: `${guide.title} | Bid Prospect`,
      description: guide.description,
      url: `/guides/${guide.slug}`,
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url: `https://bidprospect.com/guides/${guide.slug}`,
    publisher: { "@id": "https://bidprospect.com/#organization" },
    inLanguage: "en",
  };
  const others = guides.filter((g) => g.slug !== guide.slug);

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <main className={`${styles.page} ${shell.alt}`}>
        <div className={shell.wrap}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <a href="/">Bid Prospect</a>
            <span>/</span>
            <a href="/guides">Guides</a>
          </nav>
          <h1 className={styles.title}>{guide.title}</h1>
          <article className={styles.prose}>{guide.body}</article>
          <aside className={styles.sources}>
            <strong>Sources</strong>
            <ul>
              {guide.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
          <section className={styles.section}>
            <h2>More guides</h2>
            <div className={styles.grid}>
              {others.map((g) => (
                <a key={g.slug} className={styles.tile} href={`/guides/${g.slug}`}>
                  <strong>{g.title}</strong>
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
