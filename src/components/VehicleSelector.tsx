'use client';
import React from 'react';
import { supabase } from '@/lib/supabaseClient'; // if this import errors, change to: ../lib/supabaseClient

type Option = { label: string; value: string | number };
type Props = { onChange?: (sel:{year?:number;make?:string;model?:string;trim_label?:string})=>void };

export default function VehicleSelector({ onChange }: Props) {
  const [years, setYears]   = React.useState<Option[]>([]);
  const [makes, setMakes]   = React.useState<Option[]>([]);
  const [models, setModels] = React.useState<Option[]>([]);
  const [trims, setTrims]   = React.useState<Option[]>([]);
  const [year, setYear]   = React.useState<number>();
  const [make, setMake]   = React.useState<string>();
  const [model, setModel] = React.useState<string>();
  const [trim, setTrim]   = React.useState<string>();

  // load years
  React.useEffect(() => { (async () => {
    const { data } = await supabase.from('car_years').select('year').order('year',{ ascending:false });
    if (data) setYears(data.map((r:any)=>({ label:String(r.year), value:r.year })));
  })(); }, []);

  // year -> makes
  React.useEffect(() => {
    setMake(undefined); setModel(undefined); setTrim(undefined);
    setModels([]); setTrims([]); if (!year) { setMakes([]); return; }
    (async () => {
      const { data } = await supabase.from('year_make_options').select('make').eq('year', year).order('make');
      if (data) setMakes(data.map((r:any)=>({ label:r.make, value:r.make })));
    })();
  }, [year]);

  // make -> models
  React.useEffect(() => {
    setModel(undefined); setTrim(undefined); setTrims([]); if (!year || !make) { setModels([]); return; }
    (async () => {
      const { data } = await supabase.from('make_model_options').select('model')
        .eq('year', year).eq('make', make).order('model');
      if (data) setModels(data.map((r:any)=>({ label:r.model, value:r.model })));
    })();
  }, [year, make]);

  // model -> trims
  React.useEffect(() => {
    setTrim(undefined); if (!year || !make || !model) { setTrims([]); return; }
    (async () => {
      const { data } = await supabase.from('trim_options').select('trim_label')
        .eq('year', year).eq('make', make).eq('model', model).order('trim_label');
      if (data) setTrims(data.map((r:any)=>({ label:r.trim_label, value:r.trim_label })));
    })();
  }, [year, make, model]);

  React.useEffect(() => { onChange?.({ year, make, model, trim_label: trim }); }, [year, make, model, trim, onChange]);

  // NOTE: replace these <select>s with your styled components later
  return (
    <div className="flex flex-col gap-3">
      <Select label="Year"  value={year}  onChange={(v)=>setYear(v?Number(v):undefined)} options={years}/>
      <Select label="Make"  value={make}  onChange={(v)=>setMake(v||undefined)} options={makes}  disabled={!year}/>
      <Select label="Model" value={model} onChange={(v)=>setModel(v||undefined)} options={models} disabled={!year||!make}/>
      <Select label="Trim"  value={trim}  onChange={(v)=>setTrim(v||undefined)} options={trims} disabled={!year||!make||!model}/>
    </div>
  );
}

function Select({label,value,onChange,options,disabled}:{label:string;value?:string|number;onChange:(v:string|null)=>void;options:Option[];disabled?:boolean;}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm opacity-80">{label}</span>
      <select className="border rounded-md px-3 py-2" disabled={disabled} value={value ?? ''} onChange={(e)=>onChange(e.target.value||null)}>
        <option value="">{disabled? 'Select previous':'Select ' + label}</option>
        {options.map(o=> <option key={`${label}-${o.value}`} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
