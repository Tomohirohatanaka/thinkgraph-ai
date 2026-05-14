---
description: キャラクター(Mio/Rin/Kai/Hana/Zou-kun)関連のプロンプト・セリフ・テンプレを§11と整合チェック。
---

# /character-check

キャラクター関連の変更を整合性チェックします。

## 実行内容

1. **character-consistency サブエージェントを呼ぶ**
2. 内部で `character-voice-check` スキルを実行
3. 必要に応じて `teachai-anti-value-audit` で #6(代わりに考える)抵触チェック
4. 重大違反 / 軽微違反を分けて報告

## 使い方

```
/character-check <ファイルパス または PR 番号>
```

## 出力

character-consistency のフォーマットを参照。
