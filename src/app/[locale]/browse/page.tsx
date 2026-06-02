"use client";

import { useEffect, useState, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { listPublicObjects, type CollectionObject } from "@/lib/collection-api";

function objectDateLabel(obj: CollectionObject): string {
  if (obj.date_from == null) return "";
  if (obj.date_to && obj.date_to !== obj.date_from) return `${obj.date_from}–${obj.date_to}`;
  return String(obj.date_from);
}

export default function BrowsePage() {
  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPublicObjects({ search: search || undefined, limit: 100 });
      setObjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collection");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <svg className="w-8 h-8" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="#0D9488"/>
            <rect x="10" y="38" width="44" height="6" rx="2" fill="#CCFBF1"/>
            <rect x="16" y="20" width="8" height="18" rx="2" fill="#F0FDFA"/>
            <rect x="28" y="16" width="8" height="22" rx="2" fill="#CCFBF1"/>
            <rect x="40" y="22" width="8" height="16" rx="2" fill="#F0FDFA"/>
            <circle cx="48" cy="18" r="5" fill="#D97706"/>
          </svg>
          <h1 className="text-2xl font-bold text-slate-800">Collection</h1>
        </div>
        <p className="text-slate-500 text-sm">Browse objects from our public collection.</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="search"
          placeholder="Search the collection…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading collection…</div>
      ) : objects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No public objects found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {objects.map((obj) => (
            <div key={obj.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-teal-200 transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-semibold text-slate-800 text-sm leading-snug">{obj.title}</h2>
                {obj.accession_number && (
                  <span className="font-mono text-[10px] text-slate-400 shrink-0 mt-0.5">{obj.accession_number}</span>
                )}
              </div>
              {obj.object_name && (
                <p className="text-xs text-teal-600 font-medium mb-1">{obj.object_name}</p>
              )}
              {obj.brief_description && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{obj.brief_description}</p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {objectDateLabel(obj) && (
                  <span className="text-xs text-slate-400">{objectDateLabel(obj)}</span>
                )}
                {obj.materials.length > 0 && (
                  <span className="text-xs text-slate-400">{obj.materials.slice(0, 2).join(", ")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 pt-6 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="text-teal-600 hover:text-teal-700">Taisce</Link>
          {" "}·{" "}
          <Link href="/login" className="text-teal-600 hover:text-teal-700">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
