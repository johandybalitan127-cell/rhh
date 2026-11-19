import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export const Chatbot = () => {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 0,
      sender: 'bot',
      text: `¡Hola, ${user?.nombre_completo || 'colaborador'}! 👋 Soy tu Asistente Virtual de Recursos Humanos en TecnoCR Soluciones.\n\nPuedes consultarme sobre las políticas oficiales de la empresa (vacaciones, teletrabajo, incapacidades CCSS/INS, feriados de ley en Costa Rica) o consultar directamente tus propios saldos y fechas de pago. ¿En qué te puedo orientar hoy?`,
      agent: 'orquestador',
      sources: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Cargar historial previo
  useEffect(() => {
    if (token) {
      fetch('http://localhost:8000/api/chat/history?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : [])
      .then(history => {
        if (history.length > 0) {
          const formatted = [];
          history.forEach(h => {
            formatted.push({ id: `u-${h.id}`, sender: 'user', text: h.mensaje_usuario });
            formatted.push({
              id: `b-${h.id}`,
              sender: 'bot',
              text: h.respuesta_agente,
              agent: h.agente_resolutor,
              sources: Array.isArray(h.fuentes_citadas) ? h.fuentes_citadas : []
            });
          });
          setMessages(prev => {
            const existingIds = new Set(prev.map(message => message.id));
            return [
              ...prev,
              ...formatted.filter(message => !existingIds.has(message.id))
            ];
          });
        }
      })
      .catch(() => {});
    }
  }, [token]);

  const handleSend = async (textoAEnviar) => {
    const query = (textoAEnviar || input).trim();
    if (!query || loading) return;

    const userMsg = { id: Date.now(), sender: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pregunta: query,
          sesion_id: `sesion-${user?.id || 'web'}`
        })
      });

      if (!res.ok) throw new Error('Error al conectar con el asistente.');

      const data = await res.json();
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.respuesta,
        agent: data.agente,
        sources: data.fuentes || []
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Disculpa, ocurrió un error de comunicación con los agentes de RRHH. Por favor intenta de nuevo.',
          agent: 'orquestador',
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sugerencias = [
    "¿Cuántos días de vacaciones tengo disponibles?",
    "¿Cuál es el procedimiento para reportar una incapacidad de la CCSS?",
    "¿Cuáles son los feriados de pago obligatorio en Costa Rica?",
    "¿Cuánto dura la licencia de paternidad según la Ley 10183?"
  ];

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-title">
          <span className="status-indicator"></span>
          <div>
            <h3>Chatbot de RRHH Multiagente</h3>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>TecnoCR Soluciones · Costa Rica</span>
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
          LangGraph + pgvector
        </span>
      </div>

      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`message-row ${m.sender === 'user' ? 'user' : 'assistant'}`}>
            <div className={`avatar-icon ${m.sender === 'user' ? 'avatar-user' : 'avatar-bot'}`}>
              {m.sender === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              {m.agent && (
                <span className={`agent-badge badge-${m.agent}`}>
                  {m.agent.replace('_', ' ')}
                </span>
              )}
              <div
                className="message-bubble markdown-body"
                dangerouslySetInnerHTML={{
                  __html: typeof window !== 'undefined' && window.marked
                    ? window.marked.parse(m.text || '')
                    : (m.text || '')
                }}
              />

              {/* Citas y Fuentes Oficiales */}
              {m.sources && m.sources.length > 0 && (
                <div className="sources-card">
                  <div className="sources-card-title">
                    <span>📚 Citas y Fuentes Oficiales:</span>
                  </div>
                  {m.sources.map((s, idx) => (
                    <div key={idx} className="source-item">
                      <span>
                        <strong>{s.documento}</strong> — <em>{s.seccion}</em>
                      </span>
                      <a
                        href={s.url_drive}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        Ver en Drive ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-row assistant">
            <div className="avatar-icon avatar-bot">🤖</div>
            <div className="message-content">
              <span className="agent-badge badge-politicas_rag">Consultando agentes...</span>
              <div className="message-bubble loading-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preguntas de sugerencia rápida */}
      <div style={{ padding: '0.5rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
        {sugerencias.map((sug, i) => (
          <button
            key={i}
            onClick={() => handleSend(sug)}
            disabled={loading}
            style={{
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '9999px',
              border: '1px solid #cbd5e1',
              background: 'white',
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            💡 {sug}
          </button>
        ))}
      </div>

      <form className="chat-input-bar" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <input
          type="text"
          className="chat-input"
          placeholder="Escribe tu consulta sobre políticas o tus datos laborales..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-send" disabled={loading || !input.trim()} title="Enviar">
          ➤
        </button>
      </form>
    </div>
  );
};


export default Chatbot;
