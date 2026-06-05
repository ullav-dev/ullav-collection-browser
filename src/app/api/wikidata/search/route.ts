export const runtime = "nodejs";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const type = url.searchParams.get("type") ?? "search"; // "search" | "entity"
  const id = url.searchParams.get("id");
  const lang = url.searchParams.get("lang") ?? "en";

  if (type === "entity" && id) {
    // Fetch structured entity data (artist/maker profile)
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: id,
      format: "json",
      languages: lang,
      props: "labels|descriptions|claims|sitelinks",
    });

    const res = await fetch(`${WIKIDATA_API}?${params.toString()}`, {
      headers: { "User-Agent": "Cartlann/1.0 (collection management; colin@botharbeag.com)" },
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  }

  if (!q) {
    return Response.json({ error: "q required" }, { status: 400 });
  }

  // Full-text entity search
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: q,
    language: lang,
    format: "json",
    limit: "15",
    type: "item",
  });

  const res = await fetch(`${WIKIDATA_API}?${params.toString()}`, {
    headers: { "User-Agent": "Cartlann/1.0 (collection management; colin@botharbeag.com)" },
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
