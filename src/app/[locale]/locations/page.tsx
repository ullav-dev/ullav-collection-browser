"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listLocations, type Location } from "@/lib/collection-api";

function locationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    building: "Building",
    room: "Room",
    cabinet: "Cabinet",
    shelf: "Shelf",
    box: "Box",
    other: "Other",
  };
  return labels[type] ?? type;
}

export default function LocationsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const fetchLocations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setLocations(await listLocations(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchLocations();
  }, [fetchLocations, token]);

  if (isLoading || !user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Locations</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>
      ) : locations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No locations defined yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{loc.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{loc.name}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{locationTypeLabel(loc.location_type)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${loc.is_active ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-400"}`}>
                      {loc.is_active ? "Active" : "Inactive"}
                    </span>
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
