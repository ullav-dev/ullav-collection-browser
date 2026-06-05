"use client";

import { useEffect, useState } from "react";
import {
  listNoteReplies,
  createNoteReply,
  type ResearchNote,
} from "@/lib/collection-api";
import { MarkdownBody } from "@/components/MarkdownEditor";

interface Props {
  note: ResearchNote;
  token: string;
  currentUserId: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NoteThread({ note, token, currentUserId }: Props) {
  const [replies, setReplies] = useState<ResearchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listNoteReplies(token, note.id)
      .then((r) => { if (!cancelled) setReplies(r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, note.id]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const reply = await createNoteReply(token, note.id, replyBody.trim());
      setReplies((prev) => [...prev, reply]);
      setReplyBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add reply");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-xs text-slate-400 py-3">Loading replies…</div>;

  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {replies.length === 0 ? "No replies yet" : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
      </h4>

      <div className="space-y-4 mb-4">
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-slate-500">
                {reply.user_id === currentUserId ? "Me" : "?"}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-medium text-slate-600">
                  {reply.user_id === currentUserId ? "You" : "Colleague"}
                </span>
                <span className="text-[11px] text-slate-400">{relativeTime(reply.created_at)}</span>
              </div>
              <div className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                {reply.body ? (
                  <MarkdownBody content={reply.body} />
                ) : (
                  <span className="text-slate-400 italic">Empty reply</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <form onSubmit={handleReply} className="flex gap-2">
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder="Add a reply (Markdown supported)…"
          rows={2}
          className="flex-1 text-sm rounded-lg border border-slate-300 px-3 py-2 resize-none focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        <button
          type="submit"
          disabled={saving || !replyBody.trim()}
          className="self-end bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? "…" : "Reply"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
