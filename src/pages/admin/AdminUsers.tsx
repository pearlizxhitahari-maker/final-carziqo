import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, AuditLog, Investment, RechargeLog, WithdrawalLog, formatCurrency, formatDate } from '@/lib/types';
import { Users, Activity, Search, TrendingUp, ArrowDownCircle, ArrowUpCircle, Briefcase, Pause, Play, Pencil, Trash2 } from 'lucide-react';
import AdminInvestmentModal from '@/components/AdminInvestmentModal';

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userDetails, setUserDetails] = useState<{
    investments: Investment[];
    recharges: RechargeLog[];
    withdrawals: WithdrawalLog[];
    logs: AuditLog[];
  } | null>(null);
  const [manageInvestment, setManageInvestment] = useState<Investment | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('role', 'user').order('created_at', { ascending: false });
    setUsers((data as unknown as Profile[]) || []);
    setLoading(false);
  }

  async function loadUserDetails(user: Profile) {
    setSelectedUser(user);
    setActionError(null);
    const [invRes, recRes, wdRes, logRes] = await Promise.all([
      supabase.from('investments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('recharge_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('withdrawal_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('audit_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setUserDetails({
      investments: (invRes.data as unknown as Investment[]) || [],
      recharges: (recRes.data as unknown as RechargeLog[]) || [],
      withdrawals: (wdRes.data as unknown as WithdrawalLog[]) || [],
      logs: (logRes.data as unknown as AuditLog[]) || [],
    });
  }

  async function quickAction(inv: Investment, action: 'pause' | 'resume' | 'delete') {
    if (action === 'delete' && !confirm(`Permanently delete ${inv.car_name}? This cannot be undone.`)) return;
    setActionError(null);
    const payload: Record<string, unknown> = { p_investment_id: inv.id, p_action: action };
    const { error: rpcError } = await supabase.rpc('admin_manage_investment', payload);
    if (rpcError) {
      setActionError('That action could not be completed. Please try again.');
      return;
    }
    if (selectedUser) await loadUserDetails(selectedUser);
  }

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || '').includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">User Activity Logs</h2>
        <p className="text-gray-400 text-sm">View user data, balances, rental contracts, and transaction history</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full bg-[#131825] border border-[#232a3f] rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
        />
      </div>

      {/* User list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => loadUserDetails(user)}
              className="w-full flex items-center justify-between bg-[#131825] rounded-xl px-4 py-3 border border-[#232a3f] hover:border-blue-500/40 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{user.full_name?.[0]?.toUpperCase() || 'U'}</span>
                  </div>
                )}
                <div>
                  <p className="text-white font-medium text-sm">{user.full_name || 'Unnamed'}</p>
                  <p className="text-gray-500 text-xs">{user.phone || 'No phone'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 font-bold text-sm">{formatCurrency(Number(user.wallet_balance))}</p>
                <p className="text-gray-500 text-xs">{formatDate(user.created_at).split(',')[0]}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* User detail drawer */}
      {selectedUser && userDetails && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          onClick={() => { setSelectedUser(null); setUserDetails(null); }}
        >
          <div
            className="bg-[#131825] rounded-t-2xl sm:rounded-2xl border border-[#232a3f] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#131825] border-b border-[#232a3f] p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt={selectedUser.full_name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">{selectedUser.full_name?.[0]?.toUpperCase() || 'U'}</span>
                  </div>
                )}
                <div>
                  <h3 className="text-white font-bold">{selectedUser.full_name}</h3>
                  <p className="text-gray-500 text-xs">{selectedUser.phone || 'No phone'}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedUser(null); setUserDetails(null); }} className="text-gray-400 hover:text-white">
                <span className="text-xl">×</span>
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Balance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0e1a] rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Wallet Balance</p>
                  <p className="text-white text-xl font-bold">{formatCurrency(Number(selectedUser.wallet_balance))}</p>
                </div>
                <div className="bg-[#0a0e1a] rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Active Rentals</p>
                  <p className="text-white text-xl font-bold">
                    {userDetails.investments.filter((i) => i.status === 'active').length}
                  </p>
                </div>
              </div>

              {/* Investments */}
              <Section title="Rental Contracts" icon={<Briefcase className="w-4 h-4" />}>
                {actionError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs mb-2">{actionError}</div>
                )}
                {userDetails.investments.length === 0 ? (
                  <Empty text="No rentals" />
                ) : (
                  userDetails.investments.map((inv) => (
                    <div key={inv.id} className="bg-[#0a0e1a] rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <img src={inv.car_image_url} alt={inv.car_name} className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{inv.car_name}</p>
                          <p className="text-gray-500 text-xs">{inv.days_completed}/{inv.duration_days} days · {formatCurrency(Number(inv.daily_payout))}/day</p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 text-sm font-bold">{formatCurrency(Number(inv.total_earned))}</p>
                          <p className={`text-[10px] capitalize ${inv.status === 'paused' ? 'text-amber-400' : 'text-gray-500'}`}>{inv.status}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {inv.status === 'active' && (
                          <button onClick={() => quickAction(inv, 'pause')} className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500/10 text-amber-400 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-all">
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </button>
                        )}
                        {inv.status === 'paused' && (
                          <button onClick={() => quickAction(inv, 'resume')} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 text-emerald-400 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-all">
                            <Play className="w-3.5 h-3.5" /> Resume
                          </button>
                        )}
                        <button onClick={() => setManageInvestment(inv)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-all">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => quickAction(inv, 'delete')} className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </Section>

              {/* Recharges */}
              <Section title="Recharge History" icon={<ArrowDownCircle className="w-4 h-4" />}>
                {userDetails.recharges.length === 0 ? (
                  <Empty text="No recharges" />
                ) : (
                  userDetails.recharges.map((r) => (
                    <div key={r.id} className="flex items-center justify-between bg-[#0a0e1a] rounded-lg p-3">
                      <div>
                        <p className="text-white text-sm font-medium">{formatCurrency(Number(r.amount))}</p>
                        <p className="text-gray-500 text-xs">{r.payment_method} · {formatDate(r.created_at)}</p>
                      </div>
                      <span className="text-xs capitalize text-gray-400">{r.status}</span>
                    </div>
                  ))
                )}
              </Section>

              {/* Withdrawals */}
              <Section title="Withdrawal History" icon={<ArrowUpCircle className="w-4 h-4" />}>
                {userDetails.withdrawals.length === 0 ? (
                  <Empty text="No withdrawals" />
                ) : (
                  userDetails.withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between bg-[#0a0e1a] rounded-lg p-3">
                      <div>
                        <p className="text-white text-sm font-medium">{formatCurrency(Number(w.amount))}</p>
                        <p className="text-gray-500 text-xs">{w.bank_name} · {formatDate(w.created_at)}</p>
                      </div>
                      <span className="text-xs capitalize text-gray-400">{w.status}</span>
                    </div>
                  ))
                )}
              </Section>

              {/* Activity logs */}
              <Section title="Activity Logs" icon={<Activity className="w-4 h-4" />}>
                {userDetails.logs.length === 0 ? (
                  <Empty text="No activity logged" />
                ) : (
                  userDetails.logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 bg-[#0a0e1a] rounded-lg p-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{log.action.replace(/_/g, ' ')}</p>
                        {log.details && <p className="text-gray-500 text-xs">{log.details}</p>}
                        <p className="text-gray-600 text-[10px] mt-0.5">{formatDate(log.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </Section>
            </div>
          </div>
        </div>
      )}

      {manageInvestment && selectedUser && (
        <AdminInvestmentModal
          investment={manageInvestment}
          onClose={() => setManageInvestment(null)}
          onSaved={() => { setManageInvestment(null); loadUserDetails(selectedUser); }}
        />
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">{icon} {title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-gray-600 text-sm text-center py-4">{text}</p>;
}
