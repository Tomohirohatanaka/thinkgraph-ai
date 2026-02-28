"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setError(error.message === "User already registered"
        ? "このメールアドレスはすでに登録されています"
        : error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Arial, sans-serif", padding: 20,
      }}>
        <div style={{ background: "white", borderRadius: 20, padding: "48px 44px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
          <h2 style={{ color: "#0A2342", margin: "0 0 12px" }}>確認メールを送信しました</h2>
          <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>
            <strong>{email}</strong> に確認メールを送りました。<br />
            メール内のリンクをクリックしてアカウントを有効化してください。
          </p>
          <a href="/auth/login" style={{
            display: "inline-block", marginTop: 24, padding: "12px 28px",
            background: "#0A2342", color: "white", borderRadius: 10, textDecoration: "none",
            fontSize: 14, fontWeight: 700,
          }}>ログインページへ</a>
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
        background: "white", borderRadius: 20, padding: "40px 44px", width: "100%", maxWidth: 420,
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: "#0A2342", borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px", fontSize: 28,
          }}>🧠</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0A2342" }}>アカウント作成</h1>
          <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: 14 }}>ThinkGraph AIに参加しよう</p>
        </div>

        {error && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          style={{
            width: "100%", padding: "12px 20px", border: "2px solid #E5E7EB",
            borderRadius: 12, background: "white", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 20,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#1A6B72")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Googleで登録
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>または</span>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
        </div>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>お名前</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="山田 太郎"
              style={{ width: "100%", padding: "11px 14px", border: "2px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#1A6B72")}
              onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              style={{ width: "100%", padding: "11px 14px", border: "2px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#1A6B72")}
              onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>パスワード（8文字以上）</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
              style={{ width: "100%", padding: "11px 14px", border: "2px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#1A6B72")}
              onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
            />
          </div>
          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "13px 20px", background: loading ? "#9CA3AF" : "#0A2342",
              color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
            {loading ? "処理中..." : "アカウントを作成"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#6B7280" }}>
          すでにアカウントをお持ちの方は{" "}
          <a href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            style={{ color: "#1A6B72", fontWeight: 600, textDecoration: "none" }}>ログイン</a>
        </p>
      </div>
    </div>
  );
}
