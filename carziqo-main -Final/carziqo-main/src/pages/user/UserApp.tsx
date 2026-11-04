import { useAuth } from '@/context/AuthContext';
import { Car, Home, Briefcase, User, LogOut, Gift, Leaf, Info } from 'lucide-react';
import { useState } from 'react';
import UserDashboard from '@/pages/user/UserDashboard';
import CarStore from '@/pages/user/CarStore';
import MyRentals from '@/pages/user/MyRentals';
import UserProfile from '@/pages/user/UserProfile';
import Rewards from '@/pages/user/Rewards';

type Tab = 'home' | 'store' | 'rentals' | 'rewards' | 'profile';

export default function UserApp({ onShowAbout }: { onShowAbout: () => void }) {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('home');

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'store', label: 'Car Store', icon: <Car className="w-5 h-5" /> },
    { id: 'rentals', label: 'Rentals', icon: <Briefcase className="w-5 h-5" /> },
    { id: 'rewards', label: 'Rewards', icon: <Gift className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Top bar */}
      <header className="glass sticky top-0 z-40 border-b border-[#232a3f]">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/carziqo.webp" alt="Carziqo.Ltd" className="w-9 h-9 rounded-lg object-cover bg-white" />
            <div>
              <h1 className="font-bold text-white text-sm">Carziqo.Ltd</h1>
              <p className="text-[10px] text-gray-400">Welcome, {profile?.full_name || 'User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShowAbout}
              className="w-9 h-9 rounded-lg bg-[#131825] flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
              title="About"
            >
              <Info className="w-4 h-4" />
            </button>
            {profile && profile.carbon_points > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-xs font-bold">{profile.carbon_points}</span>
              </div>
            )}
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-lg bg-[#131825] flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-6 pb-24">
        {tab === 'home' && <UserDashboard />}
        {tab === 'store' && <CarStore />}
        {tab === 'rentals' && <MyRentals />}
        {tab === 'rewards' && <Rewards />}
        {tab === 'profile' && <UserProfile />}
      </main>

      {/* Bottom nav */}
      <nav className="glass fixed bottom-0 left-0 right-0 border-t border-[#232a3f] z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                tab === item.id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${tab === item.id ? 'bg-blue-500/15' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
