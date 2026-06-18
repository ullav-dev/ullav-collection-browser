"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import {
  listEntries, createEntry, updateEntry, listParties,
  type ObjectEntry, type Party,
} from "@/lib/collection-api";
import Modal from "@/components/Modal";
import FormField, { inputCls, selectCls, ErrorBox, SaveButton } from "@/components/FormField";

const REASONS = ["acquisition", "loan_in", "enquiry", "valuation", "return", "other"];
const STATUSES = ["open", "returned", "accessioned", "disposed"];

const STATUS_COLOUR: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  returned: "bg-slate-100 text-slate-500",
  accessioned: "bg-teal-100 text-teal-700",
  disposed: "bg-red-100 text-red-600",
};

interface FormState {
  entry_number: string; entry_date: string; reason: string;
  depositor_id: string; brief_description: string;
  expected_return_date: string; actual_return_date: string;
  status: string; notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: FormState = { entry_number: "", entry_date: today(), reason: "acquisition", depositor_id: "", brief_description: "", expected_return_date: "", actual_return_date: "", status: "open", notes: "" };

function fromEntry(e: ObjectEntry): FormState {
  return {
    entry_number: e.entry_number, entry_date: e.entry_date,
    reason: e.reason, depositor_id: e.depositor_id ?? "",
    brief_description: e.brief_description ?? "",
    expected_return_date: e.expected_return_date ?? "",
    actual_return_date: e.actual_return_date ?? "",
    status: e.status, notes: e.notes ?? "",
  };
}

export default function EntriesPage() {
  const { user, token, isLoading } = useAuth(); 
  const { userRole, canWrite } = useCollection();
  const router = useRouter();
  const [entries, setEntries] = useState<ObjectEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "new" | ObjectEntry>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [e, p] = await Promise.all([listEntries(token), listParties(token)]);
      setEntries(e); setParties(p);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (token) load(); }, [load, token]);

  function openNew() {
    // Auto-suggest entry number: E-YYYY-NNN
    const year = new Date().getFullYear();
    const next = String(entries.length + 1).padStart(3, "0");
    setForm({ ...EMPTY, entry_number: `E-${year}-${next}` });
    setFormError(null); setModal("new");
  }
  function openEdit(e: ObjectEntry) { setForm(fromEntry(e)); setFormError(null); setModal(e); }

  function set(k: keyof FormState, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true); setFormError(null);
    try {
      const body = {
        entry_number: form.entry_number, entry_date: form.entry_date,
        reason: form.reason,
        depositor_id: form.depositor_id || undefined,
        brief_description: form.brief_description || undefined,
        expected_return_date: form.expected_return_date || undefined,
        ...(modal !== "new" ? {
          actual_return_date: form.actual_return_date || undefined,
          status: form.status,
        } : {}),
        notes: form.notes || undefined,
      };
      if (modal === "new") await createEntry(token, body);
      else await updateEntry(token, (modal as ObjectEntry).id, body);
      setModal(null); await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  if (isLoading || !user) return null;

  const partyName = (id: string | null) => parties.find(p => p.id === id)?.name;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Object Entries</h1>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          New entry
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400 py-12 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm mb-3">No entries recorded yet.</p>
          <button onClick={openNew} className="text-teal-600 hover:text-teal-700 text-sm font-medium">Record the first entry →</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Entry #</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Reason</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Depositor</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.entry_number}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(e.entry_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell capitalize">{e.reason.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{partyName(e.depositor_id) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOUR[e.status] ?? "bg-slate-100 text-slate-600"}`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(e)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <Modal title={modal === "new" ? "New object entry" : `Edit — ${(modal as ObjectEntry).entry_number}`} onClose={() => setModal(null)} width="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <ErrorBox message={formError} />}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Entry number" htmlFor="e-num" required>
                <input id="e-num" required value={form.entry_number} onChange={e => set("entry_number", e.target.value)} className={inputCls} />
              </FormField>
              <FormField label="Entry date" htmlFor="e-date" required>
                <input id="e-date" type="date" required value={form.entry_date} onChange={e => set("entry_date", e.target.value)} className={inputCls} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Reason" htmlFor="e-reason" required>
                <select id="e-reason" value={form.reason} onChange={e => set("reason", e.target.value)} className={selectCls}>
                  {REASONS.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
              </FormField>
              <FormField label="Depositor" htmlFor="e-dep">
                <select id="e-dep" value={form.depositor_id} onChange={e => set("depositor_id", e.target.value)} className={selectCls}>
                  <option value="">— None —</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Description" htmlFor="e-desc">
              <textarea id="e-desc" rows={2} value={form.brief_description} onChange={e => set("brief_description", e.target.value)} className={inputCls} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Expected return" htmlFor="e-exp">
                <input id="e-exp" type="date" value={form.expected_return_date} onChange={e => set("expected_return_date", e.target.value)} className={inputCls} />
              </FormField>
              {modal !== "new" && (
                <FormField label="Actual return" htmlFor="e-act">
                  <input id="e-act" type="date" value={form.actual_return_date} onChange={e => set("actual_return_date", e.target.value)} className={inputCls} />
                </FormField>
              )}
            </div>
            {modal !== "new" && (
              <FormField label="Status" htmlFor="e-status" required>
                <select id="e-status" value={form.status} onChange={e => set("status", e.target.value)} className={selectCls}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Notes" htmlFor="e-notes">
              <textarea id="e-notes" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} className={inputCls} />
            </FormField>
            <div className="flex gap-3 pt-2">
              <SaveButton saving={saving} label={modal === "new" ? "Create entry" : "Save changes"} />
              <button type="button" onClick={() => setModal(null)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
