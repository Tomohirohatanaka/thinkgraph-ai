/**
 * teachAI Knowledge Graph Engine
 * ────────────────────────────────────────────────────────────
 * ユーザーの「知識状態」をグラフ構造で表現するコアエンジン。
 *
 * 設計思想:
 *   - 概念(Concept)をノード、概念間の依存関係をエッジとして表現
 *   - 各ノードに習熟度(mastery: 0〜1)と時間減衰(forgetting curve)を持たせる
 *   - セッション結果からグラフを自動更新
 *   - 「次に何を学ぶべきか」を依存グラフから推論
 *
 * 転用:
 *   このファイルは教育・研修・HR評価など任意のドメインで
 *   フロントエンドに依存せず使用可能。
 */

// ─── 型定義 ──────────────────────────────────────────────────

export interface ConceptNode {
  id: string;                    // スラッグ（例: "react_hooks"）
  label: string;                 // 表示名（例: "React Hooks"）
  domain: string;                // 大分類（例: "Frontend", "Science"）
  mastery: number;               // 習熟度 0.0〜1.0
  sessions: number;              // このコンセプトを学んだセッション数
  last_seen: string | null;      // 最後に学習した日時（ISO8601）
  decay_rate: number;            // 忘却速度（0.1=遅い, 0.5=速い）
  confidence: number;            // 習熟度推定の確信度 0〜1
  source_sessions: string[];     // 関連セッションID
}

export interface ConceptEdge {
  source: string;                // 前提概念のID
  target: string;                // 依存概念のID
  relation: "prerequisite" | "related" | "extends" | "contrasts";
  strength: number;              // 関係の強さ 0〜1
}

export interface KnowledgeGraph {
  user_id: string;
  updated_at: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  stats: {
    total_concepts: number;
    avg_mastery: number;
    domains: Record<string, { count: number; avg_mastery: number }>;
    learning_velocity: number;   // 直近5セッションの平均mastery上昇率
    retention_score: number;     // 減衰考慮後の実効習熟度
  };
}

export interface LearningSession {
  id: string;
  date: string;
  title: string;
  domain: string;
  score: number;                 // 0〜100（5軸合計）
  mastered: string[];            // セッションで習得した概念
  gaps: string[];                // まだ理解が浅い概念
  score_breakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  coverage: number;             // 網羅性
  depth: number;                // 深さ
  clarity: number;              // 明晰さ
  structural_coherence: number; // 論理構造の整合性（v2追加）
  spontaneity: number;          // 自発性（誘導なしで説明できたか）
  total: number;
}

// ─── 忘却曲線（エビングハウス近似）─────────────────────────
// R = e^(-t / S)  t: 経過日数, S: 安定性（高いほど忘れにくい）

export function forgettingFactor(lastSeen: string | null, decayRate: number): number {
  if (!lastSeen) return 1.0;
  const days = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24);
  const stability = 1.0 / decayRate; // 高mastery → 低decay → 高安定性
  return Math.exp(-days / (stability * 10));
}

export function effectiveMastery(node: ConceptNode): number {
  const decay = forgettingFactor(node.last_seen, node.decay_rate);
  return Math.max(0, node.mastery * decay);
}

// ─── グラフ更新（セッション結果からノードを更新）────────────

export function updateGraphFromSession(
  graph: KnowledgeGraph,
  session: LearningSession
): KnowledgeGraph {
  const now = new Date().toISOString();
  const nodes = [...graph.nodes];

  // セッションスコアを0〜1の習熟度増分に変換
  const masteryGain = (session.score / 100) * 0.4; // max +0.4/session
  const domain = session.domain || inferDomain(session.title);

  // 習得概念 → mastery上昇
  for (const concept of session.mastered) {
    const nodeId = toNodeId(concept);
    const idx = nodes.findIndex(n => n.id === nodeId);
    if (idx >= 0) {
      // 既存ノードを更新（上限1.0）
      nodes[idx] = {
        ...nodes[idx],
        mastery: Math.min(1.0, nodes[idx].mastery + masteryGain),
        sessions: nodes[idx].sessions + 1,
        last_seen: now,
        decay_rate: Math.max(0.1, nodes[idx].decay_rate - 0.02), // 繰り返すほど安定
        confidence: Math.min(1.0, nodes[idx].confidence + 0.15),
        source_sessions: [...(nodes[idx].source_sessions || []).slice(-9), session.id],
      };
    } else {
      // 新規ノード追加
      nodes.push({
        id: nodeId,
        label: concept,
        domain,
        mastery: masteryGain,
        sessions: 1,
        last_seen: now,
        decay_rate: 0.3,
        confidence: 0.4,
        source_sessions: [session.id],
      });
    }
  }

  // ギャップ概念 → 低mastery状態で記録（知らないことを知る）
  for (const gap of session.gaps) {
    const nodeId = toNodeId(gap);
    const idx = nodes.findIndex(n => n.id === nodeId);
    if (idx < 0) {
      nodes.push({
        id: nodeId,
        label: gap,
        domain,
        mastery: 0.1, // 存在は認識している
        sessions: 0,
        last_seen: null,
        decay_rate: 0.4,
        confidence: 0.2,
        source_sessions: [],
      });
    }
  }

  return {
    ...graph,
    updated_at: now,
    nodes,
    stats: computeStats(nodes, graph),
  };
}

