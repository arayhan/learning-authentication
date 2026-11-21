import { NextResponse, type NextRequest } from "next/server";

// Presence check only; real validation happens in currentUser().
export function proxy(req: NextRequest) {
  if (req.cookies.has("academy_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/", "/m/:path*"] };
