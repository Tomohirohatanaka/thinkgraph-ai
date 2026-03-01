/**
 * teachAI Analytics Engine
 * ─────────────────────────────────────────────────────────────
 * Client-side analytics computation for learning insights.
 * Processes session history into actionable metrics.
 *
 * Designed for:
 *   - Dashboard visualizations
 *   - Retention predictions
 *   - Learning pattern detection
 *   - Growth trajectory forecasting
 */

import type { ProfileEntry } from "../state/learning-store";

// ─── Types ──────────────────────────────────────────────────

export interface LearningTrend {
  period: string;
  avgScore: number;
  sessions: number;
  improvement: number;
}

export interface LearningPattern {
  bestTimeOfDay: string;
  bestDayOfWeek: string;
  avgSessionsPerWeek: number;
  consistencyScore: number;
  topMode: string;
}

export interface RetentionForecast {
  conceptsAtRisk: string[];
  daysUntilDecay: number;
  suggestedReviewDate: string;
}

export interface GrowthMetrics {
  velocityTrend: "accelerating" | "steady" | "decelerating" | "stalled";
  scoreTrend: "improving" | "stable" | "declining";
  projectedGrade: string;
  weeklyGrowthRate: number;
}

export interface ComprehensiveAnalytics {
  trends: LearningTrend[];
  patterns: LearningPattern;
  growth: GrowthMetrics;
  retention: RetentionForecast;
  milestones: Milestone[];
  summary: string;
}

export interface Milestone {
  type: "first_session" | "streak" | "grade" | "mastery" | "sessions";
  label: string;
  achievedAt: string;
  value: number;
}

// ─── Trend Analysis ─────────────────────────────────────────

export function computeTrends(
  sessions: ProfileEntry[],
  periodDays = 7
): LearningTrend[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const trends: LearningTrend[] = [];
  const startDate = new Date(sorted[0].date);
  const endDate = new Date(sorted[sorted.length - 1].date);

  let periodStart = new Date(startDate);
  let prevAvg = 0;

  while (periodStart <= endDate) {
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + periodDays);

    const periodSessions = sorted.filter((s) => {
      const d = new Date(s.date);
      return d >= periodStart && d < periodEnd;
    });

    if (periodSessions.length > 0) {
      const avgScore =
        periodSessions.reduce((sum, s) => sum + s.score, 0) /
        periodSessions.length;
      const improvement = prevAvg > 0 ? avgScore - prevAvg : 0;

      trends.push({
        period: periodStart.toISOString().slice(0, 10),
        avgScore: Math.round(avgScore * 10) / 10,
        sessions: periodSessions.length,
        improvement: Math.round(improvement * 10) / 10,
      });

      prevAvg = avgScore;
    }

    periodStart = periodEnd;
  }

  return trends;
}

// ─── Pattern Detection ──────────────────────────────────────

