"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import {
  listLocations, createLocation, updateLocation,
  type Location,
} from "@/lib/collection-api";
import React from "react";
import Modal from "@/components/Modal";
import FormField, { inputCls, selectCls, ErrorBox, SaveButton } from "@/components/FormField";

const LOCATION_TYPES = ["building", "room", "gallery", "store", "cabinet", "shelf", "box", "other"];

function typeLabel(t: string) {
  const labels: Record<string, string> = {
    building: "Building", room: "Room", gallery: "Gallery", store: "Store",
    cabinet: "Cabinet", shelf: "Shelf", box: "Box", other: "Other",
  };
  return labels[t] ?? t;
}

interface FormState {
  code: string; name: string; description: string;
  parent_id: string; location_type: string; is_active: boolean;
}

const EMPTY: FormState = { code: "", name: "", description: "", parent_id: "", location_type: "room", is_active: true };

function fromLocation(l: Location): FormState {
  return { code: l.code, name: l.name, description: l.description ?? "", parent_id: l.parent_id ?? "", location_type: l.location_type, is_active: l.is_active };
}

export default function LocationsPage() {
  const { user, token, isLoading } = useAuth();
  const { userRole, canWrite, activeCollection } = useCollection();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "new" | Location>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setLocations(await listLocations(token)); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [token, activeCollection?.id]);

  useEffect(() => { if (token) load(); }, [load, token]);

  function openNew() { setForm(EMPTY); setFormError(null); setModal("new"); }
  function openEdit(l: Location) { setForm(fromLocation(l)); setFormError(null); setModal(l); }
  function closeModal() { setModal(null); }

  function set(k: keyof FormState, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true); setFormError(null);
    try {
      const body = {
        code: form.code, name: form.name,
        description: form.description || undefined,
        parent_id: form.parent_id || undefined,
        location_type: form.location_type,
        ...(typeof modal === "object" && modal !== null ? { is_active: form.is_active } : {}),
      };
      if (modal === "new") await createLocation(token, body);
      else await updateLocation(token, (modal as Location).id, body);
      closeModal();
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  if (isLoading || !user) return null;

  // Build parent options — exclude self when editing
  const editingId = typeof modal === "object" && modal !== null ? (modal as Location).id : null;
  const parentOptions = locations.filter(l => l.id !== editingId);

  // Indented display: sort by parent hierarchy
  const rootLocations = locations.filter(l => !l.parent_id);
  const childrenOf = (id: string) => locations.filter(l => l.parent_id === id);

  function renderRows(locs: Location[], depth = 0): React.ReactElement[] {
    return locs.flatMap(l => [
      <tr key={l.id} className="hover:bg-teal-50/40 transition-colors">
        <td className="px-4 py-3">
          <span style={{ paddingLeft: depth * 20 }} className="inline-flex items-center gap-2">
            {depth > 0 && <span className="text-slate-300">└</span>}
            <span className="font-mono text-xs text-slate-500">{l.code}</span>
          </span>
        </td>
        <td className="px-4 py-3 font-medium text-slate-800">{l.name}</td>
        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell text-xs">{typeLabel(l.location_type)}</td>
        <td className="px-4 py-3 hidden md:table-cell text-sm text-slate-400">{l.description}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${l.is_active ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-400"}`}>
            {l.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <button onClick={() => openEdit(l)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">Edit</button>
        </td>
      </tr>,
      ...renderRows(childrenOf(l.id), depth + 1),
    ]);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Locations</h1>
        {canWrite && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            New location
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400 py-12 text-center">Loading…</p>
      ) : locations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm mb-3">No locations defined yet.</p>
          {canWrite && <button onClick={openNew} className="text-teal-600 hover:text-teal-700 text-sm font-medium">Add the first location →</button>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renderRows(rootLocations)}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <Modal title={modal === "new" ? "New location" : `Edit — ${(modal as Location).name}`} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <ErrorBox message={formError} />}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Code" htmlFor="loc-code" required hint="Unique identifier, e.g. BLD1-RM2">
                <input id="loc-code" required value={form.code} onChange={e => set("code", e.target.value)} className={inputCls} placeholder="BLD1-RM2" />
              </FormField>
              <FormField label="Type" htmlFor="loc-type" required>
                <select id="loc-type" value={form.location_type} onChange={e => set("location_type", e.target.value)} className={selectCls}>
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Name" htmlFor="loc-name" required>
              <input id="loc-name" required value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} placeholder="Main Gallery Store" />
            </FormField>
            <FormField label="Parent location" htmlFor="loc-parent">
              <select id="loc-parent" value={form.parent_id} onChange={e => set("parent_id", e.target.value)} className={selectCls}>
                <option value="">— None (top level) —</option>
                {parentOptions.map(l => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </FormField>
            <FormField label="Description" htmlFor="loc-desc">
              <input id="loc-desc" value={form.description} onChange={e => set("description", e.target.value)} className={inputCls} />
            </FormField>
            {modal !== "new" && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Active</span>
              </label>
            )}
            <div className="flex gap-3 pt-2">
              <SaveButton saving={saving} label={modal === "new" ? "Create location" : "Save changes"} />
              <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
