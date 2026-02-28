/**
 * teachAI Analytics Engine
 * ─────────────────────────────────────────────────────────────
 * 学習履歴から統計・インサイト・知識グラフを生成するAPI。
 * B2B転用時のHRダッシュボード基盤として設計。
 */

import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import {
  updateGraphFromSession,
  createEmptyGraph,
  recommendNextConcepts,
  effectiveMastery,
  type KnowledgeGraph,
  type LearningSession,
  type ScoreBreakdown,
} from "@/lib/knowledge-graph";

interface ProfileEntry {
  id?: string; date?: string; title: string; mode: string;
  score: number; mastered: string[]; gaps: string[];
  score_breakdown?: ScoreBreakdown;
}

export async function POST(req: NextRequest) {
  try {
    const { profile, existingGraph } = await req.json() as {
      profile: ProfileEntry[];
      existingGraph?: KnowledgeGraph;
    };

    if (!profile?.length) {
      return NextResponse.json({ error: "学習履歴がありません" }, { status: 400 });
    }

    // 知識グラフを構築（既存グラフがあれば引き継ぐ）
    let graph = existingGraph ?? createEmptyGraph();
    for (const entry of profile) {
      const session: LearningSession = {
        id: entry.id ?? `${entry.date}_${entry.title}`,
        date: entry.date ?? new Date().toISOString(),
        title: entry.title,
        domain: "",
        score: entry.score,
        mastered: entry.mastered,
        gaps: entry.gaps,
        score_breakdown: entry.score_breakdown,
      };
      graph = updateGraphFromSession(graph, session);
    }

    // 推薦
    const recommendations = recommendNextConcepts(graph, 5);

    // 時系列分析
    const timeline = profile.map((p, i) => ({
      session: i + 1,
      title: p.title,
      score: p.score,
      date: p.date,
      mastered_count: p.mastered.length,
    }));

    const scores = profile.map(p => p.score);
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    const trend = scores.length >= 3
      ? scores.slice(-3).reduce((s, v) => s + v, 0) / 3 - scores.slice(0, 3).reduce((s, v) => s + v, 0) / 3
      : 0;

    // モード別分析
    const byMode: Record<string, { count: number; avg: number; scores: number[] }> = {};
    for (const p of profile) {
      if (!byMode[p.mode]) byMode[p.mode] = { count: 0, avg: 0, scores: [] };
      byMode[p.mode].count++;
      byMode[p.mode].scores.push(p.score);
    }
    for (const m of Object.values(byMode)) {
      m.avg = m.scores.reduce((s, v) => s + v, 0) / m.scores.length;
    }

    // トップコンセプト（習熟度高い順）
    const topConcepts = [...graph.nodes]
      .sort((a, b) => effectiveMastery(b) - effectiveMastery(a))
      .slice(0, 10)
      .map(n => ({
        label: n.label,
        domain: n.domain,
        mastery: Math.round(effectiveMastery(n) * 100),
        sessions: n.sessions,
      }));

    // 学習強度マップ（ドメイン × 時期）
    const domainTimeline: Record<string, number[]> = {};
    for (const p of profile) {
      const domain = graph.nodes.find(n => n.source_sessions.includes(p.id ?? ""))?.domain ?? "その他";
      if (!domainTimeline[domain]) domainTimeline[domain] = [];
      domainTimeline[domain].push(p.score);
    }

    return NextResponse.json({
      graph,
      stats: {
        total_sessions: profile.length,
        avg_score: Math.round(avgScore),
        score_trend: Math.round(trend * 10) / 10,
        trend_label: trend > 5 ? "上昇中" : trend < -5 ? "下降気味" : "安定",
        best_score: Math.max(...scores),
        latest_score: scores[scores.length - 1],
        by_mode: byMode,
        total_concepts: graph.stats.total_concepts,
        avg_mastery_pct: Math.round(graph.stats.avg_mastery * 100),
        retention_pct: Math.round(graph.stats.retention_score * 100),
        learning_velocity: Math.round(graph.stats.learning_velocity * 1000) / 10,
      },
      top_concepts: topConcepts,
      recommendations,
      timeline,
      domain_timeline: domainTimeline,
    }, { headers: CORS_HEADERS });

  } catch (e) {
    console.error("analytics error:", e);
    return NextResponse.json({ error: "分析失敗" }, { status: 500 });
  }
}

export async function OPTIONS() { return corsResponse(); }