export function detectPatterns(sessions: ProfileEntry[]): LearningPattern {
  if (sessions.length === 0) {
    return {
      bestTimeOfDay: "不明",
      bestDayOfWeek: "不明",
      avgSessionsPerWeek: 0,
      consistencyScore: 0,
      topMode: "concept",
    };
  }

  // Time of day analysis
  const hourBuckets: Record<string, { count: number; totalScore: number }> = {
    朝: { count: 0, totalScore: 0 },
    昼: { count: 0, totalScore: 0 },
    夕方: { count: 0, totalScore: 0 },
    夜: { count: 0, totalScore: 0 },
  };

  const dayBuckets: Record<string, { count: number; totalScore: number }> = {};
  const modeCounts: Record<string, number> = {};

  for (const s of sessions) {
    const d = new Date(s.date);
    const hour = d.getHours();
    const bucket =
      hour < 10 ? "朝" : hour < 14 ? "昼" : hour < 18 ? "夕方" : "夜";
    hourBuckets[bucket].count++;
    hourBuckets[bucket].totalScore += s.score;

    const dayName = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    if (!dayBuckets[dayName]) dayBuckets[dayName] = { count: 0, totalScore: 0 };
    dayBuckets[dayName].count++;
    dayBuckets[dayName].totalScore += s.score;

    modeCounts[s.mode] = (modeCounts[s.mode] || 0) + 1;
  }

  // Best time: highest average score with at least 2 sessions
  const bestTime = Object.entries(hourBuckets)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].totalScore / b[1].count - a[1].totalScore / a[1].count)[0]?.[0] ?? "不明";

  const bestDay = Object.entries(dayBuckets)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].totalScore / b[1].count - a[1].totalScore / a[1].count)[0]?.[0] ?? "不明";

  // Weekly average
  const dates = sessions.map((s) => new Date(s.date).getTime());
  const spanDays = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / 86400000);
  const avgPerWeek = (sessions.length / spanDays) * 7;

  // Consistency: how many of the last 14 days had sessions
  const last14 = new Set<string>();
  const now = Date.now();
  for (const s of sessions) {
    const d = new Date(s.date);
    if (now - d.getTime() < 14 * 86400000) {
      last14.add(d.toISOString().slice(0, 10));
    }
  }
  const consistencyScore = Math.min(1, last14.size / 7);

  const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "concept";

  return {
    bestTimeOfDay: bestTime,
    bestDayOfWeek: bestDay,
    avgSessionsPerWeek: Math.round(avgPerWeek * 10) / 10,
    consistencyScore: Math.round(consistencyScore * 100) / 100,
    topMode,
  };
}

// ─── Growth Metrics ─────────────────────────────────────────

export function computeGrowth(sessions: ProfileEntry[]): GrowthMetrics {
  if (sessions.length < 3) {
    return {
      velocityTrend: "stalled",
      scoreTrend: "stable",
      projectedGrade: "—",
      weeklyGrowthRate: 0,
    };
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Split into halves
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const avgFirst = firstHalf.reduce((s, e) => s + e.score, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, e) => s + e.score, 0) / secondHalf.length;

  // Recent 5 vs previous 5
  const recent5 = sorted.slice(-5);
  const prev5 = sorted.slice(-10, -5);
  const avgRecent = recent5.reduce((s, e) => s + e.score, 0) / recent5.length;
  const avgPrev = prev5.length > 0 ? prev5.reduce((s, e) => s + e.score, 0) / prev5.length : avgRecent;

  const recentDelta = avgRecent - avgPrev;

  const velocityTrend: GrowthMetrics["velocityTrend"] =
    recentDelta > 5 ? "accelerating" :
    recentDelta > -2 ? "steady" :
    recentDelta > -8 ? "decelerating" : "stalled";

  const scoreTrend: GrowthMetrics["scoreTrend"] =
    avgSecond > avgFirst + 3 ? "improving" :
    avgSecond < avgFirst - 3 ? "declining" : "stable";

  const projectedScore = avgRecent + recentDelta * 0.5;
  const projectedGrade =
    projectedScore >= 90 ? "S" :
    projectedScore >= 80 ? "A" :
    projectedScore >= 60 ? "B" :
    projectedScore >= 45 ? "C" : "D";

  // Weekly growth rate
  const dates = sorted.map((s) => new Date(s.date).getTime());
  const weekSpan = Math.max(1, (dates[dates.length - 1] - dates[0]) / (7 * 86400000));
  const weeklyGrowth = (avgSecond - avgFirst) / weekSpan;

  return {
    velocityTrend,
    scoreTrend,
    projectedGrade,
    weeklyGrowthRate: Math.round(weeklyGrowth * 10) / 10,
  };
}

// ─── Milestones ─────────────────────────────────────────────

