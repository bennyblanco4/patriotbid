import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const onWww = host === "www.bidprospect.com";
  const onApex = host === "bidprospect.com";
  if (!onWww && !(onApex && proto === "http")) return NextResponse.next();

  const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://bidprospect.com");
  return NextResponse.redirect(dest, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
