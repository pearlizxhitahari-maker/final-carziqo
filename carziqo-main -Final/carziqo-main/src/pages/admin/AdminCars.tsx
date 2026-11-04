import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Car as CarType, formatCurrency } from '@/lib/types';
import { Plus, Edit, Trash2, X, TrendingUp, Car as CarIcon, Check, Gift } from 'lucide-react';

export default function AdminCars() {
  const [cars, setCars] = useState<CarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CarType | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCars();
  }, []);

  async function loadCars() {
    setLoading(true);
    const { data } = await supabase.from('cars').select('*').order('created_at', { ascending: false });
    setCars((data as unknown as CarType[]) || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this car?')) return;
    await supabase.from('cars').delete().eq('id', id);
    await loadCars();
  }

  async function toggleStatus(car: CarType) {
    await supabase
      .from('cars')
      .update({ status: car.status === 'active' ? 'inactive' : 'active' })
      .eq('id', car.id);
    await loadCars();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Car Management</h2>
          <p className="text-gray-400 text-sm">Add, edit, and manage car listings</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 gradient-primary text-white font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-90"
        >
          <Plus className="w-5 h-5" /> Add Car
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cars.map((car) => (
          <div key={car.id} className="bg-[#131825] rounded-xl border border-[#232a3f] overflow-hidden">
            <div className="relative h-36">
              <img src={car.image_url} alt={car.car_name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-2 right-2 flex gap-1.5">
                {car.is_free && (
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold gradient-gold text-black flex items-center gap-0.5">
                    <Gift className="w-2.5 h-2.5" /> FREE
                  </span>
                )}
                <button
                  onClick={() => toggleStatus(car)}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    car.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-gray-600 text-white'
                  }`}
                >
                  {car.status === 'active' ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
            <div className="p-3">
              <h3 className="text-white font-semibold text-sm mb-2">{car.car_name}</h3>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Price</p>
                  <p className="text-white font-bold text-sm">{formatCurrency(Number(car.price))}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-xs">Daily Rate</p>
                  <p className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {car.daily_return_rate}%
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(car); setShowForm(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 py-2 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-all"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(car.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 py-2 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <CarFormModal
          car={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadCars(); }}
        />
      )}
    </div>
  );
}

function CarFormModal({ car, onClose, onSaved }: { car: CarType | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(car?.car_name || '');
  const [imageUrl, setImageUrl] = useState(car?.image_url || '');
  const [price, setPrice] = useState(String(car?.price || ''));
  const [rate, setRate] = useState(String(car?.daily_return_rate || ''));
  const [status, setStatus] = useState(car?.status || 'active');
  const [isFree, setIsFree] = useState(car?.is_free || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name || !imageUrl || !price || !rate) {
      setError('All fields are required');
      return;
    }
    setSaving(true);

    const payload = {
      car_name: name,
      image_url: imageUrl,
      price: parseFloat(price),
      daily_return_rate: parseFloat(rate),
      status,
      is_free: isFree,
    };

    if (car) {
      const { error } = await supabase.from('cars').update(payload).eq('id', car.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('cars').insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    onSaved();
  }

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
          <h3 className="text-lg font-bold text-white">{car ? 'Edit Car' : 'Add New Car'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Car Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="e.g. Tesla Model 3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="form-input"
              placeholder="https://..."
            />
            {imageUrl && <img src={imageUrl} alt="Preview" className="mt-2 w-full h-32 rounded-lg object-cover" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Price (₱)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="form-input"
                placeholder="500.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Daily Rate (%)</label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="form-input"
                placeholder="2.50"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus('active')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  status === 'active' ? 'gradient-accent text-white' : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatus('inactive')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  status === 'inactive' ? 'bg-gray-600 text-white' : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Free Starter Car</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsFree(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  !isFree ? 'bg-[#232a3f] text-white' : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400'
                }`}
              >
                Regular
              </button>
              <button
                onClick={() => setIsFree(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  isFree ? 'gradient-gold text-black' : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400'
                }`}
              >
                <Gift className="w-4 h-4" /> Free Car
              </button>
            </div>
            {isFree && (
              <p className="text-amber-400/70 text-xs mt-1.5">Free cars are automatically assigned to every new user as a 15-day starter investment.</p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : <><Check className="w-5 h-5" /> Save Car</>}
          </button>
        </div>

        <style>{`
          .form-input {
            width: 100%;
            background: #0a0e1a;
            border: 1px solid #232a3f;
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
            color: white;
            font-size: 0.95rem;
            outline: none;
            transition: border-color 0.2s;
          }
          .form-input:focus { border-color: #0066ff; }
          .form-input::placeholder { color: #4b5563; }
        `}</style>
      </div>
    </div>
  );
}
