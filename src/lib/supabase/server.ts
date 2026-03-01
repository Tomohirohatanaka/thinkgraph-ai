import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'https://your-project-ref.supabase.co');
}

export async function createClient() {
  const cookieStore = await cookies();

  const url = isSupabaseConfigured() ? SUPABASE_URL : 'https://placeholder.supabase.co';
  const key = isSupabaseConfigured() ? SUPABASE_ANON_KEY : 'placeholder-key';

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from Server Component – ignore
        }
      },
    },
  });
}
