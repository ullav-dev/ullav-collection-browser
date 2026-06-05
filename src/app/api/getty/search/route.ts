export const runtime = "nodejs";

// Getty Vocabulary SPARQL — Art & Architecture Thesaurus (AAT)
// Uses POST to the HTTPS endpoint (GET via http:// redirects to https:// and
// Node.js fetch can silently fail across the redirect boundary).
const SPARQL_ENDPOINT = "https://vocab.getty.edu/sparql";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");

  if (!q?.trim()) {
    return Response.json({ error: "q required" }, { status: 400 });
  }

  // Sanitise: strip characters that could break the SPARQL string literal
  const safe = q.trim().replace(/["'\\]/g, "");

  // Getty's SPARQL endpoint pre-defines all these prefixes (aat:, skos:, xl:, gvp:)
  const sparql = `
SELECT DISTINCT ?subj ?subjLabel ?scopeNote ?broaderLabel WHERE {
  ?subj a skos:Concept ;
        skos:inScheme aat: ;
        gvp:prefLabelGVP ?prefLabelObj .
  ?prefLabelObj xl:literalForm ?subjLabel .
  FILTER (CONTAINS(LCASE(STR(?subjLabel)), LCASE("${safe}")) && LANG(?subjLabel) = "en")
  OPTIONAL {
    ?subj skos:scopeNote ?noteObj .
    ?noteObj rdf:value ?scopeNote .
    FILTER(LANG(?scopeNote) = "en")
  }
  OPTIONAL {
    ?subj skos:broader ?broader .
    ?broader gvp:prefLabelGVP ?bLabelObj .
    ?bLabelObj xl:literalForm ?broaderLabel .
    FILTER(LANG(?broaderLabel) = "en")
  }
}
LIMIT 20
`;

  try {
    const res = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/sparql-results+json",
        "User-Agent": "Cartlann/1.0 (collection management; colin@botharbeag.com)",
      },
      body: `query=${encodeURIComponent(sparql)}`,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Getty SPARQL ${res.status}:`, body.slice(0, 400));
      return Response.json(
        { error: `Getty SPARQL returned ${res.status}` },
        { status: 502 },
      );
    }

    const raw = await res.json();
    const bindings: Array<{
      subj: { value: string };
      subjLabel: { value: string };
      scopeNote?: { value: string };
      broaderLabel?: { value: string };
    }> = raw.results?.bindings ?? [];

    // Deduplicate by URI, collecting broader terms into an array
    const map = new Map<string, { id: string; label: string; scopeNote?: string; broader: string[] }>();
    for (const b of bindings) {
      const id = b.subj.value;
      if (!map.has(id)) {
        map.set(id, { id, label: b.subjLabel.value, scopeNote: b.scopeNote?.value, broader: [] });
      }
      const entry = map.get(id)!;
      if (b.broaderLabel?.value && !entry.broader.includes(b.broaderLabel.value)) {
        entry.broader.push(b.broaderLabel.value);
      }
    }

    return Response.json({ results: Array.from(map.values()) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Getty SPARQL fetch error:", msg);
    return Response.json({ error: `Getty request failed: ${msg}` }, { status: 502 });
  }
}
