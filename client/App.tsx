
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Car,
  Calculator,
  LogOut,
  Menu,
  X,
  PieChart,
  Lock,
  Zap,
  History
} from 'lucide-react';

import { AppProvider } from './src/context/AppContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Pages
import { Login } from './src/pages/Login';
import { Dashboard } from './src/pages/Dashboard';
import { Credentials } from './src/pages/Credentials';
import { Statistics } from './src/pages/Statistics';
import { Clients } from './src/pages/Clients';
import { Vehicles } from './src/pages/Vehicles';
import { NewSimulation } from './src/pages/NewSimulation';
import { SalesHistory } from './src/pages/SalesHistory';
import { Users as UsersPage } from './src/pages/Users';

// --- Layout & Main App ---
const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout, loading } = useAuth();

  let menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Painel', path: '/' },
    { icon: <Calculator size={20} />, label: 'Simulação', path: '/simulation' },
    { icon: <Users size={20} />, label: 'Clientes', path: '/clients' },
    { icon: <Car size={20} />, label: 'Veículos', path: '/vehicles' },
    { icon: <History size={20} />, label: 'Vendas', path: '/sales' },
    { icon: <PieChart size={20} />, label: 'Estatísticas', path: '/statistics' },
    { icon: <Lock size={20} />, label: 'Credenciais', path: '/credentials' },
    { icon: <Users size={20} />, label: 'Usuários', path: '/users' },
  ];

  if (user?.role === 'vendedor') {
    menuItems = menuItems.filter(i => !['Usuários'].includes(i.label));
  } else if (user?.role === 'gerente') {
    menuItems = menuItems.filter(i => !['Usuários'].includes(i.label));
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent"></div></div>;
  }

  if (!user) {
    return <Login />;
  }

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-col hidden md:flex shadow-2xl print:hidden">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo.jpeg" alt="FlashCred" className="w-10 h-10 rounded-lg object-cover" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Flash<span className="text-[#CD7F32]">Cred</span></h1>
            <p className="text-xs text-slate-400">Automação de Crédito</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${location.pathname === item.path
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-amber-500 flex items-center justify-center font-bold text-white shadow-lg uppercase">
              {user.email.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate" title={user.email}>{user.email.split('@')[0]}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <LogOut size={16} onClick={logout} className="ml-auto text-slate-500 hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Mobile Sidebar Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="FlashCred" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Flash<span className="text-[#CD7F32]">Cred</span></h1>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${location.pathname === item.path
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-amber-500 flex items-center justify-center font-bold text-white uppercase">
              {user.email.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate" title={user.email}>{user.email.split('@')[0]}</p>
            </div>
            <LogOut size={16} onClick={logout} className="ml-auto text-slate-500 hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>
      </div>

      {/* Mobile Header & Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-1.5 rounded">
              <Zap className="text-white" size={20} />
            </div>
            <span className="font-bold text-slate-900">FlashCred</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600">
            <Menu size={24} />
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/simulation" element={<NewSimulation />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/sales" element={<SalesHistory />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/credentials" element={<Credentials />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/sign-in" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <Layout />
        </AppProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
