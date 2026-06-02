"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listObjects, type CollectionObject } from "@/lib/collection-api";

function statusBadge(status: string) {
  const colours: Record<string, string> = {
    active: "bg-teal-100 text-teal-700",
    inactive: "bg-slate-100 text-slate-500",
    on_loan: "bg-amber-100 text-amber-700",
    disposed: "bg-red-100 text-red-600",
  };
  return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colours[status] ?? "bg-slate-100 text-slate-600"}`;
}

export default function ObjectsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const fetchObjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listObjects(token, { search: search || undefined, limit: 100 });
      setObjects(data);
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

      <div className="mb-6">
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
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Accession #</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Object name</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {objects.map((obj) => (
                <tr key={obj.id} className="hover:bg-teal-50/40 transition-colors cursor-pointer" onClick={() => router.push(`/objects/${obj.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {obj.accession_number ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{obj.title}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {obj.object_name ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {obj.date_from != null ? (obj.date_to && obj.date_to !== obj.date_from ? `${obj.date_from}–${obj.date_to}` : String(obj.date_from)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(obj.status)}>{obj.status.replace("_", " ")}</span>
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
    </div>
  );
}
