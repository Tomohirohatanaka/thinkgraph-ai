---
name: supabase-migration
description: Supabaseのスキーマ変更を安全に行うスキル。idempotent SQL(IF NOT EXISTS、DO $$ BEGIN ... END $$)、RLSポリシーの順序付け、JSONB型の取り扱い、enum追加、外部キー制約の追加、データバックフィルなどを扱う。Supabase MCPツールと併用し、本番適用前に必ずブランチで検証する。テーブル新設、カラム追加、RLSポリシー変更などで呼ばれる。
---

# Supabase マイグレーション

teachAI のスキーマ変更を、再実行可能・ロールバック可能な形で行うスキル。

## 基本原則

1. **idempotent** — 同じ SQL を何度実行しても同じ状態になる
2. **branch first** — 本番に直接当てず、まず Supabase ブランチで検証
3. **RLS first** — テーブル作成時は同じトランザクションで RLS を有効化
4. **migration table** — `supabase/migrations/` に YYYYMMDDHHMM_<slug>.sql で保存

## 標準テンプレート

### A. テーブル作成
```sql
CREATE TABLE IF NOT EXISTS public.<table_name> (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 業務カラム
    ...
);

-- 必ず同じトランザクションで RLS を有効化
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- 標準ポリシー(自分のデータのみ)
DROP POLICY IF EXISTS "<table_name>_select_own" ON public.<table_name>;
CREATE POLICY "<table_name>_select_own"
    ON public.<table_name>
    FOR SELECT
    USING (auth.uid() = user_id);

-- 同様に INSERT / UPDATE / DELETE
```

### B. カラム追加(NOT NULL)
バックフィルが必要なら 3 段階に分割する。
```sql
-- 1. NULL 許容で追加
ALTER TABLE public.<table>
    ADD COLUMN IF NOT EXISTS <col> <type>;

-- 2. バックフィル(別マイグレーションで)
UPDATE public.<table> SET <col> = <default> WHERE <col> IS NULL;

-- 3. NOT NULL に変更(さらに別マイグレーション)
ALTER TABLE public.<table> ALTER COLUMN <col> SET NOT NULL;
```

### C. ENUM 値の追加
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = '<new_value>'
        AND enumtypid = '<enum_name>'::regtype
    ) THEN
        ALTER TYPE <enum_name> ADD VALUE '<new_value>';
    END IF;
END$$;
```

### D. インデックス
```sql
CREATE INDEX IF NOT EXISTS idx_<table>_<col> ON public.<table>(<col>);
-- 本番大規模テーブルは CONCURRENTLY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_... ON ...;
```

### E. RLS 二重防御パターン
JSON カラムでサブスクリプション情報を持つ場合などは、ポリシーで二重チェック。
```sql
CREATE POLICY "..."
    ON public.<table>
    FOR SELECT
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = auth.uid()
            AND s.status = 'active'
        )
    );
```

## 適用手順

1. SQL ファイルを `supabase/migrations/` に作成
2. Supabase MCP の `create_branch` でブランチ作成
3. `apply_migration` でブランチに適用
4. `execute_sql` で動作確認(SELECT 数件)
5. `get_advisors` で警告チェック(セキュリティ・パフォーマンス)
6. 問題なければ `merge_branch` で本番反映
7. デプロイ後 `get_logs` でエラー監視

## 失敗時の対応

- **branch で失敗** → 該当 SQL を修正し、`reset_branch` で再試行
- **merge で失敗** → リバート用の逆操作 SQL を `reset_branch` 後に書き直す
- **本番でデータ不整合** → 緊急用バックアップから復旧(`restore_project` は最終手段)

## 禁止事項

- ❌ `DROP TABLE` を idempotent 化せずに書く(本番で消える)
- ❌ RLS なしでテーブルを作る(セキュリティ警告)
- ❌ NOT NULL カラムをバックフィルなしで追加(既存行で失敗)
- ❌ 一つのマイグレーションファイルに複数の論理的変更(レビュー困難)
- ❌ ブランチ検証をスキップして本番直接適用

## 呼ばれ方

- /ship コマンドのマイグレーション段階
- supabase MCP を直接操作するとき
- スキーマ設計の議論時(テンプレ参照用)

## 重要

teachAI のユーザーデータは「ユーザーの所有資産」。RLS を疎かにすると §3.3 Value 3 違反になる。
