/**
 * Agente 1: Orquestador - Clasificador de Intenciones (Async + DeepSeek)
 * Maneja saludos, consultas mixtas, datos personales, políticas RAG y fuera de ámbito.
 */

import { AgentePoliticasRAGJS } from './ragPolicy.js';
import { AgenteDatosColaboradorJS } from './employeeData.js';
import { generarRespuestaDeepSeek } from '../services/deepseek.js';
import { obtenerBD, guardarBD } from '../database/store.js';

export class AgenteOrquestadorJS {
  constructor() {
    this.ragAgent = new AgentePoliticasRAGJS();
    this.employeeAgent = new AgenteDatosColaboradorJS();
  }

  clasificarIntencion(pregunta) {
    const p = pregunta.toLowerCase().trim();

    // 1. Saludos y conversación casual
    const patronesSaludo = [
      /^hola\b/i, /^buenos? d[ií]as?\b/i, /^buenas? tardes?\b/i, /^buenas? noches?\b/i,
      /^hi\b/i, /^hey\b/i, /^qu[eé] tal\b/i, /^c[oó]mo est[aá]s?\b/i,
      /^gracias\b/i, /^muchas gracias\b/i, /^ok\b/i, /^bien\b/i,
      /^ayuda\b/i, /^help\b/i, /^qu[eé] puedes hacer/i, /^qu[eé] sabes hacer/i,
      /^para qu[eé] sirves/i, /^quién eres\b/i, /^quien eres\b/i,
      /^c[oó]mo te llamas\b/i
    ];
    if (patronesSaludo.some(pat => pat.test(p))) {
      return 'saludo';
    }

    // 2. Bloqueo de Seguridad y Privacidad (Ley N° 8968)
    const patronesTerceros = [
      /cu[aá]nto gana\s+(?!yo|el|la)\w+/i,
      /salario de\s+(?!la empresa)\w+/i,
      /sueldo de\s+\w+/i,
      /vacaciones de\s+(?!ley)\w+/i,
      /incapacidad de\s+(?!la ccss|l ins)\w+/i,
      /compañer[oa]/i,
      /mi jefe gana/i,
      /select \* from/i,
      /drop table/i
    ];
    for (const pat of patronesTerceros) {
      if (pat.test(p)) {
        if (!p.includes('mi salario') && !p.includes('mis vacaciones') && !p.includes('mi puesto') && !p.includes('ccss') && !p.includes('ins')) {
          return 'bloqueo_seguridad';
        }
      }
    }

    // 3. Fuera de Ámbito
    const fueraAmbito = ['receta', 'gallo pinto', 'fútbol', 'futbol', 'saprissa', 'alajuela', 'champions', 'película', 'pelicula', 'clima', 'chiste', 'bitcoin', 'cripto', 'noticias', 'deporte'];
    if (fueraAmbito.some(w => p.includes(w))) {
      return 'fuera_de_ambito';
    }

    // 4. Consulta Mixta (personal + política)
    const keywordsPersonal = ['mis vacaciones', 'me quedan', 'mi saldo', 'saldo tengo', 'mis solicitudes', 'mi fecha de pago', 'próxima fecha de pago', 'proxima fecha de pago'];
    const keywordsPolítica = ['política', 'politica', 'reglamento', 'código de trabajo', 'codigo de trabajo', 'procedimiento', 'ley', 'cuándo corresponde', 'feriados'];
    const tienePersonal = keywordsPersonal.some(w => p.includes(w));
    const tienePolitica = keywordsPolítica.some(w => p.includes(w));
    if (tienePersonal && tienePolitica) return 'mixto';

    // 5. Datos Personales propios
    const keywordsPersonalSolo = [
      'mis vacaciones', 'tengo disponibles', 'días me quedan', 'dias me quedan',
      'mi saldo', 'saldo tengo', 'mis solicitudes', 'estado de mi', 'mi incapacidad',
      'tengo incapacidades', 'a mi nombre', 'mi puesto', 'mi salario', 'cuándo me pagan',
      'cuando me pagan', 'mi próxima fecha de pago', 'mi proxima fecha de pago',
      'cuántos días tengo', 'cuantos dias tengo', 'mis días', 'mis dias',
      'mi balance', 'mi expediente', 'mi perfil', 'mi contrato', 'mi aguinaldo'
    ];
    if (keywordsPersonalSolo.some(w => p.includes(w))) return 'datos_personales';

    // 6. Por defecto → Políticas RAG con DeepSeek
    return 'politicas_rag';
  }

