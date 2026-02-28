import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "teachAI — AIに教えて学ぶ",
  description: "AIに教えてあげる、新しい学びのかたち。YouTube・Webサイトから学習コンテンツを自動生成。",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "teachAI" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, overscrollBehavior: "none" }}>{children}</body>
    </html>
  );
}
// deploy 1772288073
