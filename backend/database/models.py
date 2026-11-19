from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime, 
    ForeignKey, Text, Boolean, CheckConstraint, UniqueConstraint, JSON
)
try:
    from sqlalchemy.dialects.postgresql import JSONB
except ImportError:
    JSONB = JSON

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database.connection import Base

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Tipo sustituto en caso de que pgvector aún no esté instalado en el entorno
    Vector = lambda dim: Text


class Colaborador(Base):
    __tablename__ = "colaboradores"

    id = Column(Integer, primary_key=True, index=True)
    cedula = Column(String(20), unique=True, nullable=False, index=True)
    nombre_completo = Column(String(150), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    contrasena_hash = Column(String(255), nullable=False)
    puesto = Column(String(100), nullable=False)
    departamento = Column(String(80), nullable=False, index=True)
    fecha_ingreso = Column(Date, nullable=False)
    salario_bruto = Column(Numeric(12, 2), nullable=False)
    rol = Column(String(20), nullable=False, default="colaborador", index=True)
    estado = Column(String(20), nullable=False, default="activo", index=True)
    modalidad = Column(String(20), nullable=False, default="hibrido")
    supervisor_id = Column(Integer, ForeignKey("colaboradores.id", ondelete="SET NULL"), nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)
    telefono = Column(String(20), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    supervisor = relationship("Colaborador", remote_side=[id], backref="subordinados")
    saldos_vacaciones = relationship("SaldoVacaciones", back_populates="colaborador", cascade="all, delete-orphan")
    solicitudes = relationship("Solicitud", back_populates="colaborador", foreign_keys="Solicitud.colaborador_id", cascade="all, delete-orphan")
    incapacidades = relationship("Incapacidad", back_populates="colaborador", cascade="all, delete-orphan")
    movimientos = relationship("MovimientoPersonal", back_populates="colaborador", foreign_keys="MovimientoPersonal.colaborador_id", cascade="all, delete-orphan")
    consultas = relationship("ConsultaChat", back_populates="colaborador")

class SaldoVacaciones(Base):
    __tablename__ = "saldos_vacaciones"

    id = Column(Integer, primary_key=True, index=True)
    colaborador_id = Column(Integer, ForeignKey("colaboradores.id", ondelete="CASCADE"), nullable=False, index=True)
    periodo_anual = Column(String(10), nullable=False)
    dias_ganados = Column(Numeric(5, 2), nullable=False, default=14.00)
    dias_disfrutados = Column(Numeric(5, 2), nullable=False, default=0.00)
    dias_pendientes = Column(Numeric(5, 2), nullable=False, index=True)
    dias_acumulados_anteriores = Column(Numeric(5, 2), nullable=False, default=0.00)
    ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("colaborador_id", "periodo_anual", name="uq_colaborador_periodo"),
    )

    colaborador = relationship("Colaborador", back_populates="saldos_vacaciones")

class Solicitud(Base):
    __tablename__ = "solicitudes"

    id = Column(Integer, primary_key=True, index=True)
    colaborador_id = Column(Integer, ForeignKey("colaboradores.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(50), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias_solicitados = Column(Numeric(5, 2), nullable=False)
    motivo = Column(Text, nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente", index=True)
    fecha_solicitud = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    revisado_por = Column(Integer, ForeignKey("colaboradores.id", ondelete="SET NULL"), nullable=True)
    fecha_resolucion = Column(DateTime(timezone=True), nullable=True)
    observaciones_aprobador = Column(Text, nullable=True)

    colaborador = relationship("Colaborador", back_populates="solicitudes", foreign_keys=[colaborador_id])
    aprobador = relationship("Colaborador", foreign_keys=[revisado_por])

class Incapacidad(Base):
    __tablename__ = "incapacidades"

    id = Column(Integer, primary_key=True, index=True)
    colaborador_id = Column(Integer, ForeignKey("colaboradores.id", ondelete="CASCADE"), nullable=False, index=True)
    entidad_emisora = Column(String(10), nullable=False) # CCSS o INS
    codigo_boleta = Column(String(50), unique=True, nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias_totales = Column(Integer, nullable=False)
    diagnostico = Column(String(200), nullable=False)
    subsidio_porcentaje = Column(Numeric(5, 2), nullable=False, default=60.00)
    estado = Column(String(20), nullable=False, default="activa", index=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    colaborador = relationship("Colaborador", back_populates="incapacidades")

class MovimientoPersonal(Base):
    __tablename__ = "movimientos_personal"

    id = Column(Integer, primary_key=True, index=True)
    colaborador_id = Column(Integer, ForeignKey("colaboradores.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo_movimiento = Column(String(40), nullable=False, index=True)
    fecha_movimiento = Column(Date, nullable=False, index=True)
    detalle = Column(Text, nullable=False)
    departamento_anterior = Column(String(80), nullable=True)
    departamento_nuevo = Column(String(80), nullable=True)
    salario_anterior = Column(Numeric(12, 2), nullable=True)
    salario_nuevo = Column(Numeric(12, 2), nullable=True)
    registrado_por = Column(Integer, ForeignKey("colaboradores.id", ondelete="SET NULL"), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    colaborador = relationship("Colaborador", back_populates="movimientos", foreign_keys=[colaborador_id])

class ConsultaChat(Base):
    __tablename__ = "consultas_chat"

    id = Column(Integer, primary_key=True, index=True)
    colaborador_id = Column(Integer, ForeignKey("colaboradores.id", ondelete="SET NULL"), nullable=True, index=True)
    sesion_id = Column(String(100), nullable=False)
    mensaje_usuario = Column(Text, nullable=False)
    respuesta_agente = Column(Text, nullable=False)
    agente_resolutor = Column(String(50), nullable=False, index=True)
    resolucion_exitosa = Column(Boolean, nullable=False, default=True)
    fuentes_citadas = Column(JSONB, default=list)
    duracion_ms = Column(Integer, nullable=True)
    fecha_consulta = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    colaborador = relationship("Colaborador", back_populates="consultas")

class ReporteDiario(Base):
    __tablename__ = "reportes_diarios"

    id = Column(Integer, primary_key=True, index=True)
    fecha_reporte = Column(Date, unique=True, nullable=False, index=True)
    hora_generacion = Column(String(10), nullable=False, default="07:00:00")
    total_ausencias = Column(Integer, nullable=False, default=0)
    solicitudes_pendientes = Column(Integer, nullable=False, default=0)
    solicitudes_pendientes_criticas = Column(Integer, nullable=False, default=0)
    incapacidades_activas = Column(Integer, nullable=False, default=0)
    ingresos_mes = Column(Integer, nullable=False, default=0)
    salidas_mes = Column(Integer, nullable=False, default=0)
    colaboradores_vacaciones_acumuladas = Column(Integer, nullable=False, default=0)
    total_consultas_chat = Column(Integer, nullable=False, default=0)
    tasa_resolucion_pct = Column(Numeric(5, 2), nullable=False, default=0.00)
    top_temas_consultados = Column(JSONB, nullable=False, default=list)
    preguntas_sin_respuesta = Column(JSONB, nullable=False, default=list)
    resumen_ejecutivo = Column(Text, nullable=False)
    datos_analiticos_sql = Column(JSONB, nullable=False, default=dict)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

class DocumentoChunk(Base):
    __tablename__ = "documentos_chunks"

    id = Column(Integer, primary_key=True, index=True)
    documento_id = Column(String(100), nullable=False, index=True)
    documento_titulo = Column(String(200), nullable=False)
    seccion = Column(String(150), nullable=False)
    url_drive = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    contenido = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=True) # Dimensión del embedding de Gemini
    tokens_aprox = Column(Integer, nullable=True)
    hash_contenido = Column(String(64), nullable=False)
    metadatos = Column(JSONB, default=dict)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("documento_id", "chunk_index", name="uq_documento_chunk"),
    )
