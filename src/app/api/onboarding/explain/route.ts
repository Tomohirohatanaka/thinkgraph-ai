import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateFollowupQuestion } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { session_id, topic, explanation, user_api_key } = await req.json();

    if (typeof topic !== 'string' || topic.length < 5 || topic.length > 200) {
      return NextResponse.json({ ok: false, error: 'invalid topic length (5-200)' }, { status: 400 });
    }
    if (typeof explanation !== 'string' || explanation.length < 100 || explanation.length > 1500) {
      return NextResponse.json({ ok: false, error: 'explanation must be 100-1500 chars' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(toSet) { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
        },
      },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { question } = await generateFollowupQuestion(user.id, topic, explanation, user_api_key);

    const { error } = await supabase
      .from('onboarding_sessions')
      .update({
        topic, explanation, followup_question: question,
        current_step: 'explain', last_step_at: new Date().toISOString(),
      })
      .eq('id', session_id).eq('user_id', user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, followup_question: question });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.startsWith('trial quota') ? 429 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
