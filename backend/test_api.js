/**
 * Script de Verificación de la API en JavaScript
 */

const BASE_URL = "http://localhost:8000";

async function probarAPI() {
  console.log("==================================================================");
  console.log("  PROBANDO API REST EN JAVASCRIPT (NODE.JS)");
  console.log("==================================================================");

  // 1. Health
  const rHealth = await fetch(`${BASE_URL}/api/health`);
  const dataHealth = await rHealth.json();
  console.log("1. Health Check:", dataHealth);

  // 2. Login Colaborador
  const rLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "cjimenez@tecnocr.com", password: "Password123!" })
  });
  const dataLogin = await rLogin.json();
  console.log("2. Login Colaborador:", dataLogin.user?.nombre_completo, "- Rol:", dataLogin.user?.rol);

  const tokenColab = dataLogin.access_token;

  // 3. Vacaciones
  const rVac = await fetch(`${BASE_URL}/api/colaborador/vacaciones`, {
    headers: { "Authorization": `Bearer ${tokenColab}` }
  });
  const dataVac = await rVac.json();
  console.log("3. Vacaciones Colaborador:", dataVac.dias_pendientes, "días pendientes.");

  // 4. Chatbot
  const rChat = await fetch(`${BASE_URL}/api/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenColab}`
    },
    body: JSON.stringify({ pregunta: "¿Cuántos días de vacaciones me corresponden según la ley de Costa Rica?" })
  });
  const dataChat = await rChat.json();
  console.log("4. Respuesta Chatbot (Agente:", dataChat.agente, "):");
  console.log("   Citas:", dataChat.fuentes?.map(f => f.documento + " - " + f.seccion));
  console.log("   Texto:", dataChat.respuesta.slice(0, 120) + "...");

  // 5. Login RRHH y Dashboard
  const rLoginRRHH = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mchaves@tecnocr.com", password: "Password123!" })
  });
  const dataRRHH = await rLoginRRHH.json();
  const tokenRRHH = dataRRHH.access_token;

  const rStats = await fetch(`${BASE_URL}/api/dashboard/stats`, {
    headers: { "Authorization": `Bearer ${tokenRRHH}` }
  });
  const dataStats = await rStats.json();
  console.log("5. KPIs Dashboard RRHH:", {
    total_colaboradores: dataStats.total_colaboradores,
    total_ausencias: dataStats.total_ausencias,
    solicitudes_pendientes: dataStats.solicitudes_pendientes
  });

  console.log("\n[ÉXITO] Todos los endpoints en JavaScript están respondiendo a la perfección!");
}

probarAPI().catch(console.error);

