import { AuthGate } from "./auth-gate";

const title = "Today's DIBBS RFQs";
const description =
  "Every DLA request for quotes posted on DIBBS today. Search by part name, NSN or solicitation number and filter by category, set-aside, award method and deadline.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: true },
  openGraph: {
    title: `${title} | Bid Prospect`,
    description,
    url: "/dashboard",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Bid Prospect" }],
  },
  twitter: {
    card: "summary",
    title: `${title} | Bid Prospect`,
    description,
    images: ["/icon.png"],
  },
};

const dashboardSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://bidprospect.com/dashboard#webpage",
  url: "https://bidprospect.com/dashboard",
  name: "Today's DIBBS RFQs | Bid Prospect",
  description,
  isPartOf: { "@id": "https://bidprospect.com/#website" },
  inLanguage: "en",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(dashboardSchema).replace(/</g, "\\u003c"),
        }}
      />
      <AuthGate>{children}</AuthGate>
    </>
  );
}
