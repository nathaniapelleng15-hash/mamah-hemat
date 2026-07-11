import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  ChefHat, ClipboardList, CreditCard, Package,
  Settings, LogOut, Menu, X, Bell
} from 'lucide-react';

const navItems = [
  { to: '/admin/orders',       icon: ClipboardList, label: 'Pesanan Masuk',    badge: 'orders'   },
  { to: '/admin/transactions', icon: CreditCard,    label: 'Transaksi',         badge: 'txn'      },
  { to: '/admin/products',     icon: Package,       label: 'Produk & Add-on',   badge: null       },
  { to: '/admin/settings',     icon: Settings,      label: 'Pengaturan',         badge: null       },
];

export default function AdminApp() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    try {
      // Log aktivitas logout
      const logs = JSON.parse(localStorage.getItem('mh_admin_logs') || '[]');
      logs.unshift({
        type: 'logout',
        timestamp: new Date().toISOString(),
        description: 'Admin logout',
      });
      localStorage.setItem('mh_admin_logs', JSON.stringify(logs.slice(0, 100)));
    } catch (e) {
      console.error('Gagal menyimpan log logout:', e);
    }

    localStorage.removeItem('mh_admin_token');
    localStorage.removeItem('mh_admin_expiry');
    navigate('/admin', { replace: true });
  };

  const Sidebar = () => (
    <aside className="flex flex-col h-full w-64 bg-[#080808] border-r border-neutral-800/60">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-neutral-800/60">
        <div className="w-10 h-10 rounded-full border border-[#E4C670]/30 flex items-center justify-center shrink-0 overflow-hidden bg-black">
          <img src="/logo-mamahemat.png" alt="Mamah Hemat Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">Mamah Hemat</p>
          <p className="text-[10px] text-neutral-500 leading-tight">Admin Panel</p>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-[#E4C670]/10 text-[#E4C670] border border-[#E4C670]/15'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-[#E4C670]' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-neutral-800/60">
        <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-neutral-900/50">
          <div className="w-7 h-7 rounded-full bg-[#E4C670]/20 flex items-center justify-center text-xs font-bold text-[#E4C670]">A</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Super Admin</p>
            <p className="text-[10px] text-neutral-500">admin@mamahhemat.com</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col h-full">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-4 md:px-6 py-4 bg-[#0a0a0a]/95 backdrop-blur border-b border-neutral-800/60">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button className="relative p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E4C670] border border-[#0a0a0a]" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
