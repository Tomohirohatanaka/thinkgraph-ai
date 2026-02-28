# Supabase セットアップガイド

## 1. Supabaseプロジェクト作成

1. [https://supabase.com](https://supabase.com) にアクセスしてアカウント作成
2. 「New Project」→ プロジェクト名: `thinkgraph-ai`、リージョン: `Northeast Asia (Tokyo)`
3. パスワードを設定して「Create new project」

---

## 2. データベーススキーマのセットアップ

Supabase Dashboard → **SQL Editor** → 「New query」を開き、
`supabase/migration.sql` の内容を貼り付けて **Run** ボタンをクリック。

---

## 3. 認証プロバイダの設定

### メール/パスワード（デフォルトで有効）
Dashboard → **Authentication** → **Providers** → Email が有効になっていることを確認

### Google OAuth（任意）
1. [Google Cloud Console](https://console.cloud.google.com) でOAuthクライアントID作成
   - 認証済みリダイレクトURI: `https://your-project-ref.supabase.co/auth/v1/callback`
2. Dashboard → **Authentication** → **Providers** → Google を有効化
   - Client ID と Client Secret を入力

---

## 4. Vercel環境変数の設定

Vercel Dashboard → Project → **Settings** → **Environment Variables** に追加:

| 変数名 | 値 |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` |

### 値の確認場所
Supabase Dashboard → **Project Settings** → **API**
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`  
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 5. Supabase Auth URL設定

Dashboard → **Authentication** → **URL Configuration**:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs** に追加: `https://your-app.vercel.app/auth/callback`

---

## 6. ローカル開発

```bash
cp .env.example .env.local
# .env.local に実際の値を入力
npm run dev
```

---

## 確認チェックリスト

- [ ] `migration.sql` を SQL Editor で実行済み
- [ ] `NEXT_PUBLIC_SUPABASE_URL` を Vercel に設定
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` を Vercel に設定
- [ ] Site URL と Redirect URL を Supabase Auth に設定
- [ ] Vercel で再デプロイを実行