  responderSaludo(pregunta, colaboradorId) {
    const db = obtenerBD();
    const colab = db.colaboradores.find(c => c.id === colaboradorId);
    const nombre = colab?.nombre_completo?.split(' ')[0] || 'Colaborador';
    const p = pregunta.toLowerCase().trim();

    if (/^gracias/.test(p) || /^muchas gracias/.test(p)) {
      return `¡Con mucho gusto, **${nombre}**! 😊 Si tienes alguna otra consulta sobre tus beneficios, vacaciones, políticas laborales o cualquier trámite de RRHH, aquí estoy para ayudarte.`;
    }

    if (/qu[eé] puedes hacer|qu[eé] sabes hacer|para qu[eé] sirves|ayuda|help/.test(p)) {
      return `¡Hola **${nombre}**! Soy el **Asistente Inteligente de RRHH de TecnoCR Soluciones** 🤖✨ — Potenciado por **DeepSeek AI**\n\nPuedo ayudarte con:\n\n- 🏖️ **Vacaciones:** Consultar tu saldo, días disponibles, ganados y disfrutados.\n- 📋 **Solicitudes:** Ver el estado de tus permisos y crear nuevas solicitudes.\n- 💰 **Nómina:** Fechas de pago, aguinaldo y deducciones de Ley.\n- 📖 **Políticas Corporativas:** Reglamentos internos, teletrabajo, incapacidades CCSS/INS, feriados de ley (Costa Rica).\n- ⚖️ **Código de Trabajo:** Consultas sobre legislación laboral costarricense.\n\n¿En qué te puedo orientar hoy?`;
    }

    if (/quién eres|quien eres|c[oó]mo te llamas/.test(p)) {
      return `Soy el **Asistente Virtual de RRHH** de **TecnoCR Soluciones S.A.** 🌟\n\nFui desarrollado con tecnología de agentes inteligentes (**LangGraph + RAG + DeepSeek AI**) para ayudar a los colaboradores de Costa Rica a resolver sus consultas laborales de forma rápida, precisa y en cumplimiento con la legislación vigente.\n\n¿En qué te puedo ayudar hoy, **${nombre}**?`;
    }

    // Saludo general con hora
    const hora = new Date().getHours();
    const saludo = hora < 12 ? '¡Buenos días' : hora < 18 ? '¡Buenas tardes' : '¡Buenas noches';
    return `${saludo}, **${nombre}**! 👋\n\nSoy tu asistente de Recursos Humanos en **TecnoCR Soluciones**, impulsado por **DeepSeek AI**. Estoy aquí para ayudarte con consultas sobre:\n\n🏖️ Vacaciones y saldos legales\n📋 Solicitudes de permisos\n💰 Fechas de pago y nómina\n📖 Políticas corporativas y legislación laboral de Costa Rica\n\n¿En qué te puedo orientar hoy?`;
  }

  async procesarMensaje(pregunta, colaboradorId, sesionId = "sesion-default") {
    const t0 = Date.now();
    const intencion = this.clasificarIntencion(pregunta);

    let salida = {
      agente: intencion,
      respuesta: "",
      fuentes: [],
      exitosa: true,
      motor: "orquestador"
    };

    if (intencion === 'saludo') {
      salida.agente = 'orquestador';
      salida.respuesta = this.responderSaludo(pregunta, colaboradorId);
      salida.exitosa = true;

    } else if (intencion === 'bloqueo_seguridad') {
      salida.agente = 'orquestador';
      salida.respuesta = "🔒 **Protección de Datos Personales (Ley N° 8968):**\n\nPor razones de seguridad y en cumplimiento de la **Ley de Protección de Datos Personales de Costa Rica**, no es posible consultar información privada de otros colaboradores.\n\nEl sistema únicamente puede brindarte información relacionada con **tu propio expediente laboral**.";
      salida.exitosa = false;

    } else if (intencion === 'fuera_de_ambito') {
      // Usar DeepSeek para dar una respuesta amable de redireccionamiento
      const aiResp = await generarRespuestaDeepSeek({
        systemPrompt: "Eres el asistente de RRHH de TecnoCR Soluciones en Costa Rica. El usuario preguntó algo fuera del ámbito laboral. Redirige amablemente, en 2 oraciones máximo, hacia temas de RRHH.",
        userMessage: pregunta,
        maxTokens: 120
      });
      salida.agente = 'orquestador';
      salida.respuesta = aiResp || "ℹ️ Soy un asistente especializado en **Recursos Humanos de TecnoCR Soluciones S.A.** en Costa Rica. ¿Hay algo laboral en que te pueda ayudar? 😊";
      salida.exitosa = false;

    } else if (intencion === 'datos_personales') {
      const res = this.employeeAgent.procesarConsulta(pregunta, colaboradorId);
      salida.respuesta = res.respuesta;
      salida.exitosa = res.exito;
      salida.agente = 'datos_personales';

    } else if (intencion === 'mixto') {
      const resPersonal = this.employeeAgent.procesarConsulta(pregunta, colaboradorId);
      const resRag = await this.ragAgent.responderConsulta(pregunta);
      salida.respuesta = `### 👤 Tu Información Personal:\n${resPersonal.respuesta}\n\n---\n\n### 📖 Política Corporativa Aplicable:\n${resRag.respuesta}`;
      salida.fuentes = resRag.fuentes_citadas;
      salida.exitosa = resPersonal.exito && resRag.encontrado;
      salida.motor = resRag.motor || "DeepSeek AI";
      salida.agente = 'mixto';

    } else {
      // politicas_rag → DeepSeek AI
      const resRag = await this.ragAgent.responderConsulta(pregunta);
      salida.respuesta = resRag.respuesta;
      salida.fuentes = resRag.fuentes_citadas;
      salida.exitosa = resRag.encontrado;
      salida.motor = resRag.motor || "DeepSeek AI";
      salida.agente = 'politicas_rag';
    }

    const duracionMs = Date.now() - t0;
    salida.duracion_ms = duracionMs;

    // Registrar en BD
    try {
      const db = obtenerBD();
      db.consultas_chat.push({
        id: db.consultas_chat.length + 1,
        colaborador_id: colaboradorId,
        sesion_id: sesionId,
        mensaje_usuario: pregunta,
        respuesta_agente: salida.respuesta,
        agente_resolutor: salida.agente,
        resolucion_exitosa: salida.exitosa,
        fuentes_citadas: salida.fuentes,
        duracion_ms: duracionMs,
        fecha_consulta: new Date().toISOString()
      });
      guardarBD(db);
    } catch (e) {
      // Ignorar error de log
    }

    return salida;
  }
}
