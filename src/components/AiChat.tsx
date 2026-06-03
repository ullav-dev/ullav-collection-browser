"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import {
  listChatSessions, createChatSession, deleteChatSession,
  listSessionMessages, appendSessionMessage,
  type CollectionObject, type ChatSession,
} from "@/lib/collection-api";

// ── Context formatting ────────────────────────────────────────────────────────

function formatObjectContext(obj: CollectionObject): string {
  const lines = [`Object: ${obj.title}`];
  if (obj.accession_number) lines.push(`Accession number: ${obj.accession_number}`);
  if (obj.object_type) lines.push(`Object type: ${obj.object_type}`);
  if (obj.object_name) lines.push(`Object name: ${obj.object_name}`);
  if (obj.maker) lines.push(`Maker / artist: ${obj.maker}`);
  const dates = [obj.date_from, obj.date_to].filter(Boolean);
  if (dates.length) {
    const dateStr = dates.length === 2 && obj.date_from !== obj.date_to
      ? `${obj.date_from}–${obj.date_to}`
      : String(obj.date_from);
    lines.push(`Date: ${obj.date_precision ? `${obj.date_precision} ` : ""}${dateStr}`);
  }
  if (obj.materials?.length) lines.push(`Materials: ${obj.materials.join(", ")}`);
  if (obj.brief_description) {
    const desc = obj.brief_description.length > 500
      ? obj.brief_description.slice(0, 500) + "…"
      : obj.brief_description;
    lines.push(`Description: ${desc}`);
  }
  if (obj.current_condition) lines.push(`Condition: ${obj.current_condition}`);
  if (obj.status) lines.push(`Status: ${obj.status.replace(/_/g, " ")}`);
  return lines.join("\n");
}

function formatCollectionContext(objects: CollectionObject[]): string {
  const MAX = 30;
  const shown = objects.slice(0, MAX);
  const lines = [`Collection overview (${objects.length} objects):`];
  for (const o of shown) {
    const dates = o.date_from != null
      ? o.date_to && o.date_to !== o.date_from ? `${o.date_from}–${o.date_to}` : String(o.date_from)
      : "";
    const parts = [o.object_type, o.maker, dates].filter(Boolean).join(", ");
    lines.push(`- ${o.title}${parts ? ` (${parts})` : ""}`);
  }
  if (objects.length > MAX) lines.push(`…and ${objects.length - MAX} more objects`);
  return lines.join("\n");
}

function getTextFromMessage(msg: UIMessage): string {
  return msg.parts.filter(isTextUIPart).map((p) => p.text).join("");
}

// ── Prompt templates ──────────────────────────────────────────────────────────

interface TemplateCategory {
  key: string;
  icon: string;
  prompts: string[];
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    key: "Provenance",
    icon: "📜",
    prompts: [
      "What records could establish pre-war ownership of this type of object?",
      "Identify potential provenance gaps and how to investigate them",
      "What are the main provenance databases I should check (Art Loss Register, etc.)?",
      "How do I verify a provenance claim and what constitutes due diligence?",
      "What auction archive sources document sales in the early 20th century?",
    ],
  },
  {
    key: "Attribution",
    icon: "🎨",
    prompts: [
      "What stylistic or technical features help date and attribute this type of object?",
      "How do I research an unsigned or unattributed work?",
      "What auction records exist for works attributed to this type of maker?",
      "What technical analysis methods are used for authentication?",
      "Which authority files (ULAN, RKD, BnF) should I check for maker information?",
    ],
  },
  {
    key: "Materials",
    icon: "🔬",
    prompts: [
      "What conservation considerations apply to this material?",
      "How is this technique typically identified and documented in cataloguing?",
      "What are common signs of restoration or later additions in this type of object?",
      "What Getty AAT terms are appropriate for these materials and techniques?",
    ],
  },
  {
    key: "Documentation",
    icon: "📋",
    prompts: [
      "Draft a Spectrum-compliant catalogue entry for this object",
      "What fields should a thorough catalogue record for this object type include?",
      "How should I document uncertain attribution or date in a catalogue entry?",
      "What controlled vocabulary terms (Getty AAT) best describe this object?",
    ],
  },
  {
    key: "Research",
    icon: "🧭",
    prompts: [
      "What archives or databases should I search for this type of object?",
      "How do I trace an object through auction records and exhibition histories?",
      "What records survive for objects from this period and region?",
      "How do I find out where this type of object was typically made or traded?",
    ],
  },
  {
    key: "Legal",
    icon: "⚖️",
    prompts: [
      "What cultural property laws apply to this type of object?",
      "What due diligence is required before acquiring this type of object?",
      "How do I check if an object appears on international stolen-art registries?",
      "What restitution frameworks apply to objects acquired between 1933 and 1945?",
    ],
  },
];

const OBJECT_TEMPLATE_PROMPTS = [
  "Summarise the known provenance of {objectTitle} and identify any gaps",
  "What records should I search to verify the attribution of {objectTitle}?",
  "Research the maker or artist associated with {objectTitle}",
  "Draft catalogue notes for {objectTitle} based on the details provided",
  "What ethical or legal considerations apply to {objectTitle}?",
];

