"""
Rutas del Chatbot (/api/chat)
Maneja la recepción de preguntas, invocación del Agente Orquestador y consulta de historial.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import Colaborador, ConsultaChat
from backend.services.auth_service import obtener_colaborador_actual
from backend.agents.orchestrator import AgenteOrquestador

router = APIRouter(prefix="/api/chat", tags=["Chatbot RRHH"])

class ChatMessageRequest(BaseModel):
    pregunta: str
    sesion_id: Optional[str] = "sesion-portal-web"

class FuenteCita(BaseModel):
    documento: str
    seccion: str
    url_drive: str
    similitud: Optional[float] = None

class ChatMessageResponse(BaseModel):
    respuesta: str
    agente: str
    fuentes: List[FuenteCita] = []
    exitosa: bool
    duracion_ms: int

class ChatHistoryItem(BaseModel):
    id: int
    mensaje_usuario: str
    respuesta_agente: str
    agente_resolutor: str
    resolucion_exitosa: bool
    fuentes_citadas: Any
    fecha_consulta: str

@router.post("/message", response_model=ChatMessageResponse)
def enviar_mensaje(
    request: ChatMessageRequest,
    colaborador: Colaborador = Depends(obtener_colaborador_actual),
    db: Session = Depends(get_db)
):
    """
    Procesa la pregunta del colaborador mediante el Agente Orquestador de LangGraph.
    """
    pregunta = request.pregunta.strip()
    if not pregunta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La pregunta no puede estar vacía."
        )

    # Iniciar orquestador con la sesión de BD actual
    orquestador = AgenteOrquestador(db_session=db)

    # Procesar con aislamiento por colaborador_id
    resultado = orquestador.procesar_mensaje(
        pregunta=pregunta,
        colaborador_id=colaborador.id,
        sesion_id=request.sesion_id
    )

    return resultado

@router.get("/history", response_model=List[ChatHistoryItem])
def obtener_historial_chat(
    colaborador: Colaborador = Depends(obtener_colaborador_actual),
    db: Session = Depends(get_db),
    limit: int = 30
):
    """
    Obtiene las últimas consultas realizadas por el usuario autenticado.
    """
    consultas = db.query(ConsultaChat).filter(
        ConsultaChat.colaborador_id == colaborador.id
    ).order_by(ConsultaChat.fecha_consulta.asc()).limit(limit).all()

    return [
        {
            "id": c.id,
            "mensaje_usuario": c.mensaje_usuario,
            "respuesta_agente": c.respuesta_agente,
            "agente_resolutor": c.agente_resolutor,
            "resolucion_exitosa": c.resolucion_exitosa,
            "fuentes_citadas": c.fuentes_citadas or [],
            "fecha_consulta": c.fecha_consulta.strftime("%d/%m/%Y %H:%M") if c.fecha_consulta else ""
        }
        for c in consultas
    ]

