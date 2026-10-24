import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve Firebase's sign-in handler from our own domain, so Google's
  // account picker says "continue to bidprospect.com" instead of the
  // firebaseapp.com address.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://bidprospect-app.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://bidprospect-app.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
