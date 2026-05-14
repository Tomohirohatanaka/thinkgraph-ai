'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Rationale {
  strengths: Array<{ text: string; comment: string }>;
  gaps: Array<{ concept: string; source: string; comment: string }>;
  deep_questions: Array<{ mio_question: string; user_answer: string; comment: string }>;
  next_questions: Array<{ question: string; rationale: string }>;
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const sid = sp.get('sid');
  const [rationale, setRationale] = useState<Rationale | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('onboarding_rationale');
    if (raw) setRationale(JSON.parse(raw));
  }, []);

  if (!rationale) return <div className="p-8">読み込み中…</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-semibold">あなたの説明、こう読みました</h1>
      <p className="text-sm text-slate-600">
        以下はすべてあなた自身の発言の引用に基づいています。評価ではなく、検算の材料として読んでください。
      </p>
      {rationale.strengths.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">構造化できていた点</h2>
          <ul className="space-y-3">
            {rationale.strengths.map((s, i) => (
              <li key={i} className="border-l-4 border-emerald-400 pl-4">
                <div className="italic text-slate-700">「{s.text}」</div>
                <div className="mt-1 text-sm text-slate-600">{s.comment}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rationale.gaps.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">触れたけれど、説明はされなかった概念</h2>
          <ul className="space-y-3">
            {rationale.gaps.map((g, i) => (
              <li key={i} className="border-l-4 border-amber-400 pl-4">
                <div><strong>{g.concept}</strong></div>
                <div className="italic text-slate-700 text-sm mt-1">引用:「{g.source}」</div>
                <div className="mt-1 text-sm text-slate-600">{g.comment}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rationale.deep_questions.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">質問が深まったやりとり</h2>
          <ul className="space-y-3">
            {rationale.deep_questions.map((q, i) => (
              <li key={i} className="border-l-4 border-sky-400 pl-4">
                <div className="text-sm">Mio:「{q.mio_question}」</div>
                <div className="text-sm">あなた:「{q.user_answer}」</div>
                <div className="mt-1 text-sm text-slate-600">{q.comment}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="font-semibold mb-3">次に、あなた自身がもう一度問うとしたら</h2>
        <p className="text-sm text-slate-600 mb-3">
          ※ 「学ぶべきこと」ではなく、あなた自身が次に検算したくなったときの問いです。
        </p>
        <ul className="space-y-3">
          {rationale.next_questions.map((q, i) => (
            <li key={i} className="border-l-4 border-violet-400 pl-4">
              <div className="font-medium">{q.question}</div>
              <div className="mt-1 text-sm text-slate-600">{q.rationale}</div>
            </li>
          ))}
        </ul>
      </section>
      <button className="px-6 py-3 bg-slate-900 text-white rounded"
        onClick={() => router.push(`/onboarding/settings?sid=${sid}`)}>次へ</button>
    </div>
  );
}

export default function ReflectionPage() {
  return <Suspense fallback={<div className="p-8">読み込み中…</div>}><Inner /></Suspense>;
}
