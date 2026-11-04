import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import FleetRouteFormModal from '@/components/FleetRouteFormModal';
import { MapPin, Plus, Edit, Trash2, ArrowRight } from 'lucide-react';

export interface FleetRouteRow {
  id: string;
  name: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  is_active: boolean;
  sort_order: number;
}

export default function AdminRoutes() {
  const [routes, setRoutes] = useState<FleetRouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FleetRouteRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, []);

  async function loadRoutes() {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('fleet_routes')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      setLoadError(error.message);
    } else {
      setRoutes((data as FleetRouteRow[]) ?? []);
    }
    setLoading(false);
  }

  async function toggleActive(route: FleetRouteRow) {
    setActionError(null);
    const { error } = await supabase.from('fleet_routes').update({ is_active: !route.is_active }).eq('id', route.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    await loadRoutes();
  }

  async function handleDelete(route: FleetRouteRow) {
    if (!confirm(`Delete the route "${route.name}"?`)) return;
    setActionError(null);
    const { error } = await supabase.from('fleet_routes').delete().eq('id', route.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    await loadRoutes();
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Fleet Routes</h2>
          <p className="text-gray-400 text-sm">Choose the California cities the rental cars drive between</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 gradient-primary text-white font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-90 shrink-0"
        >
          <Plus className="w-5 h-5" /> Add Route
        </button>
      </div>

      {loadError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          Routes could not be loaded: {loadError}
        </div>
      )}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{actionError}</div>
      )}

      {routes.length === 0 && !loadError && (
        <div className="bg-[#131825] rounded-xl border border-dashed border-[#232a3f] p-10 text-center text-gray-400 text-sm">
          No routes yet. Add one to start driving cars on the map.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {routes.map((route) => (
          <div key={route.id} className="bg-[#131825] rounded-xl border border-[#232a3f] p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 text-white font-semibold text-sm">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="flex items-center gap-2 min-w-0 truncate">
                  <span className="truncate">{route.origin_name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{route.destination_name}</span>
                </span>
              </div>
              <button
                onClick={() => toggleActive(route)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
                  route.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-600 text-white'
                }`}
              >
                {route.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(route); setShowForm(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 py-2 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-all"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => handleDelete(route)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 py-2 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <FleetRouteFormModal
          route={editing}
          nextSortOrder={routes.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadRoutes(); }}
        />
      )}
    </div>
  );
}
