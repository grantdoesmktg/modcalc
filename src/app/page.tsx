'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import VehiclePickerClient from '../components/VehiclePickerClient';
import { getCarSpecs, type CarSpecs } from '../lib/carDataLookup';
import SpecSubmissionForm from '../components/SpecSubmissionForm';

// --- Supabase browser client (uses your public env vars)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Types that match our tables (updated column names)
type Car = {
  id: string;
  make: string; 
  model: string; 
  year: number; 
  trim_label: string | null; // Updated column name
  curb_weight_lb?: number | null; // Updated column name
  stock_hp_bhp?: number | null; // Updated column name
  stock_tq_lbft?: number | null; // Updated column name
  drivetrain?: 'FWD' | 'RWD' | 'AWD';
  zero_to_sixty_s_stock?: number | null; // Updated column name
  quarter_mile_s_stock?: number | null; // Updated column name
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

// Usage limit constants
const USAGE_LIMITS = {
  FREE: 3,
  PLUS: 30,
  PRO: 200
} as const;

// Icons as simple SVG components
const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l3.057-3L9 6l1.943 3L14 6V3l3 3-1.943 3L17 12l-1.943 3L14 18v3l-3-3-1.943 3L8 18l-1.943-3L5 12l1.943-3z" />
  </svg>
);

const CarIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

