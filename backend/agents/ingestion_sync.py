"""
Agente 5: Ingesta y Sincronización de Documentos
Responsabilidad:
- Conectarse a Google Drive (y carpeta sincronizada).
- Extraer texto de documentos de políticas.
- Dividir en fragmentos (chunks) conservando encabezados y secciones.
- Calcular embeddings vectoriales (Gemini text-embedding-004 de 768 dimensiones).
- Almacenar los fragmentos en PostgreSQL / pgvector.
- Detectar documentos nuevos, modificados y eliminados mediante hash SHA-256.
"""

import os
import re
import hashlib
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from backend.database.connection import SessionLocal
from backend.database.models import DocumentoChunk
from backend.services.drive_service import GoogleDriveService

load_dotenv()
logger = logging.getLogger("agente_ingesta")
logging.basicConfig(level=logging.INFO)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")

class AgenteIngestaSincronizacion:
    def __init__(self, drive_service: Optional[GoogleDriveService] = None):
        self.drive_service = drive_service or GoogleDriveService()
        self.embedding_client = None
        self._init_embedding_client()

    def _init_embedding_client(self):
        """Inicializa el cliente de embeddings de Google Gemini si existe API Key"""
        if GEMINI_API_KEY and GEMINI_API_KEY != "tu_clave_de_gemini_aqui":
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                self.embedding_client = genai
                logger.info("Cliente de Gemini Embeddings inicializado correctamente.")
            except Exception as e:
                logger.warning(f"Error configurando Gemini Embeddings: {e}")
                self.embedding_client = None
        else:
            logger.info("GEMINI_API_KEY no configurada. Se utilizará generador vectorial determinista de respaldo.")
            self.embedding_client = None

    def generar_embedding(self, texto: str) -> List[float]:
        """
        Genera el vector de embedding de 768 dimensiones.
        Utiliza Google Gemini text-embedding-004, o un vector determinista si no hay API Key.
        """
        if self.embedding_client:
            try:
                resultado = self.embedding_client.embed_content(
                    model=EMBEDDING_MODEL,
                    content=texto,
                    task_type="retrieval_document"
                )
                embedding = resultado.get("embedding", [])
                if embedding and len(embedding) == 768:
                    return embedding
                elif embedding:
                    # Ajustar dimensión si el modelo devuelve diferente tamaño
                    return embedding[:768] + [0.0] * max(0, 768 - len(embedding))
            except Exception as e:
                logger.warning(f"Fallo al llamar API de Gemini para embedding: {e}. Usando vector de respaldo.")

        # Generador vectorial determinista de 768 dimensiones (para entornos sin conexión / tests)
        import math
        vec = [0.0] * 768
        palabras = re.findall(r'\w+', texto.lower())
        for palabra in palabras:
            h = int(hashlib.md5(palabra.encode('utf-8')).hexdigest(), 16)
            idx = h % 768
            vec[idx] += 1.0
        
        # Normalización L2
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        else:
            vec[0] = 1.0
        return vec

    def segmentar_documento(self, texto: str, max_chunk_size: int = 700, overlap: int = 100) -> List[Dict[str, Any]]:
        """
        Divide el documento en fragmentos inteligentes respetando encabezados Markdown.
        Registra la sección actual para generar citas precisas en el RAG.
        """
        lineas = texto.split("\n")
        chunks = []
        seccion_actual = "Introducción y Aspectos Generales"
        buffer_texto = []
        buffer_len = 0

        for linea in lineas:
            linea_strip = linea.strip()
            # Detectar encabezados Markdown (#, ##, ###)
            if re.match(r"^#{1,3}\s+", linea_strip):
                # Si hay texto acumulado suficiente, guardar chunk previo
                if buffer_len > 150:
                    contenido_chunk = "\n".join(buffer_texto).strip()
                    chunks.append({
                        "seccion": seccion_actual,
                        "contenido": contenido_chunk
                    })
                    # Mantener solapamiento (overlap)
                    buffer_texto = buffer_texto[-2:] if len(buffer_texto) >= 2 else []
                    buffer_len = sum(len(l) for l in buffer_texto)
                
                # Actualizar la sección actual
                seccion_actual = re.sub(r"^#{1,3}\s+", "", linea_strip)

            buffer_texto.append(linea)
            buffer_len += len(linea)

            # Si se excede el tamaño máximo del chunk
            if buffer_len >= max_chunk_size:
                contenido_chunk = "\n".join(buffer_texto).strip()
                chunks.append({
                    "seccion": seccion_actual,
                    "contenido": contenido_chunk
                })
                # Aplicar solapamiento
                ultimas_lineas = []
                acum = 0
                for l in reversed(buffer_texto):
                    if acum + len(l) < overlap:
                        ultimas_lineas.insert(0, l)
                        acum += len(l)
                    else:
                        break
                buffer_texto = ultimas_lineas
                buffer_len = sum(len(l) for l in buffer_texto)

        # Último chunk restante
        if buffer_texto and buffer_len > 30:
            chunks.append({
                "seccion": seccion_actual,
                "contenido": "\n".join(buffer_texto).strip()
            })

        return chunks

    def sincronizar(self, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Ejecuta el ciclo completo de ingesta y sincronización:
        1. Lista documentos en Drive / local.
        2. Detecta documentos nuevos y modificados mediante hash SHA-256.
        3. Segmenta y calcula embeddings vectoriales.
        4. Inserta o actualiza en la tabla 'documentos_chunks'.
        5. Elimina fragmentos de documentos despublicados.
        """
        debe_cerrar = False
        if db is None:
            db = SessionLocal()
            debe_cerrar = True

        reporte = {
            "documentos_procesados": 0,
            "documentos_nuevos": 0,
            "documentos_actualizados": 0,
            "documentos_sin_cambio": 0,
            "chunks_totales_indexados": 0,
            "errores": []
        }

        try:
            documentos = self.drive_service.listar_documentos()
            logger.info(f"Iniciando ingesta y sincronización de {len(documentos)} documentos...")

            ids_documentos_activos = set()

            for doc in documentos:
                doc_id = doc["id"]
                doc_titulo = doc["titulo"]
                url_drive = doc["url_drive"]
                ids_documentos_activos.add(doc_id)

                contenido_completo = self.drive_service.descargar_contenido_texto(doc)
                if not contenido_completo.strip():
                    continue

                hash_doc = hashlib.sha256(contenido_completo.encode("utf-8")).hexdigest()

                # Verificar si ya existen chunks para este documento y si su hash ha cambiado
                chunks_existentes = db.query(DocumentoChunk).filter(DocumentoChunk.documento_id == doc_id).all()
                if chunks_existentes:
                    hash_primer_chunk = chunks_existentes[0].metadatos.get("doc_hash", "") if chunks_existentes[0].metadatos else ""
                    if hash_primer_chunk == hash_doc:
                        # El documento no ha sufrido modificaciones
                        reporte["documentos_sin_cambio"] += 1
                        reporte["chunks_totales_indexados"] += len(chunks_existentes)
                        continue
                    else:
                        # El documento fue modificado: eliminar chunks viejos para re-indexar
                        db.query(DocumentoChunk).filter(DocumentoChunk.documento_id == doc_id).delete()
                        db.commit()
                        reporte["documentos_actualizados"] += 1
                else:
                    reporte["documentos_nuevos"] += 1

                # Segmentar en fragmentos
                fragmentos = self.segmentar_documento(contenido_completo)
                logger.info(f"Procesando '{doc_titulo}': {len(fragmentos)} fragmentos generados.")

                for idx, frag in enumerate(fragmentos):
                    seccion = frag["seccion"]
                    texto_chunk = frag["contenido"]
                    hash_chunk = hashlib.sha256(texto_chunk.encode("utf-8")).hexdigest()

                    # Calcular embedding vectorial (768 dimensiones)
                    embedding_vec = self.generar_embedding(texto_chunk)

                    nuevo_chunk = DocumentoChunk(
                        documento_id=doc_id,
                        documento_titulo=doc_titulo,
                        seccion=seccion,
                        url_drive=url_drive,
                        chunk_index=idx,
                        contenido=texto_chunk,
                        embedding=embedding_vec,
                        tokens_aprox=len(texto_chunk.split()),
                        hash_contenido=hash_chunk,
                        metadatos={
                            "doc_hash": hash_doc,
                            "origen": doc.get("origen", "drive"),
                            "mime_type": doc.get("mime_type", "text/plain")
                        }
                    )
                    db.add(nuevo_chunk)

                db.commit()
                reporte["documentos_procesados"] += 1
                reporte["chunks_totales_indexados"] += len(fragmentos)

            # Eliminar chunks de documentos que ya no existan en la fuente
            if ids_documentos_activos:
                chunks_huerfanos = db.query(DocumentoChunk).filter(
                    ~DocumentoChunk.documento_id.in_(list(ids_documentos_activos))
                ).delete(synchronize_session=False)
                if chunks_huerfanos > 0:
                    logger.info(f"Se eliminaron {chunks_huerfanos} chunks de documentos obsoletos.")
                    db.commit()

            logger.info(f"Sincronización completada exitosamente: {reporte}")
            return reporte

        except Exception as e:
            db.rollback()
            logger.error(f"Error en proceso de sincronización: {e}")
            reporte["errores"].append(str(e))
            return reporte
        finally:
            if debe_cerrar:
                db.close()

if __name__ == "__main__":
    agente = AgenteIngestaSincronizacion()
    res = agente.sincronizar()
    print("Resultado de sincronización:", res)

