import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import { resolveApiKey } from "@/lib/trial-key";

interface LogicNode { id: string; label: string; node_type: string; depth: number; }
interface LogicGraph { nodes: LogicNode[]; edges: unknown[]; }
interface Message { role: "user" | "assistant"; content: string; }

export async function POST(req: NextRequest) {
  try {
    const { apiKey, domain, idealGraph, conversation, turn } = await req.json() as {
      apiKey: string; domain: string; idealGraph: LogicGraph;
      conversation: Message[]; turn: number;
    };
    const resolved = resolveApiKey(apiKey);
    if (!resolved) return NextResponse.json({ error: "APIキーが必要です" }, { status: 400 });
    const effectiveKey = resolved.key;
    const provider = detectProvider(effectiveKey);
    const concepts = idealGraph.nodes.map((n) => n.label).join("、");

    const system = `あなたは${domain}の新入社員研修における思考力評価AIです。
受験者の理解度を測るため、以下の戦略で質問してください。

評価すべき重要概念: ${concepts}

面接戦略（現在ターン${turn}）:
- ターン1-2: 自由回答で全体理解を確認（「この研修で学んだことを説明してください」から始める）
- ターン3-4: 因果関係を深掘り（「なぜ？」「どうなる？」）
- ターン5-6: 抽象度を変える（具体例を求める・逆に抽象化させる）
- ターン7+: 反証・制約条件を提示して思考の柔軟性を確認

ルール:
- 1回に1つの質問のみ
- 100文字以内で簡潔に
- 誘導しない・答えを教えない
- 受験者の発言を受けてから次の質問へ
- 思考の穴・矛盾を発見したら丁寧に指摘
- 面接開始時は自己紹介せず、すぐに最初の質問を始める`;

    // Prepare messages - filter out the initial bootstrap message
    const msgs = conversation.filter(
      (m) => !(m.role === "user" && m.content === "面接を開始してください。")
    );

    // If empty, add opening trigger
    const apiMsgs = msgs.length === 0
      ? [{ role: "user" as const, content: `${domain}について、面接を開始してください。最初の質問をしてください。` }]
      : msgs;

    const llmRes = await callLLM({
      provider,
      apiKey: effectiveKey,
      messages: apiMsgs,
      maxTokens: 300,
    });

    return NextResponse.json({ response: llmRes.text });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "面接応答失敗" }, { status: 500 });
  }
}

// ─── CORS Preflight ──────────────────────────────────────────
export async function OPTIONS() { return corsResponse(); }
