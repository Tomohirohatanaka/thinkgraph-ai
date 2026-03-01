/**
 * Trial API Key Management
 * ─────────────────────────
 * サーバーサイドで環境変数からトライアル用APIキーを提供
 * ユーザーがAPIキー未設定でも体験できるようにする
 */

// サーバーサイドのみで使用（環境変数は NEXT_PUBLIC_ なし）
export function getTrialApiKey(): string | null {
  return process.env.TRIAL_API_KEY || null;
}

// トライアルキーが利用可能かどうか
export function isTrialAvailable(): boolean {
  return !!process.env.TRIAL_API_KEY;
}

// リクエストのAPIキーを解決（ユーザーキー優先、なければトライアル）
export function resolveApiKey(userKey?: string): { key: string; isTrial: boolean } | null {
  if (userKey && userKey.length > 5) {
    return { key: userKey, isTrial: false };
  }
  const trialKey = getTrialApiKey();
  if (trialKey) {
    return { key: trialKey, isTrial: true };
  }
  return null;
}
