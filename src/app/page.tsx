'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

// --- Supabase browser client (uses your public env vars)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Types that match our tables
type Car = {
  id: string;
  make: string; model: string; year: number; trim: string | null;
  curb_weight_lbs: number; stock_hp: number; stock_tq: number;
  drivetrain: 'FWD' | 'RWD' | 'AWD';
  zero_to_sixty_s: number | null; quarter_mile_s: number | null;
};

type Mod = {
  id: string;
  slug: string; name: string; category: string;
  avg_hp_gain: number; avg_tq_gain: number; avg_weight_delta_lbs: number;
  needs_tune: boolean; notes: string | null;
};

type PredictResult = {
  estimatedHp: number;
  estimatedTq: number;
  estimatedWeight: number;
  powerToWeight: number;
  zeroToSixty: number | null;
  quarterMile: number | null;
  notes?: string[];
};

export default function Home() {
  // ------------------ app state ------------------
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');

  const [cars, setCars] = useState<Car[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [carId, setCarId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);

  // NEW: error + limit state for 429 handling
  const [error, setError] = useState<string | null>(null);
  const [hitLimit, setHitLimit] = useState(false);

  const [myBuilds, setMyBuilds] = useState<any[]>([]);
  const car = useMemo(() => cars.find((c) => c.id === carId) || null, [cars, carId]);

  // ------------------ boot: fetch data + auth ------------------
  useEffect(() => {
    (async () => {
      // cars/mods
      const { data: carsData } = await supabase.from('cars').select('*').order('make');
      const { data: modsData } = await supabase.from('mods').select('*').order('category');
      setCars(carsData || []);
      setMods(modsData || []);

      // auth session
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);

      supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    })();
  }, []);

  // ------------------ helper: load my builds ------------------
  async function loadMyBuilds() {
    if (!session) {
      setMyBuilds([]);
      return;
    }
    const { data } = await supabase
      .from('builds')
      .select('id, created_at, result, car_id, mod_ids')
      .order('created_at', { ascending: false })
      .limit(10);
    setMyBuilds(data || []);
  }

  useEffect(() => {
    loadMyBuilds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ------------------ UI actions ------------------
  const toggleMod = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onPredict = async () => {
    if (!carId) return;

    // simple free-tier limiter for anonymous users
    const DAILY_FREE = 3;
    const key = `pred-count-${new Date().toISOString().slice(0, 10)}`;
    const used = Number(localStorage.getItem(key) || 0);
    if (!session && used >= DAILY_FREE) {
      setError('Daily limit reached for Free. Sign in or upgrade for more runs.');
      setHitLimit(true);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carId, modIds: selected })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(err.error || 'Daily limit reached. Upgrade for more runs.');
          setHitLimit(true);
          return;
        }
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data: PredictResult = await res.json();
      setResult(data);

      if (!session) localStorage.setItem(key, String(used + 1));
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!session) return alert('Sign in to save builds.');
    if (!car || !result) return;

    const { error } = await supabase.from('builds').insert({
      user_id: session.user.id,
      car_id: car.id,
      mod_ids: selected, // array of UUID strings
      result,            // store snapshot
    });
    if (error) alert('Save failed: ' + error.message);
    else {
      alert('Saved!');
      loadMyBuilds();
    }
  };

  // ------------------ render ------------------
  return (
    <main>
      <h1 className="text-3xl font-bold mb-2">ModCalc – MVP</h1>
      <p className="text-sm text-slate-600 mb-4">Pick a car, choose mods, get estimated HP/weight and 0–60.</p>

      {/* Sign-in bar */}
      <div className="mb-6 flex items-center gap-3">
        {session ? (
          <>
            <span className="text-sm">Signed in as {session.user.email}</span>
            <button
              className="rounded-lg border px-3 py-1 text-sm"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
              const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: site }
              });
              if (error) alert(error.message);
              else alert('Check your email for the magic link!');
            }}
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border px-3 py-1 text-sm"
            />
            <button className="rounded bg-black px-3 py-1 text-sm text-white">Sign in</button>
          </form>
        )}
      </div>

      {/* Upgrade wall / error banner */}
      {error && (
        <div className="mb-4 rounded border border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {error}
          {hitLimit && (
            <div className="mt-2 flex items-center gap-2">
              <a href="/upgrade" className="rounded bg-black px-3 py-1 text-white">Upgrade plan</a>
              <a href="/" className="rounded border px-3 py-1">Refresh</a>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Choose Car */}
        <section className="md:col-span-1">
          <h2 className="font-semibold mb-2">1) Choose Car</h2>
          <select
            className="w-full rounded-lg border p-2"
            value={carId ?? ''}
            onChange={(e) => setCarId(e.target.value)}
          >
            <option value="">Select a car…</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year} {c.make} {c.model} {c.trim ?? ''}
              </option>
            ))}
          </select>

          {car && (
            <div className="mt-4 text-sm space-y-1">
              <div>
                <b>Stock HP/TQ:</b> {car.stock_hp} / {car.stock_tq}
              </div>
              <div>
                <b>Curb weight:</b> {car.curb_weight_lbs.toLocaleString()} lbs
              </div>
              <div>
                <b>Drivetrain:</b> {car.drivetrain}
              </div>
            </div>
          )}
        </section>

        {/* Pick Mods */}
        <section className="md:col-span-1">
          <h2 className="font-semibold mb-2">2) Pick Mods</h2>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-2">
            {mods.map((m) => (
              <label key={m.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={() => setSelected((prev) => (
                    prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                  ))}
                />
                <span>
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-2 text-xs rounded bg-slate-200 px-2 py-0.5">
                    {m.category}
                  </span>
                  <div className="text-xs text-slate-600">
                    ~{m.avg_hp_gain} hp / {m.avg_tq_gain} tq, {m.avg_weight_delta_lbs} lbs
                  </div>
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={onPredict}
            disabled={!carId || loading || hitLimit}
            className="mt-4 rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'Calculating…' : 'Calculate Build'}
          </button>
        </section>

        {/* Results */}
        <section className="md:col-span-1">
          <h2 className="font-semibold mb-2">3) Results</h2>
          {!result && !error && <div className="text-sm text-slate-500">No result yet.</div>}
          {result && (
            <div className="rounded-xl border p-4 space-y-1 text-sm">
              <div>
                <b>Estimated HP:</b> {result.estimatedHp} hp
              </div>
              <div>
                <b>Estimated TQ:</b> {result.estimatedTq} lb-ft
              </div>
              <div>
                <b>Estimated Weight:</b> {result.estimatedWeight} lbs
              </div>
              <div>
                <b>Power/Weight:</b> {result.powerToWeight.toFixed(3)} hp/lb
              </div>
              {result.zeroToSixty !== null && (
                <div>
                  <b>0–60 (est):</b> {result.zeroToSixty.toFixed(2)} s
                </div>
              )}
              {result.quarterMile !== null && (
                <div>
                  <b>1/4 mile (est):</b> {result.quarterMile.toFixed(2)} s
                </div>
              )}
              {result.notes?.length ? (
                <div className="pt-2 text-xs text-slate-600">
                  <b>Notes:</b>
                  <ul className="list-disc ml-5">
                    {result.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Save button */}
              <div className="pt-2">
                <button
                  onClick={onSave}
                  className="rounded-lg border px-3 py-1 text-sm"
                >
                  💾 Save this build
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* My Builds */}
      {session && (
        <div className="mt-8">
          <h3 className="font-semibold mb-2">My Builds</h3>
          {!myBuilds.length && (
            <div className="text-sm text-slate-500">No saved builds yet.</div>
          )}
          <ul className="space-y-2">
            {myBuilds.map((b) => (
              <li key={b.id} className="rounded border p-3 text-sm">
                <div className="text-xs text-slate-500">
                  {new Date(b.created_at).toLocaleString()}
                </div>
                <div>
                  HP: <b>{b.result?.estimatedHp}</b> · TQ:{' '}
                  <b>{b.result?.estimatedTq}</b> · 0–60:{' '}
                  {b.result?.zeroToSixty ? b.result.zeroToSixty.toFixed(2) : '—'}s
                </div>
                <div className="text-xs">Mods: {Array.isArray(b.mod_ids) ? b.mod_ids.length : 0}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
