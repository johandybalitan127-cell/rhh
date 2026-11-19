"""
Agente 3: Agente de Datos del Colaborador (Consultas SQL Personales)
Responsabilidad:
- Consultar la base de datos PostgreSQL mediante consultas SQL de solo lectura.
- Consultar saldos de vacaciones, estado de solicitudes, fechas de pago e incapacidades.
- Filtrar SIEMPRE Y OBLIGATORIAMENTE por el ID del usuario autenticado (colaborador_id).
- Proteger la privacidad: rechazar tajantemente solicitudes de datos de otros colaboradores.
"""

import os
import datetime
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.database.connection import SessionLocal
from backend.database.models import Colaborador, SaldoVacaciones, Solicitud, Incapacidad

logger = logging.getLogger("agente_datos_colaborador")

class AgenteDatosColaborador:
    def __init__(self, db_session: Optional[Session] = None):
        self.db = db_session

    def procesar_consulta(self, pregunta: str, colaborador_id: int) -> Dict[str, Any]:
        """
        Interpreta la consulta del colaborador autenticado y ejecuta la consulta SQL
        correspondiente sobre sus datos personales.
        """
        if not colaborador_id:
            return {
                "respuesta": "No se ha podido identificar su sesión de usuario para consultar sus datos personales.",
                "datos_obtenidos": None,
                "exito": False
            }

        db = self.db or SessionLocal()
        debe_cerrar = self.db is None

        try:
            # Obtener datos base del colaborador
            colaborador = db.query(Colaborador).filter(Colaborador.id == colaborador_id).first()
            if not colaborador:
                return {
                    "respuesta": f"No se encontró un registro de colaborador con el identificador proporcionado.",
                    "datos_obtenidos": None,
                    "exito": False
                }

            pregunta_lower = pregunta.lower()

            # 1. Consulta de Vacaciones y Días Disponibles
            if any(w in pregunta_lower for w in ["vacaciones", "saldo", "días disponibles", "dias disponibles", "cuantos días me quedan", "cuanto me queda"]):
                return self._consultar_vacaciones(db, colaborador)

            # 2. Consulta de Solicitudes y Permisos
            elif any(w in pregunta_lower for w in ["solicitud", "solicitudes", "permiso", "estado de mi", "aprobada", "pendiente"]):
                return self._consultar_solicitudes(db, colaborador)

            # 3. Consulta de Fechas de Pago, Salario y Nómina
            elif any(w in pregunta_lower for w in ["pago", "cuándo pagan", "fecha de pago", "salario", "colilla", "nómina", "aguinaldo"]):
                return self._consultar_informacion_pago(db, colaborador)

            # 4. Consulta de Incapacidades registradas
            elif any(w in pregunta_lower for w in ["incapacidad", "incapacidades", "boleta", "ccss", "ins"]):
                return self._consultar_incapacidades(db, colaborador)

            # 5. Consulta de Perfil general y Puesto
            else:
                return self._consultar_perfil_general(db, colaborador)

        except Exception as e:
            logger.error(f"Error en consulta de datos de colaborador {colaborador_id}: {e}")
            return {
                "respuesta": "Ocurrió un error al consultar sus datos en el sistema. Por favor intente nuevamente.",
                "datos_obtenidos": None,
                "exito": False
            }
        finally:
            if debe_cerrar:
                db.close()

    def _consultar_vacaciones(self, db: Session, colab: Colaborador) -> Dict[str, Any]:
        saldo = db.query(SaldoVacaciones).filter(SaldoVacaciones.colaborador_id == colab.id).first()
        if not saldo:
            return {
                "respuesta": f"Estimado/a {colab.nombre_completo}, actualmente no se registra un balance de vacaciones activo en el sistema.",
                "datos_obtenidos": None,
                "exito": True
            }

        alerta_acumulacion = ""
        if saldo.dias_pendientes > 20:
            alerta_acumulacion = "\n\n⚠️ **Alerta de acumulación:** Tienes más de 20 días pendientes de vacaciones. Te sugerimos coordinar con tu jefatura el disfrute de tu tiempo de descanso."

        respuesta = (
            f"Hola, **{colab.nombre_completo}**. A continuación se detalla tu balance de vacaciones para el periodo **{saldo.periodo_anual}**:\n\n"
            f"- **Días pendientes disponibles:** **{saldo.dias_pendientes:.1f} días**\n"
            f"- **Días ganados en el periodo:** {saldo.dias_ganados:.1f} días\n"
            f"- **Días disfrutados:** {saldo.dias_disfrutados:.1f} días\n"
            f"- **Días acumulados de periodos anteriores:** {saldo.dias_acumulados_anteriores:.1f} días\n"
            f"- **Última actualización:** {saldo.ultima_actualizacion.strftime('%d/%m/%Y') if saldo.ultima_actualizacion else 'Reciente'}"
            f"{alerta_acumulacion}\n\n"
            f"Recuerda que puedes gestionar una nueva solicitud desde el portal con al menos 15 días de anticipación."
        )

        return {
            "respuesta": respuesta,
            "datos_obtenidos": {
                "dias_pendientes": float(saldo.dias_pendientes),
                "dias_ganados": float(saldo.dias_ganados),
                "dias_disfrutados": float(saldo.dias_disfrutados),
                "periodo": saldo.periodo_anual
            },
            "exito": True
        }

    def _consultar_solicitudes(self, db: Session, colab: Colaborador) -> Dict[str, Any]:
        solicitudes = db.query(Solicitud).filter(
            Solicitud.colaborador_id == colab.id
        ).order_by(Solicitud.fecha_solicitud.desc()).limit(5).all()

        if not solicitudes:
            return {
                "respuesta": f"Estimado/a {colab.nombre_completo}, no tienes solicitudes registradas recientemente en tu expediente.",
                "datos_obtenidos": [],
                "exito": True
            }

        lista_txt = []
        for s in solicitudes:
            estado_emoji = "⏳ Pendiente" if s.estado == "pendiente" else ("✅ Aprobada" if s.estado == "aprobada" else "❌ Rechazada")
            obs = f" - *Obs: {s.observaciones_aprobador}*" if s.observaciones_aprobador else ""
            lista_txt.append(
                f"- **{s.tipo.replace('_', ' ').title()}** | {s.dias_solicitados} días ({s.fecha_inicio.strftime('%d/%m/%Y')} al {s.fecha_fin.strftime('%d/%m/%Y')}) | Estado: **{estado_emoji}**{obs}"
            )

        respuesta = (
            f"Estimado/a **{colab.nombre_completo}**, este es el estado de tus últimas solicitudes tramitadas:\n\n"
            + "\n".join(lista_txt)
        )

        return {
            "respuesta": respuesta,
            "datos_obtenidos": [{"id": s.id, "tipo": s.tipo, "estado": s.estado, "dias": float(s.dias_solicitados)} for s in solicitudes],
            "exito": True
        }

    def _consultar_informacion_pago(self, db: Session, colab: Colaborador) -> Dict[str, Any]:
        hoy = datetime.date.today()
        # Próxima quincena
        if hoy.day < 15:
            prox_pago = datetime.date(hoy.year, hoy.month, 15)
        else:
            # Fin de mes
            import calendar
            ultimo_dia = calendar.monthrange(hoy.year, hoy.month)[1]
            prox_pago = datetime.date(hoy.year, hoy.month, ultimo_dia)

        # Ajuste si cae en fin de semana (adelanto al viernes hábil previo)
        if prox_pago.weekday() == 5: # Sábado
            prox_pago -= datetime.timedelta(days=1)
        elif prox_pago.weekday() == 6: # Domingo
            prox_pago -= datetime.timedelta(days=2)

        respuesta = (
            f"Estimado/a **{colab.nombre_completo}**, la información de tu ciclo de compensación es la siguiente:\n\n"
            f"- **Departamento:** {colab.departamento}\n"
            f"- **Puesto:** {colab.puesto}\n"
            f"- **Modalidad de pago:** Quincenal (días 15 y último día hábil del mes)\n"
            f"- **Próxima fecha estimada de depósito:** **{prox_pago.strftime('%d/%m/%Y')}**\n"
            f"- **Moneda:** Colones Costarricenses (CRC)\n"
            f"- **Deducciones de Ley:** 10.67% de cargas sociales CCSS + Impuesto sobre la Renta según escala de Hacienda.\n"
            f"- **Fecha oficial de pago de Aguinaldo TecnoCR:** **5 de diciembre** de cada año."
        )

        return {
            "respuesta": respuesta,
            "datos_obtenidos": {
                "proximo_pago": prox_pago.isoformat(),
                "departamento": colab.departamento,
                "puesto": colab.puesto
            },
            "exito": True
        }

    def _consultar_incapacidades(self, db: Session, colab: Colaborador) -> Dict[str, Any]:
        incaps = db.query(Incapacidad).filter(Incapacidad.colaborador_id == colab.id).order_by(Incapacidad.fecha_inicio.desc()).all()
        if not incaps:
            return {
                "respuesta": f"Estimado/a **{colab.nombre_completo}**, no tienes incapacidades médicas registradas en tu historial.",
                "datos_obtenidos": [],
                "exito": True
            }

        lineas = []
        for inc in incaps:
            estado_str = "🟢 Activa" if inc.estado == "activa" else "⚪ Finalizada"
            lineas.append(
                f"- **Boleta {inc.codigo_boleta}** ({inc.entidad_emisora}) | {inc.dias_totales} días ({inc.fecha_inicio.strftime('%d/%m/%Y')} al {inc.fecha_fin.strftime('%d/%m/%Y')}) | Estado: **{estado_str}** | Subsidio: {inc.subsidio_porcentaje}%"
            )

        respuesta = (
            f"Estimado/a **{colab.nombre_completo}**, tu registro de incapacidades médicas incluye:\n\n"
            + "\n".join(lineas)
            + "\n\nRecuerda que las boletas de la CCSS o del INS deben ser presentadas en un plazo máximo de 48 horas tras su emisión."
        )

        return {
            "respuesta": respuesta,
            "datos_obtenidos": [{"boleta": inc.codigo_boleta, "entidad": inc.entidad_emisora, "estado": inc.estado} for inc in incaps],
            "exito": True
        }

    def _consultar_perfil_general(self, db: Session, colab: Colaborador) -> Dict[str, Any]:
        return {
            "respuesta": (
                f"📋 **Ficha de Colaborador - TecnoCR**\n\n"
                f"- **Nombre:** {colab.nombre_completo}\n"
                f"- **Cédula:** {colab.cedula}\n"
                f"- **Correo:** {colab.email}\n"
                f"- **Puesto:** {colab.puesto}\n"
                f"- **Departamento:** {colab.departamento}\n"
                f"- **Modalidad laboral:** {colab.modalidad.title()}\n"
                f"- **Fecha de ingreso:** {colab.fecha_ingreso.strftime('%d/%m/%Y')}\n"
                f"- **Estado laboral:** {colab.estado.title()}"
            ),
            "datos_obtenidos": {
                "nombre": colab.nombre_completo,
                "cedula": colab.cedula,
                "puesto": colab.puesto,
                "departamento": colab.departamento
            },
            "exito": True
        }

