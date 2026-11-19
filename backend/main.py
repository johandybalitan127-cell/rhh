"""
Punto de Entrada Principal de la API FastAPI
Mini Proyecto #2 - Portal de RRHH con RAG Multiagente (Costa Rica)
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database.connection import check_database_connection
from backend.services.scheduler_service import iniciar_scheduler, detener_scheduler

# Routers
from backend.routes.auth_routes import router as auth_router
from backend.routes.chat_routes import router as chat_router
from backend.routes.employee_routes import router as employee_router
from backend.routes.dashboard_routes import router as dashboard_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("rrhh_main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Evento de inicio (Startup)
    logger.info("=" * 60)
    logger.info(f"Iniciando {settings.EMPRESA_NOMBRE} - Portal de RRHH API...")
    logger.info("=" * 60)
    
    # 1. Asegurar tablas y datos iniciales en la base de datos
    try:
        from backend.database.connection import engine, Base
        from backend.database.seed_data import generar_datos_completos
        from backend.agents.ingestion_sync import AgenteIngestaSincronizacion
        
        logger.info("Verificando tablas de base de datos...")
        Base.metadata.create_all(bind=engine)
        
        logger.info("Verificando datos iniciales de colaboradores...")
        generar_datos_completos()

        logger.info("Verificando indexación inicial de políticas RAG...")
        agente_ingesta = AgenteIngestaSincronizacion()
        agente_ingesta.sincronizar()
    except Exception as e:
        logger.warning(f"Aviso durante inicialización de datos: {e}")

    # 2. Iniciar programador de reportes a las 7:00 a. m.
    try:
        iniciar_scheduler()
    except Exception as e:
        logger.warning(f"No se pudo iniciar el scheduler automáticamente: {e}")

    yield

    # Evento de cierre (Shutdown)
    logger.info("Deteniendo servicios y scheduler...")
    try:
        detener_scheduler()
    except Exception:
        pass

app = FastAPI(
    title=f"Portal de RRHH - {settings.EMPRESA_NOMBRE}",
    description="API REST con RAG Multiagente, pgvector y LangGraph para Recursos Humanos en Costa Rica.",
    version="2.0.0",
    lifespan=lifespan
)

# Configuración de CORS para el Frontend (React + Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusión de Routers Modulares
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(employee_router)
app.include_router(dashboard_router)

@app.get("/api/health", tags=["Salud del Sistema"])
def health_check():
    """Endpoint de comprobación de salud del backend"""
    db_ok = check_database_connection()
    return {
        "status": "online" if db_ok else "degraded",
        "empresa": settings.EMPRESA_NOMBRE,
        "database_connected": db_ok,
        "environment": settings.ENVIRONMENT,
        "agentes": [
            "1. Orquestador (LangGraph)",
            "2. Políticas (RAG pgvector)",
            "3. Datos del Colaborador (SQL)",
            "4. Analista de Reportes (7:00 AM)",
            "5. Ingesta y Sincronización (Drive)"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)

