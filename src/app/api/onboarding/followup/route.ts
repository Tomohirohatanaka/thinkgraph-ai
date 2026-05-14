import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateReflection } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { session_id, followup_answer, user_api_key } = await req.json();
    if (typeof followup_answer !== 'string' || followup_answer.length < 30 || followup_answer.length > 1500) {
      return NextResponse.json({ ok: false, error: 'answer must be 30-1500 chars' }, { status: 400 });
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

    const { data: session, error: fetchErr } = await supabase
      .from('onboarding_sessions').select('*')
      .eq('id', session_id).eq('user_id', user.id)
      .single();
    if (fetchErr || !session) return NextResponse.json({ ok: false, error: 'session not found' }, { status: 404 });

    const { rationale } = await generateReflection(
      user.id, session.topic, session.explanation, session.followup_question, followup_answer, user_api_key,
    );

    const { error } = await supabase
      .from('onboarding_sessions')
      .update({
        followup_answer, rationale,
        solo_score: rationale.solo_score, rqs_score: rationale.rqs_score,
        current_step: 'reflection', last_step_at: new Date().toISOString(),
      })
      .eq('id', session_id).eq('user_id', user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, rationale });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.startsWith('trial quota') ? 429 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
