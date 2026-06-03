"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";

// ── Wikipedia REST API types ──────────────────────────────────────────────────

interface WikiSearchResult {
  key: string;
  title: string;
  excerpt: string;
  description?: string;
  thumbnail?: { url: string; width: number; height: number };
}

interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: { source: string };
  content_urls: { desktop: { page: string } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildNoteBody(summary: WikiSummary): string {
  const url = summary.content_urls.desktop.page;
  return `${summary.extract}\n\n*Source: [${summary.title} on Wikipedia](${url})*`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultCard({
  result,
  selected,
  onClick,
}: {
  result: WikiSearchResult;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-colors ${
        selected
          ? "border-teal-400 bg-teal-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {result.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.thumbnail.url}
            alt=""
            className="w-12 h-12 object-cover rounded-lg shrink-0"
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{result.title}</p>
          {result.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{result.description}</p>
          )}
          {result.excerpt && (
            // Wikipedia excerpts contain <em> highlight tags — safe to render
            <p
              className="text-xs text-slate-400 mt-1 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: result.excerpt }}
            />
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onSaveAsNote: (title: string, description: string, body: string) => void;
  /** Pre-populate the search box with the current object's title */
  initialQuery?: string;
}

export default function WikipediaSearch({ onSaveAsNote, initialQuery }: Props) {
  const locale = useLocale();

  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<WikiSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // If the initial query changes (e.g. user switches objects), update and trigger a search
  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  // Debounced search via our Wikipedia proxy
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      setSelectedKey(null);
      setSummary(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      setSelectedKey(null);
      setSummary(null);
      try {
        const params = new URLSearchParams({ q: query.trim(), locale, type: "search" });
        const res = await fetch(`/api/wikipedia/search?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(data.pages ?? []);
      } catch {
        setSearchError("Wikipedia search failed. Check your connection and try again.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, locale]);

  async function handleSelectResult(result: WikiSearchResult) {
    setSelectedKey(result.key);
    setSummary(null);
    setLoadingSummary(true);
    try {
      const params = new URLSearchParams({ key: result.key, locale, type: "summary" });
      const res = await fetch(`/api/wikipedia/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: WikiSummary = await res.json();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  function handleSaveAsNote() {
    if (!summary) return;
    onSaveAsNote(summary.title, summary.content_urls.desktop.page, buildNoteBody(summary));
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full px-4 py-4">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Wikipedia…"
          autoFocus
          className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-pulse">
            Searching…
          </span>
        )}
      </div>

      {searchError && (
        <p className="text-xs text-red-500 -mt-2">{searchError}</p>
      )}

      {/* Results + summary split */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Results list */}
        {results.length > 0 && (
          <div className="w-64 shrink-0 space-y-2 overflow-y-auto pr-1">
            {results.map((r) => (
              <ResultCard
                key={r.key}
                result={r}
                selected={selectedKey === r.key}
                onClick={() => handleSelectResult(r)}
              />
            ))}
          </div>
        )}

        {/* Summary panel */}
        <div className="flex-1 min-w-0 overflow-y-auto">

          {/* Empty / prompt states */}
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Search Wikipedia to find background on artists, makers, historical periods, places, or materials.</p>
            </div>
          )}

          {query.trim() && !searching && results.length === 0 && !selectedKey && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.length > 0 && !selectedKey && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              Select a result to read the article
            </div>
          )}

          {loadingSummary && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm animate-pulse">
              Loading article…
            </div>
          )}

          {/* Article summary */}
          {!loadingSummary && summary && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-start gap-4">
                {summary.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={summary.thumbnail.source}
                    alt={summary.title}
                    className="w-24 h-24 object-cover rounded-xl shrink-0 border border-slate-100"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800 text-base leading-tight">{summary.title}</h3>
                  <a
                    href={summary.content_urls.desktop.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:text-teal-700 hover:underline mt-1 inline-block"
                  >
                    Open in Wikipedia ↗
                  </a>
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{summary.extract}</p>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveAsNote}
                  className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                  </svg>
                  Save as note
                </button>
                <a
                  href={summary.content_urls.desktop.page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Open in Wikipedia ↗
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
