import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { basePredict } from '../../../lib/predict';

// Create supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Request validation schema
const PredictRequest = z.object({
  carId: z.string(),
  modIds: z.array(z.string())
});

// Simple AI fallback function (placeholder)
async function aiFallback(car: any, mods: any[]): Promise<any> {
  // For now, just return empty object
  // In the future, this could integrate with an AI service
  return {
    notes: ['AI estimation not available - using base calculations only.']
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PredictRequest.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data' }, 
        { status: 400 }
      );
    }

    // Get user ID if authenticated
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id || null;
      } catch (error) {
        // Ignore auth errors for now
      }
    }

    // Fetch car data from car_trims table (updated table name)
    const { carId, modIds } = parsed.data;
    const { data: car, error: carErr } = await supabase
      .from('car_trims') // Updated table name
      .select('*')
      .eq('id', carId)
      .single();
      
    if (carErr || !car) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    }

    // Fetch mods data
    const { data: mods } = await supabase
      .from('mods')
      .select('*')
      .in('id', modIds);

    // Calculate base prediction
    let result = basePredict(car, (mods || []) as any[]);
    
    // Check if we need AI enhancement
    const needsAI = (mods || []).some((m) => m.needs_tune) || (mods || []).length === 0;

    if (needsAI) {
      try {
        const ai = await aiFallback(car, mods || []);
        result = {
          ...result,
          ...ai,
          notes: [...(result.notes || []), ...(ai.notes || [])]
        };
      } catch {
        // Ignore AI failures; return base result
      }
    }

    // Record usage for authenticated users
    if (userId) {
      try {
        await supabase.from('usage_events').insert({ user_id: userId });
      } catch (error) {
        // Ignore usage tracking errors
        console.error('Failed to record usage:', error);
      }
    }

    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
