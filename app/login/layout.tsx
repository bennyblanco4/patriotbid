import { SiteShell } from "../site-shell";

export const metadata = {
  title: "Sign in",
  description: "Sign in to Bid Prospect with Google or your email to open today's DIBBS RFQs.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
