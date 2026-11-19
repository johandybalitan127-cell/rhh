import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const SolicitudesModal = ({ isOpen, onClose, onCreated }) => {
  const { token } = useAuth();
  const [tipo, setTipo] = useState('vacaciones');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [dias, setDias] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  // Auto-calcular días entre fechas al seleccionarlas
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      if (fin >= inicio) {
        // Cálculo de días hábiles aproximados (lunes a viernes)
        let diasHabiles = 0;
        let cur = new Date(inicio);
        while (cur <= fin) {
          const diaSemana = cur.getDay();
          if (diaSemana !== 0 && diaSemana !== 6) { // 0 = Dom, 6 = Sáb
            diasHabiles++;
          }
          cur.setDate(cur.getDate() + 1);
        }
        setDias(diasHabiles > 0 ? diasHabiles : 1);
        setError('');
      } else {
        setError('La fecha de fin no puede ser anterior a la de inicio.');
      }
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    if (isOpen && window.lucide) {
      window.lucide.createIcons();
    }
  }, [isOpen, tipo, error, exito]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fechaInicio || !fechaFin) {
      setError('Por favor indica las fechas de inicio y fin.');
      return;
    }

    if (new Date(fechaFin) < new Date(fechaInicio)) {
      setError('La fecha de finalización debe ser posterior o igual a la de inicio.');
      return;
    }

    if (dias <= 0) {
      setError('La cantidad de días debe ser mayor a 0.');
      return;
    }

    if (!motivo.trim()) {
      setError('Por favor describe el motivo o justificación de la solicitud.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/colaborador/solicitudes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tipo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          dias_solicitados: parseFloat(dias),
          motivo: motivo.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al procesar la solicitud.');
      }

      setExito(true);
      setTimeout(() => {
        setExito(false);
        setFechaInicio('');
        setFechaFin('');
        setDias(1);
        setMotivo('');
        onCreated && onCreated();
        onClose();
      }, 900);
    } catch (err) {
      setError(err.message || 'Error de comunicación con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-card border border-lilac-200/90 p-6 sm:p-8 overflow-hidden animate-fadeIn">
        
        {/* Glow de fondo decorativo */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-lilac-300/30 rounded-full blur-3xl pointer-events-none"></div>

        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-lilac-100 mb-5 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-lilac-700 to-lavender-500 flex items-center justify-center text-white shadow-sm">
              <i className="w-5 h-5" data-lucide="calendar-plus"></i>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-lilac-950">Nueva Solicitud Laboral</h3>
              <p className="text-xs text-slate-500">TecnoCR Soluciones · Costa Rica</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-lilac-50 hover:bg-lilac-100 text-lilac-700 flex items-center justify-center transition"
            aria-label="Cerrar"
          >
            <i className="w-4 h-4" data-lucide="x"></i>
          </button>
        </div>

        {/* Notificaciones de error o éxito */}
        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-center space-x-2">
            <i className="w-4 h-4 text-rose-600 shrink-0" data-lucide="alert-circle"></i>
            <span>{error}</span>
          </div>
        )}

        {exito && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center space-x-2">
            <i className="w-4 h-4 text-emerald-600 shrink-0" data-lucide="check-circle-2"></i>
            <span>¡Solicitud registrada con éxito! Actualizando...</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          
          {/* Tipo de Solicitud */}
          <div>
            <label className="block text-xs font-bold text-lilac-950 uppercase tracking-wider mb-1.5">
              Tipo de Permiso o Trámite
            </label>
            <div className="relative">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-2xl border border-lilac-200 bg-lilac-50/40 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500 transition"
              >
                <option value="vacaciones">🏖️ Vacaciones Anuales (Art. 153 Código de Trabajo)</option>
                <option value="permiso_con_goce">💼 Permiso con Goce de Salario (Duelo / Nupcias / Graduación)</option>
                <option value="permiso_sin_goce">⏳ Permiso sin Goce de Salario (Asuntos personales)</option>
                <option value="cambio_modalidad">💻 Cambio Temporal de Modalidad (Teletrabajo / Presencial)</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 pl-1">
              {tipo === 'vacaciones' && 'Se debitará del saldo legal acumulado de tu periodo vigente.'}
              {tipo === 'permiso_con_goce' && 'Requiere justificación válida conforme a la política interna.'}
              {tipo === 'permiso_sin_goce' && 'Sujeto a aprobación previa de tu jefatura inmediata y RRHH.'}
              {tipo === 'cambio_modalidad' && 'Para trabajar presencial o remoto por un periodo determinado.'}
            </p>
          </div>

          {/* Rango de Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-lilac-950 uppercase tracking-wider mb-1.5">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-2xl border border-lilac-200 bg-lilac-50/40 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-lilac-950 uppercase tracking-wider mb-1.5">
                Fecha de Finalización
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-2xl border border-lilac-200 bg-lilac-50/40 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500 transition"
                required
              />
            </div>
          </div>

          {/* Días Solicitados */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-lilac-950 uppercase tracking-wider">
                Días Hábiles Solicitados
              </label>
              <span className="text-[11px] text-lilac-600 font-semibold">
                (Excluye sábados y domingos)
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="30"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                className="w-full rounded-2xl border border-lilac-200 bg-lilac-50/40 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-lilac-950 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500 transition"
                required
              />
            </div>
          </div>

          {/* Justificación / Motivo */}
          <div>
            <label className="block text-xs font-bold text-lilac-950 uppercase tracking-wider mb-1.5">
              Motivo o Justificación
            </label>
            <textarea
              rows="3"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Indica el motivo de la solicitud o detalle para la jefatura..."
              className="w-full rounded-2xl border border-lilac-200 bg-lilac-50/40 px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:border-lilac-500 transition"
              required
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-lilac-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || exito}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-lilac-700 to-lilac-600 hover:from-lilac-800 hover:to-lilac-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition active:scale-95 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <i className="w-4 h-4" data-lucide="send"></i>
                  <span>Enviar Solicitud</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default SolicitudesModal;
