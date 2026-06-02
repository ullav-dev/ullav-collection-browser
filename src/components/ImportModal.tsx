"use client";

import { useState, useRef, useCallback } from "react";
import { parseCsv, type ParsedImportRow } from "@/lib/export";
import { createObject } from "@/lib/collection-api";
import Modal from "@/components/Modal";

interface Props {
  token: string;
  onClose: () => void;
  onComplete: (count: number) => void;
}

type Stage = "upload" | "preview" | "importing" | "done";

export default function ImportModal({ token, onClose, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [created, setCreated] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setParseErrors(["Please upload a .csv file."]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCsv(text);
      setRows(result.rows);
      setParseErrors(result.errors);
      setStage("preview");
    };
    reader.readAsText(file);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function runImport() {
    setStage("importing");
    setProgress(0);
    const errors: string[] = [];
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await createObject(token, {
          title: row.title,
          object_name: row.object_name,
          object_type: row.object_type,
          maker: row.maker,
          date_from: row.date_from,
          date_to: row.date_to,
          date_precision: row.date_precision,
          materials: row.materials,
          brief_description: row.brief_description,
          current_condition: row.current_condition,
          rights_holder: row.rights_holder,
          copyright_status: row.copyright_status,
          is_public: row.is_public,
        });
        count++;
      } catch (e) {
        errors.push(`Row ${i + 2} (${row.title}): ${e instanceof Error ? e.message : "failed"}`);
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    setCreated(count);
    setImportErrors(errors);
    setStage("done");
    if (count > 0) onComplete(count);
  }

  return (
    <Modal title="Import objects from CSV" onClose={onClose} width="lg">
      {stage === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload a CSV file to import objects. The file should have a header row with field names.
            Required column: <code className="bg-slate-100 px-1 rounded text-xs">title</code>.
          </p>
          <p className="text-sm text-slate-500">
            Accepted columns:{" "}
            <span className="font-mono text-xs">
              accession_number, title, object_name, object_type, maker, date_from, date_to,
              date_precision, materials (semicolon-separated), brief_description, current_condition,
              rights_holder, copyright_status, status, is_public
            </span>
          </p>

          {parseErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
              {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-teal-400 bg-teal-50" : "border-slate-300 hover:border-teal-400 hover:bg-teal-50/40"}`}
          >
            <svg className="w-8 h-8 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm font-medium text-slate-600">Drop CSV here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">.csv files only</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-700">
              {rows.length} object{rows.length !== 1 ? "s" : ""} ready to import
            </span>
            {parseErrors.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                {parseErrors.length} row{parseErrors.length !== 1 ? "s" : ""} skipped
              </span>
            )}
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 space-y-0.5">
              {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {rows.length > 0 && (
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Title</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Accession #</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Maker</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-700 font-medium">{row.title}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{row.accession_number ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{row.maker ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{row.date_from ?? "—"}</td>
                    </tr>
                  ))}
                  {rows.length > 20 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-slate-400 text-center">
                        …and {rows.length - 20} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={runImport}
              disabled={rows.length === 0}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              Import {rows.length} object{rows.length !== 1 ? "s" : ""}
            </button>
            <button onClick={() => { setStage("upload"); setRows([]); setParseErrors([]); }} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg">
              Choose different file
            </button>
          </div>
        </div>
      )}

      {stage === "importing" && (
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">Importing objects… {progress}%</p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-700">
              ✓ {created} object{created !== 1 ? "s" : ""} imported
            </span>
            {importErrors.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-600">
                {importErrors.length} failed
              </span>
            )}
          </div>
          {importErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 space-y-0.5">
              {importErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <button onClick={onClose} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
