"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        boxShadow: "0 8px 40px rgba(0,0,0,0.06)", border: "1.5px solid #E5E7EB",
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔧</div>
        <h2 style={{ color: "#0A2342", margin: "0 0 12px", fontSize: 20, fontWeight: 800 }}>
          エラーが発生しました
        </h2>
        <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          一時的な問題が発生しました。<br />
          下のボタンをお試しください。
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("tg_profile");
                localStorage.removeItem("tg_char");
                localStorage.removeItem("tg_graph");
              } catch {}
              reset();
            }}
            style={{
              padding: "12px 28px",
              background: "linear-gradient(135deg, #0A2342, #1A6B72)",
              color: "white", borderRadius: 14, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 700, fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(10,35,66,0.2)",
            }}
          >
            キャッシュクリア &amp; 再試行
          </button>
          <a href="/" style={{
            padding: "12px 28px", background: "#f3f4f6", color: "#374151",
            borderRadius: 14, textDecoration: "none", fontSize: 14, fontWeight: 600,
          }}>
            トップに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
