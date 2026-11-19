-- ==============================================================================
-- BASE DE DATOS: rrhh_costarica
-- Mini Proyecto #2 - Portal de Consulta de Políticas de RRHH con RAG Multiagente
-- Empresa: TecnoCR Soluciones S.A. (Costa Rica)
-- ==============================================================================

-- Habilitar extensión vectorial pgvector si está disponible
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABLA: colaboradores
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS documentos_chunks CASCADE;
DROP TABLE IF EXISTS reportes_diarios CASCADE;
DROP TABLE IF EXISTS consultas_chat CASCADE;
DROP TABLE IF EXISTS movimientos_personal CASCADE;
DROP TABLE IF EXISTS incapacidades CASCADE;
DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS saldos_vacaciones CASCADE;
DROP TABLE IF EXISTS colaboradores CASCADE;

CREATE TABLE colaboradores (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL, -- Formato CR: X-XXXX-XXXX
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    puesto VARCHAR(100) NOT NULL,
    departamento VARCHAR(80) NOT NULL CHECK (departamento IN ('Tecnología', 'Recursos Humanos', 'Finanzas', 'Operaciones', 'Ventas y Mercadeo', 'Servicio al Cliente')),
    fecha_ingreso DATE NOT NULL,
    salario_bruto NUMERIC(12, 2) NOT NULL CHECK (salario_bruto > 0), -- En Colones (CRC)
    rol VARCHAR(20) NOT NULL DEFAULT 'colaborador' CHECK (rol IN ('colaborador', 'rrhh', 'administrador')),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'incapacitado', 'vacaciones')),
    modalidad VARCHAR(20) NOT NULL DEFAULT 'hibrido' CHECK (modalidad IN ('presencial', 'remoto', 'hibrido')),
    supervisor_id INT REFERENCES colaboradores(id) ON DELETE SET NULL,
    fecha_nacimiento DATE,
    telefono VARCHAR(20),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_colaboradores_departamento ON colaboradores(departamento);
CREATE INDEX idx_colaboradores_rol ON colaboradores(rol);
CREATE INDEX idx_colaboradores_estado ON colaboradores(estado);
CREATE INDEX idx_colaboradores_email ON colaboradores(email);

-- ------------------------------------------------------------------------------
-- 2. TABLA: saldos_vacaciones
-- Legislación CR: Art. 153 Código de Trabajo (mínimo 2 semanas por cada 50 semanas continuas)
-- ------------------------------------------------------------------------------
CREATE TABLE saldos_vacaciones (
    id SERIAL PRIMARY KEY,
    colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    periodo_anual VARCHAR(10) NOT NULL, -- Ej: '2025-2026'
    dias_ganados NUMERIC(5, 2) NOT NULL DEFAULT 14.00 CHECK (dias_ganados >= 0),
    dias_disfrutados NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (dias_disfrutados >= 0),
    dias_pendientes NUMERIC(5, 2) NOT NULL CHECK (dias_pendientes >= 0),
    dias_acumulados_anteriores NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (dias_acumulados_anteriores >= 0),
    ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_colaborador_periodo UNIQUE (colaborador_id, periodo_anual)
);

CREATE INDEX idx_saldos_vacaciones_colaborador ON saldos_vacaciones(colaborador_id);
CREATE INDEX idx_saldos_vacaciones_pendientes ON saldos_vacaciones(dias_pendientes);

-- ------------------------------------------------------------------------------
-- 3. TABLA: solicitudes
-- ------------------------------------------------------------------------------
CREATE TABLE solicitudes (
    id SERIAL PRIMARY KEY,
    colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'vacaciones', 
        'permiso_con_goce', 
        'permiso_sin_goce', 
        'licencia_paternidad', 
        'licencia_maternidad', 
        'cambio_modalidad'
    )),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_solicitados NUMERIC(5, 2) NOT NULL CHECK (dias_solicitados > 0),
    motivo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
    fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revisado_por INT REFERENCES colaboradores(id) ON DELETE SET NULL,
    fecha_resolucion TIMESTAMP WITH TIME ZONE,
    observaciones_aprobador TEXT,
    CONSTRAINT chk_fechas_solicitud CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_solicitudes_colaborador ON solicitudes(colaborador_id);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX idx_solicitudes_fecha ON solicitudes(fecha_solicitud);

-- ------------------------------------------------------------------------------
-- 4. TABLA: incapacidades
-- Normativa CR: CCSS (Enfermedad común/maternidad) o INS (Riesgos del trabajo)
-- ------------------------------------------------------------------------------
CREATE TABLE incapacidades (
    id SERIAL PRIMARY KEY,
    colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    entidad_emisora VARCHAR(10) NOT NULL CHECK (entidad_emisora IN ('CCSS', 'INS')),
    codigo_boleta VARCHAR(50) UNIQUE NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_totales INT NOT NULL CHECK (dias_totales > 0),
    diagnostico VARCHAR(200) NOT NULL,
    subsidio_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 60.00, -- 60% legal CCSS a partir de día 4
    estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'finalizada')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fechas_incapacidad CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_incapacidades_colaborador ON incapacidades(colaborador_id);
