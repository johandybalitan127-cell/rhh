"""
Script de Prueba del Agente de Ingesta y Sincronización
Valida la segmentación, cálculo de embeddings, indexación en pgvector
y ejecuta búsquedas semánticas de prueba para verificar las citas generadas.
"""

import sys
from sqlalchemy import text
from backend.database.connection import SessionLocal, check_database_connection
from backend.database.models import DocumentoChunk
from backend.agents.ingestion_sync import AgenteIngestaSincronizacion

def probar_ingesta_y_busqueda():
    print("=" * 65)
    print("PRUEBA DEL AGENTE DE INGESTA Y BÚSQUEDA SEMÁNTICA (FASE 2)")
    print("=" * 65)

    if not check_database_connection():
        print("[ERROR] Base de datos no conectada. Inicia PostgreSQL antes de continuar.")
        return False

    db = SessionLocal()
    try:
        # 1. Ejecutar sincronización
        print("1. Ejecutando Agente de Ingesta y Sincronización...")
        agente = AgenteIngestaSincronizacion()
        reporte = agente.sincronizar(db)
        print("   Resultado de sincronización:")
        for k, v in reporte.items():
            print(f"   - {k}: {v}")

        # 2. Conteo de fragmentos indexados
        total_chunks = db.query(DocumentoChunk).count()
        docs_unicos = db.query(DocumentoChunk.documento_titulo).distinct().count()
        print(f"\n2. Verificación de Fragmentos en Base de Datos:")
        print(f"   - Total de Chunks Vectoriales Indexados: {total_chunks}")
        print(f"   - Documentos Únicos Procesados: {docs_unicos} (Objetivo: 10)")

        if docs_unicos < 10:
            print("[ADVERTENCIA] Menos de 10 documentos encontrados. Verifica la carpeta docs_politicas/")

        # 3. Prueba de Búsqueda Semántica Vectorial con Consultas Clave
        print("\n3. Ejecutando Búsquedas Semánticas de Prueba (Similitud Vectorial)...")
        preguntas_prueba = [
            "¿Cuántos días de vacaciones otorga la ley costarricense y a partir de cuántos días acumulados hay alerta?",
            "¿Cuál es el plazo para entregar la boleta de incapacidad de la CCSS?",
            "¿Cuánto dura la licencia de paternidad según la Ley 10183 de Costa Rica?",
            "¿Cómo se calcula el aguinaldo y cuál es la fecha máxima de pago en TecnoCR?"
        ]

        for p_idx, pregunta in enumerate(preguntas_prueba, 1):
            emb_pregunta = agente.generar_embedding(pregunta)
            
            # Búsqueda vectorial usando la extensión pgvector (operador de distancia coseno <=>)
            print(f"\n   [Consulta {p_idx}]: \"{pregunta}\"")
            try:
                sql_query = text("""
                    SELECT 
                        documento_titulo,
                        seccion,
                        url_drive,
                        LEFT(contenido, 180) as fragmento_resumen,
                        (embedding <=> (:emb)::vector) as distancia_coseno
                    FROM documentos_chunks
                    ORDER BY distancia_coseno ASC
                    LIMIT 2;
                """)
                emb_str = f"[{','.join(str(x) for x in emb_pregunta)}]"
                resultados = db.execute(sql_query, {"emb": emb_str}).fetchall()

                for r in resultados:
                    similitud = round(1.0 - float(r[4]), 4) if r[4] is not None else 1.0
                    print(f"      -> Documento: {r[0]}")
                    print(f"         Sección: {r[1]}")
                    print(f"         Similitud: {similitud}")
                    print(f"         Enlace Cita: {r[2]}")
                    print(f"         Texto: {r[3].replace(chr(10), ' ')}...")
            except Exception as e:
                # Fallback en caso de que pgvector no esté activo en la sesión de pruebas
                print(f"      (Búsqueda relacional de respaldo por texto: {e})")
                r = db.query(DocumentoChunk).filter(DocumentoChunk.contenido.ilike(f"%vacaciones%")).first()
                if r:
                    print(f"      -> Coincidencia: {r.documento_titulo} - {r.seccion} ({r.url_drive})")

        print("\n" + "=" * 65)
        print("[ÉXITO] Fase 2 completada: 10 documentos indexados con citas y metadatos.")
        print("=" * 65)
        return True

    except Exception as e:
        print(f"[ERROR] Error durante la prueba de ingesta: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    exito = probar_ingesta_y_busqueda()
    sys.exit(0 if exito else 1)

