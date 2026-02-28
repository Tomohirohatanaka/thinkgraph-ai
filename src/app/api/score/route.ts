import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { CORS_HEADERS, corsResponse } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; }
interface LogicGraph { nodes: { id: string; label: string; node_type: string; depth: number }[]; edges: { source: string; target: string; relation: string }[]; }

function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const match = cleaned.match(/[\[{][\s\S]*[\]|}]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned.trim());
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, domain, idealGraph, conversation } = await req.json() as {
      apiKey: string; domain: string; idealGraph: LogicGraph; conversation: Message[];
    };
    const provider = detectProvider(apiKey);
    const convText = conversation
      .filter(m => !(m.role === "user" && m.content === "面接を開始してください。"))
      .map(m => `${m.role === "user" ? "受験者" : "面接官"}: ${m.content}`)
      .join("\n");

    // Step 1: Extract user graph
    const extractPrompt = `あなたは思考構造分析の専門家です。
以下のAI面接の会話ログを分析して、受験者が表現した論理構造グラフをJSON形式で抽出してください。

ドメイン: ${domain}

会話ログ:
${convText.slice(0, 4000)}

以下のJSON形式で出力してください:
{
  "nodes": [
    {"id": "u1", "label": "受験者が言及した概念（8文字以内）", "node_type": "problem|cause|factor|solution|concept", "depth": 0}
  ],
  "edges": [
    {"source": "u1", "target": "u2", "relation": "causes|leads_to|part_of|prevents|requires"}
  ]
}

ルール:
- 受験者が実際に言及した内容のみ含める（推測・補完はしない）
- 因果関係・論理的なつながりが明示されたもののみエッジにする
- labelは8文字以内

JSONのみ出力。`;

    const extractMsg = await callLLM({
      provider,
      apiKey,
      messages: [{ role: "user", content: extractPrompt }],
      maxTokens: 1500,
    });
    const userGraph = extractJSON(extractMsg.text) as LogicGraph;

    // Step 2: Score
    const idealSummary = {
      nodes: idealGraph.nodes.map(n => ({ id: n.id, label: n.label, type: n.node_type, depth: n.depth })),
      edges: idealGraph.edges.map(e => ({ src: e.source, tgt: e.target, rel: e.relation })),
    };
    const userSummary = {
      nodes: (userGraph.nodes || []).map(n => ({ id: n.id, label: n.label, type: n.node_type, depth: n.depth })),
      edges: (userGraph.edges || []).map(e => ({ src: e.source, tgt: e.target, rel: e.relation })),
    };

    const scorePrompt = `あなたは思考力評価の専門家です。
研修ドメイン: ${domain}

【理想グラフ】
${JSON.stringify(idealSummary, null, 2)}

【受験者グラフ】
${JSON.stringify(userSummary, null, 2)}

以下の4つの観点でスコアリングし、JSON形式で返してください:

1. **概念理解度 (knowledge_fidelity)**: 重要概念の網羅性・正確性 (0-100)
2. **構造整合度 (structural_integrity)**: 因果関係・論理構造の一致度 (0-100)
3. **仮説生成力 (hypothesis_generation)**: 理想グラフにない独自の視点の妥当性 (0-100)
4. **思考深度 (thinking_depth)**: 根本原因への到達度・深さ (0-100)

JSON形式:
{
  "knowledge_fidelity": 75,
  "structural_integrity": 60,
  "hypothesis_generation": 40,
  "thinking_depth": 55,
  "total_score": 60,
  "matched_concepts": ["概念A", "概念B"],
  "missing_concepts": ["概念C", "概念D"],
  "unique_insights": ["独自の視点X"],
  "key_feedback": "3文以内の核心的フィードバック（日本語）",
  "strength": "最大の強み（1文）",
  "improvement": "最優先の改善点（1文）"
}

total_scoreは 0.2×knowledge_fidelity + 0.35×structural_integrity + 0.25×hypothesis_generation + 0.2×thinking_depth で計算。
JSONのみ出力。`;

    const scoreMsg = await await callLLM({
      provider,
      apiKey,
      messages: [{ role: "user", content: scorePrompt }],
      maxTokens: 1000,
    });
    const scores = extractJSON(scoreMsg.text);

    return NextResponse.json({ userGraph, scores });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "スコア算出失敗" }, { status: 500 });
  }
}

// ─── CORS Preflight ──────────────────────────────────────────
export async function OPTIONS() { return corsResponse(); }
