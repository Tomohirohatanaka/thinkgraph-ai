"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { convertV3toV2, V3_WEIGHTS, V3Dimension } from "@/lib/scoring-v3";
import GraphComparison from "@/components/GraphComparison";
import CharacterGrowthTimeline from "@/components/CharacterGrowthTimeline";

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

interface ScoreV3Data {
  raw: { completeness: number; depth: number; clarity: number; structural_coherence: number; pedagogical_insight: number };
  weighted: number;
  grade: "A" | "B" | "C" | "D" | "F";
  conjunctive_pass: boolean;
  insight: string;
  kb_mode: string;
  rqs_avg: number;
}

interface SessionResult {
  score: ScoreData; raw_score: ScoreData;
  feedback: string; mastered: string[]; gaps: string[]; message: string;
  leading_penalty: number; gave_up_penalty: number;
  grade?: "S" | "A" | "B" | "C" | "D" | "F";
  insight?: string;
  score_breakdown?: { coverage: number; depth: number; clarity: number; structural_coherence: number; spontaneity: number; total: number };
  improvement_suggestions?: string[];
  // v3 fields
  score_v3?: ScoreV3Data;
  scoring_version?: "v2" | "v3";
  kb_mode?: string;
}

interface GrowthStage { label: string; threshold: number; }
interface CharVoice { rate: number; pitch: number; }
interface Character {
  id: string; name: string; emoji: string; color: string;
  personality: string; speaking_style: string;
  praise: string; struggle: string; confused: string;
  intro: string; lore: string;
  interests: string[];
  knowledge_areas: string[];
  growth_stages: GrowthStage[];
  evolution_log: string[];
  custom_name?: string;
  custom_personality?: string;
  voice?: CharVoice;
}

interface ProfileEntry {
  id: string; date: string; title: string; mode: Mode;
  score: number; mastered: string[]; gaps: string[];
  solo_v3?: { completeness: number; depth: number; clarity: number; structural_coherence: number; pedagogical_insight: number };
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

// キャラクター別デフォルト音声設定
const DEFAULT_CHAR_VOICE: Record<string, CharVoice> = {
  mio:  { rate: 1.10, pitch: 1.20 },  // ミオ: 元気で高め
  sora: { rate: 0.95, pitch: 0.90 },  // ソラ: 落ち着いて低め
  haru: { rate: 1.05, pitch: 1.05 },  // ハル: 標準的
  rin:  { rate: 1.00, pitch: 1.15 },  // リン: やや高め丁寧
};
function getCharVoice(char: Character | null): CharVoice {
  if (char?.voice) return char.voice;
  if (char?.id && DEFAULT_CHAR_VOICE[char.id]) return DEFAULT_CHAR_VOICE[char.id];
  return { rate: 1.05, pitch: 1.05 };
}

// テキスト入力の制限値
const TEXT_INPUT_LIMIT = 50000;       // 50,000文字 ≈ 約100KB
const FILE_TEXT_LIMIT = 50000;        // テキストファイルの読取上限
const AUTO_SPLIT_THRESHOLD = 30000;   // この文字数を超えたら分割を提案

// ─── Provider detection (frontend mirror of llm.ts) ─────────────
function detectProviderLabel(key: string): { label: string; color: string; placeholder: string } {
  if (key.startsWith("sk-ant-"))       return { label: "Claude (Anthropic)", color: "#CC785C", placeholder: "sk-ant-..." };
  if (key.startsWith("sk-") && key.length > 40) return { label: "GPT (OpenAI)", color: "#10A37F", placeholder: "sk-..." };
  if (key.startsWith("AIza"))          return { label: "Gemini (Google)", color: "#4285F4", placeholder: "AIza..." };
  if (key.startsWith("aws:"))          return { label: "Bedrock (AWS)", color: "#FF9900", placeholder: "aws:ACCESS_KEY:SECRET:REGION" };
  return { label: "APIキー未設定", color: "#bbb", placeholder: "sk-ant-... / sk-... / AIza... / aws:..." };
}

// ─── App Version（キャッシュ整合性チェック）───────────────────
const APP_VERSION = "2.1.0";
function checkAppVersion() {
  if (typeof window === "undefined") return;
  try {
    const saved = localStorage.getItem("tg_app_version");
    if (saved !== APP_VERSION) {
      // バージョン不一致 → 古いキャッシュデータをクリーンアップ
      localStorage.setItem("tg_app_version", APP_VERSION);
      // キャラクターデータのマイグレーションをトリガー
      const charStr = localStorage.getItem("tg_char");
      if (charStr) {
        try {
          const char = JSON.parse(charStr);
          if (char.id === "my_char") {
            // 旧IDを持つキャラを削除して再取得させる
            localStorage.removeItem("tg_char");
          }
        } catch { localStorage.removeItem("tg_char"); }
      }
    }
  } catch {}
}

// ─── Storage（防御的バージョン v2）─────────────────────────────
// データ構造バリデーション + 破損時自動クリア + save時のquota超過防御
function loadProfile(): ProfileEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("tg_profile");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) { localStorage.removeItem("tg_profile"); return []; }
    return parsed.filter((e: unknown) =>
      e && typeof e === "object" && "id" in e && "score" in e && "title" in e
    ) as ProfileEntry[];
  } catch { localStorage.removeItem("tg_profile"); return []; }
}
function saveProfileEntry(e: ProfileEntry) {
  try {
    const arr = loadProfile(); arr.unshift(e);
    localStorage.setItem("tg_profile", JSON.stringify(arr.slice(0, 100)));
  } catch { /* quota超過等 */ }
}
// キャラクターIDマイグレーション（旧 "my_char" → 正しいID）
const CHAR_NAME_TO_ID: Record<string, string> = {
  "ミオ": "mio", "ソラ": "sora", "ハル": "haru", "リン": "rin",
};
function migrateCharId(char: Character): Character {
  if (char.id === "my_char" || !["mio", "sora", "haru", "rin"].includes(char.id)) {
    const newId = CHAR_NAME_TO_ID[char.name] || "mio";
    return { ...char, id: newId };
  }
  return char;
}

function loadChar(): Character | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem("tg_char");
    if (!s) return null;
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.name || !parsed.emoji) {
      localStorage.removeItem("tg_char"); return null;
    }
    if (parsed.growth_stages && !Array.isArray(parsed.growth_stages)) parsed.growth_stages = [];
    // 旧IDマイグレーション
    const migrated = migrateCharId(parsed as Character);
    if (migrated.id !== parsed.id) {
      try { localStorage.setItem("tg_char", JSON.stringify(migrated)); } catch {}
    }
    return migrated;
  } catch { localStorage.removeItem("tg_char"); return null; }
}
function saveChar(c: Character) {
  try { localStorage.setItem("tg_char", JSON.stringify(c)); } catch {}
}
function loadGraph(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem("tg_graph");
    if (!s) return null;
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== "object") { localStorage.removeItem("tg_graph"); return null; }
    return parsed as Record<string, unknown>;
  } catch { localStorage.removeItem("tg_graph"); return null; }
}
function saveGraph(g: Record<string, unknown>) {
  try { localStorage.setItem("tg_graph", JSON.stringify(g)); } catch {}
}

// ─── Streak system ──────────────────────────────────────────────
interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastDate: string;      // YYYY-MM-DD
  totalDays: number;
}
function loadStreak(): StreakData {
  if (typeof window === "undefined") return { currentStreak: 0, longestStreak: 0, lastDate: "", totalDays: 0 };
  try {
    const s = localStorage.getItem("tg_streak");
    if (!s) return { currentStreak: 0, longestStreak: 0, lastDate: "", totalDays: 0 };
    return JSON.parse(s);
  } catch { return { currentStreak: 0, longestStreak: 0, lastDate: "", totalDays: 0 }; }
}
function updateStreak(): StreakData {
  const data = loadStreak();
  const today = new Date().toISOString().slice(0, 10);
  if (data.lastDate === today) return data; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = data.lastDate === yesterday ? data.currentStreak + 1 : 1;
  const updated: StreakData = {
    currentStreak: newStreak,
    longestStreak: Math.max(data.longestStreak, newStreak),
    lastDate: today,
    totalDays: data.totalDays + 1,
  };
  try { localStorage.setItem("tg_streak", JSON.stringify(updated)); } catch {}
  return updated;
}

// ─── Onboarding ──────────────────────────────────────────────────
function isOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("tg_onboarded") === "1";
}
function markOnboarded() {
  try { localStorage.setItem("tg_onboarded", "1"); } catch {}
}

// ─── Stage helpers ────────────────────────────────────────────
function stageLabel(char: Character, n: number): string {
  if (!char?.growth_stages?.length) return "";
  try {
    return [...char.growth_stages]
      .sort((a, b) => b.threshold - a.threshold)
      .find(s => n >= s.threshold)?.label ?? char.growth_stages[0]?.label ?? "";
  } catch { return ""; }
}
function stageIndex(char: Character, n: number): number {
  if (!char?.growth_stages?.length) return 0;
  try {
    const sorted = [...char.growth_stages].sort((a, b) => a.threshold - b.threshold);
    let idx = 0;
    sorted.forEach((s, i) => { if (n >= s.threshold) idx = i; });
    return idx;
  } catch { return 0; }
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
  const holdingRef = useRef(false);
  useEffect(() => {
    const SR = window.SpeechRecognition || (window as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    // continuous=true で押している間ずっと認識し続ける
    const r = new SR(); r.lang = "ja-JP"; r.continuous = true; r.interimResults = true;
    recRef.current = r;
  }, []);
  const start = useCallback((onInterim: (t: string) => void, onFinal: (t: string) => void) => {
    const r = recRef.current; if (!r) return;
    latest.current = "";
    holdingRef.current = true;
    let accumulated = "";
    r.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (final) { accumulated += final; latest.current = accumulated; }
      onInterim(accumulated + (interim ? interim : ""));
    };
    r.onend = () => {
      // ボタンを離した後のみfinalを呼ぶ
      if (!holdingRef.current) {
        onFinal(latest.current || accumulated);
      } else {
        // まだ押されている場合は再開（ブラウザが自動停止した場合の対策）
        try { r.start(); } catch { onFinal(latest.current || accumulated); }
      }
    };
    r.onerror = (ev) => {
      // "no-speech" や "aborted" は再開可能なエラー
      if (holdingRef.current && (ev.error === "no-speech" || ev.error === "aborted")) {
        try { r.start(); return; } catch { /* fall through */ }
      }
      if (!holdingRef.current) onFinal(latest.current || accumulated);
    };
    try { r.start(); } catch {}
  }, []);
  const stop = useCallback(() => {
    holdingRef.current = false;
    recRef.current?.stop();
  }, []);
  return { supported, start, stop };
}

// テキストを音声読み上げ用にクリーニング（全文読み上げ対応）
function cleanForSpeech(raw: string): string {
  return raw
    // JSONブロックを除去（採点結果などが混入しないよう）
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]{10,}\}/g, (m) => {
      if (/"[^"]+"\s*:/.test(m)) return "";
      return m;
    })
    // マークダウン記法を読み上げ用に変換
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[（）「」【】『』〔〕《》〈〉]/g, " ")
    .replace(/\n{2,}/g, "。")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // 全文を読み上げる（truncateしない）
}

function useSynth() {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() ?? []; };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  // 長文をチャンク分割して順番に読み上げる（Chromium 15秒制限対策）
  // charVoice: キャラクター別の音声設定（rate, pitch）
  const speak = useCallback((text: string, cb?: () => void, charVoice?: CharVoice) => {
    if (!window.speechSynthesis) { cb?.(); return; }
    window.speechSynthesis.cancel();
    cancelledRef.current = false;

    const cleaned = cleanForSpeech(text);
    if (!cleaned) { cb?.(); return; }

    const voice = charVoice || { rate: 1.05, pitch: 1.05 };

    // 句点・疑問符・感嘆符で分割して200文字以内のチャンクに
    const sentences = cleaned.split(/(?<=[。！？!?])\s*/g).filter(s => s.trim());
    const chunks: string[] = [];
    let buf = "";
    for (const s of sentences) {
      if (buf.length + s.length > 200 && buf) { chunks.push(buf); buf = s; }
      else buf += s;
    }
    if (buf) chunks.push(buf);
    if (!chunks.length) { cb?.(); return; }

    const voices = voicesRef.current;
    const jaGoogle = voices.find(v => v.lang.startsWith("ja") && v.name.includes("Google"));
    const jaAny = voices.find(v => v.lang.startsWith("ja"));

    let idx = 0;
    const speakNext = () => {
      if (cancelledRef.current || idx >= chunks.length) { cb?.(); return; }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      u.lang = "ja-JP"; u.rate = voice.rate; u.pitch = voice.pitch;
      if (jaGoogle) u.voice = jaGoogle;
      else if (jaAny) u.voice = jaAny;

      // Chromium workaround: keep alive during utterance (8秒間隔で確実に継続)
      const keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 8000);

      u.onend = () => { clearInterval(keepAlive); idx++; speakNext(); };
      u.onerror = () => { clearInterval(keepAlive); idx++; speakNext(); };
      window.speechSynthesis.speak(u);
    };
    speakNext();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    window.speechSynthesis?.cancel();
  }, []);
  return { speak, cancel };
}

