---
name: verify-install
description: teachAIのClaude設定(Skills/Subagents/Commands)が正しく配置されているかを検査するスキル。frontmatterの妥当性、name/descriptionの必須フィールド、ディレクトリ名とname宣言の一致、サブエージェントから呼ばれるスキル名の存在確認、CLAUDE.mdの整合性を網羅的にチェックする。初回インストール後、月次レビュー、PR受け入れ後に呼ばれる。
---

# Verify Install — 配置検証スキル

teachAI の `.claude/` ディレクトリと `~/.claude/` の状態を検査する。

## 検査項目

### 1. ファイル存在
- 期待される Skill / Agent / Command ファイルがすべて存在するか
- 想定外のファイル(typo・古い世代の残骸)がないか

### 2. Frontmatter 妥当性
- 各 .md の 1 行目が `---` で始まるか
- 終端 `---` の後に本文があるか
- YAML として正しいか(コロン後にスペース、改行のみで終わる等)

### 3. 必須フィールド
- `name:` が存在するか
- `description:` が存在するか
- description が空文字でないか(`description: `)

### 4. 命名一致
- Skill: `skills/<dir>/SKILL.md` の `name` が `<dir>` と一致するか
- Agent: `agents/<file>.md` の `name` が `<file>` と一致するか
- Command: `commands/<file>.md` の filename がコマンド名として妥当か

### 5. 依存関係の生存
- 各サブエージェント記述内で言及されている Skill 名が、実在するか
- スラッシュコマンドが呼ぶサブエージェント名が実在するか
- `CLAUDE.md` で言及されている Skill / Agent / Command 名がすべて実在するか

### 6. 重複・衝突
- 同名の Skill / Agent が複数階層に存在しないか
- (存在する場合、プロジェクトレベルが優先される。意図か確認)

## 検査スクリプト(Bash)

```bash
#!/usr/bin/env bash
set -e

PROJECT_DIR="${1:-.}"
USER_DIR="${HOME}/.claude"

cd "$PROJECT_DIR"

errors=()

# 1. 期待ファイル数
expect_skills=14
expect_agents=10
expect_commands=5

actual_skills=$(find .claude/skills -name SKILL.md | wc -l)
actual_agents=$(find .claude/agents -name "*.md" | wc -l)
actual_commands=$(find .claude/commands -name "*.md" | wc -l)

[ "$actual_skills"   = "$expect_skills"   ] || errors+=("Skills count: $actual_skills != $expect_skills")
[ "$actual_agents"   = "$expect_agents"   ] || errors+=("Agents count: $actual_agents != $expect_agents")
[ "$actual_commands" = "$expect_commands" ] || errors+=("Commands count: $actual_commands != $expect_commands")

# 2. Frontmatter
for f in .claude/skills/*/SKILL.md .claude/agents/*.md .claude/commands/*.md; do
    head -1 "$f" | grep -q "^---" || errors+=("Missing frontmatter: $f")
done

# 3. 必須フィールド
for f in .claude/skills/*/SKILL.md .claude/agents/*.md; do
    grep -q "^name:" "$f" || errors+=("Missing name: $f")
    grep -q "^description:" "$f" || errors+=("Missing description: $f")
    desc=$(grep "^description:" "$f" | sed 's/description: *//')
    [ -n "$desc" ] || errors+=("Empty description: $f")
done

# 4. 命名一致
for d in .claude/skills/*/; do
    dir=$(basename "$d")
    name=$(grep "^name:" "$d/SKILL.md" | head -1 | sed 's/name: *//')
    [ "$dir" = "$name" ] || errors+=("Skill name mismatch: dir=$dir name=$name")
done
for f in .claude/agents/*.md; do
    base=$(basename "$f" .md)
    name=$(grep "^name:" "$f" | head -1 | sed 's/name: *//')
    [ "$base" = "$name" ] || errors+=("Agent name mismatch: file=$base name=$name")
done

# 5. 依存関係(言及されているスキル/エージェントが実在するか)
all_skills=$(ls .claude/skills/ 2>/dev/null)
all_agents=$(ls .claude/agents/ 2>/dev/null | sed 's/\.md$//')

for f in .claude/agents/*.md .claude/commands/*.md; do
    # 「sks-name スキル」「`name` サブエージェント」のような言及を抽出
    refs=$(grep -oE '`[a-z][a-z0-9-]+`' "$f" | tr -d '`' | sort -u)
    for r in $refs; do
        # 既知の英単語(skill/agent/spec等)を除外しつつ、teachAI 固有のものをチェック
        case "$r" in
            teachai-*|polaris-*|solo-rqs-*|character-*|explainability-*|supabase-*|vercel-*|x-post-*|note-article-*|patent-*|sales-*|bookkeeping-*|verify-*)
                # Skill 系
                echo "$all_skills" | grep -q "^$r$" || errors+=("Reference to non-existent skill '$r' in $f")
                ;;
            anti-value-*|cold-*|assessment-*|code-*|deploy-*|growth-*|character-consistency|sales-coach|accountant|patent-strategist)
                # Agent 系
                echo "$all_agents" | grep -q "^$r$" || errors+=("Reference to non-existent agent '$r' in $f")
                ;;
        esac
    done
done

# 6. CLAUDE.md
[ -f "CLAUDE.md" ] || errors+=("Missing CLAUDE.md at repo root")

# 結果
if [ ${#errors[@]} -eq 0 ]; then
    echo "[OK] All verification checks passed"
    echo "  Skills:   $actual_skills"
    echo "  Agents:   $actual_agents"
    echo "  Commands: $actual_commands"
else
    echo "[FAIL] ${#errors[@]} issues found:"
    for e in "${errors[@]}"; do echo "  - $e"; done
    exit 1
fi
```

## 出力フォーマット

```
# Verify Install Report

対象: <thinkgraph-ai / ~/.claude>
実行時刻: ...

## カウント
- Skills:   X (期待: Y) [OK/NG]
- Agents:   X (期待: Y) [OK/NG]
- Commands: X (期待: Y) [OK/NG]

## Frontmatter
- 全 X ファイルで OK / NG: 詳細

## 命名一致
- 全 X 件で OK / 不一致: ...

## 依存関係
- 言及された参照 X 件中、X 件が実在 / 不在: ...

## 統合判定
合格 / 要修正
ブロッカー: ...
```

## 呼ばれ方

- 初回インストール直後(DEPLOY.md からの誘導)
- 月次レビュー時(`cold-consultant` 経由)
- `.claude/` ディレクトリの大きな変更後の PR
- 何らかのスキルが期待通り動かないとき(切り分け)

## 重要

このスキルは「壊れていないか」だけを見る。中身の質(プロンプトが良いか、判断基準が妥当か)は見ない。それは別の人間のレビュー or `cold-consultant` の仕事。
