"use client";

import { useState, useEffect, useRef } from "react";

const BRAND = { primary: "#0A2342", accent: "#FF6B9D", teal: "#1A6B72", green: "#00C9A7" };

const CTA_STYLE = {
  display: "inline-flex" as const, alignItems: "center" as const, gap: 8,
  padding: "16px 36px", borderRadius: 14,
  background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.teal})`,
  color: "#fff", fontSize: 16, fontWeight: 700,
  textDecoration: "none" as const, transition: "all 0.2s",
  boxShadow: "0 4px 20px rgba(10,35,66,0.25)",
};

function Feature({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "2rem 1.5rem",
      border: "1.5px solid #f0f0f0", transition: "all 0.3s",
      cursor: "default",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.08)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 16, display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 28,
        background: `${color}12`, marginBottom: "1rem",
      }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#222", marginBottom: "0.5rem" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#777", lineHeight: 1.7 }}>{desc}</p>
    </div>
  );
}

function Step({ num, icon, title, desc }: { num: number; icon: string; title: string; desc: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1, minWidth: 200 }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%", margin: "0 auto 1rem",
        background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.teal})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32, color: "#fff", position: "relative",
        boxShadow: "0 8px 24px rgba(10,35,66,0.2)",
      }}>
        {icon}
        <span style={{
          position: "absolute", top: -4, right: -4,
          width: 24, height: 24, borderRadius: "50%",
          background: BRAND.accent, color: "#fff",
          fontSize: 12, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{num}</span>
      </div>
      <h4 style={{ fontSize: 17, fontWeight: 700, color: "#222", marginBottom: "0.4rem" }}>{title}</h4>
      <p style={{ fontSize: 13, color: "#999", lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

function Testimonial({ name, role, text, emoji }: { name: string; role: string; text: string; emoji: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "1.5rem",
      border: "1.5px solid #f0f0f0", flex: 1, minWidth: 260,
    }}>
      <div style={{ fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: "1rem", fontStyle: "italic" }}>
        &ldquo;{text}&rdquo;
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", background: "#f5f5f5",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{emoji}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{name}</div>
          <div style={{ fontSize: 11, color: "#bbb" }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderBottom: "1px solid #f0f0f0", padding: "1rem 0", cursor: "pointer",
    }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#222" }}>{q}</span>
        <span style={{ fontSize: 18, color: "#bbb", transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "" }}>+</span>
      </div>
      {open && (
        <p style={{ fontSize: 14, color: "#777", lineHeight: 1.7, marginTop: "0.75rem", paddingRight: "2rem" }}>{a}</p>
      )}
    </div>
  );
}

/* ── Animated Demo Section ── */
const DEMO_MESSAGES = [
  { role: "ai" as const, text: "光合成について教えてくれるの？ わーい！ まず、光合成ってそもそも何なのか、一言で教えて！" },
  { role: "user" as const, text: "光合成は、植物が太陽の光エネルギーを使って、水とCO2から糖を作り出す化学反応だよ" },
  { role: "ai" as const, text: "すごい！ じゃあ、その反応はどこで起きてるの？ 植物の体のどの部分？" },
  { role: "user" as const, text: "葉っぱの中にある葉緑体っていう小さな器官の中で起きるんだ。チラコイドとストロマっていう構造があってね..." },
  { role: "ai" as const, text: "チラコイド！ ストロマ！ なんかかっこいい名前！ それぞれどんな役割があるの？ もっと詳しく教えて！" },
];

function AnimatedDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visibleCount >= DEMO_MESSAGES.length) {
      // Reset after a pause
      const resetTimer = setTimeout(() => {
        setVisibleCount(0);
        setTypingText("");
      }, 4000);
      return () => clearTimeout(resetTimer);
    }

    const msg = DEMO_MESSAGES[visibleCount];
    setIsTyping(true);
    setTypingText("");

    let charIdx = 0;
    const delay = visibleCount === 0 ? 800 : 1200;

    const startTimer = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        charIdx++;
        if (charIdx <= msg.text.length) {
          setTypingText(msg.text.slice(0, charIdx));
        } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsTyping(false);
          setTimeout(() => setVisibleCount(c => c + 1), 600);
        }
      }, 30);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visibleCount]);

  return (
    <div style={{
      background: "#fff", borderRadius: 24, padding: "2rem",
      border: "1.5px solid #f0f0f0",
      boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
      maxWidth: 640, margin: "0 auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${BRAND.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👧</div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#222" }}>ミオ</div>
          <div style={{ fontSize: 12, color: BRAND.accent }}>あなたのプロテジェ（教え相手）</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: BRAND.green, animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, color: BRAND.green, fontWeight: 600 }}>LIVE</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 280 }}>
        {DEMO_MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <div key={i} style={{
            background: msg.role === "ai" ? "#f8f8f8" : BRAND.accent,
            borderRadius: msg.role === "ai" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
            padding: "12px 16px", maxWidth: "85%",
            marginLeft: msg.role === "user" ? "auto" : undefined,
            fontSize: 14, color: msg.role === "ai" ? "#333" : "#fff", lineHeight: 1.6,
            animation: "fadeSlideIn 0.3s ease-out",
          }}>
            {msg.text}
          </div>
        ))}
        {isTyping && visibleCount < DEMO_MESSAGES.length && (
          <div style={{
            background: DEMO_MESSAGES[visibleCount].role === "ai" ? "#f8f8f8" : BRAND.accent,
            borderRadius: DEMO_MESSAGES[visibleCount].role === "ai" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
            padding: "12px 16px", maxWidth: "85%",
            marginLeft: DEMO_MESSAGES[visibleCount].role === "user" ? "auto" : undefined,
            fontSize: 14,
            color: DEMO_MESSAGES[visibleCount].role === "ai" ? "#333" : "#fff",
            lineHeight: 1.6,
          }}>
            {typingText}<span style={{ animation: "blink 0.8s infinite", fontWeight: 700 }}>|</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: "1rem", fontSize: 12, color: "#bbb", fontStyle: "italic", textAlign: "center" }}>
        AIに教えるほど、自分の理解が深まる
      </div>
    </div>
  );
}

/* ── Retention Bar Chart ── */
function RetentionChart() {
  const [animate, setAnimate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimate(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const data = [
    { label: "受動的学習（講義を聞く）", value: 5, color: "#ddd", textColor: "#999" },
    { label: "能動的学習（演習・議論）", value: 20, color: "#45B7D1", textColor: "#45B7D1" },
    { label: "人に教える", value: 90, color: BRAND.accent, textColor: BRAND.accent, highlight: true },
  ];

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {data.map(d => (
        <div key={d.label}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: d.highlight ? 800 : 500, color: d.highlight ? BRAND.primary : "#555" }}>
              {d.label}
              {d.highlight && <span style={{ fontSize: 11, marginLeft: 8, color: BRAND.accent, fontWeight: 700, background: `${BRAND.accent}15`, padding: "2px 8px", borderRadius: 100 }}>teachAI</span>}
            </span>
            <span style={{ fontSize: 20, fontWeight: 900, color: d.textColor }}>{d.value}%</span>
          </div>
          <div style={{ height: d.highlight ? 28 : 16, background: "#f0f0f0", borderRadius: 8, overflow: "hidden", position: "relative" }}>
            <div style={{
              height: "100%", borderRadius: 8,
              width: animate ? `${d.value}%` : "0%",
              background: d.highlight ? `linear-gradient(90deg, ${BRAND.accent}, ${BRAND.primary})` : d.color,
              transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: d.highlight ? "0.4s" : "0s",
              boxShadow: d.highlight ? `0 4px 16px ${BRAND.accent}40` : "none",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Comparison Table ── */
function ComparisonTable() {
  const rows = [
    { topic: "学習方法", traditional: "講義を聞く・ノートを取る", teachai: "AIキャラクターに自分の言葉で教える" },
    { topic: "理解の確認", traditional: "テストまでわからない", teachai: "教えた瞬間にギャップが判明" },
    { topic: "記憶定着率", traditional: "5〜20%", teachai: "最大90%（教えることで定着）" },
    { topic: "フィードバック", traditional: "成績表のみ（遅延）", teachai: "リアルタイムで5軸スコアリング" },
    { topic: "モチベーション", traditional: "義務感・プレッシャー", teachai: "キャラが成長する達成感" },
    { topic: "復習タイミング", traditional: "自己判断", teachai: "忘却曲線に基づく自動提案" },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#bbb", fontWeight: 600, borderBottom: "2px solid #f0f0f0" }}></th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#999", fontWeight: 700, borderBottom: "2px solid #f0f0f0", minWidth: 180 }}>従来の学習</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, fontWeight: 800, borderBottom: `2px solid ${BRAND.accent}`, minWidth: 200, color: BRAND.accent, background: `${BRAND.accent}08`, borderRadius: "8px 8px 0 0" }}>
              teachAIで教えて学ぶ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{ padding: "12px 16px", fontWeight: 700, color: BRAND.primary, borderBottom: "1px solid #f5f5f5", whiteSpace: "nowrap" }}>{row.topic}</td>
              <td style={{ padding: "12px 16px", textAlign: "center", color: "#999", borderBottom: "1px solid #f5f5f5" }}>{row.traditional}</td>
              <td style={{ padding: "12px 16px", textAlign: "center", color: "#333", fontWeight: 600, borderBottom: "1px solid #f5f5f5", background: `${BRAND.accent}05` }}>{row.teachai}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LandingClient() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div style={{ fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
      }}>
        <a href="/" style={{ textDecoration: "none", fontSize: 18, fontWeight: 900, color: BRAND.primary, letterSpacing: "-0.5px" }}>
          teach<span style={{ color: BRAND.accent }}>AI</span>
        </a>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/auth/login" style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600,
            color: "#555", textDecoration: "none", borderRadius: 10,
          }}>ログイン</a>
          <a href="/" style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 700,
            color: "#fff", textDecoration: "none", borderRadius: 10,
            background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.teal})`,
          }}>無料で始める</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "120px 24px 80px", textAlign: "center",
        background: "linear-gradient(180deg, #f8fbff 0%, #fff 50%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "10%", left: "5%", width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND.teal}08, transparent)`, filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "20%", right: "10%", width: 250, height: 250, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND.accent}08, transparent)`, filter: "blur(40px)", pointerEvents: "none" }} />

        <div style={{
          opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 100,
            background: `${BRAND.accent}12`, border: `1px solid ${BRAND.accent}25`,
            fontSize: 13, color: BRAND.accent, fontWeight: 600,
            marginBottom: "1.5rem",
          }}>
            <span>🎓</span> APIキーなしでもお試し可能
          </div>

          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900,
            color: BRAND.primary, lineHeight: 1.15, letterSpacing: "-1px",
            marginBottom: "1.25rem", maxWidth: 720,
          }}>
            AIに<span style={{ color: BRAND.accent }}>教えて</span>、<br />
            最速で<span style={{ color: BRAND.teal }}>理解</span>する
          </h1>

          <p style={{
            fontSize: "clamp(16px, 2vw, 20px)", color: "#777",
            maxWidth: 560, margin: "0 auto", lineHeight: 1.7,
            marginBottom: "2rem",
          }}>
            YouTube・PDF・テキストの内容を<br className="sp-only" />
            AIプロテジェ（教え相手）に<strong style={{ color: "#555" }}>教える</strong>ことで、
            理解度を定量化。<br />
            <strong style={{ color: BRAND.teal }}>記憶定着率が最大90%</strong>になる
            ピアチュータリング手法を、誰でも。
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/" style={CTA_STYLE}>
              今すぐAIに教えてみる
            </a>
            <a href="#how" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "16px 28px", borderRadius: 14,
              background: "#fff", color: "#555", fontSize: 15, fontWeight: 600,
              textDecoration: "none", border: "1.5px solid #eee",
            }}>
              使い方を見る ↓
            </a>
          </div>

          {/* Value props (replacing fake social proof) */}
          <div style={{
            marginTop: "3rem", display: "flex", alignItems: "stretch",
            justifyContent: "center", gap: "1.5rem", flexWrap: "wrap",
          }}>
            {[
              { icon: "🧠", title: "定着率90%", desc: "「教える」ことで受動的学習の18倍の記憶定着" },
              { icon: "📊", title: "5軸で即時評価", desc: "SOLO Taxonomyに基づく学術的スコアリング" },
              { icon: "🎙️", title: "音声対応", desc: "話して教える。AIの回答も全文読み上げ" },
              { icon: "🆓", title: "無料で体験可能", desc: "APIキーなしでもお試しセッションが可能" },
            ].map(v => (
              <div key={v.title} style={{
                textAlign: "center", maxWidth: 160, padding: "1rem",
                background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0",
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{v.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.primary, marginBottom: 4 }}>{v.title}</div>
                <div style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Animated Demo ── */}
      <section style={{ padding: "60px 24px 40px", background: "#fafbfc" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>LIVE DEMO</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: BRAND.primary }}>こんな風にAIに教えます</h2>
        </div>
        <AnimatedDemo />
      </section>

      {/* ── Supported formats ── */}
      <section style={{
        padding: "40px 24px", background: "#fafbfc",
        display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap",
      }}>
        {[
          { label: "テキスト入力", icon: "✏️" },
          { label: "YouTube", icon: "🎬" },
          { label: "Webサイト", icon: "🌐" },
          { label: "PDF", icon: "📄" },
          { label: "Word", icon: "📝" },
          { label: "Excel", icon: "📊" },
          { label: "PowerPoint", icon: "📎" },
          { label: "画像", icon: "🖼️" },
        ].map(f => (
          <div key={f.label} style={{
            padding: "8px 18px", borderRadius: 100,
            background: "#fff", border: "1px solid #eee",
            fontSize: 13, fontWeight: 600, color: "#888",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{f.icon}</span> {f.label}
          </div>
        ))}
      </section>

      {/* ── Retention Science (Visual Bars) ── */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>RESEARCH-BACKED</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary }}>研究に基づく効果</h2>
            <p style={{ fontSize: 14, color: "#888", marginTop: 8 }}>National Training Laboratories の学習ピラミッドに基づく記憶定着率</p>
          </div>
          <RetentionChart />
          <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: 13, color: "#bbb" }}>
            出典: National Training Laboratories, Bethel, Maine
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section style={{ padding: "80px 24px", background: "#fafbfc" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>COMPARISON</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary }}>従来の学習 vs teachAIで教えて学ぶ</h2>
          </div>
          <ComparisonTable />
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ padding: "80px 24px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary }}>3ステップで「教えて学ぶ」</h2>
        </div>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Step num={1} icon="✏️" title="教えたいことを入力" desc="テキストを直接入力するか、YouTube URL・PDF・Webページを貼り付け。AIが自動で内容を分析します。" />
          <Step num={2} icon="🗣️" title="AIプロテジェに教える" desc="AIプロテジェが質問してくるので、自分の言葉で教えてあげましょう。音声でもテキストでもOK。" />
          <Step num={3} icon="📊" title="教える力をスコア化" desc="5つの軸であなたの「教える力」をスコア化。弱点と強みが一目でわかります。" />
        </div>
      </section>

      {/* ── Character Showcase ── */}
      <section style={{ padding: "80px 24px", background: "#fafbfc" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>AI CHARACTERS</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary }}>あなただけのプロテジェ（教え相手）</h2>
            <p style={{ fontSize: 15, color: "#888", marginTop: 8 }}>教えれば教えるほど、キャラクターも一緒に成長します</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.25rem" }}>
            {[
              { emoji: "👧", name: "ミオ", trait: "元気で好奇心旺盛", color: "#FF6B9D", stage: "出会ったばかり → かけがえのない存在" },
              { emoji: "👦", name: "ソラ", trait: "冷静で論理的", color: "#45B7D1", stage: "理論派の友達 → 知の伴走者" },
              { emoji: "🧑", name: "ハル", trait: "優しくて丁寧", color: "#4ECDC4", stage: "穏やかな生徒 → 信頼の絆" },
              { emoji: "👩", name: "リン", trait: "クールで知的", color: "#8E44AD", stage: "ミステリアス → 心を開く" },
            ].map(c => (
              <div key={c.name} style={{
                background: "#fff", borderRadius: 20, padding: "1.5rem", textAlign: "center",
                border: "1.5px solid #f0f0f0", transition: "all 0.3s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>{c.emoji}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#222" }}>{c.name}</div>
                <div style={{ fontSize: 13, color: c.color, fontWeight: 600, marginBottom: 8 }}>{c.trait}</div>
                <div style={{ fontSize: 11, color: "#bbb", lineHeight: 1.5 }}>{c.stage}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>FEATURES</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary }}>なぜ「教えて学ぶ」が最強なのか</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            <Feature icon="🧠" title="教えて学ぶ効果" desc="「教える」行為は受動的な学習の18倍の定着率。認知科学に基づくアクティブラーニング手法。" color={BRAND.teal} />
            <Feature icon="👧" title="成長するプロテジェ" desc="教えれば教えるほど成長するAIプロテジェ。5段階の成長ステージで絆を深めましょう。" color={BRAND.accent} />
            <Feature icon="📊" title="SOLO 5軸スコアリング" desc="SOLO Taxonomy に基づく学術的評価。網羅性・深さ・明晰さ・論理構造・教育的洞察。" color="#4ECDC4" />
            <Feature icon="🎙️" title="音声で教える" desc="マイクボタンを押しながら話すだけ。ハンズフリーでAIに教えられます。AIの回答も全文読み上げ。" color="#45B7D1" />
            <Feature icon="🗺️" title="スキルマップ & 知識グラフ" desc="教えた概念の繋がりを可視化。忘却曲線に基づく復習タイミングも自動提案。" color="#8E44AD" />
            <Feature icon="🔌" title="API & MCP対応" desc="すべての機能をAPIとして利用可能。MCP対応で外部ツールとの連携もスムーズ。" color="#E67E22" />
          </div>
        </div>
      </section>

      {/* ── Science section ── */}
      <section style={{ padding: "80px 24px", background: "#fafbfc" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>THE SCIENCE</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary, marginBottom: "1.5rem" }}>学術論文に裏付けられた手法</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
            {[
              { paper: "Roscoe & Chi (2007)", finding: "ピアチュータリングにおいてKnowledge-Building（知識構築型）の説明は、Knowledge-Telling（知識伝達型）より有意に学習効果が高い", tag: "Learning by Teaching" },
              { paper: "Biggs & Collis (1982)", finding: "SOLO Taxonomy（Structure of Observed Learning Outcome）は学習成果の深さを5段階で客観的に評価できる", tag: "Assessment" },
              { paper: "Ebbinghaus Forgetting Curve", finding: "間隔反復学習により記憶定着率が最大2.5倍向上。最適な復習タイミングを知識グラフから自動算出", tag: "Retention" },
            ].map(r => (
              <div key={r.paper} style={{
                background: "#fff", borderRadius: 16, padding: "1.25rem 1.5rem",
                border: "1px solid #e8f0fe",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.teal, background: `${BRAND.teal}15`, padding: "2px 10px", borderRadius: 100 }}>{r.tag}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#aaa" }}>{r.paper}</span>
                </div>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>{r.finding}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>TESTIMONIALS</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary }}>ユーザーの声</h2>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Testimonial emoji="👩‍🎓" name="田中さん" role="大学3年生" text="YouTubeで見た授業の内容をAIに教えたら、自分が何を理解していないか一発でわかりました。テスト前の復習が劇的に変わった！" />
            <Testimonial emoji="👨‍💻" name="佐藤さん" role="エンジニア" text="技術書を読んだ後にteachAIで説明するのが習慣に。アウトプットすることで、読んだだけでは身につかない深い理解が得られます。" />
            <Testimonial emoji="👩‍🏫" name="山田先生" role="高校教師" text="生徒にteachAIを使わせたところ、自発的に学習する姿勢が明らかに変わりました。教える楽しさを知ったようです。" />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: "80px 24px", background: "#fafbfc" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontSize: 13, color: BRAND.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>FAQ</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: BRAND.primary }}>よくある質問</h2>
          </div>
          <FAQ q="無料で使えますか？" a="はい、お試しモードで今すぐ無料でお使いいただけます。自分のAPIキー（Claude、GPT、Gemini、Bedrockのいずれか）を設定すると、制限なくご利用可能です。" />
          <FAQ q="どんな教材に対応していますか？" a="テキスト入力（自由記述）、YouTube動画、Webサイト、PDF、Word(DOCX)、Excel(XLSX)、PowerPoint(PPTX)、テキストファイル、画像(JPG/PNG)に対応しています。" />
          <FAQ q="AIプロテジェとは何ですか？" a="あなたが教える相手となるAIキャラクターです。ミオ・ソラ・ハル・リンなど個性的な性格を持ち、教えるごとに成長します。愛着がわくほど、学習のモチベーションも上がります。" />
          <FAQ q="音声入力はできますか？" a="はい。マイクボタンを押している間、音声でAIに教えることができます。AIの回答も全文読み上げに対応しており、ハンズフリーで学習できます。" />
          <FAQ q="スコアリングの仕組みは？" a="SOLO Taxonomy（学習成果の構造）に基づく5軸評価です。網羅性・深さ・明晰さ・論理構造・教育的洞察の各項目を評価し、AIが詳細なフィードバックを提供します。" />
          <FAQ q="データはどこに保存されますか？" a="学習履歴はブラウザのローカルストレージに保存されます。アカウント登録すると、クラウドにバックアップされ、ダッシュボードで詳細な分析が見られます。" />
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "100px 24px", textAlign: "center",
        background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.teal} 100%)`,
      }}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, color: "#fff", marginBottom: "1rem" }}>
          今すぐAIに教えてみる
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", maxWidth: 480, margin: "0 auto 2rem", lineHeight: 1.7 }}>
          APIキーなしでもお試し可能。<br />
          今すぐ始めて、「教える」学習の効果を体験してください。
        </p>
        <a href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "16px 40px", borderRadius: 14,
          background: "#fff", color: BRAND.primary,
          fontSize: 17, fontWeight: 800,
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          transition: "transform 0.2s",
        }}>
          今すぐAIに教えてみる
        </a>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding: "40px 24px", background: BRAND.primary,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "1rem",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
          teach<span style={{ color: BRAND.accent }}>AI</span>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          <a href="/api/docs" style={{ color: "inherit", textDecoration: "none" }}>API</a>
          <a href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>ダッシュボード</a>
          <a href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>ログイン</a>
          <a href="/auth/signup" style={{ color: "inherit", textDecoration: "none" }}>新規登録</a>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          &copy; 2026 teachAI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
