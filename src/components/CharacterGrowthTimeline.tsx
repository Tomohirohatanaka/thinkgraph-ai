"use client";

import { useMemo } from "react";

interface GrowthStage { label: string; threshold: number; }
interface Character {
  id: string; name: string; emoji: string; color: string;
  personality: string; speaking_style: string;
  growth_stages: GrowthStage[];
  evolution_log: string[];
}

interface ProfileEntry {
  id: string; date: string; title: string; mode: string;
  score: number; mastered: string[]; gaps: string[];
}

interface MilestoneItem {
  type: "stage" | "session" | "streak" | "achievement";
  label: string;
  detail: string;
  icon: string;
  sessionIndex: number;
  color: string;
}

export default function CharacterGrowthTimeline({
  char,
  profile,
  accentColor,
}: {
  char: Character;
  profile: ProfileEntry[];
  accentColor: string;
}) {
  const milestones = useMemo<MilestoneItem[]>(() => {
    const items: MilestoneItem[] = [];
    const sortedStages = [...(char.growth_stages || [])].sort((a, b) => a.threshold - b.threshold);

    // Stage milestones
    for (const stage of sortedStages) {
      const reached = profile.length >= stage.threshold;
      items.push({
        type: "stage",
        label: stage.label,
        detail: `${stage.threshold}セッション達成`,
        icon: reached ? "⭐" : "🔒",
        sessionIndex: stage.threshold,
        color: reached ? accentColor : "#CBD5E1",
      });
    }

    // Achievement milestones based on profile
    if (profile.length >= 1) {
      items.push({
        type: "session",
        label: "はじめての教え合い",
        detail: `「${profile[profile.length - 1]?.title}」を初めて教えた`,
        icon: "🎯",
        sessionIndex: 1,
        color: "#22C55E",
      });
    }

    // Score achievements
    const highScores = profile.filter(p => p.score >= 80);
    if (highScores.length >= 1) {
      items.push({
        type: "achievement",
        label: "教え上手",
        detail: "初めて80点以上を獲得",
        icon: "🏆",
        sessionIndex: profile.length - profile.indexOf(highScores[0]),
        color: "#F59E0B",
      });
    }

    const perfectScores = profile.filter(p => p.score >= 95);
    if (perfectScores.length >= 1) {
      items.push({
        type: "achievement",
        label: "完璧な教師",
        detail: "95点以上を獲得！",
        icon: "💎",
        sessionIndex: profile.length - profile.indexOf(perfectScores[0]),
        color: "#8B5CF6",
      });
    }

    // Topic diversity
    const uniqueTopics = new Set(profile.map(p => p.title));
    if (uniqueTopics.size >= 5) {
      items.push({
        type: "achievement",
        label: "博学の教師",
        detail: `${uniqueTopics.size}の異なるトピックを教えた`,
        icon: "📚",
        sessionIndex: Math.min(profile.length, 5),
        color: "#6366F1",
      });
    }

    // Evolution log entries
    const logs = [...(char.evolution_log || [])];
    logs.forEach((log, i) => {
      items.push({
        type: "session",
        label: "性格の変化",
        detail: log,
        icon: "✨",
        sessionIndex: profile.length - logs.length + i + 1,
        color: accentColor,
      });
    });

    return items
      .sort((a, b) => a.sessionIndex - b.sessionIndex)
      .slice(0, 12);
  }, [char, profile, accentColor]);

  if (!milestones.length) return null;

  const currentStageIdx = [...(char.growth_stages || [])]
    .sort((a, b) => a.threshold - b.threshold)
    .findIndex(s => profile.length < s.threshold);
  const progressToNext = (() => {
    const sorted = [...(char.growth_stages || [])].sort((a, b) => a.threshold - b.threshold);
    const next = sorted.find(s => s.threshold > profile.length);
    const prev = [...sorted].reverse().find(s => s.threshold <= profile.length);
    if (!next) return 100;
    const start = prev?.threshold || 0;
    return Math.round(((profile.length - start) / (next.threshold - start)) * 100);
  })();

  return (
    <div className="card" style={{
      marginBottom: "1rem",
      borderColor: `${accentColor}25`,
      background: `${accentColor}03`,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        marginBottom: "1rem",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28,
          background: `${accentColor}12`,
          border: `2px solid ${accentColor}30`,
        }}>
          {char.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>
            {char.name}の成長記録
          </div>
          <div style={{ fontSize: 11, color: "#999" }}>
            {profile.length}セッション · 次のステージまで{progressToNext < 100 ? `${100 - progressToNext}%` : "最高到達"}
          </div>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{
          height: 6, background: "#F1F5F9", borderRadius: 3,
          overflow: "hidden", position: "relative",
        }}>
          {/* Stage markers */}
          {[...(char.growth_stages || [])].sort((a, b) => a.threshold - b.threshold).map((stage, i) => {
            const maxThreshold = Math.max(...(char.growth_stages || []).map(s => s.threshold), profile.length);
            const pos = (stage.threshold / maxThreshold) * 100;
            const reached = profile.length >= stage.threshold;
            return (
              <div key={i} style={{
                position: "absolute",
                left: `${pos}%`,
                top: -3, width: 12, height: 12,
                borderRadius: "50%",
                background: reached ? accentColor : "#CBD5E1",
                border: "2px solid #fff",
                zIndex: 2,
                transform: "translateX(-50%)",
              }} />
            );
          })}
          {/* Progress fill */}
          <div style={{
            height: "100%",
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}AA)`,
            borderRadius: 3,
            width: `${Math.min(100, (profile.length / Math.max(...(char.growth_stages || []).map(s => s.threshold), 1)) * 100)}%`,
            transition: "width 1s ease",
          }} />
        </div>
        {/* Stage labels */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem" }}>
          {[...(char.growth_stages || [])].sort((a, b) => a.threshold - b.threshold).map((stage, i) => (
            <div key={i} style={{
              fontSize: 9, color: profile.length >= stage.threshold ? accentColor : "#CBD5E1",
              fontWeight: profile.length >= stage.threshold ? 700 : 400,
              textAlign: "center",
            }}>
              {stage.label}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", paddingLeft: "1.25rem" }}>
        {/* Vertical line */}
        <div style={{
          position: "absolute", left: 8, top: 4, bottom: 4,
          width: 2, background: "#F1F5F9", borderRadius: 1,
        }} />

        {milestones.map((m, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: "0.75rem",
            marginBottom: i < milestones.length - 1 ? "0.75rem" : 0,
            position: "relative",
          }}>
            {/* Timeline dot */}
            <div style={{
              position: "absolute", left: "-1.25rem",
              width: 18, height: 18, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10,
              background: "#fff",
              border: `2px solid ${m.color}`,
              zIndex: 1,
            }}>
              {m.icon}
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              padding: "0.4rem 0.6rem",
              background: m.type === "stage" ? `${m.color}08` : "transparent",
              borderRadius: 8,
              borderLeft: m.type === "stage" ? `3px solid ${m.color}` : "none",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{
                  fontSize: 12, fontWeight: m.type === "stage" ? 700 : 500,
                  color: m.type === "stage" ? m.color : "#555",
                }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 10, color: "#CBD5E1" }}>
                  #{m.sessionIndex}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 1, lineHeight: 1.4 }}>
                {m.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div style={{
        display: "flex", gap: "0.5rem", marginTop: "1rem",
        borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem",
      }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: accentColor }}>{profile.length}</div>
          <div style={{ fontSize: 10, color: "#999" }}>総セッション</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#22C55E" }}>
            {profile.length > 0 ? Math.round(profile.reduce((s, p) => s + p.score, 0) / profile.length) : 0}
          </div>
          <div style={{ fontSize: 10, color: "#999" }}>平均スコア</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#6366F1" }}>
            {new Set(profile.map(p => p.title)).size}
          </div>
          <div style={{ fontSize: 10, color: "#999" }}>教えた話題</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#F59E0B" }}>
            {currentStageIdx === -1 ? "MAX" : `Lv.${Math.max(0, [...(char.growth_stages || [])].sort((a, b) => a.threshold - b.threshold).filter(s => profile.length >= s.threshold).length)}`}
          </div>
          <div style={{ fontSize: 10, color: "#999" }}>成長段階</div>
        </div>
      </div>
    </div>
  );
}
