/**
 * teachAI Proactive System
 * ────────────────────────────────────────────────────────────
 * キャラクターが主体的に「次に何を教えてほしいか」を提案するAPI。
 */

import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import {
  recommendNextConcepts,
  type KnowledgeGraph,
} from "@/lib/knowledge-graph";

interface Character {
  name: string; emoji: string;
  personality: string; speaking_style: string;
  knowledge_areas: string[];
  interests: string[];
}

interface ProfileEntry {
  title: string; score: number; mastered: string[]; gaps: string[]; date?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, character, graph, profile } = await req.json() as {
      apiKey: string;
      character: Character;
      graph?: KnowledgeGraph;
      profile: ProfileEntry[];
    };

    if (!apiKey?.length) {
      return NextResponse.json({ error: "APIキーが必要です" }, { status: 400 });
    }
    const provider = detectProvider(apiKey);

    const recommendations = graph ? recommendNextConcepts(graph, 3) : [];
    const recentTopics = profile.slice(-3).map(p => p.title);
    const allGaps = [...new Set(profile.flatMap(p => p.gaps))].slice(0, 5);
    const weakAreas = profile.filter(p => p.score < 65).map(p => p.title).slice(0, 3);

    const candStr = recommendations.length > 0
      ? recommendations.map(r => `- 「${r.concept}」（${r.reason}）`).join("\n")
      : allGaps.length > 0
        ? allGaps.map(g => `- 「${g}」（まだよくわかっていない）`).join("\n")
        : recentTopics.map(t => `- 「${t}」の関連トピック`).join("\n");

    const llmRes = await callLLM({
      provider,
      apiKey,
      messages: [{ role: 'user', content: '' }],
      maxTokens: 600,
    });

    const raw = llmRes.text;
    const match = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Parse failed");
    const result = JSON.parse(match[0]);

    return NextResponse.json({ ...result, recommendations, weak_areas: weakAreas }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error("proactive error:", e);
    return NextResponse.json({ error: "提案生成失敗" }, { status: 500 });
  }
}

export async function OPTIONS() { return corsResponse(); }
