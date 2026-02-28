/**
 * teachAI Unified LLM Adapter
 * ─────────────────────────────────────────────────────────────
 * Claude / OpenAI GPT / Google Gemini / Amazon Bedrock を
 * 統一インターフェースで呼び出すアダプター層。
 *
 * 設計思想:
 *   - プロバイダーに依存しないコアロジック（scoring, knowledge-graph）
 *   - このファイルだけ差し替えれば別プロバイダーに移行可能
 *   - APIキーの形式からプロバイダーを自動判定
 *
 * 転用:
 *   src/lib/llm.ts をコピーするだけで別プロジェクトでも使える
 */

export type Provider = "anthropic" | "openai" | "gemini" | "bedrock";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
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
  if (apiKey.startsWith("sk-ant-"))           return "anthropic";
  if (apiKey.startsWith("sk-") && apiKey.length > 40) return "openai";
  if (apiKey.startsWith("AIza"))              return "gemini";
  if (apiKey.startsWith("aws:"))              return "bedrock"; // "aws:ACCESS_KEY:SECRET:REGION"
  // デフォルト: 長いキーはOpenAI
  return "openai";
}

export function getProviderLabel(provider: Provider): string {
  return {
    anthropic: "Claude (Anthropic)",
    openai:    "GPT (OpenAI)",
    gemini:    "Gemini (Google)",
    bedrock:   "Bedrock (AWS)",
  }[provider];
}

export function getDefaultModel(provider: Provider): string {
  return {
    anthropic: "claude-haiku-4-5-20251001",
    openai:    "gpt-4o-mini",
    gemini:    "gemini-2.0-flash",
    bedrock:   "anthropic.claude-3-haiku-20240307-v1:0",
  }[provider];
}

export function getSmartModel(provider: Provider): string {
  return {
    anthropic: "claude-sonnet-4-6",
    openai:    "gpt-4o",
    gemini:    "gemini-2.0-flash",
    bedrock:   "anthropic.claude-3-5-sonnet-20241022-v2:0",
  }[provider];
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

// ─── Anthropic ───────────────────────────────────────────────

async function callAnthropic(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: req.messages,
  };
  if (req.system) body.system = req.system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: { type: string; text: string }[];
    usage: { input_tokens: number; output_tokens: number };
    model: string;
  };

  return {
    text: data.content.find(c => c.type === "text")?.text ?? "",
    provider: "anthropic",
    model: data.model,
    usage: { input: data.usage.input_tokens, output: data.usage.output_tokens },
  };
}

// ─── OpenAI ──────────────────────────────────────────────────

async function callOpenAI(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  const messages: LLMMessage[] = req.system
    ? [{ role: "assistant", content: req.system }, ...req.messages]
    : req.messages;

  // OpenAI uses "system" role
  const openaiMessages = messages.map((m, i) => ({
    role: i === 0 && req.system ? "system" : m.role,
    content: m.content,
  }));

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  return {
    text: data.choices[0]?.message.content ?? "",
    provider: "openai",
    model: data.model,
    usage: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens },
  };
}

// ─── Google Gemini ───────────────────────────────────────────

