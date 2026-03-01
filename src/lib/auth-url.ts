/**
 * 認証リダイレクト用のベースURL取得ユーティリティ
 *
 * 優先順位:
 * 1. NEXT_PUBLIC_SITE_URL (Vercel環境変数で明示設定)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel自動設定 - 本番URL)
 * 3. VERCEL_URL (Vercel自動設定 - デプロイメント固有URL)
 * 4. location.origin (クライアントサイドフォールバック)
 * 5. localhost (ローカル開発)
 */
export function getBaseUrl(): string {
  // クライアントサイド: ブラウザの現在のオリジンを使用
  if (typeof window !== 'undefined') {
    // 環境変数で明示指定がある場合はそちらを優先
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && siteUrl !== 'https://your-app.vercel.app') {
      return siteUrl.replace(/\/$/, '');
    }
    return window.location.origin;
  }

  // サーバーサイド
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL !== 'https://your-app.vercel.app') {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}
