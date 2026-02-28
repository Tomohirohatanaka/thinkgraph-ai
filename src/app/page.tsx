"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────
type Screen = "home" | "char_detail" | "session" | "result";
type Tab = "learn" | "skills";
type Mode = "whynot" | "vocabulary" | "concept" | "procedure";
type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface Turn { role: "user" | "ai"; text: string; }

interface TopicData {
  title: string; summary: string; key_concepts: string[];
  mode: Mode; core_text: string; first_prompt: string; source_url?: string;
}

interface ScoreData { coverage: number; depth: number; clarity: number; total: number; }

interface SessionResult {
  score: ScoreData; raw_score: ScoreData;
  feedback: string; mastered: string[]; gaps: string[]; message: string;
  leading_penalty: number; gave_up_penalty: number;
  grade?: "S" | "A" | "B" | "C" | "D";
  insight?: string;
  score_breakdown?: { coverage: number; depth: number; clarity: number; structural_coherence: number; spontaneity: number; total: number };
}

interface GrowthStage { label: string; threshold: number; }
interface Character {
  id: string; name: string; emoji: string; color: string;
  personality: string; speaking_style: string;
  praise: string; struggle: string; confused: string;
  intro: string; lore: string;
  interests: string[];
  knowledge_areas: string[];
  growth_stages: GrowthStage[];
  evolution_log: string[];
}

interface ProfileEntry {
  id: string; date: string; title: string; mode: Mode;
  score: number; mastered: string[]; gaps: string[];
}

interface SkillEntry { name: string; level: number; sessions: number; }
interface SkillCategory { name: string; color: string; icon: string; skills: SkillEntry[]; avg_score: number; }
interface SkillMap {
  char_name?: string; char_emoji?: string;
  skill_level: string; summary: string; categories: SkillCategory[];
  strengths: string[]; weak_areas?: string[]; next_steps: string[];
  total_sessions: number; avg_score: number;
  growth_message?: string;
}

// ─── Constants ───────────────────────────────────────────────
const MODE_EMOJI: Record<Mode, string> = {
  whynot: "🔍", vocabulary: "📖", concept: "🧠", procedure: "📋",
};

// ─── Provider detection (frontend mirror of llm.ts) ─────────────
function detectProviderLabel(key: string): { label: string; color: string; placeholder: string } {
  if (key.startsWith("sk-ant-"))       return { label: "Claude (Anthropic)", color: "#CC785C", placeholder: "sk-ant-..." };
  if (key.startsWith("sk-") && key.length > 40) return { label: "GPT (OpenAI)", color: "#10A37F", placeholder: "sk-..." };
  if (key.startsWith("AIza"))          return { label: "Gemini (Google)", color: "#4285F4", placeholder: "AIza..." };
  if (key.startsWith("aws:"))          return { label: "Bedrock (AWS)", color: "#FF9900", placeholder: "aws:ACCESS_KEY:SECRET:REGION" };
  return { label: "APIキー未設定", color: "#bbb", placeholder: "sk-ant-... / sk-... / AIza... / aws:..." };
}

// ─── Storage ──────────────────────────────────────────────────
function loadProfile(): ProfileEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("tg_profile") || "[]"); } catch { return []; }
}
function saveProfileEntry(e: ProfileEntry) {
  const arr = loadProfile(); arr.unshift(e);
  localStorage.setItem("tg_profile", JSON.stringify(arr.slice(0, 100)));
}
function loadChar(): Character | null {
  if (typeof window === "undefined") return null;
  try { const s = localStorage.getItem("tg_char"); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveChar(c: Character) { localStorage.setItem("tg_char", JSON.stringify(c)); }
function loadGraph(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try { const s = localStorage.getItem("tg_graph"); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveGraph(g: Record<string, unknown>) { localStorage.setItem("tg_graph", JSON.stringify(g)); }

// ─── Stage helpers ────────────────────────────────────────────
function stageLabel(char: Character, n: number): string {
  if (!char.growth_stages?.length) return "";
  return [...char.growth_stages]
    .sort((a, b) => b.threshold - a.threshold)
    .find(s => n >= s.threshold)?.label ?? char.growth_stages[0].label;
}
function stageIndex(char: Character, n: number): number {
  if (!char.growth_stages?.length) return 0;
  const sorted = [...char.growth_stages].sort((a, b) => a.threshold - b.threshold);
  let idx = 0;
  sorted.forEach((s, i) => { if (n >= s.threshold) idx = i; });
  return idx;
}
function nextThreshold(char: Character, n: number): number | null {
  const sorted = [...(char.growth_stages || [])].sort((a, b) => a.threshold - b.threshold);
  return sorted.find(s => s.threshold > n)?.threshold ?? null;
}

// ─── Speech hooks ─────────────────────────────────────────────
function useSpeechRec() {
  const recRef = useRef<SpeechRecognition | null>(null);
  const [supported, setSupported] = useState(false);
  const latest = useRef("");
  useEffect(() => {
    const SR = window.SpeechRecognition || (window as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR(); r.lang = "ja-JP"; r.continuous = false; r.interimResults = true;
    recRef.current = r;
  }, []);
  const start = useCallback((onInterim: (t: string) => void, onFinal: (t: string) => void) => {
    const r = recRef.current; if (!r) return;
    latest.current = "";
    r.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (interim) { latest.current = interim; onInterim(interim); }
      if (final) { latest.current = final; onInterim(final); }
    };
    r.onend = () => onFinal(latest.current);
    r.onerror = () => onFinal(latest.current);
    try { r.start(); } catch {}
  }, []);
  const stop = useCallback(() => recRef.current?.stop(), []);
  return { supported, start, stop };
}

// テキストを音声読み上げ用にクリーニング
function cleanForSpeech(raw: string): string {
  return raw
    // JSONブロックを除去（採点結果などが混入しないよう）
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]{10,}\}/g, (m) => {
      // JSONっぽい（キーコロン構造）ものだけ除去
      if (/"[^"]+"\s*:/.test(m)) return "";
      return m;
    })
    // マークダウン記法を読み上げ用に変換
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1")       // *italic* → italic
    .replace(/#+\s*/g, "")             // ## heading
    .replace(/`([^`]+)`/g, "$1")       // `code` → code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")  // [link](url) → link
    .replace(/https?:\/\/\S+/g, "")   // URL除去
    .replace(/[（）「」【】『』〔〕《》〈〉]/g, (c) => {
      // 括弧は読み上げ時のポーズとして空白に
      return " ";
    })
    .replace(/\n{2,}/g, "。")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // 長すぎる場合は最初の2文だけ読む
    .slice(0, 120);
}

function useSynth() {
  // voices が非同期ロードのため ref で保持
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() ?? []; };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  const speak = useCallback((text: string, cb?: () => void) => {
    if (!window.speechSynthesis) { cb?.(); return; }
    window.speechSynthesis.cancel();

    const cleaned = cleanForSpeech(text);
    if (!cleaned) { cb?.(); return; }

    const u = new SpeechSynthesisUtterance(cleaned);
    u.lang = "ja-JP"; u.rate = 1.05; u.pitch = 1.05;

    // 日本語音声を優先（Google音声 > その他の日本語）
    const voices = voicesRef.current;
    const jaGoogle = voices.find(v => v.lang.startsWith("ja") && v.name.includes("Google"));
    const jaAny    = voices.find(v => v.lang.startsWith("ja"));
    if (jaGoogle) u.voice = jaGoogle;
    else if (jaAny) u.voice = jaAny;

    u.onend   = () => cb?.();
    u.onerror = () => cb?.();

    // Chromium bug: 15秒以上でspeakが止まることがある → workaround
    const timer = setTimeout(() => {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);
    u.onend = () => { clearTimeout(timer); cb?.(); };

    window.speechSynthesis.speak(u);
  }, []);

  const cancel = useCallback(() => window.speechSynthesis?.cancel(), []);
  return { speak, cancel };
}

// ─── UI Components ────────────────────────────────────────────
function Bars({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 24 }}>
      {[0.5, 1.0, 0.7, 1.3, 0.6, 1.1, 0.8].map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2, background: color,
          height: `${h * 16}px`,
          animation: `bar ${0.5 + i * 0.07}s ease-in-out infinite alternate`,
        }} />
      ))}
    </div>
  );
}

function Ring({ value, color, label, size = 64 }: { value: number; color: string; label: string; size?: number }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill={color}
          style={{ fontSize: size < 50 ? 10 : 13, fontWeight: 700, fontFamily: "Outfit,sans-serif" }}>{value}</text>
      </svg>
      <div style={{ fontSize: 10, color: "#bbb" }}>{label}</div>
    </div>
  );
}

function Avatar({ char, size = 44, pulse }: { char: Character; size?: number; pulse?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `${char.color}20`, border: `2px solid ${char.color}50`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.48,
      boxShadow: pulse ? `0 0 0 6px ${char.color}25, 0 0 0 12px ${char.color}10` : "none",
      transition: "box-shadow 0.3s",
    }}>{char.emoji}</div>
  );
}

function StageBar({ char, n }: { char: Character; n: number }) {
  const stages = [...(char.growth_stages || [])].sort((a, b) => a.threshold - b.threshold);
  const idx = stageIndex(char, n);
  const label = stageLabel(char, n);
  const next = nextThreshold(char, n);
  const prevAt = stages[idx]?.threshold ?? 0;
  const pct = next !== null ? Math.round(((n - prevAt) / (next - prevAt)) * 100) : 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: char.color, fontWeight: 700 }}>{label}</span>
        {next !== null && (
          <span style={{ fontSize: 10, color: "#bbb" }}>次まであと{next - n}回</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, overflow: "hidden", background: "#eee" }}>
            {i < idx && <div style={{ width: "100%", height: "100%", background: char.color }} />}
            {i === idx && <div style={{ width: `${pct}%`, height: "100%", background: char.color }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stage-up overlay ────────────────────────────────────────
function StageUpBanner({ char, newStage, onDone }: { char: Character; newStage: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }}>
      <div className="fade-in" style={{
        background: "#111", borderRadius: 24, padding: "2rem 2.5rem", textAlign: "center",
        boxShadow: `0 0 60px ${char.color}60`,
        border: `2px solid ${char.color}40`,
        minWidth: 260,
      }}>
        <div style={{ fontSize: 56, marginBottom: "0.4rem" }}>{char.emoji}</div>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: char.color, fontWeight: 800, marginBottom: "0.4rem" }}>STAGE UP</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: "0.5rem" }}>{newStage}</div>
        <div style={{ fontSize: 13, color: "#777" }}>{char.name}との絆が深まった</div>
      </div>
    </div>
  );
}

// ─── Skill bar ───────────────────────────────────────────────
function SkillBar({ skill, color }: { skill: SkillEntry; color: string }) {
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>{skill.name}</span>
        <span style={{ fontSize: 11, color: "#bbb" }}>{skill.level}% · {skill.sessions}回</span>
      </div>
      <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${skill.level}%`, background: color, borderRadius: 3, transition: "width 1s ease", opacity: skill.level >= 70 ? 1 : skill.level >= 40 ? 0.75 : 0.45 }} />
      </div>
    </div>
  );
}

