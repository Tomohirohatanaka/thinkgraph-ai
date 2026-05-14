import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    // 一旦 next を仮の redirect として作成、後で onboarding 判定で上書きする可能性あり
    const response = NextResponse.redirect(new URL(next, origin));

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Onboarding 未完走の新規ユーザーは /onboarding に飛ばす
      const { data: onb } = await supabase
        .from('onboarding_sessions')
        .select('id, current_step')
        .eq('user_id', data.user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 既存ユーザー(onboarding が無いか completed/abandoned)はそのまま next へ
      const needsOnboarding = !onb || (onb.current_step !== 'completed' && onb.current_step !== 'abandoned');

      if (needsOnboarding && next === '/') {
        // ホームに飛ぶ予定だった新規ユーザーのみリダイレクト先を変更
        const onbResp = NextResponse.redirect(new URL('/onboarding', origin));
        // cookies を移植
        response.cookies.getAll().forEach(c => onbResp.cookies.set(c));
        return onbResp;
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
