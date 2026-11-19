"""
Script de Prueba y Verificación de la API REST (FastAPI)
Valida la autenticación JWT, protección por roles, endpoints de colaborador,
chatbot y dashboard de RRHH.
"""

import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.connection import check_database_connection

client = TestClient(app)

def probar_api():
    print("=" * 65)
    print("PRUEBA INTEGRAL DE LA API REST (FASTAPI) - FASE 4")
    print("=" * 65)

    if not check_database_connection():
        print("[ERROR] Base de datos no conectada. Inicia PostgreSQL antes de continuar.")
        return False

    # 1. Comprobar Health Check
    print("1. Probando endpoint GET /api/health...")
    res = client.get("/api/health")
    if res.status_code != 200:
        print(f"   [FALLO] Health check devolvió status {res.status_code}: {res.text}")
        return False
    data = res.json()
    print(f"   [OK] Estado del sistema: {data['status']} | Empresa: {data['empresa']}")

    # 2. Login como Colaborador Estándar
    print("\n2. Probando inicio de sesión de Colaborador (cjimenez@tecnocr.com)...")
    login_colab = client.post("/api/auth/login", json={
        "email": "cjimenez@tecnocr.com",
        "password": "Password123!"
    })
    if login_colab.status_code != 200:
        print(f"   [FALLO] Login falló con status {login_colab.status_code}: {login_colab.text}")
        return False
    data_colab = login_colab.json()
    token_colab = data_colab["access_token"]
    headers_colab = {"Authorization": f"Bearer {token_colab}"}
    print(f"   [OK] Token JWT generado exitosamente. Usuario: {data_colab['user']['nombre_completo']} (Rol: {data_colab['user']['rol']})")

    # 3. Consulta de Perfil y Vacaciones de Colaborador
    print("\n3. Probando consulta de vacaciones GET /api/colaborador/vacaciones...")
    res_vac = client.get("/api/colaborador/vacaciones", headers=headers_colab)
    if res_vac.status_code != 200:
        print(f"   [FALLO] No se pudo obtener vacaciones: {res_vac.text}")
        return False
    vac = res_vac.json()
    print(f"   [OK] Vacaciones obtenidas: {vac['dias_pendientes']} días pendientes en periodo {vac['periodo_anual']}.")

    # 4. Prueba del Chatbot mediante API
    print("\n4. Probando envío de mensaje al Chatbot POST /api/chat/message...")
    res_chat = client.post("/api/chat/message", headers=headers_colab, json={
        "pregunta": "¿Cuántos días de vacaciones tengo y cuál es el procedimiento para solicitarlas?",
        "sesion_id": "sesion-test-api"
    })
    if res_chat.status_code != 200:
        print(f"   [FALLO] Error en endpoint de chat: {res_chat.text}")
        return False
    chat_data = res_chat.json()
    print(f"   [OK] Chatbot respondió mediante agente '{chat_data['agente']}' en {chat_data['duracion_ms']} ms.")
    print(f"   Respuesta: {chat_data['respuesta'][:140]}...")

    # 5. Verificación de Seguridad: Colaborador intentando acceder al Dashboard
    print("\n5. Verificando protección de rutas: Colaborador intentando acceder a /api/dashboard/stats...")
    res_forbidden = client.get("/api/dashboard/stats", headers=headers_colab)
    if res_forbidden.status_code == 403:
        print("   [OK] Acceso denegado correctamente con HTTP 403 Forbidden. Seguridad por roles verificada.")
    else:
        print(f"   [FALLO] Se esperaba 403 Forbidden pero se obtuvo {res_forbidden.status_code}.")
        return False

    # 6. Login como Administrador / RRHH
    print("\n6. Probando inicio de sesión de RRHH (mchaves@tecnocr.com)...")
    login_rrhh = client.post("/api/auth/login", json={
        "email": "mchaves@tecnocr.com",
        "password": "Password123!"
    })
    if login_rrhh.status_code != 200:
        print(f"   [FALLO] Login RRHH falló: {login_rrhh.text}")
        return False
    data_rrhh = login_rrhh.json()
    token_rrhh = data_rrhh["access_token"]
    headers_rrhh = {"Authorization": f"Bearer {token_rrhh}"}
    print(f"   [OK] Token RRHH generado. Usuario: {data_rrhh['user']['nombre_completo']} (Rol: {data_rrhh['user']['rol']})")

    # 7. Acceso exitoso al Dashboard de RRHH
    print("\n7. Consultando estadísticas del Dashboard GET /api/dashboard/stats con rol 'rrhh'...")
    res_dash = client.get("/api/dashboard/stats", headers=headers_rrhh)
    if res_dash.status_code != 200:
        print(f"   [FALLO] Dashboard stats falló con status {res_dash.status_code}: {res_dash.text}")
        return False
    stats = res_dash.json()
    print(f"   [OK] KPIs cargados con éxito:")
    print(f"        - Total Colaboradores: {stats['total_colaboradores']}")
    print(f"        - Ausencias Actuales: {stats['total_ausencias']}")
    print(f"        - Solicitudes Pendientes: {stats['solicitudes_pendientes']} (Críticas: {stats['solicitudes_pendientes_criticas']})")
    print(f"        - Colaboradores con >20 días de vacaciones: {stats['colaboradores_vacaciones_acumuladas']}")

    # 8. Reporte Diario de Hoy
    print("\n8. Consultando reporte diario oficial GET /api/dashboard/reporte-diario/hoy...")
    res_rep = client.get("/api/dashboard/reporte-diario/hoy", headers=headers_rrhh)
    if res_rep.status_code != 200:
        print(f"   [FALLO] No se pudo obtener el reporte diario: {res_rep.text}")
        return False
    rep = res_rep.json()
    print(f"   [OK] Reporte oficial del día ({rep['fecha_reporte']}) cargado con éxito.")
    print(f"        Resumen Ejecutivo: {rep['resumen_ejecutivo'][:150]}...")

    print("\n" + "=" * 65)
    print("[ÉXITO TOTAL] Todos los endpoints de la API REST están 100% operativos.")
    print("=" * 65)
    return True

if __name__ == "__main__":
    exito = probar_api()
    sys.exit(0 if exito else 1)
