"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EuropeanaItem {
  id: string;
  title?: string[];
  dcCreator?: string[];
  dataProvider?: string[];
  edmPreview?: string[];
  type?: string;
  year?: string[];
  country?: string[];
  rights?: string[];
  guid?: string;
}

interface EuropeanaResponse {
  success: boolean;
  itemsCount?: number;
  totalResults?: number;
  items?: EuropeanaItem[];
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  IMAGE: "🖼️",
  TEXT: "📄",
  VIDEO: "🎬",
  SOUND: "🎵",
  "3D": "🧊",
};

const MEDIA_TYPES = ["", "IMAGE", "TEXT", "VIDEO", "SOUND", "3D"];
const MEDIA_LABELS: Record<string, string> = {
  "": "All types",
  IMAGE: "Images",
  TEXT: "Texts",
  VIDEO: "Video",
  SOUND: "Audio",
  "3D": "3D",
};

function europeanaItemUrl(item: EuropeanaItem): string {
  if (item.guid) return item.guid;
  return `https://www.europeana.eu/item${item.id}`;
}

function buildNoteBody(item: EuropeanaItem): string {
  const url = europeanaItemUrl(item);
  const title = item.title?.[0] ?? "Untitled";
  const lines = [`## ${title}`];
  if (item.dcCreator?.length) lines.push(`**Creator:** ${item.dcCreator.join(", ")}`);
  if (item.year?.length) lines.push(`**Date:** ${item.year.join(", ")}`);
  if (item.dataProvider?.length) lines.push(`**Institution:** ${item.dataProvider.join(", ")}`);
  if (item.country?.length) lines.push(`**Country:** ${item.country.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}`);
  if (item.type) lines.push(`**Type:** ${item.type}`);
  lines.push("", `*Source: [${title} on Europeana](${url})*`);
  return lines.join("\n");
}

// ── Hero ──────────────────────────────────────────────────────────────────────

// Vermeer, "Girl with a Pearl Earring" (c.1665) — Mauritshuis, public domain (Wikimedia Commons)
const HERO_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/d/d7/Meisje_met_de_parel.jpg";

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onSaveAsNote: (title: string, description: string, body: string) => void;
  initialQuery?: string;
}

