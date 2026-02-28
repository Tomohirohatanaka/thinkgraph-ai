"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginFormInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    authError === "auth_callback_failed" ? "認証に失敗しました。もう一度お試しください。" : null
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "メールアドレスまたはパスワードが正しくありません"
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Arial, sans-serif", padding: 20,
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: "40px 44px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: "#0A2342", borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px", fontSize: 28,
          }}>🧠</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0A2342" }}>
            ThinkGraph AI
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: 14 }}>
            アカウントにログイン
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#FEE2E2", border: "1px solid #FECACA",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            fontSize: 13, color: "#DC2626",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%", padding: "12px 20px", border: "2px solid #E5E7EB",
            borderRadius: 12, background: "white", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 20,
            transition: "border-color 0.2s",
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
          Googleでログイン
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>または</span>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
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

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>パスワード</label>
              <a
                href="/auth/reset-password"
                style={{ fontSize: 12, color: "#1A6B72", textDecoration: "none", fontWeight: 500 }}
              >
                パスワードを忘れた方
              </a>
            </div>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
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
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#6B7280" }}>
          アカウントをお持ちでない方は{" "}
          <a
            href={`/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
            style={{ color: "#1A6B72", fontWeight: 600, textDecoration: "none" }}
          >
            新規登録
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)" }} />
    }>
      <LoginFormInner />
    </Suspense>
  );
}
