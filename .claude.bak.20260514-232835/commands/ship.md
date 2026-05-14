---
description: teachAIを本番デプロイする統合フロー。事前ゲート(レビュー・監査)→ Supabaseマイグレーション → Vercelデプロイ → スモーク → ロールバック準備までを一気通貫で実行する。
---

# /ship

teachAI の本番デプロイを実行します。手動 `vercel --prod` の代わりに必ずこのコマンドを使ってください。

## 実行内容

1. **deploy-orchestrator サブエージェントを呼ぶ**
2. 内部で以下を順次実行:
   - 事前ゲート確認(code-reviewer / assessment-validator / character-consistency / anti-value-guardian の通過状況)
   - `supabase-migration` スキルでブランチ検証 → 本番反映
   - `vercel-deploy-safe` スキルで webhook → CLI フォールバックでデプロイ
   - スモークテスト(主要エンドポイント)
   - 直前のデプロイ ID を控えてロールバック準備
3. 結果をレポート

## 失敗時

- スモークが落ちたら **即ロールバック**(ユーザー確認を待たない)
- マイグレーションで `get_advisors` が高度警告 → 即停止し、はたに報告
- Vercel CLI が 2 回失敗 → 手動介入を依頼

## 使い方

```
/ship
```

オプション引数:
- `--dry-run` — 実際にはデプロイせず、ゲート確認のみ
- `--skip-smoke` — スモークテストをスキップ(緊急時のみ、推奨しない)

## 出力

deploy-orchestrator のレポート形式を参照。
