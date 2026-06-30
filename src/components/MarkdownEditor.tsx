"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  dark?: boolean;
}

export default function MarkdownEditor({ value, onChange, placeholder, minRows = 12, dark = false }: Props) {
  const [preview, setPreview] = useState(false);

  const toolBtn = dark
    ? "w-7 h-7 flex items-center justify-center text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-600 rounded transition-colors"
    : "w-7 h-7 flex items-center justify-center text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors";

  return (
    <div
      className="flex flex-col border rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500"
      style={{ borderColor: dark ? "#475569" : "#cbd5e1" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between border-b px-3 py-1.5 gap-2"
        style={{ background: dark ? "#334155" : "#f8fafc", borderColor: dark ? "#475569" : "#e2e8f0" }}
      >
        <div className="flex items-center gap-1">
          <button type="button" title="Bold" onClick={() => wrap(value, onChange, "**", "**")} className={toolBtn}><strong>B</strong></button>
          <button type="button" title="Italic" onClick={() => wrap(value, onChange, "_", "_")} className={toolBtn}><em>I</em></button>
          <button type="button" title="Inline code" onClick={() => wrap(value, onChange, "`", "`")} className={toolBtn}><code className="text-xs">{"<>"}</code></button>
          <div className="w-px h-4 mx-1" style={{ background: dark ? "#475569" : "#e2e8f0" }} />
          <button type="button" title="Bullet list" onClick={() => prepend(value, onChange, "- ")} className={toolBtn}><ListIcon /></button>
          <button type="button" title="Heading" onClick={() => prepend(value, onChange, "## ")} className={toolBtn}>H</button>
          <button type="button" title="Blockquote" onClick={() => prepend(value, onChange, "> ")} className={toolBtn}>&#8220;</button>
          <div className="w-px h-4 mx-1" style={{ background: dark ? "#475569" : "#e2e8f0" }} />
          <button type="button" title="Link" onClick={() => insertLink(value, onChange)} className={toolBtn}>&#128279;</button>
        </div>
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
          style={
            preview
              ? { background: "#0d9488", color: "#fff" }
              : dark
                ? { color: "#94a3b8" }
                : { color: "#64748b" }
          }
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="px-3 py-3 prose prose-sm max-w-none overflow-y-auto text-sm"
          style={{
            minHeight: `${minRows * 1.5}rem`,
            background: dark ? "#1e293b" : "#fff",
            color: dark ? "#f1f5f9" : undefined,
          }}
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p style={{ color: dark ? "#64748b" : "#94a3b8", fontStyle: "italic" }}>Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Write in Markdown…"}
          className="w-full px-3 py-3 text-sm resize-y focus:outline-none"
          style={{
            minHeight: `${minRows * 1.5}rem`,
            background: dark ? "#1e293b" : "#fff",
            color: dark ? "#f1f5f9" : "#1e293b",
          }}
        />
      )}
    </div>
  );
}

// ── Rendered markdown (read-only) ─────────────────────────────────────────────

export function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-slate max-w-none text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function ListIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function wrap(value: string, onChange: (v: string) => void, before: string, after: string) {
  onChange(value + `${before}text${after}`);
}

function prepend(value: string, onChange: (v: string) => void, prefix: string) {
  const lines = value.split("\n");
  const last = lines[lines.length - 1];
  if (last === "") {
    onChange(value + prefix);
  } else {
    onChange(value + "\n" + prefix);
  }
}

function insertLink(value: string, onChange: (v: string) => void) {
  onChange(value + "[link text](https://)");
}
