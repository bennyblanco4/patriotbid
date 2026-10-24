import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import styles from "./landing.module.css";

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

// Header and footer shared by the homepage, NSN, category and guide pages.
export function SiteShell({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className={`${styles.root} ${display.variable} ${text.variable}`}>
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

      {children}

      <footer className={`${styles.footer} ${styles.alt}`}>
        <div className={styles.wrap}>
          <div className={styles.footerTop}>
            <div className={styles.brandLockup}>
              <img src="/logo.svg" alt="" width={896} height={637} />
              <span>© {year} Bid Prospect</span>
            </div>
            <nav className={styles.footerNav} aria-label="Footer">
              <a href="/dashboard">Today's full list</a>
              <a href="/category">Categories</a>
              <a href="/guides">Guides</a>
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
