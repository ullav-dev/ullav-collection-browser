"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
  url: string;
}

interface WikidataClaimValue {
  type: string;
  value: unknown;
}

interface WikidataSnak {
  snaktype: string;
  datavalue?: WikidataClaimValue;
}

interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  sitelinks?: Record<string, { title: string }>;
  claims?: Record<string, Array<{ mainsnak: WikidataSnak }>>;
}

// ── Claim extraction helpers ──────────────────────────────────────────────────

function getString(entity: WikidataEntity, prop: string): string | undefined {
  const claim = entity.claims?.[prop]?.[0];
  const val = claim?.mainsnak?.datavalue?.value;
  return typeof val === "string" ? val : undefined;
}

function getTime(entity: WikidataEntity, prop: string): string | undefined {
  const claim = entity.claims?.[prop]?.[0];
  const val = claim?.mainsnak?.datavalue?.value;
  if (val && typeof val === "object" && "time" in val) {
    // Format: "+1452-04-15T00:00:00Z"
    const time = (val as { time: string; precision: number }).time;
    const precision = (val as { time: string; precision: number }).precision;
    const year = time.replace(/^[+-]/, "").slice(0, 4);
    if (precision >= 11) {
      // Day precision
      const date = new Date(time.replace(/^[+-]/, "").replace(/T.*$/, ""));
      if (!isNaN(date.getTime())) return date.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    }
    return year; // year-only fallback
  }
  return undefined;
}

function buildNoteBody(entity: WikidataEntity, lang: string, label: string, description?: string): string {
  const wikidataUrl = `https://www.wikidata.org/wiki/${entity.id}`;
  const wikiSitelink = entity.sitelinks?.[`${lang}wiki`]?.title;
  const wikiUrl = wikiSitelink ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(wikiSitelink)}` : undefined;

  const born = getTime(entity, "P569");
  const died = getTime(entity, "P570");
  const viaf = getString(entity, "P214");
  const ulan = getString(entity, "P245");
  const rkd = getString(entity, "P650");

  const lines = [`## ${label}`, ""];
  if (description) lines.push(`*${description}*`, "");
  if (born || died) {
    lines.push(`**Dates:** ${[born, died].filter(Boolean).join(" – ")}`, "");
  }
  lines.push("**Authority identifiers:**", "");
  lines.push(`- [Wikidata ${entity.id}](${wikidataUrl})`);
  if (wikiUrl) lines.push(`- [Wikipedia](${wikiUrl})`);
  if (viaf) lines.push(`- [VIAF ${viaf}](https://viaf.org/viaf/${viaf})`);
  if (ulan) lines.push(`- [Getty ULAN ${ulan}](https://vocab.getty.edu/page/ulan/${ulan})`);
  if (rkd) lines.push(`- [RKD ${rkd}](https://rkd.nl/explore/artists/${rkd})`);
  return lines.join("\n");
}

// ── Hero ──────────────────────────────────────────────────────────────────────

// Wikidata logo on Wikimedia Commons — CC0
const HERO_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/6/66/Wikidata-logo-en.svg";

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onSaveAsNote: (title: string, description: string, body: string) => void;
  initialQuery?: string;
}

