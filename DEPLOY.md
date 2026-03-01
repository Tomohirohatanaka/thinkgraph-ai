# teachAI v3 デプロイガイド

## 概要

v2 (ペナルティベース 0-100) → v3 (SOLO基準参照 1-5) への段階的移行。
**後方互換性を維持**しながら v3 を並行稼働させる。

---

## ファイル一覧

```
deploy/
├── src/
│   ├── lib/
│   │   ├── scoring-v3.ts      # 新規: v3スコアリングエンジン
│   │   ├── tools-v3.ts        # 新規: MCPツール定義 (v3追加分)
│   │   └── supabase/
│   │       └── types-v3.ts    # 新規: 型定義 (v3追加分)
│   └── app/api/
│       ├── teach/route.ts     # 更新: v2/v3デュアルモード
│       ├── elo/route.ts       # 新規: Eloレーティング API
│       └── score-v3/route.ts  # 新規: v3独立スコアリング API
├── supabase/
│   └── migration-v3.sql       # 新規: DBマイグレーション
└── DEPLOY.md                  # このファイル
```

---

## Step 1: DBマイグレーション

```bash
# Supabase CLI でマイグレーション実行
supabase db push --file supabase/migration-v3.sql

# または Supabase Dashboard > SQL Editor で直接実行
```

**追加されるもの:**
- sessions テーブルに v3 カラム (score_completeness, rqs_scores, kb_mode 等)
- user_elo_ratings テーブル (新規)
- elo_history テーブル (新規)
- user_stats_v3 ビュー (新規)
- RLS ポリシー

**安全性:** 既存カラムは一切変更しない。ADD COLUMN IF NOT EXISTS で冪等。

---

## Step 2: ファイル配置

```bash
# プロジェクトルートから
cp deploy/src/lib/scoring-v3.ts         src/lib/scoring-v3.ts
cp deploy/src/lib/tools-v3.ts           src/lib/tools-v3.ts
cp deploy/src/lib/supabase/types-v3.ts  src/lib/supabase/types-v3.ts
cp deploy/src/app/api/teach/route.ts    src/app/api/teach/route.ts
cp deploy/src/app/api/elo/route.ts      src/app/api/elo/route.ts
```

---

## Step 3: 既存ファイル更新

### 3a. tools.ts に v3 ツール追加

```typescript
// src/lib/tools.ts の末尾に追加
import { V3_TOOLS } from "./tools-v3";

// TOOLS 配列に追加
export const TOOLS: ToolDefinition[] = [
  ...existingTools,  // 既存ツール
  ...V3_TOOLS,       // v3ツール
];
```

### 3b. MCP route に Elo ハンドラ追加

```typescript
// src/app/api/mcp/route.ts の endpoints に追加
const endpoints: Record<string, string> = {
  // ...existing...
  get_elo_rating:    "/api/elo",
  update_elo_rating: "/api/elo",
  score_v3:          "/api/score-v3",
};
```

### 3c. フロントエンド (page.tsx) の更新ポイント

```typescript
// 1. SessionResult 型に v3 フィールド追加
interface SessionResult {
  // ...existing v2 fields...
  score_v3?: {
    raw: { completeness: number; depth: number; clarity: number; structural_coherence: number; pedagogical_insight: number };
    weighted: number;
    grade: "A" | "B" | "C" | "D" | "F";
    conjunctive_pass: boolean;
    insight: string;
    kb_mode: string;
    rqs_avg: number;
  };
  scoring_version?: "v2" | "v3";
  rqs?: { score: number; signals: Record<string, number> };
  next_state?: string;
  kb?: { mode: string; signals: Record<string, string> };
}

// 2. doAiTurn に v3 状態を渡す
const [rqsHistory, setRqsHistory] = useState<unknown[]>([]);
const [stateHistory, setStateHistory] = useState<unknown[]>([]);
const [currentState, setCurrentState] = useState("ORIENT");
const [kbSignals, setKbSignals] = useState<unknown[]>([]);

// doAiTurn 呼び出し時に追加パラメータ
body: JSON.stringify({
  // ...existing...
  rqsHistory,
  stateHistory,
  currentState,
  kbSignals,
}),

// 3. レスポンスハンドリング
if (data.rqs) {
  setRqsHistory(prev => [...prev, data.rqs]);
}
if (data.next_state) {
  setCurrentState(data.next_state);
}
if (data.kb) {
  setKbSignals(prev => [...prev, { turn: userTurns, ...data.kb }]);
}

// 4. 結果表示で v3 スコアを使用
if (result.score_v3) {
  // 1-5 スケール表示
  const v3 = result.score_v3;
  // weighted: 4.2 / 5.0
  // grade: A
  // KB mode indicator
}

// 5. Elo Rating 更新 (セッション完了後)
if (result.score_v3) {
  await fetch("/api/elo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: topic.title,
      scores: result.score_v3.raw,
    }),
  });
}
```

---

## Step 4: 環境変数設定

```bash
# .env.local に追加
USE_V3_SCORING=true
```

**段階的有効化:**
1. まず `USE_V3_SCORING` を設定しない → v2のみ動作 (既存通り)
2. `USE_V3_SCORING=true` → v3有効化 (v2互換データも同時出力)
3. フロントエンドが v3 表示に対応したら、v3 をメイン表示に切り替え

---

## Step 5: テスト

```bash
# 1. ビルド確認
npm run build

# 2. ローカルテスト
npm run dev

# 3. テストセッション実行
# - v2モード (USE_V3_SCORING未設定): 従来通りの動作確認
# - v3モード (USE_V3_SCORING=true): 
#   - RQS がレスポンスに含まれるか
#   - 状態遷移が記録されるか
#   - 最終スコアが 1-5 スケールか
#   - v2互換フィールドも同時に返るか

# 4. Elo テスト
curl -X GET http://localhost:3000/api/elo \
  -H "Cookie: ..." 

# 5. DB確認
# Supabase Dashboard で sessions テーブルの新カラムを確認
```

---

## Step 6: Vercel デプロイ

```bash
# 環境変数をVercelに設定
vercel env add USE_V3_SCORING production
# → true を入力

# デプロイ
vercel --prod

# または GitHub push でCI/CD
git add .
git commit -m "feat: integrate v3 assessment engine (SOLO 1-5, RQS, KB, Elo)"
git push origin main
```

---

## ロールバック手順

v3 に問題があった場合:

```bash
# 1. 環境変数を削除 → v2フォールバック
vercel env rm USE_V3_SCORING production

# 2. 再デプロイ
vercel --prod
```

DBマイグレーションのロールバックは不要（v3カラムはNULLABLEで既存データに影響なし）。

---

## v2 → v3 スコア対照表

| v2 (0-100) | v3 (1-5) | グレード |
|-----------|---------|---------|
| 90-100    | 5       | A (v2:S) |
| 75-89     | 4       | A-B     |
| 60-74     | 3       | B-C     |
| 45-59     | 2       | C-D     |
| 0-44      | 1       | D-F     |

---

## 次元名の変更

| v2                  | v3                    | 変更理由 |
|--------------------|-----------------------|---------|
| coverage           | completeness          | SOLO Taxonomy 用語統一 |
| depth              | depth                 | 変更なし |
| clarity            | clarity               | 変更なし |
| structural_coherence | structural_coherence | 変更なし |
| spontaneity        | pedagogical_insight   | Roscoe & Chi 2007: KB検出との整合 |
