"""
Rutas del Dashboard Ejecutivo de RRHH (/api/dashboard)
Protegido EXCLUSIVAMENTE para roles 'rrhh' y 'administrador'.
Provee métricas globales, gráficos, gestión de solicitudes y reportes automáticos.
"""

from typing import List, Optional, Dict, Any
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database.connection import get_db
from backend.database.models import (
    Colaborador, SaldoVacaciones, Solicitud, 
    Incapacidad, MovimientoPersonal, ConsultaChat, ReporteDiario
)
from backend.services.auth_service import requerir_roles, obtener_colaborador_actual
from backend.agents.report_analyst import AgenteAnalistaReportes

router = APIRouter(
    prefix="/api/dashboard", 
    tags=["Dashboard de RRHH"],
    dependencies=[Depends(requerir_roles(["rrhh", "administrador"]))]
)

class DashboardStatsResponse(BaseModel):
    total_colaboradores: int
    colaboradores_activos: int
    total_ausencias: int
    solicitudes_pendientes: int
    solicitudes_pendientes_criticas: int
    incapacidades_activas: int
    colaboradores_vacaciones_acumuladas: int
    ingresos_mes: int
    salidas_mes: int
    tasa_resolucion_chat: float
    distribucion_departamentos: Dict[str, int]
    distribucion_modalidad: Dict[str, int]

