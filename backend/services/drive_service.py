"""
Servicio de Integración con Google Drive API v3
Maneja la autenticación y descarga de documentos (Google Docs, PDFs, hojas de cálculo)
desde una carpeta de Google Drive, con soporte de respaldo (fallback) local.
"""

import os
import io
import hashlib
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("drive_service")

class GoogleDriveService:
    def __init__(self, folder_id: Optional[str] = None, credentials_path: Optional[str] = None):
        self.folder_id = folder_id or os.getenv("GOOGLE_DRIVE_FOLDER_ID", "local_folder_mock")
        self.credentials_path = credentials_path or os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
        self.service = None
        self._init_client()

    def _init_client(self):
        """Intenta inicializar el cliente oficial de Google Drive si existen credenciales"""
        if os.path.exists(self.credentials_path):
            try:
                from google.oauth2 import service_account
                from googleapiclient.discovery import build
                
                creds = service_account.Credentials.from_service_account_file(
                    self.credentials_path,
                    scopes=['https://www.googleapis.com/auth/drive.readonly']
                )
                self.service = build('drive', 'v3', credentials=creds)
                logger.info("Cliente de Google Drive API v3 autenticado con éxito.")
            except Exception as e:
                logger.warning(f"No se pudo inicializar Google Drive API: {e}. Se utilizará el repositorio local sincronizado.")
                self.service = None
        else:
            logger.info("No se encontró archivo de credenciales de Google Drive. Operando en modo sincronizado local.")

    def listar_documentos(self, local_dir: str = "docs_politicas") -> List[Dict[str, Any]]:
        """
        Lista los documentos disponibles. Si hay conexión activa a Google Drive API,
        obtiene los archivos de la nube; de lo contrario, lee la carpeta local de políticas.
        """
        documentos = []

        # 1. Intentar con Google Drive API si está activo
        if self.service and self.folder_id and self.folder_id != "local_folder_mock":
            try:
                query = f"'{self.folder_id}' in parents and trashed = false"
                results = self.service.files().list(
                    q=query,
                    fields="files(id, name, mimeType, modifiedTime, webViewLink)"
                ).execute()
                items = results.get('files', [])
                for item in items:
                    documentos.append({
                        "id": item["id"],
                        "titulo": item["name"],
                        "mime_type": item["mimeType"],
                        "url_drive": item.get("webViewLink", f"https://drive.google.com/file/d/{item['id']}/view"),
                        "origen": "google_drive"
                    })
                if documentos:
                    logger.info(f"Se obtuvieron {len(documentos)} documentos desde Google Drive.")
                    return documentos
            except Exception as e:
                logger.error(f"Error listando archivos de Google Drive: {e}. Pasando a carpeta local.")

        # 2. Respaldo: Leer archivos de la carpeta local de políticas
        if os.path.exists(local_dir):
            archivos = sorted(os.listdir(local_dir))
            for idx, nombre in enumerate(archivos):
                if nombre.endswith((".md", ".txt", ".pdf", ".docx")):
                    ruta_completa = os.path.join(local_dir, nombre)
                    # ID simulado de Drive consistente basado en hash del nombre
                    doc_id = f"gdrive_doc_{hashlib.md5(nombre.encode('utf-8')).hexdigest()[:12]}"
                    
                    # Generar enlace Drive simulado o real
                    titulo_limpio = nombre.replace(".md", "").replace("_", " ").title()
                    url_drive = f"https://drive.google.com/file/d/{doc_id}/view?usp=sharing"
                    
                    documentos.append({
                        "id": doc_id,
                        "titulo": titulo_limpio,
                        "nombre_archivo": nombre,
                        "ruta_local": ruta_completa,
                        "mime_type": "text/markdown" if nombre.endswith(".md") else "application/pdf",
                        "url_drive": url_drive,
                        "origen": "local_synced"
                    })
            logger.info(f"Se indexaron {len(documentos)} documentos desde el directorio local '{local_dir}'.")

        return documentos

    def descargar_contenido_texto(self, doc_info: Dict[str, Any]) -> str:
        """
        Descarga o lee el contenido textual del documento según su tipo y origen.
        """
        # Si proviene de la carpeta local sincronizada
        if doc_info.get("origen") == "local_synced" or "ruta_local" in doc_info:
            ruta = doc_info["ruta_local"]
            if ruta.endswith((".md", ".txt")):
                with open(ruta, "r", encoding="utf-8") as f:
                    return f.read()
            elif ruta.endswith(".pdf"):
                try:
                    import pypdf
                    reader = pypdf.PdfReader(ruta)
                    texto = "\n".join([page.extract_text() or "" for page in reader.pages])
                    return texto
                except Exception as e:
                    logger.error(f"Error leyendo PDF {ruta}: {e}")
                    return ""

        # Si proviene de Google Drive API
        if self.service and doc_info.get("origen") == "google_drive":
            doc_id = doc_info["id"]
            mime = doc_info["mime_type"]
            try:
                # Si es un Google Doc nativo, exportar a texto plano
                if mime == "application/vnd.google-apps.document":
                    request = self.service.files().export_media(fileId=doc_id, mimeType="text/plain")
                    contenido = request.execute()
                    return contenido.decode("utf-8", errors="replace")
                else:
                    # Descargar binario directo
                    from googleapiclient.http import MediaIoBaseDownload
                    request = self.service.files().get_media(fileId=doc_id)
                    fh = io.BytesIO()
                    downloader = MediaIoBaseDownload(fh, request)
                    done = False
                    while not done:
                        status, done = downloader.next_chunk()
                    fh.seek(0)
                    return fh.read().decode("utf-8", errors="replace")
            except Exception as e:
                logger.error(f"Error descargando documento de Drive {doc_id}: {e}")
                return ""

        return ""

