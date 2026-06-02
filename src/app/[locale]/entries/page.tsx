"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listEntries, type ObjectEntry } from "@/lib/collection-api";

function statusBadge(status: string) {
  const colours: Record<string, string> = {
    open: "bg-amber-100 text-amber-700",
    returned: "bg-slate-100 text-slate-500",
    accessioned: "bg-teal-100 text-teal-700",
    disposed: "bg-red-100 text-red-600",
  };
  return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colours[status] ?? "bg-slate-100 text-slate-600"}`;
}

export default function EntriesPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<ObjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const fetchEntries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setEntries(await listEntries(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchEntries();
  }, [fetchEntries, token]);

  if (isLoading || !user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Object Entries</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No entries recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Entry #</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Reason</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.entry_number}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(e.entry_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell capitalize">{e.reason.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(e.status)}>{e.status}</span>
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
