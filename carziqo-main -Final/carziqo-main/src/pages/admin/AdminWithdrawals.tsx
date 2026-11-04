import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { WithdrawalLog, Profile, formatCurrency, formatDate } from '@/lib/types';
import { Check, X, Clock, ArrowUpCircle } from 'lucide-react';

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalLog[]>([]);
  const [userMap, setUserMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    loadWithdrawals();
  }, [filter]);

  async function loadWithdrawals() {
    setLoading(true);
    let query = supabase.from('withdrawal_logs').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    const wdData = (data as unknown as WithdrawalLog[]) || [];
    setWithdrawals(wdData);

    const userIds = [...new Set(wdData.map((w) => w.user_id))];
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('profiles').select('*').in('id', userIds);
      const map: Record<string, Profile> = {};
      (users as unknown as Profile[])?.forEach((u) => { map[u.id] = u; });
      setUserMap(map);

    }
    setLoading(false);
  }

  async function handleApprove(id: string) {
    setActioning(id);
    const { error } = await supabase.rpc('approve_withdrawal', { p_withdrawal_id: id });
    if (error) {
      alert(error.message);
    } else {
      await loadWithdrawals();
    }
    setActioning(null);
  }

  async function handleReject(id: string) {
    setActioning(id);
    const { error } = await supabase.rpc('reject_withdrawal', { p_withdrawal_id: id, p_note: 'Rejected by admin' });
    if (error) {
      alert(error.message);
    } else {
      await loadWithdrawals();
    }
    setActioning(null);
  }

  const filters = ['pending', 'approved', 'rejected', 'all'] as const;

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Withdrawal Approvals</h2>
        <p className="text-gray-400 text-sm">Review and process user withdrawal requests</p>
      </div>

      <div className="flex gap-2 p-1 bg-[#131825] rounded-xl w-fit">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              filter === f ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ArrowUpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No {filter !== 'all' ? filter : ''} withdrawals found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => {
            const user = userMap[w.user_id];
            return (
              <div key={w.id} className="bg-[#131825] rounded-xl border border-[#232a3f] p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <ArrowUpCircle className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{user?.full_name || 'Unknown user'}</p>
                      <p className="text-gray-500 text-xs">{formatDate(w.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-400 font-bold text-lg">{formatCurrency(Number(w.amount))}</p>
                    <StatusPill status={w.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3 bg-[#0a0e1a] rounded-lg p-3">
                  <InfoRow label="Bank / E-Wallet" value={w.bank_name} />
                  <InfoRow label="Account Name" value={w.account_name} />
                  <InfoRow label="Account Number" value={w.account_number} />
                  <InfoRow label="Requested" value={formatCurrency(Number(w.amount))} />
                  <InfoRow label="Processing Fee" value={formatCurrency(Number(w.fee_amount || 0))} />
                  <InfoRow label="User Receives" value={formatCurrency(Number(w.net_amount || w.amount))} />
                  <InfoRow label="User Balance" value={user ? formatCurrency(Number(user.wallet_balance)) : 'N/A'} />
                </div>


                {w.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(w.id)}
                      disabled={actioning === w.id}
                      className="flex-1 flex items-center justify-center gap-2 gradient-accent text-white font-semibold py-2.5 rounded-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" /> Approve & Send
                    </button>
                    <button
                      onClick={() => handleReject(w.id)}
                      disabled={actioning === w.id}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 font-semibold py-2.5 rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
                {w.admin_note && (
                  <div className="mt-2 text-xs text-gray-400 bg-[#0a0e1a] rounded-lg px-3 py-2">
                    Admin note: {w.admin_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white text-sm font-medium truncate">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'text-amber-400 bg-amber-500/10', icon: <Clock className="w-3 h-3" /> },
    approved: { color: 'text-emerald-400 bg-emerald-500/10', icon: <Check className="w-3 h-3" /> },
    rejected: { color: 'text-red-400 bg-red-500/10', icon: <X className="w-3 h-3" /> },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${c.color}`}>
      {c.icon} {status}
    </span>
  );
}
