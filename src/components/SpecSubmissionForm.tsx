'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  year: number;
  make: string;
  model: string;
  trim_label: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
};

export default function SpecSubmissionForm({ year, make, model, trim_label, onSubmitted, onCancel }: Props) {
  const [formData, setFormData] = useState({
    stock_hp_bhp: '',
    stock_tq_lbft: '',
    curb_weight_lb: '',
    zero_to_sixty_s_stock: '',
    quarter_mile_s_stock: '',
    source_url: '',
    notes: '',
    submitted_email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get current user (if any)
      const { data: { user } } = await supabase.auth.getUser();

      // Prepare submission data
      const submissionData = {
        year,
        make,
        model,
        trim_label,
        submitted_by: user?.id || null,
        submitted_email: user?.email || formData.submitted_email,
        stock_hp_bhp: formData.stock_hp_bhp ? parseInt(formData.stock_hp_bhp) : null,
        stock_tq_lbft: formData.stock_tq_lbft ? parseInt(formData.stock_tq_lbft) : null,
        curb_weight_lb: formData.curb_weight_lb ? parseInt(formData.curb_weight_lb) : null,
        zero_to_sixty_s_stock: formData.zero_to_sixty_s_stock ? parseFloat(formData.zero_to_sixty_s_stock) : null,
        quarter_mile_s_stock: formData.quarter_mile_s_stock ? parseFloat(formData.quarter_mile_s_stock) : null,
        source_url: formData.source_url || null,
        notes: formData.notes || null
      };

      const { error: submitError } = await supabase
        .from('community_specs')
        .insert(submissionData);

      if (submitError) throw submitError;

      alert('Thank you! Your submission has been received and will be reviewed.');
      onSubmitted?.();
    } catch (err: any) {
      setError(err.message || 'Failed to submit specs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-modern p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Submit Vehicle Specifications</h3>
          <p className="text-sm text-gray-400">{year} {make} {model} {trim_label}</p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-950/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Stock Horsepower (BHP)
            </label>
            <input
              type="number"
              value={formData.stock_hp_bhp}
              onChange={(e) => setFormData(prev => ({ ...prev, stock_hp_bhp: e.target.value }))}
              className="input-modern w-full"
              placeholder="e.g. 300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Stock Torque (lb-ft)
            </label>
            <input
              type="number"
              value={formData.stock_tq_lbft}
              onChange={(e) => setFormData(prev => ({ ...prev, stock_tq_lbft: e.target.value }))}
              className="input-modern w-full"
              placeholder="e.g. 280"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Curb Weight (lbs)
            </label>
            <input
              type="number"
              value={formData.curb_weight_lb}
              onChange={(e) => setFormData(prev => ({ ...prev, curb_weight_lb: e.target.value }))}
              className="input-modern w-full"
              placeholder="e.g. 3200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              0-60 Time (seconds) - Optional
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.zero_to_sixty_s_stock}
              onChange={(e) => setFormData(prev => ({ ...prev, zero_to_sixty_s_stock: e.target.value }))}
              className="input-modern w-full"
              placeholder="e.g. 5.2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Quarter Mile Time (seconds) - Optional
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.quarter_mile_s_stock}
            onChange={(e) => setFormData(prev => ({ ...prev, quarter_mile_s_stock: e.target.value }))}
            className="input-modern w-full"
            placeholder="e.g. 13.45"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Source URL - Optional
          </label>
          <input
            type="url"
            value={formData.source_url}
            onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value }))}
            className="input-modern w-full"
            placeholder="https://manufacturer-website.com/specs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Additional Notes - Optional
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="input-modern w-full"
            rows={3}
            placeholder="Any additional information about these specifications..."
          />
        </div>

        {/* Email field for non-authenticated users */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Your Email (for updates on submission status)
          </label>
          <input
            type="email"
            value={formData.submitted_email}
            onChange={(e) => setFormData(prev => ({ ...prev, submitted_email: e.target.value }))}
            className="input-modern w-full"
            placeholder="your-email@example.com"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-6 py-3 rounded-lg font-medium flex-1"
          >
            {loading ? 'Submitting...' : 'Submit Specifications'}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="text-xs text-gray-500 space-y-1">
        <p>• All submissions are reviewed before being added to the database</p>
        <p>• Please provide accurate information from reliable sources</p>
        <p>• At least horsepower, torque, and weight are required</p>
      </div>
    </div>
  );
}