// ─── UI Components ────────────────────────────────────────────
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

function Avatar({ char, size = 44, pulse, expression }: { char: Character; size?: number; pulse?: boolean; expression?: "happy" | "confused" | "thinking" | "neutral" }) {
  const expressionEmoji = expression === "happy" ? "\u2764\uFE0F" : expression === "confused" ? "\u2753" : expression === "thinking" ? "\uD83D\uDCA1" : null;
  // キャラクター別イラストSVGマップ
  const charIllustration: Record<string, { face: string; hair: string; accent: string }> = {
    mio:  { face: "#FFE0C2", hair: "#FF6B9D", accent: "#FF9EC6" },
    sora: { face: "#FFE0C2", hair: "#3A8BD2", accent: "#45B7D1" },
    haru: { face: "#FFE0C2", hair: "#2EAD9A", accent: "#4ECDC4" },
    rin:  { face: "#FFE0C2", hair: "#7B3FA0", accent: "#A855F7" },
  };
  const illust = charIllustration[char.id] || charIllustration.mio;
  const r = size / 2;
  const uid = `av_${char.id}_${size}`;
  return (
    <div className="avatar-breathe" style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={pulse ? "avatar-glow" : ""} style={{
        filter: pulse ? `drop-shadow(0 0 ${size * 0.15}px ${char.color}60)` : `drop-shadow(0 2px ${size * 0.08}px ${char.color}30)`,
        "--glow-color": `${char.color}40`,
      } as React.CSSProperties}>
        <defs>
          <radialGradient id={`${uid}_bg`} cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor={`${char.color}35`} />
            <stop offset="100%" stopColor={`${char.color}12`} />
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
            <stop offset="0%" stopColor={char.color} />
            <stop offset="50%" stopColor={illust.accent} />
            <stop offset="100%" stopColor={char.color} />
          </linearGradient>
        </defs>
        {/* 外側リング */}
        <circle cx={r} cy={r} r={r - 1} fill="none" stroke={`url(#${uid}_ring)`} strokeWidth={size * 0.04} opacity="0.7" />
        {/* 背景 */}
        <circle cx={r} cy={r} r={r - size * 0.06} fill={`url(#${uid}_bg)`} />
        {/* 顔 */}
        <circle cx={r} cy={r * 1.05} r={r * 0.42} fill={`url(#${uid}_face)`} />
        {/* 髪 */}
        <ellipse cx={r} cy={r * 0.72} rx={r * 0.48} ry={r * 0.38} fill={`url(#${uid}_hair)`} />
        {/* 目 */}
        <circle cx={r - r * 0.15} cy={r * 1.0} r={r * 0.06} fill="#333" />
        <circle cx={r + r * 0.15} cy={r * 1.0} r={r * 0.06} fill="#333" />
        {/* 目のハイライト */}
        <circle cx={r - r * 0.13} cy={r * 0.97} r={r * 0.025} fill="#fff" />
        <circle cx={r + r * 0.17} cy={r * 0.97} r={r * 0.025} fill="#fff" />
        {/* 口 */}
        {expression === "happy" ? (
          <path d={`M ${r - r * 0.12} ${r * 1.18} Q ${r} ${r * 1.32} ${r + r * 0.12} ${r * 1.18}`} fill="none" stroke="#E8846B" strokeWidth={r * 0.04} strokeLinecap="round" />
        ) : expression === "confused" ? (
          <circle cx={r} cy={r * 1.2} r={r * 0.06} fill="#E8846B" />
        ) : expression === "thinking" ? (
          <path d={`M ${r - r * 0.08} ${r * 1.2} L ${r + r * 0.08} ${r * 1.18}`} stroke="#E8846B" strokeWidth={r * 0.04} strokeLinecap="round" />
        ) : (
          <path d={`M ${r - r * 0.1} ${r * 1.18} Q ${r} ${r * 1.26} ${r + r * 0.1} ${r * 1.18}`} fill="none" stroke="#E8846B" strokeWidth={r * 0.035} strokeLinecap="round" />
        )}
        {/* ほっぺた */}
        <circle cx={r - r * 0.32} cy={r * 1.12} r={r * 0.08} fill={`${char.color}25`} />
        <circle cx={r + r * 0.32} cy={r * 1.12} r={r * 0.08} fill={`${char.color}25`} />
        {/* キャラ固有装飾 */}
        {char.id === "rin" && (
          <rect x={r - r * 0.03} y={r * 0.52} width={r * 0.06} height={r * 0.22} rx={r * 0.03} fill={illust.accent} opacity="0.6" />
        )}
      </svg>
      {expressionEmoji && (
        <span className="expression-bubble">{expressionEmoji}</span>
      )}
    </div>
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
        <div style={{ marginBottom: "0.4rem", display: "flex", justifyContent: "center" }}><Avatar char={char} size={72} expression="happy" pulse /></div>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: char.color, fontWeight: 800, marginBottom: "0.4rem" }}>STAGE UP</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: "0.5rem" }}>{newStage}</div>
        <div style={{ fontSize: 13, color: "#777" }}>{char.custom_name || char.name}との絆が深まった</div>
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

