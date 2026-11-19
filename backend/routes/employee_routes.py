"""
Rutas del Portal del Colaborador (/api/colaborador)
Maneja la consulta de perfil, saldos de vacaciones, creación y seguimiento de solicitudes.
"""

from typing import List, Optional
import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import Colaborador, SaldoVacaciones, Solicitud, Incapacidad
from backend.services.auth_service import obtener_colaborador_actual

router = APIRouter(prefix="/api/colaborador", tags=["Portal del Colaborador"])

class PerfilResponse(BaseModel):
    id: int
    cedula: str
    nombre_completo: str
    email: str
    puesto: str
    departamento: str
    fecha_ingreso: str
    salario_bruto: float
    rol: str
    estado: str
    modalidad: str
    telefono: Optional[str] = None

class SaldoVacacionesResponse(BaseModel):
    periodo_anual: str
    dias_ganados: float
    dias_disfrutados: float
    dias_pendientes: float
    dias_acumulados_anteriores: float
    alerta_acumulacion: bool

class SolicitudCreateRequest(BaseModel):
    tipo: str = Field(..., description="vacaciones, permiso_con_goce, permiso_sin_goce, cambio_modalidad")
    fecha_inicio: datetime.date
    fecha_fin: datetime.date
    dias_solicitados: float
    motivo: str

class SolicitudResponse(BaseModel):
    id: int
    tipo: str
    fecha_inicio: str
    fecha_fin: str
    dias_solicitados: float
    motivo: str
    estado: str
    fecha_solicitud: str
    observaciones_aprobador: Optional[str] = None

class IncapacidadResponse(BaseModel):
    id: int
    entidad_emisora: str
    codigo_boleta: str
    fecha_inicio: str
    fecha_fin: str
    dias_totales: int
    diagnostico: str
    subsidio_porcentaje: float
    estado: str

@router.get("/perfil", response_model=PerfilResponse)
def get_perfil(colaborador: Colaborador = Depends(obtener_colaborador_actual)):
    return {
        "id": colaborador.id,
        "cedula": colaborador.cedula,
        "nombre_completo": colaborador.nombre_completo,
        "email": colaborador.email,
        "puesto": colaborador.puesto,
        "departamento": colaborador.departamento,
        "fecha_ingreso": colaborador.fecha_ingreso.strftime("%d/%m/%Y"),
        "salario_bruto": float(colaborador.salario_bruto),
        "rol": colaborador.rol,
        "estado": colaborador.estado,
        "modalidad": colaborador.modalidad,
        "telefono": colaborador.telefono
    }

@router.get("/vacaciones", response_model=SaldoVacacionesResponse)
def get_vacaciones(
    colaborador: Colaborador = Depends(obtener_colaborador_actual),
    db: Session = Depends(get_db)
):
    saldo = db.query(SaldoVacaciones).filter(SaldoVacaciones.colaborador_id == colaborador.id).first()
    if not saldo:
        # Si no existe, crear registro base
        saldo = SaldoVacaciones(
            colaborador_id=colaborador.id,
            periodo_anual="2025-2026",
            dias_ganados=Decimal("14.00"),
            dias_disfrutados=Decimal("0.00"),
            dias_pendientes=Decimal("14.00"),
            dias_acumulados_anteriores=Decimal("0.00")
        )
        db.add(saldo)
        db.commit()
        db.refresh(saldo)

    return {
        "periodo_anual": saldo.periodo_anual,
        "dias_ganados": float(saldo.dias_ganados),
        "dias_disfrutados": float(saldo.dias_disfrutados),
        "dias_pendientes": float(saldo.dias_pendientes),
        "dias_acumulados_anteriores": float(saldo.dias_acumulados_anteriores),
        "alerta_acumulacion": float(saldo.dias_pendientes) > 20.0
    }

