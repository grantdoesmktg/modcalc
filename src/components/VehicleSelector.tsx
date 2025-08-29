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

  // Load years from car_years table (or car_trims as fallback)
  React.useEffect(() => {
    (async () => {
      console.log('Starting year fetch...');
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      try {
        // First, try to fetch from car_years table
        let { data, error, count } = await supabase
          .from('car_years')
          .select('year', { count: 'exact' })
          .order('year', { ascending: false });
        
        console.log('car_years query result:', { data, error, count });
        
        // If car_years table doesn't exist or fails, fallback to car_trims
        if (error && error.code === 'PGRST116') {
          console.log('car_years table not found, falling back to car_trims...');
          const fallbackResult = await supabase
            .from('car_trims')
            .select('year', { count: 'exact' })
            .order('year', { ascending: false });
          
          data = fallbackResult.data;
          error = fallbackResult.error;
          count = fallbackResult.count;
          console.log('car_trims query result:', { data, error, count });
        }
        
        if (error) {
          console.error('Error fetching years:', error);
          console.error('Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          
          // Use fallback years if both queries fail
          console.log('Using fallback years due to query errors');
          const fallbackYears = Array.from({ length: 25 }, (_, i) => 2024 - i); // 2024 down to 2000
          setYears(fallbackYears.map(year => ({ label: String(year), value: year })));
          return;
        }
        
        if (data && data.length > 0) {
          console.log('Raw year data:', data);
          // Get unique years and sort them
          const uniqueYears = [...new Set(data.map((r: any) => r.year))].sort((a, b) => b - a);
          console.log('Processed unique years:', uniqueYears);
          
          if (uniqueYears.length > 0 && uniqueYears[0] !== null && uniqueYears[0] !== undefined) {
            setYears(uniqueYears.map(year => ({ label: String(year), value: year })));
          } else {
            console.log('No valid years found, using fallback');
            // Extended fallback years
            const fallbackYears = Array.from({ length: 25 }, (_, i) => 2024 - i); // 2024 down to 2000
            setYears(fallbackYears.map(year => ({ label: String(year), value: year })));
          }
        } else {
          console.log('No data returned from query, using fallback years');
          // Extended fallback years
          const fallbackYears = Array.from({ length: 25 }, (_, i) => 2024 - i); // 2024 down to 2000
          setYears(fallbackYears.map(year => ({ label: String(year), value: year })));
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        // Use fallback years on any unexpected error
        const fallbackYears = Array.from({ length: 25 }, (_, i) => 2024 - i); // 2024 down to 2000
        setYears(fallbackYears.map(year => ({ label: String(year), value: year })));
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
      try {
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
          // Get unique makes and filter out null/undefined values
          const uniqueMakes = [...new Set(data.map((r: any) => r.make))]
            .filter(make => make !== null && make !== undefined && make !== '')
            .sort();
          
          console.log('Found makes for', year, ':', uniqueMakes);
          setMakes(uniqueMakes.map(make => ({ label: make, value: make })));
        }
      } catch (err) {
        console.error('Unexpected error fetching makes:', err);
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
      try {
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
          // Get unique models and filter out null/undefined values
          const uniqueModels = [...new Set(data.map((r: any) => r.model))]
            .filter(model => model !== null && model !== undefined && model !== '')
            .sort();
          
          console.log('Found models for', year, make, ':', uniqueModels);
          setModels(uniqueModels.map(model => ({ label: model, value: model })));
        }
      } catch (err) {
        console.error('Unexpected error fetching models:', err);
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
      try {
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
          // Get unique trim labels and filter out null/undefined values
          const uniqueTrims = [...new Set(data.map((r: any) => r.trim_label))]
            .filter(trim => trim !== null && trim !== undefined && trim !== '')
            .sort();
          
          console.log('Found trims for', year, make, model, ':', uniqueTrims);
          setTrims(uniqueTrims.map(trim => ({ label: trim, value: trim })));
        }
      } catch (err) {
        console.error('Unexpected error fetching trims:', err);
      }
    })();
  }, [year, make, model]);

  // Call onChange when selection is complete
  React.useEffect(() => {
    onChange?.({
      year,
      make,
      model,
      trim_label
    });
  }, [year, make, model, trim_label, onChange]);

  return (
    <div className="space-y-4">
      {/* Year Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select year
        </label>
        <select 
          value={year || ''} 
          onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select year</option>
          {years.map(yearOption => (
            <option key={yearOption.value} value={yearOption.value}>
              {yearOption.label}
            </option>
          ))}
        </select>
        {years.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">Loading years...</p>
        )}
      </div>

      {/* Make Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Make
        </label>
        <select 
          value={make || ''} 
          onChange={(e) => setMake(e.target.value || undefined)}
          disabled={!year}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select make</option>
          {makes.map(makeOption => (
            <option key={makeOption.value} value={makeOption.value}>
              {makeOption.label}
            </option>
          ))}
        </select>
        {year && makes.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">Loading makes...</p>
        )}
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Model
        </label>
        <select 
          value={model || ''} 
          onChange={(e) => setModel(e.target.value || undefined)}
          disabled={!make}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select model</option>
          {models.map(modelOption => (
            <option key={modelOption.value} value={modelOption.value}>
              {modelOption.label}
            </option>
          ))}
        </select>
        {make && models.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">Loading models...</p>
        )}
      </div>

      {/* Trim Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Trim
        </label>
        <select 
          value={trim_label || ''} 
          onChange={(e) => setTrimLabel(e.target.value || undefined)}
          disabled={!model}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select trim</option>
          {trims.map(trimOption => (
            <option key={trimOption.value} value={trimOption.value}>
              {trimOption.label}
            </option>
          ))}
        </select>
        {model && trims.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">Loading trims...</p>
        )}
      </div>
    </div>
  );
}
