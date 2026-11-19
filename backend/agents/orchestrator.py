"""
Agente 1: Agente Orquestador y Guardián de Seguridad (LangGraph)
Responsabilidad:
- Clasificar la intención de la pregunta del colaborador.
- Decidir el enrutamiento hacia Agente de Políticas (RAG) o Datos del Colaborador (SQL).
- Coordinar consultas mixtas.
- Rechazar preguntas ajenas al ámbito de Recursos Humanos.
- Bloquear intentos de vulnerar la privacidad o consultar datos privados de terceros.
- Registrar cada interacción en la tabla 'consultas_chat'.
"""

import os
import re
import time
import logging
from typing import Dict, Any, List, Optional, TypedDict
from dotenv import load_dotenv
from sqlalchemy.orm import Session

try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_DISPONIBLE = True
except ImportError:
    LANGGRAPH_DISPONIBLE = False

from backend.database.connection import SessionLocal
from backend.database.models import ConsultaChat
from backend.agents.rag_policy import AgentePoliticasRAG
from backend.agents.employee_data import AgenteDatosColaborador

load_dotenv()
logger = logging.getLogger("agente_orquestador")

# Definición del Estado de LangGraph
class EstadoChat(TypedDict):
    colaborador_id: int
    sesion_id: str
    pregunta: str
    intencion: str
    agente_resolutor: str
    respuesta: str
    fuentes_citadas: List[Dict[str, Any]]
    resolucion_exitosa: bool
    tiempo_inicio: float
    duracion_ms: int

