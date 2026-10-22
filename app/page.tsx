import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { loadDates, loadDayRaw } from "../lib/store";
import type { Opportunity } from "../lib/opportunities";
import styles from "./landing.module.css";
import { PREVIEW_COUNT, RfqList, sortLikeDashboard } from "./rfq-list";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  fallback: ["Avenir Next", "Segoe UI", "sans-serif"],
});

const text = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-text",
  fallback: ["Segoe UI", "sans-serif"],
});

const title = "Bid Prospect | See which government requests are worth a price";
const description =
  "Every business day the government asks companies for a price on parts and supplies. Bid Prospect shows what they need, how many, who can bid, and when the price is due.";

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
        name: "Government requests for prices on parts and supplies",
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
  const year = new Date().getFullYear();
  const listing = await latestRows();

  return (
    <div className={`${styles.root} ${display.variable} ${text.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeSchema).replace(/</g, "\\u003c"),
        }}
      />
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.headerInner}`}>
          <a href="/" aria-label="Bid Prospect">
            <img
              className={styles.logo}
              src="/logo.svg"
              alt="Bid Prospect"
              width={896}
              height={637}
            />
          </a>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.wrap}>
            <div className={`${styles.kicker} ${styles.rise}`}>
              <div className={`${styles.pill} ${styles.alt}`}>
                <Radar />
                <strong>From today's government list</strong>
                <span>•</span>
                About 2,000 new requests each business day
              </div>
            </div>
            <div className={`${styles.heroCopy} ${styles.rise} ${styles.d1}`}>
              <h1>
                See which requests are{" "}
                <span className={styles.accent}>worth a price.</span>
              </h1>
              <p className={`${styles.lede} ${styles.alt}`}>
                Every business day the government asks companies for a price on
                parts and supplies. Bid Prospect shows what they need, how many
                they want, who is allowed to bid, and the day your price is due.
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

      <footer className={`${styles.footer} ${styles.alt}`}>
        <div className={styles.wrap}>
          <div className={styles.footerTop}>
            <div className={styles.brandLockup}>
              <img src="/logo.svg" alt="" width={896} height={637} />
              <span>© {year} Bid Prospect</span>
            </div>
            <nav className={styles.footerNav} aria-label="Footer">
              <a href="/dashboard">Today's full list</a>
              <a href="https://www.dibbs.bsm.dla.mil/RFQ/" target="_blank" rel="noreferrer">
                Official bid board
              </a>
            </nav>
          </div>
          <div className={styles.footerBottom}>
            <span className={styles.live}>
              <i aria-hidden="true" />
              Taken from the public government bid board. If they left something blank, it stays blank here.
            </span>
            <span>
              Bid Prospect is a separate website. It is not run by the government.
            </span>
          </div>
        </div>
      </footer>
    </div>
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
