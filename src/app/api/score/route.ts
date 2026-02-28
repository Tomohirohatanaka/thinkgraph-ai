import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { corsResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

interface Message { role: "user" | "assistant"; content: string; }
interface LogicGraph {
  nodes: { id: string; label: string; node_type: string; depth: number }[];
  edges: { source: string; target: string; relation: string }[];
}

function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const match = cleaned.match(/[\[{][\s\S]*[\]|}]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned.trim());
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, domain, idealGraph, conversation, mode, topic } = await req.json() as {
      apiKey: string; domain: string; idealGraph: LogicGraph;
      conversation: Message[]; mode?: string; topic?: string;
    };
    const provider = detectProvider(apiKey);
    const convText = conversation
      .filter(m => !(m.role === "user" && m.content === "面接を開始してください。"))
      .map(m => `${m.role === "user" ? "受験者" : "面接官"}: ${m.content}`)
      .join("\n");

    const extractPrompt = `あなたは思考構造分析の専門家です。
以下のAI面接の会話ログを分析して、受験者が表現した論理構造グラフをJSON形式で抽出してください。
ドメイン: ${domain}
会話ログ:
${convText.slice(0, 4000)}
{"nodes":[{"id":"u1","label":"概念（8文字以内）","node_type":"problem|cause|factor|solution|concept","depth":0}],"edges":[{"source":"u1","target":"u2","relation":"causes|leads_to|part_of|prevents|requires"}]}
JSONのみ出力。`;

    const extractMsg = await callLLM({ provider, apiKey, messages: [{ role: "user", content: extractPrompt }], maxTokens: 1500 });
    const userGraph = extractJSON(extractMsg.text) as LogicGraph;

    const idealSummary = { nodes: idealGraph.nodes.map(n => ({ id: n.id, label: n.label, type: n.node_type, depth: n.depth })), edges: idealGraph.edges.map(e => ({ src: e.source, tgt: e.target, rel: e.relation })) };
    const userSummary = { nodes: (userGraph.nodes || []).map(n => ({ id: n.id, label: n.label, type: n.node_type, depth: n.depth })), edges: (userGraph.edges || []).map(e => ({ src: e.source, tgt: e.target, rel: e.relation })) };

    const scorePrompt = `あなたは思考力評価の専門家です。研修ドメイン: ${domain}
【理想グラフ】${JSON.stringify(idealSummary)}
【受験者グラフ】${JSON.stringify(userSummary)}
4観点でスコアリングしJSON返却:
{"knowledge_fidelity":75,"structural_integrity":60,"hypothesis_generation":40,"thinking_depth":55,"total_score":60,"matched_concepts":["概念A"],"missing_concepts":["概念B"],"unique_insights":["視点X"],"key_feedback":"フィードバック","strength":"強み","improvement":"改善点"}
total_score = 0.2×kf + 0.35×si + 0.25×hg + 0.2×td。JSONのみ出力。`;

    const scoreMsg = await callLLM({ provider, apiKey, messages: [{ role: "user", content: scorePrompt }], maxTokens: 1000 });
    const scores = extractJSON(scoreMsg.text) as {
      knowledge_fidelity: number; structural_integrity: number;
      hypothesis_generation: number; thinking_depth: number; total_score: number;
      matched_concepts?: string[]; missing_concepts?: string[];
      unique_insights?: string[]; key_feedback?: string; strength?: string; improvement?: string;
    };

    // Save to Supabase if authenticated
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const total = scores.total_score ?? 0;
        const grade = total >= 90 ? "S" : total >= 75 ? "A" : total >= 60 ? "B" : total >= 45 ? "C" : "D";
        await supabase.from("sessions").insert({
          user_id: user.id,
          topic: topic || domain,
          mode: (mode as "whynot" | "vocabulary" | "concept" | "procedure") || "concept",
          status: "completed",
          score_knowledge_fidelity: scores.knowledge_fidelity,
          score_structural_integrity: scores.structural_integrity,
          score_hypothesis_generation: scores.hypothesis_generation,
          score_thinking_depth: scores.thinking_depth,
          score_total: scores.total_score,
          message_count: conversation.length,
          key_concepts: scores.matched_concepts || [],
          missing_concepts: scores.missing_concepts || [],
          unique_insights: scores.unique_insights || [],
          ai_feedback: scores.key_feedback || null,
          grade,
          messages: conversation as unknown as Record<string, unknown>[],
        });
        // Upsert learned concepts to knowledge graph
        for (const concept of (scores.matched_concepts || [])) {
          await supabase.from("knowledge_nodes").upsert(
            { user_id: user.id, label: concept, node_type: "concept", confidence: 0.9 },
            { onConflict: "user_id,label", ignoreDuplicates: false }
          );
        }
      }
    } catch (saveErr) {
      console.warn("Supabase save skipped:", saveErr);
    }

    return NextResponse.json({ userGraph, scores });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "スコア算出失敗" }, { status: 500 });
  }
}

export async function OPTIONS() { return corsResponse(); }
