"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { getBaseUrl } from "@/lib/auth-url";

const B = {
  navy: "#0A2342",
  accent: "#FF6B9D",
  teal: "#1A6B72",
  green: "#00C9A7",
  bg: "#FAFBFE",
  sub: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  gradientPrimary: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
};

function SignupFormInner() {
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
  const [configured, setConfigured] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
    setTimeout(() => setVisible(true), 50);
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) {
      setError("認証サービスが設定されていません。管理者にお問い合わせください。");
      return;
    }
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください");
      setLoading(false);
      return;
    }

    try {
      const baseUrl = getBaseUrl();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
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
    } catch {
      setError("ネットワークエラーが発生しました。接続を確認してください。");
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!configured) {
      setError("認証サービスが設定されていません。管理者にお問い合わせください。");
      return;
    }
    setLoading(true);
    setError(null);

    const baseUrl = getBaseUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
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
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F0F4FF 0%, #FAFBFE 40%, #fff 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 20,
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <div style={{
          background: "white", borderRadius: 24, padding: "48px 44px", maxWidth: 420, width: "100%",
          textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.06)", border: `1.5px solid ${B.border}`,
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
          <h2 style={{ color: B.navy, margin: "0 0 12px", fontWeight: 800 }}>確認メールを送信しました</h2>
          <p style={{ color: B.sub, fontSize: 14, lineHeight: 1.6 }}>
            <strong>{email}</strong> に確認メールを送りました。<br />
            メール内のリンクをクリックしてアカウントを有効化してください。
          </p>
          <a href="/auth/login" style={{
            display: "inline-block", marginTop: 24, padding: "14px 32px",
            background: B.gradientPrimary, color: "white", borderRadius: 14, textDecoration: "none",
            fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(10,35,66,0.2)",
          }}>ログインページへ</a>
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

      {/* ── Nav (LPと同じスタイル) ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
      }}>
        <a href="/" style={{ textDecoration: "none", fontSize: 20, fontWeight: 900, color: B.navy, letterSpacing: "-0.5px" }}>
          teach<span style={{ color: B.accent }}>AI</span>
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/auth/login" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: B.sub, textDecoration: "none" }}>
            ログイン
          </a>
        </div>
      </nav>

      {/* ── Signup Card ── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "100px 20px 40px",
      }}>
        <div style={{
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          background: "white", borderRadius: 24, padding: "44px 40px",
          width: "100%", maxWidth: 420,
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
          border: `1.5px solid ${B.border}`,
        }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 900, color: B.navy, letterSpacing: "-0.5px" }}>
              teach<span style={{ color: B.accent }}>AI</span>
            </h1>
            <p style={{ margin: 0, color: B.sub, fontSize: 14, fontWeight: 500 }}>無料アカウントを作成</p>
          </div>

          {/* Supabase未設定の警告 */}
          {!configured && (
            <div style={{
              background: "#FEF3C7", border: "1px solid #FDE68A",
              borderRadius: 12, padding: "12px 16px", marginBottom: 20,
              fontSize: 13, color: "#92400E", lineHeight: 1.5,
            }}>
              認証サービス（Supabase）が設定されていません。<br />
              Vercel環境変数に <code style={{ background: "#FDE68A", padding: "1px 4px", borderRadius: 3 }}>NEXT_PUBLIC_SUPABASE_URL</code> と{" "}
              <code style={{ background: "#FDE68A", padding: "1px 4px", borderRadius: 3 }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> を設定してください。
            </div>
          )}

          {error && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#DC2626", lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignup}
            disabled={loading || !configured}
            style={{
              width: "100%", padding: "13px 20px", border: `1.5px solid ${B.border}`,
              borderRadius: 14, background: "white",
              cursor: (loading || !configured) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              fontSize: 14, fontWeight: 600, fontFamily: "inherit",
              color: !configured ? B.muted : "#374151",
              marginBottom: 20,
              opacity: !configured ? 0.6 : 1, transition: "all 0.2s",
            }}
            onMouseEnter={e => configured && (e.currentTarget.style.borderColor = B.teal)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = B.border)}
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
            <div style={{ flex: 1, height: 1, background: B.border }} />
            <span style={{ fontSize: 12, color: B.muted, fontWeight: 500 }}>または</span>
            <div style={{ flex: 1, height: 1, background: B.border }} />
          </div>

          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>お名前</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="山田 太郎"
                disabled={!configured}
                style={{
                  width: "100%", padding: "12px 14px", border: `1.5px solid ${B.border}`,
                  borderRadius: 12, fontSize: 14, outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit", background: B.bg,
                  opacity: !configured ? 0.6 : 1, transition: "border-color 0.2s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = B.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = B.border)}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                disabled={!configured}
                style={{
                  width: "100%", padding: "12px 14px", border: `1.5px solid ${B.border}`,
                  borderRadius: 12, fontSize: 14, outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit", background: B.bg,
                  opacity: !configured ? 0.6 : 1, transition: "border-color 0.2s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = B.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = B.border)}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>パスワード（8文字以上）</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                disabled={!configured}
                style={{
                  width: "100%", padding: "12px 14px", border: `1.5px solid ${B.border}`,
                  borderRadius: 12, fontSize: 14, outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit", background: B.bg,
                  opacity: !configured ? 0.6 : 1, transition: "border-color 0.2s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = B.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = B.border)}
              />
            </div>
            <button type="submit" disabled={loading || !configured}
              style={{
                width: "100%", padding: "14px 20px",
                background: (loading || !configured) ? B.muted : B.gradientPrimary,
                color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700,
                fontFamily: "inherit",
                cursor: (loading || !configured) ? "not-allowed" : "pointer",
                boxShadow: (loading || !configured) ? "none" : "0 4px 16px rgba(10,35,66,0.2)",
              }}>
              {loading ? "処理中..." : "アカウントを作成"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: B.sub }}>
            すでにアカウントをお持ちの方は{" "}
            <a href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
              style={{ color: B.teal, fontWeight: 700, textDecoration: "none" }}>ログイン</a>
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: "center", padding: "20px 24px 32px", fontSize: 12, color: B.muted }}>
        &copy; 2026 teachAI. All rights reserved.
      </div>
    </div>
  );
}

export default function SignupForm() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F0F4FF 0%, #FAFBFE 40%, #fff 100%)" }} />
    }>
      <SignupFormInner />
    </Suspense>
  );
}
