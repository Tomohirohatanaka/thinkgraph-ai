/**
 * teachAI Service Layer
 * ─────────────────────────────────────────
 * マイクロサービス化の基盤。各APIを独立したサービスモジュールとして管理。
 * - 各サービスは独立してテスト・デプロイ可能
 * - 共通のエラーハンドリング・認証パターン
 * - MCP / OpenAPI / REST 統一インターフェース
 */

export { resolveApiKey, isTrialAvailable, getTrialApiKey } from "../trial-key";
export { callLLM, detectProvider, getDefaultModel, getSmartModel } from "../llm";
export type { Provider, LLMRequest, LLMResponse } from "../llm";
export { CORS_HEADERS, corsResponse, ok, err, ERR } from "../api";
export type { ApiResponse } from "../api";

// ─── Service Registry ─────────────────────────────────────
export const SERVICES = {
  ingest:     { path: "/api/ingest",      method: "POST", description: "教材の読み込み・解析" },
  teach:      { path: "/api/teach",       method: "POST", description: "教えるセッション（1ターン）" },
  score:      { path: "/api/score",       method: "POST", description: "v2 スコアリング" },
  scoreV3:    { path: "/api/score-v3",    method: "POST", description: "v3 SOLO スコアリング" },
  character:  { path: "/api/character",   method: "POST", description: "キャラクター生成・進化" },
  skills:     { path: "/api/skills",      method: "POST", description: "スキルマップ生成" },
  analytics:  { path: "/api/analytics",   method: "POST", description: "学習分析" },
  elo:        { path: "/api/elo",         method: "POST", description: "Eloレーティング" },
  graph:      { path: "/api/extract-graph", method: "POST", description: "知識グラフ抽出" },
  idealGraph: { path: "/api/ideal-graph", method: "POST", description: "理想グラフ生成" },
  proactive:  { path: "/api/proactive",   method: "POST", description: "プロアクティブ提案" },
  trial:      { path: "/api/trial",       method: "GET",  description: "トライアル状態確認" },
  test:       { path: "/api/test",        method: "POST", description: "APIキー検証" },
  docs:       { path: "/api/docs",        method: "GET",  description: "APIドキュメント" },
  mcp:        { path: "/api/mcp",         method: "POST", description: "MCPエンドポイント" },
} as const;

export type ServiceName = keyof typeof SERVICES;

// ─── Standard API Call Helper (Client-side) ───────────────
export async function callService<T = unknown>(
  service: ServiceName,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const svc = SERVICES[service];
  try {
    const res = await fetch(svc.path, {
      method: svc.method,
      headers: { "Content-Type": "application/json" },
      body: svc.method === "POST" ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
