'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const sid = sp.get('sid');
  const [topic, setTopic] = useState('');
  const canProceed = topic.trim().length >= 5 && topic.trim().length <= 200;

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">何を検算しますか?</h1>
      <p>今、あなたが誰かに説明できるはずだと思っているものを、ひとつだけ書いてください。</p>
      <p className="text-sm text-slate-600">※ 候補を選ぶ画面ではありません。AI のおすすめもしません。</p>
      <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
        placeholder="例:契約自由の原則、リレーショナルDBの正規化、複利の概念"
        className="w-full px-4 py-3 border border-slate-300 rounded" maxLength={200} />
      <div className="text-sm text-slate-500">{topic.length}/200</div>
      <button disabled={!canProceed}
        className="px-6 py-3 bg-slate-900 text-white rounded disabled:opacity-50"
        onClick={() => {
          sessionStorage.setItem('onboarding_topic', topic.trim());
          router.push(`/onboarding/explain?sid=${sid}`);
        }}>次へ</button>
    </div>
  );
}

export default function PickTopicPage() {
  return <Suspense fallback={<div className="p-8">読み込み中…</div>}><Inner /></Suspense>;
}
