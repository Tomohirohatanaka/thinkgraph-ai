'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const sid = sp.get('sid');
  const [choice, setChoice] = useState<'yes' | 'no' | 'self'>('self');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await fetch('/api/onboarding/complete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: Number(sid), reminder_opt_in: choice }),
    });
    sessionStorage.removeItem('onboarding_topic');
    sessionStorage.removeItem('onboarding_rationale');
    router.push('/');
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">再検算リマインドの設定</h1>
      <p>今日説明したトピックを、何日後にもう一度検算したいですか?</p>
      <p className="text-sm text-slate-600">※ デフォルトは「自分で決める」です。Streak やバッジ機能はありません。</p>
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="radio" name="r" checked={choice==='self'} onChange={() => setChoice('self')} />
          自分で決める(リマインドなし)
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="radio" name="r" checked={choice==='yes'} onChange={() => setChoice('yes')} />
          3日後と1週間後にリマインド
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="radio" name="r" checked={choice==='no'} onChange={() => setChoice('no')} />
          リマインドは要らない
        </label>
      </div>
      <button disabled={loading} onClick={submit}
        className="px-6 py-3 bg-slate-900 text-white rounded disabled:opacity-50">完了</button>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<div className="p-8">読み込み中…</div>}><Inner /></Suspense>;
}