@router.get("/solicitudes", response_model=List[SolicitudResponse])
def get_mis_solicitudes(
    colaborador: Colaborador = Depends(obtener_colaborador_actual),
    db: Session = Depends(get_db)
):
    solicitudes = db.query(Solicitud).filter(
        Solicitud.colaborador_id == colaborador.id
    ).order_by(Solicitud.fecha_solicitud.desc()).all()

    return [
        {
            "id": s.id,
            "tipo": s.tipo,
            "fecha_inicio": s.fecha_inicio.strftime("%d/%m/%Y"),
            "fecha_fin": s.fecha_fin.strftime("%d/%m/%Y"),
            "dias_solicitados": float(s.dias_solicitados),
            "motivo": s.motivo,
            "estado": s.estado,
            "fecha_solicitud": s.fecha_solicitud.strftime("%d/%m/%Y %H:%M") if s.fecha_solicitud else "",
            "observaciones_aprobador": s.observaciones_aprobador
        }
        for s in solicitudes
    ]

@router.post("/solicitudes", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
def crear_solicitud(
    req: SolicitudCreateRequest,
    colaborador: Colaborador = Depends(obtener_colaborador_actual),
    db: Session = Depends(get_db)
):
    if req.fecha_fin < req.fecha_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de finalización no puede ser anterior a la fecha de inicio."
        )

    if req.dias_solicitados <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cantidad de días solicitados debe ser mayor a 0."
        )

    # Validar si es solicitud de vacaciones que no exceda el saldo disponible
    if req.tipo == "vacaciones":
        saldo = db.query(SaldoVacaciones).filter(SaldoVacaciones.colaborador_id == colaborador.id).first()
        if saldo and float(saldo.dias_pendientes) < req.dias_solicitados:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No dispones de suficientes días de vacaciones (Disponibles: {float(saldo.dias_pendientes):.1f}, Solicitados: {req.dias_solicitados:.1f})."
            )

    nueva_solicitud = Solicitud(
        colaborador_id=colaborador.id,
        tipo=req.tipo,
        fecha_inicio=req.fecha_inicio,
        fecha_fin=req.fecha_fin,
        dias_solicitados=Decimal(str(req.dias_solicitados)),
        motivo=req.motivo,
        estado="pendiente"
    )
    db.add(nueva_solicitud)
    db.commit()
    db.refresh(nueva_solicitud)

    return {
        "id": nueva_solicitud.id,
        "tipo": nueva_solicitud.tipo,
        "fecha_inicio": nueva_solicitud.fecha_inicio.strftime("%d/%m/%Y"),
        "fecha_fin": nueva_solicitud.fecha_fin.strftime("%d/%m/%Y"),
        "dias_solicitados": float(nueva_solicitud.dias_solicitados),
        "motivo": nueva_solicitud.motivo,
        "estado": nueva_solicitud.estado,
        "fecha_solicitud": nueva_solicitud.fecha_solicitud.strftime("%d/%m/%Y %H:%M"),
        "observaciones_aprobador": None
    }

@router.get("/incapacidades", response_model=List[IncapacidadResponse])
def get_mis_incapacidades(
    colaborador: Colaborador = Depends(obtener_colaborador_actual),
    db: Session = Depends(get_db)
):
    incaps = db.query(Incapacidad).filter(
        Incapacidad.colaborador_id == colaborador.id
    ).order_by(Incapacidad.fecha_inicio.desc()).all()

    return [
        {
            "id": i.id,
            "entidad_emisora": i.entidad_emisora,
            "codigo_boleta": i.codigo_boleta,
            "fecha_inicio": i.fecha_inicio.strftime("%d/%m/%Y"),
            "fecha_fin": i.fecha_fin.strftime("%d/%m/%Y"),
            "dias_totales": i.dias_totales,
            "diagnostico": i.diagnostico,
            "subsidio_porcentaje": float(i.subsidio_porcentaje),
            "estado": i.estado
        }
        for i in incaps
    ]

