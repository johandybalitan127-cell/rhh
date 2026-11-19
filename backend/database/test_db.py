"""
Script de Prueba y Verificación de Base de Datos
Valida la conexión, tablas y datos creados en PostgreSQL / pgvector.
"""

import sys
from sqlalchemy import text
from backend.database.connection import engine, SessionLocal, check_database_connection
from backend.database.models import (
    Colaborador, SaldoVacaciones, Solicitud, 
    Incapacidad, MovimientoPersonal, ConsultaChat, ReporteDiario
)

def verificar_base_datos():
    print("=" * 60)
    print("VERIFICACIÓN DE BASE DE DATOS - PORTAL RRHH (COSTA RICA)")
    print("=" * 60)

    # 1. Comprobar conexión activa
    print("1. Probando conexión con el servidor PostgreSQL...")
    if not check_database_connection():
        print("   [FALLO] No se pudo establecer conexión con PostgreSQL.")
        print("   Asegúrate de que PostgreSQL esté iniciado y DATABASE_URL configurada en .env")
        return False
    print("   [OK] Conexión a PostgreSQL establecida con éxito.")

    # 2. Comprobar extensión pgvector
    print("2. Verificando extensión pgvector...")
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';")).fetchone()
            if res:
                print("   [OK] Extensión 'pgvector' activa en la base de datos.")
            else:
                print("   [AVISO] La extensión 'vector' no está instalada o activa aún.")
    except Exception as e:
        print(f"   [AVISO] pgvector check: {e}")

    # 3. Conteo de registros en tablas principales
    print("3. Validando registros en tablas relacionales...")
    db = SessionLocal()
    try:
        total_colab = db.query(Colaborador).count()
        total_saldos = db.query(SaldoVacaciones).count()
        total_solicitudes = db.query(Solicitud).count()
        total_incap = db.query(Incapacidad).count()
        total_mov = db.query(MovimientoPersonal).count()
        total_chat = db.query(ConsultaChat).count()
        total_reportes = db.query(ReporteDiario).count()

        print(f"   - Colaboradores: {total_colab} (Mínimo requerido: 50)")
        print(f"   - Saldos Vacaciones: {total_saldos}")
        print(f"   - Solicitudes: {total_solicitudes}")
        print(f"   - Incapacidades: {total_incap}")
        print(f"   - Movimientos de Personal (3 meses): {total_mov}")
        print(f"   - Historial de Chat: {total_chat}")
        print(f"   - Reportes Diarios Generados: {total_reportes}")

        # Comprobación de roles
        rrhh_count = db.query(Colaborador).filter(Colaborador.rol == "rrhh").count()
        colab_count = db.query(Colaborador).filter(Colaborador.rol == "colaborador").count()
        print(f"   - Usuarios con rol 'rrhh': {rrhh_count}")
        print(f"   - Usuarios con rol 'colaborador': {colab_count}")

        # Comprobación de colaboradores con > 20 días de vacaciones acumuladas
        mas_20_dias = db.query(SaldoVacaciones).filter(SaldoVacaciones.dias_pendientes > 20).count()
        print(f"   - Colaboradores con > 20 días acumulados de vacaciones: {mas_20_dias}")

        if total_colab >= 50 and total_mov > 0 and rrhh_count > 0:
            print("\n[ÉXITO] Todas las tablas y datos simulados cumplen con los requisitos de la Fase 1.")
            return True
        else:
            print("\n[ADVERTENCIA] Faltan registros para cumplir la meta de 50 colaboradores o 3 meses.")
            return False

    except Exception as e:
        print(f"   [ERROR] Error al consultar tablas: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    exito = verificar_base_datos()
    sys.exit(0 if exito else 1)

