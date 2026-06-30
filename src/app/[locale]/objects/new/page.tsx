"use client";

import { useState, useEffect } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createObject, setObjectPrimaryAsset, type CreateObjectRequest } from "@/lib/collection-api";
import dynamic from "next/dynamic";
import type { PickedAsset } from "@ullav-dev/dam-picker";

const DamPickerModal = dynamic(() => import("@/components/DamPickerModal"), { ssr: false });

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

const STATUSES = ["uncatalogued", "catalogued", "on_display", "in_storage"];
const DATE_PRECISIONS = ["exact", "circa", "after", "before", "century", "decade"];

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

export default function NewObjectPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedAsset, setPickedAsset] = useState<PickedAsset | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Form state
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
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: CreateObjectRequest = {
        title,
        object_name: objectName || undefined,
        object_type: objectType || undefined,
        maker: maker || undefined,
        brief_description: description || undefined,
        date_from: dateFrom ? parseInt(dateFrom) : undefined,
        date_to: dateTo ? parseInt(dateTo) : undefined,
        date_precision: datePrecision || undefined,
        materials: materialsStr ? materialsStr.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        current_condition: currentCondition || undefined,
        rights_holder: rightsHolder || undefined,
        is_public: isPublic,
      };
      const obj = await createObject(token, body);
      if (pickedAsset) {
        await setObjectPrimaryAsset(token, obj.id, {
          asset_id: pickedAsset.id,
          asset_name: pickedAsset.name,
          asset_type: pickedAsset.assetType,
        });
      }
      router.push(`/objects/${obj.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create object");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/objects" className="hover:text-teal-600 transition-colors">Collection</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">New object</span>
      </div>

      <h1 className="text-xl font-bold text-slate-800 mb-6">Add object to collection</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Primary image — first step ──────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Primary image</p>

          {pickedAsset ? (
            <div className="flex items-start gap-4">
              <img
                src={pickedAsset.thumbnailUrl}
                alt={pickedAsset.name}
                className="w-24 h-24 object-cover rounded-lg border border-slate-200 bg-white shadow-sm shrink-0"
              />
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-sm text-slate-700 font-medium truncate">{pickedAsset.name}</p>
                <p className="text-xs text-slate-400">{pickedAsset.assetType}</p>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    <ImageIcon />
                    Change image
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickedAsset(null)}
                    className="text-sm text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 hover:border-teal-400 hover:bg-teal-50 transition-colors text-slate-500 hover:text-teal-600 cursor-pointer"
            >
              <ImageIcon className="w-8 h-8" />
              <span className="text-sm font-medium">Browse Comad media library…</span>
              <span className="text-xs text-slate-400">Select an image to use as the primary photo</span>
            </button>
          )}
        </div>

        {/* ── Core fields ─────────────────────────────────────────────────────── */}
        <Field label="Title *" htmlFor="title">
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Object name" htmlFor="object-name" hint="Spectrum object type, e.g. 'Painting'">
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
            <input id="date-from" type="number" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} placeholder="e.g. 1850" />
          </Field>
          <Field label="Date to" htmlFor="date-to" hint="Year (if range)">
            <input id="date-to" type="number" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} placeholder="e.g. 1860" />
          </Field>
          <Field label="Date precision" htmlFor="date-precision">
            <select id="date-precision" value={datePrecision} onChange={(e) => setDatePrecision(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {DATE_PRECISIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Materials" htmlFor="materials" hint="Comma-separated, e.g. oil paint, canvas, wood">
          <input id="materials" value={materialsStr} onChange={(e) => setMaterialsStr(e.target.value)} className={inputCls} placeholder="oil paint, canvas" />
        </Field>

        <Field label="Current condition" htmlFor="condition">
          <select id="condition" value={currentCondition} onChange={(e) => setCurrentCondition(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {["excellent", "good", "fair", "poor", "critical"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>

        <Field label="Rights holder" htmlFor="rights-holder">
          <input id="rights-holder" value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} className={inputCls} />
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !title}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {submitting ? "Saving…" : "Add object"}
          </button>
          <Link
            href="/objects"
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      {pickerOpen && token && (
        <DamPickerModal
          token={token}
          username={user.username}
          onSelect={(asset) => {
            setPickedAsset(asset);
            if (!title) setTitle(asset.name);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function ImageIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 5.5 2-3.5 3 6z" clipRule="evenodd" />
    </svg>
  );
}
