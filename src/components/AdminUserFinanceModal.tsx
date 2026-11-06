import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, Profile, WithdrawalWallet } from '@/lib/types';
import { CircleAlert as AlertCircle, Copy, History, Save, Wallet, X } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface ReferralMember {
  id: string;
  full_name: string;
  phone: string | null;
  wallet_balance: number;
  vip_level: number;
  created_at: string;
}

export default function AdminUserFinanceModal({ user, onClose, onBalanceChanged }: { user: Profile; onClose: () => void; onBalanceChanged: (balance: number) => void }) {
  const [newBalance, setNewBalance] = useState(String(Number(user.wallet_balance).toFixed(2)));
  const [reason, setReason] = useState('');
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [referrals, setReferrals] = useState<ReferralMember[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadDetails();
  }, [user.id]);

  async function loadDetails() {
    setLoading(true);
    const [walletResult, referralResult, historyResult] = await Promise.all([
      supabase.from('withdrawal_wallets').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
      user.referral_code
        ? supabase.from('profiles').select('id, full_name, phone, wallet_balance, vip_level, created_at').eq('referred_by', user.referral_code).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('audit_logs').select('id, action, details, created_at').eq('user_id', user.id).eq('action', 'admin_wallet_balance_changed').order('created_at', { ascending: false }).limit(10),
    ]);
    setWallets((walletResult.data as unknown as WithdrawalWallet[]) || []);
    setReferrals((referralResult.data as unknown as ReferralMember[]) || []);
    setHistory((historyResult.data as unknown as AuditEntry[]) || []);
    setLoading(false);
  }

  async function handleSave() {
    const amount = Number(newBalance);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid non-negative balance.');
      return;
    }
    if (!reason.trim()) {
      setError('Enter a reason for this balance change.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const { data, error: rpcError } = await supabase.rpc('admin_set_wallet_balance', {
      p_user_id: user.id,
      p_new_balance: amount,
      p_reason: reason.trim(),
    });
    if (rpcError || typeof data !== 'number') {
      setError('The wallet balance could not be updated.');
      setSaving(false);
      return;
    }
    onBalanceChanged(data);
    setNewBalance(data.toFixed(2));
    setReason('');
    setSaved(true);
    await loadDetails();
    setSaving(false);
  }

  function copyReferralCode() {
    if (user.referral_code) void navigator.clipboard.writeText(user.referral_code);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#131825] rounded-t-2xl sm:rounded-2xl border border-[#232a3f] w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-[#131825] border-b border-[#232a3f] p-5 flex items-center justify-between">
          <div><h3 className="text-white font-bold">Manage User Finance</h3><p className="text-gray-500 text-xs mt-1">{user.full_name || 'Unnamed user'} · {user.phone || 'No phone'}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <section className="bg-[#0a0e1a] border border-[#232a3f] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3"><Wallet className="w-4 h-4 text-emerald-400" /><h4 className="text-sm font-semibold text-gray-200">Wallet Balance</h4></div>
            <p className="text-gray-500 text-xs mb-2">Current balance: <span className="text-white font-semibold">{formatCurrency(Number(user.wallet_balance))}</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input type="number" min="0" step="0.01" value={newBalance} onChange={(event) => setNewBalance(event.target.value)} className="admin-finance-input" placeholder="New balance" aria-label="New wallet balance" />
              <input type="text" maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} className="admin-finance-input" placeholder="Reason for change" aria-label="Reason for balance change" />
              <button onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2 gradient-primary text-white font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Saving' : 'Update'}</button>
            </div>
            {saved && <p className="text-emerald-400 text-xs mt-2">Balance updated and recorded in the audit history.</p>}
            {error && <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-semibold text-gray-200">Saved Withdrawal Wallets</h4><span className="text-xs text-gray-500">{wallets.length} saved</span></div>
            {loading ? <Loading /> : wallets.length === 0 ? <Empty text="No saved wallets" /> : <div className="space-y-2">{wallets.map((wallet) => <div key={wallet.id} className="bg-[#0a0e1a] rounded-lg p-3 flex items-center justify-between gap-3"><div><p className="text-white text-sm font-medium">{wallet.label} {wallet.is_default && <span className="text-emerald-400 text-xs">· Default</span>}</p><p className="text-gray-500 text-xs capitalize">{wallet.method} · {wallet.account_name}</p></div><p className="text-gray-300 text-xs font-mono truncate max-w-[45%]">{wallet.account_number}</p></div>)}</div>}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><h4 className="text-sm font-semibold text-gray-200">Referral Network</h4>{user.referral_code && <button onClick={copyReferralCode} className="text-blue-400 hover:text-blue-300" title="Copy referral code"><Copy className="w-3.5 h-3.5" /></button>}</div><span className="text-xs text-gray-500">{referrals.length} referrals · VIP {user.vip_level}</span></div>
            {user.referral_code && <p className="text-gray-500 text-xs mb-2">Code: <span className="text-gray-300 font-mono">{user.referral_code}</span></p>}
            {loading ? <Loading /> : referrals.length === 0 ? <Empty text="No referrals yet" /> : <div className="space-y-2">{referrals.map((referral) => <div key={referral.id} className="bg-[#0a0e1a] rounded-lg p-3 flex items-center justify-between"><div><p className="text-white text-sm">{referral.full_name || 'Unnamed user'}</p><p className="text-gray-500 text-xs">Joined {formatDate(referral.created_at).split(',')[0]} · VIP {referral.vip_level}</p></div><p className="text-emerald-400 text-sm font-semibold">{formatCurrency(Number(referral.wallet_balance))}</p></div>)}</div>}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2"><History className="w-4 h-4 text-blue-400" /><h4 className="text-sm font-semibold text-gray-200">Wallet Change History</h4></div>
            {loading ? <Loading /> : history.length === 0 ? <Empty text="No administrator balance changes" /> : <div className="space-y-2">{history.map((entry) => <div key={entry.id} className="bg-[#0a0e1a] rounded-lg p-3"><p className="text-gray-300 text-xs">{entry.details || 'Balance changed'}</p><p className="text-gray-600 text-[10px] mt-1">{formatDate(entry.created_at)}</p></div>)}</div>}
          </section>
        </div>
        <style>{`.admin-finance-input { width: 100%; background: #131825; border: 1px solid #232a3f; border-radius: 0.5rem; padding: 0.625rem 0.75rem; color: white; outline: none; font-size: 0.875rem; } .admin-finance-input:focus { border-color: #0066ff; }`}</style>
      </div>
    </div>
  );
}

function Loading() { return <div className="h-12 rounded-lg bg-[#0a0e1a] animate-pulse" />; }
function Empty({ text }: { text: string }) { return <p className="text-gray-600 text-sm text-center py-3">{text}</p>; }
