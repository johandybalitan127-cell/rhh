import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ currentTab, setCurrentTab }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const esRRHH = user.rol === 'rrhh' || user.rol === 'administrador';
  const iniciales = user.nombre_completo
    ? user.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('')
    : (user.nombre ? user.nombre[0] : 'U');

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-lilac-200/70 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('portal')}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-lilac-700 via-lilac-500 to-lavender-400 p-[1.5px] shadow-sm flex items-center justify-center">
            <div className="w-full h-full bg-[#FAF8FD] rounded-[14px] flex items-center justify-center">
              <i className="w-5 h-5 text-lilac-700" data-lucide="sparkles"></i>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-tight text-lilac-950">TecnoCR</span>
              <span className="text-xs font-bold text-lilac-600 uppercase tracking-wider">Soluciones</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 text-lilac-800 border border-lilac-300/60">
                <span className="w-1.5 h-1.5 rounded-full bg-lilac-500 mr-1 animate-pulse"></span>
                RRHH IA · Costa Rica
              </span>
            </div>
          </div>
        </div>

        {/* Center Desktop Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-lilac-100/60 p-1.5 rounded-2xl border border-lilac-200/50 shadow-inner">
          <button
            onClick={() => setCurrentTab('portal')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all duration-200 ${
              currentTab === 'portal'
                ? 'bg-white text-lilac-950 shadow-sm'
                : 'text-lilac-800/80 hover:text-lilac-950 hover:bg-white/50'
            }`}
          >
            <i className="w-4 h-4 text-lilac-600" data-lucide="layout-grid"></i>
            <span>Portal del Colaborador</span>
          </button>

          <button
            onClick={() => setCurrentTab('solicitudes')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all duration-200 ${
              currentTab === 'solicitudes'
                ? 'bg-white text-lilac-950 shadow-sm'
                : 'text-lilac-800/80 hover:text-lilac-950 hover:bg-white/50'
            }`}
          >
            <i className="w-4 h-4 text-lilac-600" data-lucide="calendar-clock"></i>
            <span>Mis Solicitudes</span>
          </button>

          <button
            onClick={() => setCurrentTab('chat')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all duration-200 ${
              currentTab === 'chat'
                ? 'bg-white text-lilac-950 shadow-sm'
                : 'text-lilac-800/80 hover:text-lilac-950 hover:bg-white/50'
            }`}
          >
            <i className="w-4 h-4 text-lilac-500" data-lucide="bot"></i>
            <span>Chatbot Multiagente</span>
            <span className="px-1.5 py-0.2 rounded-md bg-lilac-500 text-white text-[9px] font-bold">IA</span>
          </button>

          {esRRHH && (
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all duration-200 ${
                currentTab === 'dashboard'
                  ? 'bg-white text-lilac-950 shadow-sm'
                  : 'text-lilac-800/80 hover:text-lilac-950 hover:bg-white/50'
              }`}
            >
              <i className="w-4 h-4 text-lilac-600" data-lucide="bar-chart-3"></i>
              <span>Dashboard Ejecutivo</span>
            </button>
          )}
        </nav>

        {/* User Profile & Actions */}
        <div className="flex items-center space-x-3">
          <button
            aria-label="Notificaciones"
            className="relative p-2 rounded-xl text-lilac-800 hover:bg-lilac-100 transition"
          >
            <i className="w-4 h-4" data-lucide="bell"></i>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-lilac-500 ring-2 ring-white"></span>
          </button>

          <div className="flex items-center space-x-3 pl-3 border-l border-lilac-200/80">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-lilac-700 to-lavender-400 flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-lilac-200">
                {iniciales}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>
            
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-lilac-950 leading-tight">
                {user.nombre_completo || 'Usuario'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                {user.puesto || user.rol}
              </p>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center px-3 py-1.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-900 border border-lilac-200/80 rounded-xl text-xs font-semibold transition active:scale-95 space-x-1"
              title="Cerrar sesión"
            >
              <i className="w-3.5 h-3.5 text-lilac-700" data-lucide="log-out"></i>
              <span>Salir</span>
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Navbar;
