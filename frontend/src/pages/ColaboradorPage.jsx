import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { VacationCard } from '../components/VacationCard';
import { Chatbot } from '../components/Chatbot';
import { SolicitudesModal } from '../components/SolicitudesModal';

export const ColaboradorPage = () => {
  const { user, token } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const cargarSolicitudes = () => {
    if (token) {
      fetch('http://localhost:8000/api/colaborador/solicitudes', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : [])
      .then(data => setSolicitudes(data))
      .catch(() => {});
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [token, refreshKey]);

  return (
    <div className="portal-grid">
      {/* Columna Izquierda: Información Personal y Solicitudes */}
      <div>
        {/* Ficha de Bienvenida */}
        <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #0b2545 0%, #134074 100%)', color: 'white' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>¡Hola, {user?.nombre_completo}! 👋</h2>
          <p style={{ opacity: 0.85, fontSize: '0.85rem' }}>
            {user?.puesto} · Departamento de {user?.departamento}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', fontSize: '0.75rem', opacity: 0.9 }}>
            <span>🆔 {user?.cedula}</span>
            <span>📍 Modalidad: {user?.modalidad}</span>
          </div>
        </div>

        {/* Balance de Vacaciones */}
        <VacationCard key={refreshKey} onOpenModal={() => setModalOpen(true)} />

        {/* Lista de Solicitudes Recientes */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--color-primary)' }}>📋 Mis Solicitudes Recientes</h3>
            <button
              onClick={() => setModalOpen(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              + Nueva
            </button>
          </div>

          {solicitudes.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No tienes solicitudes registradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {solicitudes.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {s.tipo.replace('_', ' ').toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {s.dias_solicitados} días ({s.fecha_inicio} al {s.fecha_fin})
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: s.estado === 'pendiente' ? '#fef3c7' : (s.estado === 'aprobada' ? '#dcfce7' : '#fee2e2'),
                        color: s.estado === 'pendiente' ? '#b45309' : (s.estado === 'aprobada' ? '#15803d' : '#b91c1c')
                      }}
                    >
                      {s.estado.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Chatbot Inteligente con Citas */}
      <div>
        <Chatbot />
      </div>

      <SolicitudesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  );
};
