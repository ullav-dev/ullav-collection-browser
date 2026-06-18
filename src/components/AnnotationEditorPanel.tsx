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
  collectionId?: string;
}

interface Props {
  token: string;
  username: string;
  damApiBase: string;
  collectionId?: string;
}

export const ANNOTATION_PENDING_EVENT = "cartlann:annotation:pending";
export const ANNOTATION_SAVED_EVENT = "cartlann:annotation:saved";
export const ANNOTATION_ID_ASSIGNED_EVENT = "cartlann:annotation:id-assigned";
export const ANNOTATION_COMPLETE_EVENT = "cartlann:annotation:complete";

// Module-level body so adapter.create can read the latest value synchronously.
let _currentBody = "";
export function getCurrentAnnotationBody(): string { return _currentBody; }

export default function AnnotationEditorPanel({ token, username, damApiBase, collectionId }: Props) {
  const [body, setBody] = useState("");
  // Set when MAE has a real annotation ID (after drawing + save, or when editing existing).
  const [annotationId, setAnnotationId] = useState<string | undefined>(undefined);
  const [canvasId, setCanvasId] = useState("");
  const [pendingToken, setPendingToken] = useState(token);
  const [pendingCollectionId, setPendingCollectionId] = useState(collectionId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Keep module-level body in sync.
  useEffect(() => { _currentBody = body; }, [body]);

  // When MAE opens the annotation-creation companion window (or adapter.create fires),
  // populate the editor with existing body text (editing) or just update the IDs (new).
  useEffect(() => {
    function handlePending(e: Event) {
      const evt = e as CustomEvent<PendingAnnotation>;
      setAnnotationId(evt.detail.id);
      setCanvasId(evt.detail.canvasId);
      setPendingToken(evt.detail.token);
      setPendingCollectionId(evt.detail.collectionId);
      if (evt.detail.body) {
        setBody(evt.detail.body);
        _currentBody = evt.detail.body;
      }
      setError(null);
    }
    window.addEventListener(ANNOTATION_PENDING_EVENT, handlePending);
    return () => window.removeEventListener(ANNOTATION_PENDING_EVENT, handlePending);
  }, []);

  // Update annotation ID after adapter.create saves (without resetting body).
  useEffect(() => {
    function handleIdAssigned(e: Event) {
      const evt = e as CustomEvent<{ id?: string; canvasId: string; collectionId?: string }>;
      setAnnotationId(evt.detail.id);
      setCanvasId(evt.detail.canvasId);
      if (evt.detail.collectionId) setPendingCollectionId(evt.detail.collectionId);
    }
    window.addEventListener(ANNOTATION_ID_ASSIGNED_EVENT, handleIdAssigned);
    return () => window.removeEventListener(ANNOTATION_ID_ASSIGNED_EVENT, handleIdAssigned);
  }, []);

  // When adapter.create completes a save, flash "Saved" and clear for next annotation.
  useEffect(() => {
    function handleComplete() {
      setSavedFlash(true);
      setAnnotationId(undefined);
      setCanvasId("");
      setBody("");
      _currentBody = "";
      setTimeout(() => setSavedFlash(false), 2000);
    }
    window.addEventListener(ANNOTATION_COMPLETE_EVENT, handleComplete);
    return () => window.removeEventListener(ANNOTATION_COMPLETE_EVENT, handleComplete);
  }, []);

  const handleAssetPick = useCallback((asset: PickedAsset) => {
    const ref = `\n\n![${asset.name}](${damApiBase}/assets/${asset.id}/thumbnail)\n`;
    setBody((b) => b + ref);
    setPickerOpen(false);
  }, [damApiBase]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const noteId = annotationId ? annotationId.split("/").at(-1) : null;
      const url = noteId ? `/api/canvas-annotations/${noteId}` : `/api/canvas-annotations`;
      const method = noteId ? "PUT" : "POST";
      const annotation = {
        ...(annotationId ? { id: annotationId } : {}),
        type: "Annotation",
        motivation: "commenting",
        body: { type: "TextualBody", format: "text/markdown", value: body },
      };
      const bodyPayload = noteId
        ? { annotation }
        : { canvas_id: canvasId || "", annotation };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pendingToken}`,
      };
      const cid = collectionId ?? pendingCollectionId;
      if (cid) headers["X-Collection-Id"] = cid;

      const res = await fetch(url, { method, headers, body: JSON.stringify(bodyPayload) });
      if (!res.ok) throw new Error(await res.text());

      window.dispatchEvent(new CustomEvent(ANNOTATION_SAVED_EVENT, { detail: { canvasId } }));
      setSavedFlash(true);
      setAnnotationId(undefined);
      setCanvasId("");
      setBody("");
      _currentBody = "";
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
        <span className="text-xs font-semibold text-teal-400 uppercase tracking-wide">
          {annotationId ? "Edit annotation" : "New annotation"}
        </span>
        {annotationId && (
          <button
            type="button"
            onClick={() => { setAnnotationId(undefined); setCanvasId(""); setBody(""); _currentBody = ""; setError(null); }}
            className="text-slate-500 hover:text-slate-300 transition-colors text-xs"
            title="Clear"
          >
            Clear
          </button>
        )}
      </div>

      {/* Editor — always visible */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {savedFlash ? (
          <div className="flex items-center justify-center h-20 text-teal-400 text-sm font-medium">
            ✓ Saved
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              {annotationId
                ? "Editing — click Save annotation to update."
                : "Type your note, then draw a shape and click Save in the viewer."}
            </p>
            <MarkdownEditor value={body} onChange={setBody} minRows={6} dark />

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
          </>
        )}
      </div>

      {/* Save button */}
      {!savedFlash && (
        <div className="px-4 py-3 border-t border-slate-700 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !body.trim()}
            className="w-full text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save annotation"}
          </button>
        </div>
      )}

      {/* DAM Picker overlay */}
      {pickerOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wide">Select Comad asset</span>
            <button type="button" onClick={() => setPickerOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <DamPicker apiBase={damApiBase} token={token} username={username} onSelect={handleAssetPick} />
          </div>
        </div>
      )}
    </div>
  );
}
