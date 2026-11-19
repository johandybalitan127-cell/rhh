"""
Configuración General del Backend
Carga y valida variables de entorno mediante Pydantic
"""

import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Entorno y servidor
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # Base de datos
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/rrhh_costarica")

    # Seguridad y JWT
    SECRET_KEY: str
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))

    # Inteligencia Artificial
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.0-flash")

    # Negocio (Costa Rica)
    EMPRESA_NOMBRE: str = os.getenv("EMPRESA_NOMBRE", "TecnoCR Soluciones S.A.")
    HORA_REPORTE_AUTOMATICO: str = os.getenv("HORA_REPORTE_AUTOMATICO", "07:00")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
