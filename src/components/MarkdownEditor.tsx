"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}

export default function MarkdownEditor({ value, onChange, placeholder, minRows = 12 }: Props) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="flex flex-col border border-slate-300 rounded-lg overflow-hidden focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-3 py-1.5 gap-2">
        <div className="flex items-center gap-1">
          <ToolButton title="Bold" onClick={() => wrap(value, onChange, "**", "**")}>
            <strong>B</strong>
          </ToolButton>
          <ToolButton title="Italic" onClick={() => wrap(value, onChange, "_", "_")}>
            <em>I</em>
          </ToolButton>
          <ToolButton title="Inline code" onClick={() => wrap(value, onChange, "`", "`")}>
            <code className="text-xs">{"<>"}</code>
          </ToolButton>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <ToolButton title="Bullet list" onClick={() => prepend(value, onChange, "- ")}>
            <ListIcon />
          </ToolButton>
          <ToolButton title="Heading" onClick={() => prepend(value, onChange, "## ")}>
            H
          </ToolButton>
          <ToolButton title="Blockquote" onClick={() => prepend(value, onChange, "> ")}>
            &#8220;
          </ToolButton>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <ToolButton title="Link" onClick={() => insertLink(value, onChange)}>
            &#128279;
          </ToolButton>
        </div>
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
            preview
              ? "bg-teal-600 text-white"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
          }`}
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="px-3 py-3 min-h-[180px] prose prose-sm prose-slate max-w-none overflow-y-auto text-sm"
          style={{ minHeight: `${minRows * 1.5}rem` }}
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-slate-400 italic">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Write in Markdown…"}
          className="w-full px-3 py-3 text-sm text-slate-800 bg-white resize-y focus:outline-none"
          style={{ minHeight: `${minRows * 1.5}rem` }}
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

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
    >
      {children}
    </button>
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
