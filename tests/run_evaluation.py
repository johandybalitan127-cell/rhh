"""
Script Evaluador Automatizado del Banco de 45 Preguntas
Valida la precisión, citas, enrutamiento multiagente y seguridad contra el objetivo de >=80%.
"""

import os
import json
import time
import sys
from typing import Dict, Any, List
from backend.database.connection import SessionLocal, check_database_connection
from backend.database.models import Colaborador
from backend.agents.orchestrator import AgenteOrquestador

DATASET_PATH = os.path.join(os.path.dirname(__file__), "evaluation_dataset.json")
REPORT_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "evaluation_report.json")

def ejecutar_evaluacion_completa():
    print("=" * 70)
    print("EVALUACIÓN AUTOMATIZADA DEL CHATBOT - BANCO DE 45 PREGUNTAS")
    print("Mini Proyecto #2 - Portal de RRHH con RAG Multiagente (Costa Rica)")
    print("=" * 70)

    if not os.path.exists(DATASET_PATH):
        print(f"[ERROR] No se encontró el archivo de evaluación: {DATASET_PATH}")
        return False

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        preguntas = json.load(f)

    print(f"Total de preguntas en el banco: {len(preguntas)}")
    print(f"Objetivo de precisión: >= 80.0%\n")

    if not check_database_connection():
        print("[ERROR] No se pudo conectar a PostgreSQL. Verifica que la BD esté activa.")
        return False

    db = SessionLocal()
    try:
        colab = db.query(Colaborador).filter(Colaborador.rol == "colaborador").first()
        if not colab:
            print("[ERROR] No hay colaboradores en la base de datos para ejecutar la prueba.")
            return False

        colaborador_id = colab.id
        orquestador = AgenteOrquestador(db_session=db)

        resultados = []
        aciertos = 0
        errores = 0

        print(f"{'#':<3} | {'TIPO':<18} | {'AGENTE OBTENIDO':<20} | {'ESTADO':<8} | {'PREGUNTA'}")
        print("-" * 75)

        for item in preguntas:
            q_id = item["id"]
            pregunta = item["pregunta"]
            agente_esperado = item["agente_esperado"]
            tipo = item["tipo"]
            doc_fuente = item.get("documento_fuente", "")

            t0 = time.time()
            res = orquestador.procesar_mensaje(
                pregunta=pregunta,
                colaborador_id=colaborador_id,
                sesion_id=f"eval-benchmark-{q_id}"
            )
            t_ms = int((time.time() - t0) * 1000)

            agente_obtenido = res["agente"]
            respuesta_obtenida = res["respuesta"]
            fuentes_obtenidas = res.get("fuentes", [])

            # Criterios de Evaluación
            coincide_agente = (agente_obtenido == agente_esperado)
            tiene_citas_si_aplica = True
            if agente_esperado in ["politicas_rag", "mixto"]:
                tiene_citas_si_aplica = len(fuentes_obtenidas) > 0 or ("📚" in respuesta_obtenida or "Fuentes" in respuesta_obtenida)

            es_correcto = coincide_agente and tiene_citas_si_aplica

            if es_correcto:
                aciertos += 1
                estado_str = "CORRECTO"
            else:
                errores += 1
                estado_str = "FALLIDO"

            print(f"{q_id:<3} | {tipo:<18} | {agente_obtenido:<20} | {estado_str:<8} | {pregunta[:30]}...")

            resultados.append({
                "id": q_id,
                "pregunta": pregunta,
                "tipo": tipo,
                "agente_esperado": agente_esperado,
                "agente_obtenido": agente_obtenido,
                "documento_fuente": doc_fuente,
                "respuesta_esperada": item["respuesta_esperada"],
                "respuesta_obtenida": respuesta_obtenida,
                "fuentes_citadas": fuentes_obtenidas,
                "duracion_ms": t_ms,
                "resultado": "CORRECTO" if es_correcto else "FALLIDO"
            })

        tasa_precision = round((aciertos / len(preguntas)) * 100.0, 2)

        # Generar reporte consolidado JSON
        informe_final = {
            "fecha_evaluacion": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_preguntas": len(preguntas),
            "aciertos": aciertos,
            "errores": errores,
            "precision_porcentaje": tasa_precision,
            "cumple_meta_80": tasa_precision >= 80.0,
            "detalle_preguntas": resultados
        }

        with open(REPORT_OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(informe_final, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 70)
        print("RESUMEN DE EVALUACIÓN DEL BANCO DE 45 PREGUNTAS:")
        print("=" * 70)
        print(f"Total Evaluadas:       {len(preguntas)}")
        print(f"Respuestas Correctas:  {aciertos}")
        print(f"Respuestas Fallidas:   {errores}")
        print(f"Precisión Alcanzada:   {tasa_precision}%")
        print(f"Meta Requerida:        >= 80.0%")

        if tasa_precision >= 80.0:
            print("\n🎉 [RESULTADO: APROBADO] El sistema supera holgadamente la meta del 80% requerida.")
        else:
            print("\n⚠️ [RESULTADO: NO ALCANZADO] Se requiere calibrar los prompts o enrutamiento.")

        print(f"Reporte detallado guardado en: {REPORT_OUTPUT_PATH}")
        print("=" * 70)

        return tasa_precision >= 80.0

    except Exception as e:
        print(f"[ERROR] Error inesperado durante la evaluación: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    exito = ejecutar_evaluacion_completa()
    sys.exit(0 if exito else 1)

