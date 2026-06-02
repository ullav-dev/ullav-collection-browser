"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getObject,
  updateObject,
  assignAccession,
  listNumberSchemes,
  type CollectionObject,
  type NumberScheme,
  type UpdateObjectRequest,
} from "@/lib/collection-api";

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

const STATUSES = ["uncatalogued", "catalogued", "on_display", "in_storage", "on_loan", "missing", "deaccessioned"];
const DATE_PRECISIONS = ["exact", "circa", "after", "before", "century", "decade"];
const CONDITIONS = ["excellent", "good", "fair", "poor", "critical"];

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

export default function EditObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [object, setObject] = useState<CollectionObject | null>(null);
  const [schemes, setSchemes] = useState<NumberScheme[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assigningAccession, setAssigningAccession] = useState(false);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("");

  // Form state — initialised from object once loaded
  const [title, setTitle] = useState("");
  const [objectName, setObjectName] = useState("");
  const [objectType, setObjectType] = useState("");
  const [maker, setMaker] = useState("");
  const [description, setDescription] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePrecision, setDatePrecision] = useState("");
  const [materialsStr, setMaterialsStr] = useState("");
  const [currentCondition, setCurrentCondition] = useState("");
  const [rightsHolder, setRightsHolder] = useState("");
  const [copyrightStatus, setCopyrightStatus] = useState("");
  const [status, setStatus] = useState("uncatalogued");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    params.then(({ id }) => setId(id));
  }, [params]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [obj, schemesData] = await Promise.all([
        getObject(token, id),
        listNumberSchemes(token),
      ]);
      setObject(obj);
      setSchemes(schemesData);
      // Seed form state
      setTitle(obj.title);
      setObjectName(obj.object_name ?? "");
      setObjectType(obj.object_type ?? "");
      setMaker(obj.maker ?? "");
      setDescription(obj.brief_description ?? "");
      setDateFrom(obj.date_from != null ? String(obj.date_from) : "");
      setDateTo(obj.date_to != null ? String(obj.date_to) : "");
      setDatePrecision(obj.date_precision ?? "");
      setMaterialsStr(obj.materials.join(", "));
      setCurrentCondition(obj.current_condition ?? "");
      setRightsHolder(obj.rights_holder ?? "");
      setCopyrightStatus(obj.copyright_status ?? "");
      setStatus(obj.status);
      setIsPublic(obj.is_public);
      // Pre-select default scheme
      const def = schemesData.find((s) => s.is_default);
      if (def) setSelectedSchemeId(def.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load object");
    }
  }, [token, id]);

  useEffect(() => {
    if (token && id) load();
  }, [load, token, id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id) return;
    setSaveError(null);
    setSubmitting(true);
    try {
      const body: UpdateObjectRequest = {
        title,
        object_name: objectName || undefined,
        object_type: objectType || undefined,
        maker: maker || undefined,
        brief_description: description || undefined,
        date_from: dateFrom ? parseInt(dateFrom) : undefined,
        date_to: dateTo ? parseInt(dateTo) : undefined,
        date_precision: datePrecision || undefined,
        materials: materialsStr ? materialsStr.split(",").map((s) => s.trim()).filter(Boolean) : [],
        current_condition: currentCondition || undefined,
        rights_holder: rightsHolder || undefined,
        copyright_status: copyrightStatus || undefined,
        status,
        is_public: isPublic,
      };
      await updateObject(token, id, body);
      router.push(`/objects/${id}` as never);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignAccession() {
    if (!token || !id) return;
    setAssigningAccession(true);
    setSaveError(null);
    try {
      const result = await assignAccession(token, id, selectedSchemeId || undefined);
      // Reload object to show new accession number
      const updated = await getObject(token, id);
      setObject(updated);
      setSaveError(null);
      alert(`Accession number assigned: ${result.accession_number}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to assign accession number");
    } finally {
      setAssigningAccession(false);
    }
  }

  if (isLoading || !user) return null;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{loadError}</div>
      </div>
    );
  }

  if (!object) {
    return <div className="text-sm text-slate-400 py-16 text-center">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/objects" className="hover:text-teal-600 transition-colors">Collection</Link>
        <span>/</span>
        <Link href={`/objects/${id}` as never} className="hover:text-teal-600 transition-colors truncate max-w-[160px]">
          {object.title}
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">Edit</span>
      </div>

      <h1 className="text-xl font-bold text-slate-800 mb-6">Edit object</h1>

      {/* Accession number section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-slate-700 text-sm mb-3">Accession number</h2>
        {object.accession_number ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-semibold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
              {object.accession_number}
            </span>
            <span className="text-xs text-slate-400">
              {object.is_accessioned ? "Formally accessioned" : "Number assigned"}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">No accession number yet. Assign one automatically from a scheme:</p>
            <div className="flex items-center gap-3 flex-wrap">
              {schemes.length > 0 ? (
                <>
                  <select
                    value={selectedSchemeId}
                    onChange={(e) => setSelectedSchemeId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Select scheme…</option>
                    {schemes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.is_default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedSchemeId || assigningAccession}
                    onClick={handleAssignAccession}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {assigningAccession ? "Assigning…" : "Assign number"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  No number schemes configured.{" "}
                  <Link href="/settings" className="text-teal-600 hover:text-teal-700">
                    Set one up in Settings →
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{saveError}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <Field label="Title *" htmlFor="title">
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Object name" htmlFor="object-name">
            <input id="object-name" value={objectName} onChange={(e) => setObjectName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Object type" htmlFor="object-type">
            <input id="object-type" value={objectType} onChange={(e) => setObjectType(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Maker / artist" htmlFor="maker">
          <input id="maker" value={maker} onChange={(e) => setMaker(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Description" htmlFor="description">
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Date from" htmlFor="date-from" hint="Year">
            <input id="date-from" type="number" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date to" htmlFor="date-to" hint="Year (if range)">
            <input id="date-to" type="number" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date precision" htmlFor="date-precision">
            <select id="date-precision" value={datePrecision} onChange={(e) => setDatePrecision(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {DATE_PRECISIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Materials" htmlFor="materials" hint="Comma-separated">
          <input id="materials" value={materialsStr} onChange={(e) => setMaterialsStr(e.target.value)} className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Current condition" htmlFor="condition">
            <select id="condition" value={currentCondition} onChange={(e) => setCurrentCondition(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {CONDITIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Status" htmlFor="status">
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Rights holder" htmlFor="rights-holder">
          <input id="rights-holder" value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Copyright status" htmlFor="copyright-status">
          <input id="copyright-status" value={copyrightStatus} onChange={(e) => setCopyrightStatus(e.target.value)} className={inputCls} placeholder="e.g. In copyright, Public domain" />
        </Field>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-slate-700">Publish to public portal</span>
        </label>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={submitting || !title}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/objects/${id}` as never}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
