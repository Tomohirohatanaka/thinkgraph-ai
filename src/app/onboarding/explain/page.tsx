'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const sid = sp.get('sid');
  const [topic, setTopic] = useState('');
  const [explanation, setExplanation] = useState('');
  const [phase, setPhase] = useState<'main' | 'await' | 'followup'>('main');
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [followupAnswer, setFollowupAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setTopic(sessionStorage.getItem('onboarding_topic') ?? ''); }, []);

  const expOK = explanation.length >= 100 && explanation.length <= 1500;
  const ansOK = followupAnswer.length >= 30 && followupAnswer.length <= 1500;

  async function submitExplanation() {
    setLoading(true); setPhase('await');
    const res = await fetch('/api/onboarding/explain', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: Number(sid), topic, explanation }),
    });
    const data = await res.json();
    if (!data.ok) { alert(data.error); setLoading(false); setPhase('main'); return; }
    setFollowupQuestion(data.followup_question);
    setPhase('followup'); setLoading(false);
  }

  async function submitFollowup() {
    setLoading(true);
    const res = await fetch('/api/onboarding/followup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: Number(sid), followup_answer: followupAnswer }),
    });
    const data = await res.json();
    if (!data.ok) { alert(data.error); setLoading(false); return; }
    sessionStorage.setItem('onboarding_rationale', JSON.stringify(data.rationale));
    router.push(`/onboarding/reflection?sid=${sid}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="text-sm text-slate-500">トピック</div>
      <div className="text-lg font-semibold">{topic}</div>
      {phase === 'main' && (<>
        <div className="rounded bg-slate-50 p-4">
          <div className="text-sm text-slate-600 mb-2">Mio(生徒)</div>
          <div>「{topic}」について、教えていただけますか?<br />聞き手は私だと思って、自由に始めてください。</div>
        </div>
        <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)}
          placeholder="あなたの言葉で、自由に説明してみてください(100〜1500文字)"
          className="w-full h-64 p-4 border border-slate-300 rounded" maxLength={1500} />
        <div className="text-sm text-slate-500">{explanation.length}/1500</div>
        <button disabled={!expOK || loading} onClick={submitExplanation}
          className="px-6 py-3 bg-slate-900 text-white rounded disabled:opacity-50">送信</button>
      </>)}
      {phase === 'await' && <div>Mio が考えています…</div>}
      {phase === 'followup' && (<>
        <div className="rounded bg-slate-50 p-4">
          <div className="text-sm text-slate-600 mb-2">Mio の問い</div>
          <div>{followupQuestion}</div>
        </div>
        <textarea value={followupAnswer} onChange={(e) => setFollowupAnswer(e.target.value)}
          placeholder="答えてみてください(30〜1500文字)"
          className="w-full h-32 p-4 border border-slate-300 rounded" maxLength={1500} />
        <div className="text-sm text-slate-500">{followupAnswer.length}/1500</div>
        <button disabled={!ansOK || loading} onClick={submitFollowup}
          className="px-6 py-3 bg-slate-900 text-white rounded disabled:opacity-50">終了する</button>
      </>)}
    </div>
  );
}

export default function ExplainPage() {
  return <Suspense fallback={<div className="p-8">読み込み中…</div>}><Inner /></Suspense>;
}
