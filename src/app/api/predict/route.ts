import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { basePredict } from '@/lib/predict';
import { aiFallback } from '@/lib/ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const bodySchema = z.object({
  carId: z.string(),
  modIds: z.array(z.string()).default([])
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // identify user (if signed in)
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id || null;

  // limits (tune these later)
  const FREE_DAILY = 3;
  const PLUS_DAILY = 30;
  const PRO_DAILY = 200;

  // quick helper to count today's usage
  async function getTodayCount(uid: string) {
    const start = new Date(); start.setHours(0,0,0,0);
    const { count } = await supabase
      .from('usage_events')
      .select('*', { count: 'exact', head: true })
      .gte('occurred_at', start.toISOString())
      .eq('user_id', uid);
    return count || 0;
  }

  // plan detection (for now everyone = FREE; we’ll wire Stripe next)
  const plan: 'FREE'|'PLUS'|'PRO' = 'FREE';
  const planLimit = plan === 'PRO' ? PRO_DAILY : plan === 'PLUS' ? PLUS_DAILY : FREE_DAILY;

  if (!userId) {
    // anonymous users: client already has a localStorage limit,
    // but we hard-cap here too (e.g., 3/day for anon)
  } else {
    const used = await getTodayCount(userId);
    if (used >= planLimit) {
      return NextResponse.json({ error: `Daily limit reached for ${plan} plan.` }, { status: 429 });
    }
    // record usage (only for successful calls)
    await supabase.from('usage_events').insert({ user_id: userId });
  }
  
  const { carId, modIds } = parsed.data;
  const { data: car, error: carErr } = await supabase.from('cars').select('*').eq('id', carId).single();
  if (carErr || !car) return NextResponse.json({ error: 'Car not found' }, { status: 404 });

  const { data: mods } = await supabase.from('mods').select('*').in('id', modIds);

  let result = basePredict(car as any, (mods || []) as any[]);
  const needsAI = (mods || []).some(m => m.needs_tune) || (mods || []).length === 0;

  if (needsAI) {
    try {
      const ai = await aiFallback(car, mods || []);
      result = { ...result, ...ai, notes: [...(result.notes||[]), ...(ai.notes||[])] };
    } catch { /* ignore */ }
  }
  return NextResponse.json(result);
}
