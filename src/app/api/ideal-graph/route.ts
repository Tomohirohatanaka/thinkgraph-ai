import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { CORS_HEADERS, corsResponse } from "@/lib/api";

const DEMO_TEXT = `
なぜなぜ分析（5Why分析）研修テキスト

■ 目的
製造現場で発生した問題の真因を特定し、再発防止策を立案するための問題解決手法。

■ なぜなぜ分析の手順
1. 問題の明確化：発生した現象を具体的・定量的に記述する
2. 現象の層別：問題を「もれなく・だぶりなく」要因に分解する
3. 第1のなぜ：なぜ問題が発生したか？直接原因を探る
4. 第2〜5のなぜ：直接原因の原因を繰り返し深掘りする
5. 真因の特定：システム・管理・教育の欠陥にまで遡る
6. 対策立案：真因を除去する具体的対策を立案
7. 効果確認：対策実施後に問題が解消されたか検証
8. 標準化・横展開：同類問題への適用と管理基準の更新

■ よくある失敗パターン
- 現象の記述が曖昧（「ミスが多い」→「Aラインで○月○日に不良率3%超過」）
- なぜが飛躍している（現象→真因を1回で結論付ける）
- 人のせいにする（「担当者の不注意」→「管理基準が未整備」まで掘る）
- 対策が再発防止になっていない（応急処置で終わる）

■ QCストーリーとの関係
問題解決型QCストーリーにおいて、なぜなぜ分析は「要因解析」ステップで使用される。
特性要因図（フィッシュボーン）と組み合わせることで、多角的な要因分析が可能。

■ 製造業における重要性
品質不良、設備故障、労働災害などあらゆる問題に適用可能。
真因まで到達することで、類似問題の予防・水平展開が実現できる。
`;

function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const match = cleaned.match(/[\[{][\s\S]*[\]|}]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned.trim());
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, domain, trainingText } = await req.json();
    const text = trainingText?.trim() || DEMO_TEXT;
    const provider = detectProvider(apiKey);

    const prompt = `あなたは製造業の研修効果測定の専門家です。
以下の研修資料を分析して、理想的な思考構造グラフをJSON形式で生成してください。

研修ドメイン: ${domain}

研修資料:
${text.slice(0, 3000)}

以下のJSON形式で出力してください:
{
  "nodes": [
    {"id": "n1", "label": "ノードのラベル（8文字以内）", "node_type": "problem|cause|factor|solution|concept", "depth": 0}
  ],
  "edges": [
    {"source": "n1", "target": "n2", "relation": "causes|leads_to|part_of|prevents|requires"}
  ]
}

ルール:
- ノードは8〜14個（問題解決の核心的要素のみ）
- エッジは因果・依存・手順関係のみ
- depthは根本（0）から対策（最大4）まで
- labelは8文字以内
- 有向グラフとして構造化
- なぜなぜ分析の論理構造を反映

JSONのみ出力。前置きなし。`;

    const llmRes = await callLLM({
      provider,
      apiKey,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2000,
    });

    const data = extractJSON(llmRes.text) as { nodes: unknown[]; edges: unknown[] };
    return NextResponse.json({ graph: data });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "グラフ生成失敗" }, { status: 500 });
  }
}

// ─── CORS Preflight ──────────────────────────────────────────
export async function OPTIONS() { return corsResponse(); }
