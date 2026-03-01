"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Session {
  id: string; topic: string; mode: string; grade: string | null; score_total: number | null;
  key_concepts: string[] | null; created_at: string;
  score_knowledge_fidelity: number | null; score_structural_integrity: number | null;
  score_hypothesis_generation: number | null; score_thinking_depth: number | null;
}
interface Stats { total_sessions: number; avg_score: number; total_seconds: number; last_session_at: string; unique_topics: number; }
interface Concept { label: string; node_type: string; mention_count: number; confidence: number; }
interface User { id: string; email: string; name: string; role: string; }

const GRADE_COLOR: Record<string, string> = { S: "#7C3AED", A: "#10B981", B: "#1A6B72", C: "#F59E0B", D: "#EF4444", F: "#6B7280" };
const GRADE_BG: Record<string, string>    = { S: "#EDE9FE", A: "#D1FAE5", B: "#CCFBF1", C: "#FEF3C7", D: "#FEE2E2", F: "#F3F4F6" };
const MODE_LABEL: Record<string, string> = { whynot: "🔍 なぜ分析", vocabulary: "📖 語彙", concept: "🧠 概念", procedure: "📋 手順" };

const BRAND = { primary: "#0A2342", accent: "#FF6B9D", teal: "#1A6B72", green: "#00C9A7" };

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function formatDuration(sec: number) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Character avatars for dashboard selection
const CHARACTER_PRESETS = [
  { id: "mio",  emoji: "👧", name: "ミオ", color: "#FF6B9D", personality: "元気で好奇心旺盛", accent: "#FF9EC6" },
  { id: "sora", emoji: "👦", name: "ソラ", color: "#45B7D1", personality: "冷静で論理的",     accent: "#6DD3E8" },
  { id: "haru", emoji: "🧑", name: "ハル", color: "#4ECDC4", personality: "優しくて丁寧",     accent: "#7EEAE0" },
  { id: "rin",  emoji: "👩", name: "リン", color: "#8E44AD", personality: "クールで知的",     accent: "#A855F7" },
];

// SVGキャラクターイラスト
const CHAR_FACE: Record<string, { face: string; hair: string; accent: string }> = {
  mio:  { face: "#FFE0C2", hair: "#FF6B9D", accent: "#FF9EC6" },
  sora: { face: "#FFE0C2", hair: "#3A8BD2", accent: "#45B7D1" },
  haru: { face: "#FFE0C2", hair: "#2EAD9A", accent: "#4ECDC4" },
  rin:  { face: "#FFE0C2", hair: "#7B3FA0", accent: "#A855F7" },
};

function CharAvatar({ charId, color, size = 56 }: { charId: string; color: string; size?: number }) {
  const illust = CHAR_FACE[charId] || CHAR_FACE.mio;
  const r = size / 2;
  const uid = `dash_${charId}_${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: `drop-shadow(0 2px ${size * 0.08}px ${color}30)` }}>
      <defs>
        <radialGradient id={`${uid}_bg`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor={`${color}35`} />
          <stop offset="100%" stopColor={`${color}12`} />
        </radialGradient>
        <radialGradient id={`${uid}_face`} cx="45%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#FFF0E0" />
          <stop offset="100%" stopColor={illust.face} />
        </radialGradient>
        <linearGradient id={`${uid}_hair`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={illust.hair} />
          <stop offset="100%" stopColor={illust.accent} />
        </linearGradient>
        <linearGradient id={`${uid}_ring`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="50%" stopColor={illust.accent} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke={`url(#${uid}_ring)`} strokeWidth={size * 0.04} opacity="0.7" />
      <circle cx={r} cy={r} r={r - size * 0.06} fill={`url(#${uid}_bg)`} />
      <circle cx={r} cy={r * 1.05} r={r * 0.42} fill={`url(#${uid}_face)`} />
      <ellipse cx={r} cy={r * 0.72} rx={r * 0.48} ry={r * 0.38} fill={`url(#${uid}_hair)`} />
      <circle cx={r - r * 0.15} cy={r * 1.0} r={r * 0.06} fill="#333" />
      <circle cx={r + r * 0.15} cy={r * 1.0} r={r * 0.06} fill="#333" />
      <circle cx={r - r * 0.13} cy={r * 0.97} r={r * 0.025} fill="#fff" />
      <circle cx={r + r * 0.17} cy={r * 0.97} r={r * 0.025} fill="#fff" />
      <path d={`M ${r - r * 0.1} ${r * 1.18} Q ${r} ${r * 1.26} ${r + r * 0.1} ${r * 1.18}`} fill="none" stroke="#E8846B" strokeWidth={r * 0.035} strokeLinecap="round" />
      <circle cx={r - r * 0.32} cy={r * 1.12} r={r * 0.08} fill={`${color}25`} />
      <circle cx={r + r * 0.32} cy={r * 1.12} r={r * 0.08} fill={`${color}25`} />
    </svg>
  );
}