// ─── Skills View ──────────────────────────────────────────────
function SkillsView({ profile, skillMap, skillLoading, skillError, onLoad, onRefresh }: {
  profile: ProfileEntry[]; skillMap: SkillMap | null;
  skillLoading: boolean; skillError: string;
  onLoad: () => void; onRefresh: () => void;
}) {
  useEffect(() => {
    if (!skillMap && !skillLoading && !skillError && profile.length > 0) onLoad();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile.length) return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#bbb" }}>
      <div style={{ fontSize: 48, marginBottom: "1rem" }}>📚</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#444", marginBottom: "0.5rem" }}>まだ学習履歴がありません</div>
      <div style={{ fontSize: 13 }}>学習タブでセッションを行うとスキルマップが生成されます</div>
    </div>
  );
  if (skillLoading) return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#bbb" }}>
      <div style={{ fontSize: 36, marginBottom: "1rem" }}>🔄</div>
      <div>スキルマップを分析中...</div>
    </div>
  );
  if (skillError) return (
    <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
      <div style={{ fontSize: 13, color: "#FF6B6B", background: "#fff5f5", padding: "0.75rem", borderRadius: 10, marginBottom: "1rem" }}>{skillError}</div>
      <button className="btn-primary" onClick={onLoad} style={{ maxWidth: 200, margin: "0 auto", display: "flex" }}>再試行</button>
    </div>
  );
  if (!skillMap) return null;

  const charName = skillMap.char_name ?? "キャラクター";
  const charEmoji = skillMap.char_emoji ?? "🤖";
  const lc = (l: string) =>
    l === "熟達" ? "#FF6B6B" : l === "一人前" ? "#4ECDC4" : l === "成長中" ? "#45B7D1" : "#96CEB4";
  const levelBg = (l: string) =>
    l === "熟達" ? "#fff5f5" : l === "一人前" ? "#f0fffe" : l === "成長中" ? "#f0f8ff" : "#f5fff5";

  return (
    <div>
      {/* キャラクターヘッダー */}
      <div className="card" style={{ marginBottom: "1rem", background: levelBg(skillMap.skill_level), borderColor: lc(skillMap.skill_level) + "40" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>{charEmoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{charName}のスキルマップ</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: lc(skillMap.skill_level), background: lc(skillMap.skill_level) + "20", padding: "0.15rem 0.6rem", borderRadius: 20 }}>{skillMap.skill_level}</span>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.3rem", fontSize: 12, color: "#888" }}>
              <span>📚 {skillMap.total_sessions}セッション</span>
              <span>⭐ 平均{skillMap.avg_score}点</span>
            </div>
          </div>
          <button className="btn-ghost" onClick={onRefresh} style={{ fontSize: 11, color: "#bbb", padding: "0.25rem 0.6rem", border: "1px solid #eee", borderRadius: 8, flexShrink: 0 }}>更新</button>
        </div>
        {/* キャラの一人称コメント */}
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, background: "white", borderRadius: 10, padding: "0.75rem 1rem", border: "1px solid #eee" }}>
          💬 {skillMap.summary}
        </div>
        {skillMap.growth_message && (
          <div style={{ fontSize: 12, color: "#888", marginTop: "0.5rem", fontStyle: "italic", textAlign: "right" }}>
            {charEmoji} {skillMap.growth_message}
          </div>
        )}
      </div>

      {/* スキルカテゴリ */}
      <div className="skills-grid">
        {(skillMap.categories || []).map(cat => (
          <div key={cat.name} className="card fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
              <span style={{ fontSize: 22 }}>{cat.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{cat.name}</div>
                <div style={{ fontSize: 11, color: "#bbb" }}>平均 {Math.round(cat.avg_score)}点</div>
              </div>
            </div>
            {(cat.skills || []).map(s => <SkillBar key={s.name} skill={s} color={cat.color} />)}
          </div>
        ))}
      </div>

      {/* 強み・弱み・次のステップ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div className="card" style={{ borderColor: "#4ECDC430", background: "#f0fffe" }}>
          <div style={{ fontSize: 12, color: "#4ECDC4", fontWeight: 700, marginBottom: "0.6rem" }}>💪 {charName}の得意分野</div>
          {(skillMap.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: "#333", padding: "0.2rem 0" }}>✓ {s}</div>)}
        </div>
        <div className="card" style={{ borderColor: "#FFB84630", background: "#fffbf0" }}>
          <div style={{ fontSize: 12, color: "#FFB846", fontWeight: 700, marginBottom: "0.6rem" }}>🤔 まだ難しいこと</div>
          {((skillMap.weak_areas || skillMap.next_steps) || []).slice(0, 3).map((s, i) => <div key={i} style={{ fontSize: 13, color: "#333", padding: "0.2rem 0" }}>△ {s}</div>)}
        </div>
      </div>
      <div className="card" style={{ marginTop: "1rem", borderColor: "#FF6B6B30", background: "#fff8f8" }}>
        <div style={{ fontSize: 12, color: "#FF6B6B", fontWeight: 700, marginBottom: "0.6rem" }}>🎯 {charName}に教えてほしいこと</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {(skillMap.next_steps || []).map((s, i) => (
            <span key={i} style={{ fontSize: 12, background: "#fff", border: "1px solid #FF6B6B40", borderRadius: 20, padding: "0.25rem 0.75rem", color: "#555" }}>→ {s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Character Detail ─────────────────────────────────────────
function CharDetail({
  char, profile, apiKey, evolving, onBack,
}: {
  char: Character; profile: ProfileEntry[]; apiKey: string;
  evolving: boolean; onBack: () => void;
}) {
  const n = profile.length;
  const idx = stageIndex(char, n);
  const label = stageLabel(char, n);
  const next = nextThreshold(char, n);
  const cc = char.color;

  return (
    <div className="app" style={{ overflowY: "auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{
        position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #f0f0f0",
        padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", zIndex: 10,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, color: "#bbb", cursor: "pointer", lineHeight: 1 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#222" }}>{char.name}のプロフィール</span>
        {evolving && <span style={{ fontSize: 12, color: cc, marginLeft: "auto" }}>✨ 進化中...</span>}
      </div>

      <div style={{ padding: "1.25rem", maxWidth: 600, margin: "0 auto" }}>
        {/* キャラクターカード */}
        <div className="card" style={{ background: `${cc}08`, borderColor: `${cc}30`, marginBottom: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: "0.5rem" }}>{char.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#222", marginBottom: "0.2rem" }}>{char.name}</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: "1rem", lineHeight: 1.6 }}>{char.personality}</div>

          {/* 成長バー */}
          <StageBar char={char} n={n} />
          {next !== null && (
            <div style={{ fontSize: 11, color: "#bbb", marginTop: "0.4rem" }}>
              次のステージまであと<span style={{ color: cc, fontWeight: 700 }}>{next}</span>回
            </div>
          )}
        </div>

        {/* 口調サンプル */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: 12, color: cc, fontWeight: 700, marginBottom: "0.75rem" }}>💬 {char.name}の話し方</div>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: "0.5rem" }}>口調: {char.speaking_style}</div>
          {[
            { label: "褒めるとき", text: char.praise },
            { label: "わからないとき", text: char.struggle },
            { label: "もっと教えて", text: char.confused },
          ].map(({ label: l, text }) => (
            <div key={l} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.3rem 0", borderBottom: "1px solid #f5f5f5" }}>
              <span style={{ fontSize: 10, color: "#bbb", whiteSpace: "nowrap", paddingTop: 3, minWidth: 80 }}>{l}</span>
              <span style={{ fontSize: 13, color: "#444", lineHeight: 1.5, fontStyle: "italic" }}>{text}</span>
            </div>
          ))}
        </div>

        {/* 興味・知識エリア */}
        {((char.interests || []).length > 0 || (char.knowledge_areas || []).length > 0) && (
          <div className="card" style={{ marginBottom: "1rem" }}>
            {(char.interests || []).length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: 12, color: cc, fontWeight: 700, marginBottom: "0.4rem" }}>💡 興味分野</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {char.interests.map((t, i) => (
                    <span key={i} style={{ fontSize: 12, background: `${cc}15`, color: cc, borderRadius: 20, padding: "0.2rem 0.7rem" }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {(char.knowledge_areas || []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "#4ECDC4", fontWeight: 700, marginBottom: "0.4rem" }}>🧠 習得した知識エリア</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {char.knowledge_areas.map((t, i) => (
                    <span key={i} style={{ fontSize: 12, background: "#f0fffe", color: "#4ECDC4", borderRadius: 20, padding: "0.2rem 0.7rem", border: "1px solid #4ECDC430" }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 進化ログ */}
        {(char.evolution_log || []).length > 0 && (
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: 12, color: "#888", fontWeight: 700, marginBottom: "0.6rem" }}>📖 {char.name}の成長記録</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {[...(char.evolution_log || [])].reverse().map((log, i) => (
                <div key={i} style={{ fontSize: 12, color: "#555", padding: "0.3rem 0", borderBottom: i < (char.evolution_log.length - 1) ? "1px solid #f5f5f5" : "none", lineHeight: 1.5 }}>
                  <span style={{ color: "#ddd", marginRight: "0.4rem" }}>●</span>{log}
                </div>
              ))}
            </div>
          </div>
        )}

        {!apiKey && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#bbb", padding: "0.75rem", background: "#fafafa", borderRadius: 12 }}>
            APIキーを設定するとセッション後に{char.name}が進化します
          </div>
        )}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [tab, setTab] = useState<Tab>("learn");
  const [apiKey, setApiKey] = useState("");
  const [apiInput, setApiInput] = useState("");
  const [authUser, setAuthUser] = useState<{ email: string; name: string } | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);

  const [topic, setTopic] = useState<TopicData | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [interim, setInterim] = useState("");
  const [chatInput, setChatInput] = useState("");

  const [profile, setProfile] = useState<ProfileEntry[]>([]);
  const [char, setChar] = useState<Character | null>(null);
  const [charEvolving, setCharEvolving] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [inputText, setInputText] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileData, setFileData] = useState<{ name: string; base64: string; mimeType: string } | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);

  const [skillMap, setSkillMap] = useState<SkillMap | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState("");
  const [proactive, setProactive] = useState<{
    message: string;
    suggestions: { topic: string; reason: string; emoji: string }[];
    mood: string;
  } | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<Record<string, unknown> | null>(null);

  // セッション状態
  const [leadingPenalty, setLeadingPenalty] = useState(0);
  const [gaveUpCount, setGaveUpCount] = useState(0);
  const [consecutiveFail, setConsecutiveFail] = useState(0);
  const [showQuit, setShowQuit] = useState(false);
  const [quitMsg, setQuitMsg] = useState("");

  // 演出
  const [reaction, setReaction] = useState<{ type: "praise" | "confused"; key: number } | null>(null);
  const [stageUp, setStageUp] = useState<{ char: Character; newStage: string } | null>(null);

  const rec = useSpeechRec();
  const synth = useSynth();
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const turnsRef = useRef<Turn[]>([]);
  const topicRef = useRef<TopicData | null>(null);
  const leadingRef = useRef(0);
  const gaveUpRef = useRef(0);
  const cfRef = useRef(0);
  const charRef = useRef<Character | null>(null);
  turnsRef.current = turns;
  topicRef.current = topic;
  leadingRef.current = leadingPenalty;
  gaveUpRef.current = gaveUpCount;
  cfRef.current = consecutiveFail;
  charRef.current = char;

  const cc = char?.color || "#FF6B6B";
  const userTurns = turns.filter(t => t.role === "user").length;

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    const k = localStorage.getItem("tg_apikey") || "";
    setApiKey(k); setApiInput(k);
    setProfile(loadProfile());
    const saved = loadChar();
    const savedGraph = loadGraph();
    if (savedGraph) setKnowledgeGraph(savedGraph);
    if (saved) {
      setChar(saved);
    } else {
      // デフォルトキャラをセット
      fetch("/api/character")
        .then(r => r.json())
        .then(d => {
          if (d.character) { setChar(d.character); saveChar(d.character); }
        })
        .catch(() => {});
    }
    // 認証ユーザー確認
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAuthUser({ email: user.email || "", name: user.user_metadata?.full_name || user.email || "" });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setAuthUser({ email: session.user.email || "", name: session.user.user_metadata?.full_name || session.user.email || "" });
      else setAuthUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interim]);

  // ── キャラ進化（セッション完了後に呼ぶ）────────────────────
  async function evolveChar(sessionResult: SessionResult, topicData: TopicData) {
    if (!apiKey || !charRef.current) return;
    setCharEvolving(true);
    try {
      const res = await fetch("/api/character", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          mode: "evolve",
          currentChar: charRef.current,
          session: {
            title: topicData.title,
            mode: topicData.mode,
            score: sessionResult.score.total,
            mastered: sessionResult.mastered,
            gaps: sessionResult.gaps,
            feedback: sessionResult.feedback,
          },
        }),
      });
      const d = await res.json();
      if (d.character) { setChar(d.character); saveChar(d.character); }
    } catch { /* 進化失敗は無視 */ }
    finally { setCharEvolving(false); }
  }

  // ── アナリティクス（セッション後に知識グラフ更新）────────────
  async function updateAnalytics(newProfile: ProfileEntry[]) {
    if (!newProfile.length) return;
    try {
      const existingGraph = loadGraph();
      const res = await fetch("/api/analytics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: newProfile, existingGraph }),
      });
      const d = await res.json();
      if (d.graph) { setKnowledgeGraph(d.graph); saveGraph(d.graph); }
    } catch { /* ignore */ }
  }

  // ── プロアクティブ提案取得 ───────────────────────────────────
  async function fetchProactive(p: ProfileEntry[], c: Character | null) {
    if (!apiKey || !c || p.length === 0) return;
    try {
      const g = loadGraph();
      const res = await fetch("/api/proactive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, character: c, graph: g, profile: p }),
      });
      const d = await res.json();
      if (d.message) setProactive(d);
    } catch { /* ignore */ }
  }

  // ── AIターン ─────────────────────────────────────────────────
  // history = AI挨拶を除いた過去のやりとり
  // userMessage = 今回のユーザー発言
  const doAiTurn = useCallback(async (
    td: TopicData,
    history: Turn[],
    userMessage: string,
    opts: { lp?: number; gu?: number; cf?: number; forceFinish?: boolean } = {}
  ) => {
    const { lp = 0, gu = 0, cf = 0, forceFinish = false } = opts;

    setVoiceState("processing");

    try {
      const res = await fetch("/api/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          topic: td.title,
          coreText: td.core_text || "",
          mode: td.mode,
          history,
          userMessage,
          forceFinish,
          character: charRef.current,
          leadingPenalty: lp,
          gaveUpCount: gu,
          consecutiveFail: cf,
        }),
      });

      const data = await res.json();

      if (data.error) {
        const fb = "申し訳ありません、エラーが発生しました。";
        setTurns(prev => [...prev, { role: "ai", text: fb }]);
        setVoiceState("speaking");
        synth.speak(fb, () => setVoiceState("idle"));
        return;
      }

      if (data.type === "quit") {
        setTurns(prev => [...prev, { role: "ai", text: data.message }]);
        setQuitMsg(data.message); setShowQuit(true);
        setVoiceState("speaking");
        synth.speak(data.message, () => setVoiceState("idle"));
        return;
      }

      const aiText = data.message || "もう少し詳しく教えてもらえますか？";
      setTurns(prev => [...prev, { role: "ai", text: aiText }]);

      // ペナルティ更新
      const newLp = lp + (data.leading_penalty || 0);
      setLeadingPenalty(newLp); leadingRef.current = newLp;

      // 連続失敗カウント
      const failKw = ["わからない", "わかりません", "もう少し", "理解できません", "もう一回", "整理して"];
      const isFail = failKw.some(k => aiText.includes(k));
      const newCf = isFail ? cf + 1 : 0;
      setConsecutiveFail(newCf); cfRef.current = newCf;

      // 演出
      const praiseKw = ["なるほど", "わかった", "正確", "天才", "すごい", "最高", "完璧", "悪くない", "さすが", "正しい", "そういうこと", "評価"];
      if (praiseKw.some(k => aiText.includes(k))) setReaction({ type: "praise", key: Date.now() });
      else if (isFail) setReaction({ type: "confused", key: Date.now() });

      if (data.type === "complete") {
        const score = data.score || { coverage: 50, depth: 50, clarity: 50, total: 50 };
        setResult({
          score,
          raw_score: data.raw_score || score,
          feedback: data.feedback || "",
          mastered: Array.isArray(data.mastered) ? data.mastered : [],
          gaps: Array.isArray(data.gaps) ? data.gaps : [],
          message: aiText,
          leading_penalty: data.leading_penalty || 0,
          gave_up_penalty: data.gave_up_penalty || 0,
        });

        const entry: ProfileEntry = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString("ja-JP"),
          title: td.title, mode: td.mode,
          score: score.total,
          mastered: Array.isArray(data.mastered) ? data.mastered : [],
          gaps: Array.isArray(data.gaps) ? data.gaps : [],
        };
        saveProfileEntry(entry);
        const newProfile = loadProfile();
        setProfile(newProfile);

        // 知識グラフ更新（バックグラウンド）
        updateAnalytics(newProfile);

        // キャラ成長チェック＆進化
        const c = charRef.current;
        if (c) {
          const prevStage = stageLabel(c, newProfile.length - 1);
          const newStage = stageLabel(c, newProfile.length);
          if (prevStage !== newStage) setStageUp({ char: c, newStage });
        }

        // セッション完了後にキャラを進化させる（非同期・バックグラウンド）
        const resultForEvolve: SessionResult = {
          score,
          raw_score: data.raw_score || score,
          feedback: data.feedback || "",
          mastered: Array.isArray(data.mastered) ? data.mastered : [],
          gaps: Array.isArray(data.gaps) ? data.gaps : [],
          message: aiText,
          leading_penalty: data.leading_penalty || 0,
          gave_up_penalty: data.gave_up_penalty || 0,
        };
        evolveChar(resultForEvolve, td);

        setVoiceState("speaking");
        synth.speak(aiText, () => {
          setVoiceState("idle");
          setTimeout(() => setScreen("result"), 800);
        });
        return;
      }

      setVoiceState("speaking");
      synth.speak(aiText, () => setVoiceState("idle"));

    } catch {
      const fb = "通信エラーが発生しました。";
      setTurns(prev => [...prev, { role: "ai", text: fb }]);
      setVoiceState("speaking");
      synth.speak(fb, () => setVoiceState("idle"));
    }
  }, [apiKey, synth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ingest ───────────────────────────────────────────────────
  async function handleStart() {
    if (!apiKey) { setShowApiModal(true); return; }
    if (!inputUrl.trim() && !inputText.trim() && !fileContent && !fileData) {
      setError("URLかテキストを入力してください"); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          url: inputUrl.trim() || undefined,
          text: !fileData ? (fileContent || inputText.trim()) || undefined : undefined,
          file: fileData || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "読み込みに失敗しました");

      setTopic(data);
      setTurns([]);
      setResult(null);
      setLeadingPenalty(0); setGaveUpCount(0); setConsecutiveFail(0);
      leadingRef.current = 0; gaveUpRef.current = 0; cfRef.current = 0;
      setReaction(null);
      setScreen("session");

      // 最初のAI発言: キャラの口調 + ingestが生成した易しい入口質問
      setTimeout(() => {
        const char = charRef.current;
        // キャラのイントロがある場合はそれを先に、その後に易しい最初の質問を続ける
        const firstQuestion = data.first_prompt || `${data.title}って、一言でいうとどんなもの？`;
        const introText = char?.intro
          ? `${char.intro} …で、まず教えてほしいんだけど、${firstQuestion}`
          : firstQuestion;
        setTurns([{ role: "ai", text: introText }]);
        setVoiceState("speaking");
        synth.speak(introText, () => setVoiceState("idle"));
      }, 400);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // ── Skills ───────────────────────────────────────────────────
  async function loadSkillMap() {
    const p = loadProfile();
    if (!p.length) { setSkillError("学習履歴がありません"); return; }
    if (!apiKey) { setShowApiModal(true); return; }
    setSkillLoading(true); setSkillError("");
    try {
      const res = await fetch("/api/skills", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, profile: p, character: char }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSkillMap(data);
    } catch (e: unknown) { setSkillError(e instanceof Error ? e.message : "エラー"); }
    finally { setSkillLoading(false); }
  }

  // ── ユーザー発言を送信 ──────────────────────────────────────
  function submitText(text: string) {
    if (!topicRef.current || voiceState !== "idle") return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const newTurns: Turn[] = [...turnsRef.current, { role: "user", text: trimmed }];
    setTurns(newTurns);

    // historyは「最初のAI挨拶を除いた」過去ターン（今回のuserは含まない）
    const history = turnsRef.current.slice(1);
    doAiTurn(
      topicRef.current,
      history,
      trimmed,
      { lp: leadingRef.current, gu: gaveUpRef.current, cf: cfRef.current }
    );
  }

  function submitChat() {
    if (!chatInput.trim() || voiceState !== "idle") return;
    const t = chatInput.trim();
    setChatInput("");
    submitText(t);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  }

  function pressMic() {
    if (voiceState !== "idle") return;
    setVoiceState("listening"); setInterim("");
    if (!rec.supported) {
      const t = window.prompt("テキストを入力：");
      if (t) submitText(t); else setVoiceState("idle");
      return;
    }
    rec.start(t => setInterim(t), t => {
      setInterim("");
      if (t.trim()) submitText(t); else setVoiceState("idle");
    });
  }
  function releaseMic() { if (voiceState === "listening") rec.stop(); }

  function forceEnd() {
    if (!topicRef.current || voiceState !== "idle") return;
    const history = turnsRef.current.slice(1);
    const lastUserText = [...turnsRef.current].reverse().find(t => t.role === "user")?.text || "以上です";
    doAiTurn(topicRef.current, history, lastUserText, {
      lp: leadingRef.current, gu: gaveUpRef.current, cf: cfRef.current, forceFinish: true,
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const name = f.name.toLowerCase();
    const isTxt = f.type.includes("text") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv");
    if (isTxt) {
      const t = await f.text(); setFileContent(t.slice(0, 20000)); setFileData(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1];
        setFileData({ name: f.name, base64: b64, mimeType: f.type || "application/octet-stream" });
        setFileContent("");
      };
      reader.readAsDataURL(f);
    }
    setFileInfo({ name: f.name, size: f.size });
    setInputUrl(""); setInputText("");
  }

  // ════════════════════════════════════════════════════════════
  //  CHARACTER DETAIL SCREEN
  // ════════════════════════════════════════════════════════════
  if (screen === "char_detail" && char) return (
    <CharDetail
      char={char} profile={profile} apiKey={apiKey}
      evolving={charEvolving}
      onBack={() => setScreen("home")}
    />
  );

  // ════════════════════════════════════════════════════════════
  //  SESSION SCREEN
  // ════════════════════════════════════════════════════════════
  if (screen === "session" && topic) {
    const progress = Math.min((userTurns / 7) * 100, 100);
    const isDisabled = voiceState !== "idle";

    return (
      <div className="session-wrap app">
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

        {/* Stage-up */}
        {stageUp && <StageUpBanner char={stageUp.char} newStage={stageUp.newStage} onDone={() => setStageUp(null)} />}

        {/* キャラ感情バナー */}
        {reaction && char && (
          <div key={reaction.key} style={{
            position: "absolute", top: "45%", left: "50%",
            transform: "translate(-50%,-50%)",
            background: reaction.type === "praise" ? `${cc}e0` : "rgba(60,60,60,0.88)",
            color: "#fff", padding: "0.65rem 1.4rem", borderRadius: 100,
            fontWeight: 700, fontSize: 14, pointerEvents: "none", zIndex: 30,
            whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            animation: "fadeIn 0.2s ease",
          }}>
            {reaction.type === "praise" ? char.praise : char.confused}
          </div>
        )}

        {/* Header */}
        <div className="session-header">
          <button className="btn-ghost" onClick={() => { synth.cancel(); setScreen("home"); }}
            style={{ fontSize: 20, color: "#bbb", padding: "0.2rem 0.5rem" }}>←</button>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {MODE_EMOJI[topic.mode]} {topic.title}
            </div>
            {char && (
              <div style={{ fontSize: 10, color: cc, fontWeight: 600, display: "flex", gap: "0.3rem", alignItems: "center" }}>
                {char.emoji} {char.name}
                <span style={{ opacity: 0.5 }}>·</span>
                {stageLabel(char, profile.length)}
                {leadingPenalty > 0 && (
                  <span style={{ color: "#FF6B6B", fontSize: 9, marginLeft: 4 }}>誘導 −{leadingPenalty}pt</span>
                )}
              </div>
            )}
          </div>
          {userTurns >= 3 && !isDisabled && (
            <button className="btn-ghost" onClick={forceEnd}
              style={{ fontSize: 12, color: cc, fontWeight: 700, padding: "0.2rem 0.5rem", whiteSpace: "nowrap" }}>終了</button>
          )}
        </div>

        {/* Progress & Stage indicator */}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%`, background: cc }} />
        </div>
        {userTurns > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "0.3rem", padding: "0.3rem 1rem 0", flexWrap: "wrap" }}>
            {[
              { turn: 1, label: "入口", icon: "🚪" },
              { turn: 2, label: "具体化", icon: "🔍" },
              { turn: 3, label: "仕組み", icon: "⚙️" },
              { turn: 4, label: "つながり", icon: "🔗" },
              { turn: 5, label: "統合", icon: "🧩" },
            ].map(s => {
              const done = userTurns > s.turn;
              const active = userTurns === s.turn;
              return (
                <div key={s.turn} style={{
                  display: "flex", alignItems: "center", gap: "0.2rem",
                  padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: done ? `${cc}20` : active ? `${cc}10` : "#f5f5f5",
                  color: done ? cc : active ? cc : "#ccc",
                  border: `1px solid ${active ? cc : "transparent"}`,
                  transition: "all 0.3s",
                }}>
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  {done && <span style={{ fontSize: 8 }}>✓</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Chat */}
        <div ref={chatRef} className="chat-area">
          {turns.map((t, i) => (
            <div key={i} className="fade-in" style={{
              display: "flex", flexDirection: t.role === "ai" ? "row" : "row-reverse",
              gap: "0.5rem", alignItems: "flex-end",
            }}>
              {t.role === "ai" && (
                char
                  ? <Avatar char={char} size={34} pulse={i === turns.length - 1 && voiceState === "speaking"} />
                  : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
              )}
              <div className={`chat-bubble ${t.role}`}
                style={t.role === "user" ? { background: cc, boxShadow: `0 2px 10px ${cc}40` } : {}}>
                {t.text}
              </div>
            </div>
          ))}
          {voiceState === "processing" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
              {char ? <Avatar char={char} size={34} /> : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div>}
              <div className="chat-bubble ai" style={{ padding: "0.65rem 0.9rem" }}>
                <Bars color={cc} />
              </div>
            </div>
          )}
          {interim && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ maxWidth: "80%", padding: "0.6rem 0.9rem", fontSize: 13, fontStyle: "italic", color: cc, background: `${cc}10`, borderRadius: "16px 4px 16px 16px" }}>{interim}</div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="input-bar">
          <div style={{ position: "relative", flex: 1 }}>
            <textarea ref={chatInputRef} value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitChat(); } }}
              placeholder={voiceState === "listening" ? "🎙️ 聞いています..." : voiceState === "processing" ? "⌛ 処理中..." : "テキストで入力... (Enter送信)"}
              disabled={isDisabled}
              className="input-base" rows={1}
              style={{
                borderRadius: 20, padding: "0.65rem 2.6rem 0.65rem 0.9rem",
                resize: "none", maxHeight: 120, overflowY: "auto", lineHeight: 1.5,
                background: isDisabled ? "#fafafa" : "#fff",
                border: `1.5px solid ${isDisabled ? "#eee" : "#e0e0e0"}`,
                marginBottom: 0,
              }} />
            {chatInput.trim() && !isDisabled && (
              <button onClick={submitChat} style={{
                position: "absolute", right: 7, bottom: 7,
                width: 28, height: 28, borderRadius: "50%",
                border: "none", background: cc, color: "#fff",
                fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>↑</button>
            )}
          </div>
          {rec.supported && (
            <button
              onPointerDown={pressMic} onPointerUp={releaseMic}
              disabled={isDisabled && voiceState !== "listening"}
              style={{
                width: 44, height: 44, borderRadius: "50%", border: "none", flexShrink: 0,
                background: voiceState === "listening" ? cc : "#f5f5f5",
                boxShadow: voiceState === "listening" ? `0 0 0 6px ${cc}30` : "none",
                fontSize: 20, cursor: (isDisabled && voiceState !== "listening") ? "default" : "pointer",
                transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center",
                opacity: (isDisabled && voiceState !== "listening") ? 0.4 : 1,
              }}>
              {voiceState === "listening" ? "🎙️" : "🎤"}
            </button>
          )}
        </div>

        {/* Quit Modal */}
        {showQuit && (
          <div className="overlay" onClick={() => setShowQuit(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <div style={{ fontSize: 44, marginBottom: "0.5rem" }}>{char?.emoji ?? "😓"}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#222" }}>教材を読み直してみよう</div>
              </div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.75, marginBottom: "1.25rem", background: "#fafafa", padding: "0.75rem", borderRadius: 12 }}>{quitMsg}</div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn-primary" onClick={() => { setShowQuit(false); setScreen("home"); setTopic(null); }} style={{ flex: 1, marginTop: 0 }}>教材に戻る</button>
                <button className="btn-primary" onClick={() => {
                  setShowQuit(false);
                  setTurns([]); setLeadingPenalty(0); setGaveUpCount(0); setConsecutiveFail(0);
                  leadingRef.current = 0; gaveUpRef.current = 0; cfRef.current = 0;
                  setTimeout(() => {
                    const introText = charRef.current?.intro || topic.first_prompt || "";
                    setTurns([{ role: "ai", text: introText }]);
                    setVoiceState("speaking");
                    synth.speak(introText, () => setVoiceState("idle"));
                  }, 300);
                }} style={{ flex: 1, marginTop: 0, background: "#f5f5f5", color: "#555" }}>もう一度</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  RESULT SCREEN
  // ════════════════════════════════════════════════════════════
  if (screen === "result" && result && topic) {
    const total = result.score.total;
    const topEmoji = total >= 85 ? "🎉" : total >= 70 ? "✨" : total >= 50 ? "💪" : "📚";
    const headline = total >= 85 ? "完璧な説明！" : total >= 70 ? "よくできました！" : total >= 50 ? "もう少し深めよう！" : "教材を読み直そう";
    const hasPenalty = result.leading_penalty > 0 || result.gave_up_penalty > 0;

    return (
      <div className="app" style={{ overflowY: "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {stageUp && <StageUpBanner char={stageUp.char} newStage={stageUp.newStage} onDone={() => setStageUp(null)} />}
        <div className="result-wrap">
          <div className="result-inner">
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 56, lineHeight: 1 }}>{topEmoji}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#222", marginTop: "0.5rem" }}>{headline}</div>
              <div style={{ fontSize: 13, color: "#bbb", marginTop: "0.2rem" }}>{topic.title}</div>
              {char && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem", padding: "0.3rem 0.75rem", borderRadius: 100, background: `${cc}12`, border: `1px solid ${cc}30` }}>
                  <span>{char.emoji}</span>
                  <span style={{ fontSize: 12, color: cc, fontWeight: 600 }}>{char.name} との学習セッション</span>
                </div>
              )}
            </div>

            {/* Score */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "0.5rem", marginBottom: result.grade ? "1rem" : 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: cc, lineHeight: 1 }}>{total}</div>
                  {result.grade && (
                    <div style={{
                      display: "inline-block", padding: "2px 12px", borderRadius: 20,
                      background: result.grade === "S" ? "#FFD700" : result.grade === "A" ? cc : result.grade === "B" ? "#4ECDC4" : result.grade === "C" ? "#F5A623" : "#FF6B6B",
                      color: result.grade === "S" ? "#000" : "#fff",
                      fontSize: 13, fontWeight: 800, marginTop: "0.3rem",
                    }}>Grade {result.grade}</div>
                  )}
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: "0.2rem" }}>総合スコア</div>
                </div>
                <Ring value={result.score.coverage} color="#FF6B6B" label="網羅性" />
                <Ring value={result.score.depth} color="#4ECDC4" label="深さ" />
                <Ring value={result.score.clarity} color="#45B7D1" label="明瞭さ" />
              </div>
              {result.score_breakdown && (
                <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                  {[
                    { key: "structural_coherence", label: "論理構造", color: "#8E44AD" },
                    { key: "spontaneity", label: "自発性", color: "#E67E22" },
                  ].map(({ key, label, color }) => {
                    const val = (result.score_breakdown as Record<string, number>)[key] ?? 0;
                    return (
                      <div key={key} style={{ flex: 1, background: "#fafafa", borderRadius: 10, padding: "0.5rem", textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                        <div style={{ fontSize: 10, color: "#bbb" }}>{label}</div>
                      </div>
                    );
                  })}
                  {result.insight && (
                    <div style={{ flex: 3, background: `${cc}08`, borderRadius: 10, padding: "0.5rem 0.75rem", display: "flex", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>💡 {result.insight}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Penalty */}
            {hasPenalty && (
              <div className="card" style={{ marginBottom: "1rem", background: "#fff8f8", borderColor: "#FF6B6B30" }}>
                <div style={{ fontSize: 11, color: "#FF6B6B", fontWeight: 700, marginBottom: "0.5rem" }}>⚠️ スコア補正</div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: "0.3rem" }}>補正前スコア: {result.raw_score.total}点</div>
                {result.leading_penalty > 0 && <div style={{ fontSize: 12, color: "#FF6B6B" }}>誘導質問ペナルティ: −{result.leading_penalty}pt</div>}
                {result.gave_up_penalty > 0 && <div style={{ fontSize: 12, color: "#FF6B6B", marginTop: "0.2rem" }}>未解答ペナルティ: −{result.gave_up_penalty}pt</div>}
              </div>
            )}

            {/* Feedback */}
            <div className="card" style={{ marginBottom: "1rem", background: `${cc}06`, borderColor: `${cc}25` }}>
              <div style={{ fontSize: 11, color: cc, fontWeight: 700, marginBottom: "0.4rem" }}>
                {char ? `${char.emoji} ${char.name}からのフィードバック` : "フィードバック"}
              </div>
              <div style={{ fontSize: 14, color: "#444", lineHeight: 1.75 }}>{result.feedback}</div>
            </div>

            {/* Mastered / Gaps */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div className="card">
                <div style={{ fontSize: 11, color: "#4ECDC4", fontWeight: 700, marginBottom: "0.4rem" }}>✓ 理解できた</div>
                {result.mastered.length ? result.mastered.map(c => (
                  <div key={c} style={{ fontSize: 12, color: "#333", padding: "0.15rem 0", borderBottom: "1px solid #f8f8f8" }}>· {c}</div>
                )) : <div style={{ fontSize: 12, color: "#ccc" }}>—</div>}
              </div>
              <div className="card">
                <div style={{ fontSize: 11, color: "#FF6B6B", fontWeight: 700, marginBottom: "0.4rem" }}>△ 要復習</div>
                {result.gaps.length ? result.gaps.map(c => (
                  <div key={c} style={{ fontSize: 12, color: "#333", padding: "0.15rem 0", borderBottom: "1px solid #f8f8f8" }}>· {c}</div>
                )) : <div style={{ fontSize: 12, color: "#ccc" }}>—</div>}
              </div>
            </div>

            {/* キャラ成長バー */}
            {char && (
              <div className="card" style={{ marginBottom: "1.25rem", borderColor: `${cc}25`, background: `${cc}05` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <Avatar char={char} size={40} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{char.name}との絆</div>
                    <div style={{ fontSize: 11, color: cc }}>{stageLabel(char, profile.length)} · {profile.length}セッション</div>
                  </div>
                </div>
                <StageBar char={char} n={profile.length} />
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn-primary" onClick={() => {
                setTurns([]); setResult(null);
                setLeadingPenalty(0); setGaveUpCount(0); setConsecutiveFail(0);
                leadingRef.current = 0; gaveUpRef.current = 0; cfRef.current = 0;
                setScreen("session");
                setTimeout(() => {
                  const introText = charRef.current?.intro || topic.first_prompt || "";
                  setTurns([{ role: "ai", text: introText }]);
                  setVoiceState("speaking");
                  synth.speak(introText, () => setVoiceState("idle"));
                }, 400);
              }} style={{ flex: 1, background: cc, marginTop: 0 }}>もう一度</button>
              <button className="btn-primary" onClick={() => {
                setScreen("home"); setTopic(null);
                setInputUrl(""); setInputText(""); setFileContent(""); setFileData(null); setFileInfo(null);
              }} style={{ flex: 1, background: "#f5f5f5", color: "#555", marginTop: 0 }}>別トピックへ</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  HOME SCREEN
  // ════════════════════════════════════════════════════════════
  return (
    <div className="app">
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── 認証ヘッダー ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)", borderBottom: "1px solid #f0f0f0",
        marginBottom: 4,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#222", letterSpacing: "-0.5px" }}>
          teach<span style={{ color: cc }}>AI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {authUser ? (
            <>
              <span style={{ fontSize: 12, color: "#888", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {authUser.name}
              </span>
              <a href="/dashboard" style={{ padding: "5px 12px", background: "#0A2342", color: "white", borderRadius: 8, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                📊 ダッシュボード
              </a>
              <button onClick={async () => { const sb = createClient(); await sb.auth.signOut(); setAuthUser(null); }}
                style={{ padding: "5px 12px", background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#666" }}>
                ログアウト
              </button>
            </>
          ) : (
            <>
              <a href="/auth/login" style={{ padding: "5px 14px", background: "transparent", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none", fontSize: 12, color: "#555", fontWeight: 600 }}>
                ログイン
              </a>
              <a href="/auth/signup" style={{ padding: "5px 14px", background: "#0A2342", color: "white", borderRadius: 8, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                無料登録
              </a>
            </>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div className="container home-wrap">

          {/* Tabs */}
          <div className="tab-nav">
            <button className={`tab-btn ${tab === "learn" ? "active" : ""}`} onClick={() => setTab("learn")}>✨ 学習する</button>
            <button className={`tab-btn ${tab === "skills" ? "active" : ""}`} onClick={() => setTab("skills")}>📊 スキルマップ</button>
            <a href="/api/docs" target="_blank" rel="noopener" style={{
              marginLeft: "auto", fontSize: 11, color: "#bbb", textDecoration: "none",
              display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.25rem 0.5rem",
              border: "1px solid #eee", borderRadius: 8,
            }} title="API ドキュメント（開発者向け）">
              <span>⚡</span><span>API</span>
            </a>
          </div>

          {tab === "learn" && (
            <>
              {/* キャラバナー */}
              {char ? (
                <button onClick={() => setScreen("char_detail")}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.875rem",
                    padding: "0.875rem 1rem", borderRadius: 18,
                    background: `${cc}09`, border: `1.5px solid ${cc}22`,
                    marginBottom: "1rem", cursor: "pointer", textAlign: "left", width: "100%",
                    fontFamily: "inherit",
                  }}>
                  <Avatar char={char} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: "#222" }}>{char.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#777", lineHeight: 1.4, marginBottom: "0.4rem" }}>
                      {char.intro.length > 60 ? char.intro.slice(0, 60) + "…" : char.intro}
                    </div>
                    <StageBar char={char} n={profile.length} />
                  </div>
                  <div style={{ fontSize: 16, color: "#ddd", flexShrink: 0 }}>›</div>
                </button>
              ) : (
                <button onClick={() => setScreen("char_detail")}
                  style={{ width: "100%", padding: "0.875rem", borderRadius: 18, border: "1.5px dashed #ddd", background: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "#aaa", fontSize: 13, cursor: "pointer", marginBottom: "1rem", fontFamily: "inherit" }}>
                  ＋ キャラクターを選択する
                </button>
              )}

              {/* 入力カード */}
              <div className="card" style={{ marginBottom: "1rem" }}>
                {/* 入力モードタブ */}
                {(() => {
                  const inputMode = inputUrl.trim() ? "url"
                    : (fileContent || fileData) ? "file"
                    : inputText.trim() ? "text"
                    : "url";
                  const tabs = [
                    { id: "url",  icon: "🔗", label: "URL" },
                    { id: "text", icon: "✏️", label: "テキスト" },
                    { id: "file", icon: "📎", label: "ファイル" },
                  ] as const;
                  return (
                    <>
                      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.75rem" }}>
                        {tabs.map(t => (
                          <button key={t.id}
                            onClick={() => {
                              if (t.id === "url") { setInputText(""); setFileContent(""); setFileData(null); setFileInfo(null); }
                              if (t.id === "text") { setInputUrl(""); setFileContent(""); setFileData(null); setFileInfo(null); }
                              if (t.id === "file") { setInputUrl(""); setInputText(""); fileRef.current?.click(); }
                            }}
                            style={{
                              padding: "0.3rem 0.75rem", borderRadius: 20, border: "1.5px solid",
                              borderColor: inputMode === t.id ? cc : "#eee",
                              background: inputMode === t.id ? `${cc}10` : "#fafafa",
                              color: inputMode === t.id ? cc : "#aaa",
                              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>

                      {/* URL入力 */}
                      {(inputMode === "url" || !inputText.trim()) && !(fileContent || fileData) && (
                        <input value={inputUrl}
                          onChange={e => { setInputUrl(e.target.value); setFileContent(""); setFileData(null); setFileInfo(null); setInputText(""); }}
                          placeholder="YouTube URL / WebサイトURL / ブログ記事URL..."
                          className="input-base"
                          style={{ marginBottom: "0.5rem" }}
                          onKeyDown={e => e.key === "Enter" && handleStart()} />
                      )}

                      {/* テキスト入力 */}
                      {(inputMode === "text" || inputText.trim()) && !inputUrl.trim() && !(fileContent || fileData) && (
                        <textarea value={inputText}
                          onChange={e => { setInputText(e.target.value); setFileContent(""); }}
                          placeholder="本・記事・メモの内容を貼り付けるか、学びたいことを自由に書いてください... 例: 光合成について"


                          rows={5} className="input-base" style={{ resize: "vertical", marginBottom: 0 }} />
                      )}

                      {/* ファイル添付 */}
                      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.csv" onChange={handleFile} style={{ display: "none" }} />
                      {(fileContent || fileData) && fileInfo && (
                        <div style={{ fontSize: 12, color: "#4ECDC4", padding: "0.5rem 0.75rem", background: "#f0fffe", borderRadius: 10, marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>✓ {fileInfo.name}（{(fileInfo.size / 1024).toFixed(1)} KB）</span>
                          <button onClick={() => { setFileContent(""); setFileData(null); setFileInfo(null); }} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                        </div>
                      )}

                      {/* 対応フォーマット */}
                      {inputMode !== "text" && !inputText.trim() && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "0.4rem" }}>
                          {["YouTube", "Web", "note", "Qiita", "Zenn", "PDF", "DOCX", "XLSX", "PPTX", "TXT"].map(f => (
                            <span key={f} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: "#f5f5f5", color: "#aaa" }}>{f}</span>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                {error && <div style={{ fontSize: 13, color: "#FF6B6B", padding: "0.4rem 0.6rem", background: "#fff5f5", borderRadius: 8, marginTop: "0.5rem" }}>{error}</div>}

                <button className="btn-primary" onClick={handleStart} disabled={loading}
                  style={{ marginTop: "0.75rem", background: char ? cc : undefined }}>
                  {loading ? "✨ AIが読み込んでいます..." : `${char ? char.emoji + " " : "✨ "}学習を始める`}
                </button>
              </div>

              <button className="btn-ghost" onClick={() => setShowApiModal(true)}
                style={{ display: "block", width: "100%", textAlign: "center", fontSize: 12, color: "#bbb", padding: "0.4rem 0", marginBottom: "1.5rem" }}>
                {apiKey ? `🔑 ${detectProviderLabel(apiKey).label}` : "⚠️ AIのAPIキーを設定してください"}
              </button>

              {/* プロアクティブ提案 */}
              {profile.length > 0 && !proactive && apiKey && char && (
                <button
                  onClick={() => fetchProactive(profile, char)}
                  style={{
                    width: "100%", padding: "0.75rem 1rem", marginBottom: "1rem",
                    background: `${cc}09`, border: `1.5px dashed ${cc}30`,
                    borderRadius: 14, cursor: "pointer", textAlign: "left",
                    fontSize: 12, color: "#bbb", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "0.5rem",
                  }}>
                  <span style={{ fontSize: 18 }}>{char.emoji}</span>
                  <span>{char.name}に「今日教えてほしいこと」を聞く</span>
                </button>
              )}
              {proactive && (
                <div className="fade-in card" style={{
                  background: `${cc}08`, borderColor: `${cc}22`,
                  marginBottom: "1rem",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: 26 }}>{char?.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: cc, fontWeight: 700, marginBottom: "0.2rem" }}>
                        {char?.name}からのリクエスト
                      </div>
                      <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>
                        {proactive.message}
                      </div>
                    </div>
                    <button onClick={() => setProactive(null)} style={{ background: "none", border: "none", fontSize: 16, color: "#ddd", cursor: "pointer", padding: 0 }}>×</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {(proactive.suggestions || []).map((s, i) => (
                      <button key={i}
                        onClick={() => {
                          setInputText(s.topic);
                          setProactive(null);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.6rem",
                          padding: "0.5rem 0.75rem", borderRadius: 10,
                          background: "#fff", border: "1px solid #f0f0f0",
                          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}>
                        <span style={{ fontSize: 18 }}>{s.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{s.topic}</div>
                          <div style={{ fontSize: 11, color: "#bbb" }}>{s.reason}</div>
                        </div>
                        <span style={{ fontSize: 12, color: cc }}>教える →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 履歴 */}
              {profile.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "#ccc", marginBottom: "0.5rem", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>最近の学習</div>
                  {profile.slice(0, 5).map(e => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0", borderBottom: "1px solid #f5f5f5" }}>
                      <span style={{ fontSize: 18 }}>{MODE_EMOJI[e.mode]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                        <div style={{ fontSize: 11, color: "#bbb" }}>{e.date}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: e.score >= 70 ? "#4ECDC4" : e.score >= 50 ? "#F5A623" : "#FF6B6B" }}>{e.score}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "skills" && (
            <SkillsView
              profile={profile} skillMap={skillMap}
              skillLoading={skillLoading} skillError={skillError}
              onLoad={loadSkillMap} onRefresh={() => { setSkillMap(null); loadSkillMap(); }}
            />
          )}
        </div>
      </div>

      {/* API Modal */}
      {showApiModal && (() => {
        const detected = detectProviderLabel(apiInput);
        const providers = [
          { id: "anthropic", label: "Claude", sub: "Anthropic Console", color: "#CC785C", placeholder: "sk-ant-...", url: "https://console.anthropic.com/settings/keys" },
          { id: "openai",    label: "GPT",    sub: "OpenAI Platform",   color: "#10A37F", placeholder: "sk-...", url: "https://platform.openai.com/api-keys" },
          { id: "gemini",    label: "Gemini", sub: "Google AI Studio",  color: "#4285F4", placeholder: "AIza...", url: "https://aistudio.google.com/app/apikey" },
          { id: "bedrock",   label: "Bedrock",sub: "AWS Console",       color: "#FF9900", placeholder: "aws:ACCESS_KEY:SECRET:REGION", url: "https://aws.amazon.com/bedrock/" },
        ];
        return (
          <div className="overlay" onClick={() => setShowApiModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: "0.25rem" }}>AI APIキー設定</div>
              <div style={{ fontSize: 12, color: "#bbb", marginBottom: "1rem" }}>
                4つのAIプロバイダーに対応しています
              </div>

              {/* プロバイダー選択グリッド */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {providers.map(p => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: "0.5rem 0.6rem", borderRadius: 10,
                      border: `1.5px solid ${detected.color === p.color ? p.color : "#eee"}`,
                      background: detected.color === p.color ? `${p.color}08` : "#fafafa",
                      textDecoration: "none", display: "block",
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>{p.sub}</div>
                    <div style={{ fontSize: 9, color: "#ccc", marginTop: 2, fontFamily: "monospace" }}>{p.placeholder}</div>
                  </a>
                ))}
              </div>

              {/* キー入力 */}
              <div style={{ position: "relative" }}>
                <input type="password" value={apiInput} onChange={e => setApiInput(e.target.value)}
                  placeholder="APIキーを貼り付け..."
                  className="input-base" style={{ marginBottom: "0.4rem", paddingRight: "120px" }}
                  onKeyDown={e => { if (e.key === "Enter") { const k = apiInput.trim(); setApiKey(k); localStorage.setItem("tg_apikey", k); setShowApiModal(false); } }} />
                {apiInput && (
                  <div style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-60%)",
                    fontSize: 11, fontWeight: 700, color: detected.color, whiteSpace: "nowrap",
                  }}>{detected.label}</div>
                )}
              </div>

              {/* Bedrock ヘルプ */}
              {apiInput.startsWith("aws:") && (
                <div style={{ fontSize: 11, color: "#888", background: "#FFF8E1", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.5rem" }}>
                  Bedrock形式: aws:アクセスキーID:シークレットキー:リージョン<br/>例: aws:AKIA...:xxxx:ap-northeast-1
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn-primary" onClick={() => { const k = apiInput.trim(); setApiKey(k); localStorage.setItem("tg_apikey", k); setShowApiModal(false); }}
                  style={{ flex: 1, marginTop: 0, background: detected.color !== "#bbb" ? detected.color : undefined }}>
                  保存
                </button>
                <button className="btn-primary" onClick={() => setShowApiModal(false)}
                  style={{ flex: 1, marginTop: 0, background: "#f5f5f5", color: "#555" }}>閉じる</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
