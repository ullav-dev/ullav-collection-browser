export const runtime = "nodejs";

const EUROPEANA_BASE = "https://api.europeana.eu/record/v2/search.json";

export async function GET(req: Request) {
  const apiKey = process.env.EUROPEANA_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "EUROPEANA_API_KEY not configured" }, { status: 503 });
  }

  const src = new URL(req.url);
  const params = new URLSearchParams({
    wskey: apiKey,
    profile: "rich",
    rows: src.searchParams.get("rows") ?? "12",
    start: src.searchParams.get("start") ?? "1",
  });

  const q = src.searchParams.get("q");
  if (q) params.set("query", q);

  const mediaType = src.searchParams.get("media");
  if (mediaType) params.append("qf", `TYPE:${mediaType.toUpperCase()}`);

  const country = src.searchParams.get("country");
  if (country) params.append("qf", `COUNTRY:${country}`);

  const yearStart = src.searchParams.get("yearStart");
  const yearEnd = src.searchParams.get("yearEnd");
  if (yearStart || yearEnd) {
    params.append("qf", `proxy_dcterms_issued:[${yearStart ?? "*"} TO ${yearEnd ?? "*"}]`);
  }

  const res = await fetch(`${EUROPEANA_BASE}?${params.toString()}`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