async function callGemini(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  // Gemini API: system instruction + contents
  const body: Record<string, unknown> = {
    contents: req.messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: req.temperature ?? 0.7,
    },
  };

  if (req.system) {
    body.systemInstruction = { parts: [{ text: req.system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${req.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
    usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
  };

  return {
    text: data.candidates[0]?.content.parts[0]?.text ?? "",
    provider: "gemini",
    model,
    usage: {
      input: data.usageMetadata?.promptTokenCount ?? 0,
      output: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

// ─── Amazon Bedrock ──────────────────────────────────────────
// APIキー形式: "aws:ACCESS_KEY_ID:SECRET_ACCESS_KEY:REGION"
// AWS SDK依存を避けるため、Bedrock Runtime の Invoke API を直接呼ぶ

async function callBedrock(req: LLMRequest, model: string, maxTokens: number): Promise<LLMResponse> {
  const parts = req.apiKey.split(":");
  if (parts.length < 4) throw new Error("Bedrock APIキー形式: aws:ACCESS_KEY:SECRET:REGION");

  const [, accessKeyId, secretAccessKey, region] = parts;

  // Bedrock Converse API (統一インターフェース、2024年〜)
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${model}/converse`;

  const body: Record<string, unknown> = {
    messages: req.messages.map(m => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: { maxTokens, temperature: req.temperature ?? 0.7 },
  };

  if (req.system) {
    body.system = [{ text: req.system }];
  }

  // AWS SigV4 署名 (簡易実装)
  const bodyStr = JSON.stringify(body);
  const headers = await signAWS4({
    method: "POST",
    url: endpoint,
    body: bodyStr,
    service: "bedrock",
    region,
    accessKeyId,
    secretAccessKey,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: bodyStr,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bedrock API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    output: { message: { content: { text: string }[] } };
    usage: { inputTokens: number; outputTokens: number };
  };

  return {
    text: data.output.message.content[0]?.text ?? "",
    provider: "bedrock",
    model,
    usage: {
      input: data.usage?.inputTokens ?? 0,
      output: data.usage?.outputTokens ?? 0,
    },
  };
}

// ─── AWS SigV4 署名（最小実装）────────────────────────────────

async function signAWS4({ method, url, body, service, region, accessKeyId, secretAccessKey }: {
  method: string; url: string; body: string;
  service: string; region: string;
  accessKeyId: string; secretAccessKey: string;
}): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const path = parsedUrl.pathname;

  const enc = new TextEncoder();

  async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
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

  let sigKey: Uint8Array<ArrayBuffer> = enc.encode(`AWS4${secretAccessKey}`) as Uint8Array<ArrayBuffer>;
  sigKey = new Uint8Array(await hmac(sigKey, dateStamp)) as Uint8Array<ArrayBuffer>;
  sigKey = new Uint8Array(await hmac(sigKey, region)) as Uint8Array<ArrayBuffer>;
  sigKey = new Uint8Array(await hmac(sigKey, service)) as Uint8Array<ArrayBuffer>;
  sigKey = new Uint8Array(await hmac(sigKey, "aws4_request")) as Uint8Array<ArrayBuffer>;
  const sig = Array.from(new Uint8Array(await hmac(sigKey, stringToSign))).map(b => b.toString(16).padStart(2, "0")).join("");

  return {
    "x-amz-date": amzDate,
    "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  };
}

// ─── モデル一覧（UI表示用）──────────────────────────────────

export const PROVIDER_MODELS: Record<Provider, { id: string; label: string; tier: "fast" | "smart" }[]> = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5 (高速・安価)", tier: "fast" },
    { id: "claude-sonnet-4-6",           label: "Claude Sonnet 4.6 (バランス)", tier: "smart" },
  ],
  openai: [
    { id: "gpt-4o-mini",  label: "GPT-4o mini (高速・安価)", tier: "fast" },
    { id: "gpt-4o",       label: "GPT-4o (高精度)", tier: "smart" },
    { id: "o3-mini",      label: "o3-mini (推論特化)", tier: "smart" },
  ],
  gemini: [
    { id: "gemini-2.0-flash",      label: "Gemini 2.0 Flash (高速)", tier: "fast" },
    { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro (高精度)", tier: "smart" },
  ],
  bedrock: [
    { id: "anthropic.claude-3-haiku-20240307-v1:0",     label: "Claude 3 Haiku via Bedrock", tier: "fast" },
    { id: "anthropic.claude-3-5-sonnet-20241022-v2:0",  label: "Claude 3.5 Sonnet via Bedrock", tier: "smart" },
    { id: "amazon.titan-text-lite-v1",                   label: "Amazon Titan Text Lite", tier: "fast" },
  ],
};
