/**
 * teachAI OpenAPI Spec + Swagger UI
 * GET /api/docs        → Swagger UI HTML
 * GET /api/docs?format=json → OpenAPI 3.1 JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { ALL_TOOLS as TOOLS } from "@/lib/tools";
import { CORS_HEADERS, API_VERSION } from "@/lib/api";

function buildOpenAPISpec(baseUrl: string) {
  const paths: Record<string, unknown> = {};

  // 既存の REST エンドポイントをスペック化
  const REST_ENDPOINTS = [
    {
      path: "/api/ingest",
      tool: "ingest_content",
      summary: "コンテンツ取り込み",
      tags: ["Content"],
    },
    {
      path: "/api/teach",
      tool: "teach_turn",
      summary: "教授セッション 1ターン",
      tags: ["Learning"],
    },
    {
      path: "/api/character",
      tool: "get_character",
      summary: "キャラクター取得・生成・進化",
      tags: ["Character"],
      methods: ["GET", "POST"],
    },
    {
      path: "/api/skills",
      tool: "generate_skill_map",
      summary: "スキルマップ生成",
      tags: ["Skills"],
    },
    {
      path: "/api/interview",
      tool: "interview_turn",
      summary: "思考力評価面接",
      tags: ["Interview"],
    },
  ];

  for (const ep of REST_ENDPOINTS) {
    const tool = TOOLS.find(t => t.name === ep.tool);
    if (!tool) continue;

    const methods = ep.methods ?? ["GET", "POST"];
    paths[ep.path] = {};
    const pathObj = paths[ep.path] as Record<string, unknown>;

    if (methods.includes("GET")) {
      pathObj.get = {
        tags: ep.tags,
        summary: ep.summary,
        operationId: `${ep.tool}_get`,
        responses: {
          "200": { description: "成功", content: { "application/json": { schema: { type: "object" } } } },
        },
      };
    }
    if (methods.includes("POST")) {
      // Convert tool inputSchema to OpenAPI format
      const properties: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(tool.inputSchema.properties)) {
        properties[key] = {
          type: val.type,
          description: val.description,
          ...(val.enum ? { enum: val.enum } : {}),
          ...(val.default !== undefined ? { default: val.default } : {}),
        };
      }

      pathObj.post = {
        tags: ep.tags,
        summary: ep.summary,
        operationId: ep.tool,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties,
                required: tool.inputSchema.required,
              },
            },
          },
        },
        responses: {
          "200": { description: "成功", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "バリデーションエラー" },
          "500": { description: "サーバーエラー" },
        },
      };
    }
  }

  // MCP エンドポイント
  paths["/api/mcp"] = {
    get: {
      tags: ["MCP"],
      summary: "MCPサーバー情報・ツール一覧",
      operationId: "mcp_info",
      responses: { "200": { description: "MCP サーバー情報" } },
    },
    post: {
      tags: ["MCP"],
      summary: "MCP JSON-RPC 2.0 ツール実行",
      operationId: "mcp_call",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                jsonrpc: { type: "string", enum: ["2.0"] },
                id: { type: ["string", "number"] },
                method: {
                  type: "string",
                  enum: ["initialize", "tools/list", "tools/call", "ping"],
                },
                params: { type: "object" },
              },
              required: ["jsonrpc", "method"],
            },
            examples: {
              tools_list: {
                summary: "ツール一覧取得",
                value: { jsonrpc: "2.0", id: 1, method: "tools/list" },
              },
              tool_call: {
                summary: "ツール実行例",
                value: {
                  jsonrpc: "2.0", id: 2,
                  method: "tools/call",
                  params: {
                    name: "get_character",
                    arguments: {},
                  },
                },
              },
            },
          },
        },
      },
      responses: { "200": { description: "JSON-RPC レスポンス" } },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "teachAI API",
      version: API_VERSION,
      description: [
        "## teachAI API",
        "AIキャラクターに教えることで学ぶ学習プラットフォームのREST API + MCP サーバー。",
        "",
        "### 認証",
        "各エンドポイントに `apiKey`（Anthropic APIキー）を `sk-ant-...` 形式でリクエストボディに含めてください。",
        "",
        "### MCP 統合",
        "`/api/mcp` エンドポイントは [Model Context Protocol](https://spec.modelcontextprotocol.io/) に準拠した",
        "JSON-RPC 2.0 サーバーです。Claude Desktop や他のMCPクライアントから直接呼び出せます。",
        "",
        "### 転用について",
        "各機能は独立したAPIとして設計されており、別サービスへの組み込みが可能です。",
        "詳細は [GitHub](https://github.com/hatanakas/thinkgraph-ai) を参照してください。",
      ].join("\n"),
      contact: { url: "https://thinkgraph-ai.vercel.app" },
    },
    servers: [{ url: baseUrl, description: "Production" }],
    tags: [
      { name: "Content",   description: "コンテンツの取り込みと処理" },
      { name: "Learning",  description: "AIキャラクターとの教授セッション" },
      { name: "Character", description: "学習で進化するAIキャラクター" },
      { name: "Skills",    description: "スキルマップとプロフィール分析" },
      { name: "Interview", description: "思考力評価面接" },
      { name: "MCP",       description: "Model Context Protocol サーバー" },
    ],
    paths,
  };
}

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");
  const baseUrl = req.nextUrl.origin;

  if (format === "json") {
    return NextResponse.json(buildOpenAPISpec(baseUrl), { headers: CORS_HEADERS });
  }

  // Swagger UI HTML
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>teachAI API Docs</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css"/>
  <style>
    body { margin: 0; font-family: -apple-system, sans-serif; }
    .topbar { background: #1a1a2e !important; }
    .topbar-wrapper .link { visibility: hidden; }
    .topbar-wrapper::before {
      content: '⭐ teachAI API';
      visibility: visible;
      color: white;
      font-size: 18px;
      font-weight: 700;
      margin-left: 16px;
    }
  </style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
<script>
  SwaggerUIBundle({
    url: '/api/docs?format=json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    deepLinking: true,
    defaultModelsExpandDepth: 2,
    tryItOutEnabled: true,
  });
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
