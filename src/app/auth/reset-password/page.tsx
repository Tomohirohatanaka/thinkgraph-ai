"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/auth-url";

const B = {
  navy: "#0A2342",
  accent: "#FF6B9D",
  teal: "#1A6B72",
  bg: "#FAFBFE",
  sub: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  gradientPrimary: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
};

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const baseUrl = getBaseUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/update-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F0F4FF 0%, #FAFBFE 40%, #fff 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 20,
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <div style={{
          background: "white", borderRadius: 24, padding: "48px 44px",
          maxWidth: 420, width: "100%", textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)", border: `1.5px solid ${B.border}`,
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
          <h2 style={{ color: B.navy, margin: "0 0 12px", fontWeight: 800 }}>メールを送信しました</h2>
          <p style={{ color: B.sub, fontSize: 14, lineHeight: 1.6 }}>
            <strong>{email}</strong> にパスワードリセットのリンクを送りました。<br />
            メールをご確認ください。
          </p>
          <a href="/auth/login" style={{
            display: "inline-block", marginTop: 24, padding: "14px 32px",
            background: B.gradientPrimary, color: "white", borderRadius: 14,
            textDecoration: "none", fontSize: 14, fontWeight: 700,
            boxShadow: "0 4px 16px rgba(10,35,66,0.2)",
          }}>ログインページへ戻る</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #F0F4FF 0%, #FAFBFE 40%, #fff 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
      }}>
        <a href="/landing" style={{ textDecoration: "none", fontSize: 20, fontWeight: 900, color: B.navy, letterSpacing: "-0.5px" }}>
          teach<span style={{ color: B.accent }}>AI</span>
        </a>
        <a href="/auth/login" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: B.sub, textDecoration: "none" }}>
          ログイン
        </a>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 20px 40px" }}>
        <div style={{
          background: "white", borderRadius: 24, padding: "44px 40px",
          width: "100%", maxWidth: 420,
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)", border: `1.5px solid ${B.border}`,
        }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: B.navy }}>
              パスワードリセット
            </h1>
            <p style={{ margin: 0, color: B.sub, fontSize: 14 }}>
              登録済みのメールアドレスを入力してください
            </p>
          </div>

          {error && (
            <div style={{
              background: "#FEE2E2", border: "1px solid #FECACA",
              borderRadius: 12, padding: "12px 16px", marginBottom: 20,
              fontSize: 13, color: "#DC2626",
            }}>{error}</div>
          )}

          <form onSubmit={handleReset}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                メールアドレス
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@example.com"
                style={{
                  width: "100%", padding: "12px 14px", border: `1.5px solid ${B.border}`,
                  borderRadius: 12, fontSize: 14, outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit", background: B.bg, transition: "border-color 0.2s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = B.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = B.border)}
              />
            </div>

            <button type="submit" disabled={loading}
              style={{
                width: "100%", padding: "14px 20px",
                background: loading ? B.muted : B.gradientPrimary,
                color: "white", border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 700, fontFamily: "inherit",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 16px rgba(10,35,66,0.2)",
              }}
            >{loading ? "送信中..." : "リセットメールを送信"}</button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: B.sub }}>
            <a href="/auth/login" style={{ color: B.teal, fontWeight: 600, textDecoration: "none" }}>
              ← ログインページへ戻る
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
