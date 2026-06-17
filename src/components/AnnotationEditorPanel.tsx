"use client";

import { useState, useEffect, useCallback } from "react";
import MarkdownEditor from "./MarkdownEditor";
import { DamPicker } from "@ullav-dev/dam-picker";
import type { PickedAsset } from "@ullav-dev/dam-picker";

export interface PendingAnnotation {
  id?: string;
  canvasId: string;
  body: string;
  token: string;
  username: string;
}

interface Props {
  token: string;
  username: string;
  damApiBase: string;
}

export const ANNOTATION_PENDING_EVENT = "cartlann:annotation:pending";
export const ANNOTATION_SAVED_EVENT = "cartlann:annotation:saved";

export default function AnnotationEditorPanel({ token, username, damApiBase }: Props) {
  const [pending, setPending] = useState<PendingAnnotation | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    function handlePending(e: Event) {
      const evt = e as CustomEvent<PendingAnnotation>;
      setPending(evt.detail);
      setBody(evt.detail.body ?? "");
      setError(null);
    }
    window.addEventListener(ANNOTATION_PENDING_EVENT, handlePending);
    return () => window.removeEventListener(ANNOTATION_PENDING_EVENT, handlePending);
  }, []);

  const handleAssetPick = useCallback((asset: PickedAsset) => {
    const ref = `\n\n![${asset.name}](${damApiBase}/assets/${asset.id}/thumbnail)\n`;
    setBody((b) => b + ref);
    setPickerOpen(false);
  }, [damApiBase]);

  async function handleSave() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      const noteId = pending.id ? pending.id.split("/").at(-1) : null;
      const url = noteId
        ? `/api/canvas-annotations/${noteId}`
        : `/api/canvas-annotations`;
      const method = noteId ? "PUT" : "POST";
      const bodyPayload = noteId
        ? { annotation: buildAnnotation(pending, body) }
        : { canvas_id: pending.canvasId, annotation: buildAnnotation(pending, body) };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pending.token}` },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) throw new Error(await res.text());

      window.dispatchEvent(new CustomEvent(ANNOTATION_SAVED_EVENT, { detail: { canvasId: pending.canvasId } }));
      setPending(null);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!pending) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-teal-900/40 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        <p className="text-sm text-slate-400">
          Draw a shape on the image to create an annotation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <span className="text-xs font-semibold text-teal-400 uppercase tracking-wide">
          {pending.id ? "Edit annotation" : "New annotation"}
        </span>
        <button
          type="button"
          onClick={() => { setPending(null); setBody(""); }}
          className="text-slate-400 hover:text-white transition-colors"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Markdown editor */}
        <div className="rounded-lg overflow-hidden border border-slate-600">
          <MarkdownEditor value={body} onChange={setBody} minRows={6} />
        </div>

        {/* DAM asset picker trigger */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 border border-teal-700 hover:border-teal-500 hover:bg-teal-900/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Attach Comad asset
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">{error}</p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-700">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save annotation"}
        </button>
      </div>

      {/* DAM Picker overlay */}
      {pickerOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wide">Select Comad asset</span>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <DamPicker
              apiBase={damApiBase}
              token={token}
              username={username}
              onSelect={handleAssetPick}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function buildAnnotation(pending: PendingAnnotation, body: string) {
  return {
    ...(pending.id ? { id: pending.id } : {}),
    type: "Annotation",
    motivation: "commenting",
    body: {
      type: "TextualBody",
      format: "text/markdown",
      value: body,
    },
  };
}
