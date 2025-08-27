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