class AgenteOrquestador:
    def __init__(self, db_session: Optional[Session] = None):
        self.db = db_session
        self.rag_agent = AgentePoliticasRAG(db_session=self.db)
        self.employee_agent = AgenteDatosColaborador(db_session=self.db)
        self.grafo = self._construir_grafo() if LANGGRAPH_DISPONIBLE else None

    def _clasificar_intencion_heuristica(self, pregunta: str) -> str:
        """
        Clasifica la intención mediante análisis semántico, reglas de privacidad
        y palabras clave laborales.
        """
        p = pregunta.lower().strip()

        # 1. BLOQUEO DE SEGURIDAD / PRIVACIDAD
        # Detectar intentos de indagar en datos de terceros
        patrones_terceros = [
            r"cu[aá]nto gana\s+[a-z]+",
            r"salario de\s+[a-z]+",
            r"sueldo de\s+[a-z]+",
            r"vacaciones de\s+[a-z]+",
            r"incapacidad de\s+[a-z]+",
            r"compañer[oa]",
            r"mi jefe gana",
            r"modificar salario",
            r"borrar registro",
            r"cambiar contrase[ñn]a de",
            r"base de datos",
            r"drop table",
            r"select \* from"
        ]
        for patron in patrones_terceros:
            if re.search(patron, p):
                # Permitir si explícitamente habla de 'mi salario' o 'mi compañero y yo...' de forma genérica
                if not any(propio in p for propio in ["mi salario", "mi puesto", "mis vacaciones"]):
                    return "bloqueo_seguridad"

        # 2. CONSULTAS MIXTAS (combinan datos personales con políticas generales)
        tiene_personal = any(w in p for w in ["mis vacaciones", "me quedan", "mi saldo", "mis solicitudes", "mi fecha de pago", "mi contrato"])
        tiene_politica = any(w in p for w in ["política", "politica", "reglamento", "código de trabajo", "codigo de trabajo", "procedimiento", "beneficio", "ley", "cuándo corresponde"])
        if tiene_personal and tiene_politica:
            return "mixto"

        # 3. DATOS PERSONALES DEL COLABORADOR
        if any(w in p for w in [
            "mis vacaciones", "tengo disponibles", "días me quedan", "dias me quedan",
            "mi saldo", "mis solicitudes", "estado de mi", "mi incapacidad", 
            "mi puesto", "mi salario", "cuándo me pagan", "cuando me pagan", "mi perfil"
        ]):
            return "datos_personales"

        # 4. PREGUNTAS FUERA DE ÁMBITO (No relacionadas con RRHH)
        temas_ajenos = [
            "receta", "gallo pinto", "fútbol", "futbol", "champions", "saprissa", "alajuela",
            "película", "pelicula", "clima", "chiste", "poema", "capital de", "presidente de",
            "cuánto es 2", "programar en c", "bitcoins", "cripto"
        ]
        if any(w in p for w in temas_ajenos):
            return "fuera_de_ambito"

        # 5. POLÍTICAS DE RRHH (RAG)
        return "politicas_rag"

    # --- NODOS DEL GRAFO LANGGRAPH ---

    def nodo_clasificador(self, state: EstadoChat) -> Dict[str, Any]:
        intencion = self._clasificar_intencion_heuristica(state["pregunta"])
        logger.info(f"Orquestador clasificó la pregunta como: '{intencion}'")
        return {"intencion": intencion}

    def nodo_politicas_rag(self, state: EstadoChat) -> Dict[str, Any]:
        resultado = self.rag_agent.responder_consulta(state["pregunta"])
        return {
            "agente_resolutor": "politicas_rag",
            "respuesta": resultado["respuesta"],
            "fuentes_citadas": resultado["fuentes_citadas"],
            "resolucion_exitosa": resultado["encontrado"]
        }

    def nodo_datos_colaborador(self, state: EstadoChat) -> Dict[str, Any]:
        resultado = self.employee_agent.procesar_consulta(state["pregunta"], state["colaborador_id"])
        return {
            "agente_resolutor": "datos_personales",
            "respuesta": resultado["respuesta"],
            "fuentes_citadas": [],
            "resolucion_exitosa": resultado["exito"]
        }

    def nodo_mixto(self, state: EstadoChat) -> Dict[str, Any]:
        # Ejecutar ambos agentes de forma coordinada
        res_personal = self.employee_agent.procesar_consulta(state["pregunta"], state["colaborador_id"])
        res_rag = self.rag_agent.responder_consulta(state["pregunta"])

        respuesta_unificada = (
            f"### 👤 Tu Información Personal:\n{res_personal['respuesta']}\n\n"
            f"---\n\n"
            f"### 📖 Política Corporativa Aplicable:\n{res_rag['respuesta']}"
        )

        return {
            "agente_resolutor": "mixto",
            "respuesta": respuesta_unificada,
            "fuentes_citadas": res_rag.get("fuentes_citadas", []),
            "resolucion_exitosa": res_personal["exito"] and res_rag["encontrado"]
        }

    def nodo_bloqueo_seguridad(self, state: EstadoChat) -> Dict[str, Any]:
        respuesta_bloqueo = (
            "🔒 **Protección de Datos Personales (Ley N° 8968 de Costa Rica):**\n\n"
            "Por estrictas razones de seguridad y en cumplimiento de la Ley de Protección de Datos Personales y el "
            "Aviso de Privacidad de TecnoCR Soluciones S.A., **no es posible consultar salarios, evaluaciones, incapacidades "
            "ni ninguna otra información privada de otros compañeros de trabajo**.\n\n"
            "El sistema únicamente puede brindarte información relacionada con tu propio expediente laboral."
        )
        return {
            "agente_resolutor": "bloqueo_seguridad",
            "respuesta": respuesta_bloqueo,
            "fuentes_citadas": [],
            "resolucion_exitosa": False
        }

    def nodo_fuera_de_ambito(self, state: EstadoChat) -> Dict[str, Any]:
        respuesta_ambito = (
            "ℹ️ **Fuera del ámbito de Recursos Humanos:**\n\n"
            "Soy el asistente virtual especializado en **Recursos Humanos de TecnoCR Soluciones S.A.** en Costa Rica. "
            "Mi propósito es responder dudas sobre normativas laborales, beneficios, incapacidades de la CCSS/INS, vacaciones, "
            "permisos, teletrabajo y consultas sobre tu propio expediente.\n\n"
            "No tengo facultades para responder temas de cultura general, ocio u otras materias no laborales."
        )
        return {
            "agente_resolutor": "rechazado_fuera_de_ambito",
            "respuesta": respuesta_ambito,
            "fuentes_citadas": [],
            "resolucion_exitosa": False
        }

    def _construir_grafo(self):
        """Construye y compila el flujo de LangGraph StateGraph"""
        workflow = StateGraph(EstadoChat)

        # Agregar Nodos
        workflow.add_node("clasificar", self.nodo_clasificador)
        workflow.add_node("politicas_rag", self.nodo_politicas_rag)
        workflow.add_node("datos_personales", self.nodo_datos_colaborador)
        workflow.add_node("mixto", self.nodo_mixto)
        workflow.add_node("bloqueo_seguridad", self.nodo_bloqueo_seguridad)
        workflow.add_node("fuera_de_ambito", self.nodo_fuera_de_ambito)

        # Punto de entrada
        workflow.set_entry_point("clasificar")

        # Enrutamiento condicional
        def router(state: EstadoChat) -> str:
            return state["intencion"]

        workflow.add_conditional_edges(
            "clasificar",
            router,
            {
                "politicas_rag": "politicas_rag",
                "datos_personales": "datos_personales",
                "mixto": "mixto",
                "bloqueo_seguridad": "bloqueo_seguridad",
                "fuera_de_ambito": "fuera_de_ambito"
            }
        )

        # Cierre de nodos
        workflow.add_edge("politicas_rag", END)
        workflow.add_edge("datos_personales", END)
        workflow.add_edge("mixto", END)
        workflow.add_edge("bloqueo_seguridad", END)
        workflow.add_edge("fuera_de_ambito", END)

        return workflow.compile()

    def procesar_mensaje(self, pregunta: str, colaborador_id: int, sesion_id: str = "sesion-default") -> Dict[str, Any]:
        """
        Ejecuta el ciclo de LangGraph y guarda el historial en la base de datos.
        """
        t_inicio = time.time()
        estado_inicial: EstadoChat = {
            "colaborador_id": colaborador_id,
            "sesion_id": sesion_id,
            "pregunta": pregunta,
            "intencion": "",
            "agente_resolutor": "",
            "respuesta": "",
            "fuentes_citadas": [],
            "resolucion_exitosa": True,
            "tiempo_inicio": t_inicio,
            "duracion_ms": 0
        }

        # Ejecución del grafo LangGraph o enrutador directo
        if self.grafo:
            salida = self.grafo.invoke(estado_inicial)
        else:
            intencion = self._clasificar_intencion_heuristica(pregunta)
            estado_inicial["intencion"] = intencion
            if intencion == "politicas_rag":
                nodo_res = self.nodo_politicas_rag(estado_inicial)
            elif intencion == "datos_personales":
                nodo_res = self.nodo_datos_colaborador(estado_inicial)
            elif intencion == "mixto":
                nodo_res = self.nodo_mixto(estado_inicial)
            elif intencion == "bloqueo_seguridad":
                nodo_res = self.nodo_bloqueo_seguridad(estado_inicial)
            else:
                nodo_res = self.nodo_fuera_de_ambito(estado_inicial)
            salida = {**estado_inicial, **nodo_res}
        duracion_ms = int((time.time() - t_inicio) * 1000)
        salida["duracion_ms"] = duracion_ms

        # Registro en la base de datos
        db = self.db or SessionLocal()
        debe_cerrar = self.db is None
        try:
            chat_record = ConsultaChat(
                colaborador_id=colaborador_id,
                sesion_id=sesion_id,
                mensaje_usuario=pregunta,
                respuesta_agente=salida["respuesta"],
                agente_resolutor=salida["agente_resolutor"],
                resolucion_exitosa=salida["resolucion_exitosa"],
                fuentes_citadas=salida["fuentes_citadas"],
                duracion_ms=duracion_ms
            )
            db.add(chat_record)
            db.commit()
        except Exception as e:
            logger.warning(f"No se pudo guardar la consulta en la BD: {e}")
            db.rollback()
        finally:
            if debe_cerrar:
                db.close()

        return {
            "respuesta": salida["respuesta"],
            "agente": salida["agente_resolutor"],
            "fuentes": salida["fuentes_citadas"],
            "exitosa": salida["resolucion_exitosa"],
            "duracion_ms": duracion_ms
        }

