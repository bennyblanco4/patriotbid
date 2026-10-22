import "./globals.css";
import type { Viewport } from "next";
import Script from "next/script";

const GA_MEASUREMENT_ID = "G-9TM8JE6G9H";

export const metadata = {
  metadataBase: new URL("https://bidprospect.com"),
  title: {
    default: "Bid Prospect | See which government requests are worth a price",
    template: "%s | Bid Prospect",
  },
  description:
    "Every business day the government asks companies for a price on parts and supplies. Bid Prospect shows what they need, how many, who can bid, and when the price is due.",
  applicationName: "Bid Prospect",
  openGraph: {
    siteName: "Bid Prospect",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
  },
  robots: {
    index: true,
    follow: true,
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
        </Script>
        {children}
      </body>
    </html>
  );
}
