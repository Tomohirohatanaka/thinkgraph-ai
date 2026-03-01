"use client";

import { useMemo } from "react";

interface ConceptNode {
  id: string;
  label: string;
  domain: string;
  mastery: number;
  sessions: number;
  last_seen: string | null;
  decay_rate: number;
  confidence: number;
}

interface KnowledgeGraph {
  nodes: ConceptNode[];
  edges: unknown[];
  stats: { total_concepts: number; avg_mastery: number; retention_score: number };
}

interface ReviewItem {
  label: string;
  mastery: number;
  effective: number;
  decayPercent: number;
  daysSince: number;
  urgency: "critical" | "warning" | "mild";
}

function forgettingFactor(lastSeen: string | null, decayRate: number): number {
  if (!lastSeen) return 1.0;
  const days = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24);
  const stability = 1.0 / decayRate;
  return Math.exp(-days / (stability * 10));
}

function effectiveMastery(node: ConceptNode): number {
  return Math.max(0, node.mastery * forgettingFactor(node.last_seen, node.decay_rate));
}

function daysSinceSeen(lastSeen: string | null): number {
  if (!lastSeen) return 999;
  return (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24);
}

export default function ReviewReminder({
  graph,
  accentColor,
  onSelectTopic,
}: {
  graph: KnowledgeGraph | null;
  accentColor: string;
  onSelectTopic: (topic: string) => void;
}) {
  const reviewItems = useMemo<ReviewItem[]>(() => {
    if (!graph?.nodes?.length) return [];

    return graph.nodes
      .filter(n => n.mastery > 0.3 && n.sessions > 0 && n.last_seen)
      .map(n => {
        const eff = effectiveMastery(n);
        const decay = n.mastery > 0 ? 1 - eff / n.mastery : 0;
        const days = daysSinceSeen(n.last_seen);
        return {
          label: n.label,
          mastery: n.mastery,
          effective: eff,
          decayPercent: Math.round(decay * 100),
          daysSince: Math.round(days),
          urgency: decay > 0.5 ? "critical" as const : decay > 0.25 ? "warning" as const : "mild" as const,
        };
      })
      .filter(r => r.decayPercent >= 15)
      .sort((a, b) => b.decayPercent - a.decayPercent)
      .slice(0, 5);
  }, [graph]);

  if (!reviewItems.length) return null;

  const criticalCount = reviewItems.filter(r => r.urgency === "critical").length;

  const urgencyColor = {
    critical: "#EF4444",
    warning: "#F59E0B",
    mild: "#94A3B8",
  };

  const urgencyBg = {
    critical: "#FEF2F2",
    warning: "#FFFBEB",
    mild: "#F8FAFC",
  };

  return (
    <div style={{
      marginBottom: "1rem",
      borderRadius: 16,
      border: criticalCount > 0 ? "1.5px solid #EF444425" : "1.5px solid #F59E0B20",
      background: criticalCount > 0
        ? "linear-gradient(135deg, #FEF2F2, #FFF7ED)"
        : "linear-gradient(135deg, #FFFBEB, #FFF7ED)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.75rem 1rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>
              復習リマインド
            </div>
            <div style={{ fontSize: 11, color: "#999" }}>
              忘却曲線に基づく分析
            </div>
          </div>
        </div>
        {criticalCount > 0 && (
          <div style={{
            padding: "2px 10px", borderRadius: 100,
            background: "#EF4444", color: "#fff",
            fontSize: 11, fontWeight: 700,
          }}>
            {criticalCount}件 急ぎ
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{ padding: "0 0.75rem 0.75rem" }}>
        {reviewItems.map((item, i) => (
          <button
            key={item.label}
            onClick={() => onSelectTopic(item.label)}
            style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              width: "100%", textAlign: "left",
              padding: "0.6rem 0.75rem",
              background: urgencyBg[item.urgency],
              border: "none",
              borderRadius: i === 0 ? "12px 12px 4px 4px"
                : i === reviewItems.length - 1 ? "4px 4px 12px 12px"
                : "4px",
              marginBottom: i < reviewItems.length - 1 ? 2 : 0,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.01)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
          >
            {/* Decay indicator */}
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${urgencyColor[item.urgency]}15`,
              border: `2px solid ${urgencyColor[item.urgency]}40`,
              flexShrink: 0,
              position: "relative",
            }}>
              <svg width="36" height="36" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
                <circle cx="18" cy="18" r="15" fill="none" stroke={`${urgencyColor[item.urgency]}20`} strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke={urgencyColor[item.urgency]}
                  strokeWidth="3"
                  strokeDasharray={`${(1 - item.decayPercent / 100) * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <span style={{ fontSize: 10, fontWeight: 800, color: urgencyColor[item.urgency], position: "relative", zIndex: 1 }}>
                {100 - item.decayPercent}%
              </span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "#333",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.label}
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                {item.daysSince}日前に学習 · 記憶保持率 {100 - item.decayPercent}%
              </div>
            </div>

            {/* Action */}
            <div style={{
              padding: "4px 10px", borderRadius: 8,
              background: accentColor,
              color: "#fff",
              fontSize: 11, fontWeight: 700,
              flexShrink: 0,
            }}>
              復習
            </div>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: "0.5rem 1rem",
        borderTop: "1px solid #0001",
        fontSize: 10, color: "#bbb", textAlign: "center",
      }}>
        エビングハウスの忘却曲線モデルで最適な復習タイミングを算出
      </div>
    </div>
  );
}
