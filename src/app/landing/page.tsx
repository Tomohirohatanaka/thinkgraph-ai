import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "teachAI — 認知科学 × AIで学習効率を18倍に",
  description: "認知科学に基づく「教えて学ぶ」AIプラットフォーム。YouTube・PDF・Web等の内容をAIプロテジェに教えることで記憶定着率90%を実現。SOLO Taxonomy 5軸評価、音声対応、知識グラフ可視化。Free/Pro/Teamプラン対応。",
  openGraph: {
    title: "teachAI — 認知科学 × AIで学習効率を18倍に",
    description: "「教える」ことが最高の学習法。認知科学の知見をAIで誰もが実践できるEdTechプラットフォーム。",
    type: "website",
    locale: "ja_JP",
    siteName: "teachAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "teachAI — 認知科学 × AIで学習効率を18倍に",
    description: "「教える」ことが最高の学習法。認知科学の知見をAIで誰もが実践できるEdTechプラットフォーム。",
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
