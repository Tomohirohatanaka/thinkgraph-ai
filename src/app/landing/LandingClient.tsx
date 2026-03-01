"use client";

import { useState, useEffect } from "react";

// ─── Animated counter ──────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1800;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <>{count}{suffix}</>;
}

// ─── Feature card ──────────────────────────────────────────────
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

// ─── Step card ─────────────────────────────────────────────────
function Step({ num, icon, title, desc }: { num: number; icon: string; title: string; desc: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1, minWidth: 200 }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", margin: "0 auto 1rem",
        background: "linear-gradient(135deg, #0A2342, #1A6B72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, color: "#fff", position: "relative",
      }}>
        {icon}
        <span style={{
          position: "absolute", top: -4, right: -4,
          width: 22, height: 22, borderRadius: "50%",
          background: "#FF6B6B", color: "#fff",
          fontSize: 11, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{num}</span>
      </div>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: "#222", marginBottom: "0.3rem" }}>{title}</h4>
      <p style={{ fontSize: 13, color: "#999", lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

// ─── Testimonial ───────────────────────────────────────────────
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

// ─── FAQ ───────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
//  LANDING PAGE
// ═══════════════════════════════════════════════════════════════
export default function LandingClient() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div style={{ fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
      }}>
        <a href="/" style={{ textDecoration: "none", fontSize: 18, fontWeight: 900, color: "#0A2342", letterSpacing: "-0.5px" }}>
          teach<span style={{ color: "#1A6B72" }}>AI</span>
        </a>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/auth/login" style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600,
            color: "#555", textDecoration: "none", borderRadius: 10,
          }}>ログイン</a>
          <a href="/" style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 700,
            color: "#fff", textDecoration: "none", borderRadius: 10,
            background: "linear-gradient(135deg, #0A2342, #1A6B72)",
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
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: "10%", left: "5%", width: 300, height: 300,
          borderRadius: "50%", background: "radial-gradient(circle, #1A6B7208, transparent)",
          filter: "blur(40px)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "20%", right: "10%", width: 250, height: 250,
          borderRadius: "50%", background: "radial-gradient(circle, #FF6B6B08, transparent)",
          filter: "blur(40px)", pointerEvents: "none",
        }} />

        <div style={{
          opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 100,
            background: "#f0fffe", border: "1px solid #1A6B7225",
            fontSize: 13, color: "#1A6B72", fontWeight: 600,
            marginBottom: "1.5rem",
          }}>
            <span style={{ fontSize: 14 }}>🎓</span>
            学術論文に基づく学習メソッド
          </div>

          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900,
            color: "#0A2342", lineHeight: 1.15, letterSpacing: "-1px",
            marginBottom: "1.25rem", maxWidth: 720,
          }}>
            AIに<span style={{ color: "#1A6B72" }}>教えて</span>、<br/>
            最速で<span style={{ color: "#FF6B6B" }}>学ぶ</span>
          </h1>

          <p style={{
            fontSize: "clamp(16px, 2vw, 20px)", color: "#777",
            maxWidth: 560, margin: "0 auto", lineHeight: 1.7,
            marginBottom: "2rem",
          }}>
            YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、
            理解度を定量化。<strong style={{ color: "#555" }}>記憶定着率が2.5倍</strong>になる
            ピアチュータリング手法を、誰でも。
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 14,
              background: "linear-gradient(135deg, #0A2342, #1A6B72)",
              color: "#fff", fontSize: 16, fontWeight: 700,
              textDecoration: "none", transition: "all 0.2s",
              boxShadow: "0 4px 20px rgba(10,35,66,0.25)",
            }}>
              ✨ 無料で始める
            </a>
            <a href="#how" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: 14,
              background: "#fff", color: "#555", fontSize: 15, fontWeight: 600,
              textDecoration: "none", border: "1.5px solid #eee",
            }}>
              使い方を見る ↓
            </a>
          </div>

          {/* Social proof */}
          <div style={{
            marginTop: "2.5rem", display: "flex", alignItems: "center",
            justifyContent: "center", gap: "2rem", flexWrap: "wrap",
          }}>
            {[
              { icon: "📚", value: 1200, suffix: "+", label: "学習セッション" },
              { icon: "⭐", value: 4.8, suffix: "", label: "平均満足度" },
              { icon: "🧠", value: 96, suffix: "%", label: "理解度向上" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#bbb", marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0A2342" }}>
                  {typeof s.value === "number" && s.value > 10
                    ? <Counter target={s.value} suffix={s.suffix} />
                    : <>{s.value}{s.suffix}</>}
                </div>
                <div style={{ fontSize: 11, color: "#bbb" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported formats ── */}
      <section style={{
        padding: "40px 24px", background: "#fafbfc",
        display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap",
      }}>
        {["YouTube", "Web", "PDF", "DOCX", "PPTX", "画像"].map(f => (
          <div key={f} style={{
            padding: "8px 20px", borderRadius: 100,
            background: "#fff", border: "1px solid #eee",
            fontSize: 13, fontWeight: 600, color: "#888",
          }}>{f}</div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{
        padding: "80px 24px", maxWidth: 900, margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: 13, color: "#1A6B72", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: "#0A2342" }}>3ステップで学習開始</h2>
        </div>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Step num={1} icon="📄" title="教材を読み込む" desc="YouTube URL、PDF、Webページを貼り付けるだけ。AIが自動で内容を分析します。" />
          <Step num={2} icon="🗣️" title="AIに教える" desc="AIキャラクターからの質問に答えて、学んだ内容を自分の言葉で説明します。" />
          <Step num={3} icon="📊" title="理解度を可視化" desc="5つの軸で理解度をスコア化。弱点と強みが一目でわかります。" />
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{
        padding: "80px 24px", background: "#fafbfc",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: 13, color: "#1A6B72", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>FEATURES</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: "#0A2342" }}>なぜteachAIで学ぶのか</h2>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}>
            <Feature icon="🧠" title="教えて学ぶ効果" desc="「教える」行為は受動的な学習の2.5倍の定着率。認知科学に基づくアクティブラーニング。" color="#1A6B72" />
            <Feature icon="🎭" title="AIキャラクター" desc="個性的なAIキャラクターがあなたの学習パートナーに。一緒に成長し、絆を深めます。" color="#FF6B6B" />
            <Feature icon="📊" title="5軸スコアリング" desc="SOLO Taxonomy に基づく学術的評価。網羅性・深さ・明晰さ・論理構造・教育的洞察。" color="#4ECDC4" />
            <Feature icon="🔄" title="適応型質問" desc="RQSベースの6段階質問ステートマシン。あなたの回答品質に合わせて質問が変化。" color="#45B7D1" />
            <Feature icon="🗺️" title="知識グラフ" desc="学んだ概念の繋がりを可視化。忘却曲線に基づく復習タイミングも提案。" color="#8E44AD" />
            <Feature icon="🤖" title="4社のAI対応" desc="Claude・GPT・Gemini・Bedrockに対応。好みのAIプロバイダーで学習できます。" color="#E67E22" />
          </div>
        </div>
      </section>

      {/* ── Science section ── */}
      <section style={{
        padding: "80px 24px", maxWidth: 800, margin: "0 auto", textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: "#1A6B72", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>THE SCIENCE</div>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: "#0A2342", marginBottom: "1.5rem" }}>学術論文に裏付けられた手法</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
          {[
            { paper: "Roscoe & Chi (2007)", finding: "ピアチュータリングにおいてKnowledge-Building（知識構築型）の説明は、Knowledge-Telling（知識伝達型）より有意に学習効果が高い", tag: "Learning by Teaching" },
            { paper: "Biggs & Collis (1982)", finding: "SOLO Taxonomy（Structure of Observed Learning Outcome）は学習成果の深さを5段階で客観的に評価できる", tag: "Assessment" },
            { paper: "Ebbinghaus Forgetting Curve", finding: "間隔反復学習により記憶定着率が最大2.5倍向上。最適な復習タイミングを知識グラフから自動算出", tag: "Retention" },
          ].map(r => (
            <div key={r.paper} style={{
              background: "#f8fbff", borderRadius: 16, padding: "1.25rem 1.5rem",
              border: "1px solid #e8f0fe",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.4rem" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1A6B72", background: "#e0f7fa", padding: "2px 10px", borderRadius: 100 }}>{r.tag}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#aaa" }}>{r.paper}</span>
              </div>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>{r.finding}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{
        padding: "80px 24px", background: "#fafbfc",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: 13, color: "#1A6B72", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>TESTIMONIALS</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: "#0A2342" }}>ユーザーの声</h2>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Testimonial emoji="👩‍🎓" name="田中さん" role="大学3年生" text="YouTubeで見た授業の内容をAIに教えたら、自分が何を理解していないか一発でわかりました。テスト前の復習が劇的に変わった！" />
            <Testimonial emoji="👨‍💻" name="佐藤さん" role="エンジニア" text="技術書を読んだ後にteachAIで説明するのが習慣に。アウトプットすることで、読んだだけでは身につかない深い理解が得られます。" />
            <Testimonial emoji="👩‍🏫" name="山田先生" role="高校教師" text="生徒にteachAIを使わせたところ、自発的に学習する姿勢が明らかに変わりました。教える楽しさを知ったようです。" />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{
        padding: "80px 24px", maxWidth: 700, margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: 13, color: "#1A6B72", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>FAQ</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: "#0A2342" }}>よくある質問</h2>
        </div>
        <FAQ q="無料で使えますか？" a="はい、無料でお使いいただけます。APIキー（Claude、GPT、Gemini、Bedrockのいずれか）をご自身でご用意ください。AI利用料はご自身のAPIアカウントに課金されます。" />
        <FAQ q="どんな教材に対応していますか？" a="YouTube動画、Webサイト、PDF、Word(DOCX)、Excel(XLSX)、PowerPoint(PPTX)、テキストファイル、画像(JPG/PNG)に対応しています。URLを貼り付けるだけで自動的に内容を解析します。" />
        <FAQ q="AIキャラクターとは何ですか？" a="あなたの学習パートナーとなるAIキャラクターです。それぞれ個性的な性格と口調を持ち、学習セッションを重ねるごとに一緒に成長します。" />
        <FAQ q="スコアリングの仕組みは？" a="SOLO Taxonomy（学習成果の構造）に基づく5軸評価です。網羅性・深さ・明晰さ・論理構造・教育的洞察の各項目を1-5で評価し、AIが詳細なフィードバックを提供します。" />
        <FAQ q="データはどこに保存されますか？" a="学習履歴はブラウザのローカルストレージに保存されます。アカウント登録すると、クラウド（Supabase）にバックアップされ、デバイス間で同期できます。" />
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "80px 24px", textAlign: "center",
        background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
      }}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#fff", marginBottom: "1rem" }}>
          今日から、教えて学ぼう
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", maxWidth: 480, margin: "0 auto 2rem", lineHeight: 1.7 }}>
          アカウント不要で今すぐ始められます。<br />
          あなたのAPIキーだけで、最先端の学習体験を。
        </p>
        <a href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "16px 40px", borderRadius: 14,
          background: "#fff", color: "#0A2342",
          fontSize: 17, fontWeight: 800,
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          transition: "transform 0.2s",
        }}>
          ✨ 無料で始める
        </a>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding: "40px 24px", background: "#0A2342",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "1rem",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
          teach<span style={{ color: "#1A6B72" }}>AI</span>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          <a href="/api/docs" style={{ color: "inherit", textDecoration: "none" }}>API</a>
          <a href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>ログイン</a>
          <a href="/auth/signup" style={{ color: "inherit", textDecoration: "none" }}>新規登録</a>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          &copy; 2025 teachAI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
