import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type CarSpecs = {
  stock_hp_bhp?: number | null;
  stock_tq_lbft?: number | null;
  curb_weight_lb?: number | null;
  zero_to_sixty_s_stock?: number | null;
  quarter_mile_s_stock?: number | null;
  source: 'official' | 'community' | 'missing';
};

export async function getCarSpecs(year: number, make: string, model: string, trim_label: string): Promise<CarSpecs> {
  // Step 1: Check car_trims table first (official data)
  const { data: officialData } = await supabase
    .from('car_trims')
    .select('stock_hp_bhp, stock_tq_lbft, curb_weight_lb, zero_to_sixty_s_stock, quarter_mile_s_stock')
    .eq('year', year)
    .eq('make', make)
    .eq('model', model)
    .eq('trim_label', trim_label)
    .single();

  if (officialData && hasCompleteData(officialData)) {
    return { ...officialData, source: 'official' };
  }

  // Step 2: Check community_specs table (approved submissions)
  const { data: communityData } = await supabase
    .from('community_specs')
    .select('stock_hp_bhp, stock_tq_lbft, curb_weight_lb, zero_to_sixty_s_stock, quarter_mile_s_stock')
    .eq('year', year)
    .eq('make', make)
    .eq('model', model)
    .eq('trim_label', trim_label)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (communityData) {
    // Merge official data with community data (official takes priority for each field)
    return {
      stock_hp_bhp: officialData?.stock_hp_bhp ?? communityData.stock_hp_bhp,
      stock_tq_lbft: officialData?.stock_tq_lbft ?? communityData.stock_tq_lbft,
      curb_weight_lb: officialData?.curb_weight_lb ?? communityData.curb_weight_lb,
      zero_to_sixty_s_stock: officialData?.zero_to_sixty_s_stock ?? communityData.zero_to_sixty_s_stock,
      quarter_mile_s_stock: officialData?.quarter_mile_s_stock ?? communityData.quarter_mile_s_stock,
      source: 'community'
    };
  }

  // Step 3: Return partial official data if available, otherwise empty with missing source
  return {
    ...officialData,
    source: 'missing'
  };
}

function hasCompleteData(data: any): boolean {
  return !!(data.stock_hp_bhp && data.stock_tq_lbft && data.curb_weight_lb);
}
