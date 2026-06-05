export const runtime = "nodejs";

const LOCALE_TO_LANG: Record<string, string> = {
  en: "en",
  de: "de",
  ga: "ga",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const locale = url.searchParams.get("locale") ?? "en";
  const lang = LOCALE_TO_LANG[locale] ?? "en";
  const type = url.searchParams.get("type") ?? "search"; // "search" | "summary"
  const key = url.searchParams.get("key") ?? "";

  if (!q && !key) {
    return Response.json({ error: "q or key required" }, { status: 400 });
  }

  let wikiUrl: string;
  if (type === "summary" && key) {
    wikiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`;
  } else {
    wikiUrl = `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=10`;
  }

  const res = await fetch(wikiUrl, {
    headers: { "User-Agent": "Cartlann/1.0 (collection management; colin@botharbeag.com)" },
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