// ─── 次に学ぶべき概念を推薦 ─────────────────────────────────

export interface LearningRecommendation {
  concept: string;
  reason: string;
  priority: "high" | "medium" | "low";
  type: "gap" | "decay" | "next_step" | "reinforce";
}

export function recommendNextConcepts(graph: KnowledgeGraph, limit = 3): LearningRecommendation[] {
  const recommendations: LearningRecommendation[] = [];

  // 1. 忘却が進んでいる習熟済み概念（再強化）
  const decaying = graph.nodes
    .filter(n => n.mastery > 0.5 && effectiveMastery(n) < n.mastery * 0.7)
    .sort((a, b) => (a.mastery - effectiveMastery(a)) - (b.mastery - effectiveMastery(b)))
    .slice(0, 2);

  for (const n of decaying) {
    recommendations.push({
      concept: n.label,
      reason: `以前よく理解していたが時間が経って薄れてきた`,
      priority: "high",
      type: "decay",
    });
  }

  // 2. mastery低いまま放置されているギャップ
  const gaps = graph.nodes
    .filter(n => n.mastery < 0.3 && n.sessions === 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  for (const n of gaps) {
    recommendations.push({
      concept: n.label,
      reason: `まだ十分に理解できていない`,
      priority: "medium",
      type: "gap",
    });
  }

  // 3. 前提概念が習熟→依存概念を学ぶ準備ができた
  for (const edge of graph.edges.filter(e => e.relation === "prerequisite")) {
    const src = graph.nodes.find(n => n.id === edge.source);
    const tgt = graph.nodes.find(n => n.id === edge.target);
    if (src && tgt && effectiveMastery(src) > 0.7 && effectiveMastery(tgt) < 0.3) {
      recommendations.push({
        concept: tgt.label,
        reason: `「${src.label}」を理解しているので次のステップとして最適`,
        priority: "medium",
        type: "next_step",
      });
    }
  }

  return recommendations.slice(0, limit);
}

// ─── ユーティリティ ─────────────────────────────────────────

function toNodeId(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^\w\u3040-\u9fff]/g, "");
}

function inferDomain(title: string): string {
  const domainMap: Record<string, string[]> = {
    "フロントエンド": ["React", "Vue", "CSS", "JavaScript", "HTML", "Next"],
    "バックエンド": ["Python", "Node", "API", "DB", "SQL", "Django"],
    "AI・機械学習": ["AI", "ML", "機械学習", "深層学習", "LLM", "ChatGPT"],
    "ビジネス": ["戦略", "マーケ", "営業", "経営", "財務", "UX"],
    "理科": ["物理", "化学", "生物", "数学", "統計"],
    "社会・歴史": ["歴史", "地理", "政治", "経済", "社会"],
  };
  for (const [domain, keywords] of Object.entries(domainMap)) {
    if (keywords.some(k => title.includes(k))) return domain;
  }
  return "その他";
}

function computeStats(
  nodes: ConceptNode[],
  prev: KnowledgeGraph
): KnowledgeGraph["stats"] {
  const domains: Record<string, { count: number; avg_mastery: number }> = {};
  for (const n of nodes) {
    if (!domains[n.domain]) domains[n.domain] = { count: 0, avg_mastery: 0 };
    domains[n.domain].count++;
    domains[n.domain].avg_mastery += effectiveMastery(n);
  }
  for (const d of Object.values(domains)) {
    d.avg_mastery = d.count > 0 ? d.avg_mastery / d.count : 0;
  }

  const avgMastery = nodes.length > 0
    ? nodes.reduce((s, n) => s + effectiveMastery(n), 0) / nodes.length
    : 0;

  // 学習速度: 前回との平均mastery差分
  const prevAvg = prev.stats?.avg_mastery ?? 0;
  const velocity = Math.max(0, avgMastery - prevAvg);

  const retentionScore = nodes.length > 0
    ? nodes.reduce((s, n) => s + effectiveMastery(n) / Math.max(n.mastery, 0.01), 0) / nodes.length
    : 1.0;

  return {
    total_concepts: nodes.length,
    avg_mastery: avgMastery,
    domains,
    learning_velocity: velocity,
    retention_score: Math.min(1.0, retentionScore),
  };
}

// ─── 空グラフ生成 ────────────────────────────────────────────

export function createEmptyGraph(userId = "default"): KnowledgeGraph {
  return {
    user_id: userId,
    updated_at: new Date().toISOString(),
    nodes: [],
    edges: [],
    stats: {
      total_concepts: 0,
      avg_mastery: 0,
      domains: {},
      learning_velocity: 0,
      retention_score: 1.0,
    },
  };
}
