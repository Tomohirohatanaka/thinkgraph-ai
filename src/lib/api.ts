/**
 * teachAI Shared API Utilities
 * ─────────────────────────────
 * すべてのAPIが使う共通レスポンス形式・エラーハンドラ・型定義
 * 別サービスへの転用時もこのファイルをコピーするだけで統一フォーマットが使える
 */

export const API_VERSION = "1.0.0";
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "X-API-Version": API_VERSION,
};

// ─── 標準レスポンス形式 ──────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { version: string; timestamp: string; duration_ms?: number };
}

export function ok<T>(data: T, meta?: { duration_ms?: number }): ApiResponse<T> {
  return {
    ok: true,
    data,
    meta: { version: API_VERSION, timestamp: new Date().toISOString(), ...meta },
  };
}

export function err(
  code: string,
  message: string,
  details?: unknown,
  status = 400
): { body: ApiResponse; status: number } {
  return {
    body: { ok: false, error: { code, message, details }, meta: { version: API_VERSION, timestamp: new Date().toISOString() } },
    status,
  };
}

// ─── Anthropic APIキー検証 ────────────────────────────────────
export function validateApiKey(key: unknown): key is string {
  return typeof key === "string" && key.startsWith("sk-ant-");
}

// ─── CORS preflight レスポンス ────────────────────────────────
export function corsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── エラーコード定数 ─────────────────────────────────────────
export const ERR = {
  INVALID_API_KEY:   "INVALID_API_KEY",
  MISSING_FIELD:     "MISSING_FIELD",
  INVALID_FIELD:     "INVALID_FIELD",
  AI_ERROR:          "AI_ERROR",
  PARSE_ERROR:       "PARSE_ERROR",
  NOT_FOUND:         "NOT_FOUND",
  RATE_LIMITED:      "RATE_LIMITED",
  INTERNAL:          "INTERNAL_ERROR",
} as const;

// ─── ToolDefinition（MCP / OpenAPI 両用）────────────────────
export interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
      default?: unknown;
    }>;
    required: string[];
  };
  outputSchema?: Record<string, unknown>;
  examples?: Array<{ input: Record<string, unknown>; description: string }>;
}

