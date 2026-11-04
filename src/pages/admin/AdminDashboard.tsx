import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/types';
import { ArrowDownCircle, ArrowUpCircle, Briefcase, Wallet, TrendingUp, ChevronRight } from 'lucide-react';

interface AdminTab {
  id: 'recharges' | 'withdrawals' | 'cars' | 'users';
  label: string;
  icon: React.ReactNode;
}

export default function AdminDashboard({ onNavigate }: { onNavigate: (tab: AdminTab['id']) => void }) {
  const [stats, setStats] = useState({
    pendingRecharges: 0,
    pendingWithdrawals: 0,
    activeRentals: 0,
    totalBalance: 0,
    totalUsers: 0,
    totalCars: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const [pendingRec, pendingWd, activeInv, users, cars] = await Promise.all([
      supabase.from('recharge_logs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('withdrawal_logs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('investments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('cars').select('*', { count: 'exact', head: true }),
    ]);

    const { data: balanceData } = await supabase.from('profiles').select('wallet_balance');

    setStats({
      pendingRecharges: pendingRec.count || 0,
      pendingWithdrawals: pendingWd.count || 0,
      activeRentals: activeInv.count || 0,
      totalBalance: (balanceData || []).reduce((sum, p) => sum + Number(p.wallet_balance || 0), 0),
      totalUsers: users.count || 0,
      totalCars: cars.count || 0,
    });
  }

  const quickActions: AdminTab[] = [
    { id: 'recharges', label: 'Pending Recharges', icon: <ArrowDownCircle className="w-5 h-5" /> },
    { id: 'withdrawals', label: 'Pending Withdrawals', icon: <ArrowUpCircle className="w-5 h-5" /> },
    { id: 'cars', label: 'Manage Cars', icon: <Briefcase className="w-5 h-5" /> },
    { id: 'users', label: 'User Activity Logs', icon: <Wallet className="w-5 h-5" /> },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Dashboard Overview</h2>
        <p className="text-gray-400 text-sm">Platform metrics and quick actions</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<ArrowDownCircle className="w-6 h-6" />}
          label="Pending Recharges"
          value={String(stats.pendingRecharges)}
          color="text-amber-400"
          bg="bg-amber-500/10"
          onClick={() => onNavigate('recharges')}
        />
        <MetricCard
          icon={<ArrowUpCircle className="w-6 h-6" />}
          label="Pending Withdrawals"
          value={String(stats.pendingWithdrawals)}
          color="text-orange-400"
          bg="bg-orange-500/10"
          onClick={() => onNavigate('withdrawals')}
        />
        <MetricCard
          icon={<Briefcase className="w-6 h-6" />}
          label="Active Rentals"
          value={String(stats.activeRentals)}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <MetricCard
          icon={<Wallet className="w-6 h-6" />}
          label="Total Platform Balance"
          value={formatCurrency(stats.totalBalance)}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#131825] rounded-xl p-5 border border-[#232a3f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Total Users</p>
              <p className="text-white text-xl font-bold">{stats.totalUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#131825] rounded-xl p-5 border border-[#232a3f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Total Cars Listed</p>
              <p className="text-white text-xl font-bold">{stats.totalCars}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id)}
              className="flex items-center justify-between bg-[#131825] rounded-xl p-4 border border-[#232a3f] hover:border-blue-500/40 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                  {action.icon}
                </div>
                <span className="text-white font-medium text-sm">{action.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color, bg, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#131825] rounded-xl p-5 border border-[#232a3f] ${onClick ? 'cursor-pointer hover:border-blue-500/40 transition-all' : ''}`}
    >
      <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center ${color} mb-3`}>
        {icon}
      </div>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}
