import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

export const runtime = "nodejs";

const API_URL = process.env.API_URL ?? "http://localhost:8082";

const SYSTEM_PROMPT = `You are a specialist assistant for collection management, art history, \
provenance research, and cultural heritage documentation. You have expertise in:
- Provenance research, ownership histories, and due diligence (including WWII-era gaps)
- Art historical analysis, attribution, dating, and stylistic analysis
- Museum cataloguing standards (Spectrum, LIDO, Dublin Core, Getty standards)
- Materials, techniques, and conservation terminology
- Auction records, exhibition histories, and archival sources
- Cultural property law, restitution research, and ethical collection frameworks
- Authority files: Getty AAT, ULAN, TGN; VIAF; LC subject headings
- Key databases: Art Loss Register, Interpol PSYCHE, RKD, BnF, SIKART

Be concise and cite sources where possible. When discussing provenance gaps, \
flag ethical and legal considerations. Prefer authoritative sources over general knowledge.`;

function buildSystemWithContext(
  objectContext?: string | null,
  collectionContext?: string | null,
  noteContext?: string | null,
): string {
  const parts = [SYSTEM_PROMPT];

  if (objectContext) {
    parts.push(`\n\n## Current Object\n${objectContext}`);
  }

  if (collectionContext) {
    parts.push(`\n\n## Collection Context\n${collectionContext}`);
  }

  if (noteContext) {
    parts.push(`\n\n## Research Note Context\n${noteContext}`);
  }

  return parts.join("");
}

function providerFromSettings(
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string | null,
) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "mistral":
      return createMistral({ apiKey })(model);
    case "ollama":
      return createOpenAI({ apiKey: "ollama", baseURL: baseUrl ?? "http://localhost:11434/v1" })(
        model,
      );
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    messages,
    objectContext,
    collectionContext,
    noteContext,
  }: {
    messages: ModelMessage[];
    objectContext?: string | null;
    collectionContext?: string | null;
    noteContext?: string | null;
  } = await req.json();

  // Fetch the user's decrypted API key from the collection server
  const settingsRes = await fetch(`${API_URL}/ai-settings`, {
    headers: { Authorization: auth, "Content-Type": "application/json" },
  });

  if (settingsRes.status === 204 || settingsRes.status === 404) {
    return Response.json({ error: "AI provider not configured. Add your API key in Settings." }, { status: 422 });
  }

  if (!settingsRes.ok) {
    return Response.json({ error: "Failed to load AI settings" }, { status: 502 });
  }

  const settings = await settingsRes.json();

  // Fetch the raw decrypted key — separate endpoint that returns the key in a secure field
  const keyRes = await fetch(`${API_URL}/ai-settings/key`, {
    headers: { Authorization: auth },
  });

  if (!keyRes.ok) {
    return Response.json({ error: "Failed to retrieve API key" }, { status: 502 });
  }

  const { key } = await keyRes.json();

  const aiModel = providerFromSettings(settings.provider, settings.model, key, settings.base_url);
  const system = buildSystemWithContext(objectContext, collectionContext, noteContext);

  const result = streamText({ model: aiModel, system, messages });

  return result.toUIMessageStreamResponse();
}
