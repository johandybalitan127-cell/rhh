import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const VacationCard = ({ onOpenModal }) => {
  const { token } = useAuth();
  const [vacaciones, setVacaciones] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('http://localhost:8000/api/colaborador/vacaciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setVacaciones(data);
      })
      .finally(() => setLoading(false));
    }
  }, [token]);

  if (loading) return <div className="card">Cargando balance de vacaciones...</div>;
  if (!vacaciones) return null;

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }}>🏖️ Balance de Vacaciones</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Periodo Anual: {vacaciones.periodo_anual}</span>
        </div>
        <button className="btn btn-primary" onClick={onOpenModal}>
          + Nueva Solicitud
        </button>
      </div>

      <div className="vacation-card-grid">
        <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e40af' }}>DISPONIBLES</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e3a8a' }}>{vacaciones.dias_pendientes.toFixed(1)}</div>
          <div style={{ fontSize: '0.7rem', color: '#60a5fa' }}>Días hábiles</div>
        </div>

        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>GANADOS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#334155' }}>{vacaciones.dias_ganados.toFixed(1)}</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Días de ley (Art. 153)</div>
        </div>

        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>DISFRUTADOS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#334155' }}>{vacaciones.dias_disfrutados.toFixed(1)}</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Días gozados</div>
        </div>
      </div>

      {vacaciones.alerta_acumulacion && (
        <div style={{
          marginTop: '1rem',
          padding: '0.85rem',
          background: '#fffbeb',
          borderLeft: '4px solid #f59e0b',
          borderRadius: '6px',
          fontSize: '0.825rem',
          color: '#92400e'
        }}>
          ⚠️ <strong>Alerta de Acumulación:</strong> Cuentas con más de 20 días pendientes de vacaciones. De conformidad con las políticas de TecnoCR y el Código de Trabajo de Costa Rica, coordina con tu jefatura su programación para evitar pasivos laborales.
        </div>
      )}
    </div>
  );
};
