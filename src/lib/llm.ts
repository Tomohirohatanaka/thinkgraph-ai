/**
 * teachAI Unified LLM Adapter
 * Claude / OpenAI GPT / Google Gemini / Amazon Bedrock
 * + マルチモーダル対応 (画像・PDF document block)
 */

export type Provider = "anthropic" | "openai" | "gemini" | "bedrock";

// ─── メッセージ型（テキスト or マルチモーダル） ──────────────
export type LLMContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; base64: string }   // JPEG/PNG/GIF/WebP
  | { type: "pdf";   base64: string };                     // PDF (Claude document block)

export interface LLMMessage {
  role: "user" | "assistant";
  content: string | LLMContentPart[];
}

export interface LLMRequest {
  provider: Provider;
  apiKey: string;
  model?: string;
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  provider: Provider;
  model: string;
  usage?: { input: number; output: number };
}

// ─── プロバイダー自動判定 ────────────────────────────────────
export function detectProvider(apiKey: string): Provider {
  if (apiKey.startsWith("sk-ant-"))                        return "anthropic";
  if (apiKey.startsWith("sk-") && apiKey.length > 40)     return "openai";
  if (apiKey.startsWith("AIza"))                           return "gemini";
  if (apiKey.startsWith("aws:"))                           return "bedrock";
  return "openai";
}

export function getProviderLabel(provider: Provider): string {
  return { anthropic: "Claude (Anthropic)", openai: "GPT (OpenAI)", gemini: "Gemini (Google)", bedrock: "Bedrock (AWS)" }[provider];
}

export function getDefaultModel(provider: Provider): string {
  return { anthropic: "claude-haiku-4-5-20251001", openai: "gpt-4o-mini", gemini: "gemini-2.0-flash", bedrock: "anthropic.claude-3-haiku-20240307-v1:0" }[provider];
}

export function getSmartModel(provider: Provider): string {
  return { anthropic: "claude-sonnet-4-6", openai: "gpt-4o", gemini: "gemini-2.0-flash", bedrock: "anthropic.claude-3-5-sonnet-20241022-v2:0" }[provider];
}

// ─── 統一呼び出し ────────────────────────────────────────────
export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const provider = req.provider;
  const model = req.model ?? getDefaultModel(provider);
  const maxTokens = req.maxTokens ?? 1000;
  switch (provider) {
    case "anthropic": return callAnthropic(req, model, maxTokens);
    case "openai":    return callOpenAI(req, model, maxTokens);
    case "gemini":    return callGemini(req, model, maxTokens);
    case "bedrock":   return callBedrock(req, model, maxTokens);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// ─── ヘルパー: contentをテキストに変換（非対応プロバイダー用）──
function contentToText(content: string | LLMContentPart[]): string {
  if (typeof content === "string") return content;
  return content.map(p => {
    if (p.type === "text") return p.text;
    if (p.type === "image") return "[画像ファイルが添付されています]";
    if (p.type === "pdf") return "[PDFファイルが添付されています]";
    return "";
  }).join("\n");
}

// ─── Anthropic ───────────────────────────────────────────────
function buildAnthropicContent(content: string | LLMContentPart[]): unknown[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map(p => {
    if (p.type === "text")  return { type: "text", text: p.text };
    if (p.type === "image") return { type: "image", source: { type: "base64", media_type: p.mimeType, data: p.base64 } };
    if (p.type === "pdf")   return { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } };
    return { type: "text", text: "" };
  });
}

async function callAnthropic(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: req.messages.map(m => ({ role: m.role, content: buildAnthropicContent(m.content) })),
  };
  if (req.system) body.system = req.system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": req.apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Anthropic API error ${res.status}: ${err}`); }
  const data = await res.json() as { content: { type: string; text: string }[]; usage: { input_tokens: number; output_tokens: number }; model: string };
  return { text: data.content.find(c => c.type === "text")?.text ?? "", provider: "anthropic", model: data.model, usage: { input: data.usage.input_tokens, output: data.usage.output_tokens } };
}

// ─── OpenAI ──────────────────────────────────────────────────
function buildOpenAIContent(content: string | LLMContentPart[]): unknown {
  if (typeof content === "string") return content;
  const parts = content.map(p => {
    if (p.type === "text")  return { type: "text", text: p.text };
    if (p.type === "image") return { type: "image_url", image_url: { url: `data:${p.mimeType};base64,${p.base64}` } };
    if (p.type === "pdf")   return { type: "text", text: "[PDFファイル添付]" }; // GPT-4はPDF document未対応
    return { type: "text", text: "" };
  });
  return parts.length === 1 && parts[0] && typeof (parts[0] as {type:string}).type === "string" && (parts[0] as {type:string}).type === "text"
    ? (parts[0] as {text:string}).text
    : parts;
}

