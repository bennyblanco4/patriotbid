import "./globals.css";
import type { Viewport } from "next";
export const metadata = {
  title: "PatriotBid",
  description: "Find DLA opportunities worth quoting.",
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
      <body>{children}</body>
    </html>
  );
}
