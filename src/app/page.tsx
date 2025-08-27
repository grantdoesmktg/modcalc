import { createClient } from '@supabase/supabase-js';
// ... existing imports

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

type Car = {
  id: string; make: string; model: string; year: number; trim: string|null;
  curb_weight_lbs: number; stock_hp: number; stock_tq: number; drivetrain: 'FWD'|'RWD'|'AWD';
  zero_to_sixty_s: number|null; quarter_mile_s: number|null;
}
type Mod = {
  id: string; slug: string; name: string; category: string;
  avg_hp_gain: number; avg_tq_gain: number; avg_weight_delta_lbs: number;
  needs_tune: boolean; notes: string|null;
}

export default function Home() {
  const [cars, setCars] = useState<Car[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [carId, setCarId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: carsData } = await supabase.from('cars').select('*').order('make');
      const { data: modsData } = await supabase.from('mods').select('*').order('category');
      setCars(carsData || []);
      setMods(modsData || []);
    })();
  }, []);

  const car = useMemo(() => cars.find(c => c.id === carId) || null, [cars, carId]);
  const toggleMod = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const onPredict = async () => {
    if (!carId) return;
    setLoading(true); setResult(null);
    const r = await fetch('/api/predict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carId, modIds: selected })
    }).then(res => res.json());
    setResult(r); setLoading(false);
  }

  return (
    <main>
      <h1 className="text-3xl font-bold mb-2">ModCalc – MVP</h1>
      <p className="text-sm text-slate-600 mb-6">Pick a car, choose mods, get estimated HP/weight and 0–60.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section>
          <h2 className="font-semibold mb-2">1) Choose Car</h2>
          <select className="w-full rounded-lg border p-2" value={carId ?? ''} onChange={e => setCarId(e.target.value)}>
            <option value="">Select a car…</option>
            {cars.map(c => (
              <option key={c.id} value={c.id}>{c.year} {c.make} {c.model} {c.trim ?? ''}</option>
            ))}
          </select>
          {car && (
            <div className="mt-4 text-sm space-y-1">
              <div><b>Stock HP/TQ:</b> {car.stock_hp} / {car.stock_tq}</div>
              <div><b>Curb weight:</b> {car.curb_weight_lbs.toLocaleString()} lbs</div>
              <div><b>Drivetrain:</b> {car.drivetrain}</div>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-semibold mb-2">2) Pick Mods</h2>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-2">
            {mods.map(m => (
              <label key={m.id} className="flex items-start gap-2">
                <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggleMod(m.id)} />
                <span>
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-2 text-xs rounded bg-slate-200 px-2 py-0.5">{m.category}</span>
                  <div className="text-xs text-slate-600">~{m.avg_hp_gain} hp / {m.avg_tq_gain} tq, {m.avg_weight_delta_lbs} lbs</div>
                </span>
              </label>
            ))}
          </div>
          <button onClick={onPredict} disabled={!carId || loading}
                  className="mt-4 rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50">
            {loading ? 'Calculating…' : 'Calculate Build'}
          </button>
        </section>

        <section>
          <h2 className="font-semibold mb-2">3) Results</h2>
          {!result && <div className="text-sm text-slate-500">No result yet.</div>}
          {result && (
            <div className="rounded-xl border p-4 space-y-1 text-sm">
              <div><b>Estimated HP:</b> {result.estimatedHp} hp</div>
              <div><b>Estimated TQ:</b> {result.estimatedTq} lb-ft</div>
              <div><b>Estimated Weight:</b> {result.estimatedWeight} lbs</div>
              <div><b>Power/Weight:</b> {result.powerToWeight.toFixed(3)} hp/lb</div>
              {result.zeroToSixty && <div><b>0–60 (est):</b> {result.zeroToSixty.toFixed(2)} s</div>}
              {result.quarterMile && <div><b>1/4 mile (est):</b> {result.quarterMile.toFixed(2)} s</div>}
              {result.notes?.length ? (
                <div className="pt-2 text-xs text-slate-600">
                  <b>Notes:</b>
                  <ul className="list-disc ml-5">
                    {result.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