export function detectMilestones(sessions: ProfileEntry[]): Milestone[] {
  const milestones: Milestone[] = [];

  if (sessions.length === 0) return milestones;

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // First session
  milestones.push({
    type: "first_session",
    label: "はじめての学習",
    achievedAt: sorted[0].date,
    value: 1,
  });

  // Session count milestones
  const sessionMilestones = [5, 10, 25, 50, 100];
  for (const n of sessionMilestones) {
    if (sorted.length >= n) {
      milestones.push({
        type: "sessions",
        label: `${n}セッション達成`,
        achievedAt: sorted[n - 1].date,
        value: n,
      });
    }
  }

  // First high grade
  const firstA = sorted.find((s) => s.score >= 80);
  if (firstA) {
    milestones.push({
      type: "grade",
      label: "はじめてのA評価",
      achievedAt: firstA.date,
      value: firstA.score,
    });
  }

  const firstS = sorted.find((s) => s.score >= 90);
  if (firstS) {
    milestones.push({
      type: "grade",
      label: "はじめてのS評価",
      achievedAt: firstS.date,
      value: firstS.score,
    });
  }

  // Total mastered concepts
  const allMastered = new Set<string>();
  for (const s of sorted) {
    for (const m of s.mastered) allMastered.add(m);
    if (allMastered.size >= 10 && !milestones.find((m) => m.type === "mastery")) {
      milestones.push({
        type: "mastery",
        label: "10概念マスター",
        achievedAt: s.date,
        value: 10,
      });
    }
  }

  return milestones.sort(
    (a, b) => new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime()
  );
}

// ─── Summary Generator ──────────────────────────────────────

export function generateAnalyticsSummary(
  sessions: ProfileEntry[],
  growth: GrowthMetrics,
  patterns: LearningPattern
): string {
  if (sessions.length === 0) return "まだ学習セッションがありません。最初の一歩を踏み出しましょう！";
  if (sessions.length < 3) return "まだデータが少ないですが、良いスタートです！学習を続けると詳しい分析が見られます。";

  const parts: string[] = [];

  if (growth.scoreTrend === "improving") {
    parts.push("スコアが着実に向上しています");
  } else if (growth.scoreTrend === "declining") {
    parts.push("最近のスコアがやや低下傾向です。復習を意識してみましょう");
  }

  if (growth.velocityTrend === "accelerating") {
    parts.push("学習の加速が見られます！この調子で続けましょう");
  }

  if (patterns.consistencyScore > 0.7) {
    parts.push("学習の継続性が素晴らしいです");
  } else if (patterns.consistencyScore < 0.3) {
    parts.push("定期的な学習で記憶定着が大幅に改善します");
  }

  if (patterns.bestTimeOfDay !== "不明") {
    parts.push(`${patterns.bestTimeOfDay}の学習が最も効果的です`);
  }

  return parts.join("。") + "。";
}

// ─── Full Analytics Computation ─────────────────────────────

export function computeFullAnalytics(sessions: ProfileEntry[]): ComprehensiveAnalytics {
  const trends = computeTrends(sessions);
  const patterns = detectPatterns(sessions);
  const growth = computeGrowth(sessions);
  const milestones = detectMilestones(sessions);

  // Simple retention forecast
  const allConcepts = new Map<string, string>();
  for (const s of sessions) {
    for (const m of s.mastered) {
      allConcepts.set(m, s.date);
    }
  }

  const now = Date.now();
  const atRisk = Array.from(allConcepts.entries())
    .filter(([, date]) => now - new Date(date).getTime() > 7 * 86400000)
    .map(([concept]) => concept)
    .slice(0, 5);

  const oldestMastered = Math.min(
    ...Array.from(allConcepts.values()).map((d) => new Date(d).getTime())
  );
  const daysUntilDecay = Math.max(0, Math.round((oldestMastered + 14 * 86400000 - now) / 86400000));
  const suggestedReviewDate = new Date(now + daysUntilDecay * 86400000).toISOString().slice(0, 10);

  const retention: RetentionForecast = {
    conceptsAtRisk: atRisk,
    daysUntilDecay,
    suggestedReviewDate,
  };

  const summary = generateAnalyticsSummary(sessions, growth, patterns);

  return { trends, patterns, growth, retention, milestones, summary };
}
