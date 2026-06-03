"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/contexts/CollectionContext";
import { listParties, createParty, updateParty, type Party } from "@/lib/collection-api";
import Modal from "@/components/Modal";
import FormField, { inputCls, selectCls, ErrorBox, SaveButton } from "@/components/FormField";

interface FormState {
  name: string; party_type: string; email: string; phone: string; notes: string;
  address_line1: string; address_city: string; address_country: string;
}

const EMPTY: FormState = { name: "", party_type: "individual", email: "", phone: "", notes: "", address_line1: "", address_city: "", address_country: "" };

function fromParty(p: Party): FormState {
  const addr = (p.address ?? {}) as Record<string, string>;
  return {
    name: p.name, party_type: p.party_type,
    email: p.email ?? "", phone: p.phone ?? "", notes: p.notes ?? "",
    address_line1: addr.line1 ?? "", address_city: addr.city ?? "", address_country: addr.country ?? "",
  };
}

export default function PartiesPage() {
  const { user, token, isLoading } = useAuth(); 
  const { userRole } = useCollection();
  const canWrite = userRole !== "viewer";
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "new" | Party>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setParties(await listParties(token, search || undefined)); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [token, search]);

  useEffect(() => { if (token) load(); }, [load, token]);

  function openNew() { setForm(EMPTY); setFormError(null); setModal("new"); }
  function openEdit(p: Party) { setForm(fromParty(p)); setFormError(null); setModal(p); }

  function set(k: keyof FormState, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true); setFormError(null);
    try {
      const address: Record<string, string> = {};
      if (form.address_line1) address.line1 = form.address_line1;
      if (form.address_city) address.city = form.address_city;
      if (form.address_country) address.country = form.address_country;
      const body = {
        name: form.name, party_type: form.party_type,
        email: form.email || undefined, phone: form.phone || undefined,
        notes: form.notes || undefined,
        address: Object.keys(address).length > 0 ? address : undefined,
      };
      if (modal === "new") await createParty(token, body);
      else await updateParty(token, (modal as Party).id, body);
      setModal(null); await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  if (isLoading || !user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">Parties</h1>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          New party
        </button>
      </div>

      <div className="mb-4">
        <input type="search" placeholder="Search parties…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full sm:max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400 py-12 text-center">Loading…</p>
      ) : parties.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm mb-3">No parties found.</p>
          <button onClick={openNew} className="text-teal-600 hover:text-teal-700 text-sm font-medium">Add the first party →</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Phone</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parties.map(p => (
                <tr key={p.id} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{p.party_type}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{p.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <Modal title={modal === "new" ? "New party" : `Edit — ${(modal as Party).name}`} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <ErrorBox message={formError} />}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Name" htmlFor="p-name" required>
                <input id="p-name" required value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} />
              </FormField>
              <FormField label="Type" htmlFor="p-type" required>
                <select id="p-type" value={form.party_type} onChange={e => set("party_type", e.target.value)} className={selectCls}>
                  <option value="individual">Individual</option>
                  <option value="organisation">Organisation</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email" htmlFor="p-email">
                <input id="p-email" type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} />
              </FormField>
              <FormField label="Phone" htmlFor="p-phone">
                <input id="p-phone" value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} />
              </FormField>
            </div>
            <FormField label="Address" htmlFor="p-addr1">
              <input id="p-addr1" placeholder="Street address" value={form.address_line1} onChange={e => set("address_line1", e.target.value)} className={`${inputCls} mb-1`} />
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input placeholder="City" value={form.address_city} onChange={e => set("address_city", e.target.value)} className={inputCls} />
                <input placeholder="Country" value={form.address_country} onChange={e => set("address_country", e.target.value)} className={inputCls} />
              </div>
            </FormField>
            <FormField label="Notes" htmlFor="p-notes">
              <textarea id="p-notes" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} className={inputCls} />
            </FormField>
            <div className="flex gap-3 pt-2">
              <SaveButton saving={saving} label={modal === "new" ? "Create party" : "Save changes"} />
              <button type="button" onClick={() => setModal(null)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
