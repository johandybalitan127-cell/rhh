import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [error, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handlePreFill = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-12 bg-[#F8F7FC] antialiased">
      
      {/* =========================================================================
          COLUMNA IZQUIERDA: HERO CORPORATIVO DESKTOP (7 COLUMNAS)
          ========================================================================= */}
      <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-lilac-950 via-lilac-900 to-indigo-950 text-white relative overflow-hidden">
        
        {/* Glows y Luces de Fondo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-lilac-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-lavender-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Top: Logo y Marca */}
        <div className="relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-lilac-500 via-lilac-400 to-lavender-300 p-[2px] shadow-lg flex items-center justify-center">
              <div className="w-full h-full bg-lilac-950 rounded-[14px] flex items-center justify-center">
                <i className="w-6 h-6 text-lilac-300" data-lucide="sparkles"></i>
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-2xl tracking-tight text-white font-serif">TecnoCR</span>
                <span className="text-sm font-bold text-lilac-300 tracking-widest uppercase">Soluciones</span>
              </div>
              <p className="text-xs text-lilac-200/80 font-medium tracking-wide">
                Portal de Recursos Humanos &amp; Asistente IA · Costa Rica
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Contenido Principal y Value Props */}
        <div className="relative z-10 my-auto py-10 space-y-8 max-w-xl">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-lilac-200 border border-white/15 backdrop-blur-md mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
              Plataforma Web Empresarial · Versión 2026
            </div>
            
            <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Gestión Inteligente de Talento y Normativas Laborales
            </h1>
            
            <p className="mt-3 text-sm text-lilac-100/90 leading-relaxed font-normal">
              Autoservicio para colaboradores costarricenses: consulta tus saldos de vacaciones de ley, solicita permisos en línea y resuelve consultas laborales con nuestro sistema multiagente RAG.
            </p>
          </div>

          {/* 3 Tarjetas de Beneficios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            
            <div className="p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md hover:bg-white/15 transition">
              <div className="w-9 h-9 rounded-xl bg-lilac-500/30 flex items-center justify-center text-lilac-200 mb-2.5">
                <i className="w-5 h-5" data-lucide="palmtree"></i>
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vacaciones</h4>
              <p className="text-[11px] text-lilac-200 mt-1 leading-snug">
                Art. 153 Código de Trabajo. Saldos actualizados en tiempo real.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md hover:bg-white/15 transition">
              <div className="w-9 h-9 rounded-xl bg-lilac-500/30 flex items-center justify-center text-lilac-200 mb-2.5">
                <i className="w-5 h-5" data-lucide="bot"></i>
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Asistente IA</h4>
              <p className="text-[11px] text-lilac-200 mt-1 leading-snug">
                LangGraph + RAG con políticas CCSS, INS y reglamentos internos.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md hover:bg-white/15 transition">
              <div className="w-9 h-9 rounded-xl bg-lilac-500/30 flex items-center justify-center text-lilac-200 mb-2.5">
                <i className="w-5 h-5" data-lucide="file-check-2"></i>
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Solicitudes</h4>
              <p className="text-[11px] text-lilac-200 mt-1 leading-snug">
                Flujo 100% digital de aprobación para jefaturas y RRHH.
              </p>
            </div>

          </div>

          {/* Sello de Seguridad */}
          <div className="flex items-center space-x-3 text-xs text-lilac-200/70 pt-2 border-t border-white/10">
            <i className="w-4 h-4 text-emerald-400" data-lucide="shield-check"></i>
            <span>En cumplimiento estricto con la <strong>Ley de Protección de Datos Personales N° 8968</strong> de Costa Rica.</span>
          </div>
        </div>

        {/* Bottom: Información de sede */}
        <div className="relative z-10 flex items-center justify-between text-xs text-lilac-200/60 pt-4 border-t border-white/10">
          <div className="flex items-center space-x-2">
            <i className="w-4 h-4" data-lucide="map-pin"></i>
            <span>San José, Costa Rica · Cédula Jurídica: 3-101-789456</span>
          </div>
          <span>© 2026 TecnoCR Soluciones S.A.</span>
        </div>

      </div>

      {/* =========================================================================
          COLUMNA DERECHA: FORMULARIO DE ACCESO PROFESIONAL (5 COLUMNAS)
          ========================================================================= */}
      <div className="lg:col-span-5 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 min-h-screen">
        
        {/* Logo Móvil (sólo visible en pantallas pequeñas) */}
        <div className="lg:hidden flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-lilac-700 to-lavender-400 flex items-center justify-center text-white shadow-sm">
            <i className="w-5 h-5" data-lucide="sparkles"></i>
          </div>
          <div>
            <span className="font-extrabold text-xl text-lilac-950 font-serif">TecnoCR</span>
            <span className="text-xs font-bold text-lilac-600 uppercase ml-1.5">Soluciones</span>
          </div>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-card border border-lilac-200/80 p-8 sm:p-10 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-lilac-700 via-lilac-500 to-lavender-400"></div>

          {/* Encabezado */}
          <div className="mb-6">
            <div className="w-10 h-10 rounded-2xl bg-lilac-100 flex items-center justify-center text-lilac-700 mb-3 shadow-xs">
              <i className="w-5 h-5" data-lucide="lock"></i>
            </div>
            <h2 className="text-2xl font-extrabold text-lilac-950 tracking-tight">Iniciar Sesión</h2>
            <p className="text-xs text-slate-500 mt-1">
              Ingresa tus credenciales corporativas para acceder al portal.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-center space-x-2.5 animate-fadeIn">
              <i className="w-4 h-4 text-rose-600 shrink-0" data-lucide="alert-circle"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo Correo */}
            <div>
              <label className="block text-xs font-bold text-lilac-950 uppercase tracking-wider mb-1.5">
                Correo Electrónico Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <i className="w-4 h-4" data-lucide="mail"></i>
                </div>
                <input
                  type="email"
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-lilac-200 bg-lilac-50/30 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500 transition"
                  placeholder="ejemplo@tecnocr.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-lilac-950 uppercase tracking-wider">
                  Contraseña
                </label>
                <span className="text-[11px] text-lilac-600 hover:text-lilac-800 cursor-pointer font-semibold">
                  ¿Olvidaste tu clave?
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <i className="w-4 h-4" data-lucide="key-round"></i>
                </div>
                <input
                  type="password"
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-lilac-200 bg-lilac-50/30 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500 transition"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Botón de Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-lilac-700 via-lilac-600 to-lavender-600 hover:from-lilac-800 hover:to-lilac-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition active:scale-[0.99] flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Portal</span>
                  <i className="w-4 h-4" data-lucide="arrow-right"></i>
                </>
              )}
            </button>

          </form>

          {/* Accesos Rápidos de Prueba */}
          <div className="mt-6 pt-5 border-t border-lilac-100">
            <p className="text-[11px] font-bold text-lilac-900 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <i className="w-3.5 h-3.5 text-lilac-600" data-lucide="user-check"></i>
              <span>Cuentas de Prueba Preconfiguradas:</span>
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handlePreFill('cjimenez@tecnocr.com')}
                className="w-full px-3 py-2 rounded-xl bg-lilac-50 hover:bg-lilac-100/80 text-left border border-lilac-200/70 transition flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">
                    👤
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Carlos Jiménez</span>
                    <span className="text-[10px] text-slate-500">cjimenez@tecnocr.com · Colaborador</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-lilac-700 bg-white px-2 py-0.5 rounded-md border border-lilac-200">
                  Rellenar
                </span>
              </button>

              <button
                type="button"
                onClick={() => handlePreFill('mchaves@tecnocr.com')}
                className="w-full px-3 py-2 rounded-xl bg-lilac-50 hover:bg-lilac-100/80 text-left border border-lilac-200/70 transition flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-[11px] font-bold">
                    👑
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Marianela Chaves</span>
                    <span className="text-[10px] text-slate-500">mchaves@tecnocr.com · Gerente RRHH</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-lilac-700 bg-white px-2 py-0.5 rounded-md border border-lilac-200">
                  Rellenar
                </span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Contraseña predeterminada: <code className="bg-lilac-100 text-lilac-900 px-1.5 py-0.5 rounded font-mono font-semibold">Password123!</code>
            </p>
          </div>

        </div>

        {/* Footer pequeño en la columna derecha */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          TecnoCR Soluciones S.A. · Portal Seguro SSL 256-bit
        </p>

      </div>

    </div>
  );
};

export default LoginPage;
