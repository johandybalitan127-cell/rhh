import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SolicitudesPage from './pages/SolicitudesPage';
import SolicitudesModal from './components/SolicitudesModal';

export const App = () => {
  const { user, token, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('portal'); // 'portal' | 'solicitudes' | 'chat' | 'dashboard'
  const [vacaciones, setVacaciones] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  // Cargar datos del colaborador cuando haya sesión iniciada
  const cargarDatos = () => {
    if (token) {
      // Balance de Vacaciones
      fetch('http://localhost:8000/api/colaborador/vacaciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setVacaciones(data); })
      .catch(() => {});

      // Solicitudes recientes
      fetch('http://localhost:8000/api/colaborador/solicitudes', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : [])
      .then(data => setSolicitudes(data || []))
      .catch(() => {});
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [token]);

  // Actualizar iconos Lucide cada vez que cambie la vista o el estado del usuario
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [currentTab, user, solicitudes, vacaciones, modalOpen]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F7FC] text-lilac-900">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-lilac-700 via-lilac-500 to-lavender-400 animate-spin flex items-center justify-center p-1.5 shadow-xl">
          <div className="w-full h-full bg-white rounded-xl"></div>
        </div>
        <p className="mt-5 font-bold text-base tracking-wide text-lilac-950">Iniciando Portal TecnoCR Soluciones...</p>
        <p className="text-xs text-slate-500 mt-1">Recursos Humanos &amp; Asistente IA Costa Rica</p>
      </div>
    );
  }

  // Si no hay usuario autenticado, renderizar la pantalla de Login
  if (!user) {
    return <LoginPage />;
  }

  const esRRHH = user.rol === 'rrhh' || user.rol === 'administrador';

  // Valores de balance de vacaciones
  const disponibles = vacaciones?.dias_disponibles !== undefined ? Number(vacaciones.dias_disponibles).toFixed(1) : '11.0';
  const ganados = vacaciones?.dias_ganados !== undefined ? Number(vacaciones.dias_ganados).toFixed(1) : '14.0';
  const disfrutados = vacaciones?.dias_disfrutados !== undefined ? Number(vacaciones.dias_disfrutados).toFixed(1) : '4.0';
  const pctDisponibles = Math.min(100, Math.max(10, Math.round((Number(disponibles) / (Number(ganados) || 15)) * 100)));

  return (
    <div className="min-h-screen w-full bg-[#F8F7FC] flex flex-col font-sans antialiased text-slate-800">
      
      {/* Navbar Superior de Escritorio */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Área de Contenido Principal Web */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* VISTA 1: PORTAL DEL COLABORADOR (Diseño Web Desktop de 2 Columnas) */}
        {currentTab === 'portal' && (
          <div className="space-y-8">
            
            {/* Banner Hero Superior (Pantalla Completa) */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-lilac-800 via-lilac-700 to-lavender-600 text-white p-6 sm:p-8 shadow-card glow-lilac" data-purpose="hero-employee-card">
              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/15 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute top-0 right-1/4 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <div className="flex items-center space-x-2.5 mb-3">
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-white/20 text-white border border-white/30 backdrop-blur-md tracking-wider uppercase">
                      {user.rol || 'COLABORADOR'}
                    </span>
                    <span className="text-xs text-lilac-100 font-semibold flex items-center">
                      <i className="w-3.5 h-3.5 mr-1" data-lucide="building-2"></i>
                      Departamento de {user.departamento || 'Tecnología'}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center">
                    ¡Bienvenido, {user.nombre_completo || 'Carlos Jiménez'}! 
                    <span className="inline-block ml-2 text-2xl animate-bounce">👋</span>
                  </h1>
                  
                  <p className="text-sm text-lilac-100 mt-1.5 font-normal max-w-2xl leading-relaxed">
                    {user.puesto || 'Desarrollador Full Stack Senior'} · Consulta tus saldos legales, solicita permisos y resuelve tus dudas laborales con nuestro Asistente Inteligente.
                  </p>

                  {/* Chips de identificación */}
                  <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap gap-2.5 text-xs">
                    <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/20">
                      <i className="w-4 h-4 mr-2 text-lilac-200" data-lucide="badge-check"></i>
                      <span>Cédula: <strong>{user.cedula || '1-1589-0412'}</strong></span>
                    </div>
                    <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/20">
                      <i className="w-4 h-4 mr-2 text-lilac-200" data-lucide="laptop"></i>
                      <span>Modalidad: <strong>{user.modalidad || 'Remoto'}</strong></span>
                    </div>
                    <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/20">
                      <i className="w-4 h-4 mr-2 text-lilac-200" data-lucide="map-pin"></i>
                      <span>San José, Costa Rica</span>
                    </div>
                  </div>
                </div>

                {/* Acciones Rápidas en el Banner */}
                <div className="flex md:flex-col gap-3 justify-end shrink-0">
                  <button
                    onClick={() => setModalOpen(true)}
                    className="px-5 py-3 rounded-2xl bg-white text-lilac-950 font-bold text-xs sm:text-sm shadow-md hover:bg-lilac-50 transition active:scale-95 flex items-center justify-center space-x-2"
                  >
                    <i className="w-4 h-4 text-lilac-700" data-lucide="plus-circle"></i>
                    <span>Nueva Solicitud</span>
                  </button>
                  <button
                    onClick={() => setCurrentTab('chat')}
                    className="px-5 py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm border border-white/30 backdrop-blur-md transition active:scale-95 flex items-center justify-center space-x-2"
                  >
                    <i className="w-4 h-4 text-lilac-200" data-lucide="sparkles"></i>
                    <span>Consultar Asistente IA</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Grid Principal de 2 Columnas para Escritorio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Columna Izquierda (Vacaciones y Solicitudes) - 7 columnas */}
              <div className="lg:col-span-7 space-y-8">
                
                {/* Sección Balance de Vacaciones */}
                <section className="glass-card rounded-3xl p-6 shadow-soft border border-lilac-200/80">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-lilac-600"></div>
                        <h2 className="text-base font-bold text-lilac-950 uppercase tracking-wider">Balance de Vacaciones</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 pl-4.5 font-medium">
                        Periodo Anual Vigente: <span className="text-lilac-800 font-bold">{vacaciones?.periodo || '2025–2026'}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => setModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 bg-lilac-700 hover:bg-lilac-800 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 space-x-1.5"
                    >
                      <i className="w-4 h-4" data-lucide="plus"></i>
                      <span>Solicitar Días</span>
                    </button>
                  </div>

                  {/* 3 Tarjetas de Métricas en Horizontal */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                    {/* Tarjeta 1: Disponibles */}
                    <div className="bg-gradient-to-b from-lilac-100/90 to-lilac-50 rounded-2xl p-4 border border-lilac-300/70 flex flex-col items-center text-center relative overflow-hidden shadow-xs">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-lilac-400/15 rounded-full blur-md"></div>
                      <span className="text-[11px] font-bold text-lilac-800 tracking-wider uppercase mb-1">Disponibles</span>
                      <span className="text-3xl font-extrabold text-lilac-950 font-serif my-1">{disponibles}</span>
                      <span className="text-xs text-slate-500 font-medium">Días hábiles</span>
                      <div className="w-full bg-lilac-300/40 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div className="bg-lilac-600 h-full rounded-full transition-all duration-500" style={{ width: `${pctDisponibles}%` }}></div>
                      </div>
                    </div>

                    {/* Tarjeta 2: Ganados */}
                    <div className="bg-white rounded-2xl p-4 border border-cream-200/90 flex flex-col items-center text-center shadow-xs">
                      <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase mb-1">Ganados</span>
                      <span className="text-3xl font-extrabold text-slate-800 font-serif my-1">{ganados}</span>
                      <span className="text-xs text-slate-400 font-medium leading-tight">Días de ley</span>
                      <span className="text-[10px] text-slate-400">(Art. 153 Código de Trabajo)</span>
                    </div>

                    {/* Tarjeta 3: Disfrutados */}
                    <div className="bg-white rounded-2xl p-4 border border-cream-200/90 flex flex-col items-center text-center shadow-xs">
                      <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase mb-1">Disfrutados</span>
                      <span className="text-3xl font-extrabold text-slate-800 font-serif my-1">{disfrutados}</span>
                      <span className="text-xs text-slate-400 font-medium leading-tight">Días gozados</span>
                      <span className="text-[10px] text-slate-400">Aprobados por jefatura</span>
                    </div>
                  </div>
                </section>

                {/* Sección Mis Solicitudes Recientes */}
                <section className="glass-card rounded-3xl p-6 shadow-soft border border-lilac-200/80">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-lilac-100 flex items-center justify-center text-lilac-700">
                        <i className="w-4 h-4" data-lucide="calendar-clock"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-lilac-950 uppercase tracking-wider">Mis Solicitudes Recientes</h3>
                        <p className="text-xs text-slate-500">Historial de permisos y solicitudes de vacaciones</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setModalOpen(true)}
                      className="text-xs font-bold text-lilac-700 hover:text-lilac-900 transition flex items-center space-x-1"
                    >
                      <i className="w-3.5 h-3.5" data-lucide="plus"></i>
                      <span>Crear Solicitud</span>
                    </button>
                  </div>

                  {/* Tabla / Lista de Solicitudes */}
                  {solicitudes.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white border border-lilac-200/60 text-center">
                      <div className="w-12 h-12 mx-auto rounded-full bg-lilac-50 flex items-center justify-center text-lilac-600 mb-2">
                        <i className="w-6 h-6" data-lucide="inbox"></i>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No tienes solicitudes pendientes ni recientes.</p>
                      <p className="text-xs text-slate-400 mt-1">Cuando solicites vacaciones o permisos aparecerán aquí con su estado en tiempo real.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {solicitudes.slice(0, 5).map((sol) => (
                        <div
                          key={sol.id}
                          className="p-4 rounded-2xl bg-white border border-lilac-200/60 shadow-xs hover:border-lilac-300 transition flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3.5">
                            <div className="p-2.5 rounded-xl bg-lilac-50 text-lilac-700">
                              <i className="w-5 h-5" data-lucide="calendar"></i>
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-bold text-lilac-950">{sol.tipo.replace('_', ' ').toUpperCase()}</span>
                                <span className="text-xs font-bold text-lilac-700 bg-lilac-100 px-2.5 py-0.5 rounded-md">
                                  {sol.dias_solicitados} {sol.dias_solicitados === 1 ? 'día' : 'días'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 flex items-center">
                                <i className="w-3.5 h-3.5 mr-1 text-slate-400" data-lucide="calendar-range"></i>
                                {sol.fecha_inicio} al {sol.fecha_fin}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border tracking-wider uppercase ${
                              sol.estado === 'aprobada'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : sol.estado === 'rechazada'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                sol.estado === 'aprobada' ? 'bg-emerald-500' : (sol.estado === 'rechazada' ? 'bg-rose-500' : 'bg-amber-500')
                              }`}></span>
                              {sol.estado}
                            </span>
                          </div>
                        </div>
                      ))}
                      {solicitudes.length > 0 && (
                        <div className="pt-2 text-center">
                          <button
                            onClick={() => setCurrentTab('solicitudes')}
                            className="text-xs font-bold text-lilac-700 hover:text-lilac-900 bg-lilac-50 hover:bg-lilac-100 px-4 py-2 rounded-xl transition inline-flex items-center space-x-1.5"
                          >
                            <i className="w-3.5 h-3.5" data-lucide="list"></i>
                            <span>Ver todas ({solicitudes.length}) las solicitudes →</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

              </div>

              {/* Columna Derecha (Chatbot Multiagente RAG Integrado) - 5 columnas */}
              <div className="lg:col-span-5 space-y-6">
                <div className="glass-card rounded-3xl p-6 shadow-card border border-lilac-300/50 bg-gradient-to-b from-white to-lilac-50/50">
                  <div className="flex items-center justify-between pb-4 border-b border-lilac-100 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-lilac-700 to-lavender-400 flex items-center justify-center text-white shadow-sm">
                        <i className="w-5 h-5" data-lucide="bot"></i>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-lilac-950">Asistente RRHH Multiagente</h3>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">Costa Rica · Código de Trabajo &amp; Normativas</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setCurrentTab('chat')}
                      className="text-xs font-bold text-lilac-700 hover:text-lilac-900 bg-lilac-100 hover:bg-lilac-200 px-3 py-1.5 rounded-xl transition flex items-center space-x-1"
                      title="Abrir en pantalla completa"
                    >
                      <i className="w-3.5 h-3.5" data-lucide="maximize-2"></i>
                      <span>Expandir</span>
                    </button>
                  </div>

                  {/* Componente del Chatbot incrustado */}
                  <Chatbot />
                </div>
              </div>

            </div>

          </div>
        )}

        {/* VISTA 2: MIS SOLICITUDES (PÁGINA COMPLETA DE TRÁMITES LABORALES) */}
        {currentTab === 'solicitudes' && (
          <SolicitudesPage
            solicitudes={solicitudes}
            onNewRequest={() => setModalOpen(true)}
            onRefresh={cargarDatos}
          />
        )}

        {/* VISTA 3: CHATBOT MULTIAGENTE EN PANTALLA COMPLETA */}
        {currentTab === 'chat' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-extrabold text-lilac-950">Chatbot Inteligente de Recursos Humanos</h2>
                <p className="text-xs text-slate-500">Orquestación de agentes con LangGraph, RAG oficial y recuperación de políticas de Costa Rica</p>
              </div>
              <button
                onClick={() => setCurrentTab('portal')}
                className="px-4 py-2 rounded-xl bg-white border border-lilac-200 text-xs font-bold text-lilac-800 hover:bg-lilac-50 transition shadow-xs flex items-center space-x-1.5"
              >
                <i className="w-4 h-4" data-lucide="arrow-left"></i>
                <span>Volver al Portal</span>
              </button>
            </div>
            
            <div className="glass-card rounded-3xl p-6 shadow-card border border-lilac-200/80">
              <Chatbot />
            </div>
          </div>
        )}

        {/* VISTA 3: DASHBOARD EJECUTIVO RRHH (Sólo para roles autorizados) */}
        {currentTab === 'dashboard' && (
          esRRHH ? (
            <DashboardPage />
          ) : (
            <div className="glass-card rounded-3xl p-12 text-center max-w-lg mx-auto border border-lilac-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mb-4">
                ⛔
              </div>
              <h2 className="text-lg font-bold text-slate-900">Acceso Restringido</h2>
              <p className="text-sm text-slate-500 mt-2">
                El Dashboard Ejecutivo está reservado exclusivamente para la Gerencia de Talento Humano y Recursos Humanos.
              </p>
              <button
                className="mt-6 px-5 py-2.5 rounded-xl bg-lilac-700 text-white text-xs font-bold shadow-sm hover:bg-lilac-800 transition"
                onClick={() => setCurrentTab('portal')}
              >
                Volver al Portal del Colaborador
              </button>
            </div>
          )
        )}

      </main>

      {/* Pie de Página Web Corporativo */}
      <footer className="mt-auto border-t border-lilac-200/60 bg-white/70 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lilac-950">TecnoCR Soluciones S.A.</span>
            <span>· Portal Integral de Recursos Humanos &amp; IA</span>
          </div>
          <p>© 2026 TecnoCR Soluciones · Costa Rica. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* Modal de Solicitud de Vacaciones/Permisos */}
      <SolicitudesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          cargarDatos();
        }}
      />

    </div>
  );
};

export default App;
