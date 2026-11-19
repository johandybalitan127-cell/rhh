"""
Servicio Programador de Tareas (APScheduler)
Ejecuta automáticamente el Agente Analista de Reportes a las 7:00 a. m. todos los días.
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.config import settings
from backend.agents.report_analyst import AgenteAnalistaReportes

logger = logging.getLogger("scheduler_service")

scheduler = BackgroundScheduler(timezone="America/Costa_Rica")

def tarea_reporte_diario():
    """Tarea programada que ejecuta el Agente 4 (Analista)"""
    logger.info("⏰ Ejecutando tarea programada: Agente Analista de Reportes Diarios...")
    try:
        analista = AgenteAnalistaReportes()
        rep = analista.ejecutar_reporte_diario()
        logger.info(f"✅ Reporte diario #{rep.id} generado exitosamente a las 07:00 a. m.")
    except Exception as e:
        logger.error(f"❌ Error al ejecutar el reporte diario programado: {e}")

def iniciar_scheduler():
    """Configura e inicia el programador de tareas en segundo plano"""
    if not scheduler.running:
        hora_str = settings.HORA_REPORTE_AUTOMATICO # "07:00"
        partes = hora_str.split(":")
        hora = int(partes[0]) if len(partes) > 0 else 7
        minuto = int(partes[1]) if len(partes) > 1 else 0

        trigger = CronTrigger(hour=hora, minute=minuto, timezone="America/Costa_Rica")
        scheduler.add_job(
            tarea_reporte_diario, 
            trigger=trigger, 
            id="reporte_diario_rrhh", 
            replace_existing=True
        )
        scheduler.start()
        logger.info(f"Programador de tareas iniciado: Reporte Diario programado a las {hora_str} (Hora CR).")

def detener_scheduler():
    """Detiene el programador de tareas al apagar el servidor"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Programador de tareas detenido.")

