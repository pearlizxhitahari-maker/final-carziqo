import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, WithdrawalWallet, WithdrawalMethod, WITHDRAWAL_METHOD_LABELS } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { X, Check, AlertCircle, ArrowUpCircle, Wallet, Plus, Smartphone, Building2, Bitcoin, Star } from 'lucide-react';

const METHOD_ICONS: Record<WithdrawalMethod, React.ReactNode> = {
  gcash: <Smartphone className="w-4 h-4" />,
  paymaya: <Smartphone className="w-4 h-4" />,
  bank: <Building2 className="w-4 h-4" />,
  crypto: <Bitcoin className="w-4 h-4" />,
};

const METHOD_COLORS: Record<WithdrawalMethod, string> = {
  gcash: 'bg-blue-500/15 text-blue-400',
  paymaya: 'bg-emerald-500/15 text-emerald-400',
  bank: 'bg-amber-500/15 text-amber-400',
  crypto: 'bg-violet-500/15 text-violet-400',
};

export default function WithdrawModal({ balance, onClose, onSuccess }: { balance: number; onClose: () => void; onSuccess: () => void }) {
  const { session } = useAuth();
  const [amount, setAmount] = useState('');
  const [wallets, setWallets] = useState<WithdrawalWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [qualifiedReferrals, setQualifiedReferrals] = useState(0);
  const [requiredReferrals, setRequiredReferrals] = useState(1);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);

  const amt = parseFloat(amount) || 0;
  const fee = Math.round(amt * 0.01 * 100) / 100;
  const payout = amt - fee;
  const insufficient = amt > balance;
  const belowMinimum = amt > 0 && amt < 500;
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) || null;
  const eligible = qualifiedReferrals >= requiredReferrals;

  useEffect(() => {
    if (session) {
      loadWallets();
      loadWithdrawalEligibility();
    }
  }, [session]);

  async function loadWallets() {
    if (!session) return;
    const { data } = await supabase
      .from('withdrawal_wallets')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    const list = (data as unknown as WithdrawalWallet[]) || [];
    setWallets(list);
    const defaultWallet = list.find((w) => w.is_default) || list[0];
    if (defaultWallet) setSelectedWalletId(defaultWallet.id);
  }

  async function loadWithdrawalEligibility() {
    if (!session) return;
    setEligibilityLoading(true);
    const { data, error: eligibilityError } = await supabase.rpc('check_withdrawal_eligibility', {
      p_user_id: session.user.id,
    });
    const row = Array.isArray(data) ? data[0] as { eligible?: boolean; qualified_referrals?: number } | undefined : undefined;
    setQualifiedReferrals(row?.qualified_referrals || 0);
    if (eligibilityError) setQualifiedReferrals(0);

    const { data: required, error: requiredError } = await supabase.rpc('withdrawal_referrals_required', {
      p_user_id: session.user.id,
    });
    setRequiredReferrals(typeof required === 'number' ? required : 1);
    if (requiredError) setRequiredReferrals(1);
    setEligibilityLoading(false);
  }

  async function handleSubmit() {
    if (!session || !selectedWallet) return;
    setError(null);

    if (eligibilityLoading) {
      setError('Checking withdrawal eligibility. Please try again in a moment.');
      return;
    }
    if (!eligible) {
      setError(`This withdrawal needs ${requiredReferrals} qualified referral${requiredReferrals > 1 ? 's' : ''} who each invested at least ₱500.`);
      return;
    }
    if (amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amt < 500) {
      setError('Minimum withdrawal is ₱500');
      return;
    }
    if (amt > balance) {
      setError('Insufficient balance');
      return;
    }

    setSubmitting(true);

    const { error: insErr } = await supabase.from('withdrawal_logs').insert({
      user_id: session.user.id,
      amount: amt,
      account_name: selectedWallet.account_name,
      account_number: selectedWallet.account_number,
      bank_name: selectedWallet.bank_name || selectedWallet.label,
    });

    if (insErr) {
      setError(insErr.message);
      setSubmitting(false);
      return;
    }

    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'withdrawal_submitted',
      details: `Amount: ${amt}, To: ${selectedWallet.label} - ${selectedWallet.account_number}`,
    });

    setSuccess(true);
    setSubmitting(false);
    setTimeout(onSuccess, 2000);
  }

  if (success) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-center py-8 animate-scale-in">
          <div className="w-16 h-16 gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Withdrawal Submitted!</h3>
          <p className="text-gray-400 text-sm">Your request is pending admin approval. Funds will be sent once approved.</p>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div className="animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-orange-400" /> Withdraw Funds
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#0a0e1a] rounded-xl p-4 mb-4 text-center">
          <p className="text-gray-400 text-xs">Available Balance</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(balance)}</p>
        </div>

        <div className={`rounded-xl p-4 mb-4 border ${eligible ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <p className={`text-sm font-semibold ${eligible ? 'text-emerald-400' : 'text-amber-300'}`}>
            {eligibilityLoading ? 'Checking withdrawal eligibility...' : eligible ? 'Withdrawal eligibility confirmed' : 'Withdrawal locked until you qualify'}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {eligible ? 'You have enough qualified referrals.' : `Invite ${requiredReferrals} user${requiredReferrals > 1 ? 's' : ''} who each rent a car for at least ₱500 (${qualifiedReferrals}/${requiredReferrals}).`} Minimum withdrawal: ₱500
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <label className="text-sm font-medium text-gray-300 mb-2 block">Withdrawal Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`w-full bg-[#0a0e1a] border rounded-xl px-4 py-3.5 text-white text-xl font-bold outline-none transition-colors ${
            insufficient || belowMinimum ? 'border-red-500/50' : 'border-[#232a3f] focus:border-blue-500'
          }`}
          placeholder="0.00"
          max={balance}
          step="0.01"
        />
        {insufficient && <p className="text-red-400 text-xs mt-1">Amount exceeds available balance.</p>}
        {belowMinimum && <p className="text-red-400 text-xs mt-1">Minimum withdrawal is ₱500.</p>}
        {amt >= 500 && <p className="text-gray-400 text-xs mt-1">You will receive {formatCurrency(payout)} after the 1% fee.</p>}
        <button
          onClick={() => setAmount(String(balance))}
          className="text-blue-400 text-xs mt-1 hover:text-blue-300"
        >
          Withdraw all ({formatCurrency(balance)})
        </button>

        {/* Saved wallets */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Payout Destination</label>
            <button
              onClick={() => setShowAddWallet(true)}
              className="text-blue-400 text-xs font-medium hover:text-blue-300 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Wallet
            </button>
          </div>

          {wallets.length === 0 ? (
            <button
              onClick={() => setShowAddWallet(true)}
              className="w-full bg-[#0a0e1a] border border-dashed border-[#232a3f] rounded-xl py-6 text-center hover:border-blue-500 transition-colors"
            >
              <Wallet className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Add your first withdrawal wallet</p>
              <p className="text-gray-600 text-xs mt-1">GCash, PayMaya, Bank, or Crypto</p>
            </button>
          ) : (
            <div className="space-y-2">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWalletId(w.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    selectedWalletId === w.id
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-[#0a0e1a] border-[#232a3f] hover:border-[#3a4258]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${METHOD_COLORS[w.method]}`}>
                    {METHOD_ICONS[w.method]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{w.label}</p>
                      {w.is_default && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                    </div>
                    <p className="text-gray-500 text-xs truncate">
                      {WITHDRAWAL_METHOD_LABELS[w.method]} · {w.account_number}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    selectedWalletId === w.id ? 'border-blue-500 bg-blue-500' : 'border-[#3a4258]'
                  }`}>
                    {selectedWalletId === w.id && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || eligibilityLoading || !eligible || insufficient || amt < 500 || !selectedWallet}
          className="w-full bg-orange-500 text-white font-semibold py-3.5 rounded-xl mt-5 transition-all hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processing...' : !selectedWallet ? 'Select a wallet first' : `Withdraw ${formatCurrency(amt)}`}
        </button>
      </div>

      {showAddWallet && (
        <AddWalletModal
          userId={session?.user.id || ''}
          onClose={() => setShowAddWallet(false)}
          onSaved={() => {
            setShowAddWallet(false);
            loadWallets();
          }}
        />
      )}
    </Overlay>
  );
}

function AddWalletModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('');
  const [method, setMethod] = useState<WithdrawalMethod>('gcash');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methodOptions: { value: WithdrawalMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'gcash', label: 'GCash', icon: <Smartphone className="w-4 h-4" /> },
    { value: 'paymaya', label: 'PayMaya', icon: <Smartphone className="w-4 h-4" /> },
    { value: 'bank', label: 'Bank', icon: <Building2 className="w-4 h-4" /> },
    { value: 'crypto', label: 'Crypto', icon: <Bitcoin className="w-4 h-4" /> },
  ];

  async function handleSave() {
    setError(null);
    if (!accountName || !accountNumber) {
      setError('Please fill in all required fields');
      return;
    }
    if (method === 'bank' && !bankName) {
      setError('Bank name is required for bank transfers');
      return;
    }

    setSaving(true);

    if (isDefault) {
      await supabase
        .from('withdrawal_wallets')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { error: insErr } = await supabase.from('withdrawal_wallets').insert({
      user_id: userId,
      label: label || `${WITHDRAWAL_METHOD_LABELS[method]} Wallet`,
      method,
      account_name: accountName,
      account_number: accountNumber,
      bank_name: method === 'bank' ? bankName : null,
      is_default: isDefault,
    });

    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#131825] rounded-t-2xl sm:rounded-2xl border border-[#232a3f] p-5 w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" /> Add Withdrawal Wallet
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Method</label>
            <div className="grid grid-cols-4 gap-2">
              {methodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMethod(opt.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                    method === opt.value
                      ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                      : 'bg-[#0a0e1a] border-[#232a3f] text-gray-400 hover:text-white'
                  }`}
                >
                  {opt.icon}
                  <span className="text-[10px] font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
              placeholder="e.g. My GCash"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
              placeholder="Full name on account"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              {method === 'crypto' ? 'Wallet Address' : method === 'bank' ? 'Account Number' : 'Mobile Number'}
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
              placeholder={
                method === 'crypto'
                  ? '0x... or wallet address'
                  : method === 'bank'
                  ? 'Bank account number'
                  : '09XX XXX XXXX'
              }
            />
          </div>

          {method === 'bank' && (
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
                placeholder="e.g. BPI, BDO, Metrobank"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-gray-300 text-sm">Set as default payout destination</span>
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#131825] rounded-t-2xl sm:rounded-2xl border border-[#232a3f] p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
