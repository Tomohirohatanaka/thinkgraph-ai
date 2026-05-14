'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/onboarding/start', { method: 'POST' });
      const data = await res.json();
      if (data.redirect_to) { router.replace(data.redirect_to); return; }
      if (data.ok && data.session) {
        setSessionId(data.session.id);
        setLoading(false);
      } else {
        router.replace('/');
      }
    })();
  }, [router]);

  if (loading) return <div className="p-8">準備しています…</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">teachAIへようこそ</h1>
      <p className="text-lg leading-relaxed">
        これは「学ぶ」ためのツールではありません。<br />
        あなたが <strong>既に知っていること</strong> を、声に出して説明することで <strong>検算する</strong> ための道具です。
      </p>
      <p className="text-lg leading-relaxed">
        次の画面で、あなたが今、誰かに説明できるはずだと思っているものを、ひとつだけ書いてください。
      </p>
      <button
        className="px-6 py-3 bg-slate-900 text-white rounded"
        onClick={() => router.push(`/onboarding/pick-topic?sid=${sessionId}`)}
      >
        次へ
      </button>
    </div>
  );
}
