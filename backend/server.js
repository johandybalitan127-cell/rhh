/**
 * Servidor Backend en JavaScript (Node.js)
 * Mini Proyecto #2 - Portal de RRHH con RAG Multiagente (Costa Rica)
 * Diseñado con el módulo HTTP nativo de Node.js para arrancar instantáneamente
 * sin requerir dependencias complejas ni compiladores externos.
 */

import http from 'http';
import url from 'url';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { obtenerBD, guardarBD, verifyPassword, inicializarBaseDatos } from './database/store.js';
import { AgenteOrquestadorJS } from './agents/orchestrator.js';
import { AgenteAnalistaReportesJS } from './agents/reportAnalyst.js';
import { AgenteIngestaSincronizacionJS } from './agents/ingestionSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, '..', '.env');
const TOKENS_PATH = path.join(__dirname, 'database', 'google_drive_tokens.json');

// Cargar variables de entorno desde .env
if (fs.existsSync(ENV_PATH)) {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const PORT = 8000;
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY || SECRET_KEY.length < 32) {
  throw new Error("Configura SECRET_KEY con al menos 32 caracteres en el archivo .env.");
}

// Inicializar base de datos e ingesta de políticas
console.log("==================================================================");
console.log("  🏢 INICIANDO BACKEND EN JAVASCRIPT - TECNOCR SOLUCIONES (CR)");
console.log("==================================================================");
inicializarBaseDatos();

const ingesta = new AgenteIngestaSincronizacionJS();
ingesta.sincronizar();

const orquestador = new AgenteOrquestadorJS();
const analista = new AgenteAnalistaReportesJS();

// Generar reporte inicial de las 7:00 AM si no existe
analista.generarReporte();

// Programar tarea diaria automática a las 7:00 a. m.
setInterval(() => {
  const ahora = new Date();
  if (ahora.getHours() === 7 && ahora.getMinutes() === 0) {
    console.log("⏰ [Cron] Ejecutando reporte diario de las 7:00 a. m...");
    analista.generarReporte();
  }
}, 60000);

// Funciones auxiliares para tokens JWT
function crearToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (8 * 3600) })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verificarToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [header, data, signature] = partes;
  const validSignature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${data}`).digest('base64url');
  if (signature !== validSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// --------------------------------------------------------------------------
// Utilidades Google Drive API
// --------------------------------------------------------------------------
async function obtenerGoogleAccessToken() {
  if (!fs.existsSync(TOKENS_PATH)) return null;
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
    const obtenido = new Date(tokens.obtained_at || 0).getTime();
    const expiraEnMs = (tokens.expires_in || 3600) * 1000;
    const ahora = Date.now();

    // Refrescar si faltan menos de 5 minutos o ya expiró
    if (ahora - obtenido > expiraEnMs - 300000 && tokens.refresh_token) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: tokens.refresh_token,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          grant_type: 'refresh_token'
        })
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        tokens.access_token = refreshData.access_token;
        tokens.obtained_at = new Date().toISOString();
        if (refreshData.expires_in) tokens.expires_in = refreshData.expires_in;
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
      }
    }
    return tokens.access_token;
  } catch (e) {
    console.error("Error obteniendo token de Google:", e);
    return null;
  }
}

async function subirArchivoGoogleDrive(nombre, contenido, mimeType = 'text/markdown') {
  const token = await obtenerGoogleAccessToken();
  if (!token) throw new Error("No hay sesión autorizada con Google Drive.");

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1UB52cLslWSnk731YZ0a00duzRDC5YPiZ';
  const boundary = `-------tecnocr_drive_boundary_${Date.now()}`;
  const metadata = JSON.stringify({
    name: nombre,
    parents: [folderId],
    description: "Documento oficial de Recursos Humanos - TecnoCR Soluciones"
  });

  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileContent = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf-8');
  const multipartBody = Buffer.concat([
    Buffer.from(
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`,
      'utf-8'
    ),
    fileContent,
    Buffer.from(closeDelimiter, 'utf-8')
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,modifiedTime', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Error al subir a Google Drive");
  }
  return data;
}

