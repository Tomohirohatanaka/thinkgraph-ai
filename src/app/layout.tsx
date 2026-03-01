import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "teachAI — AIに教えて学習効率を18倍に",
    template: "%s | teachAI",
  },
  description: "認知科学に基づく「教えて学ぶ」AIプラットフォーム。YouTube・PDF・Webの内容をAIプロテジェに教えることで記憶定着率90%を実現。SOLO Taxonomy 5軸評価・音声対応・知識グラフ。Claude/GPT/Gemini/Bedrock対応。",
  keywords: ["AI学習", "EdTech", "ピアチュータリング", "教えて学ぶ", "SOLO Taxonomy", "YouTube学習", "PDF学習", "knowledge graph", "認知科学", "アクティブラーニング", "記憶定着", "Learning by Teaching"],
  authors: [{ name: "teachAI" }],
  creator: "teachAI",
  publisher: "teachAI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "teachAI",
  },
  openGraph: {
    title: "teachAI — AIに教えて学習効率を18倍に",
    description: "認知科学に基づく「教えて学ぶ」AIプラットフォーム。記憶定着率90%を実現する次世代EdTech。",
    type: "website",
    locale: "ja_JP",
    siteName: "teachAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "teachAI — AIに教えて学習効率を18倍に",
    description: "認知科学に基づく「教えて学ぶ」AIプラットフォーム。記憶定着率90%を実現。",
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A2342",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ margin: 0, padding: 0, overscrollBehavior: "none" }}>{children}</body>
    </html>
  );
}
