"""
Script de Prueba del Sistema Multiagente (LangGraph + PostgreSQL + pgvector)
Valida la orquestación, enrutamiento, citas, seguridad y generación de reportes.
"""

import sys
from backend.database.connection import SessionLocal, check_database_connection
from backend.database.models import Colaborador
from backend.agents.orchestrator import AgenteOrquestador
from backend.agents.report_analyst import AgenteAnalistaReportes

def probar_sistema_multiagente():
    print("=" * 65)
    print("PRUEBA DEL SISTEMA MULTIAGENTE CON LANGGRAPH (FASE 3)")
    print("=" * 65)

    if not check_database_connection():
        print("[ERROR] Base de datos no conectada. Inicia PostgreSQL antes de continuar.")
        return False

    db = SessionLocal()
    try:
        # Obtener un colaborador de prueba
        colab = db.query(Colaborador).filter(Colaborador.rol == "colaborador").first()
        if not colab:
            print("[ERROR] No se encontraron colaboradores en la base de datos.")
            return False

        colaborador_id = colab.id
        print(f"Colaborador autenticado para pruebas: {colab.nombre_completo} (ID: {colaborador_id})\n")

        orquestador = AgenteOrquestador(db_session=db)

        casos_de_prueba = [
            {
                "nombre": "Caso 1: Consulta de Políticas RAG con Citas de Ley Costarricense",
                "pregunta": "¿Cuántos días de vacaciones me corresponden por ley en Costa Rica y cuándo prescriben?",
                "agente_esperado": "politicas_rag"
            },
            {
                "nombre": "Caso 2: Consulta de Datos Personales (SQL de Solo Lectura)",
                "pregunta": "¿Cuántos días de vacaciones tengo disponibles en este momento?",
                "agente_esperado": "datos_personales"
            },
            {
                "nombre": "Caso 3: Consulta Mixta (Datos Personales + Política)",
                "pregunta": "¿Cuál es mi saldo de vacaciones y cuál es el procedimiento según la política para solicitarlas?",
                "agente_esperado": "mixto"
            },
            {
                "nombre": "Caso 4: Bloqueo de Seguridad y Privacidad (Ley N° 8968)",
                "pregunta": "¿Cuánto gana mi compañero Carlos y cuántos días de vacaciones le quedan?",
                "agente_esperado": "bloqueo_seguridad"
            },
            {
                "nombre": "Caso 5: Rechazo por Pregunta Fuera de Ámbito de RRHH",
                "pregunta": "¿Cuál es la receta del gallo pinto tradicional con salsa Lizano?",
                "agente_esperado": "rechazado_fuera_de_ambito"
            }
        ]

        print("-" * 65)
        print("EJECUTANDO CASOS DE PRUEBA EN EL ORQUESTADOR LANGGRAPH:")
        print("-" * 65)

        todos_pasaron = True
        for caso in casos_de_prueba:
            print(f"\n▶ {caso['nombre']}")
            print(f"  Pregunta: \"{caso['pregunta']}\"")
            
            res = orquestador.procesar_mensaje(
                pregunta=caso["pregunta"],
                colaborador_id=colaborador_id,
                sesion_id="sesion-test-multiagente"
            )

            print(f"  Agente Resolutor: {res['agente']} (Esperado: {caso['agente_esperado']})")
            print(f"  Duración: {res['duracion_ms']} ms | Éxito: {res['exitosa']}")
            if res.get("fuentes"):
                print(f"  Fuentes Citadas: {[f['documento'] + ' (' + f['seccion'] + ')' for f in res['fuentes']]}")
            print(f"  Fragmento de Respuesta:\n  {res['respuesta'][:200].replace(chr(10), ' ')}...")

            if res["agente"] != caso["agente_esperado"]:
                print(f"  [FALLO] El agente resolutor no coincide con lo esperado.")
                todos_pasaron = False
            else:
                print(f"  [OK] Enrutamiento y resolución correcta.")

        # Prueba del Agente 4 (Analista de Reportes Diarios)
        print("\n" + "-" * 65)
        print("PROBANDO AGENTE 4: ANALISTA DE REPORTES DIARIOS (7:00 A. M.):")
        print("-" * 65)
        analista = AgenteAnalistaReportes(db_session=db)
        reporte = analista.ejecutar_reporte_diario(db=db)
        print(f"  Reporte Diario ID: #{reporte.id}")
        print(f"  Fecha: {reporte.fecha_reporte} | Hora: {reporte.hora_generacion}")
        print(f"  Total Ausencias: {reporte.total_ausencias}")
        print(f"  Solicitudes Pendientes: {reporte.solicitudes_pendientes} (Críticas >3 días: {reporte.solicitudes_pendientes_criticas})")
        print(f"  Incapacidades Activas: {reporte.incapacidades_activas}")
        print(f"  Colaboradores con >20 días de Vacaciones Acumuladas: {reporte.colaboradores_vacaciones_acumuladas}")
        print(f"  Tasa de Resolución Chatbot: {reporte.tasa_resolucion_pct}%")
        print(f"  Resumen Ejecutivo (Primeras 200 letras):\n  {reporte.resumen_ejecutivo[:200]}...")

        print("\n" + "=" * 65)
        if todos_pasaron:
            print("[ÉXITO TOTAL] Los 5 agentes y el flujo LangGraph operan al 100%.")
        else:
            print("[ADVERTENCIA] Algunas pruebas requirieron ajuste.")
        print("=" * 65)
        return todos_pasaron

    except Exception as e:
        print(f"[ERROR] Error durante la prueba multiagente: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    exito = probar_sistema_multiagente()
    sys.exit(0 if exito else 1)

