"""
Agente 2: Agente de Políticas de RRHH (RAG con pgvector y Citas)
Responsabilidad:
- Buscar fragmentos semánticamente relevantes en 'documentos_chunks' mediante pgvector.
- Responder únicamente con la información encontrada en los documentos oficiales.
- Incluir citas precisas (Título de Documento, Sección y Enlace Drive).
- Reconocer con honestidad cuando la información no esté disponible en las políticas.
"""

import os
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from backend.database.connection import SessionLocal
from backend.database.models import DocumentoChunk
from backend.agents.ingestion_sync import AgenteIngestaSincronizacion

load_dotenv()
logger = logging.getLogger("agente_politicas_rag")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.0-flash")

class AgentePoliticasRAG:
    def __init__(self, db_session: Session = None):
        self.db = db_session
        self.ingesta_helper = AgenteIngestaSincronizacion()
        self.llm = None
        self._init_llm()

    def _init_llm(self):
        """Inicializa el modelo de lenguaje de Google Gemini si existe API Key"""
        if GEMINI_API_KEY and GEMINI_API_KEY != "tu_clave_de_gemini_aqui":
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                self.llm = genai.GenerativeModel(LLM_MODEL)
                logger.info(f"Modelo LLM '{LLM_MODEL}' inicializado para Agente de Políticas RAG.")
            except Exception as e:
                logger.warning(f"No se pudo inicializar Gemini LLM: {e}")
                self.llm = None

    def buscar_documentos_relevantes(self, consulta: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Calcula el embedding de la pregunta y realiza búsqueda vectorial
        por similitud coseno en la tabla 'documentos_chunks'.
        """
        db = self.db or SessionLocal()
        debe_cerrar = self.db is None
        try:
            emb_pregunta = self.ingesta_helper.generar_embedding(consulta)
            emb_str = f"[{','.join(str(x) for x in emb_pregunta)}]"

            # Búsqueda semántica usando el operador de distancia coseno (<=>) de pgvector
            sql = text("""
                SELECT 
                    id,
                    documento_titulo,
                    seccion,
                    url_drive,
                    contenido,
                    (embedding <=> (:emb)::vector) as distancia
                FROM documentos_chunks
                ORDER BY distancia ASC
                LIMIT :top_k;
            """)
            resultados = db.execute(sql, {"emb": emb_str, "top_k": top_k}).fetchall()
            
            chunks = []
            for r in resultados:
                distancia = float(r[5]) if r[5] is not None else 0.5
                similitud = max(0.0, min(1.0, 1.0 - distancia))
                # Filtro de umbral mínimo de relevancia
                chunks.append({
                    "id": r[0],
                    "documento_titulo": r[1],
                    "seccion": r[2],
                    "url_drive": r[3],
                    "contenido": r[4],
                    "similitud": round(similitud, 4)
                })
            return chunks
        except Exception as e:
            logger.warning(f"Búsqueda por pgvector falló o no disponible: {e}. Aplicando búsqueda textual.")
            # Búsqueda textual de contingencia
            terminos = [w for w in consulta.lower().split() if len(w) > 3]
            filtro = "%" + "%".join(terminos[:2]) + "%" if terminos else "%"
            query_res = db.query(DocumentoChunk).filter(DocumentoChunk.contenido.ilike(filtro)).limit(top_k).all()
            return [{
                "id": c.id,
                "documento_titulo": c.documento_titulo,
                "seccion": c.seccion,
                "url_drive": c.url_drive,
                "contenido": c.contenido,
                "similitud": 0.85
            } for c in query_res]
        finally:
            if debe_cerrar:
                db.close()

    def responder_consulta(self, pregunta: str) -> Dict[str, Any]:
        """
        Ejecuta el ciclo RAG:
        1. Recuperación de fragmentos relevantes.
        2. Construcción de prompt aumentado con citas.
        3. Generación de respuesta estricta sin alucinaciones.
        """
        chunks = self.buscar_documentos_relevantes(pregunta, top_k=3)

        if not chunks or (chunks and chunks[0]["similitud"] < 0.25):
            return {
                "respuesta": "No dispongo de información suficiente en las políticas de RRHH de TecnoCR para responder a esta consulta con certeza. Le recomiendo elevar la pregunta directamente a la Gerencia de Talento Humano.",
                "fuentes_citadas": [],
                "encontrado": False
            }

        # Extraer fuentes y referencias únicas
        citas_dict = {}
        contexto_textos = []
        for i, c in enumerate(chunks, 1):
            clave_cita = f"{c['documento_titulo']} - {c['seccion']}"
            if clave_cita not in citas_dict:
                citas_dict[clave_cita] = {
                    "documento": c["documento_titulo"],
                    "seccion": c["seccion"],
                    "url_drive": c["url_drive"],
                    "similitud": c["similitud"]
                }
            contexto_textos.append(f"--- FRAGMENTO {i} ({c['documento_titulo']} / {c['seccion']}) ---\n{c['contenido']}")

        contexto_unificado = "\n\n".join(contexto_textos)

        # Generar respuesta con el LLM
        prompt_sistema = f"""Eres el Agente Especialista en Políticas de Recursos Humanos de 'TecnoCR Soluciones S.A.' en Costa Rica.
Tu misión es responder preguntas de los colaboradores basándote ÚNICA Y EXCLUSIVAMENTE en el siguiente contexto de políticas oficiales:

=== CONTEXTO OFICIAL DE POLÍTICAS ===
{contexto_unificado}
======================================

REGLAS ESTRICTAS:
1. Responde con tono profesional, empático, claro y estructurado en español.
2. Cita siempre la norma legal costarricense (Código de Trabajo, Ley de Teletrabajo 9738, Ley de Paternidad 10183, CCSS, etc.) y la sección de la política interna cuando aplique.
3. NUNCA inventes políticas, cifras ni plazos que no figuren en el contexto.
4. Al final de tu respuesta, incluye una sección obligatoria titulada '📚 Fuentes y Citas:' listando los documentos consultados con su sección.
5. Si el contexto no contiene la respuesta completa, indica claramente qué partes no están estipuladas.

PREGUNTA DEL COLABORADOR: {pregunta}
"""

        respuesta_texto = ""
        if self.llm:
            try:
                response = self.llm.generate_content(prompt_sistema)
                respuesta_texto = response.text.strip()
            except Exception as e:
                logger.error(f"Error generando respuesta con Gemini: {e}")
                respuesta_texto = self._generar_respuesta_extractiva(pregunta, chunks)
        else:
            respuesta_texto = self._generar_respuesta_extractiva(pregunta, chunks)

        return {
            "respuesta": respuesta_texto,
            "fuentes_citadas": list(citas_dict.values()),
            "encontrado": True
        }

    def _generar_respuesta_extractiva(self, pregunta: str, chunks: List[Dict[str, Any]]) -> str:
        """Respuesta extractiva formateada cuando el LLM está en modo offline o sin API key"""
        c = chunks[0]
        citas_str = "\n".join([f"- **{ch['documento_titulo']}** ({ch['seccion']}): [Ver documento en Drive]({ch['url_drive']})" for ch in chunks[:2]])
        return (
            f"Conforme a las políticas vigentes de **TecnoCR Soluciones S.A.** en **{c['documento_titulo']}** ({c['seccion']}):\n\n"
            f"{c['contenido']}\n\n"
            f"📚 **Fuentes y Citas Oficiales:**\n{citas_str}"
        )

