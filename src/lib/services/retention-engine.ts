/**
 * teachAI Retention Engine
 * ─────────────────────────────────────────────────────────────
 * Drives user engagement through intelligent retention mechanics.
 *
 * Features:
 *   - Spaced repetition scheduling (SM-2 inspired)
 *   - Gamification: achievements, badges, streaks
 *   - Proactive review notifications
 *   - Social proof mechanics
 */

// ─── Achievement System ─────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: "learning" | "streak" | "mastery" | "social" | "exploration";
  condition: (stats: UserStats) => boolean;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

export interface UserStats {
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  totalMastered: number;
  avgScore: number;
  uniqueTopics: number;
  totalDays: number;
  gradeACounts: number;
  gradeSCount: number;
  modesUsed: Set<string>;
  consecutiveHighScores: number;
}

export interface UnlockedAchievement {
  achievement: Achievement;
  unlockedAt: string;
  isNew: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Learning milestones
  { id: "first_teach", title: "はじめの一歩", description: "初めてのセッションを完了", emoji: "🎉", category: "learning", tier: "bronze", condition: (s) => s.totalSessions >= 1 },
  { id: "five_sessions", title: "教え上手", description: "5回のセッションを完了", emoji: "📚", category: "learning", tier: "bronze", condition: (s) => s.totalSessions >= 5 },
  { id: "ten_sessions", title: "ティーチャー", description: "10回のセッションを完了", emoji: "🏫", category: "learning", tier: "silver", condition: (s) => s.totalSessions >= 10 },
  { id: "twentyfive_sessions", title: "マスターティーチャー", description: "25回のセッションを完了", emoji: "🎓", category: "learning", tier: "gold", condition: (s) => s.totalSessions >= 25 },
  { id: "fifty_sessions", title: "教育の達人", description: "50回のセッションを完了", emoji: "👨‍🏫", category: "learning", tier: "platinum", condition: (s) => s.totalSessions >= 50 },

  // Streak achievements
  { id: "streak_3", title: "3日連続", description: "3日連続で学習", emoji: "🔥", category: "streak", tier: "bronze", condition: (s) => s.currentStreak >= 3 },
  { id: "streak_7", title: "一週間の習慣", description: "7日連続で学習", emoji: "💪", category: "streak", tier: "silver", condition: (s) => s.currentStreak >= 7 },
  { id: "streak_14", title: "二週間チャレンジ", description: "14日連続で学習", emoji: "⭐", category: "streak", tier: "gold", condition: (s) => s.currentStreak >= 14 },
  { id: "streak_30", title: "30日間マラソン", description: "30日連続で学習", emoji: "🏆", category: "streak", tier: "platinum", condition: (s) => s.longestStreak >= 30 },

  // Mastery achievements
  { id: "first_a", title: "A評価獲得", description: "初めてA評価を達成", emoji: "💯", category: "mastery", tier: "silver", condition: (s) => s.gradeACounts >= 1 },
  { id: "first_s", title: "S評価達成", description: "初めてS評価を達成", emoji: "🌟", category: "mastery", tier: "gold", condition: (s) => s.gradeSCount >= 1 },
  { id: "high_avg", title: "安定のハイスコア", description: "平均スコア80以上", emoji: "📈", category: "mastery", tier: "gold", condition: (s) => s.avgScore >= 80 && s.totalSessions >= 5 },
  { id: "perfect_streak", title: "連続A評価", description: "5回連続でA評価以上", emoji: "✨", category: "mastery", tier: "platinum", condition: (s) => s.consecutiveHighScores >= 5 },

  // Exploration achievements
  { id: "all_modes", title: "全モード体験", description: "全4モードを使用", emoji: "🧭", category: "exploration", tier: "silver", condition: (s) => s.modesUsed.size >= 4 },
  { id: "five_topics", title: "好奇心旺盛", description: "5種類のトピックを学習", emoji: "🌈", category: "exploration", tier: "silver", condition: (s) => s.uniqueTopics >= 5 },
  { id: "ten_topics", title: "博学多才", description: "10種類のトピックを学習", emoji: "📖", category: "exploration", tier: "gold", condition: (s) => s.uniqueTopics >= 10 },
  { id: "mastered_10", title: "概念マスター", description: "10個の概念をマスター", emoji: "🧠", category: "mastery", tier: "silver", condition: (s) => s.totalMastered >= 10 },
];

export function checkAchievements(
  stats: UserStats,
  previouslyUnlocked: string[] = []
): UnlockedAchievement[] {
  const result: UnlockedAchievement[] = [];
  const previousSet = new Set(previouslyUnlocked);

  for (const achievement of ACHIEVEMENTS) {
    if (achievement.condition(stats)) {
      result.push({
        achievement,
        unlockedAt: new Date().toISOString(),
        isNew: !previousSet.has(achievement.id),
      });
    }
  }

  return result;
}

// ─── Spaced Repetition Scheduler ────────────────────────────

export interface ReviewItem {
  concept: string;
  lastReviewDate: string;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
}

export function scheduleReview(
  item: ReviewItem,
  quality: number // 0-5 (0=complete failure, 5=perfect)
): ReviewItem {
  let { interval, easeFactor, repetitions } = item;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const now = new Date();
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    ...item,
    lastReviewDate: now.toISOString(),
    nextReviewDate: nextDate.toISOString(),
    interval,
    easeFactor,
    repetitions,
  };
}

export function getDueReviews(items: ReviewItem[]): ReviewItem[] {
  const now = new Date().toISOString();
  return items
    .filter((item) => item.nextReviewDate <= now)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
}

// ─── Engagement Score ───────────────────────────────────────

export function calculateEngagementScore(stats: UserStats): {
  score: number;
  level: "low" | "medium" | "high" | "very_high";
  factors: Record<string, number>;
} {
  const factors: Record<string, number> = {};

  // Recency (0-25): how recent was last session
  factors.recency = Math.min(25, stats.currentStreak > 0 ? 25 : Math.max(0, 25 - stats.totalDays * 2));

  // Frequency (0-25): sessions per week
  const sessionsPerWeek = stats.totalDays > 0 ? (stats.totalSessions / stats.totalDays) * 7 : 0;
  factors.frequency = Math.min(25, sessionsPerWeek * 5);

  // Performance (0-25): average score
  factors.performance = Math.min(25, (stats.avgScore / 100) * 25);

  // Diversity (0-25): variety of topics and modes
  factors.diversity = Math.min(25, (stats.uniqueTopics * 3 + stats.modesUsed.size * 3));

  const score = Math.round(Object.values(factors).reduce((s, v) => s + v, 0));
  const level: "low" | "medium" | "high" | "very_high" =
    score >= 80 ? "very_high" : score >= 55 ? "high" : score >= 30 ? "medium" : "low";

  return { score, level, factors };
}
