import { ChangeEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PaymentMethod } from '@/lib/types';
import { Check, ImagePlus, Plus, Save, Trash2, Upload, X } from 'lucide-react';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function AdminPaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadMethods();
  }, []);

  async function loadMethods() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('payment_methods')
      .select('*')
      .order('created_at', { ascending: true });
    if (loadError) setError('Payment methods could not be loaded.');
    setMethods((data as unknown as PaymentMethod[]) || []);
    setLoading(false);
  }

  async function handleDelete(method: PaymentMethod) {
    if (!confirm(`Remove ${method.method_name} from recharge options?`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from('payment_methods').delete().eq('id', method.id);
    if (deleteError) {
      setError('This payment method could not be removed.');
      return;
    }
    setMethods((current) => current.filter((item) => item.id !== method.id));
  }

  async function handleCreated(method: PaymentMethod) {
    setMethods((current) => [...current, method]);
    setShowAdd(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Payment QR Codes</h2>
          <p className="text-gray-400 text-sm">Manage the crypto payment options shown during wallet recharge.</p>
        </div>
        <button onClick={() => { setError(null); setShowAdd(true); }} className="flex items-center gap-2 gradient-primary text-white font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-90 whitespace-nowrap">
          <Plus className="w-5 h-5" /> Add Method
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}

      {methods.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No payment methods have been added yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((method) => (
            <PaymentMethodCard key={method.id} method={method} saving={savingId === method.id} onSaving={setSavingId} onError={setError} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showAdd && <AddPaymentMethodModal onClose={() => setShowAdd(false)} onCreated={handleCreated} onError={setError} />}
    </div>
  );
}

function PaymentMethodCard({
  method,
  saving,
  onSaving,
  onError,
  onDelete,
}: {
  method: PaymentMethod;
  saving: boolean;
  onSaving: (id: string | null) => void;
  onError: (message: string | null) => void;
  onDelete: (method: PaymentMethod) => void;
}) {
  const [name, setName] = useState(method.method_name);
  const [instructions, setInstructions] = useState(method.instructions || '');
  const [active, setActive] = useState(method.is_active);
  const [imageUrl, setImageUrl] = useState(method.qr_image_url);

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    onError(null);
    onSaving(method.id);
    const extension = file.type.split('/')[1] || 'png';
    const path = `${method.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('payment-qr').upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) {
      onError('The QR image could not be uploaded.');
      onSaving(null);
      return;
    }
    const { data } = supabase.storage.from('payment-qr').getPublicUrl(path);
    const { error: updateError } = await supabase.from('payment_methods').update({ qr_image_url: data.publicUrl }).eq('id', method.id);
    if (updateError) {
      onError('The QR image was uploaded but could not be assigned to this method.');
    } else {
      setImageUrl(data.publicUrl);
    }
    onSaving(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      onError('Payment method name is required.');
      return;
    }
    onError(null);
    onSaving(method.id);
    const { error: updateError } = await supabase.from('payment_methods').update({
      method_name: name.trim(),
      instructions: instructions.trim() || null,
      is_active: active,
    }).eq('id', method.id);
    if (updateError) onError('The payment method could not be saved.');
    onSaving(null);
  }

  return (
    <div className="bg-[#131825] rounded-2xl border border-[#232a3f] overflow-hidden">
      <div className="bg-white p-4 flex items-center justify-center min-h-56">
        <img src={imageUrl} alt={`${name} payment QR code`} className="w-48 h-48 object-contain rounded-lg" />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <input value={name} onChange={(event) => setName(event.target.value)} className="flex-1 bg-[#0a0e1a] border border-[#232a3f] rounded-lg px-3 py-2 text-white text-sm font-semibold outline-none focus:border-blue-500" aria-label="Payment method name" />
          <button onClick={() => setActive(!active)} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'}`}>
            {active ? 'Active' : 'Hidden'}
          </button>
        </div>
        <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={2} className="w-full bg-[#0a0e1a] border border-[#232a3f] rounded-lg px-3 py-2 text-gray-300 text-sm outline-none focus:border-blue-500" placeholder="Network instructions" aria-label="Payment instructions" />
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500/20 cursor-pointer transition-all">
            <Upload className="w-4 h-4" /> Replace QR
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} className="hidden" disabled={saving} />
          </label>
          <button onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={() => onDelete(method)} disabled={saving} className="p-2.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 disabled:opacity-50" aria-label={`Delete ${method.method_name}`}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {saving && <p className="text-blue-400 text-xs">Uploading or saving...</p>}
      </div>
    </div>
  );
}

function AddPaymentMethodModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (method: PaymentMethod) => void; onError: (message: string | null) => void }) {
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !file) {
      onError('Enter a name and choose a QR image.');
      return;
    }
    const validationError = validateImage(file);
    if (validationError) {
      onError(validationError);
      return;
    }
    setSaving(true);
    onError(null);

    const methodId = crypto.randomUUID();
    const extension = file.type.split('/')[1] || 'png';
    const path = `${methodId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('payment-qr').upload(path, file, { contentType: file.type });
    if (uploadError) {
      onError('The QR image could not be uploaded.');
      setSaving(false);
      return;
    }
    const { data } = supabase.storage.from('payment-qr').getPublicUrl(path);
    const { data: created, error: insertError } = await supabase.from('payment_methods').insert({
      id: methodId,
      method_name: name.trim(),
      qr_image_url: data.publicUrl,
      instructions: instructions.trim() || null,
      is_active: true,
    }).select('*').maybeSingle();
    if (insertError || !created) {
      await supabase.storage.from('payment-qr').remove([path]);
      onError('The payment method could not be added.');
      setSaving(false);
      return;
    }
    onCreated(created as unknown as PaymentMethod);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#131825] rounded-2xl border border-[#232a3f] p-5 w-full max-w-md" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Add Payment Method</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <input value={name} onChange={(event) => setName(event.target.value)} className="admin-payment-input" placeholder="e.g. USDT / TRC20" aria-label="Payment method name" />
          <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} className="admin-payment-input" placeholder="Network instructions" aria-label="Payment instructions" />
          <label className="flex flex-col items-center justify-center gap-2 h-36 border-2 border-dashed border-[#334155] rounded-xl text-gray-400 hover:border-blue-500 cursor-pointer transition-all">
            {file ? <><Check className="w-6 h-6 text-emerald-400" /><span className="text-sm text-white truncate max-w-[90%]">{file.name}</span></> : <><ImagePlus className="w-6 h-6" /><span className="text-sm">Choose QR image</span></>}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="hidden" />
          </label>
          <button onClick={handleSubmit} disabled={saving} className="w-full gradient-primary text-white font-semibold py-3 rounded-xl disabled:opacity-50">{saving ? 'Adding...' : 'Add Payment Method'}</button>
        </div>
        <style>{`.admin-payment-input { width: 100%; background: #0a0e1a; border: 1px solid #232a3f; border-radius: 0.75rem; padding: 0.75rem 1rem; color: white; outline: none; } .admin-payment-input:focus { border-color: #0066ff; }`}</style>
      </div>
    </div>
  );
}

function validateImage(file: File): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'Use a PNG, JPEG, or WebP image.';
  if (file.size > MAX_IMAGE_SIZE) return 'QR images must be 5 MB or smaller.';
  return null;
}
