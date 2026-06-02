"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getObject,
  getObjectMovements,
  getObjectParts,
  listConditionChecks,
  listTreatments,
  listObjectLoans,
  type CollectionObject,
  type ObjectMovement,
  type ObjectPart,
  type ConditionCheck,
  type ConservationTreatment,
  type Loan,
} from "@/lib/collection-api";
import dynamic from "next/dynamic";

const LabelPrintModal = dynamic(() => import("@/components/LabelPrintModal"), { ssr: false });

type Tab = "details" | "condition" | "conservation" | "loans" | "movements" | "parts";

const GRADE_COLOUR: Record<string, string> = {
  excellent: "bg-teal-100 text-teal-700",
  good: "bg-green-100 text-green-700",
  fair: "bg-amber-100 text-amber-700",
  poor: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const LOAN_STATUS_COLOUR: Record<string, string> = {
  active: "bg-amber-100 text-amber-700",
  returned: "bg-teal-100 text-teal-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function Badge({ label, colour }: { label: string; colour?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colour ?? "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

function SectionEmpty({ message }: { message: string }) {
  return <p className="text-sm text-slate-400 py-6 text-center">{message}</p>;
}

export default function ObjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("details");

  const [object, setObject] = useState<CollectionObject | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [movements, setMovements] = useState<ObjectMovement[]>([]);
  const [parts, setParts] = useState<ObjectPart[]>([]);
  const [conditionChecks, setConditionChecks] = useState<ConditionCheck[]>([]);
  const [treatments, setTreatments] = useState<ConservationTreatment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => setId(id));
  }, [params]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [obj, movs, pts, checks, treats, lns] = await Promise.all([
        getObject(token, id),
        getObjectMovements(token, id),
        getObjectParts(token, id),
        listConditionChecks(token, id),
        listTreatments(token, id),
        listObjectLoans(token, id),
      ]);
      setObject(obj);
      setMovements(movs);
      setParts(pts);
      setConditionChecks(checks);
      setTreatments(treats);
      setLoans(lns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load object");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    if (token && id) load();
  }, [load, token, id]);

  if (isLoading || !user) return null;

  if (loading) {
    return <div className="text-sm text-slate-400 py-16 text-center">Loading…</div>;
  }

  if (error || !object) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
          {error ?? "Object not found"}
        </div>
        <Link href="/objects" className="mt-4 inline-block text-sm text-teal-600 hover:text-teal-700">
          ← Back to collection
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "details", label: "Details" },
    { key: "condition", label: "Condition", count: conditionChecks.length },
    { key: "conservation", label: "Conservation", count: treatments.length },
    { key: "loans", label: "Loans", count: loans.length },
    { key: "movements", label: "Movements", count: movements.length },
    { key: "parts", label: "Parts", count: parts.length },
  ];

  const dateLabel = object.date_from != null
    ? (object.date_to && object.date_to !== object.date_from
        ? `${object.date_from}–${object.date_to}`
        : String(object.date_from))
    : null;

  return (
    <>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/objects" className="hover:text-teal-600 transition-colors">Collection</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium truncate">{object.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-slate-800">{object.title}</h1>
            <Badge
              label={object.status.replace("_", " ")}
              colour={object.status === "on_loan" ? "bg-amber-100 text-amber-700" : undefined}
            />
            {object.is_accessioned && (
              <Badge label="Accessioned" colour="bg-teal-600 text-white" />
            )}
            {object.is_public && (
              <Badge label="Public" colour="bg-teal-100 text-teal-700" />
            )}
          </div>
          {object.accession_number && (
            <p className="font-mono text-sm text-slate-400">{object.accession_number}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            title="Print label"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75z" />
            </svg>
            Label
          </button>
          <Link
            href={`/objects/${object.id}/edit` as never}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-slate-200 overflow-x-auto">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              tab === key
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

        {tab === "details" && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <DetailRow label="Object name" value={object.object_name} />
            <DetailRow label="Object type" value={object.object_type} />
            <DetailRow label="Maker" value={object.maker} />
            <DetailRow label="Date" value={dateLabel ? `${object.date_precision ? object.date_precision + " " : ""}${dateLabel}` : null} />
            <DetailRow label="Materials" value={object.materials.length > 0 ? object.materials.join(", ") : null} />
            <DetailRow label="Current condition" value={object.current_condition} />
            <DetailRow label="Rights holder" value={object.rights_holder} />
            <DetailRow label="Copyright status" value={object.copyright_status} />
            {object.brief_description && (
              <div className="col-span-full">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</dt>
                <dd className="text-slate-700 leading-relaxed">{object.brief_description}</dd>
              </div>
            )}
            {object.dimensions && (
              <div className="col-span-full">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Dimensions</dt>
                <dd className="font-mono text-xs text-slate-600 bg-slate-50 rounded p-2">
                  {JSON.stringify(object.dimensions, null, 2)}
                </dd>
              </div>
            )}
          </dl>
        )}

        {tab === "condition" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700 text-sm">Condition History</h2>
            </div>
            {conditionChecks.length === 0 ? (
              <SectionEmpty message="No condition checks recorded." />
            ) : (
              <div className="space-y-3">
                {conditionChecks.map((c) => (
                  <div key={c.id} className="border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge label={c.condition_grade} colour={GRADE_COLOUR[c.condition_grade]} />
                      <span className="text-sm text-slate-500">{new Date(c.check_date).toLocaleDateString()}</span>
                      {c.next_check_date && (
                        <span className="text-xs text-slate-400">Next: {new Date(c.next_check_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    {c.notes && <p className="text-sm text-slate-600 mt-1">{c.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "conservation" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700 text-sm">Conservation Treatments</h2>
            </div>
            {treatments.length === 0 ? (
              <SectionEmpty message="No conservation treatments recorded." />
            ) : (
              <div className="space-y-3">
                {treatments.map((t) => (
                  <div key={t.id} className="border border-slate-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="font-medium text-slate-700 text-sm capitalize">{t.treatment_type}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(t.start_date).toLocaleDateString()}
                        {t.end_date ? ` → ${new Date(t.end_date).toLocaleDateString()}` : " (ongoing)"}
                      </span>
                    </div>
                    {t.description && <p className="text-sm text-slate-600 mt-1">{t.description}</p>}
                    {t.outcome && <p className="text-sm text-teal-700 mt-1 font-medium">{t.outcome}</p>}
                    {t.cost != null && (
                      <p className="text-xs text-slate-400 mt-1">
                        {t.currency} {t.cost.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "loans" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700 text-sm">Loan History</h2>
            </div>
            {loans.length === 0 ? (
              <SectionEmpty message="No loans recorded." />
            ) : (
              <div className="space-y-3">
                {loans.map((l) => (
                  <div key={l.id} className="border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge label={l.loan_type === "loan_out" ? "Loan out" : "Loan in"} colour="bg-slate-100 text-slate-600" />
                      <Badge label={l.status} colour={LOAN_STATUS_COLOUR[l.status]} />
                      <span className="text-sm text-slate-500">
                        {new Date(l.start_date).toLocaleDateString()}
                        {l.expected_end_date ? ` → ${new Date(l.expected_end_date).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    {l.venue && <p className="text-sm text-slate-600 mt-1">{l.venue}</p>}
                    {l.purpose && <p className="text-sm text-slate-500 mt-0.5">{l.purpose}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "movements" && (
          <>
            <h2 className="font-semibold text-slate-700 text-sm mb-4">Movement History</h2>
            {movements.length === 0 ? (
              <SectionEmpty message="No movements recorded." />
            ) : (
              <div className="space-y-2">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 text-sm py-2 border-b border-slate-50 last:border-0">
                    <span className="text-slate-400 text-xs mt-0.5 shrink-0">{new Date(m.moved_at).toLocaleDateString()}</span>
                    <span className="text-slate-600">
                      {m.from_location_id ? `${m.from_location_id.slice(0, 8)}…` : "Unknown"} → {m.to_location_id.slice(0, 8)}…
                    </span>
                    {m.reason && <span className="text-slate-400 text-xs">{m.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "parts" && (
          <>
            <h2 className="font-semibold text-slate-700 text-sm mb-4">Object Parts</h2>
            {parts.length === 0 ? (
              <SectionEmpty message="No parts defined." />
            ) : (
              <div className="space-y-2">
                {parts.map((p) => (
                  <div key={p.id} className="flex items-start gap-4 py-2 border-b border-slate-50 last:border-0 text-sm">
                    <span className="font-mono text-slate-500 shrink-0">{p.part_number}</span>
                    <span className="text-slate-700">{p.description}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {showPrintModal && object && (
      <LabelPrintModal
        objects={[{ id: object.id, title: object.title, accession_number: object.accession_number, object_name: object.object_name }]}
        onClose={() => setShowPrintModal(false)}
      />
    )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-slate-700">{value ?? <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}