CREATE INDEX idx_incapacidades_estado ON incapacidades(estado);
CREATE INDEX idx_incapacidades_rango ON incapacidades(fecha_inicio, fecha_fin);

-- ------------------------------------------------------------------------------
-- 5. TABLA: movimientos_personal
-- ------------------------------------------------------------------------------
CREATE TABLE movimientos_personal (
    id SERIAL PRIMARY KEY,
    colaborador_id INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(40) NOT NULL CHECK (tipo_movimiento IN (
        'ingreso', 
        'salida_renuncia', 
        'salida_despido_con_responsabilidad', 
        'salida_despido_sin_responsabilidad', 
        'promocion', 
        'cambio_departamento', 
        'ajuste_salarial'
    )),
    fecha_movimiento DATE NOT NULL,
    detalle TEXT NOT NULL,
    departamento_anterior VARCHAR(80),
    departamento_nuevo VARCHAR(80),
    salario_anterior NUMERIC(12, 2),
    salario_nuevo NUMERIC(12, 2),
    registrado_por INT REFERENCES colaboradores(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movimientos_colaborador ON movimientos_personal(colaborador_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_personal(fecha_movimiento);
CREATE INDEX idx_movimientos_tipo ON movimientos_personal(tipo_movimiento);

-- ------------------------------------------------------------------------------
-- 6. TABLA: consultas_chat
-- ------------------------------------------------------------------------------
CREATE TABLE consultas_chat (
    id SERIAL PRIMARY KEY,
    colaborador_id INT REFERENCES colaboradores(id) ON DELETE SET NULL,
    sesion_id VARCHAR(100) NOT NULL,
    mensaje_usuario TEXT NOT NULL,
    respuesta_agente TEXT NOT NULL,
    agente_resolutor VARCHAR(50) NOT NULL CHECK (agente_resolutor IN (
        'orquestador', 
        'politicas_rag', 
        'datos_personales', 
        'mixto', 
        'rechazado_fuera_de_ambito', 
        'bloqueo_seguridad'
    )),
    resolucion_exitosa BOOLEAN NOT NULL DEFAULT TRUE,
    fuentes_citadas JSONB DEFAULT '[]'::jsonb,
    duracion_ms INT,
    fecha_consulta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consultas_colaborador ON consultas_chat(colaborador_id);
CREATE INDEX idx_consultas_fecha ON consultas_chat(fecha_consulta);
CREATE INDEX idx_consultas_agente ON consultas_chat(agente_resolutor);

-- ------------------------------------------------------------------------------
-- 7. TABLA: reportes_diarios
-- Ejecutado a las 7:00 a. m. por el Agente Analista
-- ------------------------------------------------------------------------------
CREATE TABLE reportes_diarios (
    id SERIAL PRIMARY KEY,
    fecha_reporte DATE NOT NULL UNIQUE,
    hora_generacion TIME NOT NULL DEFAULT '07:00:00',
    total_ausencias INT NOT NULL DEFAULT 0,
    solicitudes_pendientes INT NOT NULL DEFAULT 0,
    solicitudes_pendientes_criticas INT NOT NULL DEFAULT 0, -- Pendientes > 3 días
    incapacidades_activas INT NOT NULL DEFAULT 0,
    ingresos_mes INT NOT NULL DEFAULT 0,
    salidas_mes INT NOT NULL DEFAULT 0,
    colaboradores_vacaciones_acumuladas INT NOT NULL DEFAULT 0, -- Con > 20 días acumulados
    total_consultas_chat INT NOT NULL DEFAULT 0,
    tasa_resolucion_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    top_temas_consultados JSONB NOT NULL DEFAULT '[]'::jsonb,
    preguntas_sin_respuesta JSONB NOT NULL DEFAULT '[]'::jsonb,
    resumen_ejecutivo TEXT NOT NULL,
    datos_analiticos_sql JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reportes_fecha ON reportes_diarios(fecha_reporte);

-- ------------------------------------------------------------------------------
-- 8. TABLA: documentos_chunks (Base Vectorial RAG con pgvector)
-- ------------------------------------------------------------------------------
CREATE TABLE documentos_chunks (
    id SERIAL PRIMARY KEY,
    documento_id VARCHAR(100) NOT NULL, -- ID en Drive o identificador único
    documento_titulo VARCHAR(200) NOT NULL,
    seccion VARCHAR(150) NOT NULL,
    url_drive TEXT NOT NULL,
    chunk_index INT NOT NULL,
    contenido TEXT NOT NULL,
    embedding vector(768), -- Dimensión para modelos Gemini text-embedding-004
    tokens_aprox INT,
    hash_contenido VARCHAR(64) NOT NULL,
    metadatos JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_chunk UNIQUE (documento_id, chunk_index)
);

CREATE INDEX idx_chunks_documento ON documentos_chunks(documento_id);
-- Índice vectorial IVFFlat / HNSW para acelerar búsqueda semántica
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_cosine ON documentos_chunks USING hnsw (embedding vector_cosine_ops);