// ─── Radar Chart (SVG) for SOLO Taxonomy v3 ─────────────────
function RadarChart({ axes, size = 220 }: {
  axes: { label: string; value: number; max: number; color: string }[];
  size?: number;
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 30;
  const n = axes.length;
  const angleStep = (2 * Math.PI) / n;
  const levels = [0.25, 0.5, 0.75, 1.0];

  // Generate polygon points for a given set of normalized values
  const polyPoints = (values: number[]) =>
    values.map((v, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const x = cx + r * v * Math.cos(angle);
      const y = cy + r * v * Math.sin(angle);
      return `${x},${y}`;
    }).join(" ");

  const normalized = axes.map(a => Math.min(a.value / a.max, 1));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      {/* Grid rings */}
      {levels.map(lev => (
        <polygon key={lev}
          points={Array.from({ length: n }, (_, i) => {
            const angle = -Math.PI / 2 + i * angleStep;
            return `${cx + r * lev * Math.cos(angle)},${cy + r * lev * Math.sin(angle)}`;
          }).join(" ")}
          fill="none" stroke="#e8e8e8" strokeWidth={1}
        />
      ))}
      {/* Axis lines */}
      {axes.map((_, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        return (
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
            stroke="#e8e8e8" strokeWidth={1}
          />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={polyPoints(normalized)}
        fill="rgba(255,107,157,0.15)" stroke="#FF6B9D" strokeWidth={2}
        style={{ transition: "all 0.8s ease" }}
      />
      {/* Data points */}
      {normalized.map((v, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const x = cx + r * v * Math.cos(angle);
        const y = cy + r * v * Math.sin(angle);
        return (
          <circle key={i} cx={x} cy={y} r={4}
            fill={axes[i].color} stroke="#fff" strokeWidth={2}
            style={{ transition: "all 0.8s ease" }}
          />
        );
      })}
      {/* Labels */}
      {axes.map((a, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const lx = cx + (r + 22) * Math.cos(angle);
        const ly = cy + (r + 22) * Math.sin(angle);
        return (
          <g key={i}>
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 10, fontWeight: 700, fill: "#555", fontFamily: "Outfit, sans-serif" }}>
              {a.label}
            </text>
            <text x={lx} y={ly + 13} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 9, fontWeight: 600, fill: a.color, fontFamily: "Outfit, sans-serif" }}>
              {a.value.toFixed(1)}/{a.max}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Mastery Bar (horizontal) ─────────────────────────────────
function MasteryBar({ label, value, maxValue, color, icon }: {
  label: string; value: number; maxValue: number; color: string; icon: string;
}) {
  const pct = Math.min((value / maxValue) * 100, 100);
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#333", fontWeight: 600 }}>{icon} {label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{value.toFixed(1)}<span style={{ fontSize: 10, color: "#bbb", fontWeight: 400 }}>/{maxValue}</span></span>
      </div>
      <div style={{ height: 10, background: "#f0f0f0", borderRadius: 5, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 5,
          background: `linear-gradient(90deg, ${color}90, ${color})`,
          transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: pct >= 70 ? `0 2px 8px ${color}40` : "none",
        }} />
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
      <div style={{ fontSize: 16, fontWeight: 600, color: "#444", marginBottom: "0.5rem" }}>まだ教えた履歴がありません</div>
      <div style={{ fontSize: 13 }}>「AIに教える」タブでセッションを行うとスキルマップが生成されます</div>
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
      <div style={{ fontSize: 13, color: "#FF6B9D", background: "#fff5f5", padding: "0.75rem", borderRadius: 10, marginBottom: "1rem" }}>{skillError}</div>
      <button className="btn-primary" onClick={onLoad} style={{ maxWidth: 200, margin: "0 auto", display: "flex" }}>再試行</button>
    </div>
  );
  if (!skillMap) return null;

  const charName = skillMap.char_name ?? "キャラクター";
  const charEmoji = skillMap.char_emoji ?? "🤖";
  const lc = (l: string) =>
    l === "熟達" ? "#FF6B9D" : l === "一人前" ? "#4ECDC4" : l === "成長中" ? "#45B7D1" : "#96CEB4";
  const levelBg = (l: string) =>
    l === "熟達" ? "#fff5f5" : l === "一人前" ? "#f0fffe" : l === "成長中" ? "#f0f8ff" : "#f5fff5";

  // Compute SOLO Taxonomy v3 averages from profile + categories
  const soloAxes = [
    { label: "網羅性", color: "#FF6B9D", icon: "📋" },
    { label: "深さ", color: "#45B7D1", icon: "🔬" },
    { label: "明晰さ", color: "#4ECDC4", icon: "💎" },
    { label: "論理構造", color: "#8E44AD", icon: "🏗️" },
    { label: "教育的洞察", color: "#E67E22", icon: "💡" },
  ];

  const cats = skillMap.categories || [];
  const globalAvg = skillMap.avg_score || 0;

  // 実際のv3 SOLOスコアが保存されていればそれを使用、なければカテゴリ平均から推定
  const v3Entries = profile.filter(p => p.solo_v3);
  const soloValues = (() => {
    if (v3Entries.length > 0) {
      // 実データがある: 全v3セッションの平均を計算
      const keys: (keyof NonNullable<ProfileEntry["solo_v3"]>)[] = ["completeness", "depth", "clarity", "structural_coherence", "pedagogical_insight"];
      return keys.map(key => {
        const sum = v3Entries.reduce((acc, e) => acc + (e.solo_v3?.[key] ?? 0), 0);
        return Math.max(0.5, Math.min(5, sum / v3Entries.length));
      });
    }
    // フォールバック: カテゴリ平均から推定
    const base = globalAvg / 20;
    return soloAxes.map((_, i) => {
      const catAvgs = cats.map(c => c.avg_score);
      const variance = catAvgs.length > i
        ? ((catAvgs[i % catAvgs.length] - globalAvg) / 100) * 2
        : (i === 0 ? 0.2 : i === 1 ? -0.1 : i === 2 ? 0.15 : i === 3 ? -0.2 : 0.3) * (base / 5);
      return Math.max(0.5, Math.min(5, base + variance));
    });
  })();

  const radarAxes = soloAxes.map((a, i) => ({
    label: a.label,
    value: soloValues[i],
    max: 5,
    color: a.color,
  }));

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

      {/* SOLO Taxonomy v3 レーダーチャート + マスタリーバー */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#222", marginBottom: "0.5rem" }}>📊 SOLO Taxonomy v3 評価</div>
        <div style={{ fontSize: 11, color: "#bbb", marginBottom: "1rem" }}>5つの軸であなたの「教える力」を可視化</div>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          {/* Radar Chart */}
          <div style={{ flexShrink: 0 }}>
            <RadarChart axes={radarAxes} size={220} />
          </div>
          {/* Mastery Bars */}
          <div style={{ flex: 1, minWidth: 200 }}>
            {soloAxes.map((a, i) => (
              <MasteryBar
                key={a.label}
                label={a.label}
                value={soloValues[i]}
                maxValue={5}
                color={a.color}
                icon={a.icon}
              />
            ))}
          </div>
        </div>
      </div>

      {/* スキルカテゴリ（ドメイン別マスタリー） */}
      {cats.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#222", marginBottom: "0.75rem" }}>🗺️ ドメイン別マスタリー</div>
          <div className="skills-grid">
            {cats.map(cat => (
              <div key={cat.name} className="card fade-in" style={{ margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                  <span style={{ fontSize: 22 }}>{cat.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{cat.name}</div>
                    <div style={{ fontSize: 11, color: "#bbb" }}>平均 {Math.round(cat.avg_score)}点</div>
                  </div>
                  <div style={{
                    marginLeft: "auto",
                    fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px",
                    color: cat.avg_score >= 80 ? "#4ECDC4" : cat.avg_score >= 60 ? "#45B7D1" : cat.avg_score >= 40 ? "#F5A623" : "#FF6B9D",
                    background: cat.avg_score >= 80 ? "#4ECDC410" : cat.avg_score >= 60 ? "#45B7D110" : cat.avg_score >= 40 ? "#F5A62310" : "#FF6B9D10",
                  }}>
                    {cat.avg_score >= 80 ? "熟達" : cat.avg_score >= 60 ? "習得中" : cat.avg_score >= 40 ? "成長中" : "入門"}
                  </div>
                </div>
                {(cat.skills || []).map(s => <SkillBar key={s.name} skill={s} color={cat.color} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 強み・弱み・次のステップ */}
      <div className="grid-2col" style={{ marginTop: "1rem" }}>
        <div className="card" style={{ borderColor: "#4ECDC430", background: "#f0fffe" }}>
          <div style={{ fontSize: 12, color: "#4ECDC4", fontWeight: 700, marginBottom: "0.6rem" }}>💪 {charName}の得意分野</div>
          {(skillMap.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: "#333", padding: "0.2rem 0" }}>✓ {s}</div>)}
        </div>
        <div className="card" style={{ borderColor: "#FFB84630", background: "#fffbf0" }}>
          <div style={{ fontSize: 12, color: "#FFB846", fontWeight: 700, marginBottom: "0.6rem" }}>🤔 まだ難しいこと</div>
          {((skillMap.weak_areas || skillMap.next_steps) || []).slice(0, 3).map((s, i) => <div key={i} style={{ fontSize: 13, color: "#333", padding: "0.2rem 0" }}>△ {s}</div>)}
        </div>
      </div>
      <div className="card" style={{ marginTop: "1rem", borderColor: "#FF6B9D30", background: "#fff8f8" }}>
        <div style={{ fontSize: 12, color: "#FF6B9D", fontWeight: 700, marginBottom: "0.6rem" }}>🎯 {charName}に教えてほしいこと</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {(skillMap.next_steps || []).map((s, i) => (
            <span key={i} style={{ fontSize: 12, background: "#fff", border: "1px solid #FF6B9D40", borderRadius: 20, padding: "0.25rem 0.75rem", color: "#555" }}>→ {s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Character Detail ─────────────────────────────────────────
function CharDetail({
  char, profile, apiKey, trialAvailable, evolving, onBack, accentColor, onEditChar,
}: {
  char: Character; profile: ProfileEntry[]; apiKey: string;
  trialAvailable?: boolean; evolving: boolean; onBack: () => void; accentColor?: string;
  onEditChar?: () => void;
}) {
  const n = profile.length;
  const next = nextThreshold(char, n);
  const cc = char.color;

  return (
    <div className="app" style={{ overflowY: "auto" }}>
      <div style={{
        position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #f0f0f0",
        padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", zIndex: 10,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, color: "#bbb", cursor: "pointer", lineHeight: 1 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#222" }}>{char.custom_name || char.name}のプロフィール</span>
        {evolving && <span style={{ fontSize: 12, color: cc, marginLeft: "auto" }}>✨ 進化中...</span>}
      </div>

      <div style={{ padding: "1.25rem", maxWidth: 600, margin: "0 auto" }}>
        {/* キャラクターカード */}
        <div className="card" style={{ background: `${cc}08`, borderColor: `${cc}30`, marginBottom: "1rem", textAlign: "center" }}>
          <div style={{ marginBottom: "0.5rem", display: "flex", justifyContent: "center" }}>
            <Avatar char={char} size={96} expression="happy" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#222", marginBottom: "0.2rem" }}>{char.custom_name || char.name}</div>
          {char.custom_name && <div style={{ fontSize: 11, color: "#bbb", marginBottom: "0.2rem" }}>（{char.name}）</div>}
          <div style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem", lineHeight: 1.6 }}>{char.custom_personality || char.personality}</div>
          {onEditChar && (
            <button onClick={onEditChar} style={{
              padding: "0.4rem 1rem", borderRadius: 20, border: `1.5px solid ${cc}30`,
              background: `${cc}08`, color: cc, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", marginBottom: "0.75rem",
            }}>✏️ カスタマイズ</button>
          )}

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
          <div style={{ fontSize: 12, color: cc, fontWeight: 700, marginBottom: "0.75rem" }}>💬 {char.custom_name || char.name}の話し方</div>
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
                  {(char.interests || []).map((t, i) => (
                    <span key={i} style={{ fontSize: 12, background: `${cc}15`, color: cc, borderRadius: 20, padding: "0.2rem 0.7rem" }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {(char.knowledge_areas || []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "#4ECDC4", fontWeight: 700, marginBottom: "0.4rem" }}>🧠 習得した知識エリア</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {(char.knowledge_areas || []).map((t, i) => (
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
            <div style={{ fontSize: 12, color: "#888", fontWeight: 700, marginBottom: "0.6rem" }}>📖 {char.custom_name || char.name}の成長記録</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {[...(char.evolution_log || [])].reverse().map((log, i) => (
                <div key={i} style={{ fontSize: 12, color: "#555", padding: "0.3rem 0", borderBottom: i < ((char.evolution_log || []).length - 1) ? "1px solid #f5f5f5" : "none", lineHeight: 1.5 }}>
                  <span style={{ color: "#ddd", marginRight: "0.4rem" }}>●</span>{log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 成長タイムライン */}
        {profile.length > 0 && (
          <CharacterGrowthTimeline
            char={char}
            profile={profile}
            accentColor={accentColor || cc}
          />
        )}

        {!apiKey && !trialAvailable && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#bbb", padding: "0.75rem", background: "#fafafa", borderRadius: 12 }}>
            APIキーを設定するとセッション後に{char.custom_name || char.name}が進化します
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [streak, setStreak] = useState<StreakData>({ currentStreak: 0, longestStreak: 0, lastDate: "", totalDays: 0 });
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [historyPopup, setHistoryPopup] = useState<ProfileEntry | null>(null);
  const [showCharEdit, setShowCharEdit] = useState(false);
  const [showCharCreation, setShowCharCreation] = useState(false);
  const [charCreationStep, setCharCreationStep] = useState(0);
  const [charCreationPreset, setCharCreationPreset] = useState<string>("mio");
  const [charCreationCustomName, setCharCreationCustomName] = useState("");
  const [charCreationCustomPersonality, setCharCreationCustomPersonality] = useState("");
  const [charCreationEmoji, setCharCreationEmoji] = useState("");
  const [charEditName, setCharEditName] = useState("");
  const [charEditPersonality, setCharEditPersonality] = useState("");
  const [charEditRate, setCharEditRate] = useState(1.05);
  const [charEditPitch, setCharEditPitch] = useState(1.05);

  // APIキーが使えるか（ユーザーキーまたはサーバーサイドキー）
  const canUseApi = !!(apiKey || trialAvailable);

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
  const [activeInputTab, setActiveInputTab] = useState<"text" | "url" | "file">("text");

  const [skillMap, setSkillMap] = useState<SkillMap | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState("");
  const [_proactive, setProactive] = useState<{
    message: string;
    suggestions: { topic: string; reason: string; emoji: string }[];
    mood: string;
  } | null>(null);
  const [_knowledgeGraph, setKnowledgeGraph] = useState<Record<string, unknown> | null>(null);

  // セッション状態
  const [leadingPenalty, setLeadingPenalty] = useState(0);
  const [gaveUpCount, setGaveUpCount] = useState(0);
  const [consecutiveFail, setConsecutiveFail] = useState(0);
  const [showQuit, setShowQuit] = useState(false);
  const [quitMsg, setQuitMsg] = useState("");

  // v3 状態
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rqsHistory, setRqsHistory] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stateHistory, setStateHistory] = useState<any[]>([]);
  const [currentState, setCurrentState] = useState("ORIENT");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kbSignals, setKbSignals] = useState<any[]>([]);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rqsRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateHistRef = useRef<any[]>([]);
  const curStateRef = useRef("ORIENT");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kbRef = useRef<any[]>([]);
  turnsRef.current = turns;
  topicRef.current = topic;
  leadingRef.current = leadingPenalty;
  gaveUpRef.current = gaveUpCount;
  cfRef.current = consecutiveFail;
  charRef.current = char;
  rqsRef.current = rqsHistory;
  stateHistRef.current = stateHistory;
  curStateRef.current = currentState;
  kbRef.current = kbSignals;

  const cc = char?.color || "#FF6B9D";
  const cn = char?.custom_name || char?.name || "AI";
  const userTurns = turns.filter(t => t.role === "user").length;

  // ── Supabase同期関数（アカウントベースのデータ管理）──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function syncFromSupabase(_user: any) {
    try {
      const res = await fetch("/api/user/sync");
      const data = await res.json();
      // キャラクター同期（Supabase優先、なければlocalStorage、なければキャラ作成促進）
      if (data.character) {
        const migrated = migrateCharId(data.character);
        setChar(migrated);
        saveChar(migrated);
      } else if (!loadChar()) {
        // キャラクターが未設定 → 新規ユーザー向けキャラクター作成フロー
        setShowCharCreation(true);
      }
      // プロフィール同期（Supabaseのセッション履歴を使用）
      if (data.profile && data.profile.length > 0) {
        setProfile(data.profile);
        try { localStorage.setItem("tg_profile", JSON.stringify(data.profile.slice(0, 100))); } catch {}
      }
      // ストリーク同期
      if (data.streak) {
        setStreak(data.streak);
        try { localStorage.setItem("tg_streak", JSON.stringify(data.streak)); } catch {}
      }
    } catch (e) { console.warn("[teachAI] Supabase sync failed, using local data:", e); }
  }

  async function syncCharToSupabase(charData: Character) {
    try {
      const res = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: charData }),
      });
      if (!res.ok) console.warn("[teachAI] Character sync response:", res.status);
    } catch (e) { console.warn("[teachAI] Character sync failed:", e); }
  }

  // ── ログアウト処理（デモ画面に完全復帰）────────────────────────
  function handleLogout() {
    // ユーザー固有データをクリア（デモ用のデフォルト状態に戻す）
    try {
      localStorage.removeItem("tg_char");
      localStorage.removeItem("tg_profile");
      localStorage.removeItem("tg_graph");
      localStorage.removeItem("tg_apikey");
      localStorage.removeItem("tg_streak");
      localStorage.removeItem("tg_app_version");
    } catch {}
    window.location.href = "/api/auth/logout";
  }

  // ── Init（Supabase同期 + キャッシュ防止 + キャラクターオンボーディング）──
  useEffect(() => {
    // アプリバージョンチェック（古いキャッシュデータのクリーンアップ）
    checkAppVersion();

    try {
      const k = localStorage.getItem("tg_apikey") || "";
      setApiKey(k); setApiInput(k);
    } catch { /* localStorage アクセス失敗 */ }

    try { setProfile(loadProfile()); } catch { setProfile([]); }

    try {
      const saved = loadChar();
      const savedGraph = loadGraph();
      if (savedGraph) setKnowledgeGraph(savedGraph);
      if (saved) {
        setChar(saved);
      } else {
        fetch("/api/character")
          .then(r => r.json())
          .then(d => { if (d.character) { setChar(d.character); saveChar(d.character); } })
          .catch(() => {});
      }
    } catch {
      fetch("/api/character")
        .then(r => r.json())
        .then(d => { if (d.character) { setChar(d.character); saveChar(d.character); } })
        .catch(() => {});
    }

    // 認証ユーザー確認 + Supabaseデータ同期
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setAuthUser({ email: user.email || "", name: user.user_metadata?.full_name || user.email || "" });
          // Supabaseからキャラクター・プロフィール同期
          syncFromSupabase(user);
        }
      }).catch(() => {});
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setAuthUser({ email: session.user.email || "", name: session.user.user_metadata?.full_name || session.user.email || "" });
        } else {
          setAuthUser(null);
        }
      });
      subscription = data.subscription;
    } catch { /* Supabase初期化失敗時はログインなしで動作 */ }

    // Streak & Onboarding
    try { setStreak(loadStreak()); } catch {}
    if (!isOnboarded()) setShowOnboarding(true);

    // Trial key check + proactive fetch when trial available
    fetch("/api/trial").then(r => r.json()).then(d => {
      if (d.available) {
        setTrialAvailable(true);
        try {
          const p = loadProfile();
          const c = loadChar();
          if (c && p.length > 0 && !localStorage.getItem("tg_apikey")) {
            fetchProactive(p, c);
          }
        } catch { /* ignore */ }
      }
    }).catch(() => {});

    // プロアクティブ提案の取得（ユーザーAPIキーがある場合）
    try {
      const p = loadProfile();
      const c = loadChar();
      const k = localStorage.getItem("tg_apikey") || "";
      if (k && c && p.length > 0) {
        fetchProactive(p, c);
      }
    } catch { /* ignore */ }

    // ?topic= パラメータからトピックを復元
    try {
      const params = new URLSearchParams(window.location.search);
      const topicParam = params.get("topic");
      if (topicParam) {
        setInputText(topicParam);
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch { /* ignore */ }

    return () => { subscription?.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interim]);

  // ── キャラ進化（セッション完了後に呼ぶ）────────────────────
  async function evolveChar(sessionResult: SessionResult, topicData: TopicData) {
    if (!canUseApi || !charRef.current) return;
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
      if (d.character) { setChar(d.character); saveChar(d.character); syncCharToSupabase(d.character); }
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
    if (!canUseApi || !c || p.length === 0) return;
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
          // v3 parameters
          rqsHistory: rqsRef.current,
          stateHistory: stateHistRef.current,
          currentState: curStateRef.current,
          kbSignals: kbRef.current,
        }),
      });

      const data = await res.json();

      if (data.error) {
        console.error("teach API error:", data.error);
        const isKeyError = typeof data.error === "string" && (
          data.error.includes("APIキー") || data.error.includes("api_key") || data.error.includes("API key") || data.error.includes("authentication")
        );
        const fb = isKeyError
          ? "APIキーが無効か期限切れのようです。設定画面でAPIキーをご確認ください。"
          : `申し訳ありません、エラーが発生しました。（${typeof data.error === "string" ? data.error : "不明なエラー"}）`;
        setTurns(prev => [...prev, { role: "ai", text: fb }]);
        setVoiceState("speaking");
        synth.speak(isKeyError ? "APIキーをご確認ください。" : "エラーが発生しました。", () => setVoiceState("idle"), getCharVoice(charRef.current));
        return;
      }

      if (data.type === "quit") {
        setTurns(prev => [...prev, { role: "ai", text: data.message }]);
        setQuitMsg(data.message); setShowQuit(true);
        setVoiceState("speaking");
        synth.speak(data.message, () => setVoiceState("idle"), getCharVoice(charRef.current));
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

      // v3: RQS・状態遷移・KB更新（通常ターンでも返る）
      if (data.rqs) {
        setRqsHistory(prev => [...prev, data.rqs]);
        rqsRef.current = [...rqsRef.current, data.rqs];
      }
      if (data.next_state) {
        const transition = { turn: turns.filter(t => t.role === "user").length + 1, from_state: curStateRef.current, to_state: data.next_state, rqs: data.rqs?.score ?? 0, reason: data.state_reason || "" };
        setStateHistory(prev => [...prev, transition]);
        stateHistRef.current = [...stateHistRef.current, transition];
        setCurrentState(data.next_state);
        curStateRef.current = data.next_state;
      }
      if (data.kb) {
        const kbEntry = { turn: turns.filter(t => t.role === "user").length + 1, ...data.kb };
        setKbSignals(prev => [...prev, kbEntry]);
        kbRef.current = [...kbRef.current, kbEntry];
      }

      // 演出
      const praiseKw = ["なるほど", "わかった", "正確", "天才", "すごい", "最高", "完璧", "悪くない", "さすが", "正しい", "そういうこと", "評価"];
      if (praiseKw.some(k => aiText.includes(k))) setReaction({ type: "praise", key: Date.now() });
      else if (isFail) setReaction({ type: "confused", key: Date.now() });

      if (data.type === "complete") {
        const score = data.score || { coverage: 50, depth: 50, clarity: 50, total: 50 };
        const sessionResult: SessionResult = {
          score,
          raw_score: data.raw_score || score,
          feedback: data.feedback || "",
          mastered: Array.isArray(data.mastered) ? data.mastered : [],
          gaps: Array.isArray(data.gaps) ? data.gaps : [],
          message: aiText,
          leading_penalty: data.leading_penalty || 0,
          gave_up_penalty: data.gave_up_penalty || 0,
          grade: data.grade,
          insight: data.insight || (data.score_v3?.insight),
          score_breakdown: data.score_breakdown,
          improvement_suggestions: Array.isArray(data.improvement_suggestions) ? data.improvement_suggestions : [],
          // v3
          score_v3: data.score_v3 || undefined,
          scoring_version: data.scoring_version,
          kb_mode: data.kb_mode,
        };
        setResult(sessionResult);

        const entry: ProfileEntry = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString("ja-JP"),
          title: td.title, mode: td.mode,
          score: score.total,
          mastered: Array.isArray(data.mastered) ? data.mastered : [],
          gaps: Array.isArray(data.gaps) ? data.gaps : [],
          solo_v3: data.score_v3?.raw || undefined,
        };
        saveProfileEntry(entry);
        const newProfile = loadProfile();
        setProfile(newProfile);

        // ストリーク更新
        setStreak(updateStreak());

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
        evolveChar(sessionResult, td);

        // v3: Elo Rating 更新（バックグラウンド）
        if (data.score_v3) {
          fetch("/api/elo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: td.title,
              scores: data.score_v3.raw,
            }),
          }).catch(() => {});
        }

        // Supabase: セッション保存（認証ユーザーのみ、バックグラウンド）
        if (isSupabaseConfigured()) {
          try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const v3r = data.score_v3?.raw;
              await supabase.from("sessions").insert({
                user_id: user.id,
                topic: td.title,
                mode: td.mode,
                status: "completed",
                score_total: score.total,
                grade: data.grade || null,
                key_concepts: Array.isArray(data.mastered) ? data.mastered : [],
                score_knowledge_fidelity: data.score_breakdown?.coverage ?? (v3r ? convertV3toV2(v3r.completeness) : null),
                score_structural_integrity: data.score_breakdown?.structural_coherence ?? (v3r ? convertV3toV2(v3r.structural_coherence) : null),
                score_hypothesis_generation: data.score_breakdown?.spontaneity ?? (v3r ? convertV3toV2(v3r.pedagogical_insight) : null),
                score_thinking_depth: data.score_breakdown?.depth ?? (v3r ? convertV3toV2(v3r.depth) : null),
                messages: turnsRef.current,
              });
            }
          } catch { /* Supabase not available */ }
        }

        setVoiceState("speaking");
        synth.speak(aiText, () => {
          setVoiceState("idle");
          setTimeout(() => setScreen("result"), 800);
        }, getCharVoice(charRef.current));
        return;
      }

      setVoiceState("speaking");
      synth.speak(aiText, () => setVoiceState("idle"), getCharVoice(charRef.current));

    } catch (err) {
      console.error("teach session error:", err);
      const msg = err instanceof Error ? err.message : "";
      const isNetworkError = msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch");
      const fb = isNetworkError
        ? "通信エラーが発生しました。ネットワーク接続を確認してもう一度送信してください。"
        : `エラーが発生しました。（${msg || "不明なエラー"}）`;
      setTurns(prev => [...prev, { role: "ai", text: fb }]);
      setVoiceState("speaking");
      synth.speak("エラーが発生しました。", () => setVoiceState("idle"), getCharVoice(charRef.current));
    }
  }, [apiKey, synth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── テキスト分割ユーティリティ ────────────────────────────────
  const [splitParts, setSplitParts] = useState<string[]>([]);
  const [splitIndex, setSplitIndex] = useState(0);
  const [showSplitModal, setShowSplitModal] = useState(false);

  function splitTextIntoChunks(text: string, chunkSize = AUTO_SPLIT_THRESHOLD): string[] {
    if (text.length <= chunkSize) return [text];
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let current = "";
    for (const para of paragraphs) {
      if (current.length + para.length > chunkSize && current) {
        chunks.push(current.trim());
        current = para;
      } else {
        current += (current ? "\n\n" : "") + para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)];
  }

  // ── Ingest ───────────────────────────────────────────────────
  async function handleStart() {
    if (!apiKey && !trialAvailable) { setShowApiModal(true); return; }
    if (!inputUrl.trim() && !inputText.trim() && !fileContent && !fileData) {
      setError("URLかテキストを入力してください"); return;
    }
    // テキストのみの場合、最小文字数チェック
    if (!inputUrl.trim() && !fileData && !fileContent) {
      const textLen = inputText.trim().length;
      if (textLen > 0 && textLen < 20) {
        setError("もう少し詳しく入力してください（20文字以上）。短いキーワードの場合はURLで教材を指定するか、詳しい説明文を入力してください。");
        return;
      }
    }

    // 長文テキストの場合は分割を提案
    const textToSend = fileContent || inputText.trim();
    if (!inputUrl.trim() && !fileData && textToSend.length > AUTO_SPLIT_THRESHOLD) {
      const parts = splitTextIntoChunks(textToSend);
      if (parts.length > 1) {
        setSplitParts(parts);
        setSplitIndex(0);
        setShowSplitModal(true);
        return;
      }
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
      // v3 state reset
      setRqsHistory([]); rqsRef.current = [];
      setStateHistory([]); stateHistRef.current = [];
      setCurrentState("ORIENT"); curStateRef.current = "ORIENT";
      setKbSignals([]); kbRef.current = [];
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
        synth.speak(introText, () => setVoiceState("idle"), getCharVoice(charRef.current));
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
    if (!p.length) { setSkillError("教えた履歴がありません"); return; }
    if (!canUseApi) { setShowApiModal(true); return; }
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
    const userTurnCount = turnsRef.current.filter(t => t.role === "user").length;
    if (userTurnCount < 1) {
      // ユーザーがまだ1回も発言していない場合は終了不可
      return;
    }
    const history = turnsRef.current.slice(1);
    const lastUserText = [...turnsRef.current].reverse().find(t => t.role === "user")?.text || "以上です";
    doAiTurn(topicRef.current, history, lastUserText, {
      lp: leadingRef.current, gu: gaveUpRef.current, cf: cfRef.current, forceFinish: true,
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    // ファイルサイズ制限: 10MB
    if (f.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください"); return;
    }
    const name = f.name.toLowerCase();
    const isTxt = f.type.includes("text") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv");
    if (isTxt) {
      const t = await f.text(); setFileContent(t.slice(0, FILE_TEXT_LIMIT)); setFileData(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1];
        // MIMEタイプを正確に設定（画像対応）
        let mimeType = f.type;
        if (!mimeType || mimeType === "application/octet-stream") {
          if (name.endsWith(".pdf")) mimeType = "application/pdf";
          else if (name.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          else if (name.endsWith(".xlsx")) mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          else if (name.endsWith(".pptx")) mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mimeType = "image/jpeg";
          else if (name.endsWith(".png")) mimeType = "image/png";
          else if (name.endsWith(".gif")) mimeType = "image/gif";
          else if (name.endsWith(".webp")) mimeType = "image/webp";
          else mimeType = "application/octet-stream";
        }
        setFileData({ name: f.name, base64: b64, mimeType });
        setFileContent("");
      };
      reader.readAsDataURL(f);
    }
    setFileInfo({ name: f.name, size: f.size });
    setInputUrl(""); setInputText("");
    setActiveInputTab("file");
  }

  // ════════════════════════════════════════════════════════════
  //  CHARACTER DETAIL SCREEN
  // ════════════════════════════════════════════════════════════
  if (screen === "char_detail" && char) return (
    <>
      <CharDetail
        char={char} profile={profile} apiKey={apiKey}
        trialAvailable={trialAvailable}
        evolving={charEvolving}
        onBack={() => setScreen("home")}
        accentColor={cc}
        onEditChar={() => {
          setCharEditName(char.custom_name || char.name);
          setCharEditPersonality(char.custom_personality || char.personality);
          const v = getCharVoice(char);
          setCharEditRate(v.rate);
          setCharEditPitch(v.pitch);
          setShowCharEdit(true);
        }}
      />
      {/* キャラクターカスタマイズモーダル */}
      {showCharEdit && (
        <div className="overlay" onClick={() => setShowCharEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: "0.25rem" }}>
              {char.emoji} キャラクターカスタマイズ
            </div>
            <div style={{ fontSize: 12, color: "#bbb", marginBottom: "1rem" }}>
              名前や性格を変更できます（生徒としての関係性は維持されます）
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4, display: "block" }}>表示名</label>
              <input value={charEditName} onChange={e => setCharEditName(e.target.value)}
                placeholder={char.name} className="input-base" maxLength={20} />
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4, display: "block" }}>性格・口調メモ</label>
              <textarea value={charEditPersonality} onChange={e => setCharEditPersonality(e.target.value)}
                placeholder={char.personality} className="input-base" rows={3}
                style={{ resize: "vertical" }} maxLength={200} />
              <div style={{ fontSize: 10, color: "#ccc", textAlign: "right", marginTop: 2 }}>{charEditPersonality.length}/200</div>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4, display: "block" }}>読み上げ速度: {charEditRate.toFixed(2)}</label>
              <input type="range" min="0.5" max="1.5" step="0.05" value={charEditRate}
                onChange={e => setCharEditRate(parseFloat(e.target.value))}
                style={{ width: "100%" }} />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4, display: "block" }}>声の高さ: {charEditPitch.toFixed(2)}</label>
              <input type="range" min="0.5" max="1.5" step="0.05" value={charEditPitch}
                onChange={e => setCharEditPitch(parseFloat(e.target.value))}
                style={{ width: "100%" }} />
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" onClick={() => {
                const updated = {
                  ...char,
                  custom_name: charEditName.trim() !== char.name ? charEditName.trim() : undefined,
                  custom_personality: charEditPersonality.trim() !== char.personality ? charEditPersonality.trim() : undefined,
                  voice: { rate: charEditRate, pitch: charEditPitch },
                };
                setChar(updated);
                saveChar(updated);
                setShowCharEdit(false);
              }} style={{ flex: 1, marginTop: 0, background: cc }}>保存</button>
              <button className="btn-primary" onClick={() => {
                // リセット
                const updated = { ...char, custom_name: undefined, custom_personality: undefined, voice: undefined };
                setChar(updated);
                saveChar(updated);
                setShowCharEdit(false);
              }} style={{ flex: 0, marginTop: 0, background: "#f5f5f5", color: "#555", padding: "0.875rem 1rem" }}>リセット</button>
              <button className="btn-primary" onClick={() => setShowCharEdit(false)}
                style={{ flex: 0, marginTop: 0, background: "#f5f5f5", color: "#555", padding: "0.875rem 1rem" }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ════════════════════════════════════════════════════════════
  //  SESSION SCREEN
  // ════════════════════════════════════════════════════════════
  if (screen === "session" && topic) {
    const progress = Math.min((userTurns / 7) * 100, 100);
    const isDisabled = voiceState !== "idle";

    return (
      <div className="session-wrap app">


        {/* Stage-up */}
        {stageUp && <StageUpBanner char={stageUp.char} newStage={stageUp.newStage} onDone={() => setStageUp(null)} />}

        {/* キャラ感情バナー + floating particles */}
        {reaction && char && (
          <>
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
            {/* Floating particles: hearts/sparkles for praise, question marks for confused */}
            {(reaction.type === "praise"
              ? ["\u2764\uFE0F", "\u2728", "\uD83D\uDC96", "\u2728", "\u2764\uFE0F", "\uD83C\uDF1F"]
              : ["\u2753", "\uD83E\uDD14", "\u2753", "\uD83D\uDCA7", "\u2753", "\uD83E\uDD14"]
            ).map((emoji, i) => (
              <span key={`${reaction.key}-p${i}`} className="float-particle"
                style={{
                  left: `${25 + (i * 10)}%`,
                  top: `${35 + (i % 3) * 8}%`,
                  animationDelay: `${i * 0.15}s`,
                  fontSize: 18 + (i % 3) * 4,
                }}>
                {emoji}
              </span>
            ))}
          </>
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
                {char.emoji} {char.custom_name || char.name}
                <span style={{ opacity: 0.5 }}>·</span>
                {stageLabel(char, profile.length)}
                {leadingPenalty > 0 && (
                  <span style={{ color: "#FF6B9D", fontSize: 9, marginLeft: 4 }}>誘導 −{leadingPenalty}pt</span>
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
          {turns.map((t, i) => {
            // Determine expression for AI avatar based on message content
            const aiExpression: "happy" | "confused" | "thinking" | "neutral" = (() => {
              if (t.role !== "ai") return "neutral";
              const praiseKw = ["なるほど", "わかった", "正確", "天才", "すごい", "最高", "完璧", "さすが", "正しい"];
              const confusedKw = ["わからない", "わかりません", "もう少し", "理解できません"];
              if (praiseKw.some(k => t.text.includes(k))) return "happy";
              if (confusedKw.some(k => t.text.includes(k))) return "confused";
              return "neutral";
            })();
            const isLastAi = i === turns.length - 1 && t.role === "ai";
            return (
            <div key={i} className="fade-in" style={{
              display: "flex", flexDirection: t.role === "ai" ? "row" : "row-reverse",
              gap: "0.5rem", alignItems: "flex-end",
            }}>
              {t.role === "ai" && (
                char
                  ? <Avatar char={char} size={34} pulse={isLastAi && voiceState === "speaking"} expression={isLastAi ? aiExpression : undefined} />
                  : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
              )}
              <div className={`chat-bubble ${t.role}`}
                style={t.role === "user" ? { background: cc, boxShadow: `0 2px 10px ${cc}40` } : {}}>
                {t.text}
              </div>
            </div>
            );
          })}
          {voiceState === "processing" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
              {char ? <Avatar char={char} size={34} expression="thinking" /> : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div>}
              <div className="chat-bubble ai" style={{ padding: "0.65rem 0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {char && <span style={{ fontSize: 14 }}>{char.emoji}</span>}
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <span className="typing-dot" style={{ background: cc }} />
                  <span className="typing-dot" style={{ background: cc }} />
                  <span className="typing-dot" style={{ background: cc }} />
                </div>
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
              onChange={e => {
                setChatInput(e.target.value);
                // Auto-grow textarea
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
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
                <div style={{ marginBottom: "0.5rem", display: "flex", justifyContent: "center" }}>{char ? <Avatar char={char} size={56} expression="confused" /> : <span style={{ fontSize: 44 }}>😓</span>}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#222" }}>教材を読み直してみよう</div>
              </div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.75, marginBottom: "1.25rem", background: "#fafafa", padding: "0.75rem", borderRadius: 12 }}>{quitMsg}</div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn-primary" onClick={() => { setShowQuit(false); setScreen("home"); setTopic(null); }} style={{ flex: 1, marginTop: 0 }}>教材に戻る</button>
                <button className="btn-primary" onClick={() => {
                  setShowQuit(false);
                  setTurns([]); setLeadingPenalty(0); setGaveUpCount(0); setConsecutiveFail(0);
                  leadingRef.current = 0; gaveUpRef.current = 0; cfRef.current = 0;
                  setRqsHistory([]); rqsRef.current = []; setStateHistory([]); stateHistRef.current = [];
                  setCurrentState("ORIENT"); curStateRef.current = "ORIENT"; setKbSignals([]); kbRef.current = [];
                  setTimeout(() => {
                    const introText = charRef.current?.intro || topic.first_prompt || "";
                    setTurns([{ role: "ai", text: introText }]);
                    setVoiceState("speaking");
                    synth.speak(introText, () => setVoiceState("idle"), getCharVoice(charRef.current));
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
    const isV3 = !!result.score_v3;
    const total = result.score.total;
    const v3w = result.score_v3?.weighted ?? 0;
    const displayScore = isV3 ? v3w.toFixed(1) : String(total);
    const displayMax = isV3 ? "/ 5.0" : "/ 100";
    const grade = result.grade || result.score_v3?.grade;
    const topEmoji = isV3
      ? (v3w >= 4.2 ? "🎉" : v3w >= 3.4 ? "✨" : v3w >= 2.6 ? "💪" : "📚")
      : (total >= 85 ? "🎉" : total >= 70 ? "✨" : total >= 50 ? "💪" : "📚");
    const headline = isV3
      ? (v3w >= 4.2 ? "完璧に教えられた！" : v3w >= 3.4 ? "上手に教えられた！" : v3w >= 2.6 ? "もう少し深く教えてみよう！" : "もう一度確認してから教えよう")
      : (total >= 85 ? "完璧に教えられた！" : total >= 70 ? "上手に教えられた！" : total >= 50 ? "もう少し深く教えてみよう！" : "もう一度確認してから教えよう");
    const hasPenalty = !isV3 && (result.leading_penalty > 0 || result.gave_up_penalty > 0);
    const gradeColor = (g?: string) =>
      g === "S" ? "#FFD700" : g === "A" ? cc : g === "B" ? "#4ECDC4" : g === "C" ? "#F5A623" : g === "D" ? "#FF6B9D" : g === "F" ? "#999" : "#FF6B9D";

    return (
      <div className="app" style={{ overflowY: "auto" }}>

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
                  <span style={{ fontSize: 12, color: cc, fontWeight: 600 }}>{char.custom_name || char.name}に教えたセッション</span>
                </div>
              )}
              {isV3 && (
                <div style={{ marginTop: "0.4rem", fontSize: 10, color: "#aaa" }}>SOLO Taxonomy v3</div>
              )}
            </div>

            {/* Score */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              {isV3 && result.score_v3 ? (() => {
                const modeWeights = V3_WEIGHTS[topic.mode] ?? V3_WEIGHTS.concept;
                const dims: { key: V3Dimension; label: string; color: string }[] = [
                  { key: "completeness", label: "網羅性", color: "#FF6B9D" },
                  { key: "depth", label: "深さ", color: "#4ECDC4" },
                  { key: "clarity", label: "明晰さ", color: "#45B7D1" },
                  { key: "structural_coherence", label: "論理構造", color: "#8E44AD" },
                  { key: "pedagogical_insight", label: "教育的洞察", color: "#E67E22" },
                ];
                // 重み順にソート（重要な次元が上に来る）
                const sortedDims = [...dims].sort((a, b) => (modeWeights[b.key] ?? 0) - (modeWeights[a.key] ?? 0));
                return (
                  <>
                    {/* v3 Score Display */}
                    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                      <div style={{ fontSize: 52, fontWeight: 900, color: cc, lineHeight: 1 }}>{displayScore}</div>
                      <div style={{ fontSize: 13, color: "#bbb" }}>{displayMax}</div>
                      {grade && (
                        <div style={{
                          display: "inline-block", padding: "2px 14px", borderRadius: 20,
                          background: gradeColor(grade), color: grade === "S" ? "#000" : (grade === "F" ? "#fff" : "#fff"),
                          fontSize: 14, fontWeight: 800, marginTop: "0.4rem",
                        }}>Grade {grade}</div>
                      )}
                      {result.score_v3.conjunctive_pass === false && (
                        <div style={{ fontSize: 11, color: "#FF6B9D", marginTop: "0.3rem" }}>
                          ⚠️ 一部の次元が基準未満のため、グレードが制限されています
                        </div>
                      )}
                    </div>
                    {/* 5D Bars (重み順) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {sortedDims.map(({ key, label, color }) => {
                        const val = result.score_v3!.raw[key] ?? 0;
                        const weight = modeWeights[key] ?? 0;
                        return (
                          <div key={key}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                              <span style={{ fontSize: 12, color: "#555" }}>
                                {label}
                                <span style={{ fontSize: 10, color: "#bbb", marginLeft: "0.3rem" }}>×{(weight * 100).toFixed(0)}%</span>
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 800, color }}>{val} / 5</span>
                            </div>
                            <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ width: `${(val / 5) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* KB Mode & RQS & Insight */}
                    <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: "0.75rem", marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 80, background: "#fafafa", borderRadius: 10, padding: "0.5rem", textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: result.score_v3.kb_mode === "building" ? "#4ECDC4" : result.score_v3.kb_mode === "telling" ? "#F5A623" : "#45B7D1" }}>
                          {result.score_v3.kb_mode === "building" ? "📖 構築型" : result.score_v3.kb_mode === "telling" ? "📢 伝達型" : "🔄 混合型"}
                        </div>
                        <div style={{ fontSize: 10, color: "#bbb" }}>教え方スタイル</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 80, background: "#fafafa", borderRadius: 10, padding: "0.5rem", textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: result.score_v3.rqs_avg >= 0.6 ? "#4ECDC4" : result.score_v3.rqs_avg >= 0.3 ? "#F5A623" : "#FF6B9D" }}>
                          {(result.score_v3.rqs_avg * 100).toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 10, color: "#bbb" }}>応答品質 (RQS)</div>
                      </div>
                    </div>
                    {result.insight && (
                      <div style={{ marginTop: "0.5rem", background: `${cc}08`, borderRadius: 10, padding: "0.6rem 0.75rem" }}>
                        <span style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>💡 {result.insight}</span>
                      </div>
                    )}
                  </>
                );
              })() : (
                <>
                  {/* v2 Score Display (legacy) */}
                  <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    <div style={{ fontSize: 52, fontWeight: 900, color: cc, lineHeight: 1 }}>{total}</div>
                    {grade && (
                      <div style={{
                        display: "inline-block", padding: "2px 12px", borderRadius: 20,
                        background: gradeColor(grade), color: grade === "S" ? "#000" : "#fff",
                        fontSize: 13, fontWeight: 800, marginTop: "0.3rem",
                      }}>Grade {grade}</div>
                    )}
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: "0.2rem" }}>総合スコア / 100</div>
                  </div>
                  {/* 5D Bars (v2) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {[
                      { key: "coverage", label: "網羅性", color: "#FF6B9D" },
                      { key: "depth", label: "深さ", color: "#4ECDC4" },
                      { key: "clarity", label: "明瞭さ", color: "#45B7D1" },
                      ...(result.score_breakdown ? [
                        { key: "structural_coherence", label: "論理構造", color: "#8E44AD" },
                        { key: "spontaneity", label: "自発性", color: "#E67E22" },
                      ] : []),
                    ].map(({ key, label, color }) => {
                      const scoreAny = result.score as unknown as Record<string, number>;
                      const breakdownAny = result.score_breakdown as unknown as Record<string, number> | undefined;
                      const val = key === "coverage" || key === "depth" || key === "clarity"
                        ? scoreAny[key] ?? 0
                        : breakdownAny?.[key] ?? 0;
                      return (
                        <div key={key}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                            <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color }}>{val}</span>
                          </div>
                          <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, val))}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {result.insight && (
                    <div style={{ marginTop: "0.75rem", borderTop: "1px solid #f5f5f5", paddingTop: "0.75rem" }}>
                      <div style={{ background: `${cc}08`, borderRadius: 10, padding: "0.6rem 0.75rem" }}>
                        <span style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>💡 {result.insight}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Penalty (v2 only) */}
            {hasPenalty && (
              <div className="card" style={{ marginBottom: "1rem", background: "#fff8f8", borderColor: "#FF6B9D30" }}>
                <div style={{ fontSize: 11, color: "#FF6B9D", fontWeight: 700, marginBottom: "0.5rem" }}>⚠️ スコア補正</div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: "0.3rem" }}>補正前スコア: {result.raw_score.total}点</div>
                {result.leading_penalty > 0 && <div style={{ fontSize: 12, color: "#FF6B9D" }}>誘導質問ペナルティ: −{result.leading_penalty}pt</div>}
                {result.gave_up_penalty > 0 && <div style={{ fontSize: 12, color: "#FF6B9D", marginTop: "0.2rem" }}>未解答ペナルティ: −{result.gave_up_penalty}pt</div>}
              </div>
            )}

            {/* Feedback */}
            <div className="card" style={{ marginBottom: "1rem", background: `${cc}06`, borderColor: `${cc}25` }}>
              <div style={{ fontSize: 11, color: cc, fontWeight: 700, marginBottom: "0.4rem" }}>
                {char ? `${char.emoji} ${char.custom_name || char.name}からのフィードバック` : "フィードバック"}
              </div>
              <div style={{ fontSize: 14, color: "#444", lineHeight: 1.75 }}>{result.feedback}</div>
            </div>

            {/* Improvement Suggestions */}
            {result.improvement_suggestions && result.improvement_suggestions.length > 0 && (
              <div className="card" style={{ marginBottom: "1rem", background: "#FFFBEB", borderColor: "#FDE68A" }}>
                <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, marginBottom: "0.5rem" }}>
                  💡 改善のポイント
                </div>
                {result.improvement_suggestions.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#555", lineHeight: 1.7, padding: "0.2rem 0", display: "flex", gap: "0.4rem" }}>
                    <span style={{ color: "#D97706", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Mastered / Gaps */}
            <div className="grid-2col" style={{ marginBottom: "1rem" }}>
              <div className="card">
                <div style={{ fontSize: 11, color: "#4ECDC4", fontWeight: 700, marginBottom: "0.4rem" }}>✓ 理解できた</div>
                {result.mastered.length ? result.mastered.map(c => (
                  <div key={c} style={{ fontSize: 12, color: "#333", padding: "0.15rem 0", borderBottom: "1px solid #f8f8f8" }}>· {c}</div>
                )) : <div style={{ fontSize: 12, color: "#ccc" }}>—</div>}
              </div>
              <div className="card">
                <div style={{ fontSize: 11, color: "#FF6B9D", fontWeight: 700, marginBottom: "0.4rem" }}>△ 要復習</div>
                {result.gaps.length ? result.gaps.map(c => (
                  <div key={c} style={{ fontSize: 12, color: "#333", padding: "0.15rem 0", borderBottom: "1px solid #f8f8f8" }}>· {c}</div>
                )) : <div style={{ fontSize: 12, color: "#ccc" }}>—</div>}
              </div>
            </div>

            {/* キャラクター性格ベースの学び直しフィードバック */}
            {char && result.gaps.length > 0 && (
              <div className="card fade-in" style={{ marginBottom: "1.25rem", background: `${cc}06`, borderColor: `${cc}25`, border: `1.5px solid ${cc}25` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <Avatar char={char} size={32} expression="confused" />
                  <div style={{ fontSize: 13, fontWeight: 800, color: cc }}>{char.custom_name || char.name}からのアドバイス</div>
                </div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.75, marginBottom: "0.75rem" }}>
                  {char.struggle} {result.gaps.length === 1
                    ? `「${result.gaps[0]}」についてもう一度一緒に考えてみよう！`
                    : `「${result.gaps.slice(0, 2).join("」と「")}」${result.gaps.length > 2 ? "など" : ""}をもう一度教えてくれると嬉しいな！`
                  }
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {result.gaps.slice(0, 3).map(gap => (
                    <button key={gap} className="btn-ghost" onClick={() => {
                      setInputText(`${topic.title} - ${gap}`);
                      setScreen("home"); setTopic(null);
                      setActiveInputTab("text");
                    }} style={{
                      padding: "0.35rem 0.75rem", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: `${cc}15`, color: cc, border: `1px solid ${cc}30`,
                    }}>
                      📖 {gap}を学び直す
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 思考構造の比較（ユーザー vs 理想） */}
            {canUseApi && (
              <GraphComparison
                apiKey={apiKey}
                topic={topic.title}
                coreText={topic.core_text || ""}
                turns={turns}
                mastered={result.mastered}
                accentColor={cc}
              />
            )}

            {/* キャラクター成長タイムライン */}
            {char && profile.length > 0 && (
              <CharacterGrowthTimeline
                char={char}
                profile={profile}
                accentColor={cc}
              />
            )}

            {/* キャラ成長バー */}
            {char && (
              <div className="card" style={{ marginBottom: "1.25rem", borderColor: `${cc}25`, background: `${cc}05` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <Avatar char={char} size={40} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{char.custom_name || char.name}との絆</div>
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
                setRqsHistory([]); rqsRef.current = []; setStateHistory([]); stateHistRef.current = [];
                setCurrentState("ORIENT"); curStateRef.current = "ORIENT"; setKbSignals([]); kbRef.current = [];
                setScreen("session");
                setTimeout(() => {
                  const introText = charRef.current?.intro || topic.first_prompt || "";
                  setTurns([{ role: "ai", text: introText }]);
                  setVoiceState("speaking");
                  synth.speak(introText, () => setVoiceState("idle"), getCharVoice(charRef.current));
                }, 400);
              }} style={{ flex: 1, background: cc, marginTop: 0 }}>もう一度</button>
              <button className="btn-primary" onClick={() => {
                setScreen("home"); setTopic(null);
                setInputUrl(""); setInputText(""); setFileContent(""); setFileData(null); setFileInfo(null);
                setActiveInputTab("text");
                setRqsHistory([]); rqsRef.current = [];
                setStateHistory([]); stateHistRef.current = [];
                setCurrentState("ORIENT"); curStateRef.current = "ORIENT";
                setKbSignals([]); kbRef.current = [];
              }} style={{ flex: 1, background: "#f5f5f5", color: "#555", marginTop: 0 }}>別のトピックを教える</button>
            </div>

            {/* Share Buttons */}
            {(() => {
              const shareScore = isV3 ? `${displayScore}${displayMax}` : `${total}点`;
              const shareGrade = grade ? ` Grade ${grade}` : "";
              return (
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#ccc", marginBottom: "0.5rem", fontWeight: 600 }}>結果をシェア</div>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => {
                    const text = `${topic.title}をAIに教えて${shareScore}獲得！${shareGrade}\n#teachAI #AIに教えて理解する`;
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
                  }} style={{
                    padding: "8px 16px", borderRadius: 10, border: "1.5px solid #1DA1F220",
                    background: "#1DA1F208", color: "#1DA1F2", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>𝕏 ポスト</button>
                  <button onClick={() => {
                    const text = `${topic.title}をAIに教えて${shareScore}獲得！${shareGrade}\n#teachAI`;
                    window.open(`https://social-plugins.line.me/lineit/share?text=${encodeURIComponent(text)}`, "_blank");
                  }} style={{
                    padding: "8px 16px", borderRadius: 10, border: "1.5px solid #06C75520",
                    background: "#06C75508", color: "#06C755", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>LINE</button>
                  <button onClick={() => {
                    const text = `${topic.title}をAIに教えて${shareScore}獲得！${shareGrade} #teachAI`;
                    navigator.clipboard?.writeText(text);
                  }} style={{
                    padding: "8px 16px", borderRadius: 10, border: "1.5px solid #eee",
                    background: "#fafafa", color: "#888", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>コピー</button>
                </div>
              </div>
              );
            })()}

            {/* Streak Display */}
            {streak.currentStreak > 0 && (
              <div className="fade-in" style={{
                marginTop: "1rem", textAlign: "center", padding: "0.75rem",
                borderRadius: 14, background: "linear-gradient(135deg, #FF6B9D08, #FF9A5608)",
                border: "1px solid #FF6B9D15",
              }}>
                <span style={{ fontSize: 22 }}>🔥</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#FF6B9D", marginLeft: 6 }}>{streak.currentStreak}日連続ティーチング中！</span>
                {streak.currentStreak >= streak.longestStreak && streak.currentStreak > 1 && (
                  <span style={{ fontSize: 11, color: "#F5A623", marginLeft: 8 }}>自己ベスト更新！</span>
                )}
              </div>
            )}
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

      {/* ── ナビゲーション ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.04)",
        marginBottom: 0, gap: 8,
      }}>
        {/* 左: ロゴ + ストリーク */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Link href="/" style={{ textDecoration: "none", fontSize: 20, fontWeight: 900, color: "#0A2342", letterSpacing: "-0.5px" }}>
            teach<span style={{ color: "#FF6B9D" }}>AI</span>
          </Link>
          {streak.currentStreak > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 3,
              padding: "3px 8px", borderRadius: 100,
              background: "linear-gradient(135deg, #FF6B9D08, #FF6B9D12)", border: "1px solid #FF6B9D18",
              fontSize: 10, fontWeight: 700, color: "#FF6B9D",
            }}>
              {streak.currentStreak}日連続
            </div>
          )}
        </div>

        {/* 中央: サブページリンク（見たい人だけアクセス） */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 1, overflow: "hidden" }}>
          <a href="/landing" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#9CA3AF", textDecoration: "none", borderRadius: 8, whiteSpace: "nowrap", transition: "color 0.2s" }}>
            About
          </a>
          {authUser && (
            <a href="/dashboard" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#9CA3AF", textDecoration: "none", borderRadius: 8, whiteSpace: "nowrap", transition: "color 0.2s" }}>
              Dashboard
            </a>
          )}
          <a href="/api/docs" target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#9CA3AF", textDecoration: "none", borderRadius: 8, whiteSpace: "nowrap", transition: "color 0.2s" }}>
            API
          </a>
        </div>

        {/* 右: 認証 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {authUser ? (
            <>
              <span style={{ fontSize: 11, color: "#6B7280", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                {authUser.name}
              </span>
              <button onClick={handleLogout}
                style={{
                  padding: "7px 14px", background: "transparent", border: "1.5px solid #E5E7EB",
                  borderRadius: 10, cursor: "pointer", fontSize: 12, color: "#6B7280", fontWeight: 600,
                  fontFamily: "inherit", transition: "all 0.2s",
                }}>
                ログアウト
              </button>
            </>
          ) : (
            <>
              <a href="/auth/login" style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#6B7280", textDecoration: "none", whiteSpace: "nowrap" }}>
                ログイン
              </a>
              <a href="/auth/signup" style={{
                padding: "8px 18px", fontSize: 12, fontWeight: 700,
                color: "#fff", textDecoration: "none", borderRadius: 10, whiteSpace: "nowrap",
                background: "linear-gradient(135deg, #0A2342, #1A6B72)", boxShadow: "0 2px 8px rgba(10,35,66,0.15)",
              }}>
                無料で始める
              </a>
            </>
          )}
        </div>
      </nav>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div className="container home-wrap">

          {/* Tabs */}
          <div className="tab-nav">
            <button className={`tab-btn ${tab === "learn" ? "active" : ""}`} onClick={() => setTab("learn")}>✨ AIに教える</button>
            <button className={`tab-btn ${tab === "skills" ? "active" : ""}`} onClick={() => setTab("skills")}>📊 スキルマップ</button>
          </div>

          {tab === "learn" && (
            <>
              {/* ログイン済みウェルカムバナー + API状態 */}
              {authUser && !apiKey && trialAvailable && profile.length === 0 && (
                <div style={{
                  padding: "1rem 1.25rem", borderRadius: 16, marginBottom: "1rem",
                  background: "linear-gradient(135deg, #0A234208, #1A6B7208)",
                  border: "1.5px solid #1A6B7218",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0A2342", marginBottom: "0.3rem" }}>
                    {cn}が待ってるよ！ ようこそ、{authUser.name?.split("@")[0]}さん
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                    すぐに始められます！下のテーマ入力に教えたいことを入れて、{cn}に教えてみましょう。
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 12px", borderRadius: 100,
                    background: "#10B98115", border: "1px solid #10B98125",
                    fontSize: 11, fontWeight: 700, color: "#10B981",
                  }}>
                    ✨ すぐに使えます
                  </div>
                </div>
              )}

              {/* キャラバナー (enhanced with greeting & mood) */}
              {char ? (() => {
                const hour = new Date().getHours();
                const greeting = hour < 6 ? "夜更かし中？" : hour < 11 ? "おはよう！" : hour < 14 ? "こんにちは！" : hour < 18 ? "今日も一緒に頑張ろう！" : hour < 22 ? "お疲れさま！" : "夜の勉強タイムだね！";
                const greetingEmoji = hour < 6 ? "\uD83C\uDF19" : hour < 11 ? "\u2600\uFE0F" : hour < 14 ? "\uD83C\uDF1F" : hour < 18 ? "\uD83D\uDCAA" : hour < 22 ? "\u2728" : "\uD83C\uDF03";
                // Mood based on recent session performance
                const recentScores = profile.slice(0, 3).map(p => p.score);
                const avgRecent = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
                const mood = profile.length === 0 ? "excited" : avgRecent >= 80 ? "proud" : avgRecent >= 60 ? "happy" : avgRecent >= 40 ? "encouraging" : "caring";
                const moodLabel = mood === "excited" ? "ワクワク" : mood === "proud" ? "誇らしい" : mood === "happy" ? "ご機嫌" : mood === "encouraging" ? "応援中" : "心配中";
                const moodEmoji = mood === "excited" ? "\uD83E\uDD29" : mood === "proud" ? "\uD83E\uDD73" : mood === "happy" ? "\uD83D\uDE0A" : mood === "encouraging" ? "\uD83D\uDCAA" : "\uD83E\uDD17";
                return (
                <button onClick={() => setScreen("char_detail")}
                  className="banner-bounce"
                  style={{
                    display: "flex", alignItems: "center", gap: "0.875rem",
                    padding: "0.875rem 1rem", borderRadius: 18,
                    background: `${cc}09`, border: `1.5px solid ${cc}22`,
                    marginBottom: "1rem", cursor: "pointer", textAlign: "left", width: "100%",
                    fontFamily: "inherit",
                  }}>
                  <Avatar char={char} size={56} expression={mood === "proud" || mood === "happy" ? "happy" : mood === "caring" ? "confused" : "neutral"} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: "#222" }}>{char.custom_name || char.name}</span>
                      <span style={{ fontSize: 11, color: cc, background: `${cc}15`, padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>{moodEmoji} {moodLabel}</span>
                    </div>
                    <div style={{ fontSize: 12, color: cc, lineHeight: 1.4, marginBottom: "0.3rem", fontWeight: 600 }}>
                      {greetingEmoji} {greeting}
                    </div>
                    <div style={{ fontSize: 11, color: "#999", lineHeight: 1.3, marginBottom: "0.4rem" }}>
                      {profile.length === 0
                        ? `「何か教えてほしいな〜！」`
                        : `「${profile.length}回も教えてもらっちゃった！」`
                      }
                    </div>
                    <StageBar char={char} n={profile.length} />
                  </div>
                  <div style={{ fontSize: 16, color: "#ddd", flexShrink: 0 }}>›</div>
                </button>
                );
              })() : (
                <button onClick={() => setScreen("char_detail")}
                  className="banner-bounce"
                  style={{ width: "100%", padding: "0.875rem", borderRadius: 18, border: "1.5px dashed #ddd", background: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "#aaa", fontSize: 13, cursor: "pointer", marginBottom: "1rem", fontFamily: "inherit" }}>
                  + キャラクターを選択する
                </button>
              )}

              {/* 入力カード */}
              <div className="card" style={{ marginBottom: "1rem" }}>
                {/* 入力モードタブ */}
                {(() => {
                  const inputMode = activeInputTab;
                  const tabs = [
                    { id: "text" as const, icon: "✏️", label: "テキスト" },
                    { id: "url" as const,  icon: "🔗", label: "URL" },
                    { id: "file" as const, icon: "📎", label: "ファイル" },
                  ];
                  return (
                    <>
                      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.75rem" }}>
                        {tabs.map(t => (
                          <button key={t.id}
                            onClick={() => {
                              setActiveInputTab(t.id);
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

                      {/* テキスト入力 */}
                      {inputMode === "text" && (
                        <>
                          <textarea value={inputText}
                            onChange={e => { const v = e.target.value; if (v.length <= TEXT_INPUT_LIMIT) { setInputText(v); setFileContent(""); } }}
                            placeholder={`${cn}に教えたい内容を入力してね！ 例: 光合成の仕組み、量子コンピュータとは…`}
                            rows={4} className="input-base" style={{ resize: "vertical", marginBottom: 0 }} />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: inputText.length > AUTO_SPLIT_THRESHOLD ? "#F5A623" : "#ccc" }}>
                              {inputText.length > AUTO_SPLIT_THRESHOLD && "⚠️ 長文は複数セッションに分割されます "}
                            </span>
                            <span style={{ fontSize: 10, color: inputText.length > TEXT_INPUT_LIMIT * 0.9 ? "#FF6B9D" : "#ccc" }}>
                              {inputText.length.toLocaleString()} / {TEXT_INPUT_LIMIT.toLocaleString()}文字（約{(new Blob([inputText]).size / 1024).toFixed(0)}KB）
                            </span>
                          </div>
                        </>
                      )}

                      {/* URL入力 */}
                      {inputMode === "url" && (
                        <>
                          <input value={inputUrl}
                            onChange={e => { setInputUrl(e.target.value); setFileContent(""); setFileData(null); setFileInfo(null); setInputText(""); }}
                            placeholder="YouTube URL / WebサイトURL / ブログ記事URL..."
                            className="input-base"
                            style={{ marginBottom: "0.5rem" }}
                            onKeyDown={e => e.key === "Enter" && handleStart()} />
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "0.2rem" }}>
                            {["YouTube", "Web", "note", "Qiita", "Zenn", "Wikipedia"].map(f => (
                              <span key={f} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: "#f5f5f5", color: "#aaa" }}>{f}</span>
                            ))}
                          </div>
                        </>
                      )}

                      {/* ファイル添付 */}
                      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.csv,.jpg,.jpeg,.png,.gif,.webp" onChange={handleFile} style={{ display: "none" }} />
                      {inputMode === "file" && !(fileContent || fileData) && (
                        <button onClick={() => fileRef.current?.click()}
                          style={{
                            width: "100%", padding: "1.5rem 1rem", borderRadius: 12,
                            border: "2px dashed #ddd", background: "#fafafa",
                            cursor: "pointer", textAlign: "center", fontFamily: "inherit",
                            color: "#999", fontSize: 13,
                          }}>
                          📎 ファイルを選択（PDF, DOCX, XLSX, PPTX, 画像...最大10MB）
                        </button>
                      )}
                      {(fileContent || fileData) && fileInfo && (
                        <div style={{ fontSize: 12, color: "#4ECDC4", padding: "0.5rem 0.75rem", background: "#f0fffe", borderRadius: 10, marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                          <span>✓ {fileInfo.name}（{fileInfo.size > 1024 * 1024 ? `${(fileInfo.size / (1024 * 1024)).toFixed(1)} MB` : `${(fileInfo.size / 1024).toFixed(1)} KB`}）</span>
                          <button onClick={() => { setFileContent(""); setFileData(null); setFileInfo(null); setActiveInputTab("text"); }} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                        </div>
                      )}
                    </>
                  );
                })()}

                {error && <div style={{ fontSize: 13, color: "#FF6B9D", padding: "0.4rem 0.6rem", background: "#fff5f5", borderRadius: 8, marginTop: "0.5rem" }}>{error}</div>}

                <button className="btn-primary" onClick={handleStart} disabled={loading}
                  style={{ marginTop: "0.75rem", background: char ? cc : undefined }}>
                  {loading ? "✨ AIが読み込んでいます..." : `${char ? char.emoji + " " : "✨ "}AIに教え始める`}
                </button>
              </div>

              <button className="btn-ghost" onClick={() => setShowApiModal(true)}
                style={{ display: "block", width: "100%", textAlign: "center", fontSize: 12, color: "#bbb", padding: "0.4rem 0", marginBottom: "1.5rem" }}>
                {apiKey ? `🔑 ${detectProviderLabel(apiKey).label}` : trialAvailable ? "✨ すぐに使えます" : "⚠️ APIキーを設定してAIと学習を始めましょう"}
              </button>


              {/* 履歴 */}
              {profile.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "#ccc", marginBottom: "0.5rem", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>教えた履歴</div>
                  {profile.slice(0, 8).map(e => (
                    <button key={e.id}
                      onClick={() => setHistoryPopup(e)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.6rem",
                        padding: "0.5rem 0", borderBottom: "1px solid #f5f5f5",
                        width: "100%", textAlign: "left", background: "none",
                        border: "none", borderBottomWidth: 1, borderBottomStyle: "solid",
                        borderBottomColor: "#f5f5f5", cursor: "pointer", fontFamily: "inherit",
                      }}>
                      <span style={{ fontSize: 18 }}>{MODE_EMOJI[e.mode]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                        <div style={{ fontSize: 11, color: "#bbb" }}>{e.date}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: e.score >= 70 ? "#4ECDC4" : e.score >= 50 ? "#F5A623" : "#FF6B9D" }}>{e.score}</div>
                      <span style={{ fontSize: 12, color: "#ddd" }}>›</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 履歴詳細ポップアップ */}
              {historyPopup && (
                <div className="overlay" onClick={() => setHistoryPopup(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#222" }}>{historyPopup.title}</div>
                        <div style={{ fontSize: 12, color: "#bbb", marginTop: "0.2rem" }}>{historyPopup.date} · {MODE_EMOJI[historyPopup.mode]} {historyPopup.mode}</div>
                      </div>
                      <div style={{
                        fontSize: 28, fontWeight: 900,
                        color: historyPopup.score >= 70 ? "#4ECDC4" : historyPopup.score >= 50 ? "#F5A623" : "#FF6B9D",
                      }}>{historyPopup.score}</div>
                    </div>

                    {/* スコア詳細 */}
                    <div className="grid-2col" style={{ marginBottom: "1rem" }}>
                      <div style={{ background: "#f0fffe", borderRadius: 12, padding: "0.75rem" }}>
                        <div style={{ fontSize: 11, color: "#4ECDC4", fontWeight: 700, marginBottom: "0.4rem" }}>✓ 教えられた概念</div>
                        {historyPopup.mastered.length ? historyPopup.mastered.map(c => (
                          <div key={c} style={{ fontSize: 12, color: "#333", padding: "0.1rem 0" }}>· {c}</div>
                        )) : <div style={{ fontSize: 12, color: "#ccc" }}>—</div>}
                      </div>
                      <div style={{ background: "#fff5f5", borderRadius: 12, padding: "0.75rem" }}>
                        <div style={{ fontSize: 11, color: "#FF6B9D", fontWeight: 700, marginBottom: "0.4rem" }}>△ もう一度教えたい</div>
                        {historyPopup.gaps.length ? historyPopup.gaps.map(c => (
                          <div key={c} style={{ fontSize: 12, color: "#333", padding: "0.1rem 0" }}>· {c}</div>
                        )) : <div style={{ fontSize: 12, color: "#ccc" }}>—</div>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-primary" onClick={() => {
                        setInputText(historyPopup.title);
                        setHistoryPopup(null);
                      }} style={{ flex: 1, marginTop: 0, background: cc }}>
                        もう一度AIに教える
                      </button>
                      <button className="btn-primary" onClick={() => {
                        const url = `${window.location.origin}?topic=${encodeURIComponent(historyPopup.title)}`;
                        navigator.clipboard?.writeText(url);
                      }} style={{ flex: 0, marginTop: 0, background: "#f5f5f5", color: "#555", padding: "0.875rem 1rem" }}>
                        URL保存
                      </button>
                    </div>
                    <button onClick={() => setHistoryPopup(null)} style={{
                      display: "block", width: "100%", marginTop: "0.5rem",
                      background: "none", border: "none", fontSize: 13, color: "#bbb",
                      cursor: "pointer", padding: "0.5rem", fontFamily: "inherit",
                    }}>閉じる</button>
                  </div>
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

      {/* Onboarding Modal */}
      {showOnboarding && (() => {
        const steps = [
          {
            emoji: "🧠", title: "teachAI へようこそ！",
            desc: "「AIに教える」ことで、あなたの理解が深まる。\n学術論文に基づくピアチュータリング手法で、記憶定着率が2.5倍に。",
          },
          {
            emoji: "✏️", title: "Step 1: 教えたいことを入力",
            desc: "学んだ内容をテキストで入力、\nまたはYouTube URL・PDF・Webサイトを貼り付け。\nAIが内容を分析してセッションを自動生成します。",
          },
          {
            emoji: "🗣️", title: "Step 2: AIキャラクターに教える",
            desc: "AIキャラクターが質問してくるので、\n自分の言葉で教えてあげましょう。\n音声でもテキストでもOK。教えるほど理解が深まります。",
          },
          {
            emoji: "📊", title: "Step 3: スコアで成長を実感",
            desc: "5つの軸であなたの「教える力」を可視化。\n弱点がわかるから効率的に復習できます。\nAIキャラクターと一緒に成長しましょう！",
          },
        ];
        const s = steps[onboardStep] || steps[0];
        const isLast = onboardStep >= steps.length - 1;
        return (
          <div className="overlay" onClick={() => {}}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: "0.75rem" }}>{s.emoji}</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0A2342", marginBottom: "0.5rem" }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: "#777", lineHeight: 1.75, whiteSpace: "pre-line", marginBottom: "1.5rem" }}>{s.desc}</p>
              {/* Dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1.25rem" }}>
                {steps.map((_, i) => (
                  <div key={i} style={{
                    width: i === onboardStep ? 20 : 8, height: 8, borderRadius: 4,
                    background: i === onboardStep ? "#1A6B72" : "#e0e0e0",
                    transition: "all 0.3s",
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {onboardStep > 0 && (
                  <button className="btn-primary" onClick={() => setOnboardStep(onboardStep - 1)}
                    style={{ flex: 1, marginTop: 0, background: "#f5f5f5", color: "#555" }}>戻る</button>
                )}
                <button className="btn-primary" onClick={() => {
                  if (isLast) {
                    markOnboarded();
                    setShowOnboarding(false);
                  } else {
                    setOnboardStep(onboardStep + 1);
                  }
                }} style={{ flex: 1, marginTop: 0, background: "linear-gradient(135deg, #0A2342, #1A6B72)" }}>
                  {isLast ? "始める！" : "次へ"}
                </button>
              </div>
              {!isLast && (
                <button onClick={() => { markOnboarded(); setShowOnboarding(false); }}
                  style={{ background: "none", border: "none", fontSize: 12, color: "#bbb", cursor: "pointer", marginTop: "0.75rem", fontFamily: "inherit" }}>
                  スキップ
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* キャラクター作成モーダル（初回ログイン時） */}
      {showCharCreation && (() => {
        const presets = [
          { id: "mio", name: "ミオ", emoji: "👧", color: "#FF6B9D", personality: "元気で好奇心旺盛", speaking_style: "タメ口で親しみやすい。語尾に「！」「〜」が多い", intro: "はじめまして！ミオだよ〜！たくさん教えてね！" },
          { id: "sora", name: "ソラ", emoji: "👦", color: "#3A8BD2", personality: "冷静で知的。論理的に理解したい", speaking_style: "丁寧語だが堅すぎない。「なるほど」「つまり」が多い", intro: "こんにちは、ソラです。しっかり教えてくださいね。" },
          { id: "haru", name: "ハル", emoji: "🧒", color: "#2EAD9A", personality: "のんびりマイペース。独自の視点を持つ", speaking_style: "ゆったりとした口調。「へぇ〜」「ふーん」が特徴", intro: "やぁ、ハルだよ〜。ゆっくり教えてね。" },
          { id: "rin", name: "リン", emoji: "👩", color: "#7B3FA0", personality: "真面目で向上心が強い。完璧主義", speaking_style: "です・ます調だが感情豊か。「すごい！」「完璧！」が多い", intro: "リンです！一生懸命覚えるので教えてください！" },
        ];
        const selectedPreset = presets.find(p => p.id === charCreationPreset) || presets[0];
        return (
          <div className="overlay" onClick={() => {}}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, textAlign: "center" }}>
              {charCreationStep === 0 ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#0A2342", marginBottom: 4 }}>パートナーを選ぼう</div>
                  <p style={{ fontSize: 13, color: "#999", marginBottom: "1.25rem" }}>あなたに教わるAIキャラクターを選んでください</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                    {presets.map(p => (
                      <button key={p.id} onClick={() => setCharCreationPreset(p.id)}
                        style={{
                          padding: "1rem 0.75rem", borderRadius: 16, border: `2px solid ${charCreationPreset === p.id ? p.color : "#eee"}`,
                          background: charCreationPreset === p.id ? `${p.color}08` : "#fafafa",
                          cursor: "pointer", textAlign: "center", fontFamily: "inherit", transition: "all 0.2s",
                        }}>
                        <Avatar char={{ ...p, praise: "", struggle: "", confused: "", lore: "", interests: [], knowledge_areas: [], growth_stages: [], evolution_log: [] } as Character} size={56} />
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#222", marginTop: 8 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{p.personality}</div>
                      </button>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={() => {
                    setCharCreationCustomName(selectedPreset.name);
                    setCharCreationCustomPersonality(selectedPreset.personality);
                    setCharCreationEmoji(selectedPreset.emoji);
                    setCharCreationStep(1);
                  }} style={{ marginTop: 0, background: selectedPreset.color }}>
                    {selectedPreset.name}を選ぶ
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
                    <Avatar char={{ ...selectedPreset, praise: "", struggle: "", confused: "", lore: "", interests: [], knowledge_areas: [], growth_stages: [], evolution_log: [] } as Character} size={72} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0A2342", marginBottom: 4 }}>カスタマイズ</div>
                  <p style={{ fontSize: 12, color: "#999", marginBottom: "1rem" }}>名前・アイコン・性格を自由に変更できます（後からも変更可能）</p>
                  <div style={{ textAlign: "left", marginBottom: "0.75rem" }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4, display: "block" }}>アイコン</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["👧", "👦", "🧒", "👩", "🐱", "🐶", "🦊", "🐰", "🐼", "🦉", "🌸", "⭐"].map(e => (
                        <button key={e} onClick={() => setCharCreationEmoji(e)}
                          style={{
                            width: 40, height: 40, borderRadius: 10, border: `2px solid ${charCreationEmoji === e ? selectedPreset.color : "#eee"}`,
                            background: charCreationEmoji === e ? `${selectedPreset.color}10` : "#fafafa",
                            cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "left", marginBottom: "0.75rem" }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4, display: "block" }}>名前</label>
                    <input value={charCreationCustomName} onChange={e => setCharCreationCustomName(e.target.value)}
                      className="input-base" maxLength={10} placeholder="好きな名前を入力" />
                  </div>
                  <div style={{ textAlign: "left", marginBottom: "1rem" }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4, display: "block" }}>性格メモ</label>
                    <textarea value={charCreationCustomPersonality} onChange={e => setCharCreationCustomPersonality(e.target.value)}
                      className="input-base" rows={2} maxLength={100} placeholder="キャラクターの性格" style={{ resize: "none" }} />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn-primary" onClick={() => setCharCreationStep(0)}
                      style={{ flex: 0, marginTop: 0, background: "#f5f5f5", color: "#555", padding: "0.875rem 1rem" }}>戻る</button>
                    <button className="btn-primary" onClick={() => {
                      const newChar: Character = {
                        id: selectedPreset.id,
                        name: charCreationCustomName.trim() || selectedPreset.name,
                        emoji: charCreationEmoji || selectedPreset.emoji,
                        color: selectedPreset.color,
                        personality: charCreationCustomPersonality.trim() || selectedPreset.personality,
                        speaking_style: selectedPreset.speaking_style,
                        praise: `「${charCreationCustomName.trim() || selectedPreset.name}は嬉しそうに」すごい！わかった！もっと教えて！`,
                        struggle: `「${charCreationCustomName.trim() || selectedPreset.name}は困った顔で」うーん、もう一回教えてくれる？`,
                        confused: `「${charCreationCustomName.trim() || selectedPreset.name}は首をかしげて」そこがよくわからないんだけど…`,
                        intro: selectedPreset.intro,
                        lore: `${charCreationCustomName.trim() || selectedPreset.name}は教えてもらうのが大好き。一緒に成長していく。`,
                        interests: [], knowledge_areas: [],
                        growth_stages: [
                          { label: "出会ったばかり", threshold: 0 }, { label: "なかよし", threshold: 3 },
                          { label: "信頼の絆", threshold: 8 }, { label: "ずっと一緒", threshold: 15 },
                          { label: "かけがえのない存在", threshold: 30 },
                        ],
                        evolution_log: [],
                      };
                      setChar(newChar);
                      saveChar(newChar);
                      syncCharToSupabase(newChar);
                      setShowCharCreation(false);
                      setCharCreationStep(0);
                    }} style={{ flex: 1, marginTop: 0, background: selectedPreset.color }}>
                      {charCreationCustomName.trim() || selectedPreset.name}と始める！
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* テキスト分割モーダル */}
      {showSplitModal && splitParts.length > 1 && (
        <div className="overlay" onClick={() => setShowSplitModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: "0.25rem" }}>📚 テキストを分割</div>
            <div style={{ fontSize: 12, color: "#bbb", marginBottom: "1rem" }}>
              入力テキストが長いため、{splitParts.length}つのセッションに分割します。
              1つずつAIに教えることで、より深い理解が得られます。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem", maxHeight: 200, overflowY: "auto" }}>
              {splitParts.map((part, i) => (
                <div key={i} style={{
                  padding: "0.5rem 0.75rem", borderRadius: 10,
                  background: i === splitIndex ? `${cc}10` : "#fafafa",
                  border: `1.5px solid ${i === splitIndex ? cc : "#eee"}`,
                  cursor: "pointer", fontSize: 12, color: "#555",
                }} onClick={() => setSplitIndex(i)}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>パート {i + 1} / {splitParts.length}</div>
                  <div style={{ color: "#999" }}>{part.slice(0, 80)}...</div>
                  <div style={{ fontSize: 10, color: "#ccc", marginTop: 2 }}>{part.length.toLocaleString()}文字</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" onClick={() => {
                setInputText(splitParts[splitIndex]);
                setShowSplitModal(false);
                setTimeout(() => handleStart(), 100);
              }} style={{ flex: 1, marginTop: 0, background: cc }}>
                パート{splitIndex + 1}から開始
              </button>
              <button className="btn-primary" onClick={() => setShowSplitModal(false)}
                style={{ flex: 0, marginTop: 0, background: "#f5f5f5", color: "#555", padding: "0.875rem 1rem" }}>閉じる</button>
            </div>
          </div>
        </div>
      )}

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

              {trialAvailable && !apiKey && (
                <div style={{ fontSize: 12, color: "#10B981", background: "#ECFDF5", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.5rem", border: "1px solid #A7F3D0" }}>
                  ✨ APIキーなしでも全機能が使えます。自分のキーを設定するとプロバイダーを選択できます。
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn-primary" onClick={() => { const k = apiInput.trim(); setApiKey(k); localStorage.setItem("tg_apikey", k); setShowApiModal(false); }}
                  style={{ flex: 1, marginTop: 0, background: detected.color !== "#bbb" ? detected.color : undefined }}>
                  保存
                </button>
                {trialAvailable && !apiKey ? (
                  <button className="btn-primary" onClick={() => setShowApiModal(false)}
                    style={{ flex: 1, marginTop: 0, background: "#10B981", color: "white" }}>そのまま使う</button>
                ) : (
                  <button className="btn-primary" onClick={() => setShowApiModal(false)}
                    style={{ flex: 1, marginTop: 0, background: "#f5f5f5", color: "#555" }}>閉じる</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

