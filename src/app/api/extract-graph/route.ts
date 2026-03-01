import { NextRequest, NextResponse } from 'next/server';
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import { callLLM, detectProvider } from "@/lib/llm";
import { resolveApiKey } from "@/lib/trial-key";

function extractJson(text: string) {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  const { conversation, domain, apiKey } = await req.json();

  const resolved = resolveApiKey(apiKey);
  if (!resolved) return NextResponse.json({ error: 'API key required' }, { status: 400 });
  const effectiveKey = resolved.key;
  const provider = detectProvider(effectiveKey);
  const convText = conversation
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `あなたは思考構造分析の専門家です。
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
- 受験者が実際に言及した内容のみ含める
- 推測・補完はしない
- 因果関係・論理的なつながりが明示されたもののみエッジにする
- labelは8文字以内

JSONのみ出力。前置きなし。`;

  const llmRes = await callLLM({
      provider,
      apiKey: effectiveKey,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
    });

  const data = extractJson(llmRes.text);
  return NextResponse.json(data);
}

// ─── CORS Preflight ──────────────────────────────────────────
export async function OPTIONS() { return corsResponse(); }
