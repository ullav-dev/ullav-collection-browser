import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9.,:%\-_]+$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const { params: segments } = await params;

  // Validate segments to prevent path traversal / SSRF.
  // First segment must be an asset UUID; all must match the safe-character set.
  if (
    !segments ||
    segments.length === 0 ||
    !UUID_RE.test(segments[0]) ||
    segments.some((s) => !SAFE_SEGMENT_RE.test(s) || s === ".." || s === ".")
  ) {
    return new NextResponse(null, { status: 400 });
  }

  const damUrl = process.env.DAM_URL ?? "http://localhost:8080";
  const upstreamUrl = new URL(`/iiif/image/${segments.join("/")}`, damUrl);

  if (!upstreamUrl.pathname.startsWith("/iiif/image/")) {
    return new NextResponse(null, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("iiif_access_token")?.value;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(upstreamUrl.toString(), { headers });

  if (!res.ok) {
    return new NextResponse(null, { status: res.status });
  }

  // Authenticated responses must never be stored in a shared/public cache.
  const cacheControl = token ? "private, max-age=3600" : "public, max-age=3600";

  const isInfoJson = segments[segments.length - 1] === "info.json";
  if (isInfoJson) {
    const info = await res.json();
    // Rewrite the absolute server id to the proxy origin so OSD constructs
    // tile URLs via this handler (which injects auth) rather than the server directly.
    const origin = new URL(request.url).origin;
    const assetId = segments[0];
    info.id = `${origin}/api/iiif/image/${assetId}`;
    return NextResponse.json(info, {
      headers: {
        "Content-Type": "application/ld+json",
        "Cache-Control": cacheControl,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const body = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
