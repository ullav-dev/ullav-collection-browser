"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import {
  listAcquisitions, createAcquisition, getAcquisition,
  listObjects, listEntries, listParties,
  type Acquisition, type CollectionObject, type ObjectEntry, type Party,
} from "@/lib/collection-api";
import Modal from "@/components/Modal";
import FormField, { inputCls, selectCls, ErrorBox, SaveButton } from "@/components/FormField";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";

const METHODS = ["purchase", "gift", "bequest", "transfer", "found", "exchange", "commission", "other"];

interface FormState {
  object_id: string; entry_id: string; accession_number: string;
  acquisition_date: string; method: string; source_id: string;
  price: string; currency: string; authorisation_reference: string; notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: FormState = {
  object_id: "", entry_id: "", accession_number: "",
  acquisition_date: today(), method: "gift", source_id: "",
  price: "", currency: DEFAULT_CURRENCY, authorisation_reference: "", notes: "",
};

interface DetailModal { type: "detail"; acq: Acquisition }
type ModalState = null | "new" | DetailModal;

export default function AcquisitionsPage() {
  const { user, token, isLoading } = useAuth(); 
  const { userRole, canWrite, activeCollection } = useCollection();
  const router = useRouter();
  const [acquisitions, setAcquisitions] = useState<Acquisition[]>([]);
  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [entries, setEntries] = useState<ObjectEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [acqs, objs, ents, parts] = await Promise.all([
        listAcquisitions(token), listObjects(token, { limit: 500 }),
        listEntries(token), listParties(token),
      ]);
      setAcquisitions(acqs); setObjects(objs); setEntries(ents); setParties(parts);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [token, activeCollection?.id]);

  useEffect(() => { if (token) load(); }, [load, token]);

  function set(k: keyof FormState, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true); setFormError(null);
    try {
      await createAcquisition(token, {
        object_id: form.object_id as never, // uuid string
        entry_id: form.entry_id || undefined as never,
        accession_number: form.accession_number,
        acquisition_date: form.acquisition_date,
        method: form.method,
        source_id: form.source_id || undefined as never,
        price: form.price ? parseFloat(form.price) : undefined,
        currency: form.currency || undefined,
        authorisation_reference: form.authorisation_reference || undefined,
        notes: form.notes || undefined,
      });
      setModal(null); await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  if (isLoading || !user) return null;

  const objectTitle = (id: string) => objects.find(o => o.id === id)?.title ?? id.slice(0, 8) + "…";
  const partyName = (id: string | null) => id ? (parties.find(p => p.id === id)?.name ?? "—") : "—";
  const openEntries = entries.filter(e => e.status === "open");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Acquisitions</h1>
        <button
          onClick={() => { setForm(EMPTY); setFormError(null); setModal("new"); }}
          className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          New acquisition
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400 py-12 text-center">Loading…</p>
      ) : acquisitions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No acquisitions recorded yet.</p>
          <p className="text-xs text-slate-300 mt-1">Acquisitions are created here or via the object edit page using a number scheme.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Accession #</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Object</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Method</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Source</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {acquisitions.map(a => (
                <tr key={a.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.accession_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 text-sm">{objectTitle(a.object_id)}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{new Date(a.acquisition_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell capitalize">{a.method}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{partyName(a.source_id)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setModal({ type: "detail", acq: a })} className="text-xs text-teal-600 hover:text-teal-700 font-medium">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {modal === "new" && (
        <Modal title="New acquisition" onClose={() => setModal(null)} width="lg">
          <form onSubmit={handleCreate} className="space-y-4">
            {formError && <ErrorBox message={formError} />}
            <FormField label="Object" htmlFor="acq-obj" required>
              <select id="acq-obj" required value={form.object_id} onChange={e => set("object_id", e.target.value)} className={selectCls}>
                <option value="">— Select object —</option>
                {objects.filter(o => !o.is_accessioned).map(o => (
                  <option key={o.id} value={o.id}>{o.title}{o.accession_number ? ` (${o.accession_number})` : ""}</option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Accession number" htmlFor="acq-num" required>
                <input id="acq-num" required value={form.accession_number} onChange={e => set("accession_number", e.target.value)} className={inputCls} placeholder="e.g. 2024.001" />
              </FormField>
              <FormField label="Acquisition date" htmlFor="acq-date" required>
                <input id="acq-date" type="date" required value={form.acquisition_date} onChange={e => set("acquisition_date", e.target.value)} className={inputCls} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Method" htmlFor="acq-method" required>
                <select id="acq-method" value={form.method} onChange={e => set("method", e.target.value)} className={selectCls}>
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormField>
              <FormField label="Source (party)" htmlFor="acq-source">
                <select id="acq-source" value={form.source_id} onChange={e => set("source_id", e.target.value)} className={selectCls}>
                  <option value="">— None —</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Linked entry" htmlFor="acq-entry">
              <select id="acq-entry" value={form.entry_id} onChange={e => set("entry_id", e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                {openEntries.map(e => <option key={e.id} value={e.id}>{e.entry_number} — {e.reason}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Price" htmlFor="acq-price">
                <input id="acq-price" type="number" step="0.01" value={form.price} onChange={e => set("price", e.target.value)} className={inputCls} />
              </FormField>
              <FormField label="Currency" htmlFor="acq-currency">
                <select id="acq-currency" value={form.currency} onChange={e => set("currency", e.target.value)} className={selectCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Authorisation reference" htmlFor="acq-auth">
              <input id="acq-auth" value={form.authorisation_reference} onChange={e => set("authorisation_reference", e.target.value)} className={inputCls} />
            </FormField>
            <FormField label="Notes" htmlFor="acq-notes">
              <textarea id="acq-notes" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} className={inputCls} />
            </FormField>
            <div className="flex gap-3 pt-2">
              <SaveButton saving={saving} label="Create acquisition" />
              <button type="button" onClick={() => setModal(null)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail modal */}
      {modal !== null && modal !== "new" && (
        <Modal title={`Acquisition — ${(modal as DetailModal).acq.accession_number}`} onClose={() => setModal(null)}>
          {(() => {
            const a = (modal as DetailModal).acq;
            return (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Object", objectTitle(a.object_id)],
                  ["Accession #", a.accession_number],
                  ["Date", new Date(a.acquisition_date).toLocaleDateString()],
                  ["Method", a.method],
                  ["Source", partyName(a.source_id)],
                  ["Price", a.price != null ? `${a.currency ?? ""} ${a.price.toLocaleString()}`.trim() : "—"],
                  ["Authorisation", a.authorisation_reference ?? "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</dt>
                    <dd className="text-slate-700">{value}</dd>
                  </div>
                ))}
                {a.notes && (
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Notes</dt>
                    <dd className="text-slate-700">{a.notes}</dd>
                  </div>
                )}
              </dl>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
