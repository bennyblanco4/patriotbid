const title = "Today's requests";
const description =
  "The full list of government requests for prices from today. Search by part name, see how many they want, who can bid, and when the price is due.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/dashboard" },
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
  name: "Today's requests | Bid Prospect",
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
      {children}
    </>
  );
}
