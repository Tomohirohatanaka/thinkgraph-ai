"use client";

import { useState } from "react";
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

const GRADE_COLOR: Record<string, string> = { S: "#7C3AED", A: "#10B981", B: "#1A6B72", C: "#F59E0B", D: "#EF4444" };
const GRADE_BG: Record<string, string>    = { S: "#EDE9FE", A: "#D1FAE5", B: "#CCFBF1", C: "#FEF3C7", D: "#FEE2E2" };
const MODE_LABEL: Record<string, string> = { whynot: "🔍 なぜ分析", vocabulary: "📖 語彙", concept: "🧠 概念", procedure: "📋 手順" };

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

export default function DashboardClient({ user, sessions, stats, concepts }: {
  user: User; sessions: Session[]; stats: Stats | null; concepts: Concept[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"overview" | "history" | "knowledge">("overview");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const avgScore = stats?.avg_score ?? 0;
  const totalSessions = stats?.total_sessions ?? sessions.length;
  const scoreGrade = avgScore >= 90 ? "S" : avgScore >= 75 ? "A" : avgScore >= 60 ? "B" : avgScore >= 45 ? "C" : "D";

  // Recent score trend (last 7 sessions)
  const recent = sessions.slice(0, 7).reverse();

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: "Arial, sans-serif" }}>
      {/* HEADER */}
      <header style={{ background: "#0A2342", color: "white", padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "#00C9A7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>ThinkGraph AI</span>
          <span style={{ fontSize: 12, color: "#90B8C8" }}>ダッシュボード</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#90B8C8" }}>{user.name || user.email}</span>
          <button onClick={() => router.push("/")} style={{ padding: "6px 14px", background: "#1A6B72", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            学習する
          </button>
          <button onClick={handleLogout} style={{ padding: "6px 14px", background: "transparent", color: "#90B8C8", border: "1px solid #1A3A5C", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            ログアウト
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {/* User greeting */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0A2342" }}>
            こんにちは、{user.name?.split(" ")[0] || "ユーザー"}さん 👋
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            学習の進捗を確認しましょう
          </p>
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "総セッション数", value: totalSessions, sub: "完了したセッション", color: "#1A6B72", icon: "📚" },
            { label: "平均スコア", value: avgScore ? `${avgScore}pt` : "—", sub: `総合評価 ${scoreGrade}`, color: "#0A2342", icon: "🏆" },
            { label: "ユニークトピック", value: stats?.unique_topics ?? 0, sub: "学習したテーマ数", color: "#00C9A7", icon: "🗂️" },
            { label: "総学習時間", value: formatDuration(stats?.total_seconds ?? 0), sub: "累計学習時間", color: "#F59E0B", icon: "⏱️" },
          ].map((kpi, i) => (
            <div key={i} style={{ background: "white", borderRadius: 12, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: `4px solid ${kpi.color}` }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{kpi.icon}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>{kpi.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#0A2342" }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "white", borderRadius: 10, padding: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", width: "fit-content" }}>
          {(["overview", "history", "knowledge"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: tab === t ? 700 : 400,
              background: tab === t ? "#0A2342" : "transparent",
              color: tab === t ? "white" : "#6B7280",
              transition: "all 0.2s",
            }}>
              {{ overview: "📊 概要", history: "📋 履歴", knowledge: "🧠 知識グラフ" }[t]}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Score trend */}
            <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, color: "#0A2342", marginBottom: 16, fontSize: 15 }}>📈 最近のスコア推移</div>
              {recent.length > 0 ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                  {recent.map((s, i) => {
                    const score = s.score_total ?? 0;
                    const h = Math.max(8, (score / 100) * 100);
                    const g = s.grade || "C";
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: GRADE_COLOR[g] }}>{score ? Math.round(score) : "—"}</div>
                        <div style={{ width: "100%", height: h, background: GRADE_COLOR[g] || "#1A6B72", borderRadius: "4px 4px 0 0", opacity: 0.85 }} />
                        <div style={{ fontSize: 9, color: "#9CA3AF" }}>{formatDate(s.created_at).split(" ")[0]}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>
                  まだセッションがありません。<br />トップページから学習を始めよう！
                </div>
              )}
            </div>

            {/* 5D breakdown of last session */}
            <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, color: "#0A2342", marginBottom: 16, fontSize: 15 }}>🎯 最新セッションのスコア詳細</div>
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
                          <span style={{ fontWeight: 700, color: "#0A2342" }}>{Math.round(v)}</span>
                        </div>
                        <div style={{ background: "#E5E7EB", borderRadius: 4, height: 7 }}>
                          <div style={{ width: `${v}%`, background: v >= 75 ? "#10B981" : v >= 50 ? "#1A6B72" : "#F59E0B", height: "100%", borderRadius: 4, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>最初のセッションを完了するとスコアが表示されます</div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <div style={{ fontWeight: 700, color: "#0A2342", marginBottom: 20, fontSize: 16 }}>📋 学習履歴（直近50件）</div>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div>まだ完了したセッションがありません</div>
                <button onClick={() => router.push("/")} style={{ marginTop: 16, padding: "10px 24px", background: "#0A2342", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                  学習を始める →
                </button>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["トピック", "モード", "グレード", "スコア", "日時"].map(h => (
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
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0A2342", maxWidth: 200 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.topic}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "#6B7280" }}>{MODE_LABEL[s.mode] || s.mode}</td>
                      <td style={{ padding: "12px 14px" }}>
                        {s.grade && (
                          <span style={{ background: GRADE_BG[s.grade], color: GRADE_COLOR[s.grade], fontWeight: 800, fontSize: 14, padding: "3px 10px", borderRadius: 20 }}>{s.grade}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                        {s.score_total ? Math.round(s.score_total) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "#9CA3AF" }}>{formatDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── KNOWLEDGE GRAPH ── */}
        {tab === "knowledge" && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
            <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, color: "#0A2342", marginBottom: 8, fontSize: 15 }}>🧠 習得した知識マップ</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>学習セッションから自動抽出された概念ネットワーク</div>
              {concepts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
                  <div>学習を重ねると知識グラフが育ちます</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {concepts.map((c, i) => {
                    const size = Math.max(12, Math.min(18, 12 + c.mention_count));
                    const opacity = Math.max(0.5, Math.min(1.0, 0.5 + c.confidence * 0.5));
                    return (
                      <span key={i} style={{
                        background: "#E8F5F3", color: "#0A2342", padding: "5px 12px",
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
            <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, color: "#0A2342", marginBottom: 16, fontSize: 15 }}>📊 知識統計</div>
              {[
                ["習得概念数", concepts.length + "個"],
                ["高信頼概念", concepts.filter(c => c.confidence > 0.8).length + "個"],
                ["最多言及",  concepts[0]?.label || "—"],
                ["合計言及",  concepts.reduce((s, c) => s + c.mention_count, 0) + "回"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{k}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1A6B72" }}>{v}</span>
                </div>
              ))}
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
                  <h3 style={{ margin: 0, color: "#0A2342", fontSize: 18 }}>{selectedSession.topic}</h3>
                  <p style={{ margin: "4px 0 0", color: "#9CA3AF", fontSize: 12 }}>{formatDate(selectedSession.created_at)}</p>
                </div>
                {selectedSession.grade && (
                  <span style={{ background: GRADE_BG[selectedSession.grade], color: GRADE_COLOR[selectedSession.grade], fontWeight: 800, fontSize: 20, padding: "4px 16px", borderRadius: 24 }}>
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
                      <div style={{ width: `${v}%`, background: "#1A6B72", height: "100%", borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
              {selectedSession.key_concepts && selectedSession.key_concepts.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>習得した概念</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selectedSession.key_concepts.map((c, i) => (
                      <span key={i} style={{ background: "#E8F5F3", color: "#0A2342", fontSize: 12, padding: "3px 10px", borderRadius: 16 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setSelectedSession(null)} style={{ marginTop: 24, width: "100%", padding: "10px", background: "#F3F4F6", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 600 }}>
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
