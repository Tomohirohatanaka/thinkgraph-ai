/**
 * Onboarding business logic
 * - 既存の trial-key.ts(無料キー解決)と llm.ts(マルチプロバイダー)を活用
 * - サーバーサイド側の trial_usage_log で月50回まで制限
 */
import { createClient } from '@supabase/supabase-js';
import { callLLM, detectProvider, getSmartModel, type LLMResponse } from '@/lib/llm';
import { resolveApiKey } from '@/lib/trial-key';
import {
  MIO_FOLLOWUP_SYSTEM, MIO_FOLLOWUP_USER,
  REFLECTION_SYSTEM, REFLECTION_USER,
} from '@/prompts/mio_onboarding';

export type Variant = 'v1_full' | 'v0_control';
export type Step = 'welcome' | 'pick_topic' | 'explain' | 'reflection' | 'settings' | 'completed' | 'abandoned';

export interface Rationale {
  strengths: Array<{ text: string; comment: string }>;
  gaps: Array<{ concept: string; source: string; comment: string }>;
  deep_questions: Array<{ mio_question: string; user_answer: string; comment: string }>;
  next_questions: Array<{ question: string; rationale: string }>;
  solo_score: number;
  rqs_score: number;
}

// ----- 月50回まで(課金前提なので将来 subscriptions テーブルと連動) -----
export const TRIAL_LIMIT_PER_MONTH = 50;

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function checkTrialQuota(userId: string): Promise<{ ok: boolean; used: number; limit: number }> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('trial_usage_count', { p_user_id: userId, p_days: 30 });
  if (error) {
    console.warn('trial_usage_count error:', error);
    return { ok: true, used: 0, limit: TRIAL_LIMIT_PER_MONTH }; // fail-open
  }
  const used = (data as number) ?? 0;
  return { ok: used < TRIAL_LIMIT_PER_MONTH, used, limit: TRIAL_LIMIT_PER_MONTH };
}

export async function logTrialUsage(
  userId: string, endpoint: string, res: LLMResponse,
): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from('trial_usage_log').insert({
    user_id: userId, endpoint,
    provider: res.provider, model: res.model,
    input_tokens: res.usage?.input ?? 0,
    output_tokens: res.usage?.output ?? 0,
  });
}

// ---------- A/B variant ----------
export async function assignVariant(userId: string): Promise<Variant> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('assign_onboarding_variant', { p_user_id: userId });
  if (error) throw error;
  return data as Variant;
}

// ---------- セッション開始 / 再開 ----------
export async function startOrResume(userId: string) {
  const supabase = getServiceClient();
  const variant = await assignVariant(userId);

  const { data: existing } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('current_step', 'in', '(completed,abandoned)')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('onboarding_sessions')
    .insert({ user_id: userId, variant, current_step: 'welcome' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Mio の補足質問 ----------
export async function generateFollowupQuestion(
  userId: string, topic: string, explanation: string, userApiKey?: string,
): Promise<{ question: string; isTrial: boolean }> {
  // クォータチェック(trial の場合のみ)
  const resolved = resolveApiKey(userApiKey);
  if (!resolved) throw new Error('No API key available');
  if (resolved.isTrial) {
    const q = await checkTrialQuota(userId);
    if (!q.ok) throw new Error(`trial quota exceeded (${q.used}/${q.limit})`);
  }

  const provider = detectProvider(resolved.key);
  const res = await callLLM({
    provider,
    apiKey: resolved.key,
    model: getSmartModel(provider),
    system: MIO_FOLLOWUP_SYSTEM,
    messages: [{ role: 'user', content: MIO_FOLLOWUP_USER(topic, explanation) }],
    maxTokens: 500,
    temperature: 0.7,
  });

  if (resolved.isTrial) await logTrialUsage(userId, 'onboarding_followup', res);

  const parsed = extractJSON<{ followup_question: string }>(res.text);
  let question = String(parsed.followup_question ?? '').trim();

  // 致命傷 A 対応: 命令形ガード
  if (containsCommandOrRecommendation(question)) {
    console.warn('[character-violation] followup contained command, using fallback');
    question = 'すみません、もう少し具体的に教えていただけますか?';
  }
  return { question, isTrial: resolved.isTrial };
}

// ---------- Reflection ----------
export async function generateReflection(
  userId: string,
  topic: string, explanation: string, mio_q: string, user_a: string,
  userApiKey?: string,
): Promise<{ rationale: Rationale; isTrial: boolean }> {
  const resolved = resolveApiKey(userApiKey);
  if (!resolved) throw new Error('No API key available');
  if (resolved.isTrial) {
    const q = await checkTrialQuota(userId);
    if (!q.ok) throw new Error(`trial quota exceeded (${q.used}/${q.limit})`);
  }

  const provider = detectProvider(resolved.key);
  const res = await callLLM({
    provider,
    apiKey: resolved.key,
    model: getSmartModel(provider),
    system: REFLECTION_SYSTEM,
    messages: [{ role: 'user', content: REFLECTION_USER(topic, explanation, mio_q, user_a) }],
    maxTokens: 2000,
    temperature: 0.5,
  });

  if (resolved.isTrial) await logTrialUsage(userId, 'onboarding_reflection', res);

  const rationale = extractJSON<Rationale>(res.text);

  // 命令形ガード
  rationale.next_questions = (rationale.next_questions ?? [])
    .filter(q => !containsCommandOrRecommendation(q.question));
  if (rationale.next_questions.length === 0) {
    rationale.next_questions = [{
      question: '今日説明したことを、3日後の自分はどこまで覚えていそうですか?',
      rationale: '自己観察のための問い(fallback)',
    }];
  }

  rationale.strengths = rationale.strengths ?? [];
  rationale.gaps = rationale.gaps ?? [];
  rationale.deep_questions = rationale.deep_questions ?? [];
  rationale.solo_score = rationale.solo_score ?? 0;
  rationale.rqs_score = rationale.rqs_score ?? 0;

  return { rationale, isTrial: resolved.isTrial };
}

// ---------- Helpers ----------
function extractJSON<T = unknown>(text: string): T {
  try { return JSON.parse(text) as T; } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]) as T; } catch {} }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch {} }
  throw new Error(`No valid JSON in LLM response: ${text.slice(0, 200)}`);
}

const COMMAND_PATTERNS = [
  /勉強し[たて]/, /学び[まな]/, /学習し/, /調べ[まて]/, /覚え[まて]/,
  /(?:する|やる|読む|書く|学ぶ|考える)と(?:良い|いい|よい|よ\b)/,
  /してください/, /しましょう/, /ましょう\b/,
  /推奨/, /おすすめ/, /お勧め/, /お薦め/,
  /^(?:まず|次に|それから|最後に)/m,
];

export function containsCommandOrRecommendation(text: string): boolean {
  return COMMAND_PATTERNS.some(p => p.test(text));
}