// ── Main component ────────────────────────────────────────────────────────────

export interface AiChatProps {
  token: string;
  contextObject?: CollectionObject | null;
  allObjects?: CollectionObject[];
  noteContext?: { title: string; body: string } | null;
  onSaveAsNote: (title: string, description: string, body: string) => void;
}

export default function AiChat({
  token, contextObject, allObjects, noteContext, onSaveAsNote,
}: AiChatProps) {
  const locale = useLocale();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Settings check
  const [hasSettings, setHasSettings] = useState<boolean | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Collection context toggle
  const [collectionEnabled, setCollectionEnabled] = useState(false);

  // Session history
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const persistedCountRef = useRef(0);

  // Refs so the transport body function always reads current context values at send-time
  const tokenRef = useRef(token);
  const objectContextRef = useRef<string | undefined>(undefined);
  const collectionContextRef = useRef<string | undefined>(undefined);
  const noteContextRef = useRef<string | undefined>(undefined);

  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    objectContextRef.current = contextObject
      ? formatObjectContext(contextObject)
      : undefined;
  }, [contextObject]);

  useEffect(() => {
    collectionContextRef.current =
      collectionEnabled && allObjects?.length
        ? formatCollectionContext(allObjects)
        : undefined;
  }, [collectionEnabled, allObjects]);

  useEffect(() => {
    noteContextRef.current = noteContext
      ? `Research note — "${noteContext.title}":\n\n${noteContext.body}`
      : undefined;
  }, [noteContext]);

  // Transport created once; body function reads current refs at send-time
  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/ai/chat",
      headers: () => ({ Authorization: `Bearer ${tokenRef.current}` }),
      body: () => ({
        objectContext: objectContextRef.current,
        collectionContext: collectionContextRef.current,
        noteContext: noteContextRef.current,
      }),
    }),
  ).current;

  const { messages, sendMessage, status, setMessages, error } = useChat({ transport });
  const isStreaming = status === "submitted" || status === "streaming";

  // ── Settings check ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/ai/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 204) { setHasSettings(false); return; }
        const data = await r.json();
        setHasSettings(!!data?.has_key);
      })
      .catch(() => setHasSettings(false))
      .finally(() => setSettingsLoading(false));
  }, [token]);

  // ── Session management ────────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await listChatSessions(token);
      setSessions(list);
    } catch { /* non-critical */ }
    finally { setSessionsLoading(false); }
  }, [token]);

  useEffect(() => {
    if (hasSettings) loadSessions();
  }, [hasSettings, loadSessions]);

  // Auto-persist messages when a turn completes
  useEffect(() => {
    if (status !== "ready") return;
    const visible = messages.filter((m) => m.role !== "system");
    const unpersisted = visible.slice(persistedCountRef.current);
    if (!unpersisted.length) return;

    (async () => {
      let sid = currentSessionIdRef.current;
      if (!sid) {
        const firstUser = unpersisted.find((m) => m.role === "user");
        const title = firstUser
          ? getTextFromMessage(firstUser).slice(0, 80)
          : new Date().toLocaleDateString();
        const session = await createChatSession(token, title);
        sid = session.id;
        currentSessionIdRef.current = sid;
        setSessions((prev) => [session, ...prev]);
      }
      for (const msg of unpersisted) {
        if (msg.role === "user" || msg.role === "assistant") {
          await appendSessionMessage(token, sid!, msg.role as "user" | "assistant", getTextFromMessage(msg));
        }
      }
      persistedCountRef.current = visible.length;
      loadSessions();
    })().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleSelectSession(session: ChatSession) {
    setHistoryOpen(false);
    const msgs = await listSessionMessages(token, session.id);
    const restored: UIMessage[] = msgs.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
      content: m.content,
    }));
    setMessages(restored);
    currentSessionIdRef.current = session.id;
    persistedCountRef.current = restored.length;
  }

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteChatSession(token, id).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionIdRef.current === id) {
      setMessages([]);
      currentSessionIdRef.current = null;
      persistedCountRef.current = 0;
    }
  }

  function handleClearChat() {
    setMessages([]);
    currentSessionIdRef.current = null;
    persistedCountRef.current = 0;
  }

  // ── Scroll to bottom ──────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────────

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  }

  function handleTemplateClick(prompt: string) {
    const filled = contextObject
      ? prompt.replace("{objectTitle}", contextObject.title)
      : prompt.replace("{objectTitle}", "this object");
    setInput(filled);
    setTemplatesOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // ── Save as note ──────────────────────────────────────────────────────────────

  function handleSaveMessage(msg: UIMessage) {
    const date = new Date().toLocaleDateString();
    onSaveAsNote(
      `AI Research — ${date}`,
      "Saved from AI Assistant",
      getTextFromMessage(msg),
    );
  }

  function handleSaveConversation() {
    const date = new Date().toLocaleDateString();
    const body = visibleMessages
      .map((m) =>
        m.role === "user"
          ? `**You:** ${getTextFromMessage(m)}`
          : `**AI:** ${getTextFromMessage(m)}`,
      )
      .join("\n\n---\n\n");
    onSaveAsNote(
      `AI Conversation — ${date}`,
      `Research conversation (${visibleMessages.length} messages)`,
      body,
    );
  }

  // ── Loading / unconfigured states ─────────────────────────────────────────────

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <span className="text-sm text-slate-400">Checking AI configuration…</span>
      </div>
    );
  }

  if (!hasSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20">
        <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-2">AI Assistant not configured</h3>
        <p className="text-sm text-slate-400 mb-5 max-w-xs">
          Add your API key in Settings to enable the AI research assistant.
        </p>
        <Link
          href={`/${locale}/settings`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          Go to Settings →
        </Link>
      </div>
    );
  }

  const visibleMessages = messages.filter((m) => m.role !== "system");

  // ── Full chat UI ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">AI Assistant</h2>
          <button
            onClick={() => { setHistoryOpen((o) => !o); if (!historyOpen) loadSessions(); }}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              historyOpen
                ? "bg-teal-100 text-teal-700 border-teal-300"
                : "text-slate-400 border-slate-200 hover:text-slate-600 hover:border-slate-300"
            }`}
          >
            History
          </button>
        </div>
        {visibleMessages.length > 0 && (
          <div className="flex items-center gap-3">
            <button onClick={handleClearChat} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Clear
            </button>
            <button onClick={handleSaveConversation} className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors">
              Save conversation
            </button>
          </div>
        )}
      </div>

      {/* Session history panel */}
      {historyOpen && (
        <div className="shrink-0 mb-3 rounded-xl border border-slate-200 bg-slate-50 max-h-44 overflow-y-auto">
          {sessionsLoading ? (
            <div className="py-3 text-xs text-slate-400 text-center">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="py-3 text-xs text-slate-400 text-center">No saved sessions</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{s.title}</p>
                    <p className="text-[10px] text-slate-400">{new Date(s.updated_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Context badges */}
      <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
        {contextObject && (
          <span className="inline-flex items-center gap-1.5 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-1 max-w-[220px]">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5" />
            </svg>
            <span className="truncate">{contextObject.title}</span>
          </span>
        )}

        {noteContext && (
          <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 max-w-[200px]">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25" />
            </svg>
            <span className="truncate">Note: {noteContext.title}</span>
          </span>
        )}

        {allObjects && allObjects.length > 0 && (
          <button
            onClick={() => setCollectionEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-colors ${
              collectionEnabled
                ? "bg-teal-50 text-teal-700 border-teal-300"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            {collectionEnabled ? `Collection (${allObjects.length} objects)` : "Add collection context"}
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            {contextObject ? (
              <>
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">Researching: {contextObject.title}</p>
                <p className="text-xs text-slate-400 max-w-xs">Object details are loaded as context. Ask about provenance, attribution, materials, or catalogue documentation.</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500 max-w-xs mb-4">Ask about provenance research, attribution, materials, cataloguing standards, or cultural property law.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "What provenance records should I look for?",
                    "How do I check the Art Loss Register?",
                    "Explain Spectrum cataloguing standards",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 rounded-full transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {visibleMessages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.role === "assistant" ? (
                <>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {getTextFromMessage(m)}
                    </ReactMarkdown>
                  </div>
                  <button
                    onClick={() => handleSaveMessage(m)}
                    className="mt-2 text-xs text-slate-400 hover:text-teal-600 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                    </svg>
                    Save as note
                  </button>
                </>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{getTextFromMessage(m)}</p>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-4 py-3">
              <span className="flex gap-1 items-center h-5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Templates panel */}
      {templatesOpen && (
        <div className="shrink-0 mb-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
          <div className="p-2 space-y-3">
            {contextObject && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-1 mb-1">
                  Object: {contextObject.title}
                </p>
                <div className="space-y-0.5">
                  {OBJECT_TEMPLATE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleTemplateClick(prompt)}
                      className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      {prompt.replace("{objectTitle}", contextObject.title)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {TEMPLATE_CATEGORIES.map((cat) => (
              <div key={cat.key}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-1 mb-1">
                  {cat.icon} {cat.key}
                </p>
                <div className="space-y-0.5">
                  {cat.prompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleTemplateClick(prompt)}
                      className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            contextObject
              ? `Ask about ${contextObject.title}…`
              : "Ask about provenance, attribution, cataloguing…"
          }
          disabled={isStreaming}
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shrink-0"
        >
          Send
        </button>
      </form>
      <div className="flex justify-between items-center mt-1.5 shrink-0">
        <button
          onClick={() => setTemplatesOpen((o) => !o)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M3.75 6.75h16.5M3.75 17.25h16.5" />
          </svg>
          {templatesOpen ? "Hide prompts" : "Prompt templates"}
        </button>
        <Link href={`/${locale}/settings`} className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors">
          AI settings
        </Link>
      </div>
    </div>
  );
}
