"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listObjects, type CollectionObject } from "@/lib/collection-api";
import dynamic from "next/dynamic";
import type { LabelObject } from "@/lib/label-generator";

// Dynamically import the modal so jsPDF/bwip-js don't end up in the initial bundle
const LabelPrintModal = dynamic(() => import("@/components/LabelPrintModal"), { ssr: false });

function statusBadge(status: string) {
  const colours: Record<string, string> = {
    catalogued: "bg-teal-100 text-teal-700",
    uncatalogued: "bg-slate-100 text-slate-500",
    on_display: "bg-blue-100 text-blue-700",
    in_storage: "bg-slate-100 text-slate-500",
    on_loan: "bg-amber-100 text-amber-700",
    missing: "bg-orange-100 text-orange-700",
    deaccessioned: "bg-red-100 text-red-600",
  };
  return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colours[status] ?? "bg-slate-100 text-slate-600"}`;
}

function toLabelObject(obj: CollectionObject): LabelObject {
  return {
    id: obj.id,
    title: obj.title,
    accession_number: obj.accession_number,
    object_name: obj.object_name,
  };
}

export default function ObjectsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const fetchObjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listObjects(token, { search: search || undefined, limit: 200 });
      setObjects(data);
      // Drop any selected IDs that no longer appear in results
      setSelected((prev) => new Set([...prev].filter((id) => data.some((o) => o.id === id))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load objects");
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    if (token) fetchObjects();
  }, [fetchObjects, token]);

  if (isLoading || !user) return null;

  const allSelected = objects.length > 0 && objects.every((o) => selected.has(o.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(objects.map((o) => o.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedObjects = objects
    .filter((o) => selected.has(o.id))
    .map(toLabelObject);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">Collection Objects</h1>
        <Link
          href="/objects/new"
          className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add object
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by title, accession number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>
      ) : objects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm mb-3">No objects found.</p>
          <Link href="/objects/new" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            Add the first object →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Accession #</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Object name</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {objects.map((obj) => (
                <tr
                  key={obj.id}
                  className={`transition-colors cursor-pointer ${selected.has(obj.id) ? "bg-teal-50" : "hover:bg-teal-50/40"}`}
                  onClick={(e) => {
                    // Don't navigate if clicking the checkbox cell
                    if ((e.target as HTMLElement).closest("td:first-child")) return;
                    router.push(`/objects/${obj.id}`);
                  }}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(obj.id)}
                      onChange={() => toggle(obj.id)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {obj.accession_number ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{obj.title}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {obj.object_name ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {obj.date_from != null
                      ? obj.date_to && obj.date_to !== obj.date_from
                        ? `${obj.date_from}–${obj.date_to}`
                        : String(obj.date_from)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(obj.status)}>{obj.status.replace(/_/g, " ")}</span>
                    {obj.is_accessioned && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-600 text-white">ACC</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selection action bar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-slate-800 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="w-px h-4 bg-slate-600" />
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-300 hover:text-teal-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              Print Labels
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {showPrintModal && (
        <LabelPrintModal
          objects={selectedObjects}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
