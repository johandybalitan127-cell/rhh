import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export const DashboardPage = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [reporteHoy, setReporteHoy] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Estados de Google Drive
  const [driveStatus, setDriveStatus] = useState({ conectado: false, folder_id: '1UB52cLslWSnk731YZ0a00duzRDC5YPiZ' });
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveMsg, setDriveMsg] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [nuevoDocNombre, setNuevoDocNombre] = useState('');
  const [nuevoDocContenido, setNuevoDocContenido] = useState('');
  const policyFileInput = useRef(null);
  const driveFileInput = useRef(null);

  const cargarDatos = () => {
    if (!token) return;
    setLoading(true);

    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      fetch('http://localhost:8000/api/dashboard/stats', { headers }).then(r => r.ok ? r.json() : null),
      fetch('http://localhost:8000/api/dashboard/reporte-diario/hoy', { headers }).then(r => r.ok ? r.json() : null),
      fetch('http://localhost:8000/api/dashboard/solicitudes-pendientes', { headers }).then(r => r.ok ? r.json() : [])
    ])
    .then(([statsData, reporteData, solicitudesData]) => {
      setStats(statsData);
      setReporteHoy(reporteData);
      setSolicitudes(solicitudesData);
    })
    .finally(() => setLoading(false));
  };

  const handleSubirPolitica = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setDriveLoading(true);
    setDriveMsg(`Indexando ${archivo.name}...`);
    try {
      if (archivo.size > 2 * 1024 * 1024) {
        throw new Error('El archivo supera el límite de 2 MB.');
      }

      const contenido = await archivo.text();
      const res = await fetch('http://localhost:8000/api/dashboard/policies/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre: archivo.name, contenido })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo indexar la política.');

      setDriveMsg(`✓ ${data.mensaje} (${data.fragmentos} fragmentos indexados)`);
    } catch (err) {
      setDriveMsg(`Error: ${err.message}`);
    } finally {
      setDriveLoading(false);
      e.target.value = '';
    }
  };

  const handleSubirArchivoDrive = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setDriveLoading(true);
    setDriveMsg(`Subiendo ${archivo.name} a Google Drive...`);
    try {
      if (archivo.size > 10 * 1024 * 1024) {
        throw new Error('El archivo supera el límite de 10 MB.');
      }

      const bytes = new Uint8Array(await archivo.arrayBuffer());
      let binario = '';
      const tamanoBloque = 0x8000;
      for (let inicio = 0; inicio < bytes.length; inicio += tamanoBloque) {
        binario += String.fromCharCode(...bytes.subarray(inicio, inicio + tamanoBloque));
      }

      const res = await fetch('http://localhost:8000/api/drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: archivo.name,
          contenido_base64: btoa(binario),
          mime_type: archivo.type || 'application/octet-stream'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo subir el archivo a Google Drive.');

      setDriveMsg(`✓ ${data.mensaje}`);
      cargarDrive();
    } catch (err) {
      setDriveMsg(`Error: ${err.message}`);
    } finally {
      setDriveLoading(false);
      e.target.value = '';
    }
  };

  const cargarDrive = () => {
    fetch('http://localhost:8000/api/auth/google/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setDriveStatus(data);
          if (data.conectado) {
            fetch('http://localhost:8000/api/drive/files')
              .then(r => r.ok ? r.json() : null)
              .then(filesData => {
                if (filesData && filesData.archivos) {
                  setDriveFiles(filesData.archivos);
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    cargarDatos();
    cargarDrive();
  }, [token]);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [stats, reporteHoy, solicitudes, driveStatus, driveFiles, showUploadModal]);

  const handleResolverSolicitud = async (id, estado) => {
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/dashboard/solicitudes/${id}/resolver`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado,
          observaciones: `Resuelto por ${user?.nombre_completo || 'RRHH'}.`
        })
      });

      if (res.ok) {
        cargarDatos();
      }
    } catch (err) {
      alert('Error al resolver la solicitud.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerarReporte = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/dashboard/reporte-diario/generar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        cargarDatos();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Subir las 10 políticas locales existentes a la carpeta de Google Drive
  const handleSubirPoliticasLocales = async () => {
    setDriveLoading(true);
    setDriveMsg('Subiendo políticas a tu carpeta de Google Drive...');
    try {
      const res = await fetch('http://localhost:8000/api/drive/upload-politicas-locales', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al subir políticas');
      setDriveMsg(`✓ ${data.mensaje}`);
      cargarDrive();
    } catch (err) {
      setDriveMsg(`Error: ${err.message}`);
    } finally {
      setDriveLoading(false);
    }
  };

  // Sincronizar Drive con el motor RAG
  const handleSincronizarDrive = async () => {
    setDriveLoading(true);
    setDriveMsg('Sincronizando e indexando documentos desde Google Drive...');
    try {
      const res = await fetch('http://localhost:8000/api/drive/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al sincronizar');
      setDriveMsg(`✓ ${data.mensaje}`);
      cargarDrive();
    } catch (err) {
      setDriveMsg(`Error: ${err.message}`);
    } finally {
      setDriveLoading(false);
    }
  };

  // Subir nuevo archivo individual a Google Drive
  const handleCrearDocumento = async (e) => {
    e.preventDefault();
    if (!nuevoDocNombre.trim() || !nuevoDocContenido.trim()) return;

    setDriveLoading(true);
    try {
      const nombreFinal = nuevoDocNombre.endsWith('.md') ? nuevoDocNombre : `${nuevoDocNombre}.md`;
      const res = await fetch('http://localhost:8000/api/drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: nombreFinal,
          contenido: nuevoDocContenido
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al subir archivo');

      setDriveMsg(`✓ Archivo '${nombreFinal}' subido con éxito a tu carpeta de Drive e indexado en el RAG.`);
      setShowUploadModal(false);
      setNuevoDocNombre('');
      setNuevoDocContenido('');
      cargarDrive();
    } catch (err) {
      alert(err.message);
    } finally {
      setDriveLoading(false);
    }
  };

  if (loading) return <div className="card">Cargando Dashboard Ejecutivo de RRHH...</div>;
  if (!stats) return <div className="card">No se pudieron cargar las estadísticas.</div>;

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Encabezado del Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-lilac-200/60">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-lilac-700 mb-1">
            <span>Talento Humano</span>
            <span>/</span>
            <span className="text-slate-500">Métricas &amp; Operaciones</span>
          </div>
          <h1 className="text-2xl font-extrabold text-lilac-950 flex items-center space-x-2.5">
            <i className="w-7 h-7 text-lilac-700" data-lucide="bar-chart-3"></i>
            <span>Dashboard Ejecutivo de Recursos Humanos</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Métricas operativas, pasivos laborales y reportes analíticos para TecnoCR Soluciones S.A.
          </p>
        </div>

        <button
          onClick={handleRegenerarReporte}
          disabled={actionLoading}
          className="px-4 py-2.5 rounded-xl bg-white border border-lilac-200 text-xs font-bold text-lilac-800 hover:bg-lilac-50 transition shadow-xs flex items-center space-x-2"
        >
          <i className="w-4 h-4 text-lilac-600" data-lucide="refresh-cw"></i>
          <span>{actionLoading ? 'Procesando...' : 'Ejecutar Reporte Diario Ahora'}</span>
        </button>
      </div>

      {/* =========================================================================
          PANEL ESPECIAL: GOOGLE DRIVE VINCULADO (CARPETA OFICIAL)
          ========================================================================= */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-lilac-300/80 shadow-card bg-gradient-to-r from-white via-lilac-50/40 to-lavender-50/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-lilac-200/60">
          
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-lilac-700 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <i className="w-6 h-6" data-lucide="hard-drive"></i>
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-base font-extrabold text-lilac-950">Carpeta de Políticas en Google Drive</h3>
                {driveStatus.conectado ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                    Conectado: {driveStatus.google_email}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Pendiente de Autorización
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Las políticas cargadas desde aquí se guardan en el servidor e indexan en el RAG para consultas con DeepSeek.
                {' · '}
                ID Carpeta: <code className="bg-lilac-100 px-1.5 py-0.5 rounded text-lilac-900 font-mono text-[11px]">{driveStatus.folder_id}</code>
                {' · '}
                <a
                  href={`https://drive.google.com/drive/folders/${driveStatus.folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lilac-700 font-bold hover:underline inline-flex items-center space-x-1"
                >
                  <span>Abrir en Google Drive</span>
                  <i className="w-3 h-3" data-lucide="external-link"></i>
                </a>
              </p>
            </div>
          </div>

          {/* Acciones de Google Drive */}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={driveFileInput}
              type="file"
              onChange={handleSubirArchivoDrive}
              className="hidden"
              aria-label="Seleccionar archivo para Google Drive"
            />
            <button
              onClick={() => driveFileInput.current?.click()}
              disabled={driveLoading}
              className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1.5 disabled:opacity-60"
              title="Sube un archivo de hasta 10 MB a la carpeta de Google Drive"
            >
              <i className="w-3.5 h-3.5" data-lucide="file-up"></i>
              <span>Subir archivo a Drive</span>
            </button>

            <input
              ref={policyFileInput}
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              onChange={handleSubirPolitica}
              className="hidden"
              aria-label="Seleccionar archivo de política"
            />
            <button
              onClick={() => policyFileInput.current?.click()}
              disabled={driveLoading}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1.5 disabled:opacity-60"
              title="Indexa una política .md o .txt para que el asistente pueda consultarla"
            >
              <i className="w-3.5 h-3.5" data-lucide="file-up"></i>
              <span>Subir Política al Asistente</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              disabled={driveLoading}
              className="px-4 py-2 rounded-xl bg-lilac-700 hover:bg-lilac-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1.5"
            >
              <i className="w-3.5 h-3.5" data-lucide="upload"></i>
              <span>Subir Documento</span>
            </button>

            <button
              onClick={handleSubirPoliticasLocales}
              disabled={driveLoading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-lilac-100 border border-lilac-300 text-lilac-900 text-xs font-bold transition shadow-xs flex items-center space-x-1.5"
              title="Copia las 10 políticas de TecnoCR directamente a tu carpeta de Drive"
            >
              <i className="w-3.5 h-3.5 text-lilac-700" data-lucide="cloud-upload"></i>
              <span>Poblar con las 10 Políticas</span>
            </button>

            <button
              onClick={handleSincronizarDrive}
              disabled={driveLoading}
              className="p-2 rounded-xl bg-white hover:bg-lilac-100 border border-lilac-300 text-lilac-700 transition"
              title="Sincronizar y actualizar índice RAG"
            >
              <i className="w-4 h-4" data-lucide="refresh-cw"></i>
            </button>
          </div>

        </div>

        {/* Mensaje de feedback */}
        {driveMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-lilac-100/70 border border-lilac-200 text-lilac-900 text-xs font-semibold flex items-center justify-between">
            <span>{driveMsg}</span>
            <button onClick={() => setDriveMsg('')} className="text-lilac-700 hover:text-lilac-950">✕</button>
          </div>
        )}

        {/* Lista de archivos en la carpeta de Drive */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-lilac-950 uppercase tracking-wider">
              Documentos en tu Carpeta ({driveFiles.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Sincronizados en tiempo real con el Asistente IA
            </span>
          </div>

          {driveFiles.length === 0 ? (
            <div className="p-5 rounded-2xl bg-white border border-lilac-200/70 text-center">
              <p className="text-xs text-slate-600 font-medium">
                La carpeta de Google Drive aún no tiene archivos.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Haz clic en <strong>"Poblar con las 10 Políticas"</strong> para subir automáticamente los reglamentos de TecnoCR a tu Drive.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {driveFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3 rounded-2xl bg-white border border-lilac-200/70 shadow-xs flex items-center justify-between hover:border-lilac-400 transition"
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-lilac-100 flex items-center justify-center text-lilac-700 shrink-0">
                      <i className="w-4 h-4" data-lucide="file-text"></i>
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {file.size ? `${Math.round(file.size / 1024)} KB` : 'Doc'}
                      </span>
                    </div>
                  </div>

                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-lilac-600 hover:text-lilac-900 rounded-lg hover:bg-lilac-50"
                    title="Ver en Drive"
                  >
                    <i className="w-3.5 h-3.5" data-lucide="external-link"></i>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grilla de Tarjetas KPI */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Colaboradores Totales</span>
            <span className="kpi-icon">👥</span>
          </div>
          <div className="kpi-value">{stats.total_colaboradores}</div>
          <div className="kpi-subtext">{stats.colaboradores_activos} colaboradores activos</div>
        </div>

        <div className="kpi-card warning">
          <div className="kpi-header">
            <span className="kpi-label">Ausencias Totales</span>
            <span className="kpi-icon">🏖️</span>
          </div>
          <div className="kpi-value">{stats.total_ausencias}</div>
          <div className="kpi-subtext">{stats.incapacidades_activas} incapacidades activas</div>
        </div>

        <div className="kpi-card danger">
          <div className="kpi-header">
            <span className="kpi-label">Solicitudes Pendientes</span>
            <span className="kpi-icon">⏳</span>
          </div>
          <div className="kpi-value">{stats.solicitudes_pendientes}</div>
          <div className="kpi-subtext" style={{ color: stats.solicitudes_pendientes_criticas > 0 ? '#b91c1c' : '#64748b' }}>
            ⚠️ {stats.solicitudes_pendientes_criticas} con más de 3 días de espera
          </div>
        </div>

        <div className="kpi-card danger">
          <div className="kpi-header">
            <span className="kpi-label">Vacaciones Acumuladas</span>
            <span className="kpi-icon">⚠️</span>
          </div>
          <div className="kpi-value">{stats.colaboradores_vacaciones_acumuladas}</div>
          <div className="kpi-subtext">Con más de 20 días pendientes (Pasivo legal)</div>
        </div>

        <div className="kpi-card success">
          <div className="kpi-header">
            <span className="kpi-label">Efectividad Chatbot</span>
            <span className="kpi-icon">🤖</span>
          </div>
          <div className="kpi-value">{stats.tasa_resolucion_chat}%</div>
          <div className="kpi-subtext">Resolución exitosa de consultas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Rotación del Mes</span>
            <span className="kpi-icon">🔄</span>
          </div>
          <div className="kpi-value">+{stats.ingresos_mes} / -{stats.salidas_mes}</div>
          <div className="kpi-subtext">Ingresos vs. Desvinculaciones</div>
        </div>
      </div>

      {/* Resumen Ejecutivo Oficial de las 7:00 a. m. */}
      {reporteHoy && (
        <div className="executive-summary-card">
          <div className="summary-badge-bar">
            <span style={{ fontSize: '1.2rem' }}>📑</span>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--color-primary)' }}>
              Informe Analítico Diario (Corte: {reporteHoy.fecha_reporte} a las {reporteHoy.hora_generacion})
            </h3>
            <span style={{
              marginLeft: 'auto',
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              Agente Analista (SQL + LLM)
            </span>
          </div>
          <div className="summary-content">
            {reporteHoy.resumen_ejecutivo}
          </div>
        </div>
      )}

      {/* Grilla de Paneles: Gráficos de CSS Puro y Solicitudes */}
      <div className="panels-grid">
        {/* Panel Izquierdo: Gestión de Solicitudes Pendientes */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            📥 Solicitudes Pendientes de Aprobación
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Revisa y autoriza las solicitudes tramitadas por el equipo.
          </p>

          {solicitudes.length === 0 ? (
            <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 600 }}>
              ✅ No hay solicitudes pendientes de aprobación en este momento.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Tipo</th>
                    <th>Días</th>
                    <th>Fechas</th>
                    <th>Espera</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.colaborador_nombre}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.departamento}</div>
                      </td>
                      <td>{s.tipo.replace('_', ' ').toUpperCase()}</td>
                      <td>{s.dias_solicitados}</td>
                      <td>{s.fecha_inicio} al {s.fecha_fin}</td>
                      <td>
                        {s.es_critica ? (
                          <span className="tag-critical">⚠️ {s.dias_espera}d (Crítica)</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.dias_espera}d</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-action-group">
                          <button
                            className="btn-icon btn-approve"
                            disabled={actionLoading}
                            onClick={() => handleResolverSolicitud(s.id, 'aprobada')}
                          >
                            ✓ Aprobar
                          </button>
                          <button
                            className="btn-icon btn-reject"
                            disabled={actionLoading}
                            onClick={() => handleResolverSolicitud(s.id, 'rechazada')}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel Derecho: Gráficos Estadísticos con CSS Puro */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            📈 Distribución por Departamento
          </h3>
          <div className="chart-container">
            {Object.entries(stats.distribucion_departamentos).map(([depto, count]) => {
              const maxCount = Math.max(...Object.values(stats.distribucion_departamentos));
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={depto} className="chart-bar-row">
                  <div className="chart-bar-labels">
                    <span>{depto}</span>
                    <span>{count} colaboradores</span>
                  </div>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginTop: '2rem', marginBottom: '0.5rem' }}>
            💻 Modalidad de Teletrabajo (Ley 9738)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', marginTop: '1rem' }}>
            {Object.entries(stats.distribucion_modalidad).map(([mod, cnt]) => (
              <div key={mod} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>{mod}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>{cnt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal para Subir Documento a Google Drive */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-card border border-lilac-200">
            <div className="flex items-center justify-between pb-3 border-b border-lilac-100 mb-4">
              <h3 className="text-base font-extrabold text-lilac-950 flex items-center space-x-2">
                <i className="w-5 h-5 text-lilac-700" data-lucide="cloud-upload"></i>
                <span>Subir Política a Google Drive</span>
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCrearDocumento} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nombre del Documento
                </label>
                <input
                  type="text"
                  placeholder="ej. Politica_Vestimenta_2026.md"
                  value={nuevoDocNombre}
                  onChange={(e) => setNuevoDocNombre(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-lilac-200 text-xs focus:ring-2 focus:ring-lilac-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Contenido del Documento (Markdown / Texto)
                </label>
                <textarea
                  rows="8"
                  placeholder="# Título de la Política&#10;&#10;Escribe aquí los lineamientos que el Asistente IA debe indexar..."
                  value={nuevoDocContenido}
                  onChange={(e) => setNuevoDocContenido(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-lilac-200 text-xs focus:ring-2 focus:ring-lilac-500 font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-lilac-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={driveLoading}
                  className="px-5 py-2 rounded-xl bg-lilac-700 hover:bg-lilac-800 text-white text-xs font-bold shadow-sm"
                >
                  {driveLoading ? 'Subiendo...' : 'Subir e Indexar en RAG'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardPage;
