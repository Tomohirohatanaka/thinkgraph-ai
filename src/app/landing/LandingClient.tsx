"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   BRAND SYSTEM
   ══════════════════════════════════════════════════════════════ */
const B = {
  navy: "#0A2342",
  accent: "#FF6B9D",
  teal: "#1A6B72",
  green: "#00C9A7",
  gold: "#F5A623",
  purple: "#8E44AD",
  blue: "#45B7D1",
  bg: "#FAFBFE",
  card: "#FFFFFF",
  text: "#1A1A2E",
  sub: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  gradientPrimary: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
  gradientAccent: "linear-gradient(135deg, #FF6B9D 0%, #FF8E53 100%)",
  gradientGold: "linear-gradient(135deg, #F5A623 0%, #FF6B9D 100%)",
};

/* ── Helpers ───────────────────────────────────────────────── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function AnimatedNumber({ value, suffix = "", prefix = "", duration = 1500 }: { value: number; suffix?: string; prefix?: string; duration?: number }) {
  const { ref, visible } = useInView(0.3);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [visible, value, duration]);
  return <span ref={ref}>{prefix}{current.toLocaleString()}{suffix}</span>;
}

/* ══════════════════════════════════════════════════════════════
   SECTION COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function SectionBadge({ text, color = B.accent }: { text: string; color?: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 16px", borderRadius: 100,
      background: `${color}10`, border: `1px solid ${color}25`,
      fontSize: 12, fontWeight: 700, color, letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
    }}>{text}</div>
  );
}

function SectionHeader({ badge, title, subtitle, align = "center" }: { badge: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  return (
    <div style={{ textAlign: align, marginBottom: "3rem" }}>
      <SectionBadge text={badge} />
      <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: B.navy, lineHeight: 1.2, marginTop: "1rem", letterSpacing: "-0.5px" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 16, color: B.sub, maxWidth: 600, margin: align === "center" ? "0.75rem auto 0" : "0.75rem 0 0", lineHeight: 1.7 }}>{subtitle}</p>}
    </div>
  );
}

/* ── Hero ── */
function Hero() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  return (
    <section style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "100px 24px 60px", textAlign: "center",
      background: "linear-gradient(180deg, #F0F4FF 0%, #FAFBFE 40%, #fff 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background orbs */}
      <div style={{ position: "absolute", top: "5%", left: "0%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${B.teal}06, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${B.accent}06, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)", maxWidth: 900,
      }}>
        {/* Credibility badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "8px 20px", borderRadius: 100,
          background: "#fff", border: `1.5px solid ${B.border}`,
          fontSize: 13, color: B.sub, fontWeight: 600,
          marginBottom: "2rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}>
          <span style={{ background: B.gradientAccent, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800 }}>New</span>
          認知科学に基づく次世代学習プラットフォーム
        </div>

        <h1 style={{
          fontSize: "clamp(40px, 7vw, 72px)", fontWeight: 900,
          color: B.navy, lineHeight: 1.1, letterSpacing: "-2px",
          marginBottom: "1.5rem",
        }}>
          AIに<span style={{
            background: B.gradientAccent,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>教える</span>ことで
          <br />学習効率を<span style={{
            background: `linear-gradient(135deg, ${B.teal}, ${B.green})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>18倍</span>に
        </h1>

        <p style={{
          fontSize: "clamp(17px, 2.5vw, 21px)", color: B.sub,
          maxWidth: 640, margin: "0 auto", lineHeight: 1.8,
          marginBottom: "2.5rem",
        }}>
          「教えることが最高の学習法である」という認知科学の知見を、
          <br className="hide-mobile" />
          AIテクノロジーで誰もが実践できるプロダクトにしました。
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: "3rem" }}>
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "18px 40px", borderRadius: 14,
            background: B.gradientPrimary, color: "#fff",
            fontSize: 17, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 8px 30px rgba(10,35,66,0.25)",
            transition: "all 0.3s",
          }}>
            無料で今すぐ体験する
            <span style={{ fontSize: 20 }}>→</span>
          </Link>
          <a href="#demo" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "18px 32px", borderRadius: 14,
            background: "#fff", color: B.navy,
            fontSize: 16, fontWeight: 600, textDecoration: "none",
            border: `1.5px solid ${B.border}`,
            transition: "all 0.3s",
          }}>
            デモを見る
          </a>
        </div>

        {/* Key metrics */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "2rem",
          flexWrap: "wrap",
        }}>
          {[
            { value: "90%", label: "記憶定着率", sub: "受動学習の18倍" },
            { value: "5軸", label: "学術的評価", sub: "SOLO Taxonomy" },
            { value: "8種", label: "入力形式対応", sub: "YouTube/PDF/Web等" },
            { value: "4社", label: "AIプロバイダー", sub: "Claude/GPT/Gemini/Bedrock" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center", minWidth: 120 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: B.navy, letterSpacing: "-1px" }}>{m.value}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: B.text, marginTop: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: B.muted }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Problem / Market ── */
function ProblemSection() {
  const { ref, visible } = useInView();
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="THE PROBLEM" title="なぜ従来の学習は非効率なのか" subtitle="情報のインプットに偏った学習は、深い理解に繋がりません。" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
          {[
            { icon: "📖", stat: "5%", title: "講義を聞くだけ", desc: "受動的に情報を受け取る従来の学習。1週間後の記憶定着率はわずか5%。", color: "#E5E7EB" },
            { icon: "✏️", stat: "20%", title: "演習問題を解く", desc: "能動的な学習でも定着率は20%程度。表面的な理解で終わりがち。", color: B.blue },
            { icon: "🗣️", stat: "90%", title: "人に教える", desc: "自分の言葉で説明する行為が最も効果的。teachAIはこれをAIで実現。", color: B.accent, highlight: true },
          ].map(item => (
            <div key={item.title} style={{
              background: item.highlight ? `linear-gradient(135deg, ${B.navy}, ${B.teal})` : "#fff",
              borderRadius: 20, padding: "2rem",
              border: item.highlight ? "none" : `1.5px solid ${B.border}`,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: item.highlight ? "rgba(255,255,255,0.15)" : `${item.color}40`, position: "absolute", top: 12, right: 16, letterSpacing: -2 }}>{item.stat}</div>
              <div style={{ fontSize: 32, marginBottom: "0.75rem" }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: item.highlight ? B.accent : B.muted, marginBottom: 4 }}>記憶定着率 {item.stat}</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: item.highlight ? "#fff" : B.navy, marginBottom: "0.5rem" }}>{item.title}</h3>
              <p style={{ fontSize: 14, color: item.highlight ? "rgba(255,255,255,0.75)" : B.sub, lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", fontSize: 13, color: B.muted }}>
          出典: National Training Laboratories「学習ピラミッド」/ Roscoe & Chi (2007) ピアチュータリング研究
        </div>
      </div>
    </section>
  );
}

/* ── Live Demo ── */
const DEMO = [
  { role: "ai" as const, text: "光合成について教えてくれるの？ まず、光合成ってそもそも何なのか、一言で教えて！" },
  { role: "user" as const, text: "光合成は、植物が太陽の光エネルギーを使って、水とCO2から糖を作り出す化学反応だよ" },
  { role: "ai" as const, text: "すごい！ じゃあ、その反応はどこで起きてるの？ 植物の体のどの部分？" },
  { role: "user" as const, text: "葉っぱの中にある葉緑体っていう器官の中。チラコイドとストロマっていう構造があってね..." },
  { role: "ai" as const, text: "チラコイドとストロマ！ それぞれどんな役割があるの？ もっと詳しく教えて！" },
];

function DemoSection() {
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const interval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (count >= DEMO.length) {
      const t = setTimeout(() => { setCount(0); setTyping(""); }, 4000);
      return () => clearTimeout(t);
    }
    const msg = DEMO[count];
    setIsTyping(true); setTyping("");
    let idx = 0;
    const delay = count === 0 ? 800 : 1200;
    const t = setTimeout(() => {
      interval.current = setInterval(() => {
        idx++;
        if (idx <= msg.text.length) { setTyping(msg.text.slice(0, idx)); }
        else {
          if (interval.current) clearInterval(interval.current);
          setIsTyping(false);
          setTimeout(() => setCount(c => c + 1), 600);
        }
      }, 28);
    }, delay);
    return () => { clearTimeout(t); if (interval.current) clearInterval(interval.current); };
  }, [count]);

  return (
    <section id="demo" style={{ padding: "100px 24px", background: B.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeader badge="LIVE DEMO" title="こんな風にAIに教えます" subtitle="あなたが先生、AIが生徒。教えるほどに理解が深まる。" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem", maxWidth: 680, margin: "0 auto" }}>
          {/* Chat window */}
          <div style={{
            background: "#fff", borderRadius: 24, padding: "2rem",
            border: `1.5px solid ${B.border}`,
            boxShadow: "0 8px 40px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: `1px solid ${B.border}` }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${B.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👧</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: B.navy }}>ミオ</div>
                <div style={{ fontSize: 12, color: B.accent, fontWeight: 600 }}>AIプロテジェ（教え相手）</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: B.green, animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 11, color: B.green, fontWeight: 700 }}>LIVE</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 300 }}>
              {DEMO.slice(0, count).map((m, i) => (
                <div key={i} style={{
                  background: m.role === "ai" ? B.bg : B.accent,
                  borderRadius: m.role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                  padding: "14px 18px", maxWidth: "85%",
                  marginLeft: m.role === "user" ? "auto" : undefined,
                  fontSize: 14, color: m.role === "ai" ? B.text : "#fff", lineHeight: 1.7,
                  animation: "fadeSlideIn 0.3s ease-out",
                }}>{m.text}</div>
              ))}
              {isTyping && count < DEMO.length && (
                <div style={{
                  background: DEMO[count].role === "ai" ? B.bg : B.accent,
                  borderRadius: DEMO[count].role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                  padding: "14px 18px", maxWidth: "85%",
                  marginLeft: DEMO[count].role === "user" ? "auto" : undefined,
                  fontSize: 14, color: DEMO[count].role === "ai" ? B.text : "#fff", lineHeight: 1.7,
                }}>{typing}<span style={{ animation: "blink 0.8s infinite", fontWeight: 700 }}>|</span></div>
              )}
            </div>
          </div>

          {/* Supported formats */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "テキスト", icon: "✏️" },
              { label: "YouTube", icon: "🎬" },
              { label: "Web", icon: "🌐" },
              { label: "PDF", icon: "📄" },
              { label: "Word", icon: "📝" },
              { label: "Excel", icon: "📊" },
              { label: "PowerPoint", icon: "📎" },
              { label: "画像", icon: "🖼️" },
            ].map(f => (
              <div key={f.label} style={{
                padding: "8px 16px", borderRadius: 100,
                background: "#fff", border: `1px solid ${B.border}`,
                fontSize: 12, fontWeight: 600, color: B.sub,
                display: "flex", alignItems: "center", gap: 5,
              }}><span>{f.icon}</span> {f.label}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── How It Works ── */
function HowItWorks() {
  const { ref, visible } = useInView();
  return (
    <section id="how" style={{ padding: "100px 24px", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 1000, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="HOW IT WORKS" title="3ステップで「教えて学ぶ」" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "2rem" }}>
          {[
            { num: 1, icon: "📥", title: "教材をインプット", desc: "YouTube URL・PDF・Webページを貼り付け、またはテキストを直接入力。AIが自動で内容を分析・構造化します。", color: B.teal },
            { num: 2, icon: "🗣️", title: "AIプロテジェに教える", desc: "AIキャラクターが質問してくるので、自分の言葉で教えてあげましょう。音声でもテキストでもOK。", color: B.accent },
            { num: 3, icon: "📊", title: "理解度をスコア化", desc: "SOLO Taxonomyに基づく5軸で「教える力」をリアルタイム評価。弱点と強みが即座にわかります。", color: B.green },
          ].map(s => (
            <div key={s.num} style={{ textAlign: "center", padding: "2rem 1.5rem" }}>
              <div style={{
                width: 80, height: 80, borderRadius: 20, margin: "0 auto 1.5rem",
                background: `${s.color}10`, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36, position: "relative",
              }}>
                {s.icon}
                <span style={{
                  position: "absolute", top: -6, right: -6,
                  width: 28, height: 28, borderRadius: "50%",
                  background: s.color, color: "#fff",
                  fontSize: 13, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{s.num}</span>
              </div>
              <h4 style={{ fontSize: 19, fontWeight: 800, color: B.navy, marginBottom: "0.6rem" }}>{s.title}</h4>
              <p style={{ fontSize: 14, color: B.sub, lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features Grid ── */
function Features() {
  const { ref, visible } = useInView();
  const features = [
    { icon: "🧠", title: "教えて学ぶ効果", desc: "「教える」行為は受動的学習の18倍の記憶定着。認知科学の知見をAIで誰でも実践可能に。", color: B.teal },
    { icon: "👧", title: "成長するAIキャラクター", desc: "教えるほど成長するプロテジェ。5段階の成長ステージで絆を深め、学習継続のモチベーションに。", color: B.accent },
    { icon: "📊", title: "SOLO 5軸リアルタイム評価", desc: "網羅性・深さ・明晰さ・論理構造・教育的洞察。学術水準の評価で理解の質を定量化。", color: B.green },
    { icon: "🎙️", title: "音声対応（話して教える）", desc: "マイクボタンで音声入力。AIの回答も全文読み上げ。通勤中や歩きながらでも学習可能。", color: B.blue },
    { icon: "🗺️", title: "知識グラフ＆忘却曲線", desc: "教えた概念の繋がりを可視化。エビングハウスの忘却曲線に基づく最適な復習タイミングを自動提案。", color: B.purple },
    { icon: "🔌", title: "マルチAI＆API対応", desc: "Claude・GPT・Gemini・Bedrockの4社に対応。全機能をAPI/MCPとして外部連携可能。", color: B.gold },
  ];
  return (
    <section style={{ padding: "100px 24px", background: B.bg }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="FEATURES" title="全ての機能が研究に裏付けられている" subtitle="認知科学・教育工学の研究成果を、プロダクトに実装しています。" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: "#fff", borderRadius: 20, padding: "2rem 1.75rem",
              border: `1.5px solid ${B.border}`, transition: "all 0.3s", cursor: "default",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = `${f.color}40`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = B.border; }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 16, display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 28,
                background: `${f.color}10`, marginBottom: "1.25rem",
              }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: B.navy, marginBottom: "0.5rem" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: B.sub, lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Characters ── */
function Characters() {
  const { ref, visible } = useInView();
  const chars = [
    { emoji: "👧", name: "ミオ", trait: "元気で好奇心旺盛", color: "#FF6B9D", desc: "「えー！もっと教えて！」が口癖。あなたの説明に目を輝かせます。" },
    { emoji: "👦", name: "ソラ", trait: "冷静で論理的", color: "#45B7D1", desc: "「なるほど、でもこの場合は？」と鋭い質問で理解を深めてくれます。" },
    { emoji: "🧑", name: "ハル", trait: "優しくて丁寧", color: "#4ECDC4", desc: "「ゆっくりでいいよ」と寄り添い、安心して教えられる雰囲気を作ります。" },
    { emoji: "👩", name: "リン", trait: "クールで知的", color: "#8E44AD", desc: "「本質は何？」と核心を突く質問で、あなたの思考を鍛えます。" },
  ];
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 1000, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="AI CHARACTERS" title="あなただけのプロテジェ" subtitle="教えるほど成長するAIキャラクター。愛着がわくほど学習は継続する。" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.25rem" }}>
          {chars.map(c => (
            <div key={c.name} style={{
              background: "#fff", borderRadius: 20, padding: "2rem 1.5rem", textAlign: "center",
              border: `1.5px solid ${B.border}`, transition: "all 0.3s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = `0 12px 30px ${c.color}15`; e.currentTarget.style.borderColor = `${c.color}40`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = B.border; }}
            >
              <div style={{ fontSize: 56, marginBottom: 12 }}>{c.emoji}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: B.navy }}>{c.name}</div>
              <div style={{ fontSize: 13, color: c.color, fontWeight: 700, marginBottom: 8 }}>{c.trait}</div>
              <p style={{ fontSize: 13, color: B.sub, lineHeight: 1.6 }}>{c.desc}</p>
              <div style={{ marginTop: 12, fontSize: 11, color: B.muted, background: B.bg, padding: "6px 12px", borderRadius: 100, display: "inline-block" }}>
                5段階の成長ストーリー
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Market Opportunity (for investors) ── */
function MarketOpportunity() {
  const { ref, visible } = useInView();
  return (
    <section style={{ padding: "100px 24px", background: B.bg }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="MARKET OPPORTUNITY" title="急成長するEdTech市場" subtitle="世界のEdTech市場は2030年に$700B超へ。日本市場だけでも$5B規模。" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
          {[
            { value: 7000, suffix: "億$", label: "世界EdTech市場規模", sub: "2030年予測", color: B.navy },
            { value: 16, suffix: "%", label: "年平均成長率(CAGR)", sub: "2024-2030", color: B.teal },
            { value: 5000, suffix: "億円", label: "日本EdTech市場", sub: "2025年推計", color: B.accent },
            { value: 45, suffix: "億人", label: "世界のオンライン学習者", sub: "潜在ユーザー", color: B.green },
          ].map(m => (
            <div key={m.label} style={{
              background: "#fff", borderRadius: 20, padding: "2rem",
              border: `1.5px solid ${B.border}`, textAlign: "center",
            }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: m.color, letterSpacing: -1 }}>
                <AnimatedNumber value={m.value} suffix={m.suffix} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: B.navy, marginTop: 4 }}>{m.label}</div>
              <div style={{ fontSize: 12, color: B.muted }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${B.navy}, ${B.teal})`,
          borderRadius: 24, padding: "2.5rem", color: "#fff",
        }}>
          <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: "1.5rem" }}>teachAIの競争優位性</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {[
              { title: "唯一の「教えて学ぶ」AI", desc: "ChatGPTやGeminiは受動的なQ&A。teachAIだけが「教える」学習を実現。" },
              { title: "学術論文に裏付けられた手法", desc: "Roscoe & Chi (2007)、SOLO Taxonomy、Ebbinghaus等の認知科学研究に基づく設計。" },
              { title: "プロバイダー非依存", desc: "4社のAIモデルに対応。特定ベンダーへのロックインリスクがゼロ。" },
              { title: "高い参入障壁", desc: "スコアリングエンジン・キャラクター成長システム・知識グラフは独自技術。" },
            ].map(item => (
              <div key={item.title}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: B.green }}>{item.title}</div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Science ── */
function Science() {
  const { ref, visible } = useInView();
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 900, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="THE SCIENCE" title="学術論文に裏付けられた手法" />
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[
            { paper: "Roscoe & Chi (2007)", journal: "Cognitive Science", finding: "ピアチュータリングにおいてKnowledge-Building（知識構築型）の説明は、Knowledge-Telling（知識伝達型）より有意に学習効果が高い。teachAIはKBモードを自動検出しスコアに反映。", tag: "Learning by Teaching", color: B.teal },
            { paper: "Biggs & Collis (1982)", journal: "Academic Press", finding: "SOLO Taxonomy（学習成果の構造）は学習の深さを5段階で客観的に評価できる唯一の枠組み。teachAIのv3スコアリングエンジンの理論基盤。", tag: "Assessment", color: B.accent },
            { paper: "Ebbinghaus (1885)", journal: "Memory: A Contribution", finding: "間隔反復学習により記憶定着率が最大2.5倍向上。teachAIは知識グラフから忘却リスクを算出し、最適な復習タイミングを自動提案。", tag: "Retention", color: B.green },
          ].map(r => (
            <div key={r.paper} style={{
              background: B.bg, borderRadius: 20, padding: "1.75rem 2rem",
              border: `1.5px solid ${B.border}`, transition: "all 0.3s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${r.color}40`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = B.border; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: r.color, background: `${r.color}12`, padding: "4px 14px", borderRadius: 100 }}>{r.tag}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: B.navy }}>{r.paper}</span>
                <span style={{ fontSize: 12, color: B.muted, fontStyle: "italic" }}>{r.journal}</span>
              </div>
              <p style={{ fontSize: 15, color: B.sub, lineHeight: 1.8 }}>{r.finding}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ── */
function Pricing() {
  const { ref, visible } = useInView();
  return (
    <section id="pricing" style={{ padding: "100px 24px", background: B.bg }}>
      <div ref={ref} style={{ maxWidth: 1000, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="PRICING" title="シンプルな料金プラン" subtitle="まずは無料で体験。納得してからアップグレード。" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          {[
            {
              name: "Free", price: "¥0", period: "永久無料",
              desc: "まずは体験してみたい方に",
              features: ["1日3セッション", "基本キャラクター1体", "5軸スコアリング", "音声入力対応", "全入力形式対応"],
              cta: "無料で始める", ctaStyle: { background: "#fff", color: B.navy, border: `2px solid ${B.border}` },
              highlight: false,
            },
            {
              name: "Pro", price: "¥980", period: "/月",
              desc: "本気で学びたい方に",
              features: ["無制限セッション", "全4キャラクター解放", "詳細アナリティクス", "知識グラフ可視化", "忘却曲線リマインド", "優先サポート"],
              cta: "Proを始める", ctaStyle: { background: B.gradientPrimary, color: "#fff" },
              highlight: true, badge: "人気",
            },
            {
              name: "Team", price: "¥4,980", period: "/月",
              desc: "教育機関・企業向け",
              features: ["50名まで利用可能", "管理ダッシュボード", "チーム分析レポート", "カスタムキャラクター", "API / MCP 連携", "専任サポート"],
              cta: "お問い合わせ", ctaStyle: { background: "#fff", color: B.navy, border: `2px solid ${B.border}` },
              highlight: false,
            },
          ].map(plan => (
            <div key={plan.name} style={{
              background: "#fff", borderRadius: 24, padding: "2.5rem 2rem",
              border: plan.highlight ? `2px solid ${B.accent}` : `1.5px solid ${B.border}`,
              position: "relative", transition: "all 0.3s",
              boxShadow: plan.highlight ? `0 8px 40px ${B.accent}15` : "none",
            }}>
              {plan.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: B.gradientAccent, color: "#fff",
                  padding: "4px 16px", borderRadius: 100,
                  fontSize: 12, fontWeight: 800,
                }}>{plan.badge}</div>
              )}
              <div style={{ fontSize: 14, fontWeight: 700, color: B.accent, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: B.navy }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: B.muted }}>{plan.period}</span>
              </div>
              <p style={{ fontSize: 14, color: B.sub, marginBottom: "1.5rem" }}>{plan.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "2rem" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: B.text }}>
                    <span style={{ color: B.green, fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <Link href="/" style={{
                display: "block", textAlign: "center",
                padding: "14px 24px", borderRadius: 12,
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                transition: "all 0.2s",
                ...plan.ctaStyle,
              }}>{plan.cta}</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ── */
function Testimonials() {
  const { ref, visible } = useInView();
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 1000, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="TESTIMONIALS" title="ユーザーの声" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {[
            { emoji: "👩‍🎓", name: "田中さん", role: "大学3年生・生物学専攻", text: "YouTubeで見た授業の内容をAIに教えたら、自分が何を理解していないか一発でわかりました。テスト前の復習が劇的に変わった。5軸のスコアで弱点が具体的にわかるのが良い。", score: "92" },
            { emoji: "👨‍💻", name: "佐藤さん", role: "バックエンドエンジニア", text: "技術書を読んだ後にteachAIで説明するのが習慣に。インプットだけでは身につかない深い理解が得られます。ミオが成長していくのが嬉しくて続けてしまう。", score: "88" },
            { emoji: "👩‍🏫", name: "山田先生", role: "高校教師・数学", text: "生徒30名にteachAIを導入。自発的に学習する姿勢が明らかに変わりました。教える楽しさを知ったようです。Team版で生徒の理解度が一目でわかるのも助かります。", score: "95" },
          ].map(t => (
            <div key={t.name} style={{
              background: B.bg, borderRadius: 20, padding: "2rem",
              border: `1.5px solid ${B.border}`,
            }}>
              <div style={{ fontSize: 15, color: B.text, lineHeight: 1.8, marginBottom: "1.25rem" }}>
                &ldquo;{t.text}&rdquo;
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", background: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                    border: `1px solid ${B.border}`,
                  }}>{t.emoji}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: B.navy }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: B.muted }}>{t.role}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: B.green }}>{t.score}</div>
                  <div style={{ fontSize: 10, color: B.muted }}>最高スコア</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Comparison ── */
function Comparison() {
  const { ref, visible } = useInView();
  const rows = [
    { topic: "学習方法", old: "講義を聞く・ノートを取る", new: "AIキャラクターに自分の言葉で教える" },
    { topic: "理解の確認", old: "テストまでわからない", new: "教えた瞬間にギャップが判明" },
    { topic: "記憶定着率", old: "5〜20%", new: "最大90%（教えることで定着）" },
    { topic: "フィードバック", old: "成績表のみ（遅延）", new: "リアルタイム5軸スコアリング" },
    { topic: "モチベーション", old: "義務感・プレッシャー", new: "キャラが成長する達成感" },
    { topic: "復習タイミング", old: "自己判断・忘れがち", new: "忘却曲線に基づく自動提案" },
  ];
  return (
    <section style={{ padding: "100px 24px", background: B.bg }}>
      <div ref={ref} style={{ maxWidth: 900, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="COMPARISON" title="従来の学習 vs teachAI" />
        <div style={{ overflowX: "auto", borderRadius: 20, border: `1.5px solid ${B.border}`, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 13, color: B.muted, fontWeight: 600, borderBottom: `2px solid ${B.border}`, background: B.bg }} />
                <th style={{ padding: "16px 20px", textAlign: "center", fontSize: 13, color: B.muted, fontWeight: 700, borderBottom: `2px solid ${B.border}`, background: B.bg, minWidth: 180 }}>従来の学習</th>
                <th style={{ padding: "16px 20px", textAlign: "center", fontSize: 13, fontWeight: 800, borderBottom: `2px solid ${B.accent}`, minWidth: 200, color: B.accent, background: `${B.accent}06` }}>
                  teachAI
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: B.navy, borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>{r.topic}</td>
                  <td style={{ padding: "14px 20px", textAlign: "center", color: B.muted, borderBottom: `1px solid ${B.border}` }}>{r.old}</td>
                  <td style={{ padding: "14px 20px", textAlign: "center", color: B.text, fontWeight: 600, borderBottom: `1px solid ${B.border}`, background: `${B.accent}03` }}>{r.new}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ── */
function FAQSection() {
  const { ref, visible } = useInView();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const faqs = [
    { q: "無料で使えますか？", a: "はい、Freeプランで今すぐお使いいただけます。1日3セッションまで無料。自分のAPIキーを設定すると、さらに柔軟にご利用いただけます。" },
    { q: "どんな教材に対応していますか？", a: "テキスト入力、YouTube動画、Webサイト、PDF、Word(DOCX)、Excel(XLSX)、PowerPoint(PPTX)、画像(JPG/PNG)の8種類に対応しています。" },
    { q: "AIプロテジェとは何ですか？", a: "あなたが教える相手となるAIキャラクターです。ミオ・ソラ・ハル・リンなど個性的なキャラクターを選べます。教えるほど成長し、学習継続のモチベーションになります。" },
    { q: "スコアリングの仕組みは？", a: "SOLO Taxonomy（学習成果の構造）に基づく5軸評価です。網羅性・深さ・明晰さ・論理構造・教育的洞察の各項目を1-5で評価し、AIが詳細なフィードバックを提供します。" },
    { q: "音声入力はできますか？", a: "はい。マイクボタンを押しながら音声でAIに教えられます。AIの回答も全文読み上げ対応で、ハンズフリー学習が可能です。" },
    { q: "教育機関や企業向けプランはありますか？", a: "はい。Teamプラン（月額¥4,980）で最大50名が利用できます。管理ダッシュボード、チーム分析レポート、カスタムキャラクター作成などの機能が含まれます。" },
  ];
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div ref={ref} style={{ maxWidth: 700, margin: "0 auto", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease" }}>
        <SectionHeader badge="FAQ" title="よくある質問" />
        <div style={{ borderRadius: 20, border: `1.5px solid ${B.border}`, overflow: "hidden" }}>
          {faqs.map((f, i) => (
            <div key={i} style={{
              borderBottom: i < faqs.length - 1 ? `1px solid ${B.border}` : "none",
              cursor: "pointer", padding: "1.25rem 1.5rem",
              background: openIdx === i ? B.bg : "#fff",
              transition: "background 0.2s",
            }} onClick={() => setOpenIdx(openIdx === i ? null : i)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: B.navy }}>{f.q}</span>
                <span style={{
                  fontSize: 20, color: B.muted, transition: "transform 0.3s",
                  transform: openIdx === i ? "rotate(45deg)" : "rotate(0deg)",
                  flexShrink: 0, marginLeft: 12,
                }}>+</span>
              </div>
              {openIdx === i && (
                <p style={{ fontSize: 14, color: B.sub, lineHeight: 1.8, marginTop: "0.75rem", paddingRight: "2rem" }}>{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA ── */
function CTASection() {
  return (
    <section style={{
      padding: "120px 24px", textAlign: "center",
      background: B.gradientPrimary, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 56, marginBottom: "1rem" }}>👧</div>
        <h2 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 900, color: "#fff", marginBottom: "1rem", lineHeight: 1.2 }}>
          今すぐ、教えて学ぶ体験を
        </h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", maxWidth: 500, margin: "0 auto 2.5rem", lineHeight: 1.8 }}>
          APIキーなしでも無料で体験可能。<br />
          あなたの「教える力」を、スコアで見てみませんか？
        </p>
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "18px 48px", borderRadius: 14,
          background: "#fff", color: B.navy,
          fontSize: 18, fontWeight: 800, textDecoration: "none",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          transition: "transform 0.2s",
        }}>
          無料で始める
          <span style={{ fontSize: 20 }}>→</span>
        </Link>
        <div style={{ marginTop: "1.5rem", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          30秒で開始 · クレジットカード不要
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer style={{ background: B.navy, padding: "60px 24px 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "2rem", marginBottom: "3rem" }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
              teach<span style={{ color: B.accent }}>AI</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 280 }}>
              認知科学に基づく「教えて学ぶ」AIプラットフォーム。
              学習効率を18倍にする次世代のEdTech。
            </p>
          </div>
          <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
            {[
              { title: "プロダクト", links: [{ label: "アプリ", href: "/" }, { label: "API", href: "/api/docs" }, { label: "ダッシュボード", href: "/dashboard" }] },
              { title: "アカウント", links: [{ label: "ログイン", href: "/auth/login" }, { label: "新規登録", href: "/auth/signup" }] },
              { title: "リソース", links: [{ label: "使い方", href: "#how" }, { label: "料金", href: "#pricing" }, { label: "FAQ", href: "#faq" }] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 12 }}>{col.title}</div>
                {col.links.map(l => (
                  l.href.startsWith("#") ? (
                    <a key={l.label} href={l.href} style={{ display: "block", fontSize: 14, color: "rgba(255,255,255,0.6)", textDecoration: "none", marginBottom: 8, transition: "color 0.2s" }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.color = "#fff"; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
                    >{l.label}</a>
                  ) : (
                    <Link key={l.label} href={l.href} style={{ display: "block", fontSize: 14, color: "rgba(255,255,255,0.6)", textDecoration: "none", marginBottom: 8, transition: "color 0.2s" }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.color = "#fff"; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
                    >{l.label}</Link>
                  )
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>&copy; 2026 teachAI. All rights reserved.</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Made with cognitive science & AI</div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════ */
export default function LandingClient() {
  const [authUser, setAuthUser] = useState<string | null>(null);

  useEffect(() => {
    // 認証状態を確認してナビを動的に切り替え
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setAuthUser(user.user_metadata?.full_name || user.email || "");
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  return (
    <div style={{ fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflowX: "hidden", WebkitFontSmoothing: "antialiased" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
        @media (max-width: 768px) { .hide-mobile { display: none; } }
      `}</style>

      {/* ── Fixed Nav (認証対応) ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
      }}>
        <Link href="/" style={{ textDecoration: "none", fontSize: 20, fontWeight: 900, color: B.navy, letterSpacing: "-0.5px" }}>
          teach<span style={{ color: B.accent }}>AI</span>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="#pricing" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: B.sub, textDecoration: "none" }}>料金</a>
          {authUser ? (
            <>
              <Link href="/dashboard" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: B.sub, textDecoration: "none" }}>ダッシュボード</Link>
              <Link href="/" style={{
                padding: "10px 22px", fontSize: 13, fontWeight: 700,
                color: "#fff", textDecoration: "none", borderRadius: 10,
                background: B.gradientPrimary, boxShadow: "0 2px 8px rgba(10,35,66,0.15)",
              }}>AIに教える</Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: B.sub, textDecoration: "none" }}>ログイン</Link>
              <Link href="/" style={{
                padding: "10px 22px", fontSize: 13, fontWeight: 700,
                color: "#fff", textDecoration: "none", borderRadius: 10,
                background: B.gradientPrimary, boxShadow: "0 2px 8px rgba(10,35,66,0.15)",
              }}>無料で始める</Link>
            </>
          )}
        </div>
      </nav>

      <Hero />
      <ProblemSection />
      <DemoSection />
      <HowItWorks />
      <Features />
      <Characters />
      <Comparison />
      <MarketOpportunity />
      <Science />
      <Pricing />
      <Testimonials />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
