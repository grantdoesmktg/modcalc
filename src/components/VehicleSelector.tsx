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
      const { data, error } = await supabase
        .from('car_trims')
        .select('year')
        .order('year', { ascending: false });
      
      if (error) {
        console.error('Error fetching years:', error);
        return;
      }
      
      if (data) {
        // Get unique years and sort them
        const uniqueYears = [...new Set(data.map((r: any) => r.year))].sort((a, b) => b - a);
        console.log('Found years:', uniqueYears); // Debug log
        setYears(uniqueYears.map(year => ({ label: String(year), value: year })));
      }
    })();
  }, []);

  // Year -> Makes
  React.useEffect(() => {
    setMake(undefined);
    setModel(undefined);
    setTrimLabel(undefined);
    setModels([]);
    setTrims([]);
    
    if (!year) {
      setMakes([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('car_trims')
        .select('make')
        .eq('year', year)
        .order('make');
      
      if (error) {
        console.error('Error fetching makes:', error);
        return;
      }
      
      if (data) {
        // Get unique makes
        const uniqueMakes = [...new Set(data.map((r: any) => r.make))].sort();
        console.log('Found makes for', year, ':', uniqueMakes); // Debug log
        setMakes(uniqueMakes.map(make => ({ label: make, value: make })));
      }
    })();
  }, [year]);

  // Make -> Models
  React.useEffect(() => {
    setModel(undefined);
    setTrimLabel(undefined);
    setTrims([]);
    
    if (!year || !make) {
      setModels([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('car_trims')
        .select('model')
        .eq('year', year)
        .eq('make', make)
        .order('model');
      
      if (error) {
        console.error('Error fetching models:', error);
        return;
      }
      
      if (data) {
        // Get unique models
        const uniqueModels = [...new Set(data.map((r: any) => r.model))].sort();
        console.log('Found models for', year, make, ':', uniqueModels); // Debug log
        setModels(uniqueModels.map(model => ({ label: model, value: model })));
      }
    })();
  }, [year, make]);

  // Model -> Trims
  React.useEffect(() => {
    setTrimLabel(undefined);
    
    if (!year || !make || !model) {
      setTrims([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('car_trims')
        .select('trim_label')
        .eq('year', year)
        .eq('make', make)
        .eq('model', model)
        .order('trim_label');
      
      if (error) {
        console.error('Error fetching trims:', error);
        return;
      }
      
      if (data) {
        // Get unique trim labels
        const uniqueTrims = [...new Set(data.map((r: any) => r.trim_label))].sort();
        console.log('Found trims for', year, make, model, ':', uniqueTrims); // Debug log
        setTrims(uniqueTrims.map(trim => ({ label: trim, value: trim })));
      }
    })();
  }, [year, make, model]);

  // Call onChange when selection is complete
  React.useEffect(() => {
    onChange?.({ year, make, model, trim_label });
  }, [year, make, model, trim_label, onChange]);

  return (
    <div className="flex flex-col gap-3">
      <Select 
        label="Year" 
        value={year} 
        onChange={(v) => setYear(v ? Number(v) : undefined)} 
        options={years}
      />
      
      <Select 
        label="Make" 
        value={make} 
        onChange={(v) => setMake(v || undefined)} 
        options={makes} 
        disabled={!year}
      />
      
      <Select 
        label="Model" 
        value={model} 
        onChange={(v) => setModel(v || undefined)} 
        options={models} 
        disabled={!year || !make}
      />
      
      <Select 
        label="Trim" 
        value={trim_label} 
        onChange={(v) => setTrimLabel(v || undefined)} 
        options={trims} 
        disabled={!year || !make || !model}
      />
    </div>
  );
}

function Select({ 
  label, 
  value, 
  onChange, 
  options, 
  disabled 
}: {
  label: string;
  value?: string | number;
  onChange: (v: string | null) => void;
  options: Option[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-300 font-medium">{label}</span>
      <select 
        className="select-modern"
        disabled={disabled} 
        value={value ?? ''} 
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">
          {disabled ? `Select ${label.toLowerCase()} above first` : `Select ${label.toLowerCase()}`}
        </option>
        {options.map(o => (
          <option key={`${label}-${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
