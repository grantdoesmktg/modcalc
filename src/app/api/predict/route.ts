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
  // --- validate body
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // --- identify user (if signed in)
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // --- limits (tune later)
  const FREE_DAILY = 3;
  const PLUS_DAILY = 30;
  const PRO_DAILY = 200;

  // --- plan detection (wire to Stripe later)
  // Optionally set NEXT_PUBLIC_DEFAULT_PLAN in Vercel (FREE|PLUS|PRO).
  const limits = { FREE: FREE_DAILY, PLUS: PLUS_DAILY, PRO: PRO_DAILY } as const;
  const envPlan = process.env.NEXT_PUBLIC_DEFAULT_PLAN as keyof typeof limits | undefined;
  const plan: keyof typeof limits = envPlan ?? 'FREE';
  const planLimit = limits[plan];

  // --- helper: count today's usage for a user
  async function getTodayCount(uid: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('usage_events')
      .select('*', { count: 'exact', head: true })
      .gte('occurred_at', start.toISOString())
      .eq('user_id', uid);
    return count || 0;
  }

  // --- enforce server-side limit for signed-in users
  if (userId) {
    const used = await getTodayCount(userId);
    if (used >= planLimit) {
      return NextResponse.json(
        { error: `Daily limit reached for ${plan} plan.` },
        { status: 429 }
      );
    }
  }
  // (Anonymous users are already rate-limited in the client via localStorage.)

  // --- fetch data
  const { carId, modIds } = parsed.data;
  const { data: car, error: carErr } = await supabase
    .from('cars')
    .select('*')
    .eq('id', carId)
    .single();
  if (carErr || !car) {
    return NextResponse.json({ error: 'Car not found' }, { status: 404 });
  }

  const { data: mods } = await supabase
    .from('mods')
    .select('*')
    .in('id', modIds);

  // --- compute
  let result = basePredict(car as any, (mods || []) as any[]);
  const needsAI =
    (mods || []).some((m) => m.needs_tune) || (mods || []).length === 0;

  if (needsAI) {
    try {
      const ai = await aiFallback(car, mods || []);
      result = {
        ...result,
        ...ai,
        notes: [...(result.notes || []), ...(ai.notes || [])]
      };
    } catch {
      // ignore AI failures; return base result
    }
  }

  // --- record usage AFTER a successful prediction (signed-in users only)
  if (userId) {
    await supabase.from('usage_events').insert({ user_id: userId });
  }

  return NextResponse.json(result);
}
