"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Arial, sans-serif", padding: 20, margin: 0,
      }}>
        <div style={{
          background: "white", borderRadius: 20, padding: "48px 44px",
          maxWidth: 420, width: "100%", textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: "#0A2342", margin: "0 0 12px", fontSize: 20, fontWeight: 800 }}>
            アプリケーションエラー
          </h2>
          <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            予期しないエラーが発生しました。<br />
            キャッシュをクリアして再読み込みしてください。
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("tg_profile");
                  localStorage.removeItem("tg_char");
                  localStorage.removeItem("tg_graph");
                  localStorage.removeItem("tg_apikey");
                } catch {}
                reset();
              }}
              style={{
                padding: "12px 28px", background: "#0A2342", color: "white",
                borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 700,
              }}
            >
              🔄 キャッシュクリア &amp; 再読み込み
            </button>
            <button
              onClick={() => reset()}
              style={{
                padding: "12px 28px", background: "#f3f4f6", color: "#374151",
                borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 600,
              }}
            >
              そのまま再試行
            </button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <pre style={{
              marginTop: 24, padding: 16, background: "#f9fafb", borderRadius: 8,
              fontSize: 11, color: "#DC2626", textAlign: "left", overflow: "auto",
              maxHeight: 200, whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {error.message}
            </pre>
          )}
        </div>
      </body>
    </html>
  );
}
