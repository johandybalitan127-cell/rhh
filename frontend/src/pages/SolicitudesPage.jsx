import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const SolicitudesPage = ({ onNewRequest, solicitudes = [], onRefresh }) => {
  const { user } = useAuth();
  const [filtroEstado, setFiltroEstado] = useState('todas'); // 'todas' | 'pendiente' | 'aprobada' | 'rechazada'
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [filtroEstado, filtroTipo, busqueda, solicitudes]);

  // Cálculos de métricas
  const total = solicitudes.length;
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length;
  const aprobadas = solicitudes.filter(s => s.estado === 'aprobada').length;
  const rechazadas = solicitudes.filter(s => s.estado === 'rechazada').length;
  const totalDias = solicitudes.reduce((acc, curr) => acc + (Number(curr.dias_solicitados) || 0), 0);

  // Filtrado
  const solicitudesFiltradas = solicitudes.filter(sol => {
    const coincideEstado = filtroEstado === 'todas' || sol.estado === filtroEstado;
    const coincideTipo = filtroTipo === 'todos' || sol.tipo === filtroTipo;
    const coincideBusqueda = busqueda === '' || 
      sol.motivo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      sol.tipo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      sol.fecha_inicio?.includes(busqueda) ||
      sol.fecha_fin?.includes(busqueda);
    return coincideEstado && coincideTipo && coincideBusqueda;
  });

  const getTipoInfo = (tipo) => {
    switch (tipo) {
      case 'vacaciones':
        return { label: 'Vacaciones Anuales', icon: 'palmtree', color: 'text-lilac-700 bg-lilac-100' };
      case 'permiso_con_goce':
        return { label: 'Permiso con Goce', icon: 'heart-handshake', color: 'text-blue-700 bg-blue-100' };
      case 'permiso_sin_goce':
        return { label: 'Permiso sin Goce', icon: 'clock', color: 'text-amber-700 bg-amber-100' };
      case 'cambio_modalidad':
        return { label: 'Cambio de Modalidad', icon: 'laptop', color: 'text-purple-700 bg-purple-100' };
      default:
        return { label: (tipo || 'Solicitud').replace('_', ' '), icon: 'file-text', color: 'text-slate-700 bg-slate-100' };
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Encabezado Superior de la Página */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-lilac-200/60">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-lilac-700 mb-1">
            <span>Portal del Colaborador</span>
            <span>/</span>
            <span className="text-slate-500">Mis Trámites Laborales</span>
          </div>
          <h1 className="text-2xl font-extrabold text-lilac-950 flex items-center space-x-2.5">
            <i className="w-7 h-7 text-lilac-700" data-lucide="clipboard-list"></i>
            <span>Historial y Solicitudes de Permisos</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Gestiona tus solicitudes de vacaciones, licencias de ley y cambios temporales con aprobación en línea.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-white border border-lilac-200 hover:bg-lilac-50 text-lilac-800 transition shadow-xs"
            title="Actualizar lista"
          >
            <i className="w-4 h-4" data-lucide="refresh-cw"></i>
          </button>
          <button
            onClick={onNewRequest}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-lilac-700 via-lilac-600 to-lavender-600 hover:from-lilac-800 hover:to-lilac-700 text-white font-bold text-xs sm:text-sm shadow-card glow-lilac transition active:scale-95 flex items-center space-x-2"
          >
            <i className="w-4 h-4" data-lucide="plus-circle"></i>
            <span>Nueva Solicitud</span>
          </button>
        </div>
      </div>

      {/* 4 Tarjetas de Métricas de Solicitudes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Total Solicitudes */}
        <div className="glass-card rounded-2xl p-5 border border-lilac-200/80 shadow-soft flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-lilac-100 flex items-center justify-center text-lilac-700 shrink-0">
            <i className="w-6 h-6" data-lucide="folder-check"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Registradas</p>
            <p className="text-2xl font-extrabold text-lilac-950 font-serif mt-0.5">{total}</p>
            <span className="text-[10px] text-slate-400">En el sistema</span>
          </div>
        </div>

        {/* Pendientes */}
        <div className="glass-card rounded-2xl p-5 border border-amber-200/80 shadow-soft flex items-center space-x-4 bg-gradient-to-br from-white to-amber-50/40">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <i className="w-6 h-6" data-lucide="clock"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pendientes</p>
            <p className="text-2xl font-extrabold text-amber-900 font-serif mt-0.5">{pendientes}</p>
            <span className="text-[10px] text-amber-600/80">En revisión RRHH</span>
          </div>
        </div>

        {/* Aprobadas */}
        <div className="glass-card rounded-2xl p-5 border border-emerald-200/80 shadow-soft flex items-center space-x-4 bg-gradient-to-br from-white to-emerald-50/40">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <i className="w-6 h-6" data-lucide="check-circle-2"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Aprobadas</p>
            <p className="text-2xl font-extrabold text-emerald-950 font-serif mt-0.5">{aprobadas}</p>
            <span className="text-[10px] text-emerald-600/80">Listas para gozar</span>
          </div>
        </div>

        {/* Total Días Solicitados */}
        <div className="glass-card rounded-2xl p-5 border border-lilac-200/80 shadow-soft flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-lavender-100 flex items-center justify-center text-lilac-800 shrink-0">
            <i className="w-6 h-6" data-lucide="calendar"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Días Tramitados</p>
            <p className="text-2xl font-extrabold text-lilac-950 font-serif mt-0.5">{totalDias.toFixed(1)}</p>
            <span className="text-[10px] text-slate-400">Días hábiles</span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="glass-card rounded-2xl p-4 border border-lilac-200/80 shadow-soft flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Tabs de Filtro por Estado */}
        <div className="flex flex-wrap items-center gap-1.5 bg-lilac-100/60 p-1 rounded-xl">
          <button
            onClick={() => setFiltroEstado('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filtroEstado === 'todas'
                ? 'bg-white text-lilac-950 shadow-xs'
                : 'text-lilac-700 hover:text-lilac-950'
            }`}
          >
            Todas ({total})
          </button>
          <button
            onClick={() => setFiltroEstado('pendiente')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              filtroEstado === 'pendiente'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-amber-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Pendientes ({pendientes})</span>
          </button>
          <button
            onClick={() => setFiltroEstado('aprobada')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              filtroEstado === 'aprobada'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-emerald-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Aprobadas ({aprobadas})</span>
          </button>
          <button
            onClick={() => setFiltroEstado('rechazada')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              filtroEstado === 'rechazada'
                ? 'bg-white text-rose-800 shadow-xs'
                : 'text-slate-600 hover:text-rose-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Rechazadas ({rechazadas})</span>
          </button>
        </div>

        {/* Filtro por tipo y buscador */}
        <div className="flex items-center space-x-3">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-xl border border-lilac-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-lilac-500"
          >
            <option value="todos">Todos los tipos</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="permiso_con_goce">Permiso con Goce</option>
            <option value="permiso_sin_goce">Permiso sin Goce</option>
            <option value="cambio_modalidad">Cambio Modalidad</option>
          </select>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar motivo o fecha..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-44 sm:w-56 rounded-xl border border-lilac-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lilac-500"
            />
            <i className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" data-lucide="search"></i>
          </div>
        </div>

      </div>

      {/* Tabla / Tarjetas de Solicitudes */}
      <div className="glass-card rounded-3xl border border-lilac-200/80 shadow-soft overflow-hidden">
        
        {solicitudesFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-lilac-50 flex items-center justify-center text-lilac-600 mb-3">
              <i className="w-8 h-8" data-lucide="inbox"></i>
            </div>
            <h3 className="text-base font-bold text-slate-800">No se encontraron solicitudes</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {solicitudes.length === 0
                ? 'Aún no has registrado solicitudes de permisos o vacaciones.'
                : 'No hay solicitudes que coincidan con los filtros seleccionados.'}
            </p>
            <button
              onClick={onNewRequest}
              className="mt-5 px-5 py-2.5 rounded-xl bg-lilac-700 hover:bg-lilac-800 text-white text-xs font-bold transition shadow-sm inline-flex items-center space-x-2"
            >
              <i className="w-4 h-4" data-lucide="plus"></i>
              <span>Crear Primera Solicitud</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-lilac-50/80 text-lilac-950 uppercase tracking-wider font-extrabold border-b border-lilac-200/70">
                <tr>
                  <th className="py-3.5 px-6">Tipo &amp; Trámite</th>
                  <th className="py-3.5 px-4">Periodo Solicitado</th>
                  <th className="py-3.5 px-4 text-center">Días</th>
                  <th className="py-3.5 px-4">Justificación</th>
                  <th className="py-3.5 px-4">Fecha Solicitud</th>
                  <th className="py-3.5 px-6 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-100 bg-white">
                {solicitudesFiltradas.map((sol) => {
                  const info = getTipoInfo(sol.tipo);
                  return (
                    <tr key={sol.id} className="hover:bg-lilac-50/40 transition">
                      
                      {/* Tipo con ícono */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${info.color}`}>
                            <i className="w-4 h-4" data-lucide={info.icon}></i>
                          </div>
                          <div>
                            <p className="font-bold text-lilac-950 text-xs sm:text-sm">{info.label}</p>
                            <span className="text-[10px] text-slate-400 font-mono">ID #{sol.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Periodo de Fechas */}
                      <td className="py-4 px-4 whitespace-nowrap font-medium text-slate-700">
                        <div className="flex items-center space-x-1.5">
                          <i className="w-3.5 h-3.5 text-lilac-600" data-lucide="calendar"></i>
                          <span>{sol.fecha_inicio}</span>
                          <span className="text-slate-400">→</span>
                          <span>{sol.fecha_fin}</span>
                        </div>
                      </td>

                      {/* Días */}
                      <td className="py-4 px-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold bg-lilac-100 text-lilac-800">
                          {sol.dias_solicitados} {sol.dias_solicitados === 1 ? 'día' : 'días'}
                        </span>
                      </td>

                      {/* Motivo */}
                      <td className="py-4 px-4 max-w-xs text-slate-600">
                        <p className="truncate font-normal" title={sol.motivo}>
                          {sol.motivo || 'Sin justificación detallada'}
                        </p>
                      </td>

                      {/* Fecha Solicitud */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {sol.fecha_solicitud || 'Reciente'}
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-6 whitespace-nowrap text-right">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border tracking-wider uppercase ${
                          sol.estado === 'aprobada'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : sol.estado === 'rechazada'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            sol.estado === 'aprobada'
                              ? 'bg-emerald-500'
                              : (sol.estado === 'rechazada' ? 'bg-rose-500' : 'bg-amber-500')
                          }`}></span>
                          {sol.estado}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Banner Informativo y Legal de Costa Rica */}
      <div className="rounded-3xl bg-gradient-to-r from-lilac-900 to-indigo-950 text-white p-6 sm:p-7 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-lilac-200 shrink-0 backdrop-blur-md">
            <i className="w-6 h-6" data-lucide="scale"></i>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Marco Legal Laboral Costarricense (Código de Trabajo)</span>
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-bold">Art. 153</span>
            </h4>
            <p className="text-xs text-lilac-200 mt-1 max-w-2xl leading-relaxed">
              En Costa Rica, todo colaborador tiene derecho a <strong>dos semanas de vacaciones por cada cincuenta semanas</strong> de labores continuas. Las solicitudes deben tramitarse con suficiente anticipación para coordinar la continuidad operativa con tu jefatura.
            </p>
          </div>
        </div>

        <button
          onClick={onNewRequest}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-lilac-50 text-lilac-950 font-bold text-xs shadow-md transition shrink-0 flex items-center justify-center space-x-2"
        >
          <i className="w-4 h-4 text-lilac-700" data-lucide="plus"></i>
          <span>Solicitar Permiso</span>
        </button>
      </div>

    </div>
  );
};

export default SolicitudesPage;
