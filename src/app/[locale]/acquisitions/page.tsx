"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listAcquisitions, type Acquisition } from "@/lib/collection-api";

export default function AcquisitionsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [acquisitions, setAcquisitions] = useState<Acquisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const fetchAcquisitions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setAcquisitions(await listAcquisitions(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load acquisitions");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchAcquisitions();
  }, [fetchAcquisitions, token]);

  if (isLoading || !user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Acquisitions</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>
      ) : acquisitions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No acquisitions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Accession #</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Method</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {acquisitions.map((a) => (
                <tr key={a.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.accession_number}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(a.acquisition_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell capitalize">{a.method.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {a.price != null ? `${a.currency ?? ""} ${a.price.toLocaleString()}`.trim() : "—"}
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
