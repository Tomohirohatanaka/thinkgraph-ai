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
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F0F4FF 0%, #FAFBFE 40%, #fff 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: 20, margin: 0,
      }}>
        <div style={{
          background: "white", borderRadius: 24, padding: "48px 44px",
          maxWidth: 420, width: "100%", textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)", border: "1.5px solid #E5E7EB",
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
                padding: "12px 28px",
                background: "linear-gradient(135deg, #0A2342, #1A6B72)",
                color: "white", borderRadius: 14, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                boxShadow: "0 4px 16px rgba(10,35,66,0.2)",
              }}
            >
              キャッシュクリア &amp; 再読み込み
            </button>
            <button
              onClick={() => reset()}
              style={{
                padding: "12px 28px", background: "#f3f4f6", color: "#374151",
                borderRadius: 14, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 600, fontFamily: "'Outfit', sans-serif",
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
