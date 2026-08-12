import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function route(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  // Proxy /api/tack/* → tack-server (strips /api/tack prefix). Must come
  // before /api/dam/* and the generic /api/* rule below -- same same-origin
  // passthrough pattern as togra/cunav/comad's own /api/tack/* rule. Used
  // only for the handful of tack-notes features cartlann's own backend
  // proxy has no reason to wrap (version history, unread tracking, system
  // principals) -- see lib/tack-notes-adapter.ts. Everything else (note/
  // folder/reply CRUD) still goes through /api/* → ullav-collection-server,
  // which adds real cartlann-specific value (object links, collection
  // scoping, canvas/IIIF annotation merging) tack-server has no way to do
  // on its own.
  if (pathname.startsWith("/api/tack/")) {
    const tackUrl = process.env.TACK_URL ?? "http://localhost:8087";
    return NextResponse.rewrite(
      new URL(pathname.slice("/api/tack".length) + search, tackUrl)
    );
  }

  // Proxy /api/dam/* → ullav-dam-server (strips /api/dam prefix)
  if (pathname.startsWith("/api/dam/")) {
    const damUrl = process.env.DAM_URL ?? "http://localhost:8080";
    return NextResponse.rewrite(
      new URL(pathname.slice("/api/dam".length) + search, damUrl)
    );
  }

  // Local Next.js API route handlers — must NOT be forwarded to the Rust server
  const localApiPrefixes = [
    "/api/ai/",
    "/api/europeana/",
    "/api/getty/",
    "/api/iiif/",   // IIIF image proxy — injects DAM auth via cookie
    "/api/wikidata/",
    "/api/wikipedia/",
  ];
  if (localApiPrefixes.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Proxy /api/* → ullav-collection-server (strips /api prefix)
  if (pathname.startsWith("/api/")) {
    const apiUrl = process.env.API_URL ?? "http://localhost:8084";
    return NextResponse.rewrite(
      new URL(pathname.slice("/api".length) + search, apiUrl)
    );
  }

  // Proxy /auth-api/* → ullav-user-management (strips /auth-api prefix)
  if (pathname.startsWith("/auth-api/")) {
    const authUrl = process.env.AUTH_URL ?? "http://localhost:8081";
    return NextResponse.rewrite(
      new URL(pathname.slice("/auth-api".length) + search, authUrl)
    );
  }

  return intlMiddleware(request) as NextResponse;
}

export function proxy(request: NextRequest) {
  const response = route(request);
  const portalUrl =
    process.env.PORTAL_URL ?? "https://portal.ullav.com http://localhost:3003";
  response.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${portalUrl}`);
  return response;
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
