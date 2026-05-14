---
name: vercel-deploy-safe
description: teachAI(thinkgraph-ai)のVercel本番デプロイを安全に行うスキル。GitHub-Vercel webhook失敗時のCLI直接デプロイへのフォールバック、ブランチ不一致(master/main)解決、環境変数の事前検証、デプロイ後スモークテストを含む。本番障害が起きないように、必ず事前にlint/buildを通し、その後Vercel CLIトークンで直接デプロイする手順を持つ。
---

# Vercel 安全デプロイ

Vercel webhook 不安定問題への耐性を持つ、CLI ベースのデプロイ手順。

## 前提

- thinkgraph-ai リポジトリは GitHub にあり、Vercel 連携済み
- ただし webhook が落ちることがあるため、CLI フォールバックを常に持つ
- 本番デプロイは master ブランチ(または main、状況に応じて確認)

## 標準フロー

### Phase 1: ローカル検証
```bash
# 1. 最新を取得
git fetch origin
git checkout master
git pull origin master

# 2. 依存関係
npm ci

# 3. 環境変数チェック
[ -f .env.local ] && echo "OK" || echo "MISSING .env.local"

# 4. lint + type check + build
npm run lint
npm run typecheck   # 存在する場合
npm run build

# 5. ローカル smoke
npm run start &
SERVER_PID=$!
sleep 5
curl -f http://localhost:3000 > /dev/null && echo "smoke OK" || echo "smoke FAILED"
kill $SERVER_PID
```

### Phase 2: Vercel デプロイ
```bash
# Webhook 経由(通常)
git push origin master
# → Vercel ダッシュボードで進行を確認

# Webhook が動かない / 動きが遅いとき → CLI 直接
vercel --prod --token=$VERCEL_TOKEN --confirm
```

### Phase 3: デプロイ後スモーク
```bash
DEPLOY_URL="https://<your-domain>"

# 主要エンドポイントを叩く
for path in "/" "/api/health" "/api/score"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL$path")
  echo "$path -> $STATUS"
done
```

### Phase 4: ロールバック準備
直前のデプロイ ID を控えておく。
```bash
vercel ls --token=$VERCEL_TOKEN | head -5
# 問題発生時:
vercel rollback <previous-deployment-url> --token=$VERCEL_TOKEN
```

## ブランチ不一致解決

過去のメモリーで「master/main 不一致」が発生したことがある。確認手順:
```bash
# GitHub 側
git branch -r

# Vercel 側
vercel inspect <project> --token=$VERCEL_TOKEN | grep -i branch

# 不一致なら Vercel ダッシュボードで Production Branch を確認・修正
```

## 環境変数の事前チェック

teachAI が必要とする変数:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` (どれか)
- `VERCEL_TOKEN`(CLI フォールバック用、ローカルのみ)

Vercel ダッシュボードで Production / Preview の両方に設定されているか確認。

## 禁止事項

- ❌ `git push --force` で master を上書き
- ❌ ローカル build スキップで `vercel --prod`
- ❌ `.env.local` を commit
- ❌ Production 環境変数の動的変更後に検証なし

## 連動するスキル/エージェント

- 直前: `supabase-migration`(スキーマ差分があるなら先に適用)
- 直後: スモークテスト結果を `deploy-orchestrator` がモニタリング

## 呼ばれ方

- /ship コマンド経由
- 手動デプロイが必要な緊急時
- 環境変数追加時(検証用)

## 重要

過去に「webhook が動かず半日詰まった」事例がある。最初から CLI フォールバックを準備しておくことで、本番障害時間を短縮する。
