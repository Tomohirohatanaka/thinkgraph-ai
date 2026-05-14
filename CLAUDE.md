# teachAI / thinkgraph-ai — Claude プロジェクト指示書

このリポジトリで Claude が動くときに、毎回読むべき指示を集約したドキュメント。

---

## 0. 北極星(最優先)

> **人間の思考力を取り戻す。**

すべての判断はこの一文を最上位の基準にする。
ユーザー要望・短期売上・流行・他社動向は判断軸にしない。

## 1. 常に参照すべきドキュメント

あらゆる議論・判断・提案の前に、以下を `project_knowledge_search` 相当で参照する。

- `docs/teachAI_integrated_report_v3.md` — 統合報告書(全文)
- `docs/ガイドライン.md` — 判断基準の要約

必要に応じて統合報告書の該当章を直接読む。

## 2. 絶対遵守する判断基準

### 2.1 アンチバリュー(§3.4)

以下に違反する提案は **無条件却下** する。半端な妥協はしない。

1. 答えを直接出す機能
2. 学習効率の最大化UX
3. スコア順ランキング・煽り通知
4. 中毒性UX(無限スクロール、デイリーストリーク強要)
5. 注意経済の搾取(広告、行動追跡)
6. ユーザーの代わりに考える
7. 法人向けの強制利用販売
8. 子供向け展開
9. ダークパターン

→ `.claude/skills/teachai-anti-value-audit` を呼ぶ。

### 2.2 判断5問(§8.2)

Yes が 4 未満の機能提案は却下。

1. 検算の場を強化するか
2. ユーザーが主権者でいられるか
3. 評価結果に根拠を提示できるか
4. ユーザーデータ主権を保てるか
5. 10 年後にも価値が残るか

→ `.claude/skills/polaris-5q` を呼ぶ。

## 3. 返答前のチェックリスト

すべての応答の前に:

1. 関連 PART / 章を検索したか?
2. 北極星・アンチバリューと矛盾しないか?
3. ユーザーが後で振り返って恥ずかしくない内容か?

## 4. ワークフローの基本形

### 機能を実装するか議論するとき
```
1. teachai-feature-spec で仕様書を書く
2. anti-value-guardian で §3.4 監査
3. (通過なら)cold-consultant でユニットエコノミクスと実行性を検証
4. (採用なら)実装着手
5. /ship でデプロイ
```

### 評価エンジン関連の PR レビュー
```
1. code-reviewer が呼ばれる
2. assessment-validator が SOLO/RQS/Elo/グラフ/説明可能性を検査
3. character-consistency が発話・プロンプト変更を検査
4. ブロッカーゼロでマージ
```

### マーケ・PR の出稿
```
1. growth-marketer が施策ドラフト
2. (X 投稿なら x-post-draft、note 記事なら note-article-draft)
3. anti-value-guardian でセルフチェック
4. 通過したものだけ実投稿
```

### 月次経理
```
1. accountant が呼ばれる
2. bookkeeping-monthly で月次クローズ
3. 異常値があればはたに通知
```

### 知財
```
1. 四半期に 1 回 patent-strategist が呼ばれる
2. 出願候補があれば patent-claim-draft で請求項案
3. 弁理士に依頼
```

## 5. 技術スタック(2026/05 時点)

- **フロントエンド:** Next.js + TypeScript
- **ホスティング:** Vercel(Pro)
- **データベース・認証:** Supabase(Pro)
- **LLM:** Anthropic / OpenAI / Google / AWS Bedrock(マルチプロバイダー)
- **コード管理:** GitHub(`Tomohirohatanaka/thinkgraph-ai`)
- **将来:** GCP(Cloud Run など)で評価エンジン切り出し検討中
- **MCP:** Supabase MCP / 自家製 MCP の組合せ

## 6. 開発フローの規約

- ブランチ: `feature/<slug>` / `fix/<slug>` / `chore/<slug>`
- コミット: 1 PR = 1 論理的変更
- マイグレーション: `supabase/migrations/` に YYYYMMDDHHMM_<slug>.sql
- 本番デプロイ: `/ship` コマンド経由のみ。手動 `vercel --prod` 禁止
- 環境変数追加: `.env.example` を必ず更新

## 7. やってはいけないこと

- ❌ webhook 不安定 / branch 不一致を放置(過去に半日詰まった)
- ❌ RLS なしでテーブル作成
- ❌ `service_role` キーをフロントで使う
- ❌ 説明可能性を欠いたスコア表示
- ❌ キャラクターを「先生役」化させる
- ❌ 数字目標のために北極星を曲げる

## 8. このリポジトリで Claude が使える資産

### Skills(`.claude/skills/`)
- teachai-anti-value-audit, polaris-5q
- solo-rqs-validator, character-voice-check, explainability-audit
- supabase-migration, vercel-deploy-safe
- teachai-feature-spec
- x-post-draft, note-article-draft
- patent-claim-draft
- sales-followup, bookkeeping-monthly

### Subagents(`.claude/agents/`)
- anti-value-guardian, cold-consultant
- code-reviewer, deploy-orchestrator
- assessment-validator, character-consistency
- growth-marketer
- sales-coach, accountant, patent-strategist

### Slash Commands(`.claude/commands/`)
- /ship, /audit-feature, /kpi-status, /character-check, /patent-sweep

詳細は `ARCHITECTURE.md` 参照。

---

## 9. 緊急時の挙動

- 本番障害発生 → deploy-orchestrator が自動ロールバック後、はたに即通知
- 評価エンジンの不整合検出 → 機能フラグで即無効化、原因調査
- セキュリティ問題 → security-auditor を即呼び、Supabase ブランチで再現

## 10. このドキュメントの更新

`CLAUDE.md` は生きたドキュメント。月 1 回見直し、不要になった指示は削る、新しい合意は追加する。
