import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Investment } from '@/lib/types';
import { Check, X } from 'lucide-react';

type ManageAction = 'pause' | 'resume' | 'edit' | 'delete';

export default function AdminInvestmentModal({
  investment,
  onClose,
  onSaved,
}: {
  investment: Investment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<ManageAction>(investment.status === 'paused' ? 'resume' : 'pause');
  const [durationDays, setDurationDays] = useState(String(investment.duration_days));
  const [dailyPayout, setDailyPayout] = useState(String(investment.daily_payout));
  const [reason, setReason] = useState(investment.pause_reason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);

    try {
      if (action === 'delete') {
        if (!confirm(`Permanently delete ${investment.car_name}? This cannot be undone.`)) {
          setSaving(false);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        p_investment_id: investment.id,
        p_action: action,
      };
      if (action === 'pause') payload.p_reason = reason.trim() || null;
      if (action === 'edit') {
        payload.p_duration_days = parseInt(durationDays, 10);
        payload.p_daily_payout = parseFloat(dailyPayout);
      }

      const { error: rpcError } = await supabase.rpc('admin_manage_investment', payload);
      if (rpcError) throw rpcError;
      onSaved();
    } catch (cause) {
      console.error('admin_manage_investment failed', cause);
      const msg = cause instanceof Error ? cause.message : 'That action could not be completed. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    'w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#131825] rounded-2xl border border-[#232a3f] p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Manage Rental</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 bg-[#0a0e1a] rounded-xl p-3 mb-4">
          <img src={investment.car_image_url} alt={investment.car_name} className="w-12 h-12 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{investment.car_name}</p>
            <p className="text-gray-500 text-xs">
              {investment.days_completed}/{investment.duration_days} days · {investment.status}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <ActionPill label="Pause" active={action === 'pause'} onClick={() => setAction('pause')} disabled={investment.status !== 'active'} />
          <ActionPill label="Resume" active={action === 'resume'} onClick={() => setAction('resume')} disabled={investment.status !== 'paused'} />
          <ActionPill label="Edit terms" active={action === 'edit'} onClick={() => setAction('edit')} />
          <ActionPill label="Delete" active={action === 'delete'} onClick={() => setAction('delete')} danger />
        </div>

        {action === 'pause' && (
          <div className="mb-4">
            <label htmlFor="pause-reason" className="block text-sm font-medium text-gray-300 mb-2">Reason (optional)</label>
            <textarea
              id="pause-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={fieldClass}
              rows={2}
              placeholder="Why is this rental being paused?"
            />
            <p className="text-gray-500 text-xs mt-1.5">Earnings stop accruing while paused.</p>
          </div>
        )}

        {action === 'resume' && (
          <p className="text-gray-400 text-sm mb-4">
            The rental will start accruing earnings again on the next daily cycle.
          </p>
        )}

        {action === 'edit' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label htmlFor="edit-duration" className="block text-sm font-medium text-gray-300 mb-2">Duration (days)</label>
              <input
                id="edit-duration"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className={fieldClass}
                min={1}
                max={365}
              />
            </div>
            <div>
              <label htmlFor="edit-payout" className="block text-sm font-medium text-gray-300 mb-2">Daily payout</label>
              <input
                id="edit-payout"
                type="number"
                value={dailyPayout}
                onChange={(e) => setDailyPayout(e.target.value)}
                className={fieldClass}
                step="0.01"
                min={0}
              />
            </div>
          </div>
        )}

        {action === 'delete' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
            This permanently removes the rental. Any wallet adjustment should be handled separately.
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">{error}</div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? 'Saving...' : <><Check className="w-5 h-5" /> Confirm</>}
        </button>
      </div>
    </div>
  );
}

function ActionPill({
  label,
  active,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const base = 'py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const activeClass = danger
    ? 'bg-red-500 text-white'
    : 'gradient-primary text-white';
  const idleClass = danger
    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
    : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400 hover:text-white';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${active ? activeClass : idleClass}`}>
      {label}
    </button>
  );
}
