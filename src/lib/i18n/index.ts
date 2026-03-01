/**
 * teachAI Internationalization (i18n) Foundation
 * ─────────────────────────────────────────────────────────────
 * Lightweight i18n system for global expansion.
 * Currently supports ja (Japanese) and en (English).
 *
 * Business Strategy:
 *   - Japanese first (primary market)
 *   - English for global expansion
 *   - Easy to add new languages
 *   - No heavy library dependency
 */

export type Locale = "ja" | "en";

type TranslationKey = keyof typeof JA;

const JA = {
  // Common
  "app.name": "teachAI",
  "app.tagline": "AIに教えて、最速で学ぶ",
  "app.description": "YouTube・PDF・Webサイトの内容をAIキャラクターに教えることで、理解度を定量化。",

  // Navigation
  "nav.dashboard": "ダッシュボード",
  "nav.learn": "AIに教える",
  "nav.logout": "ログアウト",
  "nav.settings": "設定",

  // Auth
  "auth.login": "ログイン",
  "auth.signup": "新規登録",
  "auth.email": "メールアドレス",
  "auth.password": "パスワード",
  "auth.google": "Googleでログイン",
  "auth.forgot": "パスワードを忘れた方",
  "auth.noAccount": "アカウントをお持ちでない方",
  "auth.hasAccount": "既にアカウントをお持ちの方",

  // Session
  "session.start": "学習を始める",
  "session.finish": "終了して採点",
  "session.turn": "ターン",
  "session.thinking": "が考え中...",
  "session.scoring": "採点中...",
  "session.input.placeholder": "ここに説明を入力...",
  "session.voice": "音声入力",
  "session.send": "送信",

  // Modes
  "mode.whynot": "なぜ分析",
  "mode.vocabulary": "語彙",
  "mode.concept": "概念",
  "mode.procedure": "手順",

  // Scores
  "score.total": "総合スコア",
  "score.grade": "評価",
  "score.completeness": "網羅性",
  "score.depth": "深さ",
  "score.clarity": "明晰さ",
  "score.structure": "論理構造",
  "score.insight": "教育的洞察",

  // Dashboard
  "dash.sessions": "教えたセッション",
  "dash.avgScore": "平均スコア",
  "dash.topics": "教えたトピック",
  "dash.time": "総学習時間",
  "dash.overview": "概要",
  "dash.history": "履歴",
  "dash.knowledge": "知識グラフ",
  "dash.settings": "設定",
  "dash.greeting": "こんにちは",
  "dash.subtitle": "教えた成果を確認しましょう",

  // Streak
  "streak.current": "連続学習",
  "streak.days": "日",
  "streak.longest": "最長記録",

  // Errors
  "error.generic": "エラーが発生しました",
  "error.network": "ネットワークエラー",
  "error.apiKey": "APIキーが必要です",
  "error.retry": "再試行",
  "error.back": "戻る",

  // Success
  "success.saved": "保存しました",
  "success.completed": "完了しました",

  // Onboarding
  "onboard.welcome": "teachAIへようこそ！",
  "onboard.step1": "APIキーを設定",
  "onboard.step2": "キャラクターを選ぶ",
  "onboard.step3": "学習コンテンツを追加",
  "onboard.step4": "AIに教えて学ぶ",

  // Analytics
  "analytics.trend": "学習トレンド",
  "analytics.pattern": "学習パターン",
  "analytics.bestTime": "最も効果的な時間帯",
  "analytics.consistency": "継続性",
  "analytics.growth": "成長予測",
  "analytics.milestones": "マイルストーン",

  // Landing
  "landing.hero.title": "AIに教えて、\n最速で学ぶ",
  "landing.hero.subtitle": "学術論文に基づくピアチュータリング手法で、記憶定着率が2.5倍に。",
  "landing.cta.start": "無料で始める",
  "landing.cta.demo": "デモを見る",
} as const;

const EN: Record<TranslationKey, string> = {
  "app.name": "teachAI",
  "app.tagline": "Teach AI, Learn Faster",
  "app.description": "Quantify your understanding by teaching AI characters from YouTube, PDFs, and websites.",

  "nav.dashboard": "Dashboard",
  "nav.learn": "Teach AI",
  "nav.logout": "Logout",
  "nav.settings": "Settings",

  "auth.login": "Login",
  "auth.signup": "Sign Up",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.google": "Login with Google",
  "auth.forgot": "Forgot password?",
  "auth.noAccount": "Don't have an account?",
  "auth.hasAccount": "Already have an account?",

  "session.start": "Start Learning",
  "session.finish": "Finish & Score",
  "session.turn": "Turn",
  "session.thinking": "is thinking...",
  "session.scoring": "Scoring...",
  "session.input.placeholder": "Type your explanation here...",
  "session.voice": "Voice Input",
  "session.send": "Send",

  "mode.whynot": "Why Analysis",
  "mode.vocabulary": "Vocabulary",
  "mode.concept": "Concepts",
  "mode.procedure": "Procedure",

  "score.total": "Total Score",
  "score.grade": "Grade",
  "score.completeness": "Completeness",
  "score.depth": "Depth",
  "score.clarity": "Clarity",
  "score.structure": "Structure",
  "score.insight": "Pedagogical Insight",

  "dash.sessions": "Teaching Sessions",
  "dash.avgScore": "Average Score",
  "dash.topics": "Topics Taught",
  "dash.time": "Total Study Time",
  "dash.overview": "Overview",
  "dash.history": "History",
  "dash.knowledge": "Knowledge Graph",
  "dash.settings": "Settings",
  "dash.greeting": "Hello",
  "dash.subtitle": "Review your teaching progress",

  "streak.current": "Streak",
  "streak.days": "days",
  "streak.longest": "Longest",

  "error.generic": "An error occurred",
  "error.network": "Network error",
  "error.apiKey": "API key required",
  "error.retry": "Retry",
  "error.back": "Go Back",

  "success.saved": "Saved",
  "success.completed": "Completed",

  "onboard.welcome": "Welcome to teachAI!",
  "onboard.step1": "Set up your API key",
  "onboard.step2": "Choose a character",
  "onboard.step3": "Add learning content",
  "onboard.step4": "Teach AI and learn",

  "analytics.trend": "Learning Trend",
  "analytics.pattern": "Learning Pattern",
  "analytics.bestTime": "Best Time of Day",
  "analytics.consistency": "Consistency",
  "analytics.growth": "Growth Forecast",
  "analytics.milestones": "Milestones",

  "landing.hero.title": "Teach AI,\nLearn Faster",
  "landing.hero.subtitle": "Evidence-based peer tutoring that boosts retention by 2.5x.",
  "landing.cta.start": "Start Free",
  "landing.cta.demo": "Watch Demo",
};

const TRANSLATIONS: Record<Locale, Record<TranslationKey, string>> = {
  ja: JA,
  en: EN,
};

let currentLocale: Locale = "ja";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("tg_locale", locale);
      document.documentElement.lang = locale;
    } catch { /* ignore */ }
  }
}

export function getLocale(): Locale {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("tg_locale") as Locale;
    if (saved && TRANSLATIONS[saved]) return saved;
  }
  return currentLocale;
}

export function t(key: TranslationKey): string {
  const locale = getLocale();
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.ja[key] ?? key;
}

export function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") return "ja";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("en")) return "en";
  return "ja";
}
