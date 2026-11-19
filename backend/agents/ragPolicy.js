/**
 * Agente 2: Políticas de RRHH (RAG Multiagente con DeepSeek AI)
 * Mini Proyecto #2 - Portal de RRHH (Costa Rica)
 * Recupera fragmentos vectoriales y utiliza DeepSeek API (deepseek-chat)
 * para formular respuestas inteligentes, precisas y fundamentadas en las políticas de TecnoCR.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AgenteIngestaSincronizacionJS } from './ingestionSync.js';
import { generarRespuestaDeepSeek } from '../services/deepseek.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INDEX_FILE = path.join(__dirname, '..', 'database', 'chunks_index.json');

export class AgentePoliticasRAGJS {
  constructor() {
    this.ingestaHelper = new AgenteIngestaSincronizacionJS();
    if (!fs.existsSync(INDEX_FILE)) {
      this.ingestaHelper.sincronizar();
    }
  }

  similitudCoseno(v1, v2) {
    let dot = 0;
    for (let i = 0; i < 768; i++) dot += v1[i] * v2[i];
    return dot;
  }

  buscarFragmentos(consulta, topK = 5) {
    if (!fs.existsSync(INDEX_FILE)) {
      this.ingestaHelper.sincronizar();
    }
    const chunks = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    const embConsulta = this.ingestaHelper.generarEmbedding(consulta);

    const conScore = chunks.map(c => ({
      ...c,
      score: this.similitudCoseno(embConsulta, c.embedding)
    }));

    conScore.sort((a, b) => b.score - a.score);
    return conScore.slice(0, topK);
  }

  construirRespuestaLocal(fragmentos, pregunta) {
    const top3 = fragmentos.slice(0, 3);
    const fuentesMap = new Map();
    fragmentos.forEach(f => {
      const key = `${f.documento_titulo}|||${f.seccion}`;
      if (!fuentesMap.has(key)) {
        fuentesMap.set(key, {
          documento: f.documento_titulo,
          seccion: f.seccion,
          url_drive: f.url_drive,
          similitud: Math.round(f.score * 100) / 100
        });
      }
    });

    const citas = Array.from(fuentesMap.values());
    const contextos = top3.map(f => f.contenido.trim()).join('\n\n');
    const fuentesTexto = citas
      .map(c => `- **${c.documento}** — _(${c.seccion})_: [Ver en Google Drive ↗](${c.url_drive})`)
      .join('\n');

    const respuesta = [
      `Según la normativa oficial de **TecnoCR Soluciones S.A.** y la legislación laboral costarricense:\n`,
      contextos,
      `\n\n📚 **Fuentes y Citas Oficiales:**\n${fuentesTexto}`
    ].join('\n');

    return { respuesta, citas };
  }

  async responderConsulta(pregunta) {
    const fragmentos = this.buscarFragmentos(pregunta, 5);

    // Caso A: Sin fragmentos relevantes en la base vectorial
    if (!fragmentos || fragmentos.length === 0 || fragmentos[0].score < 0.05) {
      // Consultar a DeepSeek con conocimiento general de legislación laboral de Costa Rica
      const systemPrompt = `Eres el Asistente Experto en Recursos Humanos de TecnoCR Soluciones en Costa Rica.
Tu misión es orientar al colaborador con profesionalismo, empatía y fundamento en el Código de Trabajo de Costa Rica, la CCSS, el INS y las buenas prácticas corporativas.
Responde de forma clara y estructurada en formato Markdown.
Si la consulta está totalmente fuera del ámbito laboral, indícalo amablemente.`;

      const aiRespuesta = await generarRespuestaDeepSeek({
        systemPrompt,
        userMessage: pregunta,
        temperature: 0.3
      });

      if (aiRespuesta) {
        return {
          respuesta: aiRespuesta,
          fuentes_citadas: [],
          encontrado: true,
          motor: "DeepSeek AI"
        };
      }

      return {
        respuesta: `No encontré información específica en las políticas de **TecnoCR Soluciones**.\n\nPuedo orientarte sobre:\n- 🏖️ Vacaciones anuales y feriados de pago obligatorio (Art. 148-153 Código de Trabajo)\n- 📋 Permisos con goce (duelo, nupcias, graduación) y sin goce de salario\n- 🏥 Procedimiento de incapacidades CCSS y riesgos del trabajo INS\n- 💻 Modalidad de teletrabajo y desconexión digital (Ley N° 9738)\n- 💰 Nómina, fechas de pago y cálculo de aguinaldo legal\n\n¿Deseas reformular tu consulta?`,
        fuentes_citadas: [],
        encontrado: false
      };
    }

    // Deduplicar fuentes
    const fuentesMap = new Map();
    fragmentos.forEach(f => {
      const key = `${f.documento_titulo}|||${f.seccion}`;
      if (!fuentesMap.has(key)) {
        fuentesMap.set(key, {
          documento: f.documento_titulo,
          seccion: f.seccion,
          url_drive: f.url_drive,
          similitud: Math.round(f.score * 100) / 100
        });
      }
    });
    const citas = Array.from(fuentesMap.values());
    const fuentesTexto = citas
      .map(c => `- **${c.documento}** — _(${c.seccion})_: [Ver en Google Drive ↗](${c.url_drive})`)
      .join('\n');

    // Contexto enriquecido de los mejores 3 fragmentos
    const topContextos = fragmentos.slice(0, 3)
      .map(f => `[Documento: ${f.documento_titulo} | Sección: ${f.seccion}]\n${f.contenido}`)
      .join('\n\n---\n\n');

    const systemPrompt = `Eres el Asistente Inteligente de Recursos Humanos de TecnoCR Soluciones S.A. en Costa Rica, potenciado por DeepSeek AI.
Responde a la consulta del colaborador basándote primordialmente en los siguientes fragmentos oficiales de políticas corporativas y normativa laboral costarricense:

=== POLÍTICAS OFICIALES DISPONIBLES ===
${topContextos}
=======================================

Instrucciones:
1. Responde en español con formato Markdown atractivo y profesional (negritas, viñetas, pasos numerados si es un procedimiento).
2. Explica con claridad los derechos, deberes, plazos y requerimientos de ley (Código de Trabajo, CCSS, INS).
3. Sé conciso pero exhaustivo, profesional y cálido.
4. NO agregues sección de fuentes al final, el sistema la añadirá automáticamente.`;

    const respuestaIA = await generarRespuestaDeepSeek({
      systemPrompt,
      userMessage: pregunta,
      temperature: 0.25
    });

    if (respuestaIA) {
      return {
        respuesta: `${respuestaIA}\n\n📚 **Citas y Fuentes Oficiales (Google Drive):**\n${fuentesTexto}`,
        fuentes_citadas: citas,
        encontrado: true,
        motor: "DeepSeek AI"
      };
    }

    // Respaldo local si DeepSeek estuviera indisponible
    const { respuesta, citas: localCitas } = this.construirRespuestaLocal(fragmentos, pregunta);
    return {
      respuesta,
      fuentes_citadas: localCitas,
      encontrado: true,
      motor: "RAG Local"
    };
  }
}

export default AgentePoliticasRAGJS;