export default function WikidataSearch({ onSaveAsNote, initialQuery }: Props) {
  const locale = useLocale();
  const lang = locale === "de" ? "de" : locale === "ga" ? "ga" : "en";

  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<WikidataSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WikidataSearchResult | null>(null);
  const [entity, setEntity] = useState<WikidataEntity | null>(null);
  const [loadingEntity, setLoadingEntity] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setError(null); setSelected(null); setEntity(null); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      setSelected(null);
      setEntity(null);
      try {
        const params = new URLSearchParams({ q: query.trim(), lang });
        const res = await fetch(`/api/wikidata/search?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw: WikidataSearchResult[] = (data.search ?? []).map((r: {
          id: string;
          label?: string;
          description?: string;
          concepturi?: string;
        }) => ({
          id: r.id,
          label: r.label ?? r.id,
          description: r.description,
          url: `https://www.wikidata.org/wiki/${r.id}`,
        }));
        setResults(raw);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, lang]);

  async function handleSelectResult(result: WikidataSearchResult) {
    setSelected(result);
    setEntity(null);
    setLoadingEntity(true);
    try {
      const params = new URLSearchParams({ type: "entity", id: result.id, lang });
      const res = await fetch(`/api/wikidata/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ent: WikidataEntity = data.entities?.[result.id] ?? null;
      setEntity(ent);
    } catch {
      setEntity(null);
    } finally {
      setLoadingEntity(false);
    }
  }

  const entityLabel = entity?.labels?.[lang]?.value ?? entity?.labels?.en?.value ?? selected?.label ?? "";
  const entityDesc = entity?.descriptions?.[lang]?.value ?? entity?.descriptions?.en?.value ?? selected?.description;
  const wikiSitelink = entity?.sitelinks?.[`${lang}wiki`]?.title ?? entity?.sitelinks?.enwiki?.title;
  const wikiUrl = wikiSitelink ? `https://${lang === "ga" ? "en" : lang}.wikipedia.org/wiki/${encodeURIComponent(wikiSitelink)}` : undefined;
  const born = entity ? getTime(entity, "P569") : undefined;
  const died = entity ? getTime(entity, "P570") : undefined;
  const viaf = entity ? getString(entity, "P214") : undefined;
  const ulan = entity ? getString(entity, "P245") : undefined;
  const rkd = entity ? getString(entity, "P650") : undefined;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-[#990000] shrink-0 flex items-center justify-center min-h-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_IMAGE} alt="Wikidata" className="h-16 object-contain my-4 drop-shadow-lg" />
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-xs drop-shadow">Structured knowledge base — authority records for artists, makers, places, and periods</p>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Wikidata — artists, makers, places, periods…"
          className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-pulse">Searching…</span>
        )}
      </div>

      {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}

      <div className="flex gap-4 flex-1 min-h-0">

        {/* Results list */}
        {results.length > 0 && (
          <div className="w-64 shrink-0 overflow-y-auto space-y-1 pr-1">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectResult(r)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  selected?.id === r.id
                    ? "border-teal-400 bg-teal-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                {r.description && (
                  <p className="text-xs text-slate-400 truncate mt-0.5 line-clamp-2">{r.description}</p>
                )}
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">{r.id}</p>
              </button>
            ))}
          </div>
        )}

        {/* Detail / empty states */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.355a7.5 7.5 0 01-3 0m3 0v.75A2.25 2.25 0 0113.5 21h-3a2.25 2.25 0 01-2.25-2.25v-.75m7.5 0v-.75A2.25 2.25 0 0013.5 16.5h-3a2.25 2.25 0 00-2.25 2.25v.75M9 12a3 3 0 116 0 3 3 0 01-6 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">Wikidata Entity Search</p>
              <p className="text-xs text-slate-400 max-w-xs">Look up artists, makers, dynasties, places, and historical periods. Retrieves structured authority data including VIAF, ULAN, and RKD identifiers.</p>
            </div>
          )}

          {query.trim() && !searching && results.length === 0 && !error && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No results for &ldquo;{query}&rdquo;</div>
          )}

          {results.length > 0 && !selected && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Select an entity to see details</div>
          )}

          {loadingEntity && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm animate-pulse">Loading entity data…</div>
          )}

          {selected && !loadingEntity && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{entityLabel}</h3>
                    {entityDesc && <p className="text-sm text-slate-500 mt-0.5">{entityDesc}</p>}
                    <p className="text-xs text-slate-300 font-mono mt-1">{selected.id}</p>
                  </div>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-teal-600 hover:underline"
                  >
                    Wikidata ↗
                  </a>
                </div>
              </div>

              {/* Key facts */}
              {entity && (born || died || viaf || ulan || rkd || wikiUrl) && (
                <div className="space-y-2">
                  {(born || died) && (
                    <div className="flex gap-2">
                      {born && (
                        <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Born</p>
                          <p className="text-xs text-slate-700 mt-0.5">{born}</p>
                        </div>
                      )}
                      {died && (
                        <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Died</p>
                          <p className="text-xs text-slate-700 mt-0.5">{died}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Authority identifiers */}
                  {(viaf || ulan || rkd || wikiUrl) && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Authority identifiers</p>
                      <div className="flex flex-wrap gap-1.5">
                        {wikiUrl && (
                          <a href={wikiUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 px-2 py-0.5 rounded-full border border-slate-200 hover:border-teal-200 transition-colors">
                            Wikipedia
                          </a>
                        )}
                        {viaf && (
                          <a href={`https://viaf.org/viaf/${viaf}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 px-2 py-0.5 rounded-full border border-slate-200 hover:border-teal-200 transition-colors">
                            VIAF {viaf}
                          </a>
                        )}
                        {ulan && (
                          <a href={`https://vocab.getty.edu/page/ulan/${ulan}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 px-2 py-0.5 rounded-full border border-slate-200 hover:border-teal-200 transition-colors">
                            ULAN {ulan}
                          </a>
                        )}
                        {rkd && (
                          <a href={`https://rkd.nl/explore/artists/${rkd}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 px-2 py-0.5 rounded-full border border-slate-200 hover:border-teal-200 transition-colors">
                            RKD {rkd}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => entity && onSaveAsNote(entityLabel, selected.url, buildNoteBody(entity, lang, entityLabel, entityDesc))}
                  disabled={!entity}
                  className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                  </svg>
                  Save as note
                </button>
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Open in Wikidata ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attribution */}
      <p className="text-xs text-slate-400 text-center shrink-0">
        Data from{" "}
        <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
          Wikidata
        </a>
        {" "}— Wikimedia Foundation, CC0 Public Domain
      </p>
    </div>
  );
}
