"use client";

import { useState, useRef, useCallback } from "react";
import {
  previewLidoImport,
  importLido,
  type LidoPreviewRecord,
  type LidoImportError,
} from "@/lib/collection-api";
import Modal from "@/components/Modal";

interface Props {
  token: string;
  onClose: () => void;
  onComplete: () => void;
}

type Stage = "upload" | "previewing" | "preview" | "importing" | "done";

const STATUSES = [
  "on display",
  "in storage",
  "on loan",
  "uncatalogued",
  "catalogued",
  "missing",
];

function dateRange(rec: LidoPreviewRecord): string {
  if (rec.date_from == null) return "—";
  const prec = rec.date_precision ? `${rec.date_precision} ` : "";
  if (rec.date_to && rec.date_to !== rec.date_from) {
    return `${prec}${rec.date_from}–${rec.date_to}`;
  }
  return `${prec}${rec.date_from}`;
}

export default function LidoImportModal({ token, onClose, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<LidoPreviewRecord[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");
  const [importStatus, setImportStatus] = useState("on display");
  const [importErrors, setImportErrors] = useState<LidoImportError[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (f: File) => {
      if (!f.name.toLowerCase().endsWith(".xml")) {
        setPreviewError("Please upload a .xml LIDO file.");
        return;
      }
      setFile(f);
      setPreviewError(null);
      setStage("previewing");
      try {
        const recs = await previewLidoImport(token, f);
        setRecords(recs);
        setStage("preview");
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
        setStage("upload");
      }
    },
    [token]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function runImport() {
    if (!file) return;
    setStage("importing");
    try {
      const res = await importLido(token, file, { on_duplicate: onDuplicate, status: importStatus });
      setResult({ created: res.created, updated: res.updated, skipped: res.skipped });
      setImportErrors(res.errors);
      setStage("done");
    } catch (err) {
      setImportErrors([
        { index: 0, lido_record_id: null, title: null, message: err instanceof Error ? err.message : "Import failed" },
      ]);
      setStage("done");
    }
  }

  const title =
    stage === "upload" || stage === "previewing"
      ? "Import LIDO XML"
      : stage === "preview"
      ? `Preview — ${records.length} record${records.length !== 1 ? "s" : ""}`
      : stage === "importing"
      ? "Importing…"
      : "Import complete";

  return (
    <Modal title={title} onClose={onClose} width="lg">
      {/* Upload stage */}
      {(stage === "upload" || stage === "previewing") && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragOver ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-teal-300 hover:bg-teal-50/30"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {stage === "previewing" ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-teal-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-500">Parsing LIDO file…</p>
              </div>
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Drop a LIDO XML file here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse — .xml, max 20 MB</p>
              </>
            )}
          </div>
          {previewError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
              {previewError}
            </div>
          )}
        </div>
      )}

      {/* Preview stage */}
      {stage === "preview" && (
        <div className="space-y-5">
          {/* Import options */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">On duplicate:</label>
              <select
                value={onDuplicate}
                onChange={(e) => setOnDuplicate(e.target.value as "skip" | "update")}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="skip">Skip existing</option>
                <option value="update">Update existing</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Default status:</label>
              <select
                value={importStatus}
                onChange={(e) => setImportStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">#</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 hidden sm:table-cell">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 hidden sm:table-cell">Maker</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 hidden md:table-cell">Materials</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Warn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.slice(0, 100).map((rec) => (
                  <tr key={rec.index} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400 font-mono">{rec.index + 1}</td>
                    <td className="px-3 py-2 text-slate-800 max-w-[180px] truncate" title={rec.title}>
                      {rec.title}
                    </td>
                    <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">
                      {rec.object_name ?? rec.object_type ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">
                      {rec.maker ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{dateRange(rec)}</td>
                    <td className="px-3 py-2 text-slate-500 hidden md:table-cell">
                      {rec.materials.length > 0 ? rec.materials.slice(0, 2).join(", ") + (rec.materials.length > 2 ? "…" : "") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {rec.warnings.length > 0 && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 cursor-default"
                          title={rec.warnings.join(" | ")}
                        >
                          {rec.warnings.length}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length > 100 && (
              <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                Showing first 100 of {records.length} records
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runImport}
              className="px-5 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              Import {records.length} record{records.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Importing spinner */}
      {stage === "importing" && (
        <div className="py-12 flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-teal-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-500">Importing records…</p>
        </div>
      )}

      {/* Done */}
      {stage === "done" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            {result && (
              <>
                <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                  <span className="text-2xl font-bold text-teal-700">{result.created}</span>
                  <span className="text-sm text-teal-600">created</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <span className="text-2xl font-bold text-blue-700">{result.updated}</span>
                  <span className="text-sm text-blue-600">updated</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <span className="text-2xl font-bold text-slate-600">{result.skipped}</span>
                  <span className="text-sm text-slate-500">skipped</span>
                </div>
              </>
            )}
            {importErrors.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-2xl font-bold text-red-600">{importErrors.length}</span>
                <span className="text-sm text-red-500">error{importErrors.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {importErrors.length > 0 && (
            <div className="rounded-xl border border-red-200 overflow-hidden max-h-48 overflow-y-auto">
              {importErrors.map((err) => (
                <div key={err.index} className="px-4 py-2.5 text-xs border-b border-red-100 last:border-0 bg-red-50">
                  <span className="font-medium text-red-700">#{err.index + 1} {err.title ?? "(no title)"}</span>
                  <span className="text-red-500 ml-2">{err.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => { onComplete(); }}
              className="px-5 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
