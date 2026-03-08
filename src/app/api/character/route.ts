import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { corsResponse } from "@/lib/api";
import { resolveApiKey } from "@/lib/trial-key";

const DEFAULT_CHARACTER = {
  id: "mio", name: "ミオ", emoji: "👧", color: "#FF6B9D",
  personality: "元気で好奇心旺盛。ちょっとおっちょこちょいだけど一生懸命。教えてもらうのが大好き。",
  speaking_style: "タメ口で親しみやすい。語尾に「！」「〜」が多い。「えっ！」「すごい！」など感嘆詞豊富。",
  praise: "「えっ、すごい！！めっちゃわかった！！もっと教えて〜！」",
  struggle: "「えっとぉ…ごめんね、もう一回ゆっくり教えてくれる？」",
  confused: "「うーん、そこがよくわかんないんだけど…なんで？」",
  intro: "はじめまして！ミオだよ〜！ たくさん教えてね、一緒に頑張ろ！",
  lore: "教えてもらうのが大好きな女の子。一緒に成長していく。",
  interests: [] as string[], knowledge_areas: [] as string[],
  growth_stages: [
    { label: "出会ったばかり", threshold: 0 }, { label: "なかよし", threshold: 3 },
    { label: "信頼の絆", threshold: 8 }, { label: "ずっと一緒", threshold: 15 },
    { label: "かけがえのない存在", threshold: 30 },
  ],
  evolution_log: [] as string[],
};

export async function GET() {
  return NextResponse.json({ character: DEFAULT_CHARACTER });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      apiKey: string; mode: "evolve" | "init";
      currentChar?: typeof DEFAULT_CHARACTER;
      session?: { title: string; mode: string; score: number; mastered: string[]; gaps: string[]; feedback?: string };
      profile?: Array<{ title: string; score: number; mastered: string[]; gaps: string[] }>;
    };
    const { apiKey, mode, currentChar, session, profile } = body;
    const resolved = resolveApiKey(apiKey);
    if (!resolved) return NextResponse.json({ error: "APIキーが必要です" }, { status: 400 });
    const effectiveKey = resolved.key;
    const provider = detectProvider(effectiveKey);

    if (mode === "init") {
      const profileStr = (profile || []).slice(0, 5).map(e => `「${e.title}」${e.score}点`).join("、") || "まだ学習なし";
      const charIds = ["mio", "sora", "haru", "rin"];
      const chosenId = charIds[Math.floor(Math.random() * charIds.length)];
      const prompt = `ユーザーのAI学習パートナーを1体生成してください。学習履歴: ${profileStr}
以下のJSONのみ出力（idは必ず"${chosenId}"を使用）:
{"id":"${chosenId}","name":"ひらがな2〜4文字","emoji":"絵文字1文字","color":"#hex","personality":"性格20〜40文字","speaking_style":"口調20〜40文字","praise":"「褒めセリフ」","struggle":"「困惑セリフ」","confused":"「質問セリフ」","intro":"初回挨拶50〜80文字","lore":"バックストーリー30文字以内","interests":["興味1","興味2"],"knowledge_areas":[],"growth_stages":[{"label":"出会い","threshold":0},{"label":"なかよし","threshold":3},{"label":"心の友","threshold":8},{"label":"ずっとそばに","threshold":15}],"evolution_log":[]}`;
      const res = await callLLM({ provider, apiKey: effectiveKey, messages: [{ role: "user", content: prompt }], maxTokens: 800 });
      const m = res.text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim().match(/\{[\s\S]*\}/);
      if (!m) return NextResponse.json({ error: "生成失敗" }, { status: 500 });
      return NextResponse.json({ character: JSON.parse(m[0]) });
    }

    if (mode === "evolve" && currentChar && session) {
      const prompt = `AIキャラ「${currentChar.name}」${currentChar.emoji}が「${session.title}」を学習しました（スコア${session.score}点）。
習得: ${(session.mastered||[]).join("、")||"なし"}
ギャップ: ${(session.gaps||[]).join("、")||"なし"}
現在の性格: ${currentChar.personality}
現在の口調: ${currentChar.speaking_style}
現在の興味: ${(currentChar.interests||[]).join("、")||"なし"}

スコアに応じて性格を少しだけ進化させ、以下JSONのみ出力:
{"personality":"進化後の性格","speaking_style":"進化後の口調","praise":"「褒めセリフ」","struggle":"「困惑セリフ」","confused":"「質問セリフ」","interests":["興味（最大5つ）"],"knowledge_areas":["知識エリア（最大10）"],"evolution_note":"進化ポイント1文"}`;
      const res = await callLLM({ provider, apiKey: effectiveKey, messages: [{ role: "user", content: prompt }], maxTokens: 600 });
      const m = res.text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim().match(/\{[\s\S]*\}/);
      if (!m) return NextResponse.json({ error: "進化失敗" }, { status: 500 });
      const evolved = JSON.parse(m[0]);
      return NextResponse.json({ character: {
        ...currentChar,
        personality: evolved.personality ?? currentChar.personality,
        speaking_style: evolved.speaking_style ?? currentChar.speaking_style,
        praise: evolved.praise ?? currentChar.praise,
        struggle: evolved.struggle ?? currentChar.struggle,
        confused: evolved.confused ?? currentChar.confused,
        interests: evolved.interests ?? currentChar.interests ?? [],
        knowledge_areas: evolved.knowledge_areas ?? currentChar.knowledge_areas ?? [],
        evolution_log: [...(currentChar.evolution_log||[]).slice(-9), `「${session.title}」を学習: ${evolved.evolution_note??"成長した"}`],
      }});
    }

    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "エラー" }, { status: 500 });
  }
}
export async function OPTIONS() { return corsResponse(); }