async function callOpenAI(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  const openaiMessages: unknown[] = req.system ? [{ role: "system", content: req.system }] : [];
  openaiMessages.push(...req.messages.map(m => ({ role: m.role, content: buildOpenAIContent(m.content) })));

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: openaiMessages, temperature: req.temperature ?? 0.7 }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenAI API error ${res.status}: ${err}`); }
  const data = await res.json() as { choices: { message: { content: string } }[]; usage: { prompt_tokens: number; completion_tokens: number }; model: string };
  return { text: data.choices[0]?.message.content ?? "", provider: "openai", model: data.model, usage: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens } };
}

// ─── Google Gemini ───────────────────────────────────────────
function buildGeminiParts(content: string | LLMContentPart[]): unknown[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map(p => {
    if (p.type === "text")  return { text: p.text };
    if (p.type === "image") return { inlineData: { mimeType: p.mimeType, data: p.base64 } };
    if (p.type === "pdf")   return { inlineData: { mimeType: "application/pdf", data: p.base64 } };
    return { text: "" };
  });
}

async function callGemini(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    contents: req.messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: buildGeminiParts(m.content) })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: req.temperature ?? 0.7 },
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${req.apiKey}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.text(); throw new Error(`Gemini API error ${res.status}: ${err}`); }
  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[]; usageMetadata: { promptTokenCount: number; candidatesTokenCount: number } };
  return { text: data.candidates[0]?.content.parts[0]?.text ?? "", provider: "gemini", model, usage: { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 } };
}

// ─── Amazon Bedrock ──────────────────────────────────────────
async function callBedrock(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  const parts = req.apiKey.split(":");
  if (parts.length < 4) throw new Error("Bedrock APIキー形式: aws:ACCESS_KEY:SECRET:REGION");
  const [, accessKeyId, secretAccessKey, region] = parts;
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${model}/converse`;

  const body: Record<string, unknown> = {
    messages: req.messages.map(m => ({ role: m.role, content: [{ text: contentToText(m.content) }] })),
    inferenceConfig: { maxTokens, temperature: req.temperature ?? 0.7 },
  };
  if (req.system) body.system = [{ text: req.system }];

  const bodyStr = JSON.stringify(body);
  const headers = await signAWS4({ method: "POST", url: endpoint, body: bodyStr, service: "bedrock", region, accessKeyId, secretAccessKey });
  const res = await fetch(endpoint, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: bodyStr });
  if (!res.ok) { const err = await res.text(); throw new Error(`Bedrock API error ${res.status}: ${err}`); }
  const data = await res.json() as { output: { message: { content: { text: string }[] } }; usage: { inputTokens: number; outputTokens: number } };
  return { text: data.output.message.content[0]?.text ?? "", provider: "bedrock", model, usage: { input: data.usage?.inputTokens ?? 0, output: data.usage?.outputTokens ?? 0 } };
}

// ─── AWS SigV4 ───────────────────────────────────────────────
async function signAWS4({ method, url, body, service, region, accessKeyId, secretAccessKey }: { method: string; url: string; body: string; service: string; region: string; accessKeyId: string; secretAccessKey: string }): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const path = parsedUrl.pathname;
  const enc = new TextEncoder();
  async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
    const k = await crypto.subtle.importKey("raw", key as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return crypto.subtle.sign("HMAC", k, enc.encode(data));
  }
  async function sha256hex(data: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(data));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const bodyHash = await sha256hex(body);
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, bodyHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256hex(canonicalRequest)].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sigKey: any = enc.encode(`AWS4${secretAccessKey}`);
  sigKey = new Uint8Array(await hmac(sigKey as ArrayBuffer, dateStamp));
  sigKey = new Uint8Array(await hmac(sigKey as ArrayBuffer, region));
  sigKey = new Uint8Array(await hmac(sigKey as ArrayBuffer, service));
  sigKey = new Uint8Array(await hmac(sigKey as ArrayBuffer, "aws4_request"));
  const sig = Array.from(new Uint8Array(await hmac(sigKey, stringToSign))).map(b => b.toString(16).padStart(2, "0")).join("");
  return { "x-amz-date": amzDate, "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}` };
}

// ─── モデル一覧 ──────────────────────────────────────────────
export const PROVIDER_MODELS: Record<Provider, { id: string; label: string; tier: "fast" | "smart" }[]> = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (高速・安価)", tier: "fast" },
    { id: "claude-sonnet-4-6",          label: "Claude Sonnet 4.6 (バランス)", tier: "smart" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (高速・安価)", tier: "fast" },
    { id: "gpt-4o",      label: "GPT-4o (高精度)", tier: "smart" },
    { id: "o3-mini",     label: "o3-mini (推論特化)", tier: "smart" },
  ],
  gemini: [
    { id: "gemini-2.0-flash",            label: "Gemini 2.0 Flash (高速)", tier: "fast" },
    { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro (高精度)", tier: "smart" },
  ],
  bedrock: [
    { id: "anthropic.claude-3-haiku-20240307-v1:0",    label: "Claude 3 Haiku via Bedrock", tier: "fast" },
    { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", label: "Claude 3.5 Sonnet via Bedrock", tier: "smart" },
    { id: "amazon.titan-text-lite-v1",                  label: "Amazon Titan Text Lite", tier: "fast" },
  ],
};
