/**
 * Agente 5: Ingesta y Sincronización en JavaScript
 * Lee los 10 documentos de políticas en docs_politicas/
 * Divide en fragmentos respetando encabezados y secciones
 * Genera embeddings vectoriales de 768 dimensiones
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.join(__dirname, '..', '..', 'docs_politicas');
const INDEX_FILE = path.join(__dirname, '..', 'database', 'chunks_index.json');

export class AgenteIngestaSincronizacionJS {
  generarEmbedding(texto) {
    const vec = new Array(768).fill(0);
    const palabras = texto.toLowerCase().match(/\b\w+\b/g) || [];
    for (const palabra of palabras) {
      const h = parseInt(crypto.createHash('md5').update(palabra).digest('hex').slice(0, 8), 16);
      vec[h % 768] += 1.0;
    }
    const norm = Math.sqrt(vec.reduce((acc, x) => acc + x * x, 0));
    if (norm > 0) {
      for (let i = 0; i < 768; i++) vec[i] /= norm;
    } else {
      vec[0] = 1.0;
    }
    return vec;
  }

  sincronizar() {
    if (!fs.existsSync(DOCS_DIR)) {
      console.warn(`[Ingesta] Carpeta ${DOCS_DIR} no encontrada.`);
      return { total: 0 };
    }

    const archivos = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
    const chunks = [];

    for (const archivo of archivos) {
      const ruta = path.join(DOCS_DIR, archivo);
      const contenido = fs.readFileSync(ruta, 'utf-8');
      const docTitulo = archivo.replace(/^\d+_/, '').replace('.md', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const docId = `gdrive_doc_${crypto.createHash('md5').update(archivo).digest('hex').slice(0, 10)}`;
      const urlDrive = `https://drive.google.com/file/d/${docId}/view?usp=sharing`;

      const lineas = contenido.split('\n');
      let seccionActual = "Introducción y Aspectos Generales";
      let buffer = [];

      for (const linea of lineas) {
        if (/^#{1,3}\s+/.test(linea.trim())) {
          if (buffer.join('\n').trim().length > 150) {
            const textoChunk = buffer.join('\n').trim();
            chunks.push({
              documento_id: docId,
              documento_titulo: docTitulo,
              seccion: seccionActual,
              url_drive: urlDrive,
              contenido: textoChunk,
              embedding: this.generarEmbedding(textoChunk)
            });
            buffer = buffer.slice(-2);
          }
          seccionActual = linea.trim().replace(/^#{1,3}\s+/, '');
        }
        buffer.push(linea);

        if (buffer.join('\n').length >= 700) {
          const textoChunk = buffer.join('\n').trim();
          chunks.push({
            documento_id: docId,
            documento_titulo: docTitulo,
            seccion: seccionActual,
            url_drive: urlDrive,
            contenido: textoChunk,
            embedding: this.generarEmbedding(textoChunk)
          });
          buffer = buffer.slice(-2);
        }
      }

      if (buffer.join('\n').trim().length > 40) {
        const textoChunk = buffer.join('\n').trim();
        chunks.push({
          documento_id: docId,
          documento_titulo: docTitulo,
          seccion: seccionActual,
          url_drive: urlDrive,
          contenido: textoChunk,
          embedding: this.generarEmbedding(textoChunk)
        });
      }
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify(chunks, null, 2), 'utf-8');
    console.log(`[Ingesta] ${archivos.length} documentos indexados en ${chunks.length} fragmentos vectoriales.`);
    return { documentos: archivos.length, chunks: chunks.length };
  }

  indexarDocumentosDrive(documentosLista) {
    let chunks = [];
    if (fs.existsSync(INDEX_FILE)) {
      try {
        chunks = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
      } catch (e) {
        chunks = [];
      }
    }

    let nuevosChunks = 0;
    for (const doc of documentosLista) {
      // Eliminar chunks viejos de este documento si ya existían
      chunks = chunks.filter(c => c.documento_id !== doc.id && c.documento_titulo !== doc.titulo);

      const lineas = (doc.contenido || '').split('\n');
      let seccionActual = "General";
      let buffer = [];

      for (const linea of lineas) {
        if (/^#{1,3}\s+/.test(linea.trim())) {
          if (buffer.join('\n').trim().length > 150) {
            const textoChunk = buffer.join('\n').trim();
            chunks.push({
              documento_id: doc.id,
              documento_titulo: doc.titulo,
              seccion: seccionActual,
              url_drive: doc.url_drive,
              contenido: textoChunk,
              embedding: this.generarEmbedding(textoChunk)
            });
            nuevosChunks++;
            buffer = buffer.slice(-2);
          }
          seccionActual = linea.trim().replace(/^#{1,3}\s+/, '');
        }
        buffer.push(linea);

        if (buffer.join('\n').length >= 700) {
          const textoChunk = buffer.join('\n').trim();
          chunks.push({
            documento_id: doc.id,
            documento_titulo: doc.titulo,
            seccion: seccionActual,
            url_drive: doc.url_drive,
            contenido: textoChunk,
            embedding: this.generarEmbedding(textoChunk)
          });
          nuevosChunks++;
          buffer = buffer.slice(-2);
        }
      }

      if (buffer.join('\n').trim().length > 40) {
        const textoChunk = buffer.join('\n').trim();
        chunks.push({
          documento_id: doc.id,
          documento_titulo: doc.titulo,
          seccion: seccionActual,
          url_drive: doc.url_drive,
          contenido: textoChunk,
          embedding: this.generarEmbedding(textoChunk)
        });
        nuevosChunks++;
      }
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify(chunks, null, 2), 'utf-8');
    console.log(`[Ingesta Drive] Sincronizados ${documentosLista.length} docs (${nuevosChunks} fragmentos indexados).`);
    return { documentos: documentosLista.length, chunks: chunks.length };
  }
}