export default function DashboardClient({ user, sessions, stats, concepts }: {
  user: User; sessions: Session[]; stats: Stats | null; concepts: Concept[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"overview" | "history" | "knowledge" | "settings">("overview");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Settings state
  const [apiKey, setApiKey] = useState("");
  const [apiInput, setApiInput] = useState("");
  const [savedChar, setSavedChar] = useState<string>("");
  const [showKeySaved, setShowKeySaved] = useState(false);
  const [showDataCleared, setShowDataCleared] = useState(false);

  // Streak state (loaded from localStorage)
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0, lastDate: "", totalDays: 0 });
  const [charEmoji, setCharEmoji] = useState("");
  const [charColor, setCharColor] = useState("");
  const [charId, setCharId] = useState("");

  useEffect(() => {
    try {
      const k = localStorage.getItem("tg_apikey") || "";
      setApiKey(k); setApiInput(k);
      const c = localStorage.getItem("tg_char");
      if (c) {
        const parsed = JSON.parse(c);
        setSavedChar(parsed.custom_name || parsed.name || "");
        setCharEmoji(parsed.emoji || "");
        setCharColor(parsed.color || "");
        setCharId(parsed.id || "");
      }
      const s = localStorage.getItem("tg_streak");
      if (s) {
        setStreak(JSON.parse(s));
      }
    } catch {}
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("tg_char");
      localStorage.removeItem("tg_profile");
      localStorage.removeItem("tg_graph");
      localStorage.removeItem("tg_apikey");
      localStorage.removeItem("tg_streak");
      localStorage.removeItem("tg_app_version");
    } catch {}
    window.location.href = "/api/auth/logout";
  };

  const saveApiKey = () => {
    const k = apiInput.trim();
    setApiKey(k);
    localStorage.setItem("tg_apikey", k);
    setShowKeySaved(true);
    setTimeout(() => setShowKeySaved(false), 2000);
  };

  const selectCharacter = (preset: typeof CHARACTER_PRESETS[0]) => {
    const char = {
      id: preset.id, name: preset.name, emoji: preset.emoji, color: preset.color,
      personality: preset.personality + "。教えてもらうのが大好き。",
      speaking_style: "タメ口で親しみやすい。語尾に「！」「〜」が多い。",
      praise: "「えっ、すごい！！めっちゃわかった！！もっと教えて〜！」",
      struggle: "「えっとぉ…ごめんね、もう一回ゆっくり教えてくれる？」",
      confused: "「うーん、そこがよくわかんないんだけど…なんで？」",
      intro: `はじめまして！${preset.name}だよ〜！ たくさん教えてね！`,
      lore: "教えてもらうのが大好き。一緒に成長していく。",
      interests: [], knowledge_areas: [],
      growth_stages: [
        { label: "出会ったばかり", threshold: 0 }, { label: "なかよし", threshold: 3 },
        { label: "信頼の絆", threshold: 8 }, { label: "ずっと一緒", threshold: 15 },
        { label: "かけがえのない存在", threshold: 30 },
      ],
      evolution_log: [],
    };
    localStorage.setItem("tg_char", JSON.stringify(char));
    setSavedChar(preset.name);
  };

  const detectProvider = (key: string) => {
    if (key.startsWith("sk-ant-")) return { label: "Claude (Anthropic)", color: "#CC785C" };
    if (key.startsWith("sk-") && key.length > 40) return { label: "GPT (OpenAI)", color: "#10A37F" };
    if (key.startsWith("AIza")) return { label: "Gemini (Google)", color: "#4285F4" };
    if (key.startsWith("aws:")) return { label: "Bedrock (AWS)", color: "#FF9900" };
    return { label: "未設定", color: "#bbb" };
  };

  const avgScore = stats?.avg_score ?? 0;
  const totalSessions = stats?.total_sessions ?? sessions.length;
  const scoreGrade = avgScore >= 90 ? "S" : avgScore >= 75 ? "A" : avgScore >= 60 ? "B" : avgScore >= 45 ? "C" : "D";
  const recent = sessions.slice(0, 7).reverse();

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        .dash-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (min-width: 768px) { .dash-kpi-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; } }
        .dash-content-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .dash-content-grid { grid-template-columns: 1fr 1fr; } }
        .dash-kg-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .dash-kg-grid { grid-template-columns: 2fr 1fr; } }
        .dash-settings-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 768px) { .dash-settings-grid { grid-template-columns: 1fr 1fr; } }
        .dash-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .dash-header-actions { display: flex; align-items: center; gap: 8px; }
        .dash-header-name { font-size: 13px; color: #90B8C8; display: none; }
        @media (min-width: 640px) { .dash-header-name { display: inline; } }
      `}</style>

      {/* HEADER */}
      <header style={{ background: BRAND.primary, color: "white", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ textDecoration: "none", fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
            teach<span style={{ color: BRAND.accent }}>AI</span>
          </a>
          <span style={{ fontSize: 12, color: "#90B8C8", fontWeight: 500, padding: "2px 8px", background: "rgba(255,255,255,0.08)", borderRadius: 6 }}>ダッシュボード</span>
        </div>
        <div className="dash-header-actions">
          <span className="dash-header-name">{user.name || user.email}</span>
          <button onClick={() => router.push("/")} style={{ padding: "7px 18px", background: BRAND.accent, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            教えに行く →
          </button>
          <button onClick={handleLogout} style={{ padding: "7px 16px", background: "transparent", color: "#90B8C8", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            ログアウト
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px" }}>
        {/* Greeting */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
          {charId && (
            <CharAvatar charId={charId} color={charColor || "#FF6B9D"} size={48} />
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: BRAND.primary }}>
              {savedChar ? `${savedChar}と${user.name?.split(" ")[0] || "あなた"}の学習記録` : `こんにちは、${user.name?.split(" ")[0] || "ユーザー"}さん`}
            </h1>
            <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
              {savedChar ? `${savedChar}に教えた成果を確認しましょう` : "教えた成果を確認しましょう"}
            </p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="dash-kpi-grid">
          {[
            { label: "教えたセッション", value: totalSessions, sub: "完了セッション数", color: BRAND.teal, icon: "📚" },
            { label: "平均スコア", value: avgScore ? `${avgScore}pt` : "—", sub: `総合評価 ${scoreGrade}`, color: BRAND.primary, icon: "🏆" },
            { label: "教えたトピック", value: stats?.unique_topics ?? 0, sub: "ユニークテーマ数", color: BRAND.green, icon: "🗂️" },
            { label: "総学習時間", value: formatDuration(stats?.total_seconds ?? 0), sub: "累計学習時間", color: "#F59E0B", icon: "⏱️" },
          ].map((kpi, i) => (
            <div key={i} style={{ background: "white", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderLeft: `4px solid ${kpi.color}` }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{kpi.icon}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: BRAND.primary }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* 強み・弱み分析 */}
        {sessions.length > 0 && (() => {
          const dims = [
            { key: "score_knowledge_fidelity" as const, label: "概念理解度", icon: "📘" },
            { key: "score_structural_integrity" as const, label: "構造整合度", icon: "🏗️" },
            { key: "score_hypothesis_generation" as const, label: "仮説生成力", icon: "💡" },
            { key: "score_thinking_depth" as const, label: "思考深度", icon: "🔬" },
          ];
          const dimAvgs = dims.map(d => {
            const vals = sessions.map(s => s[d.key]).filter((v): v is number => v != null);
            return { ...d, avg: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, count: vals.length };
          }).filter(d => d.count > 0);
          if (dimAvgs.length === 0) return null;
          const sorted = [...dimAvgs].sort((a, b) => b.avg - a.avg);
          const strongest = sorted[0];
          const weakest = sorted[sorted.length - 1];
          return (
            <div style={{ background: "white", borderRadius: 14, padding: "18px 24px", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, fontSize: 14, marginRight: 8 }}>強み・弱み分析</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "#D1FAE5", borderRadius: 10 }}>
                <span style={{ fontSize: 16 }}>{strongest.icon}</span>
                <span style={{ fontSize: 12, color: "#065F46", fontWeight: 700 }}>強み: {strongest.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>{Math.round(strongest.avg)}pt</span>
              </div>
              {strongest.key !== weakest.key && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "#FEF3C7", borderRadius: 10 }}>
                  <span style={{ fontSize: 16 }}>{weakest.icon}</span>
                  <span style={{ fontSize: 12, color: "#92400E", fontWeight: 700 }}>伸びしろ: {weakest.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#D97706" }}>{Math.round(weakest.avg)}pt</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
                {dimAvgs.map(d => (
                  <div key={d.key} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#9CA3AF" }}>{d.label}</div>
                    <div style={{ width: 40, background: "#E5E7EB", borderRadius: 3, height: 5, marginTop: 3 }}>
                      <div style={{ width: `${d.avg}%`, background: d.key === strongest.key ? "#10B981" : d.key === weakest.key ? "#F59E0B" : BRAND.teal, height: "100%", borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "white", borderRadius: 10, padding: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", width: "fit-content" }}>
          {(["overview", "history", "knowledge", "settings"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: tab === t ? 700 : 400,
              background: tab === t ? BRAND.primary : "transparent",
              color: tab === t ? "white" : "#6B7280",
              transition: "all 0.2s", fontFamily: "inherit",
            }}>
              {{ overview: "📊 概要", history: "📋 履歴", knowledge: "🧠 知識グラフ", settings: "⚙️ 設定" }[t]}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="dash-content-grid">
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>📈 最近のスコア推移</div>
              {recent.length > 0 ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                  {recent.map((s, i) => {
                    const score = s.score_total ?? 0;
                    const h = Math.max(8, (score / 100) * 100);
                    const g = s.grade || "C";
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: GRADE_COLOR[g] || BRAND.teal }}>{score ? Math.round(score) : "—"}</div>
                        <div style={{ width: "100%", height: h, background: GRADE_COLOR[g] || BRAND.teal, borderRadius: "4px 4px 0 0", opacity: 0.85 }} />
                        <div style={{ fontSize: 9, color: "#9CA3AF" }}>{formatDate(s.created_at).split(" ")[0]}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>
                  まだセッションがありません。<br />AIに教え始めよう！
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>🎯 最新セッションのスコア詳細</div>
              {sessions[0] ? (
                <>
                  <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
                    「{sessions[0].topic}」{formatDate(sessions[0].created_at)}
                  </div>
                  {[
                    { label: "概念理解度", value: sessions[0].score_knowledge_fidelity },
                    { label: "構造整合度", value: sessions[0].score_structural_integrity },
                    { label: "仮説生成力", value: sessions[0].score_hypothesis_generation },
                    { label: "思考深度",   value: sessions[0].score_thinking_depth },
                  ].map((dim, i) => {
                    const v = dim.value ?? 0;
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: "#374151" }}>{dim.label}</span>
                          <span style={{ fontWeight: 700, color: BRAND.primary }}>{Math.round(v)}</span>
                        </div>
                        <div style={{ background: "#E5E7EB", borderRadius: 4, height: 7 }}>
                          <div style={{ width: `${v}%`, background: v >= 75 ? "#10B981" : v >= 50 ? BRAND.teal : "#F59E0B", height: "100%", borderRadius: 4, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>最初のセッションを完了するとスコアが表示されます</div>
              )}
            </div>

            {/* Streak & Learning Progress */}
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>🔥 学習の継続</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "連続日数", value: streak.currentStreak, unit: "日", icon: "🔥", color: "#EF4444" },
                  { label: "最長記録", value: streak.longestStreak, unit: "日", icon: "🏆", color: "#F59E0B" },
                  { label: "総学習日数", value: streak.totalDays, unit: "日", icon: "📅", color: BRAND.teal },
                  { label: "最終学習日", value: streak.lastDate ? `${new Date(streak.lastDate).getMonth()+1}/${new Date(streak.lastDate).getDate()}` : "---", unit: "", icon: "📌", color: BRAND.primary },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: `${item.color}08`, border: `1px solid ${item.color}20` }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}{item.unit}</div>
                  </div>
                ))}
              </div>
              {sessions.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>モード別セッション数</div>
                  {Object.entries(sessions.reduce((acc, s) => { acc[s.mode] = (acc[s.mode] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([mode, count]) => (
                    <div key={mode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                      <span style={{ fontSize: 13, color: "#374151" }}>{MODE_LABEL[mode] || mode}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, background: "#E5E7EB", borderRadius: 4, height: 6 }}>
                          <div style={{ width: `${Math.min(100, (count / sessions.length) * 100)}%`, background: BRAND.teal, height: "100%", borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.primary, minWidth: 24, textAlign: "right" }}>{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grade Distribution */}
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>📊 グレード分布</div>
              {sessions.length > 0 ? (
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {["S", "A", "B", "C", "D", "F"].map(g => {
                    const count = sessions.filter(s => s.grade === g).length;
                    if (count === 0) return null;
                    return (
                      <div key={g} style={{ textAlign: "center", minWidth: 48 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: GRADE_BG[g] || "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", border: `2px solid ${GRADE_COLOR[g] || "#ccc"}` }}>
                          <span style={{ fontWeight: 800, fontSize: 16, color: GRADE_COLOR[g] || "#6B7280" }}>{g}</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.primary }}>{count}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{Math.round((count / sessions.length) * 100)}%</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>セッションを完了するとグレード分布が表示されます</div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 20, fontSize: 16 }}>📋 教えた履歴</div>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div>まだ完了したセッションがありません</div>
                <button onClick={() => router.push("/")} style={{ marginTop: 16, padding: "10px 24px", background: BRAND.accent, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                  AIに教え始める →
                </button>
              </div>
            ) : (
              <div className="dash-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["トピック", "モード", "グレード", "スコア", "日時", ""].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, color: "#6B7280", fontWeight: 700, borderBottom: "2px solid #E5E7EB" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={i}
                      onClick={() => setSelectedSession(s)}
                      style={{ borderBottom: "1px solid #F3F4F6", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: BRAND.primary, maxWidth: 200 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.topic}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{MODE_LABEL[s.mode] || s.mode}</td>
                      <td style={{ padding: "12px 14px" }}>
                        {s.grade && (
                          <span style={{ background: GRADE_BG[s.grade] || "#F3F4F6", color: GRADE_COLOR[s.grade] || "#6B7280", fontWeight: 800, fontSize: 14, padding: "3px 10px", borderRadius: 20 }}>{s.grade}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                        {s.score_total ? Math.round(s.score_total) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "#9CA3AF" }}>{formatDate(s.created_at)}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/?topic=${encodeURIComponent(s.topic)}`); }}
                          style={{ padding: "4px 12px", background: `${BRAND.accent}15`, color: BRAND.accent, border: `1px solid ${BRAND.accent}30`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                          もう一度教える
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* ── KNOWLEDGE GRAPH ── */}
        {tab === "knowledge" && (
          <div className="dash-kg-grid">
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 8, fontSize: 15 }}>🧠 教えた知識マップ</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>セッションから自動抽出された概念ネットワーク</div>
              {concepts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
                  <div>教え続けると知識グラフが育ちます</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {concepts.map((c, i) => {
                    const size = Math.max(12, Math.min(18, 12 + c.mention_count));
                    const opacity = Math.max(0.5, Math.min(1.0, 0.5 + c.confidence * 0.5));
                    return (
                      <span key={i} style={{
                        background: "#E8F5F3", color: BRAND.primary, padding: "5px 12px",
                        borderRadius: 20, fontSize: size, fontWeight: 600, opacity,
                        border: "1px solid #CCECE8",
                      }}>
                        {c.label}
                        {c.mention_count > 1 && <span style={{ fontSize: 10, color: "#6B7280", marginLeft: 4 }}>×{c.mention_count}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>📊 知識統計</div>
              {[
                ["習得概念数", concepts.length + "個"],
                ["高信頼概念", concepts.filter(c => c.confidence > 0.8).length + "個"],
                ["最多言及",  concepts[0]?.label || "—"],
                ["合計言及",  concepts.reduce((s, c) => s + c.mention_count, 0) + "回"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{k}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.teal }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div className="dash-settings-grid">
            {/* API Key */}
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>🔑 AI APIキー設定</div>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.6 }}>
                自分のAPIキーを設定すると、お試しモードの制限なくご利用いただけます。
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Claude", sub: "Anthropic", color: "#CC785C", url: "https://console.anthropic.com/settings/keys" },
                  { label: "GPT", sub: "OpenAI", color: "#10A37F", url: "https://platform.openai.com/api-keys" },
                  { label: "Gemini", sub: "Google", color: "#4285F4", url: "https://aistudio.google.com/app/apikey" },
                  { label: "Bedrock", sub: "AWS", color: "#FF9900", url: "https://aws.amazon.com/bedrock/" },
                ].map(p => (
                  <a key={p.label} href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", background: "#fafafa", textDecoration: "none", display: "block" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>{p.sub}</div>
                  </a>
                ))}
              </div>
              <input type="password" value={apiInput} onChange={e => setApiInput(e.target.value)}
                placeholder="APIキーを貼り付け..."
                style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #eee", borderRadius: 10, fontSize: 14, marginBottom: 8, fontFamily: "inherit", outline: "none" }}
                onKeyDown={e => e.key === "Enter" && saveApiKey()} />
              {apiInput && (
                <div style={{ fontSize: 12, color: detectProvider(apiInput).color, fontWeight: 700, marginBottom: 8 }}>
                  {detectProvider(apiInput).label}
                </div>
              )}
              <button onClick={saveApiKey}
                style={{ width: "100%", padding: "10px", background: BRAND.teal, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>
                {showKeySaved ? "✓ 保存しました" : "保存"}
              </button>
            </div>

            {/* Character Selection */}
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>👤 キャラクター設定</div>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.6 }}>
                {savedChar ? `現在のキャラクター: ${savedChar}` : "AIに教える相手のキャラクターを選んでください"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {CHARACTER_PRESETS.map(c => (
                  <button key={c.name} onClick={() => selectCharacter(c)}
                    style={{
                      padding: "16px 14px", borderRadius: 16, border: `2px solid ${savedChar === c.name ? c.color : "#eee"}`,
                      background: savedChar === c.name ? `linear-gradient(135deg, ${c.color}12, ${c.accent}08)` : "#fafafa",
                      cursor: "pointer", textAlign: "center", fontFamily: "inherit", transition: "all 0.3s",
                      boxShadow: savedChar === c.name ? `0 4px 20px ${c.color}20` : "none",
                    }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                      <CharAvatar charId={c.id} color={c.color} size={52} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: savedChar === c.name ? c.color : "#222", letterSpacing: "-0.3px" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 3, lineHeight: 1.4 }}>{c.personality}</div>
                    {savedChar === c.name && (
                      <div style={{ fontSize: 10, color: "#fff", fontWeight: 700, marginTop: 6, background: c.color, padding: "3px 12px", borderRadius: 100, display: "inline-block" }}>選択中</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Info */}
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>👤 アカウント情報</div>
              {[
                ["メールアドレス", user.email],
                ["表示名", user.name || "未設定"],
                ["ロール", user.role === "admin" ? "管理者" : "ユーザー"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Data Management */}
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>📂 学習データ管理</div>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.6 }}>
                ローカルに保存された学習データの管理ができます。
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => {
                  try {
                    const data = {
                      profile: JSON.parse(localStorage.getItem("tg_profile") || "[]"),
                      character: JSON.parse(localStorage.getItem("tg_char") || "null"),
                      streak: JSON.parse(localStorage.getItem("tg_streak") || "{}"),
                      graph: JSON.parse(localStorage.getItem("tg_graph") || "null"),
                      apiKey: "***hidden***",
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `teachai-data-${new Date().toISOString().slice(0,10)}.json`;
                    a.click(); URL.revokeObjectURL(url);
                  } catch {}
                }}
                  style={{ padding: "12px 16px", background: "#F0FDF4", borderRadius: 10, border: "1px solid #BBF7D0", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" }}>
                  <span style={{ fontSize: 20 }}>📥</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>データをエクスポート</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>学習履歴・キャラクター・ストリークをJSON形式で保存</div>
                  </div>
                </button>
                <button onClick={() => {
                  if (confirm("ローカルの学習データ（履歴・キャラクター・ストリーク・知識グラフ）をクリアしますか？\nサーバーに保存されたデータは削除されません。")) {
                    try {
                      localStorage.removeItem("tg_profile");
                      localStorage.removeItem("tg_char");
                      localStorage.removeItem("tg_streak");
                      localStorage.removeItem("tg_graph");
                      localStorage.removeItem("tg_onboarded");
                      setShowDataCleared(true);
                      setSavedChar("");
                      setTimeout(() => setShowDataCleared(false), 3000);
                    } catch {}
                  }
                }}
                  style={{ padding: "12px 16px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" }}>
                  <span style={{ fontSize: 20 }}>🗑️</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>ローカルデータをクリア</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>ブラウザに保存された履歴・設定をリセット</div>
                  </div>
                </button>
                {showDataCleared && (
                  <div style={{ fontSize: 12, color: "#10B981", fontWeight: 600, textAlign: "center", padding: "8px", background: "#ECFDF5", borderRadius: 8 }}>
                    ローカルデータをクリアしました
                  </div>
                )}
              </div>
            </div>

            {/* Developer Tools */}
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 16, fontSize: 15 }}>⚡ 開発者ツール</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a href="/api/docs" target="_blank" rel="noopener noreferrer"
                  style={{ padding: "12px 16px", background: "#F8FAFC", borderRadius: 10, textDecoration: "none", display: "flex", alignItems: "center", gap: 10, border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary }}>API ドキュメント</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>OpenAPI / Swagger 仕様</div>
                  </div>
                </a>
                <a href="/api/mcp" target="_blank" rel="noopener noreferrer"
                  style={{ padding: "12px 16px", background: "#F8FAFC", borderRadius: 10, textDecoration: "none", display: "flex", alignItems: "center", gap: 10, border: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: 20 }}>🔌</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary }}>MCP エンドポイント</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>Model Context Protocol</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Session detail modal */}
        {selectedSession && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
            onClick={() => setSelectedSession(null)}>
            <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 500, width: "100%" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, color: BRAND.primary, fontSize: 18 }}>{selectedSession.topic}</h3>
                  <p style={{ margin: "4px 0 0", color: "#9CA3AF", fontSize: 12 }}>{formatDate(selectedSession.created_at)}</p>
                </div>
                {selectedSession.grade && (
                  <span style={{ background: GRADE_BG[selectedSession.grade] || "#F3F4F6", color: GRADE_COLOR[selectedSession.grade] || "#6B7280", fontWeight: 800, fontSize: 20, padding: "4px 16px", borderRadius: 24 }}>
                    {selectedSession.grade}
                  </span>
                )}
              </div>
              {[
                ["概念理解度", selectedSession.score_knowledge_fidelity],
                ["構造整合度", selectedSession.score_structural_integrity],
                ["仮説生成力", selectedSession.score_hypothesis_generation],
                ["思考深度",   selectedSession.score_thinking_depth],
              ].map(([label, val], i) => {
                const v = (val as number) ?? 0;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>{label}</span><span style={{ fontWeight: 700 }}>{Math.round(v)}</span>
                    </div>
                    <div style={{ background: "#E5E7EB", borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${v}%`, background: BRAND.teal, height: "100%", borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
              {selectedSession.key_concepts && selectedSession.key_concepts.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>教えた概念</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selectedSession.key_concepts.map((c, i) => (
                      <span key={i} style={{ background: "#E8F5F3", color: BRAND.primary, fontSize: 12, padding: "3px 10px", borderRadius: 16 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Session Feedback Summary */}
              {(() => {
                const scores = [selectedSession.score_knowledge_fidelity, selectedSession.score_structural_integrity, selectedSession.score_hypothesis_generation, selectedSession.score_thinking_depth].filter((v): v is number => v != null);
                if (scores.length === 0) return null;
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                const best = [
                  { label: "概念理解度", val: selectedSession.score_knowledge_fidelity ?? 0 },
                  { label: "構造整合度", val: selectedSession.score_structural_integrity ?? 0 },
                  { label: "仮説生成力", val: selectedSession.score_hypothesis_generation ?? 0 },
                  { label: "思考深度", val: selectedSession.score_thinking_depth ?? 0 },
                ].filter(d => d.val > 0).sort((a, b) => b.val - a.val);
                const cn = savedChar || "AI";
                return (
                  <div style={{ marginTop: 16, padding: "12px 14px", background: avg >= 70 ? "#F0FDF4" : avg >= 45 ? "#FFFBEB" : "#FEF2F2", borderRadius: 12, border: `1px solid ${avg >= 70 ? "#BBF7D0" : avg >= 45 ? "#FDE68A" : "#FECACA"}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: avg >= 70 ? "#166534" : avg >= 45 ? "#92400E" : "#991B1B", marginBottom: 6 }}>
                      {cn}からのフィードバック
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                      {avg >= 70
                        ? `${best[0]?.label || "理解度"}がとても高いセッションでした！${best.length > 1 && best[best.length - 1].val < 60 ? `${best[best.length - 1].label}をもう少し意識するとさらに良くなりそうです。` : "この調子で続けましょう！"}`
                        : avg >= 45
                        ? `着実に理解が進んでいます。${best[0]?.label || ""}が強みです。${best.length > 1 ? `${best[best.length - 1].label}を重点的に教えるとレベルアップできそうです。` : "もう一度教えてみましょう！"}`
                        : `まだ伸びしろがたくさんあります！もう一度ゆっくり教えてみてください。${best[0] ? `${best[0].label}は良いスタートです。` : ""}`
                      }
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                <button onClick={() => { router.push(`/?topic=${encodeURIComponent(selectedSession.topic)}`); }}
                  style={{ flex: 1, padding: "10px", background: BRAND.accent, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
                  もう一度教える
                </button>
                <button onClick={() => setSelectedSession(null)} style={{ flex: 1, padding: "10px", background: "#F3F4F6", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 600, fontFamily: "inherit" }}>
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