export default function Home() {
  // ------------------ app state ------------------
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');

  const [cars, setCars] = useState<Car[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [carId, setCarId] = useState<string>('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);

  // Enhanced usage tracking
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [userPlan, setUserPlan] = useState<'FREE' | 'PLUS' | 'PRO'>('FREE');
  const [saving, setSaving] = useState(false);

  const [myBuilds, setMyBuilds] = useState<any[]>([]);

  // New community specs states
  const [carSpecs, setCarSpecs] = useState<CarSpecs | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    year: number;
    make: string;
    model: string;
    trim_label: string;
  } | null>(null);

  const car = useMemo(() => {
    const foundCar = cars.find((c) => c.id === carId) || null;
    
    // Merge car data with community specs if available
    if (foundCar && carSpecs) {
      return {
        ...foundCar,
        stock_hp_bhp: carSpecs.stock_hp_bhp ?? foundCar.stock_hp_bhp,
        stock_tq_lbft: carSpecs.stock_tq_lbft ?? foundCar.stock_tq_lbft,
        curb_weight_lb: carSpecs.curb_weight_lb ?? foundCar.curb_weight_lb,
        zero_to_sixty_s_stock: carSpecs.zero_to_sixty_s_stock ?? foundCar.zero_to_sixty_s_stock,
        quarter_mile_s_stock: carSpecs.quarter_mile_s_stock ?? foundCar.quarter_mile_s_stock,
      };
    }
    
    return foundCar;
  }, [cars, carId, carSpecs]);

  // Calculate usage info
  const planLimit = USAGE_LIMITS[userPlan];
  const usageRemaining = Math.max(0, planLimit - usageCount);
  const usagePercentage = Math.round((usageCount / planLimit) * 100);
  const isNearLimit = usagePercentage >= 80;
  const hasHitLimit = usageCount >= planLimit;

  // Group mods by category
  const modsByCategory = useMemo(() => {
    const grouped = mods.reduce((acc, mod) => {
      if (!acc[mod.category]) acc[mod.category] = [];
      acc[mod.category].push(mod);
      return acc;
    }, {} as Record<string, Mod[]>);
    return grouped;
  }, [mods]);

  // ------------------ helper: get today's usage ------------------
  const getTodayUsageKey = () => `pred-count-${new Date().toISOString().slice(0, 10)}`;

  const updateUsageCount = () => {
    if (session) {
      setUsageCount(0); // Placeholder - would fetch real count
    } else {
      const key = getTodayUsageKey();
      const used = Number(localStorage.getItem(key) || 0);
      setUsageCount(used);
    }
  };

  // ------------------ Load car specs with community fallback ------------------
  const loadCarSpecs = async (year: number, make: string, model: string, trim_label: string) => {
    try {
      const specs = await getCarSpecs(year, make, model, trim_label);
      setCarSpecs(specs);
      setSelectedVehicle({ year, make, model, trim_label });
    } catch (error) {
      console.error('Error loading car specs:', error);
      setCarSpecs({ source: 'missing' });
    }
  };

  // ------------------ Handle car selection from dropdown ------------------
 // Add this debugging code to your handleCarChange function in page.tsx

const handleCarChange = async (vehicleSelection: {
  year?: number;
  make?: string;
  model?: string;
  trim_label?: string;
}) => {
  // Clear previous results
  setResult(null);
  setError(null);
  setCarSpecs(null);
  setSelectedVehicle(null);
  setShowSubmissionForm(false);

  // Check if we have a complete vehicle selection
  if (!vehicleSelection.year || !vehicleSelection.make || !vehicleSelection.model || !vehicleSelection.trim_label) {
    setCarId('');
    return;
  }

  const { year, make, model, trim_label } = vehicleSelection;

  // DEBUG: Log the vehicle selection
  console.log('Vehicle selected:', { year, make, model, trim_label });

  try {
    // Look up the car in the car_trims table to get the car ID
    const { data: carData, error: carError } = await supabase
      .from('car_trims')
      .select('*')
      .eq('year', year)
      .eq('make', make)
      .eq('model', model)
      .eq('trim_label', trim_label)
      .single();

    if (carError || !carData) {
      console.log('Car not found in database');
      setCarId('');
      return;
    }

    // Set the car ID for the main app logic
    setCarId(carData.id);

    // Load the car specifications (with community fallback)
    await loadCarSpecs(year, make, model, trim_label);

  } catch (error) {
    console.error('Error handling car change:', error);
    setCarId('');
  }
};

{/* Missing Data Notice */}
{(carSpecs?.source === 'missing' || (!car?.stock_hp_bhp || !car?.stock_tq_lbft || !car?.curb_weight_lb)) && (
  <div className="bg-yellow-900/30 border border-yellow-500/50 p-3 rounded-lg">
    <p className="text-yellow-300 text-sm flex items-center justify-between">
      ⚠️ Some specifications are missing for this vehicle.
      <button
        onClick={() => {
          console.log('Submit Data clicked!');
          console.log('selectedVehicle:', selectedVehicle);
          console.log('showSubmissionForm before:', showSubmissionForm);
          setShowSubmissionForm(true);
          console.log('showSubmissionForm set to true');
        }}
        className="text-blue-400 hover:text-blue-300 underline text-xs"
      >
        Submit Data
      </button>
    </p>
  </div>
)}


  // ------------------ helper: delete build ------------------
  const deleteBuild = async (buildId: string | number) => {
    if (!session) return;

    if (!confirm('Are you sure you want to delete this build?')) return;

    try {
      // Delete from localStorage
      const localBuilds = JSON.parse(localStorage.getItem('saved_builds') || '[]');
      const updatedBuilds = localBuilds.filter((build: any, index: number) => 
        (build.id || index.toString()) !== buildId.toString()
      );
      
      localStorage.setItem('saved_builds', JSON.stringify(updatedBuilds));
      
      // Update the display with user's builds only
      const userBuilds = updatedBuilds.filter((build: any) => 
        build.user_id === session.user.id || build.user_email === session.user.email
      );
      setMyBuilds(userBuilds);
      
    } catch (error: any) {
      console.error('Error deleting build:', error);
      alert(`Failed to delete build: ${error.message}`);
    }
  };

  async function loadMyBuilds() {
    if (!session) {
      setMyBuilds([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('builds')
        .select('id, created_at, result, car_id, mod_ids')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading builds from Supabase:', error);
        
        // If builds table doesn't exist, use localStorage
        if (error.code === 'PGRST116' || error.message.includes('relation "public.builds" does not exist')) {
          console.log('Loading builds from localStorage');
          const localBuilds = JSON.parse(localStorage.getItem('saved_builds') || '[]');
          // Filter builds for current user
          const userBuilds = localBuilds.filter((build: any) => build.user_id === session.user.id);
          setMyBuilds(userBuilds);
          return;
        }
        
        throw error;
      }

      setMyBuilds(data || []);
      
    } catch (error) {
      console.error('Failed to load builds:', error);
      setMyBuilds([]);
    }
  }

  // ------------------ UI actions ------------------
  const onPredict = async () => {
    if (!carId) return;

    if (hasHitLimit) {
      setError(`You've used all ${planLimit} of your daily ${userPlan} predictions. ${session ? 'Upgrade for more!' : 'Sign in or upgrade for more!'}`);
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
          setError(err.error || `Daily limit reached for ${userPlan} plan. Upgrade for more runs!`);
          return;
        }
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data: PredictResult = await res.json();
      setResult(data);

      if (!session) {
        const key = getTodayUsageKey();
        const newCount = usageCount + 1;
        localStorage.setItem(key, String(newCount));
        setUsageCount(newCount);
      } else {
        setUsageCount(prev => prev + 1);
      }

    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!session) {
      alert('Please sign in to save builds.');
      return;
    }
    
    if (!car || !result) {
      alert('Please select a car and calculate performance first.');
      return;
    }

    setSaving(true);
    
    try {
      // Always use localStorage for now since it's more reliable
      const buildData = {
        id: Date.now().toString(),
        user_id: session.user.id,
        user_email: session.user.email,
        car_id: car.id,
        car_info: `${car.year} ${car.make} ${car.model} ${car.trim_label || ''}`.trim(),
        mod_ids: selected,
        mod_count: selected.length,
        result: result,
        created_at: new Date().toISOString()
      };

      // Get existing builds from localStorage
      const existingBuilds = JSON.parse(localStorage.getItem('saved_builds') || '[]');
      existingBuilds.unshift(buildData); // Add new build to the beginning
      
      // Keep only the last 20 builds
      if (existingBuilds.length > 20) {
        existingBuilds.splice(20);
      }
      
      localStorage.setItem('saved_builds', JSON.stringify(existingBuilds));
      
      // Update the builds display with user's builds only
      const userBuilds = existingBuilds.filter((build: any) => 
        build.user_id === session.user.id || build.user_email === session.user.email
      );
      setMyBuilds(userBuilds);
      
      alert('Build saved successfully!');
      
    } catch (error: any) {
      console.error('Error saving build:', error);
      alert(`Failed to save build: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle mod selection toggle
  const toggleMod = (modId: string) => {
    setSelected(prev => {
      const newSelected = prev.includes(modId) 
        ? prev.filter(id => id !== modId)
        : [...prev, modId];
      
      // Clear results when mods change
      setResult(null);
      setError(null);
      
      return newSelected;
    });
  };

  // ------------------ usage status component ------------------
  const UsageStatus = () => {
    if (hasHitLimit) {
      return (
        <div className="card-modern p-6 border-red-500/50 bg-red-950/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-red-400 mb-1">Daily Limit Reached</h3>
              <p className="text-sm text-red-300">
                You've used all {planLimit} of your {userPlan} predictions today.
              </p>
            </div>
            <div className="flex gap-3">
              {!session && (
                <button 
                  onClick={() => document.getElementById('email-input')?.focus()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
                >
                  Sign In
                </button>
              )}
              <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105">
                Upgrade Plan
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-red-400">
              <span>Daily Usage</span>
              <span>{usageCount} / {planLimit}</span>
            </div>
            <div className="progress-bar h-2">
              <div className="w-full h-full bg-red-600 rounded-full"></div>
            </div>
          </div>
        </div>
      );
    }

    if (isNearLimit) {
      return (
        <div className="card-modern p-6 border-yellow-500/50 bg-yellow-950/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-yellow-400 mb-1">Almost at your limit</h3>
              <p className="text-sm text-yellow-300">
                {usageRemaining} prediction{usageRemaining !== 1 ? 's' : ''} remaining on your {userPlan} plan today.
              </p>
            </div>
            <div className="flex gap-3">
              {!session && (
                <button 
                  onClick={() => document.getElementById('email-input')?.focus()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
                >
                  Sign In
                </button>
              )}
              <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105">
                Upgrade Plan
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-yellow-400">
              <span>Daily Usage</span>
              <span>{usageCount} / {planLimit}</span>
            </div>
            <div className="progress-bar h-2">
              <div 
                className="h-full bg-yellow-600 rounded-full transition-all duration-300" 
                style={{ width: `${usagePercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ------------------ data loading ------------------
  useEffect(() => {
    (async () => {
      try {
        // Get session first
        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);

        // Load cars from car_trims table
        const { data: carsData } = await supabase
          .from('car_trims')
          .select('*')
          .order('year', { ascending: false });

        if (carsData) setCars(carsData as Car[]);

        // Load mods
        const { data: modsData } = await supabase
          .from('mods')
          .select('*')
          .order('category, name');
        
        if (modsData) setMods(modsData as Mod[]);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
          setSession(s);
        });

        return () => subscription.unsubscribe();
        
      } catch (error) {
        console.error('Error during data fetch:', error);
      }
    })();
  }, []);

  useEffect(() => {
    updateUsageCount();
    if (session) {
      setUserPlan('FREE');
    } else {
      setUserPlan('FREE');
    }
  }, [session]);

  useEffect(() => {
    loadMyBuilds();
  }, [session]);

  // ------------------ render ------------------
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-950/30 border border-blue-500/30 rounded-full text-blue-400 text-sm font-medium">
          <SparklesIcon />
          Performance Tuning Calculator
        </div>
        <h1 className="text-4xl md:text-6xl font-bold gradient-text">
          ModCalc
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Calculate your car's performance gains with precision. Choose your vehicle, select modifications, and see the estimated power and acceleration improvements.
        </p>
      </div>

      {/* Auth Section */}
      <div className="card-modern p-6">
        {session ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {session.user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Signed in as</p>
                <p className="text-sm text-gray-400">{session.user.email}</p>
              </div>
            </div>
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors duration-200"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        ) : (
          <form
            className="flex items-center gap-4"
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
            <div className="flex-1">
              <input
                id="email-input"
                type="email"
                required
                placeholder="Enter your email to get started..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-modern w-full"
              />
            </div>
            <button className="btn-primary px-6 py-3 rounded-lg font-medium">
              Sign In
            </button>
          </form>
        )}
      </div>

      {/* Usage Status */}
      <UsageStatus />

      {/* Error Display */}
      {error && (
        <div className="card-modern p-4 border-red-500/50 bg-red-950/20">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Community Submission Form */}
      {showSubmissionForm && selectedVehicle && (
        <SpecSubmissionForm
          year={selectedVehicle.year}
          make={selectedVehicle.make}
          model={selectedVehicle.model}
          trim_label={selectedVehicle.trim_label}
          onSubmitted={() => {
            setShowSubmissionForm(false);
            // Reload specs after submission
            if (selectedVehicle) {
              loadCarSpecs(selectedVehicle.year, selectedVehicle.make, selectedVehicle.model, selectedVehicle.trim_label);
            }
          }}
          onCancel={() => setShowSubmissionForm(false)}
        />
      )}

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step 1: Choose Car */}
        <div className="card-modern p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <CarIcon />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Choose Your Car</h2>
              <p className="text-sm text-gray-400">Select your vehicle to get started</p>
            </div>
          </div>

          <div className="relative">
            <VehiclePickerClient onChange={handleCarChange} />
          </div>

          {car && (
            <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-200">Stock Specifications</h3>
                {carSpecs && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    carSpecs.source === 'official' ? 'bg-green-600/20 text-green-400' :
                    carSpecs.source === 'community' ? 'bg-blue-600/20 text-blue-400' :
                    'bg-gray-600/20 text-gray-400'
                  }`}>
                    {carSpecs.source === 'official' ? 'Official' : 
                     carSpecs.source === 'community' ? 'Community' : 'Missing'}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-400">Power</p>
                  <p className="font-semibold text-gray-200">
                    {car.stock_hp_bhp ? `${car.stock_hp_bhp} HP` : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-400">Torque</p>
                  <p className="font-semibold text-gray-200">
                    {car.stock_tq_lbft ? `${car.stock_tq_lbft} lb-ft` : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-400">Weight</p>
                  <p className="font-semibold text-gray-200">
                    {car.curb_weight_lb ? `${car.curb_weight_lb.toLocaleString()} lbs` : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-400">Drivetrain</p>
                  <p className="font-semibold text-gray-200">
                    {car.drivetrain || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Missing Data Notice */}
              {carSpecs?.source === 'missing' || (!car.stock_hp_bhp || !car.stock_tq_lbft || !car.curb_weight_lb) && (
                <div className="bg-yellow-900/30 border border-yellow-500/50 p-3 rounded-lg">
                  <p className="text-yellow-300 text-sm flex items-center justify-between">
                    ⚠️ Some specifications are missing for this vehicle.
                    <button
                      onClick={() => setShowSubmissionForm(true)}
                      className="text-blue-400 hover:text-blue-300 underline text-xs"
                    >
                      Submit Data
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Pick Mods */}
        <div className="card-modern p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <SettingsIcon />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Select Modifications</h2>
              <p className="text-sm text-gray-400">Choose your performance upgrades</p>
            </div>
          </div>

          <div className="scrollable-mods space-y-4 pr-2">
            {Object.entries(modsByCategory).map(([category, categoryMods]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider sticky top-0 bg-card py-2">
                  {category.replace(/_/g, ' ')}
                </h3>
                <div className="space-y-2">
                  {categoryMods.map((mod) => (
                    <label 
                      key={mod.id} 
                      className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors duration-200"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(mod.id)}
                        onChange={() => toggleMod(mod.id)}
                        className="checkbox-modern mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-200 text-sm">{mod.name}</span>
                          {mod.needs_tune && (
                            <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded-full">
                              Tune Required
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          +{mod.avg_hp_gain} HP • +{mod.avg_tq_gain} TQ • {mod.avg_weight_delta_lbs > 0 ? '+' : ''}{mod.avg_weight_delta_lbs} lbs
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-700">
            <button
              onClick={onPredict}
              disabled={!carId || loading || hasHitLimit}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                hasHitLimit 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : loading 
                    ? 'bg-blue-600 text-white pulse cursor-wait'
                    : 'btn-primary text-white hover:scale-[1.02] glow-primary'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Calculating...
                </div>
              ) : hasHitLimit ? (
                'Daily Limit Reached'
              ) : (
                'Calculate Performance'
              )}
            </button>
            
            {!hasHitLimit && (
              <p className="text-xs text-center text-gray-400">
                {usageRemaining} calculation{usageRemaining !== 1 ? 's' : ''} remaining today
              </p>
            )}
          </div>
        </div>

        {/* Step 3: Results */}
        <div className="card-modern p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <ChartIcon />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Performance Results</h2>
              <p className="text-sm text-gray-400">Your estimated gains</p>
            </div>
          </div>

          {!result ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <ChartIcon />
              </div>
              <p className="text-gray-400 text-sm">
                {!carId ? 'Select a car and modifications to see results' : 'Click "Calculate Performance" to see your results'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/30 p-4 rounded-lg">
                  <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">Horsepower</p>
                  <p className="text-2xl font-bold text-white">{result.estimatedHp}</p>
                  <p className="text-xs text-blue-300">
                    +{result.estimatedHp - (car?.stock_hp_bhp || 0)} HP
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/30 p-4 rounded-lg">
                  <p className="text-xs text-purple-300 uppercase tracking-wider mb-1">Torque</p>
                  <p className="text-2xl font-bold text-white">{result.estimatedTq}</p>
                  <p className="text-xs text-purple-300">
                    +{result.estimatedTq - (car?.stock_tq_lbft || 0)} lb-ft
                  </p>
                </div>
                <div className="bg-gradient-to-r from-green-900/30 to-green-800/30 p-4 rounded-lg">
                  <p className="text-xs text-green-300 uppercase tracking-wider mb-1">Power/Weight</p>
                  <p className="text-2xl font-bold text-white">{result.powerToWeight.toFixed(3)}</p>
                  <p className="text-xs text-green-300">hp/lb</p>
                </div>
                <div className="bg-gradient-to-r from-orange-900/30 to-orange-800/30 p-4 rounded-lg">
                  <p className="text-xs text-orange-300 uppercase tracking-wider mb-1">Weight</p>
                  <p className="text-2xl font-bold text-white">{result.estimatedWeight.toLocaleString()}</p>
                  <p className="text-xs text-orange-300">lbs</p>
                </div>
              </div>

              {/* Performance Times */}
              {(result.zeroToSixty !== null || result.quarterMile !== null) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Performance Times</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {result.zeroToSixty && (
                      <div className="bg-gradient-to-r from-red-900/30 to-red-800/30 p-4 rounded-lg">
                        <p className="text-xs text-red-300 uppercase tracking-wider mb-1">0-60 mph</p>
                        <p className="text-2xl font-bold text-white">{result.zeroToSixty.toFixed(1)}s</p>
                      </div>
                    )}
                    {result.quarterMile && (
                      <div className="bg-gradient-to-r from-indigo-900/30 to-indigo-800/30 p-4 rounded-lg">
                        <p className="text-xs text-indigo-300 uppercase tracking-wider mb-1">1/4 Mile</p>
                        <p className="text-2xl font-bold text-white">{result.quarterMile.toFixed(2)}s</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {result.notes && result.notes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-300">Notes</h4>
                  <ul className="space-y-1">
                    {result.notes.map((note, i) => (
                      <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                        <span className="text-blue-400">•</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Save Build Section */}
          {result && (
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={onSave}
                disabled={saving || !result}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  saving
                    ? 'bg-blue-600 text-white cursor-wait'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:scale-[1.02]'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon />
                    {!session ? 'Sign in to Save' : !result ? 'Calculate First' : 'Save This Build'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* My Builds Section */}
      {session && myBuilds.length > 0 && (
        <div className="card-modern p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-100">My Saved Builds</h3>
            <button
              onClick={loadMyBuilds}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myBuilds.map((build, index) => (
              <div key={build.id || index} className="bg-gray-800/50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <p className="text-xs text-gray-400">
                    {new Date(build.created_at).toLocaleDateString()}
                  </p>
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    {Array.isArray(build.mod_ids) ? build.mod_ids.length : build.mod_count || 0} mods
                  </span>
                </div>
                
                <div className="space-y-2">
                  <p className="font-medium text-gray-200 text-sm">
                    {build.car_info}
                  </p>
                  
                  {build.result && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">HP:</span>
                        <span className="text-white ml-1">{build.result.estimatedHp}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">TQ:</span>
                        <span className="text-white ml-1">{build.result.estimatedTq}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">P/W:</span>
                        <span className="text-white ml-1">{build.result.powerToWeight?.toFixed(3)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">0-60:</span>
                        <span className="text-white ml-1">
                          {build.result.zeroToSixty ? `${build.result.zeroToSixty.toFixed(1)}s` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteBuild(build.id || index)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