// Leer cuerpo JSON de la petición
function leerBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  // Encabezados de CORS para React + Vite
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  const sendJSON = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  try {
    // --------------------------------------------------------------------------
    // 1. AUTENTICACIÓN: POST /api/auth/login
    // --------------------------------------------------------------------------
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await leerBody(req);
      const { email, password } = body;
      const db = obtenerBD();

      const user = db.colaboradores.find(c => c.email.toLowerCase() === (email || '').toLowerCase().trim());
      if (!user || !verifyPassword(password, user.contrasena_hash)) {
        return sendJSON(401, { detail: "Correo electrónico o contraseña incorrectos." });
      }

      if (user.estado === 'inactivo') {
        return sendJSON(403, { detail: "Su cuenta se encuentra inactiva." });
      }

      const token = crearToken({ sub: user.id, rol: user.rol, email: user.email });
      return sendJSON(200, {
        access_token: token,
        token_type: "bearer",
        user: {
          id: user.id,
          cedula: user.cedula,
          nombre_completo: user.nombre_completo,
          email: user.email,
          puesto: user.puesto,
          departamento: user.departamento,
          rol: user.rol,
          modalidad: user.modalidad
        }
      });
    }

    // --------------------------------------------------------------------------
    // 2. PERFIL: GET /api/auth/me
    // --------------------------------------------------------------------------
    if (pathname === '/api/auth/me' && method === 'GET') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Token inválido o expirado." });

      const db = obtenerBD();
      const user = db.colaboradores.find(c => c.id === payload.sub);
      if (!user) return sendJSON(404, { detail: "Usuario no encontrado." });

      return sendJSON(200, {
        id: user.id,
        cedula: user.cedula,
        nombre_completo: user.nombre_completo,
        email: user.email,
        puesto: user.puesto,
        departamento: user.departamento,
        rol: user.rol,
        modalidad: user.modalidad
      });
    }

    // --------------------------------------------------------------------------
    // 3. CHATBOT: POST /api/chat/message
    // --------------------------------------------------------------------------
    if (pathname === '/api/chat/message' && method === 'POST') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Autenticación requerida." });

      const body = await leerBody(req);
      const pregunta = body.pregunta || "";
      const sesionId = body.sesion_id || "sesion-default";

      const resultado = await orquestador.procesarMensaje(pregunta, payload.sub, sesionId);
      return sendJSON(200, resultado);
    }

    // --------------------------------------------------------------------------
    // 4. HISTORIAL CHAT: GET /api/chat/history
    // --------------------------------------------------------------------------
    if (pathname === '/api/chat/history' && method === 'GET') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Autenticación requerida." });

      const db = obtenerBD();
      const misConsultas = db.consultas_chat
        .filter(c => c.colaborador_id === payload.sub)
        .slice(-15);
      return sendJSON(200, misConsultas);
    }

    // --------------------------------------------------------------------------
    // 5. VACACIONES DEL COLABORADOR: GET /api/colaborador/vacaciones
    // --------------------------------------------------------------------------
    if (pathname === '/api/colaborador/vacaciones' && method === 'GET') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Autenticación requerida." });

      const db = obtenerBD();
      let saldo = db.saldos_vacaciones.find(s => s.colaborador_id === payload.sub);
      if (!saldo) {
        saldo = {
          periodo_anual: "2025-2026",
          dias_ganados: 14.0,
          dias_disfrutados: 0.0,
          dias_pendientes: 14.0,
          dias_acumulados_anteriores: 0.0,
          alerta_acumulacion: false
        };
      }
      return sendJSON(200, saldo);
    }

    // --------------------------------------------------------------------------
    // 6. SOLICITUDES DEL COLABORADOR: GET y POST /api/colaborador/solicitudes
    // --------------------------------------------------------------------------
    if (pathname === '/api/colaborador/solicitudes' && method === 'GET') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Autenticación requerida." });

      const db = obtenerBD();
      const misSols = db.solicitudes.filter(s => s.colaborador_id === payload.sub);
      return sendJSON(200, misSols);
    }

    if (pathname === '/api/colaborador/solicitudes' && method === 'POST') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Autenticación requerida." });

      const body = await leerBody(req);
      const db = obtenerBD();
      const colab = db.colaboradores.find(c => c.id === payload.sub);

      const nueva = {
        id: db.solicitudes.length + 1,
        colaborador_id: payload.sub,
        colaborador_nombre: colab?.nombre_completo || "Colaborador",
        departamento: colab?.departamento || "",
        tipo: body.tipo || "vacaciones",
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        dias_solicitados: Number(body.dias_solicitados) || 1,
        motivo: body.motivo || "",
        estado: "pendiente",
        fecha_solicitud: new Date().toISOString().replace('T', ' ').slice(0, 16),
        dias_espera: 0,
        es_critica: false
      };

      db.solicitudes.unshift(nueva);
      guardarBD(db);
      return sendJSON(201, nueva);
    }

    // --------------------------------------------------------------------------
    // 7. DASHBOARD RRHH: GET /api/dashboard/stats
    // --------------------------------------------------------------------------
    if (pathname === '/api/dashboard/stats' && method === 'GET') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload || (payload.rol !== 'rrhh' && payload.rol !== 'administrador')) {
        return sendJSON(403, { detail: "Acceso denegado: rol RRHH requerido." });
      }

      const db = obtenerBD();
      const distDeptos = {};
      const distMod = {};

      db.colaboradores.forEach(c => {
        distDeptos[c.departamento] = (distDeptos[c.departamento] || 0) + 1;
        distMod[c.modalidad] = (distMod[c.modalidad] || 0) + 1;
      });

      return sendJSON(200, {
        total_colaboradores: db.colaboradores.length,
        colaboradores_activos: db.colaboradores.filter(c => c.estado === 'activo').length,
        total_ausencias: db.colaboradores.filter(c => ['incapacitado', 'vacaciones'].includes(c.estado)).length,
        solicitudes_pendientes: db.solicitudes.filter(s => s.estado === 'pendiente').length,
        solicitudes_pendientes_criticas: db.solicitudes.filter(s => s.estado === 'pendiente' && s.dias_espera >= 3).length,
        incapacidades_activas: db.incapacidades.filter(i => i.estado === 'activa').length,
        colaboradores_vacaciones_acumuladas: db.saldos_vacaciones.filter(s => s.dias_pendientes > 20).length,
        ingresos_mes: 3,
        salidas_mes: 1,
        tasa_resolucion_chat: 95.5,
        distribucion_departamentos: distDeptos,
        distribucion_modalidad: distMod
      });
    }

    // --------------------------------------------------------------------------
    // 8. REPORTE DIARIO DE HOY: GET /api/dashboard/reporte-diario/hoy
    // --------------------------------------------------------------------------
    if (pathname === '/api/dashboard/reporte-diario/hoy' && method === 'GET') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload || (payload.rol !== 'rrhh' && payload.rol !== 'administrador')) {
        return sendJSON(403, { detail: "Acceso denegado: rol RRHH requerido." });
      }

      const db = obtenerBD();
      let rep = db.reportes_diarios[0];
      if (!rep) {
        rep = analista.generarReporte();
      }
      return sendJSON(200, rep);
    }

    // --------------------------------------------------------------------------
    // 9. FORZAR GENERACIÓN REPORTE: POST /api/dashboard/reporte-diario/generar
    // --------------------------------------------------------------------------
    if (pathname === '/api/dashboard/reporte-diario/generar' && method === 'POST') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload || (payload.rol !== 'rrhh' && payload.rol !== 'administrador')) {
        return sendJSON(403, { detail: "Acceso denegado: rol RRHH requerido." });
      }

      const rep = analista.generarReporte();
      return sendJSON(200, rep);
    }

    // --------------------------------------------------------------------------
    // 10. BANDEJA SOLICITUDES PENDIENTES: GET /api/dashboard/solicitudes-pendientes
    // --------------------------------------------------------------------------
    if (pathname === '/api/dashboard/solicitudes-pendientes' && method === 'GET') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload || (payload.rol !== 'rrhh' && payload.rol !== 'administrador')) {
        return sendJSON(403, { detail: "Acceso denegado: rol RRHH requerido." });
      }

      const db = obtenerBD();
      const pends = db.solicitudes.filter(s => s.estado === 'pendiente');
      return sendJSON(200, pends);
    }

    // --------------------------------------------------------------------------
    // 11. RESOLVER SOLICITUD: PUT /api/dashboard/solicitudes/:id/resolver
    // --------------------------------------------------------------------------
    if (pathname.startsWith('/api/dashboard/solicitudes/') && pathname.endsWith('/resolver') && method === 'PUT') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload || (payload.rol !== 'rrhh' && payload.rol !== 'administrador')) {
        return sendJSON(403, { detail: "Acceso denegado: rol RRHH requerido." });
      }

      const parts = pathname.split('/');
      const solId = parseInt(parts[4]);
      const body = await leerBody(req);
      const db = obtenerBD();

      const sol = db.solicitudes.find(s => s.id === solId);
      if (!sol) return sendJSON(404, { detail: "Solicitud no encontrada." });

      sol.estado = body.estado || "aprobada";
      if (sol.estado === 'aprobada' && sol.tipo === 'vacaciones') {
        const saldo = db.saldos_vacaciones.find(s => s.colaborador_id === sol.colaborador_id);
        if (saldo) {
          saldo.dias_disfrutados += sol.dias_solicitados;
          saldo.dias_pendientes = Math.max(0, saldo.dias_pendientes - sol.dias_solicitados);
        }
      }

      guardarBD(db);
      return sendJSON(200, { mensaje: `Solicitud #${solId} resuelta como '${sol.estado}'.` });
    }

    // --------------------------------------------------------------------------
    // 12. GOOGLE DRIVE OAUTH 2.0: URL, CALLBACK Y ESTADO
    // --------------------------------------------------------------------------
    if (pathname === '/api/auth/google/url' && method === 'GET') {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8000/api/auth/google/callback';
      const scopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/userinfo.email'
      ].join(' ');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

      return sendJSON(200, {
        auth_url: authUrl,
        client_id: clientId,
        redirect_uri: redirectUri
      });
    }

    if (pathname === '/api/auth/google/callback' && method === 'GET') {
      const parsedQuery = parsedUrl.query;
      const code = parsedQuery.code;
      const errorGoogle = parsedQuery.error;

      if (errorGoogle || !code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="utf-8"/>
            <title>Error de Autenticación - Google Drive</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-50 min-h-screen flex items-center justify-center p-6 text-slate-800">
            <div class="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-rose-200 text-center">
              <div class="w-16 h-16 mx-auto bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mb-4">⚠️</div>
              <h2 class="text-xl font-bold text-rose-800">No se pudo vincular Google Drive</h2>
              <p class="text-xs text-slate-500 mt-2">${errorGoogle || 'Código de autorización no recibido.'}</p>
              <a href="http://localhost:5174/" class="mt-6 inline-block px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition">Volver al Portal</a>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // Canjear code por tokens con Google
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: String(code),
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8000/api/auth/google/callback',
            grant_type: 'authorization_code'
          })
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
          throw new Error(tokenData.error_description || tokenData.error);
        }

        // Obtener info del usuario de Google conectado
        let googleEmail = '';
        if (tokenData.access_token) {
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });
            const userData = await userRes.json();
            googleEmail = userData.email || '';
          } catch (e) {}
        }

        const tokensToSave = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          expires_in: tokenData.expires_in,
          obtained_at: new Date().toISOString(),
          google_email: googleEmail
        };

        fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokensToSave, null, 2), 'utf-8');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="utf-8"/>
            <title>Google Drive Conectado - TecnoCR Soluciones</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-[#F8F7FC] min-h-screen flex items-center justify-center p-6 text-slate-800 font-sans">
            <div class="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border border-purple-200 text-center">
              <div class="w-16 h-16 mx-auto bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-4">
                ✓
              </div>
              <h2 class="text-2xl font-extrabold text-slate-900">¡Google Drive Conectado!</h2>
              <p class="text-xs text-slate-500 mt-2">
                Se han guardado las credenciales y el token de acceso oficial para la cuenta:
              </p>
              ${googleEmail ? `<div class="mt-3 inline-block px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">📧 ${googleEmail}</div>` : ''}
              <p class="text-xs text-slate-400 mt-4 leading-relaxed">
                El motor de búsqueda RAG y los agentes de TecnoCR ahora pueden sincronizar y leer las políticas oficiales directamente desde tu nube de Google Drive.
              </p>
              <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <a href="http://localhost:5174/" class="px-6 py-2.5 rounded-xl bg-purple-700 text-white text-xs font-bold shadow-md hover:bg-purple-800 transition">
                  Ir al Portal Web
                </a>
                <button onclick="window.close()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cerrar Ventana
                </button>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="utf-8"/>
            <title>Error Canjeando Token</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-50 min-h-screen flex items-center justify-center p-6 text-slate-800">
            <div class="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-rose-200 text-center">
              <div class="w-16 h-16 mx-auto bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mb-4">✕</div>
              <h2 class="text-xl font-bold text-rose-800">Error al canjear el token OAuth</h2>
              <p class="text-xs text-slate-500 mt-2">${err.message}</p>
              <a href="http://localhost:5174/" class="mt-6 inline-block px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition">Volver</a>
            </div>
          </body>
          </html>
        `);
        return;
      }
    }

    if (pathname === '/api/auth/google/status' && method === 'GET') {
      const existeToken = fs.existsSync(TOKENS_PATH);
      let info = {
        conectado: false,
        folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || '1UB52cLslWSnk731YZ0a00duzRDC5YPiZ'
      };
      if (existeToken) {
        try {
          const t = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
          info = {
            conectado: true,
            google_email: t.google_email || null,
            obtained_at: t.obtained_at || null,
            folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || '1UB52cLslWSnk731YZ0a00duzRDC5YPiZ'
          };
        } catch (e) {}
      }
      return sendJSON(200, info);
    }

    if (pathname === '/api/dashboard/policies/upload' && method === 'POST') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Autenticación requerida." });
      if (payload.rol !== 'rrhh' && payload.rol !== 'administrador') {
        return sendJSON(403, { detail: "Acceso denegado: rol RRHH requerido." });
      }

      const body = await leerBody(req);
      const nombre = typeof body.nombre === 'string' ? body.nombre : '';
      const contenido = typeof body.contenido === 'string' ? body.contenido : '';
      if (!nombre.trim() || !contenido.trim()) {
        return sendJSON(400, { detail: "Selecciona un archivo de política con contenido." });
      }
      if (Buffer.byteLength(contenido, 'utf-8') > 2 * 1024 * 1024) {
        return sendJSON(413, { detail: "El archivo supera el límite de 2 MB." });
      }

      const nombreArchivo = nombre.replace(/\\/g, '/').split('/').pop();
      const extension = path.extname(nombreArchivo).toLowerCase();
      if (!['.md', '.txt'].includes(extension)) {
        return sendJSON(415, { detail: "Formato no compatible. Sube un archivo .md o .txt." });
      }

      const baseNombre = path.basename(nombreArchivo, extension)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/^[-_.]+|[-_.]+$/g, '') || 'politica';
      const archivoGuardado = `${Date.now()}_${baseNombre}.md`;
      const carpetaPoliticas = path.join(__dirname, '..', 'docs_politicas');
      const rutaArchivo = path.join(carpetaPoliticas, archivoGuardado);

      try {
        fs.mkdirSync(carpetaPoliticas, { recursive: true });
        fs.writeFileSync(rutaArchivo, contenido, { encoding: 'utf-8', flag: 'wx' });
        const resultado = ingesta.sincronizar();
        return sendJSON(201, {
          mensaje: "Política guardada e indexada para consultas del asistente.",
          archivo: archivoGuardado,
          documentos: resultado.documentos,
          fragmentos: resultado.chunks
        });
      } catch (err) {
        if (fs.existsSync(rutaArchivo)) fs.unlinkSync(rutaArchivo);
        console.error('[Políticas] Error al guardar o indexar archivo:', err);
        return sendJSON(500, { detail: "No se pudo guardar e indexar la política." });
      }
    }

    // --------------------------------------------------------------------------
    // 13. OPERACIONES EN CARPETA GOOGLE DRIVE: LISTAR, SUBIR Y SINCRONIZAR
    // --------------------------------------------------------------------------
    if (pathname === '/api/drive/files' && method === 'GET') {
      const token = await obtenerGoogleAccessToken();
      if (!token) return sendJSON(401, { detail: "No hay conexión activa con Google Drive. Inicia sesión primero." });

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1UB52cLslWSnk731YZ0a00duzRDC5YPiZ';
      try {
        const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const driveData = await driveRes.json();
        return sendJSON(200, {
          folder_id: folderId,
          archivos: driveData.files || []
        });
      } catch (err) {
        return sendJSON(500, { detail: "Error listando archivos de Drive.", error: err.message });
      }
    }

    if (pathname === '/api/drive/upload' && method === 'POST') {
      const payload = verificarToken(req.headers['authorization']);
      if (!payload) return sendJSON(401, { detail: "Autenticación requerida." });
      if (payload.rol !== 'rrhh' && payload.rol !== 'administrador') {
        return sendJSON(403, { detail: "Acceso denegado: rol RRHH requerido." });
      }

      const body = await leerBody(req);
      const { nombre, contenido, contenido_base64, mime_type } = body;
      const nombreArchivo = typeof nombre === 'string' ? nombre.replace(/\\/g, '/').split('/').pop().trim() : '';
      const tieneTexto = typeof contenido === 'string' && contenido.trim().length > 0;
      const tieneArchivo = typeof contenido_base64 === 'string' && contenido_base64.length > 0;

      if (!nombreArchivo || (!tieneTexto && !tieneArchivo)) {
        return sendJSON(400, { detail: "Selecciona un archivo con nombre y contenido para subir." });
      }
      if (nombreArchivo.length > 255) {
        return sendJSON(400, { detail: "El nombre del archivo supera los 255 caracteres." });
      }

      try {
        let contenidoArchivo;
        if (tieneArchivo) {
          if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contenido_base64)) {
            return sendJSON(400, { detail: "El archivo recibido tiene un formato inválido." });
          }
          contenidoArchivo = Buffer.from(contenido_base64, 'base64');
          if (contenidoArchivo.length > 10 * 1024 * 1024) {
            return sendJSON(413, { detail: "El archivo supera el límite de 10 MB." });
          }
        } else {
          contenidoArchivo = contenido;
        }

        const mimeType = typeof mime_type === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(mime_type)
          ? mime_type
          : 'application/octet-stream';
        const subido = await subirArchivoGoogleDrive(nombreArchivo, contenidoArchivo, mimeType);

        // Indexar de inmediato en el motor RAG
        const esTextoIndexable = typeof contenidoArchivo === 'string' &&
          /\.(md|txt)$/i.test(nombreArchivo);
        if (esTextoIndexable) {
          const tituloLimpio = nombreArchivo.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
          ingesta.indexarDocumentosDrive([{
            id: subido.id,
            titulo: tituloLimpio,
            url_drive: subido.webViewLink || `https://drive.google.com/file/d/${subido.id}/view`,
            contenido: contenidoArchivo
          }]);
        }

        return sendJSON(201, {
          mensaje: esTextoIndexable
            ? "Documento subido a Google Drive e indexado en el RAG exitosamente."
            : "Archivo subido a Google Drive exitosamente.",
          archivo: subido
        });
      } catch (err) {
        return sendJSON(500, { detail: "Error al subir archivo a Google Drive.", error: err.message });
      }
    }

    if (pathname === '/api/drive/upload-politicas-locales' && method === 'POST') {
      const DOCS_DIR = path.join(__dirname, '..', 'docs_politicas');
      if (!fs.existsSync(DOCS_DIR)) {
        return sendJSON(404, { detail: "Carpeta docs_politicas local no encontrada." });
      }

      const archivos = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
      const subidos = [];
      const errores = [];

      for (const archivo of archivos) {
        try {
          const ruta = path.join(DOCS_DIR, archivo);
          const contenido = fs.readFileSync(ruta, 'utf-8');
          const resSubida = await subirArchivoGoogleDrive(archivo, contenido, 'text/markdown');
          subidos.push({ archivo, id: resSubida.id, webViewLink: resSubida.webViewLink });
        } catch (e) {
          errores.push({ archivo, error: e.message });
        }
      }

      // Re-sincronizar el RAG con los enlaces reales
      ingesta.sincronizar();

      return sendJSON(200, {
        mensaje: `Se subieron ${subidos.length} de ${archivos.length} documentos a tu carpeta de Google Drive.`,
        subidos,
        errores
      });
    }

    if (pathname === '/api/drive/sync' && method === 'POST') {
      const token = await obtenerGoogleAccessToken();
      if (!token) return sendJSON(401, { detail: "No hay conexión activa con Google Drive." });

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1UB52cLslWSnk731YZ0a00duzRDC5YPiZ';
      try {
        const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink)`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const driveData = await driveRes.json();
        const files = driveData.files || [];

        const docsParaIndexar = [];
        for (const f of files) {
          let texto = "";
          if (f.mimeType === 'application/vnd.google-apps.document') {
            const expRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            texto = await expRes.text();
          } else {
            const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            texto = await getRes.text();
          }

          if (texto) {
            docsParaIndexar.push({
              id: f.id,
              titulo: f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
              url_drive: f.webViewLink,
              contenido: texto
            });
          }
        }

        const resIngesta = ingesta.indexarDocumentosDrive(docsParaIndexar);
        return sendJSON(200, {
          mensaje: `Sincronización completada desde Google Drive. ${docsParaIndexar.length} documentos procesados.`,
          documentos_sincronizados: docsParaIndexar.length,
          total_fragmentos: resIngesta.chunks
        });
      } catch (err) {
        return sendJSON(500, { detail: "Error sincronizando con Google Drive.", error: err.message });
      }
    }

    // --------------------------------------------------------------------------
    // 13. SALUD: GET /api/health
    // --------------------------------------------------------------------------
    if (pathname === '/api/health' && method === 'GET') {
      return sendJSON(200, {
        status: "online",
        motor: "Node.js (JavaScript)",
        empresa: "TecnoCR Soluciones S.A.",
        agentes: [
          "1. Orquestador (JavaScript)",
          "2. Políticas (RAG Coseno)",
          "3. Datos del Colaborador (Filtrado Seguro)",
          "4. Analista de Reportes (Cron 7:00 AM)",
          "5. Ingesta y Sincronización (Docs Indexer)"
        ]
      });
    }

    // Ruta no encontrada
    return sendJSON(404, { detail: `Ruta ${method} ${pathname} no encontrada.` });

  } catch (err) {
    console.error("Error en servidor:", err);
    return sendJSON(500, { detail: "Error interno del servidor.", error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Servidor Backend en JavaScript CORRIENDO EXITOSAMENTE!`);
  console.log(`📡 URL Base de la API: http://localhost:${PORT}`);
  console.log(`🌐 Listo para recibir conexiones desde el Frontend (React)\n`);
});
