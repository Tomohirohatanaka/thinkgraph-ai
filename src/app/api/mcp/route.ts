/**
 * teachAI MCP Server
 * ───────────────────────────────────────────────────────────────
 * Model Context Protocol (JSON-RPC 2.0) over HTTP
 * Spec: https://spec.modelcontextprotocol.io/
 *
 * エンドポイント:
 *   GET  /api/mcp  → サーバー情報・ツール一覧
 *   POST /api/mcp  → ツール実行（JSON-RPC 2.0）
 *
 * 転用方法:
 *   1. このファイルを別の Next.js プロジェクトにコピー
 *   2. src/lib/tools.ts のツール定義を追加・削除
 *   3. 各ツールのハンドラ（HANDLERS）を書き換える
 */

import { NextRequest, NextResponse } from "next/server";
import { ALL_TOOLS as TOOLS, TOOL_MAP } from "@/lib/tools";
import { CORS_HEADERS, corsResponse } from "@/lib/api";

// ─── MCP サーバー情報 ────────────────────────────────────────
const SERVER_INFO = {
  name: "teachai-mcp",
  version: "1.0.0",
  description: "teachAI: AIキャラクターに教えることで学ぶ学習プラットフォームのMCPサーバー",
  contact: { url: "https://thinkgraph-ai.vercel.app" },
  capabilities: {
    tools: { listChanged: false },
    resources: {},
    prompts: {},
  },
};

// ─── JSON-RPC ヘルパー ────────────────────────────────────────
function rpcOk(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: CORS_HEADERS });
}
function rpcErr(id: unknown, code: number, message: string, data?: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message, data } }, {
    status: 200, // JSON-RPC はエラーでも 200 を返す
    headers: CORS_HEADERS,
  });
}

// ─── ツール → API エンドポイントの内部呼び出し ──────────────
// 各ツールは既存の /api/* エンドポイントに内部的にfetchするのではなく
// 直接ハンドラを呼び出すことでオーバーヘッドをなくす

async function callTool(name: string, args: Record<string, unknown>, baseUrl: string) {
  const endpoints: Record<string, string> = {
    ingest_content:       "/api/ingest",
    teach_turn:           "/api/teach",
    get_character:        "/api/character",
    init_character:       "/api/character",
    evolve_character:     "/api/character",
    generate_skill_map:   "/api/skills",
    interview_turn:       "/api/interview",
    get_elo_rating:       "/api/elo",
    update_elo_rating:    "/api/elo",
    score_v3:             "/api/score-v3",
  };

  const endpoint = endpoints[name];
  if (!endpoint) throw new Error(`Unknown tool: ${name}`);

  // GET ツール
  if (name === "get_elo_rating") {
    const topic = args?.topic ? `?topic=${encodeURIComponent(String(args.topic))}` : "";
    const res = await fetch(`${baseUrl}${endpoint}${topic}`, { headers: CORS_HEADERS });
    return res.json();
  }

  if (name === "get_character") {
    const res = await fetch(`${baseUrl}${endpoint}`, { headers: CORS_HEADERS });
    return res.json();
  }

  // POST ツール — argsをそのまま既存APIに渡す
  let body: Record<string, unknown> = { ...args };

  // ツール固有のパラメータ変換
  if (name === "init_character") body = { ...args, mode: "init" };
  if (name === "evolve_character") body = { ...args, mode: "evolve" };

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── GET: サーバー情報・ツール一覧 ──────────────────────────
export async function GET() {
  return NextResponse.json({
    ...SERVER_INFO,
    tools: TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      version: t.version,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
      examples: t.examples,
    })),
    endpoints: {
      mcp:    "/api/mcp (POST, JSON-RPC 2.0)",
      rest:   "/api/docs (OpenAPI Spec)",
      health: "/api/mcp?health=1",
    },
  }, { headers: CORS_HEADERS });
}

// ─── OPTIONS: CORS Preflight ─────────────────────────────────
export async function OPTIONS() {
  return corsResponse();
}

// ─── POST: JSON-RPC 2.0 ──────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return rpcErr(null, -32700, "Parse error: invalid JSON");
  }

  const { jsonrpc, id, method, params } = body as {
    jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown>;
  };

  if (jsonrpc !== "2.0") return rpcErr(id, -32600, "Invalid Request: jsonrpc must be '2.0'");
  if (!method) return rpcErr(id, -32600, "Invalid Request: missing method");

  const baseUrl = req.nextUrl.origin;

  // ─── MCP 標準メソッド ────────────────────────────────────
  switch (method) {
    // ハンドシェイク
    case "initialize":
      return rpcOk(id, {
        protocolVersion: "2024-11-05",
        serverInfo: SERVER_INFO,
        capabilities: SERVER_INFO.capabilities,
      });

    // ping
    case "ping":
      return rpcOk(id, {});

    // ツール一覧
    case "tools/list":
      return rpcOk(id, {
        tools: TOOLS.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    // ツール実行
    case "tools/call": {
      const toolName = (params as { name?: string })?.name;
      const toolArgs = ((params as { arguments?: Record<string, unknown> })?.arguments ?? {}) as Record<string, unknown>;

      if (!toolName) return rpcErr(id, -32602, "Invalid params: missing tool name");

      const toolDef = TOOL_MAP[toolName];
      if (!toolDef) return rpcErr(id, -32602, `Tool not found: ${toolName}`);

      // 必須フィールド検証
      for (const required of toolDef.inputSchema.required) {
        if (toolArgs[required] == null) {
          return rpcErr(id, -32602, `Missing required argument: ${required}`);
        }
      }

      try {
        const result = await callTool(toolName, toolArgs, baseUrl);
        return rpcOk(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: result?.error != null,
        });
      } catch (e) {
        return rpcErr(id, -32603, "Internal error", e instanceof Error ? e.message : String(e));
      }
    }

    // リソース一覧（現在は空）
    case "resources/list":
      return rpcOk(id, { resources: [] });

    // プロンプト一覧（現在は空）
    case "prompts/list":
      return rpcOk(id, { prompts: [] });

    default:
      return rpcErr(id, -32601, `Method not found: ${method}`);
  }
}
