import { SiteShell } from "../site-shell";
import styles from "../content.module.css";
import shell from "../landing.module.css";

const title = "Privacy policy";
const description = "What Bid Prospect stores about you when you sign in and use the site.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title: `${title} | Bid Prospect`, description, url: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <main className={`${styles.page} ${shell.alt}`}>
        <div className={shell.wrap}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <a href="/">Bid Prospect</a>
            <span>/</span>
            <span>Privacy</span>
          </nav>
          <h1 className={styles.title}>Privacy policy</h1>
          <article className={styles.prose}>
            <p>Last updated October 24, 2026.</p>

            <h2>Your account</h2>
            <p>
              Sign-in is handled by Google Firebase Authentication. If you sign in with
              Google, we receive your name, email address and profile photo from your
              Google account. If you sign in with email, we store your email address.
              Your password goes to Firebase directly and is never visible to us. We use
              this only to let you into the dashboard and to send a reset link when you
              ask for one.
            </p>

            <h2>Your watchlist</h2>
            <p>
              RFQs you save are kept in your own browser's storage. They are not sent to
              our server, and clearing your browser data removes them.
            </p>

            <h2>Analytics</h2>
            <p>
              We use Google Analytics to count visits and see which pages are used. It
              sets cookies and collects information such as your browser, device and
              approximate location.
            </p>

            <h2>What we don't do</h2>
            <p>
              We don't sell or rent your information, and we don't send marketing email.
              The RFQ data on the site comes from DLA's public bid board, not from you.
            </p>

            <h2>Changes</h2>
            <p>If this policy changes, the date at the top of this page will change too.</p>
          </article>
        </div>
      </main>
    </SiteShell>
  );
}
