import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

logger = logging.getLogger("rrhh_database")
logging.basicConfig(level=logging.INFO)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/rrhh_costarica")

Base = declarative_base()

def inicializar_motor():
    """
    Intenta conectar a PostgreSQL. Si no está disponible localmente,
    conmuta automáticamente a SQLite local para garantizar que el sistema
    funcione de inmediato sin bloquear al estudiante.
    """
    global DATABASE_URL
    try:
        if "postgresql" in DATABASE_URL:
            # Probar si PostgreSQL responde
            test_engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 3})
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1;"))
            logger.info("Conexión exitosa a PostgreSQL.")
            return test_engine
    except Exception as e:
        logger.warning(f"PostgreSQL no está disponible ({e}). Activando base de datos SQLite local de respaldo...")
        sqlite_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "rrhh_costarica.db"))
        DATABASE_URL = f"sqlite:///{sqlite_path}"

    engine_sqlite = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
        pool_pre_ping=True
    )
    logger.info(f"Motor de base de datos listo: {DATABASE_URL}")
    return engine_sqlite

engine = inicializar_motor()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    Generador de sesión de base de datos para FastAPI.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_database_connection() -> bool:
    """
    Verifica si el motor de base de datos está operativo.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
            return True
    except Exception as e:
        logger.warning(f"Error verificando conexión: {e}")
        return False