export default function EuropeanaSearch({ onSaveAsNote, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [mediaType, setMediaType] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<EuropeanaItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [selected, setSelected] = useState<EuropeanaItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  async function search(q: string, type: string, pg: number) {
    if (!q.trim()) { setResults([]); setError(null); setSelected(null); setTotalResults(0); return; }
    setSearching(true);
    setError(null);
    setApiKeyMissing(false);
    try {
      const params = new URLSearchParams({ q: q.trim(), rows: "12", start: String((pg - 1) * 12 + 1) });
      if (type) params.set("media", type);
      const res = await fetch(`/api/europeana/search?${params.toString()}`);
      if (res.status === 503) { setApiKeyMissing(true); return; }
      const data: EuropeanaResponse = await res.json();
      if (!data.success && data.error) throw new Error(data.error);
      setResults(data.items ?? []);
      setTotalResults(data.totalResults ?? 0);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  // Debounce query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); search(query, mediaType, 1); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mediaType]);

  function handlePageChange(next: number) {
    setPage(next);
    search(query, mediaType, next);
  }

  const totalPages = Math.ceil(totalResults / 12);
  const hasResults = results.length > 0;

  if (apiKeyMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16 px-8">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-2">Europeana API key not configured</h3>
        <p className="text-sm text-slate-400 max-w-sm mb-4">
          Add <code className="bg-slate-100 px-1 rounded text-xs">EUROPEANA_API_KEY</code> to your <code className="bg-slate-100 px-1 rounded text-xs">.env.local</code> file.
          Get a free key at{" "}
          <a href="https://apis.europeana.eu/en" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
            apis.europeana.eu
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-100 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt="Europeana — European cultural heritage"
          className="w-full object-cover max-h-40"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-3">
          <p className="text-white font-semibold text-sm drop-shadow">Europeana</p>
          <p className="text-slate-200 text-xs mt-0.5 drop-shadow">50+ million digitised objects from museums and archives across Europe</p>
        </div>
      </div>

      {/* Search + filter row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Europeana — e.g. Celtic jewellery, Roman pottery…"
            className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-pulse">Searching…</span>
          )}
        </div>
        <select
          value={mediaType}
          onChange={(e) => { setMediaType(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
        >
          {MEDIA_TYPES.map((t) => (
            <option key={t} value={t}>{MEDIA_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Results grid */}
        {hasResults && (
          <div className="w-72 shrink-0 flex flex-col">
            <p className="text-xs text-slate-400 mb-2">{totalResults.toLocaleString()} results</p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {results.map((item) => {
                const title = item.title?.[0] ?? "Untitled";
                const thumb = item.edmPreview?.[0];
                const institution = item.dataProvider?.[0];
                const year = item.year?.[0];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`w-full text-left rounded-xl border p-2.5 transition-colors ${
                      selected?.id === item.id
                        ? "border-teal-400 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex gap-2.5">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0 bg-slate-100" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-lg">
                          {TYPE_ICONS[item.type ?? ""] ?? "🏛️"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-tight">{title}</p>
                        {institution && <p className="text-[10px] text-slate-400 truncate mt-0.5">{institution}</p>}
                        {year && <p className="text-[10px] text-slate-400">{year}</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || searching}
                  className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40 px-2 py-1"
                >
                  ← Prev
                </button>
                <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || searching}
                  className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40 px-2 py-1"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detail / empty states */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">Europeana Cultural Heritage</p>
              <p className="text-xs text-slate-400 max-w-xs">Search 50+ million digitised objects, artworks, books, and records from museums and archives across Europe.</p>
            </div>
          )}

          {query.trim() && !searching && results.length === 0 && !error && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {hasResults && !selected && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              Select a record to see details
            </div>
          )}

          {selected && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex gap-4">
                {selected.edmPreview?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.edmPreview[0]} alt="" className="w-28 h-28 object-cover rounded-xl shrink-0 border border-slate-100" />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-slate-100 flex items-center justify-center text-3xl shrink-0">
                    {TYPE_ICONS[selected.type ?? ""] ?? "🏛️"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-800 text-base leading-tight">{selected.title?.[0] ?? "Untitled"}</h3>
                  {selected.dcCreator?.length && (
                    <p className="text-sm text-slate-600 mt-1">{selected.dcCreator.join(", ")}</p>
                  )}
                  <a
                    href={europeanaItemUrl(selected)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline mt-1 inline-block"
                  >
                    View on Europeana ↗
                  </a>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {selected.dataProvider?.[0] && (
                  <><dt className="text-xs text-slate-400 font-medium">Institution</dt><dd className="text-xs text-slate-700">{selected.dataProvider[0]}</dd></>
                )}
                {selected.year?.[0] && (
                  <><dt className="text-xs text-slate-400 font-medium">Date</dt><dd className="text-xs text-slate-700">{selected.year.join(", ")}</dd></>
                )}
                {selected.country?.[0] && (
                  <><dt className="text-xs text-slate-400 font-medium">Country</dt><dd className="text-xs text-slate-700 capitalize">{selected.country[0]}</dd></>
                )}
                {selected.type && (
                  <><dt className="text-xs text-slate-400 font-medium">Type</dt><dd className="text-xs text-slate-700">{selected.type}</dd></>
                )}
              </dl>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onSaveAsNote(
                    selected.title?.[0] ?? "Europeana record",
                    europeanaItemUrl(selected),
                    buildNoteBody(selected),
                  )}
                  className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                  </svg>
                  Save as note
                </button>
                <a
                  href={europeanaItemUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Open in Europeana ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attribution */}
      <p className="text-xs text-slate-400 text-center shrink-0">
        Data from{" "}
        <a href="https://www.europeana.eu" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
          Europeana
        </a>
        {" "}— © Europeana Foundation, Creative Commons licences vary per item
      </p>
    </div>
  );
}