class ResolucionSolicitudRequest(BaseModel):
    estado: str # "aprobada" o "rechazada"
    observaciones: Optional[str] = "Revisado por RRHH."

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Retorna métricas consolidadas en tiempo real para las tarjetas de KPI del Dashboard.
    """
    hoy = datetime.date.today()
    primer_dia_mes = datetime.date(hoy.year, hoy.month, 1)
    hace_tres_dias = datetime.datetime.now() - datetime.timedelta(days=3)

    total_colab = db.query(Colaborador).count()
    activos = db.query(Colaborador).filter(Colaborador.estado == "activo").count()
    ausencias = db.query(Colaborador).filter(Colaborador.estado.in_(["incapacitado", "vacaciones"])).count()

    solic_pendientes = db.query(Solicitud).filter(Solicitud.estado == "pendiente").count()
    solic_criticas = db.query(Solicitud).filter(
        Solicitud.estado == "pendiente",
        Solicitud.fecha_solicitud <= hace_tres_dias
    ).count()

    incap_activas = db.query(Incapacidad).filter(Incapacidad.estado == "activa").count()
    mas_20_vac = db.query(SaldoVacaciones).filter(SaldoVacaciones.dias_pendientes > 20).count()

    ingresos_mes = db.query(MovimientoPersonal).filter(
        MovimientoPersonal.tipo_movimiento == "ingreso",
        MovimientoPersonal.fecha_movimiento >= primer_dia_mes
    ).count()

    salidas_mes = db.query(MovimientoPersonal).filter(
        MovimientoPersonal.tipo_movimiento.in_([
            "salida_renuncia", 
            "salida_despido_con_responsabilidad", 
            "salida_despido_sin_responsabilidad"
        ]),
        MovimientoPersonal.fecha_movimiento >= primer_dia_mes
    ).count()

    # Chatbot
    total_chat = db.query(ConsultaChat).count()
    chat_exito = db.query(ConsultaChat).filter(ConsultaChat.resolucion_exitosa == True).count()
    tasa_chat = round((chat_exito / total_chat * 100.0) if total_chat > 0 else 100.0, 2)

    # Departamentos
    depto_counts = db.query(Colaborador.departamento, func.count(Colaborador.id)).group_by(Colaborador.departamento).all()
    dist_deptos = {d[0]: d[1] for d in depto_counts}

    # Modalidades
    mod_counts = db.query(Colaborador.modalidad, func.count(Colaborador.id)).group_by(Colaborador.modalidad).all()
    dist_modalidad = {m[0]: m[1] for m in mod_counts}

    return {
        "total_colaboradores": total_colab,
        "colaboradores_activos": activos,
        "total_ausencias": ausencias,
        "solicitudes_pendientes": solic_pendientes,
        "solicitudes_pendientes_criticas": solic_criticas,
        "incapacidades_activas": incap_activas,
        "colaboradores_vacaciones_acumuladas": mas_20_vac,
        "ingresos_mes": ingresos_mes,
        "salidas_mes": salidas_mes,
        "tasa_resolucion_chat": tasa_chat,
        "distribucion_departamentos": dist_deptos,
        "distribucion_modalidad": dist_modalidad
    }

@router.get("/reporte-diario/hoy")
def get_reporte_diario_hoy(db: Session = Depends(get_db)):
    """
    Obtiene el reporte oficial generado por el Agente Analista para el día actual.
    """
    hoy = datetime.date.today()
    reporte = db.query(ReporteDiario).filter(ReporteDiario.fecha_reporte == hoy).first()
    
    # Si aún no existe el de hoy, generarlo automáticamente con el Agente 4
    if not reporte:
        analista = AgenteAnalistaReportes(db_session=db)
        reporte = analista.ejecutar_reporte_diario(fecha=hoy, db=db)

    return {
        "id": reporte.id,
        "fecha_reporte": reporte.fecha_reporte.strftime("%d/%m/%Y"),
        "hora_generacion": reporte.hora_generacion,
        "total_ausencias": reporte.total_ausencias,
        "solicitudes_pendientes": reporte.solicitudes_pendientes,
        "solicitudes_pendientes_criticas": reporte.solicitudes_pendientes_criticas,
        "incapacidades_activas": reporte.incapacidades_activas,
        "ingresos_mes": reporte.ingresos_mes,
        "salidas_mes": reporte.salidas_mes,
        "colaboradores_vacaciones_acumuladas": reporte.colaboradores_vacaciones_acumuladas,
        "total_consultas_chat": reporte.total_consultas_chat,
        "tasa_resolucion_pct": float(reporte.tasa_resolucion_pct),
        "top_temas_consultados": reporte.top_temas_consultados or [],
        "preguntas_sin_respuesta": reporte.preguntas_sin_respuesta or [],
        "resumen_ejecutivo": reporte.resumen_ejecutivo,
        "datos_analiticos_sql": reporte.datos_analiticos_sql or {}
    }

@router.post("/reporte-diario/generar")
def forzar_generacion_reporte(db: Session = Depends(get_db)):
    """
    Ejecuta manualmente el Agente Analista de Reportes bajo demanda.
    """
    analista = AgenteAnalistaReportes(db_session=db)
    reporte = analista.ejecutar_reporte_diario(db=db)
    return {
        "mensaje": "Reporte diario regenerado con éxito.",
        "id": reporte.id,
        "fecha": reporte.fecha_reporte.strftime("%d/%m/%Y"),
        "resumen_ejecutivo": reporte.resumen_ejecutivo
    }

@router.get("/reportes-historial")
def get_historial_reportes(db: Session = Depends(get_db), limit: int = 15):
    """
    Retorna el historial de reportes diarios ejecutados.
    """
    reportes = db.query(ReporteDiario).order_by(ReporteDiario.fecha_reporte.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "fecha": r.fecha_reporte.strftime("%d/%m/%Y"),
            "hora": r.hora_generacion,
            "ausencias": r.total_ausencias,
            "solicitudes_pendientes": r.solicitudes_pendientes,
            "vacaciones_acumuladas": r.colaboradores_vacaciones_acumuladas,
            "resumen_corto": r.resumen_ejecutivo[:180] + "..."
        }
        for r in reportes
    ]

@router.get("/solicitudes-pendientes")
def get_todas_solicitudes_pendientes(db: Session = Depends(get_db)):
    """
    Lista todas las solicitudes que requieren resolución por parte de RRHH.
    """
    solicitudes = db.query(Solicitud).filter(Solicitud.estado == "pendiente").order_by(Solicitud.fecha_solicitud.asc()).all()
    resultado = []
    hoy = datetime.datetime.now()

    for s in solicitudes:
        colab = db.query(Colaborador).filter(Colaborador.id == s.colaborador_id).first()
        dias_espera = (hoy - s.fecha_solicitud).days if s.fecha_solicitud else 0
        resultado.append({
            "id": s.id,
            "colaborador_nombre": colab.nombre_completo if colab else "Desconocido",
            "departamento": colab.departamento if colab else "",
            "tipo": s.tipo,
            "fecha_inicio": s.fecha_inicio.strftime("%d/%m/%Y"),
            "fecha_fin": s.fecha_fin.strftime("%d/%m/%Y"),
            "dias_solicitados": float(s.dias_solicitados),
            "motivo": s.motivo,
            "fecha_solicitud": s.fecha_solicitud.strftime("%d/%m/%Y %H:%M") if s.fecha_solicitud else "",
            "dias_espera": dias_espera,
            "es_critica": dias_espera >= 3
        })
    return resultado

@router.put("/solicitudes/{solicitud_id}/resolver")
def resolver_solicitud(
    solicitud_id: int,
    req: ResolucionSolicitudRequest,
    admin: Colaborador = Depends(obtener_colaborador_actual),
    db: Session = Depends(get_db)
):
    """
    Aprueba o rechaza una solicitud y actualiza los saldos si corresponde.
    """
    solicitud = db.query(Solicitud).filter(Solicitud.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    if req.estado not in ["aprobada", "rechazada"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El estado debe ser 'aprobada' o 'rechazada'.")

    solicitud.estado = req.estado
    solicitud.revisado_por = admin.id
    solicitud.fecha_resolucion = datetime.datetime.now()
    solicitud.observaciones_aprobador = req.observaciones

    # Si se aprueban vacaciones, descontar del saldo disponible
    if req.estado == "aprobada" and solicitud.tipo == "vacaciones":
        saldo = db.query(SaldoVacaciones).filter(SaldoVacaciones.colaborador_id == solicitud.colaborador_id).first()
        if saldo:
            saldo.dias_disfrutados += solicitud.dias_solicitados
            saldo.dias_pendientes = max(0, saldo.dias_pendientes - solicitud.dias_solicitados)

    db.commit()
    return {"mensaje": f"Solicitud #{solicitud_id} actualizada a '{req.estado}' exitosamente."}

