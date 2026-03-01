"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/auth-url";

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
        minHeight: "100vh", background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Arial, sans-serif", padding: 20,
      }}>
        <div style={{
          background: "white", borderRadius: 20, padding: "48px 44px",
          maxWidth: 420, width: "100%", textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
          <h2 style={{ color: "#0A2342", margin: "0 0 12px" }}>メールを送信しました</h2>
          <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>
            <strong>{email}</strong> にパスワードリセットのリンクを送りました。<br />
            メールをご確認ください。
          </p>
          <a href="/auth/login" style={{
            display: "inline-block", marginTop: 24, padding: "12px 28px",
            background: "#0A2342", color: "white", borderRadius: 10,
            textDecoration: "none", fontSize: 14, fontWeight: 700,
          }}>
            ログインページへ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Arial, sans-serif", padding: 20,
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: "40px 44px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: "#0A2342", borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px", fontSize: 28,
          }}>🔑</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0A2342" }}>
            パスワードリセット
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: 14 }}>
            登録済みのメールアドレスを入力してください
          </p>
        </div>

        {error && (
          <div style={{
            background: "#FEE2E2", border: "1px solid #FECACA",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            fontSize: 13, color: "#DC2626",
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleReset}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              メールアドレス
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="you@example.com"
              style={{
                width: "100%", padding: "11px 14px", border: "2px solid #E5E7EB",
                borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#1A6B72")}
              onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "13px 20px",
              background: loading ? "#9CA3AF" : "linear-gradient(135deg, #0A2342, #1A6B72)",
              color: "white", border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "送信中..." : "リセットメールを送信"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#6B7280" }}>
          <a href="/auth/login" style={{ color: "#1A6B72", fontWeight: 600, textDecoration: "none" }}>
            ← ログインページへ戻る
          </a>
        </p>
      </div>
    </div>
  );
}
