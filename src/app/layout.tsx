import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "teachAI — AIに教えて、最速で学ぶ",
    template: "%s | teachAI",
  },
  description: "YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、理解度を定量化。学術論文に基づくピアチュータリング手法で、記憶定着率が2.5倍に。",
  keywords: ["AI学習", "ピアチュータリング", "教えて学ぶ", "SOLO Taxonomy", "YouTube学習", "PDF学習", "knowledge graph"],
  authors: [{ name: "teachAI" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "teachAI",
  },
  openGraph: {
    title: "teachAI — AIに教えて、最速で学ぶ",
    description: "YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、理解度を定量化。記憶定着率が2.5倍に。",
    type: "website",
    locale: "ja_JP",
    siteName: "teachAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "teachAI — AIに教えて、最速で学ぶ",
    description: "YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、理解度を定量化。",
  },
  robots: {
    index: true,
    follow: true,
  },
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
