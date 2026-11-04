import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Profile, Investment, Car, RechargeLog, WithdrawalLog, formatCurrency, formatDateShort } from '@/lib/types';
import RechargeModal from '@/pages/user/RechargeModal';
import WithdrawModal from '@/pages/user/WithdrawModal';
import { Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle, Briefcase, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function UserDashboard() {
  const { profile, session, refreshProfile } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [recentRecharges, setRecentRecharges] = useState<RechargeLog[]>([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState<WithdrawalLog[]>([]);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const loadData = useCallback(async () => {
    if (!session) return;
    const [invRes, carRes, recRes, wdRes] = await Promise.all([
      supabase.from('investments').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('cars').select('*').eq('status', 'active').order('price', { ascending: true }).limit(5),
      supabase.from('recharge_logs').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('withdrawal_logs').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(5),
    ]);
    setInvestments((invRes.data as unknown as Investment[]) || []);
    setCars((carRes.data as unknown as Car[]) || []);
    setRecentRecharges((recRes.data as unknown as RechargeLog[]) || []);
    setRecentWithdrawals((wdRes.data as unknown as WithdrawalLog[]) || []);
  }, [session]);

  useEffect(() => {
    supabase.rpc('credit_daily_earnings').then(() => {
      loadData();
      refreshProfile();
    });
  }, [loadData, refreshProfile]);

  const activeInvestments = investments.filter((i) => i.status === 'active');
  const totalEarnings = investments.reduce((sum, i) => sum + Number(i.total_earned), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl gradient-primary p-6 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 right-8 w-24 h-24 bg-cyan-300/10 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-blue-100" />
            <p className="text-blue-100 text-sm font-medium">Available Balance</p>
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-6">{formatCurrency(profile?.wallet_balance || 0)}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowRecharge(true)}
              className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl py-3 font-semibold text-sm hover:bg-white/25 transition-all active:scale-95"
            >
              <ArrowDownCircle className="w-5 h-5" />
              Recharge
            </button>
            <button
              onClick={() => setShowWithdraw(true)}
              className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl py-3 font-semibold text-sm hover:bg-white/25 transition-all active:scale-95"
            >
              <ArrowUpCircle className="w-5 h-5" />
              Withdraw
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
        <p className="text-blue-400 font-semibold text-sm">Withdrawals available</p>
        <p className="text-gray-400 text-xs mt-1">Minimum withdrawal is ₱500.00</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total Earnings"
          value={formatCurrency(totalEarnings)}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <StatCard
          icon={<Briefcase className="w-5 h-5" />}
          label="Active Rentals"
          value={String(activeInvestments.length)}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
      </div>

      {/* Active rentals overview */}
      {activeInvestments.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> Active Rentals
          </h3>
          <div className="space-y-3">
            {activeInvestments.slice(0, 3).map((inv) => (
              <InvestmentMiniCard key={inv.id} inv={inv} />
            ))}
          </div>
        </section>
      )}

      {/* Featured cars */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Featured Cars</h3>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
          {cars.map((car) => (
            <div
              key={car.id}
              className="flex-shrink-0 w-44 rounded-xl overflow-hidden bg-[#131825] border border-[#232a3f]"
            >
              <img src={car.image_url} alt={car.car_name} className="w-full h-24 object-cover" />
              <div className="p-3">
                <h4 className="text-white text-sm font-semibold truncate">{car.car_name}</h4>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-bold">{car.daily_return_rate}%/day</span>
                </div>
                <p className="text-gray-400 text-xs mt-1">{car.is_free ? 'FREE' : `From ${formatCurrency(car.price)}`}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent transactions */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Transactions</h3>
        <div className="space-y-2">
          {recentRecharges.length === 0 && recentWithdrawals.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No transactions yet
            </div>
          )}
          {recentRecharges.map((r) => (
            <TransactionRow
              key={`r-${r.id}`}
              type="recharge"
              amount={Number(r.amount)}
              status={r.status}
              date={r.created_at}
            />
          ))}
          {recentWithdrawals.map((w) => (
            <TransactionRow
              key={`w-${w.id}`}
              type="withdrawal"
              amount={Number(w.amount)}
              status={w.status}
              date={w.created_at}
            />
          ))}
        </div>
      </section>

      {showRecharge && (
        <RechargeModal
          onClose={() => setShowRecharge(false)}
          onSuccess={() => {
            setShowRecharge(false);
            loadData();
            refreshProfile();
          }}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          balance={profile?.wallet_balance || 0}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => {
            setShowWithdraw(false);
            loadData();
            refreshProfile();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-[#131825] rounded-xl p-4 border border-[#232a3f]">
      <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center ${color} mb-2`}>
        {icon}
      </div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  );
}

function InvestmentMiniCard({ inv }: { inv: Investment }) {
  const progress = Math.min((inv.days_completed / inv.duration_days) * 100, 100);
  return (
    <div className="bg-[#131825] rounded-xl p-3 border border-[#232a3f] flex items-center gap-3">
      <img src={inv.car_image_url} alt={inv.car_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-white text-sm font-semibold truncate">{inv.car_name}</h4>
          <span className="text-emerald-400 text-xs font-bold">{formatCurrency(Number(inv.total_earned))}</span>
        </div>
        <div className="w-full h-1.5 bg-[#232a3f] rounded-full overflow-hidden">
          <div className="h-full gradient-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-gray-500 text-[10px]">{inv.days_completed} / {inv.duration_days} days</span>
          <span className="text-gray-500 text-[10px]">{formatCurrency(Number(inv.daily_payout))}/day</span>
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ type, amount, status, date }: { type: 'recharge' | 'withdrawal'; amount: number; status: string; date: string }) {
  const isRecharge = type === 'recharge';
  return (
    <div className="flex items-center justify-between bg-[#131825] rounded-lg px-4 py-3 border border-[#232a3f]">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          isRecharge ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
        }`}>
          {isRecharge ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{isRecharge ? 'Recharge' : 'Withdrawal'}</p>
          <p className="text-gray-500 text-xs">{formatDateShort(date)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${isRecharge ? 'text-emerald-400' : 'text-orange-400'}`}>
          {isRecharge ? '+' : '-'}{formatCurrency(amount)}
        </p>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: 'text-amber-400 bg-amber-500/10', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    approved: { color: 'text-emerald-400 bg-emerald-500/10', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
    rejected: { color: 'text-red-400 bg-red-500/10', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
    active: { color: 'text-blue-400 bg-blue-500/10', icon: <TrendingUp className="w-3 h-3" />, label: 'Active' },
    completed: { color: 'text-emerald-400 bg-emerald-500/10', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
    cancelled: { color: 'text-red-400 bg-red-500/10', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
    paused: { color: 'text-amber-400 bg-amber-500/10', icon: <Clock className="w-3 h-3" />, label: 'Paused' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
}
