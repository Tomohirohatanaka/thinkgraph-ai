import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "teachAI — AIに教えて、最速で学ぶ",
  description: "YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、理解度を定量化。学術論文に基づくピアチュータリング手法で、記憶定着率が2.5倍に。",
  openGraph: {
    title: "teachAI — AIに教えて、最速で学ぶ",
    description: "YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、理解度を定量化。",
    type: "website",
    locale: "ja_JP",
    siteName: "teachAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "teachAI — AIに教えて、最速で学ぶ",
    description: "YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、理解度を定量化。",
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
