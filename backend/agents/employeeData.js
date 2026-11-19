/**
 * Agente 3: Datos del Colaborador - Mejorado con más intenciones
 */

import { obtenerBD } from '../database/store.js';

export class AgenteDatosColaboradorJS {
  procesarConsulta(pregunta, colaboradorId) {
    const db = obtenerBD();
    const colab = db.colaboradores.find(c => c.id === colaboradorId);

    if (!colab) {
      return {
        respuesta: "No se encontró registro para el usuario autenticado. Por favor contacta a RRHH.",
        exito: false
      };
    }

    const p = pregunta.toLowerCase();
    const nombre = colab.nombre_completo?.split(' ')[0] || colab.nombre_completo;

    // 1. Vacaciones y Saldos
    if (p.includes('vacaciones') || p.includes('saldo') || p.includes('días disponibles') ||
        p.includes('dias disponibles') || p.includes('me quedan') || p.includes('cuántos días') ||
        p.includes('cuantos dias') || p.includes('mis días') || p.includes('mis dias') ||
        p.includes('balance') || p.includes('disponibles')) {
      const saldo = db.saldos_vacaciones.find(s => s.colaborador_id === colab.id);
      if (!saldo) {
        return {
          respuesta: `Hola **${nombre}**, actualmente no hay balance de vacaciones registrado en tu expediente. Por favor contacta al área de RRHH para verificar.`,
          exito: true
        };
      }

      const pct = Math.round((saldo.dias_pendientes / (saldo.dias_ganados || 15)) * 100);
      const barra = `${'█'.repeat(Math.floor(pct / 10))}${'░'.repeat(10 - Math.floor(pct / 10))} ${pct}%`;
      const alertaPasivo = saldo.dias_pendientes > 20
        ? `\n\n⚠️ **Alerta de pasivo laboral:** Acumulas más de 20 días sin disfrutar. El Art. 155 del Código de Trabajo establece que el colaborador debe disfrutar sus vacaciones. Te sugerimos coordinar con tu jefatura.`
        : '';

      return {
        respuesta: `Hola **${nombre}** 🏖️, este es tu balance de vacaciones para el periodo **${saldo.periodo_anual}**:\n\n| Concepto | Días |\n|---|---|\n| ✅ **Disponibles** | **${saldo.dias_pendientes} días** |\n| 📅 Ganados en el periodo | ${saldo.dias_ganados} días |\n| ✈️ Ya disfrutados | ${saldo.dias_disfrutados} días |\n\n📊 **${barra}**\n\nPuedes solicitar tus vacaciones desde el portal con al menos **15 días hábiles de anticipación**.${alertaPasivo}`,
        datos: saldo,
        exito: true
      };
    }

    // 2. Solicitudes de Permisos y su Estado
    if (p.includes('solicitud') || p.includes('solicitudes') || p.includes('permiso') ||
        p.includes('estado') || p.includes('mis trámites') || p.includes('mis tramites')) {
      const sols = db.solicitudes.filter(s => s.colaborador_id === colab.id);
      if (sols.length === 0) {
        return {
          respuesta: `**${nombre}**, no tienes solicitudes registradas aún. Puedes crear una desde el Portal haciendo clic en **"+ Nueva Solicitud"**.`,
          exito: true
        };
      }

      const estadoEmoji = { aprobada: '✅', rechazada: '❌', pendiente: '⏳' };
      const lista = sols.slice(0, 5).map(s =>
        `${estadoEmoji[s.estado] || '⏳'} **${s.tipo.replace('_', ' ').toUpperCase()}** · ${s.dias_solicitados} día(s) · ${s.fecha_inicio} al ${s.fecha_fin} → **${s.estado.toUpperCase()}**`
      ).join('\n');

      return {
        respuesta: `📋 **${nombre}**, tus últimas solicitudes son:\n\n${lista}\n\nPuedes crear una nueva solicitud desde el Portal en la sección **"Mis Solicitudes"**.`,
        datos: sols,
        exito: true
      };
    }

    // 3. Fechas de Pago, Nómina, Salario y Aguinaldo
    if (p.includes('pago') || p.includes('cuándo pagan') || p.includes('cuando pagan') ||
        p.includes('salario') || p.includes('aguinaldo') || p.includes('nómina') ||
        p.includes('nomina') || p.includes('quincena') || p.includes('deducciones')) {
      return {
        respuesta: `💰 **Información de Nómina - ${colab.nombre_completo}**\n\n- **Puesto:** ${colab.puesto} · Departamento de ${colab.departamento}\n- **Modalidad:** ${colab.modalidad?.toUpperCase() || 'No registrado'}\n- **Frecuencia de pago:** Quincenal (días **15 y último día hábil** del mes)\n- **Moneda:** Colones Costarricenses 🇨🇷\n- **Cargas sociales obreras:** 10.67% (CCSS: 5.5%, LPT: 1%, Banco Popular: 1%)\n- **Aguinaldo TecnoCR:** Se paga el **5 de diciembre** de cada año.\n\n📌 _Si necesitas tu recibo de pago o tienes discrepancias en la nómina, comunícate con el área de Talento Humano._`,
        exito: true
      };
    }

    // 4. Incapacidades del colaborador
    if (p.includes('incapacidad') || p.includes('incapacidades') || p.includes('ccss') ||
        p.includes('médico') || p.includes('medico') || p.includes('enfermo')) {
      const incs = db.incapacidades?.filter(i => i.colaborador_id === colab.id) || [];
      if (incs.length === 0) {
        return {
          respuesta: `**${nombre}**, no tienes incapacidades registradas en el sistema. Si acabas de entregar una boleta de CCSS o INS, recuerda que debes presentarla a RRHH **dentro de las 24 horas** siguientes a la emisión.`,
          exito: true
        };
      }
      const lista = incs.slice(0, 3).map(i =>
        `- ${i.fecha_inicio} al ${i.fecha_fin} · ${i.tipo || 'CCSS'} · ${i.dias_totales || '?'} días`
      ).join('\n');
      return {
        respuesta: `🏥 **Incapacidades registradas - ${nombre}:**\n\n${lista}`,
        exito: true
      };
    }

    // 5. Perfil General del colaborador
    if (p.includes('perfil') || p.includes('expediente') || p.includes('mi información') ||
        p.includes('mi informacion') || p.includes('mis datos') || p.includes('quién soy') ||
        p.includes('quien soy')) {
      return {
        respuesta: `📋 **Ficha de Colaborador - TecnoCR Soluciones**\n\n| Campo | Valor |\n|---|---|\n| 👤 **Nombre** | ${colab.nombre_completo} |\n| 🪪 **Cédula** | ${colab.cedula} |\n| 💼 **Puesto** | ${colab.puesto} |\n| 🏢 **Departamento** | ${colab.departamento} |\n| 💻 **Modalidad** | ${colab.modalidad?.toUpperCase() || 'N/A'} |\n| 📅 **Fecha de ingreso** | ${colab.fecha_ingreso} |\n| 📧 **Correo** | ${colab.email || 'No registrado'} |`,
        exito: true
      };
    }

    // Respuesta por defecto para datos personales
    return {
      respuesta: `**${nombre}**, ¿qué información de tu expediente deseas consultar? Puedo ayudarte con:\n\n- 🏖️ **Saldo de vacaciones** disponibles\n- 📋 **Estado de solicitudes** de permisos\n- 💰 **Fechas de pago** y datos de nómina\n- 🏥 **Incapacidades** registradas\n- 📋 **Perfil** y datos laborales generales`,
      exito: true
    };
  }
}
