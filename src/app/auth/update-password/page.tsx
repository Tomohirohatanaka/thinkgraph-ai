"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supabase sends the user to this page with a session already set via URL fragment
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // Session is ready
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください");
      return;
    }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/"), 2000);
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
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: "#0A2342", margin: "0 0 12px" }}>パスワードを更新しました</h2>
          <p style={{ color: "#6B7280", fontSize: 14 }}>
            まもなくホームページへ移動します...
          </p>
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
          }}>🔒</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0A2342" }}>
            新しいパスワードを設定
          </h1>
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

        <form onSubmit={handleUpdate}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              新しいパスワード（8文字以上）
            </label>
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
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              パスワード確認
            </label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
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
            }}
          >
            {loading ? "更新中..." : "パスワードを更新"}
          </button>
        </form>
      </div>
    </div>
  );
}
