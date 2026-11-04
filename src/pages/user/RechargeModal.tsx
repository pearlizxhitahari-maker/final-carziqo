import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PaymentMethod, formatCurrency } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { X, Upload, QrCode, Check, CircleAlert as AlertCircle } from 'lucide-react';

export default function RechargeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { session } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [step, setStep] = useState<'amount' | 'payment' | 'proof'>('amount');
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('payment_methods').select('*').eq('is_active', true).then(({ data }) => {
      setMethods((data as unknown as PaymentMethod[]) || []);
    });
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setUploading(true);
    setError(null);

    const ext = file.name.split('.').pop();
    const fileName = `proofs/${session.user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('recharge-proofs').upload(fileName, file);
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('recharge-proofs').getPublicUrl(fileName);
    setProofUrl(data.publicUrl);
    setUploading(false);
  }

  async function handleSubmit() {
    if (!session || !selectedMethod) return;
    const amt = parseFloat(amount);
    if (amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amt > 100000) {
      setError('Maximum recharge is ₱100,000 per request');
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: insErr } = await supabase.from('recharge_logs').insert({
      user_id: session.user.id,
      amount: amt,
      payment_method: selectedMethod.method_name,
      proof_image_url: proofUrl,
      reference_number: reference,
    });

    if (insErr) {
      setError(insErr.message);
      setSubmitting(false);
      return;
    }

    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'recharge_submitted',
      details: `Amount: ${amt}, Method: ${selectedMethod.method_name}`,
    });

    setSuccess(true);
    setSubmitting(false);
    setTimeout(onSuccess, 2000);
  }

  const presetAmounts = [50, 100, 500, 1000, 5000];

  if (success) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-center py-8 animate-scale-in">
          <div className="w-16 h-16 gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Recharge Submitted!</h3>
          <p className="text-gray-400 text-sm">Your deposit is pending admin approval. You'll be notified once verified.</p>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div className="animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Recharge Wallet</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-5">
          {['Amount', 'Payment', 'Proof'].map((label, i) => {
            const stepIdx = ['amount', 'payment', 'proof'].indexOf(step);
            const active = i <= stepIdx;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  active ? 'gradient-primary text-white' : 'bg-[#0a0e1a] text-gray-500 border border-[#232a3f]'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-xs ${active ? 'text-white' : 'text-gray-500'}`}>{label}</span>
                {i < 2 && <div className={`flex-1 h-0.5 ${active ? 'bg-blue-500' : 'bg-[#232a3f]'}`} />}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <div className="animate-fade-in">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Enter Amount (₱)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3.5 text-white text-2xl font-bold focus:border-blue-500 outline-none"
              placeholder="0.00"
              min="1"
              max="100000"
              step="0.01"
            />
            <div className="flex gap-2 mt-3">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(String(amt))}
                  className="flex-1 py-2 rounded-lg bg-[#0a0e1a] border border-[#232a3f] text-gray-300 text-sm font-medium hover:border-blue-500/40 hover:text-white transition-all"
                >
                  ₱{amt}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep('payment')}
              disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > 100000}
              className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl mt-5 transition-all hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Payment method */}
        {step === 'payment' && (
          <div className="animate-fade-in">
            <p className="text-sm text-gray-400 mb-3">Select a payment method:</p>
            <div className="space-y-2 mb-5">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                    selectedMethod?.id === m.id
                      ? 'border-blue-500 bg-blue-500/5'
                      : 'border-[#232a3f] bg-[#0a0e1a] hover:border-[#334155]'
                  }`}
                >
                  <div className="w-10 h-10 bg-[#131825] rounded-lg flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{m.method_name}</p>
                    <p className="text-gray-500 text-xs truncate">{m.instructions?.slice(0, 50)}...</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod?.id === m.id ? 'border-blue-500 bg-blue-500' : 'border-[#334155]'
                  }`}>
                    {selectedMethod?.id === m.id && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('amount')}
                className="px-5 py-3 rounded-xl bg-[#0a0e1a] border border-[#232a3f] text-gray-400 font-medium hover:text-white transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep('proof')}
                disabled={!selectedMethod}
                className="flex-1 gradient-primary text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Proof upload */}
        {step === 'proof' && selectedMethod && (
          <div className="animate-fade-in">
            {/* QR code display */}
            <div className="bg-white rounded-xl p-4 text-center mb-4">
              <img src={selectedMethod.qr_image_url} alt="Payment QR" className="w-48 h-48 mx-auto rounded-lg" />
              <p className="text-gray-700 text-sm font-semibold mt-3">{selectedMethod.method_name}</p>
              <p className="text-gray-500 text-xs mt-1">{formatCurrency(parseFloat(amount))}</p>
            </div>
            <p className="text-gray-400 text-xs mb-4 leading-relaxed">{selectedMethod.instructions}</p>

            {/* Reference number */}
            <label className="text-sm font-medium text-gray-300 mb-2 block">Transaction Reference Number</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none mb-4"
              placeholder="e.g. TXN123456789"
            />

            {/* Proof upload */}
            <label className="text-sm font-medium text-gray-300 mb-2 block">Upload Payment Screenshot</label>
            <div className="mb-4">
              {proofUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-emerald-500/30">
                  <img src={proofUrl} alt="Proof" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => setProofUrl(null)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#232a3f] rounded-xl cursor-pointer hover:border-blue-500/40 transition-all bg-[#0a0e1a]">
                  <div className="flex flex-col items-center gap-2">
                    {uploading ? (
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 text-gray-500" />
                    )}
                    <span className="text-gray-500 text-sm">{uploading ? 'Uploading...' : 'Click to upload receipt'}</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('payment')}
                className="px-5 py-3 rounded-xl bg-[#0a0e1a] border border-[#232a3f] text-gray-400 font-medium hover:text-white transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !proofUrl}
                className="flex-1 gradient-primary text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Recharge'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
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
