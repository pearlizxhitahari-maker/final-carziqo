import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Investment, formatCurrency, formatDateShort } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { StatusBadge } from '@/pages/user/UserDashboard';
import FleetMap from '@/components/FleetMap';
import { TrendingUp, Clock, CheckCircle, Briefcase } from 'lucide-react';

export default function MyRentals() {
  const { session } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    loadInvestments();
  }, [session]);

  async function loadInvestments() {
    if (!session) return;
    const { data } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setInvestments((data as unknown as Investment[]) || []);
    setLoading(false);
  }

  const filtered = investments.filter((i) => filter === 'all' || i.status === filter);
  const active = investments.filter((i) => i.status === 'active');
  const completed = investments.filter((i) => i.status === 'completed');
  const totalEarned = investments.reduce((sum, i) => sum + Number(i.total_earned), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold text-white mb-1">My Rentals</h2>
      <p className="text-gray-400 text-sm mb-5">Track your investment progress and earnings</p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MiniStat label="Active" value={String(active.length)} icon={<TrendingUp className="w-4 h-4" />} color="text-blue-400" />
        <MiniStat label="Completed" value={String(completed.length)} icon={<CheckCircle className="w-4 h-4" />} color="text-emerald-400" />
        <MiniStat label="Total Earned" value={formatCurrency(totalEarned)} icon={<Briefcase className="w-4 h-4" />} color="text-amber-400" />
      </div>

      {active.length > 0 && <div className="mb-5"><FleetMap investments={active} /></div>}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 p-1 bg-[#131825] rounded-xl">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              filter === f ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No rentals found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inv) => (
            <InvestmentCard key={inv.id} inv={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#131825] rounded-xl p-3 border border-[#232a3f] text-center">
      <div className={`flex items-center justify-center mb-1 ${color}`}>{icon}</div>
      <p className="text-white font-bold text-sm">{value}</p>
      <p className="text-gray-500 text-[10px]">{label}</p>
    </div>
  );
}

function InvestmentCard({ inv }: { inv: Investment }) {
  const progress = Math.min((inv.days_completed / inv.duration_days) * 100, 100);
  const remaining = inv.duration_days - inv.days_completed;
  const dailyPayout = Number(inv.daily_payout);

  return (
    <div className="bg-[#131825] rounded-2xl overflow-hidden border border-[#232a3f]">
      <div className="flex gap-3 p-4">
        <img src={inv.car_image_url} alt={inv.car_name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white font-semibold text-sm truncate">{inv.car_name}</h3>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-gray-400 text-xs mb-2">Started {formatDateShort(inv.start_date)}</p>
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-gray-500">Invested: </span>
              <span className="text-white font-semibold">{formatCurrency(Number(inv.investment_amount))}</span>
            </div>
            <div>
              <span className="text-gray-500">Daily: </span>
              <span className="text-emerald-400 font-semibold">{formatCurrency(dailyPayout)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-gray-400 text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" /> {inv.days_completed} / {inv.duration_days} days
          </span>
          <span className="text-gray-400 text-xs">
            {inv.status === 'active' ? `${remaining} days left` : 'Completed'}
          </span>
        </div>
        <div className="w-full h-2 bg-[#232a3f] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${inv.status === 'completed' ? 'gradient-accent' : 'gradient-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Earnings footer */}
      <div className="bg-[#0a0e1a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">Total Earned</p>
            <p className="text-emerald-400 font-bold text-sm">{formatCurrency(Number(inv.total_earned))}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-[10px]">Expected Total</p>
          <p className="text-white font-semibold text-sm">{formatCurrency(dailyPayout * inv.duration_days)}</p>
        </div>
      </div>
    </div>
  );
}
