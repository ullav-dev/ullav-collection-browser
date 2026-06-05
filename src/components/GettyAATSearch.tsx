"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AATTerm {
  id: string;       // full URI, e.g. http://vocab.getty.edu/aat/300056462
  label: string;
  scopeNote?: string;
  broader: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gettyPageUrl(uri: string): string {
  const match = uri.match(/aat\/(\d+)/);
  return match ? `https://vocab.getty.edu/page/aat/${match[1]}` : uri;
}

function gettyId(uri: string): string {
  return uri.match(/aat\/(\d+)/)?.[1] ?? uri;
}

function buildNoteBody(term: AATTerm): string {
  const url = gettyPageUrl(term.id);
  const lines = [`## ${term.label}`, ``, `**Getty AAT ID:** ${gettyId(term.id)}`];
  if (term.scopeNote) lines.push(``, `**Definition:** ${term.scopeNote}`);
  if (term.broader.length) lines.push(``, `**Broader terms:** ${term.broader.join(" › ")}`);
  lines.push(``, `*Source: [Getty Art & Architecture Thesaurus](${url})*`);
  return lines.join("\n");
}

// ── Hero ──────────────────────────────────────────────────────────────────────

// Van Gogh's "Irises" (1889) — J. Paul Getty Museum, public domain (Wikimedia Commons)
const HERO_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/3/3e/Irises-Vincent_van_Gogh.jpg";

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onSaveAsNote: (title: string, description: string, body: string) => void;
  initialQuery?: string;
}

export default function GettyAATSearch({ onSaveAsNote, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<AATTerm[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AATTerm | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setError(null); setSelected(null); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      setSelected(null);
      try {
        const res = await fetch(`/api/getty/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResults(data.results ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500); // slightly longer debounce — SPARQL can be slow

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-100 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_IMAGE} alt="Getty Art & Architecture Thesaurus" className="w-full object-cover max-h-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-3">
          <p className="text-white font-semibold text-sm drop-shadow">Getty Art & Architecture Thesaurus</p>
          <p className="text-slate-200 text-xs mt-0.5 drop-shadow">Controlled vocabulary for art, architecture, and material culture</p>
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
          placeholder="Search AAT terms — e.g. silver, oil paint, portrait…"
          className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-pulse">
            Searching…
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}

      {/* Results + detail split */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Results list */}
        {results.length > 0 && (
          <div className="w-64 shrink-0 overflow-y-auto space-y-1 pr-1">
            {results.map((term) => (
              <button
                key={term.id}
                type="button"
                onClick={() => setSelected(term)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  selected?.id === term.id
                    ? "border-teal-400 bg-teal-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-medium text-slate-800 truncate">{term.label}</p>
                {term.broader.length > 0 && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">{term.broader[0]}</p>
                )}
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">AAT {gettyId(term.id)}</p>
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.595.33a18.095 18.095 0 005.223-5.223c.542-.815.369-1.896-.33-2.595L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">Getty Art & Architecture Thesaurus</p>
              <p className="text-xs text-slate-400 max-w-xs">Search for controlled vocabulary — object types, materials, techniques, styles, and periods used in art and architecture cataloguing.</p>
            </div>
          )}

          {query.trim() && !searching && results.length === 0 && !error && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              No AAT terms found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.length > 0 && !selected && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              Select a term to see its definition
            </div>
          )}

          {selected && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{selected.label}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">AAT {gettyId(selected.id)}</p>
                  </div>
                  <a
                    href={gettyPageUrl(selected.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    View in Getty ↗
                  </a>
                </div>
              </div>

              {selected.broader.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hierarchy</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {selected.broader.map((b, i) => (
                      <span key={b} className="flex items-center gap-1">
                        {i > 0 && <span className="text-slate-300">›</span>}
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{b}</span>
                      </span>
                    ))}
                    <span className="text-slate-300">›</span>
                    <span className="text-xs bg-teal-100 text-teal-700 font-medium px-2 py-0.5 rounded-full">{selected.label}</span>
                  </div>
                </div>
              )}

              {selected.scopeNote && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Definition</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{selected.scopeNote}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onSaveAsNote(selected.label, gettyPageUrl(selected.id), buildNoteBody(selected))}
                  className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                  </svg>
                  Save as note
                </button>
                <a
                  href={gettyPageUrl(selected.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  View in Getty ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attribution */}
      <p className="text-xs text-slate-400 text-center shrink-0">
        Data from the{" "}
        <a href="https://vocab.getty.edu/aat/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
          Getty Art & Architecture Thesaurus
        </a>
        {" "}— © J. Paul Getty Trust, Open Content Program
      </p>
    </div>
  );
}
