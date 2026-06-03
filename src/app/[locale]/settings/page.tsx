"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  listNumberSchemes,
  createNumberScheme,
  updateNumberScheme,
  previewNumberScheme,
  getAiSettings,
  upsertAiSettings,
  deleteAiSettings,
  type NumberScheme,
  type NumberSchemePreview,
  type AiSettings,
} from "@/lib/collection-api";

// ── AI provider model options ─────────────────────────────────────────────────

const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
  ollama: [],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  google: "Google (Gemini)",
  mistral: "Mistral",
  ollama: "Ollama (local)",
};

function AiSettingsSection({ token }: { token: string }) {
  const [existing, setExisting] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    getAiSettings(token)
      .then((s) => {
        setExisting(s);
        if (s) {
          setProvider(s.provider);
          setModel(s.model);
          if (s.base_url) setBaseUrl(s.base_url);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function handleProviderChange(p: string) {
    setProvider(p);
    const defaults: Record<string, string> = {
      anthropic: "claude-sonnet-4-6",
      openai: "gpt-4o",
      google: "gemini-2.0-flash",
      mistral: "mistral-large-latest",
      ollama: "llama3.2",
    };
    setModel(defaults[p] ?? "");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() && !existing?.has_key) { setError("API key is required"); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const effectiveModel = provider === "ollama" ? ollamaModel : model;
      const s = await upsertAiSettings(token, {
        provider,
        model: effectiveModel,
        api_key: apiKey || "unchanged", // server ignores if empty when key already exists
        base_url: provider === "ollama" ? (baseUrl || "http://localhost:11434/v1") : null,
      });
      setExisting(s);
      setApiKey("");
      setSuccess("AI settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAiSettings(token);
      setExisting(null);
      setApiKey("");
      setSuccess("AI settings removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400 py-4">Loading…</p>;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-teal-700 text-sm">{success}</div>
      )}

      {existing?.has_key && (
        <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          API key saved · {PROVIDER_LABELS[existing.provider]} · {existing.model}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Provider</label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className={inputCls}
          >
            {Object.entries(PROVIDER_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Model</label>
          {provider === "ollama" ? (
            <input
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="e.g. llama3.2, mistral"
              className={inputCls}
            />
          ) : (
            <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
              {PROVIDER_MODELS[provider]?.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">
          API Key{existing?.has_key ? " (leave blank to keep existing)" : " *"}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={existing?.has_key ? "••••••••••••••• (saved)" : "sk-ant-…"}
          className={inputCls}
          autoComplete="new-password"
        />
      </div>

      {provider === "ollama" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Ollama base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
            className={inputCls}
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : existing?.has_key ? "Update settings" : "Save settings"}
        </button>
        {existing?.has_key && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? "Removing…" : "Remove key"}
          </button>
        )}
      </div>
    </form>
  );
}

// ── Accession number scheme form ──────────────────────────────────────────────

const inputCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

const TEMPLATE_EXAMPLES = [
  { label: "Institution + Year + Sequence", value: "{CODE}.{YEAR}.{SEQ}" },
  { label: "Year / Sequence", value: "{YEAR}/{SEQ}" },
  { label: "Prefix + Sequence", value: "{PREFIX}{SEQ}" },
  { label: "Year – Sequence", value: "{YEAR}-{SEQ}" },
];

function renderPreview(template: string, code: string, prefix: string, padding: number): string {
  const year = new Date().getFullYear();
  const seq = "1".padStart(padding, "0");
  return template
    .replace("{CODE}", code || "XXXXX")
    .replace("{YEAR}", String(year))
    .replace("{SEQ}", seq)
    .replace("{PREFIX}", prefix || "");
}

interface SchemeFormProps {
  initial?: NumberScheme;
  onSave: (data: Partial<NumberScheme>) => Promise<void>;
  onCancel: () => void;
}

function SchemeForm({ initial, onSave, onCancel }: SchemeFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [institutionCode, setInstitutionCode] = useState(initial?.institution_code ?? "");
  const [template, setTemplate] = useState(initial?.format_template ?? "{CODE}.{YEAR}.{SEQ}");
  const [prefix, setPrefix] = useState(initial?.prefix ?? "");
  const [padding, setPadding] = useState(initial?.seq_padding ?? 3);
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = renderPreview(template, institutionCode, prefix, padding);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name,
        institution_code: institutionCode || null,
        format_template: template,
        prefix: prefix || null,
        seq_padding: padding,
        is_default: isDefault,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Scheme name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Main Collection" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Institution code</label>
          <p className="text-xs text-slate-400">Up to 8 characters, e.g. CAMCD</p>
          <input
            value={institutionCode}
            onChange={(e) => setInstitutionCode(e.target.value.toUpperCase().slice(0, 8))}
            className={inputCls}
            placeholder="CAMCD"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Prefix (for simple schemes)</label>
          <p className="text-xs text-slate-400">Used by {"{PREFIX}"} in template</p>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={inputCls} placeholder="OBJ-" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Format template</label>
        <p className="text-xs text-slate-400">
          Placeholders: <code className="bg-slate-100 px-1 rounded">{"{CODE}"}</code>{" "}
          <code className="bg-slate-100 px-1 rounded">{"{YEAR}"}</code>{" "}
          <code className="bg-slate-100 px-1 rounded">{"{SEQ}"}</code>{" "}
          <code className="bg-slate-100 px-1 rounded">{"{PREFIX}"}</code>
        </p>
        <div className="flex gap-2 flex-wrap mb-1">
          {TEMPLATE_EXAMPLES.map((ex) => (
            <button
              key={ex.value}
              type="button"
              onClick={() => setTemplate(ex.value)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                template === ex.value
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>
        <input required value={template} onChange={(e) => setTemplate(e.target.value)} className={inputCls} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Sequence zero-padding</label>
        <p className="text-xs text-slate-400">e.g. 3 → 001, 4 → 0001</p>
        <input
          type="number"
          min={1}
          max={8}
          value={padding}
          onChange={(e) => setPadding(Math.max(1, Math.min(8, parseInt(e.target.value) || 3)))}
          className={`${inputCls} w-24`}
        />
      </div>

      {/* Live preview */}
      <div className="rounded-xl bg-teal-50 border border-teal-200 p-4">
        <p className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-1">Preview</p>
        <p className="font-mono text-lg font-semibold text-teal-800">{preview}</p>
        <p className="text-xs text-teal-500 mt-0.5">First number that will be generated</p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="text-sm text-slate-700">Set as default scheme</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !name || !template}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : initial ? "Update scheme" : "Create scheme"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [schemes, setSchemes] = useState<NumberScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NumberScheme | null>(null);
  const [previews, setPreviews] = useState<Record<string, NumberSchemePreview>>({});

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const loadSchemes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listNumberSchemes(token);
      setSchemes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schemes");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadSchemes();
  }, [loadSchemes, token]);

  async function loadPreview(scheme: NumberScheme) {
    if (!token || previews[scheme.id]) return;
    try {
      const p = await previewNumberScheme(token, scheme.id);
      setPreviews((prev) => ({ ...prev, [scheme.id]: p }));
    } catch {
      // preview failure is non-critical
    }
  }

  useEffect(() => {
    schemes.forEach(loadPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemes]);

  async function handleCreate(data: Partial<NumberScheme>) {
    if (!token) return;
    await createNumberScheme(token, data);
    setCreating(false);
    setPreviews({});
    await loadSchemes();
  }

  async function handleUpdate(data: Partial<NumberScheme>) {
    if (!token || !editing) return;
    await updateNumberScheme(token, editing.id, data);
    setEditing(null);
    setPreviews({});
    await loadSchemes();
  }

  if (isLoading || !user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold text-slate-800 mb-8">Settings</h1>

      {/* AI Assistant */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-700">AI Assistant</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Configure your AI provider for the Research assistant. Keys are encrypted at rest.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <AiSettingsSection token={token!} />
        </div>
      </section>

      {/* Accession Number Schemes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-700">Accession Number Schemes</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Define how accession numbers are generated for your collection.
            </p>
          </div>
          {!creating && !editing && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New scheme
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {creating && (
          <div className="bg-white rounded-2xl border border-teal-200 shadow-sm p-6 mb-4">
            <h3 className="font-medium text-slate-700 mb-4">New scheme</h3>
            <SchemeForm onSave={handleCreate} onCancel={() => setCreating(false)} />
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
        ) : schemes.length === 0 && !creating ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm mb-3">No number schemes defined yet.</p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Create your first scheme →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schemes.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                {editing?.id === s.id ? (
                  <div className="p-6">
                    <h3 className="font-medium text-slate-700 mb-4">Edit scheme</h3>
                    <SchemeForm initial={s} onSave={handleUpdate} onCancel={() => setEditing(null)} />
                  </div>
                ) : (
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                        {s.is_default && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">Default</span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-slate-500 mb-1">{s.format_template}</p>
                      {previews[s.id] && (
                        <p className="text-xs text-slate-400">
                          Next: <span className="font-mono font-medium text-teal-700">{previews[s.id].next_number}</span>
                          {" "}· Used {s.last_sequence} number{s.last_sequence !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="text-sm text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
