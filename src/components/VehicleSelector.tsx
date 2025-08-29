'use client';
import React from 'react';
import { createClient } from '@supabase/supabase-js';

// Create supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Option = { label: string; value: string | number };
type Props = { 
  onChange?: (sel: {
    year?: number;
    make?: string;
    model?: string;
    trim_label?: string;
  }) => void 
};

export default function VehicleSelector({ onChange }: Props) {
  const [years, setYears] = React.useState<Option[]>([]);
  const [makes, setMakes] = React.useState<Option[]>([]);
  const [models, setModels] = React.useState<Option[]>([]);
  const [trims, setTrims] = React.useState<Option[]>([]);
  const [year, setYear] = React.useState<number>();
  const [make, setMake] = React.useState<string>();
  const [model, setModel] = React.useState<string>();
  const [trim_label, setTrimLabel] = React.useState<string>();

  // Load years from car_trims table
  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('car_trims')
        .select('year')
        .order('year', { ascending: false });
      
      if (data) {
        // Get unique years
        const uniqueYears = [...new Set(data.map((r: any) => r.year))];
        setYears(uniqueYears.map(year => ({ label: String(year), value: year })));
      }
    })();
