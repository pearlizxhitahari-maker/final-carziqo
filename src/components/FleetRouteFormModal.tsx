import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CALIFORNIA_CITIES, CaliforniaCity } from '@/lib/californiaCities';
import { FleetRouteRow } from '@/pages/admin/AdminRoutes';
import { Check, X } from 'lucide-react';

function findCity(name: string): CaliforniaCity {
  return CALIFORNIA_CITIES.find((city) => city.name === name) ?? CALIFORNIA_CITIES[0];
}

export default function FleetRouteFormModal({
  route,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  route: FleetRouteRow | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [originName, setOriginName] = useState(route?.origin_name ?? 'Los Angeles');
  const [destinationName, setDestinationName] = useState(route?.destination_name ?? 'San Francisco');
  const [isActive, setIsActive] = useState(route?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (originName === destinationName) {
      setError('Pick two different cities for the start and the end of the route.');
      return;
    }
    const origin = findCity(originName);
    const destination = findCity(destinationName);
    const payload = {
      name: `${origin.name} to ${destination.name}`,
      origin_name: origin.name,
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      destination_name: destination.name,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      is_active: isActive,
    };

    setSaving(true);
    const result = route
      ? await supabase.from('fleet_routes').update(payload).eq('id', route.id)
      : await supabase.from('fleet_routes').insert({ ...payload, sort_order: nextSortOrder });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    onSaved();
  }

  const selectClass =
    'w-full bg-[#0a0e1a] border border-[#232a3f] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors';

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
          <h3 className="text-lg font-bold text-white">{route ? 'Edit Route' : 'Add New Route'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="route-origin" className="block text-sm font-medium text-gray-300 mb-2">Start city</label>
            <select id="route-origin" value={originName} onChange={(e) => setOriginName(e.target.value)} className={selectClass}>
              {CALIFORNIA_CITIES.map((city) => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="route-destination" className="block text-sm font-medium text-gray-300 mb-2">End city</label>
            <select
              id="route-destination"
              value={destinationName}
              onChange={(e) => setDestinationName(e.target.value)}
              className={selectClass}
            >
              {CALIFORNIA_CITIES.map((city) => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'gradient-accent text-white' : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  !isActive ? 'bg-gray-600 text-white' : 'bg-[#0a0e1a] border border-[#232a3f] text-gray-400'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full gradient-primary text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : <><Check className="w-5 h-5" /> Save Route</>}
          </button>
        </div>
      </div>
    </div>
  );
}
