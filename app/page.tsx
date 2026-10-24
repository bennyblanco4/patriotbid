import { loadDates, loadDayRaw } from "../lib/store";
import type { Opportunity } from "../lib/opportunities";
import styles from "./landing.module.css";
import { PREVIEW_COUNT, RfqList, sortLikeDashboard } from "./rfq-list";
import { SiteShell } from "./site-shell";

// Rebuilt from the database at most hourly so the preview shows the latest
// saved day instead of the one from deploy time.
export const revalidate = 3600;

const title = "Bid Prospect | Free DIBBS search for DLA RFQs";
const description =
  "Search today's DLA requests for quotes from DIBBS in plain English: what the government needs, how many, who can bid, past award prices and when quotes are due. Free, no sign-up.";

export const metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Bid Prospect" }],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/icon.png"],
  },
};

const homeSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://bidprospect.com/#website",
      name: "Bid Prospect",
      url: "https://bidprospect.com/",
      description,
      inLanguage: "en",
      publisher: { "@id": "https://bidprospect.com/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://bidprospect.com/#organization",
      name: "Bid Prospect",
      url: "https://bidprospect.com/",
      logo: {
        "@type": "ImageObject",
        url: "https://bidprospect.com/icon.png",
      },
    },
    {
      "@type": "WebPage",
      "@id": "https://bidprospect.com/#webpage",
      url: "https://bidprospect.com/",
      name: title,
      description,
      isPartOf: { "@id": "https://bidprospect.com/#website" },
      about: {
        "@type": "Thing",
        name: "DLA requests for quotes posted on DIBBS",
      },
      inLanguage: "en",
    },
  ],
};

async function latestRows() {
  try {
    const dates = await loadDates();
    const day = dates[0] ? await loadDayRaw(dates[0]) : null;
    if (!day?.rowsJson) return { rows: [] as Opportunity[], total: 0 };
    const parsed = JSON.parse(day.rowsJson) as unknown;
    const all = Array.isArray(parsed) ? (parsed as Opportunity[]) : [];
    return {
      rows: sortLikeDashboard(all).slice(0, PREVIEW_COUNT),
      total: day.total || all.length,
    };
  } catch {
    return { rows: [] as Opportunity[], total: 0 };
  }
}

export default async function LandingPage() {
  const listing = await latestRows();

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeSchema).replace(/</g, "\\u003c"),
        }}
      />
      <main>
        <section className={styles.hero}>
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.wrap}>
            <div className={`${styles.kicker} ${styles.rise}`}>
              <div className={`${styles.pill} ${styles.alt}`}>
                <Radar />
                <strong>From today's DIBBS list</strong>
                <span>•</span>
                About 2,000 new requests each business day
              </div>
            </div>
            <div className={`${styles.heroCopy} ${styles.rise} ${styles.d1}`}>
              <h1>
                See which DIBBS requests are{" "}
                <span className={styles.accent}>worth a price.</span>
              </h1>
              <p className={`${styles.lede} ${styles.alt}`}>
                Every business day the Defense Logistics Agency posts about 2,000
                requests for quotes (RFQs) on DIBBS, its bid board for parts and
                supplies. Bid Prospect shows what they need, how many they want,
                who is allowed to bid, and the day your quote is due.
              </p>
              <div className={`${styles.actions} ${styles.alt}`}>
                <a className={styles.primary} href="/dashboard">
                  <Radar />
                  See today's full list
                </a>
              </div>
              <div className={`${styles.trust} ${styles.alt}`}>
                <span className={styles.trustItem}>
                  <Check /> No sign-up
                </span>
                <span>•</span>
                <span className={styles.trustItem}>
                  <Lock /> Free
                </span>
                <span>•</span>
                <span>Public government listings</span>
              </div>
            </div>

            <div className={`${styles.viewer} ${styles.rise} ${styles.d2}`}>
              {listing.rows.length > 0 && (
                <p className={`${styles.listNote} ${styles.alt}`}>
                  These {listing.rows.length} rows are real requests from today,
                  out of {listing.total.toLocaleString()}. The part names are
                  the government's own words.
                </p>
              )}
              <RfqList rows={listing.rows} total={listing.total} />
            </div>
          </div>
        </section>
      </main>

    </SiteShell>
  );
}

function Radar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" opacity="0.55" />
      <path
        d="M12 12 L12 3.5 A8.5 8.5 0 0 1 19.2 8.4 Z"
        fill="currentColor"
        opacity="0.85"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 12.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Lock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="10.5" width="12" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
