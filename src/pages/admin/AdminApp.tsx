import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminNotifications from '@/components/AdminNotifications';
import { LayoutDashboard, Car, ArrowDownCircle, ArrowUpCircle, Users, LogOut, Menu, X, Info, Route } from 'lucide-react';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminRecharges from '@/pages/admin/AdminRecharges';
import AdminWithdrawals from '@/pages/admin/AdminWithdrawals';
import AdminCars from '@/pages/admin/AdminCars';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminRoutes from '@/pages/admin/AdminRoutes';

type AdminTab = 'dashboard' | 'recharges' | 'withdrawals' | 'cars' | 'routes' | 'users';

export default function AdminApp({ onShowAbout }: { onShowAbout: () => void }) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'recharges', label: 'Recharge Approvals', icon: <ArrowDownCircle className="w-5 h-5" /> },
    { id: 'withdrawals', label: 'Withdrawal Approvals', icon: <ArrowUpCircle className="w-5 h-5" /> },
    { id: 'cars', label: 'Car Management', icon: <Car className="w-5 h-5" /> },
    { id: 'routes', label: 'Fleet Routes', icon: <Route className="w-5 h-5" /> },
    { id: 'users', label: 'User Logs', icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#131825] border-r border-[#232a3f] transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-[#232a3f]">
          <div className="flex items-center gap-3">
            <img src="/carziqo.webp" alt="Carziqo.Ltd" className="w-10 h-10 rounded-lg object-cover bg-white" />
            <div>
              <h1 className="font-bold text-white text-sm">Admin Panel</h1>
              <p className="text-[10px] text-gray-400">Carziqo.Ltd</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === item.id
                  ? 'gradient-primary text-white shadow-lg shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a2033]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#232a3f] space-y-1">
          <button
            onClick={onShowAbout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <Info className="w-5 h-5" />
            About Carziqo
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden glass sticky top-0 z-30 border-b border-[#232a3f] px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold text-sm">Admin · {navItems.find((n) => n.id === tab)?.label}</h1>
          <div className="w-6" />
        </header>

        <main className="p-4 lg:p-8 max-w-6xl mx-auto">
          <div className="flex justify-end mb-4">
            <AdminNotifications />
          </div>
          {tab === 'dashboard' && <AdminDashboard onNavigate={setTab} />}
          {tab === 'recharges' && <AdminRecharges />}
          {tab === 'withdrawals' && <AdminWithdrawals />}
          {tab === 'cars' && <AdminCars />}
          {tab === 'routes' && <AdminRoutes />}
          {tab === 'users' && <AdminUsers />}
        </main>
      </div>
    </div>
  );
}
