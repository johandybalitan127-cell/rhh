/**
 * Evaluador Automatizado del Banco de 45 Preguntas en JavaScript (Node.js)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AgenteOrquestadorJS } from '../backend/agents/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASET_PATH = path.join(__dirname, 'evaluation_dataset.json');
const REPORT_OUTPUT_PATH = path.join(__dirname, 'evaluation_report_js.json');

function ejecutarEvaluacion() {
  console.log("======================================================================");
  console.log("  EVALUACIÓN AUTOMATIZADA EN JAVASCRIPT - BANCO DE 45 PREGUNTAS");
  console.log("  Mini Proyecto #2 - Portal de RRHH con RAG Multiagente (Costa Rica)");
  console.log("======================================================================");

  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const orquestador = new AgenteOrquestadorJS();

  let aciertos = 0;
  const resultados = [];

  console.log(`\nEvaluando ${dataset.length} preguntas contra el sistema multiagente...\n`);

  dataset.forEach((item) => {
    const res = orquestador.procesarMensaje(item.pregunta, 2, `eval-${item.id}`);

    const coincideAgente = (res.agente === item.agente_esperado);
    let tieneCitas = true;
    if (['politicas_rag', 'mixto'].includes(item.agente_esperado)) {
      tieneCitas = res.fuentes && res.fuentes.length > 0;
    }

    const esCorrecto = coincideAgente && tieneCitas;
    if (esCorrecto) aciertos++;

    const estado = esCorrecto ? "CORRECTO" : "FALLIDO";
    console.log(`[${String(item.id).padStart(2, '0')}] ${item.tipo.padEnd(18)} | Agente: ${res.agente.padEnd(22)} | ${estado} | ${item.pregunta.slice(0, 35)}...`);

    resultados.push({
      id: item.id,
      pregunta: item.pregunta,
      tipo: item.tipo,
      agente_esperado: item.agente_esperado,
      agente_obtenido: res.agente,
      fuentes: res.fuentes,
      resultado: estado
    });
  });

  const precision = Math.round((aciertos / dataset.length) * 1000) / 10;

  const informe = {
    fecha: new Date().toISOString(),
    total: dataset.length,
    aciertos,
    errores: dataset.length - aciertos,
    precision_porcentaje: precision,
    cumple_meta_80: precision >= 80.0,
    resultados
  };

  fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(informe, null, 2), 'utf-8');

  console.log("\n======================================================================");
  console.log(`  RESULTADOS FINALES DE LA EVALUACIÓN:`);
  console.log(`  Total Preguntas:      ${dataset.length}`);
  console.log(`  Respuestas Correctas: ${aciertos}`);
  console.log(`  Precisión Alcanzada:  ${precision}%`);
  console.log(`  Meta Requerida:       >= 80.0%`);
  console.log(`  Estado:               ${precision >= 80 ? "🎉 APROBADO EXITOSAMENTE" : "REPROBADO"}`);
  console.log("======================================================================\n");
}

ejecutarEvaluacion();

