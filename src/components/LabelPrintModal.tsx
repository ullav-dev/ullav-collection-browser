"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  generateLabelPDF,
  generatePreviewDataUrl,
  labelsPerPage,
  type LabelObject,
  type LabelType,
  type LabelSize,
  type LabelOptions,
} from "@/lib/label-generator";

interface Props {
  objects: LabelObject[];
  onClose: () => void;
}

const TYPE_OPTIONS: { value: LabelType; label: string; desc: string }[] = [
  { value: "qr",      label: "QR Code",      desc: "Scannable with any phone camera" },
  { value: "barcode", label: "Barcode",       desc: "Code 128, for handheld scanners" },
  { value: "both",    label: "QR + Barcode",  desc: "Both side by side (medium/large)" },
];

const SIZE_OPTIONS: { value: LabelSize; label: string; desc: string }[] = [
  { value: "small",  label: "Small (40×20mm)",  desc: "Barcode strip, up to 52/page" },
  { value: "medium", label: "Medium (70×37mm)", desc: "QR + title, up to 14/page" },
  { value: "large",  label: "Large (99×57mm)",  desc: "Full label, up to 4/page" },
];

export default function LabelPrintModal({ objects, onClose }: Props) {
  const [type, setType] = useState<LabelType>("medium" in {} ? "qr" : "qr");
  const [size, setSize] = useState<LabelSize>("medium");
  const [copies, setCopies] = useState(1);
  const [institutionName, setInstitutionName] = useState("Cartlann Collection");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always reset type state properly
  const [labelType, setLabelType] = useState<LabelType>("qr");

  const sampleObject = objects[0];
  const totalLabels = objects.length * copies;
  const perPage = labelsPerPage(size);
  const totalPages = Math.ceil(totalLabels / perPage);

  const refreshPreview = useCallback(async () => {
    if (!sampleObject) return;
    setPreviewLoading(true);
    try {
      const url = await generatePreviewDataUrl(sampleObject, { type: labelType, size });
      setPreviewUrl(url);
    } catch (e) {
      // preview failure is non-critical
      console.error("Preview generation failed:", e);
    } finally {
      setPreviewLoading(false);
    }
  }, [sampleObject, labelType, size]);

  // Debounced preview refresh
  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(refreshPreview, 300);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [refreshPreview]);

  async function handleDownload() {
    setGenerating(true);
    setError(null);
    try {
      const options: LabelOptions = {
        type: labelType,
        size,
        copies,
        institutionName,
      };
      const blob = await generateLabelPDF(objects, options);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartlann-labels-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">Print Labels</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {objects.length} object{objects.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Left column — options */}
            <div className="space-y-4">
              {/* Label type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Label type</label>
                <div className="space-y-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="label-type"
                        value={opt.value}
                        checked={labelType === opt.value}
                        onChange={() => setLabelType(opt.value)}
                        className="mt-0.5 text-teal-600 focus:ring-teal-500"
                      />
                      <span>
                        <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                        <span className="block text-xs text-slate-400">{opt.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Label size */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Label size</label>
                <div className="space-y-2">
                  {SIZE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="label-size"
                        value={opt.value}
                        checked={size === opt.value}
                        onChange={() => setSize(opt.value)}
                        className="mt-0.5 text-teal-600 focus:ring-teal-500"
                      />
                      <span>
                        <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                        <span className="block text-xs text-slate-400">{opt.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Copies */}
              <div>
                <label htmlFor="copies" className="block text-sm font-medium text-slate-700 mb-1">
                  Copies per object
                </label>
                <input
                  id="copies"
                  type="number"
                  min={1}
                  max={20}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-24 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Institution name */}
              <div>
                <label htmlFor="institution" className="block text-sm font-medium text-slate-700 mb-1">
                  Institution name (footer)
                </label>
                <input
                  id="institution"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Your collection name"
                />
              </div>
            </div>

            {/* Right column — preview + summary */}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Preview</p>
                <div className="border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center min-h-[160px] overflow-hidden">
                  {previewLoading ? (
                    <p className="text-xs text-slate-400">Generating preview…</p>
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Label preview"
                      className="max-w-full max-h-[220px] object-contain"
                    />
                  ) : (
                    <p className="text-xs text-slate-400">Preview loading…</p>
                  )}
                </div>
                {sampleObject && !sampleObject.accession_number && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    This object has no accession number — using object ID as fallback.
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="rounded-xl bg-teal-50 border border-teal-100 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Objects selected</span>
                  <span className="font-medium">{objects.length}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Copies per object</span>
                  <span className="font-medium">{copies}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total labels</span>
                  <span className="font-medium">{totalLabels}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Labels per page</span>
                  <span className="font-medium">{perPage}</span>
                </div>
                <div className="flex justify-between font-semibold text-teal-700 pt-1 border-t border-teal-200">
                  <span>Pages</span>
                  <span>{totalPages}</span>
                </div>
              </div>

              {/* Objects without accession numbers warning */}
              {objects.some((o) => !o.accession_number) && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-xs text-amber-700 font-medium mb-0.5">
                    {objects.filter((o) => !o.accession_number).length} object{objects.filter((o) => !o.accession_number).length !== 1 ? "s" : ""} without accession numbers
                  </p>
                  <p className="text-xs text-amber-600">
                    Their labels will use the object ID as a fallback. Consider assigning accession numbers first.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            PDF sized for A4 · {labelsPerPage(size)} labels/page
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={generating || objects.length === 0}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
