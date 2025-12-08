import { Anthropic } from '@anthropic-ai/sdk';
import twilio from 'twilio';
import { google } from 'googleapis';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const CONFIG = {
  MODEL: 'claude-3-5-haiku-20241022',
  MAX_TOKENS: 1024,
  HISTORIAL_LIMITE: 15,
  TIMEZONE: 'America/Mexico_City',
  // Tiempo en horas después del cual se considera una nueva sesión
  SESION_TIMEOUT_HORAS: 24
};

// ============================================================================
// COMANDOS ESPECIALES DEL SISTEMA
// ============================================================================
const COMANDOS = {
  REINICIAR: /^(reiniciar|reset|nuevo|nueva consulta|empezar de nuevo|borrar|limpiar)$/i,
  AYUDA: /^(ayuda|help|comandos|menu|menú|\?)$/i,
  ESTADO: /^(estado|status|mi estado|mis datos)$/i
};

// ============================================================================
// SISTEMA DE LOGS DETALLADO
// ============================================================================
function log(emoji, mensaje, datos = null) {
  const timestamp = DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('HH:mm:ss');
  if (datos) {
    console.log(`[${timestamp}] ${emoji} ${mensaje}:`, JSON.stringify(datos, null, 2));
  } else {
    console.log(`[${timestamp}] ${emoji} ${mensaje}`);
  }
}

// ============================================================================
// GOOGLE AUTH
// ============================================================================
function getGoogleAuth(scopes) {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
    path.join(process.cwd(), 'google-credentials.json');

  log('🔑', `Buscando credenciales en: ${keyFile}`);
  
  if (!fs.existsSync(keyFile)) {
    log('❌', `Archivo de credenciales NO existe: ${keyFile}`);
    throw new Error(`Archivo de credenciales no encontrado: ${keyFile}`);
  }

  const credentialsRaw = fs.readFileSync(keyFile, 'utf8');
  const credentials = JSON.parse(credentialsRaw);
  
  log('✅', `Credenciales cargadas. Client email: ${credentials.client_email}`);

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key
      .split('\\n').join('\n')
      .replace(/\r\n/g, '\n');
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: Array.isArray(scopes) ? scopes : [scopes]
  });
}

// ============================================================================
// NORMALIZAR TELÉFONO (para consistencia en búsquedas)
// ============================================================================
function normalizarTelefono(telefono) {
  // Remover 'whatsapp:' si existe, espacios, y cualquier caracter no numérico excepto +
  let normalizado = telefono
    .replace('whatsapp:', '')
    .replace(/\s/g, '')
    .trim();
  
  // Extraer solo los últimos 10 dígitos para comparación más flexible
  return normalizado;
}

// Función para comparar teléfonos de forma flexible
function telefonosCoinciden(tel1, tel2) {
  // Extraer solo dígitos
  const digitos1 = tel1.replace(/\D/g, '').slice(-10);
  const digitos2 = tel2.replace(/\D/g, '').slice(-10);
  return digitos1 === digitos2;
}

// ============================================================================
// ESTADO DEL CLIENTE - OBTENER
// ============================================================================
async function obtenerEstadoConversacion(telefono) {
  const telefonoNormalizado = normalizarTelefono(telefono);
  log('📖', `Buscando estado para teléfono: ${telefonoNormalizado}`);
  
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Estados!A:L'  // Ampliado para más campos de seguimiento
    });

    const rows = response.data.values || [];
    log('📊', `Total filas en Estados: ${rows.length}`);
    
    // DEBUG: Mostrar los últimos 5 teléfonos en la hoja
    const ultimos5 = rows.slice(-5).map(r => r[0]);
    log('🔍', `Últimos 5 teléfonos en hoja: ${JSON.stringify(ultimos5)}`);
    log('🔍', `Buscando exactamente: "${telefonoNormalizado}"`);
    
    // Buscar con teléfono normalizado (comparación flexible por últimos 10 dígitos)
    const estadoRow = rows.find(row => {
      const telEnSheet = row[0] || '';
      const coincide = telefonosCoinciden(telEnSheet, telefonoNormalizado);
      if (coincide) {
        log('✅', `Match encontrado: "${telEnSheet}" coincide con "${telefonoNormalizado}"`);
      }
      return coincide;
    });

    if (estadoRow) {
      const estado = {
        telefono: telefonoNormalizado,
        tipo_propiedad: estadoRow[1] || '',
        zona: estadoRow[2] || '',
        presupuesto: estadoRow[3] || '',
        etapa: estadoRow[4] || 'inicial',
        resumen: estadoRow[5] || '',
        ultima_actualizacion: estadoRow[6] || '',
        // Nuevos campos de seguimiento
        nombre_cliente: estadoRow[7] || '',
        fecha_cita: estadoRow[8] || '',
        propiedad_interes: estadoRow[9] || '',
        primer_contacto: estadoRow[10] || '',
        notas: estadoRow[11] || ''
      };
      log('✅', 'Estado encontrado', estado);
      return estado;
    }

    log('🆕', 'Cliente nuevo, sin estado previo');
    return {
      telefono: telefonoNormalizado,
      tipo_propiedad: '',
      zona: '',
      presupuesto: '',
      etapa: 'inicial',
      resumen: '',
      ultima_actualizacion: '',
      nombre_cliente: '',
      fecha_cita: '',
      propiedad_interes: '',
      primer_contacto: DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('yyyy-MM-dd'),
      notas: ''
    };
  } catch (error) {
    log('❌', 'Error al obtener estado', { error: error.message });
    return {
      telefono: telefonoNormalizado,
      tipo_propiedad: '',
      zona: '',
      presupuesto: '',
      etapa: 'inicial',
      resumen: '',
      ultima_actualizacion: '',
      nombre_cliente: '',
      fecha_cita: '',
      propiedad_interes: '',
      primer_contacto: DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('yyyy-MM-dd'),
      notas: ''
    };
  }
}

// ============================================================================
// ESTADO DEL CLIENTE - GUARDAR
// ============================================================================
async function guardarEstadoConversacion(estado) {
  const telefonoNormalizado = normalizarTelefono(estado.telefono);
  log('💾', `Guardando estado para: ${telefonoNormalizado}`, estado);
  
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Estados!A:A'
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => {
      const telEnSheet = row[0] || '';
      return telefonosCoinciden(telEnSheet, telefonoNormalizado);
    });

    const timestamp = DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss');
    
    // Datos ampliados para seguimiento (12 columnas: A-L)
    const rowData = [
      telefonoNormalizado,                                    // A: Teléfono
      estado.tipo_propiedad || '',                            // B: Tipo de propiedad
      estado.zona || '',                                      // C: Zona
      estado.presupuesto || '',                               // D: Presupuesto
      estado.etapa || 'inicial',                              // E: Etapa
      estado.resumen || '',                                   // F: Resumen
      timestamp,                                              // G: Última actualización
      estado.nombre_cliente || '',                            // H: Nombre del cliente
      estado.fecha_cita || '',                                // I: Fecha de cita agendada
      estado.propiedad_interes || '',                         // J: Propiedad de interés
      estado.primer_contacto || timestamp.split(' ')[0],      // K: Primer contacto
      estado.notas || ''                                      // L: Notas adicionales
    ];

    if (rowIndex > -1) {
      log('🔄', `Actualizando fila ${rowIndex + 1}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Estados!A${rowIndex + 1}:L${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
      });
    } else {
      log('➕', 'Creando nueva fila de estado');
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Estados!A:L',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
      });
    }

    log('✅', 'Estado guardado exitosamente');
    return { success: true };
  } catch (error) {
    log('❌', 'Error al guardar estado', { error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================================================
// RESETEAR ESTADO DEL CLIENTE
// ============================================================================
async function resetearEstadoCliente(telefono) {
  const telefonoNormalizado = normalizarTelefono(telefono);
  log('🗑️', `Reseteando estado para: ${telefonoNormalizado}`);
  
  const estadoVacio = {
    telefono: telefonoNormalizado,
    tipo_propiedad: '',
    zona: '',
    presupuesto: '',
    etapa: 'inicial',
    resumen: '',
    ultima_actualizacion: ''
  };
  
  await guardarEstadoConversacion(estadoVacio);
  return estadoVacio;
}

// ============================================================================
// VERIFICAR SI LA SESIÓN EXPIRÓ (para auto-reset)
// ============================================================================
function sesionExpirada(ultimaActualizacion) {
  if (!ultimaActualizacion) return true;
  
  try {
    const ultima = DateTime.fromFormat(ultimaActualizacion, 'yyyy-MM-dd HH:mm:ss', { zone: CONFIG.TIMEZONE });
    const ahora = DateTime.now().setZone(CONFIG.TIMEZONE);
    const horasTranscurridas = ahora.diff(ultima, 'hours').hours;
    
    return horasTranscurridas > CONFIG.SESION_TIMEOUT_HORAS;
  } catch {
    return true;
  }
}

// ============================================================================
// PROCESAR COMANDOS ESPECIALES
// ============================================================================
async function procesarComandoEspecial(mensaje, telefono, estado) {
  const mensajeLimpio = mensaje.trim();
  
  // Comando: REINICIAR
  if (COMANDOS.REINICIAR.test(mensajeLimpio)) {
    await resetearEstadoCliente(telefono);
    return {
      esComando: true,
      respuesta: `🔄 ¡Listo! He reiniciado tu búsqueda.\n\n¡Hola! 👋 Soy Ana, tu asesora inmobiliaria. ¿Qué tipo de propiedad estás buscando hoy?\n\n• 🏠 Casa\n• 🏢 Departamento\n• 🌳 Terreno\n• 🏪 Local comercial`
    };
  }
  
  // Comando: AYUDA
  if (COMANDOS.AYUDA.test(mensajeLimpio)) {
    return {
      esComando: true,
      respuesta: `📋 *Comandos disponibles:*\n\n• *reiniciar* - Empezar una nueva búsqueda\n• *estado* - Ver tus datos guardados\n• *ayuda* - Ver este menú\n\n💡 También puedes simplemente decirme qué tipo de propiedad buscas, en qué zona y tu presupuesto.`
    };
  }
  
  // Comando: ESTADO
  if (COMANDOS.ESTADO.test(mensajeLimpio)) {
    const tipo = estado.tipo_propiedad || '❌ No definido';
    const zona = estado.zona || '❌ No definida';
    const presupuesto = estado.presupuesto || '❌ No definido';
    
    return {
      esComando: true,
      respuesta: `📊 *Tu búsqueda actual:*\n\n🏠 Tipo: ${tipo}\n📍 Zona: ${zona}\n💰 Presupuesto: ${presupuesto}\n\n💡 Escribe *reiniciar* para empezar una nueva búsqueda.`
    };
  }
  
  return { esComando: false };
}

// ============================================================================
// DETECCIÓN AUTOMÁTICA DE DATOS EN MENSAJE
// ============================================================================
function detectarDatosEnMensaje(mensaje) {
  const mensajeLower = mensaje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let datos = {};
  
  // DETECTAR NOMBRE DEL CLIENTE
  const matchNombre = mensaje.match(/(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
  if (matchNombre) {
    datos.nombre_cliente = matchNombre[1].trim();
    log('👤', `Nombre detectado: ${datos.nombre_cliente}`);
  }
  
  // DETECTAR CAMBIO DE OPINIÓN
  const quiereCambiar = 
    /\b(mejor|cambio|cambie|prefiero|en realidad|ya no|ahora quiero|pensandolo bien|pensándolo bien)\b/i.test(mensajeLower) ||
    /\b(otra|otras|otro|otros|diferentes?)\s*(opciones?|propiedades?|casas?|terrenos?|departamentos?)\b/i.test(mensajeLower) ||
    /\b(no me convence|no me gusta|muy caro|muy lejos|busco otra|vemos otra|muestrame otra|muéstrame otra)\b/i.test(mensajeLower) ||
    /\b(cancelar?|no quiero|dejalo|déjalo|olvidalo|olvídalo)\s*(la cita|agendar|visita)?\b/i.test(mensajeLower);
  
  if (quiereCambiar) {
    datos.cambio_opinion = true;
    log('🔄', 'Detectado: cliente quiere cambiar/ver otras opciones');
  }
  
  // DETECTAR CANCELACIÓN ESPECÍFICA
  const quiereCancelar = /\b(cancelar?|no quiero|ya no|dejalo|déjalo)\s*(la cita|agendar|visita|ir)?\b/i.test(mensajeLower);
  if (quiereCancelar) {
    datos.quiere_cancelar = true;
    log('❌', 'Detectado: cliente quiere cancelar');
  }

  // TIPO DE PROPIEDAD (siempre sobrescribe si detecta algo nuevo)
  if (/\b(terreno|terrenos|lote|lotes)\b/.test(mensajeLower)) {
    datos.tipo_propiedad = 'Terreno';
  } else if (/\b(casa|casas|residencia)\b/.test(mensajeLower)) {
    datos.tipo_propiedad = 'Casa';
  } else if (/\b(departamento|depto|deptos|apartamento)\b/.test(mensajeLower)) {
    datos.tipo_propiedad = 'Departamento';
  } else if (/\b(local|locales|comercial|oficina|oficinas)\b/.test(mensajeLower)) {
    datos.tipo_propiedad = 'Local comercial';
  } else if (/\b(bodega|nave|industrial)\b/.test(mensajeLower)) {
    datos.tipo_propiedad = 'Bodega';
  }

  // ZONA
  if (/\bzapopan\b/.test(mensajeLower)) {
    datos.zona = 'Zapopan, Jalisco';
  } else if (/\bguadalajara\b/.test(mensajeLower)) {
    datos.zona = 'Guadalajara, Jalisco';
  } else if (/\btlajomulco\b/.test(mensajeLower)) {
    datos.zona = 'Tlajomulco, Jalisco';
  } else if (/\btonala\b/.test(mensajeLower)) {
    datos.zona = 'Tonalá, Jalisco';
  } else if (/\btlaquepaque\b/.test(mensajeLower)) {
    datos.zona = 'Tlaquepaque, Jalisco';
  } else if (/\bchapala\b/.test(mensajeLower)) {
    datos.zona = 'Chapala, Jalisco';
  } else if (/\bajijic\b/.test(mensajeLower)) {
    datos.zona = 'Ajijic, Jalisco';
  } else if (/\bvallarta\b/.test(mensajeLower)) {
    datos.zona = 'Puerto Vallarta, Jalisco';
  }

  // PRESUPUESTO
  const matchMillones = mensajeLower.match(/(\d+(?:\.\d+)?)\s*(millon|millones|mdp)/i);
  if (matchMillones) {
    datos.presupuesto = `${matchMillones[1]} millones de pesos`;
  } else {
    const matchNumero = mensaje.match(/(\d{1,3}(?:,\d{3})+|\d{6,})/);
    if (matchNumero) {
      const numero = parseInt(matchNumero[1].replace(/,/g, ''), 10);
      if (numero >= 100000) {
        datos.presupuesto = numero >= 1000000 
          ? `${(numero / 1000000).toFixed(1)} millones de pesos`
          : `${numero.toLocaleString('es-MX')} pesos`;
      }
    }
  }

  // DETECTAR INTENCIÓN DE AGENDAR
  const quiereAgendar = 
    /^(si|sí|claro|por favor|ok|va|dale|okay|perfecto|por supuesto|desde luego)[\s.,!?]*$/i.test(mensaje.trim()) ||
    /\b(quiero|quisiera|me gustaria|me gustaría|podemos|podriamos|podríamos)\s+(agendar|visitar|ver|conocer|ir)\b/i.test(mensajeLower) ||
    /\b(si|sí),?\s*(por favor|quiero|me interesa)/i.test(mensajeLower) ||
    /\bagendame\b|\bagenda\b|\bvisita\b/i.test(mensajeLower);
  
  if (quiereAgendar) {
    datos.quiere_agendar = true;
    log('📅', 'Detectado: cliente quiere agendar');
  }

  // DETECTAR FECHA/HORA proporcionada
  const tieneFecha = 
    /\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/i.test(mensajeLower) ||
    /\b(mañana|pasado\s*mañana|hoy|esta\s*semana|proxima\s*semana|próxima\s*semana)\b/i.test(mensajeLower) ||
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(mensajeLower) ||
    /\b\d{1,2}\s*(de|\/|-)\s*\d{1,2}\b/i.test(mensajeLower) ||
    /\b\d{1,2}\s*(de|del)\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(mensajeLower);
  
  const tieneHora = 
    /\b\d{1,2}:\d{2}\b/.test(mensajeLower) ||
    /\b\d{1,2}\s*(am|pm|hrs|horas|de la mañana|de la tarde|de la noche)\b/i.test(mensajeLower) ||
    /\b(a las|alas)\s*\d{1,2}\b/i.test(mensajeLower);
  
  if (tieneFecha || tieneHora) {
    datos.tiene_fecha = true;
    log('🗓️', 'Detectado: cliente proporcionó fecha/hora');
  }

  // DETECTAR INTERÉS EN OPCIÓN ESPECÍFICA
  if (/\b(el|la|ese|esa|este|esta)\s*(primero|primer|1|uno|lote|terreno|casa|opcion|opción)\b/i.test(mensajeLower) ||
      /\b(me interesa|me gusta|quiero)\s*(el|la|ese|esa)?\s*(primero|1|uno|lote|terreno|opcion)\b/i.test(mensajeLower) ||
      /^(el\s*)?(1|2|3|primero|segundo|tercero|uno|dos|tres)[\s.,]*$/i.test(mensaje.trim())) {
    datos.mostro_interes = true;
    log('👆', 'Detectado: cliente mostró interés en opción específica');
  }

  // DETECTAR PREGUNTA POR CITA EXISTENTE
  if (/\b(mi cita|la cita|cuando|a que hora|confirmame|confirmar|recordar|recordatorio)\b/i.test(mensajeLower)) {
    datos.pregunta_cita = true;
    log('📋', 'Detectado: cliente pregunta por su cita');
  }

  // DETECTAR QUIERE REAGENDAR
  if (/\b(cambiar|mover|reagendar|otra fecha|otro dia|otro día|posponer|adelantar)\s*(la cita|cita|fecha|hora)?\b/i.test(mensajeLower)) {
    datos.quiere_reagendar = true;
    log('🔄', 'Detectado: cliente quiere reagendar');
  }

  // DETECTAR FEEDBACK POST-CITA
  if (/\b(me fue|estuvo|gusto|gustó|excelente|bien|mal|no me|si me|la visita fue|fui a ver)\b/i.test(mensajeLower)) {
    datos.da_feedback = true;
    log('⭐', 'Detectado: cliente da feedback');
  }

  // DETECTAR QUIERE NUEVA BÚSQUEDA (cliente recurrente)
  if (/\b(otra propiedad|otro terreno|otra casa|algo diferente|busco ahora|necesito otro|tienes algo|ver otra|deseo ver|quiero ver)\b/i.test(mensajeLower)) {
    datos.nueva_busqueda = true;
    log('🔍', 'Detectado: cliente quiere nueva búsqueda');
  }

  // DETECTAR QUIERE CAMBIAR ZONA (limpiar zona anterior)
  if (/\b(otro lugar|otra zona|en otro|otro lado|diferente zona|otra ubicacion|otra ubicación|pero en)\b/i.test(mensajeLower)) {
    datos.cambiar_zona = true;
    log('📍', 'Detectado: cliente quiere cambiar zona');
  }

  // DETECTAR QUIERE CAMBIAR TIPO (limpiar tipo anterior)
  if (/\b(pero quiero|mejor quiero|prefiero|en vez de|no terreno|no casa|quiero casas? no|quiero terrenos? no)\b/i.test(mensajeLower)) {
    datos.cambiar_tipo = true;
    log('🏠', 'Detectado: cliente quiere cambiar tipo de propiedad');
  }

  return datos;
}

// ============================================================================
// ACTUALIZAR ESTADO CON NUEVOS DATOS DETECTADOS
// ============================================================================
function actualizarEstadoConDatos(estadoActual, datosNuevos) {
  let nuevaEtapa = estadoActual.etapa;
  
  // Determinar datos finales
  let tipoFinal = datosNuevos.tipo_propiedad || estadoActual.tipo_propiedad;
  let zonaFinal = datosNuevos.zona || estadoActual.zona;
  let presupuestoFinal = datosNuevos.presupuesto || estadoActual.presupuesto;
  
  // NUEVA BÚSQUEDA COMPLETA - Limpiar todo y empezar de cero
  if (datosNuevos.nueva_busqueda && !datosNuevos.tipo_propiedad && !datosNuevos.zona) {
    log('🆕', 'Nueva búsqueda detectada - limpiando datos anteriores');
    return {
      ...estadoActual,
      tipo_propiedad: '',
      zona: '',
      presupuesto: '',
      etapa: 'inicial',
      propiedad_interes: '',
      fecha_cita: ''
    };
  }
  
  // CAMBIAR ZONA - Limpiar zona y volver a preguntar
  if (datosNuevos.cambiar_zona && !datosNuevos.zona) {
    log('📍', 'Cambio de zona detectado - limpiando zona anterior');
    zonaFinal = '';  // Forzar a preguntar zona de nuevo
    nuevaEtapa = 'busqueda';
  }
  
  // CAMBIAR TIPO - Limpiar tipo y usar el nuevo si lo dio
  if (datosNuevos.cambiar_tipo) {
    log('🏠', 'Cambio de tipo detectado');
    if (datosNuevos.tipo_propiedad) {
      tipoFinal = datosNuevos.tipo_propiedad;
    } else {
      tipoFinal = '';  // Forzar a preguntar tipo de nuevo
    }
    nuevaEtapa = 'busqueda';
  }
  
  // CAMBIO DE OPINIÓN - Retroceder etapa
  if (datosNuevos.cambio_opinion || datosNuevos.quiere_cancelar) {
    log('🔄', 'Procesando cambio de opinión...');
    
    if (datosNuevos.quiere_cancelar) {
      // Cancelación: volver a interesado o búsqueda
      nuevaEtapa = tipoFinal ? 'busqueda' : 'inicial';
      log('📊', `Cancelación detectada. Etapa: ${nuevaEtapa}`);
    } else if (datosNuevos.tipo_propiedad && datosNuevos.tipo_propiedad !== estadoActual.tipo_propiedad) {
      // Cambió tipo de propiedad → reiniciar búsqueda
      nuevaEtapa = 'busqueda';
      log('📊', 'Nuevo tipo de propiedad. Etapa: busqueda');
    } else {
      // Quiere ver otras opciones del mismo tipo
      nuevaEtapa = 'busqueda';
      log('📊', 'Quiere otras opciones. Etapa: busqueda');
    }
    
    const estadoNuevo = {
      ...estadoActual,
      tipo_propiedad: tipoFinal,
      zona: zonaFinal,
      presupuesto: presupuestoFinal,
      etapa: nuevaEtapa,
      cambio_opinion: true
    };
    return estadoNuevo;
  }
  
  // CLIENTE CON CITA AGENDADA - Manejar diferentes intenciones
  if (estadoActual.etapa === 'cita_agendada') {
    log('📋', 'Cliente con cita agendada, analizando intención...');
    
    if (datosNuevos.quiere_reagendar) {
      // Quiere cambiar la cita → volver a esperando_fecha
      nuevaEtapa = 'esperando_fecha';
      log('📊', 'Reagendando. Etapa: esperando_fecha');
    } else if (datosNuevos.nueva_busqueda || datosNuevos.tipo_propiedad) {
      // Quiere buscar otra propiedad → nueva búsqueda
      nuevaEtapa = 'busqueda';
      // Limpiar datos anteriores si quiere algo completamente nuevo
      if (datosNuevos.tipo_propiedad && datosNuevos.tipo_propiedad !== estadoActual.tipo_propiedad) {
        tipoFinal = datosNuevos.tipo_propiedad;
        zonaFinal = datosNuevos.zona || '';
        presupuestoFinal = datosNuevos.presupuesto || '';
      }
      log('📊', 'Nueva búsqueda. Etapa: busqueda');
    } else if (datosNuevos.pregunta_cita || datosNuevos.da_feedback) {
      // Solo pregunta por cita o da feedback → mantener etapa
      nuevaEtapa = 'cita_agendada';
      log('📊', 'Consulta sobre cita existente. Etapa: cita_agendada');
    }
    // Si no detectamos intención específica, mantener cita_agendada
    
    const estadoNuevo = {
      ...estadoActual,
      tipo_propiedad: tipoFinal,
      zona: zonaFinal,
      presupuesto: presupuestoFinal,
      etapa: nuevaEtapa,
      nombre_cliente: datosNuevos.nombre_cliente || estadoActual.nombre_cliente || ''
    };
    return estadoNuevo;
  }
  
  const tieneTodosDatos = tipoFinal && zonaFinal && presupuestoFinal;
  
  // Lógica de etapas (en orden de prioridad)
  if (datosNuevos.tiene_fecha) {
    // Cliente dio fecha → listo para agendar
    nuevaEtapa = 'esperando_fecha';
    log('📊', 'Etapa actualizada: esperando_fecha');
  } else if (datosNuevos.quiere_agendar && estadoActual.etapa !== 'esperando_fecha') {
    // Cliente quiere agendar pero no dio fecha → pedir fecha
    nuevaEtapa = 'agendar';
    log('📊', 'Etapa actualizada: agendar');
  } else if (datosNuevos.mostro_interes) {
    // Cliente mostró interés en una opción
    nuevaEtapa = 'interesado';
    log('📊', 'Etapa actualizada: interesado');
  } else if (tieneTodosDatos && estadoActual.etapa === 'inicial') {
    // Tiene todos los datos, puede buscar
    nuevaEtapa = 'busqueda';
    log('📊', 'Etapa actualizada: busqueda');
  }
  
  const estadoNuevo = {
    ...estadoActual,
    tipo_propiedad: tipoFinal,
    zona: zonaFinal,
    presupuesto: presupuestoFinal,
    etapa: nuevaEtapa,
    // Agregar nombre si se detectó
    nombre_cliente: datosNuevos.nombre_cliente || estadoActual.nombre_cliente || ''
  };
  
  log('📋', 'Estado actualizado', { 
    antes: estadoActual.etapa, 
    despues: nuevaEtapa,
    datos: { tipo: tipoFinal, zona: zonaFinal, presupuesto: presupuestoFinal }
  });
  
  return estadoNuevo;
}

// ============================================================================
// HISTORIAL DE CONVERSACIÓN
// ============================================================================
async function obtenerHistorialConversacion(telefono, limite = CONFIG.HISTORIAL_LIMITE) {
  const telefonoNormalizado = normalizarTelefono(telefono);
  
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Mensajes!A:E'
    });

    const rows = response.data.values || [];
    
    // Filtrar mensajes del cliente (comparación flexible)
    const mensajesCliente = rows.filter(row => {
      const telEnSheet = row[1] || '';
      return telefonosCoinciden(telEnSheet, telefonoNormalizado);
    });
    
    log('📚', `Mensajes encontrados para ${telefonoNormalizado}: ${mensajesCliente.length} de ${rows.length} total`);

    // Tomar los últimos N mensajes (excluyendo el actual que aún no se ha procesado completamente)
    const historial = mensajesCliente.slice(-limite).map(row => ({
      timestamp: row[0],
      direccion: row[2], // 'inbound' o 'outbound'
      mensaje: row[3]
    }));

    log('📚', `Historial cargado: ${historial.length} mensajes`);
    return historial;
  } catch (error) {
    log('❌', 'Error al obtener historial', { error: error.message });
    return [];
  }
}

// ============================================================================
// GUARDAR MENSAJE EN HISTORIAL
// ============================================================================
async function guardarMensajeEnSheet({ telefono, direccion, mensaje, messageId }) {
  const telefonoNormalizado = normalizarTelefono(telefono);
  
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const timestamp = DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss');

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Mensajes!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { 
        values: [[timestamp, telefonoNormalizado, direccion, mensaje, messageId || '']] 
      }
    });

    return { success: true };
  } catch (error) {
    log('❌', 'Error al guardar mensaje', { error: error.message });
    return { success: false };
  }
}

// ============================================================================
// SYSTEM PROMPT PROFESIONAL COMPLETO
// ============================================================================
function construirSystemPrompt(estado) {
  const tipo = estado.tipo_propiedad || null;
  const zona = estado.zona || null;
  const presupuesto = estado.presupuesto || null;
  const etapa = estado.etapa || 'inicial';
  
  const ahora = DateTime.now().setZone(CONFIG.TIMEZONE);
  const fechaHoy = ahora.toFormat("EEEE d 'de' MMMM 'de' yyyy", { locale: 'es' });
  const horaActual = ahora.toFormat('HH:mm');

  // Determinar qué datos faltan
  const datosFaltantes = [];
  if (!tipo) datosFaltantes.push('tipo de propiedad');
  if (!zona) datosFaltantes.push('zona');
  if (!presupuesto) datosFaltantes.push('presupuesto');
  
  // Determinar la siguiente acción según el estado
  let instruccionEspecifica = '';
  
  if (datosFaltantes.length === 3) {
    instruccionEspecifica = `
<accion_requerida>
Este es un CLIENTE NUEVO. Tu única tarea ahora:
1. Saluda brevemente (máximo 1 línea)
2. Pregunta: "¿Qué tipo de propiedad te interesa? 🏠"
NO des información adicional hasta saber qué busca.
</accion_requerida>`;
  } else if (datosFaltantes.length > 0) {
    instruccionEspecifica = `
<accion_requerida>
Falta información. Pregunta SOLO por: ${datosFaltantes[0]}
NO repitas datos que ya tienes. NO des información de propiedades aún.
</accion_requerida>`;
  } else if (etapa === 'inicial' || etapa === 'busqueda') {
    instruccionEspecifica = `
<accion_requerida>
Ya tienes TODOS los datos (tipo: ${tipo}, zona: ${zona}, presupuesto: ${presupuesto}).
USA la herramienta "consultar_documentos" AHORA para buscar opciones.
Muestra máximo 2-3 opciones relevantes. Pregunta cuál le interesa.
</accion_requerida>`;
  } else if (etapa === 'interesado') {
    instruccionEspecifica = `
<accion_requerida>
El cliente ya mostró interés en una propiedad específica.
Si pregunta más detalles → dáselos brevemente.
Si dice "sí" o confirma interés → pregunta: "¿Qué día y hora te funcionaría para visitarlo? 📅"
NO vuelvas a listar todas las opciones.
</accion_requerida>`;
  } else if (etapa === 'agendar') {
    instruccionEspecifica = `
<accion_requerida>
El cliente QUIERE AGENDAR. Tu ÚNICA respuesta debe ser:
"¡Perfecto! 📅 ¿Qué día y hora te funcionaría para la visita?"
NO des más información. NO repitas detalles. SOLO pregunta la fecha.
</accion_requerida>`;
  } else if (etapa === 'esperando_fecha') {
    instruccionEspecifica = `
<accion_requerida>
Estás esperando que el cliente dé fecha/hora.
Cuando la dé, USA "agendar_cita" inmediatamente.
Convierte fechas relativas: "mañana" = ${ahora.plus({ days: 1 }).toFormat('yyyy-MM-dd')}
"pasado mañana" = ${ahora.plus({ days: 2 }).toFormat('yyyy-MM-dd')}
</accion_requerida>`;
  } else if (etapa === 'cita_agendada') {
    // Calcular días desde la cita
    const fechaCita = estado.fecha_cita ? DateTime.fromFormat(estado.fecha_cita.split(' ')[0], 'yyyy-MM-dd', { zone: CONFIG.TIMEZONE }) : null;
    const diasDesdeCita = fechaCita ? Math.floor(ahora.diff(fechaCita, 'days').days) : 0;
    
    instruccionEspecifica = `
<accion_requerida>
Este cliente YA TIENE UNA CITA AGENDADA.
Cita: ${estado.fecha_cita || 'fecha no registrada'}
Propiedad: ${estado.propiedad_interes || 'no especificada'}
Días desde la cita: ${diasDesdeCita}

COMPORTAMIENTO según lo que diga el cliente:

📋 SI PREGUNTA POR SU CITA:
→ "Tu cita está programada para ${estado.fecha_cita}. ¿Necesitas cambiarla?"

🔄 SI QUIERE REAGENDAR:
→ "¡Claro! ¿Qué nueva fecha y hora te funcionaría?"

⭐ SI PREGUNTA CÓMO LE FUE / DA FEEDBACK:
→ Agradece el feedback
→ Pregunta si quiere ver otra propiedad o agendar otra visita

🏠 SI PREGUNTA POR OTRA PROPIEDAD:
→ "¡Con gusto! ¿Qué tipo de propiedad te interesa ahora?"
→ Inicia nueva búsqueda (el sistema actualizará la etapa)

👋 SI SOLO SALUDA:
→ "¡Hola de nuevo! 😊 ¿Es sobre tu cita del ${estado.fecha_cita} o te interesa ver otras propiedades?"
</accion_requerida>`;
  } else if (etapa === 'seguimiento') {
    instruccionEspecifica = `
<accion_requerida>
Este es un cliente de SEGUIMIENTO (ya tuvo interacción previa hace días).
Historial: ${estado.notas || 'sin notas'}

Tu objetivo:
1. Saluda cordialmente recordando que ya platicaron
2. Pregunta si sigue interesado o busca algo diferente
3. Si quiere lo mismo → usa consultar_documentos
4. Si quiere algo nuevo → pregunta qué busca ahora
</accion_requerida>`;
  }

  return `Eres Ana, asesora inmobiliaria profesional.
Fecha actual: ${fechaHoy}, ${horaActual} hrs.

<perfil>
- Nombre: Ana
- Rol: Asesora inmobiliaria
- Estilo: Profesional, amable, concisa
- Objetivo: Ayudar al cliente a encontrar su propiedad ideal y agendar visitas
</perfil>

<datos_del_cliente>
- Teléfono: ${estado.telefono}
- Tipo de propiedad: ${tipo || '❌ Pendiente'}
- Zona de interés: ${zona || '❌ Pendiente'}
- Presupuesto: ${presupuesto || '❌ Pendiente'}
- Etapa actual: ${etapa}
</datos_del_cliente>

${instruccionEspecifica}

<reglas_de_oro>
1. NUNCA repitas información que ya diste en mensajes anteriores
2. NUNCA preguntes por datos que ya tienes confirmados arriba
3. NUNCA inventes fechas para agendar - espera que el cliente las dé
4. Respuestas CORTAS: máximo 4 líneas
5. Usa 1-2 emojis por mensaje (no más)
6. Cuando el cliente dice "sí" a algo, AVANZA al siguiente paso
7. Si el cliente cambia de tema o dice algo no relacionado, redirige amablemente
8. Si el cliente cambia de opinión o quiere ver otras opciones → NO te ofendas, ayúdalo con gusto
</reglas_de_oro>

<cambio_de_opinion>
Si el cliente dice algo como:
- "mejor veamos otra opción"
- "muy caro, tienes algo más económico?"
- "prefiero en otra zona"
- "ya no quiero agendar" / "mejor otro día"
- "mejor casas en lugar de terrenos"

Tu respuesta debe ser:
1. Acepta el cambio con actitud positiva: "¡Claro, sin problema! 😊"
2. Si cambió tipo/zona/presupuesto → confirma el nuevo criterio
3. Si quiere otras opciones → usa consultar_documentos de nuevo
4. Si cancela cita → "Perfecto, cuando estés listo me avisas 📱"
5. NUNCA presiones ni insistas en la opción anterior
</cambio_de_opinion>

<manejo_de_respuestas>
- "Hola" / Saludo → Saluda y pregunta qué tipo de propiedad busca
- Menciona tipo (casa/terreno/depto) → Guárdalo y pregunta zona
- Menciona zona → Guárdalo y pregunta presupuesto  
- Menciona presupuesto → Guárdalo y USA consultar_documentos
- "Me interesa el X" → Da detalles breves y pregunta si quiere agendar
- "Sí" / "Sí por favor" (para agendar) → Pregunta fecha y hora
- Da fecha/hora → USA agendar_cita y envía el link
- "No" / "Gracias" → Despídete cordialmente, ofrece ayuda futura
- Pregunta fuera de tema → "Con gusto te ayudo con eso después. ¿Continuamos con tu búsqueda de propiedad?"
</manejo_de_respuestas>

<conversion_fechas>
Hoy es ${fechaHoy}. Si el cliente dice:
- "mañana" → ${ahora.plus({ days: 1 }).toFormat('yyyy-MM-dd')}
- "pasado mañana" → ${ahora.plus({ days: 2 }).toFormat('yyyy-MM-dd')}
- "el viernes" → Calcula el próximo viernes
- "la próxima semana" → ${ahora.plus({ weeks: 1 }).toFormat('yyyy-MM-dd')}
- "el día X" → ${ahora.year}-${String(ahora.month).padStart(2, '0')}-XX (del mes actual o siguiente)
Hora por defecto si no especifica: 10:00
</conversion_fechas>

<formato_respuesta>
- Sé directo y conciso
- No hagas introducciones largas
- No repitas lo que el cliente ya sabe
- Termina con UNA pregunta o acción clara
</formato_respuesta>`;
}

// ============================================================================
// TOOLS PARA CLAUDE
// ============================================================================
const tools = [
  {
    name: 'consultar_documentos',
    description: 'Busca propiedades disponibles en el catálogo. USAR cuando ya tengas: tipo de propiedad + zona + presupuesto.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Tipo de propiedad (casa, terreno, etc.)' },
        zona: { type: 'string', description: 'Zona o ciudad' },
        presupuesto: { type: 'string', description: 'Presupuesto del cliente' }
      },
      required: ['tipo', 'zona', 'presupuesto']
    }
  },
  {
    name: 'agendar_cita',
    description: 'Agenda una visita a una propiedad. IMPORTANTE: Solo usar cuando el cliente YA HAYA PROPORCIONADO una fecha y hora específicas. Si el cliente dice "sí quiero agendar" pero NO ha dado fecha, NO uses esta herramienta - primero pregúntale qué día y hora le conviene.',
    input_schema: {
      type: 'object',
      properties: {
        resumen: { type: 'string', description: 'Título de la cita, ej: Visita a terreno en Zapopan' },
        fecha: { type: 'string', description: 'Fecha que el CLIENTE proporcionó. Formato: YYYY-MM-DD. NO inventes fechas.' },
        hora_inicio: { type: 'string', description: 'Hora que el CLIENTE proporcionó. Formato: HH:MM (24hrs)' },
        duracion_minutos: { type: 'number', description: 'Duración en minutos, default 60' }
      },
      required: ['resumen', 'fecha', 'hora_inicio']
    }
  }
];

// ============================================================================
// EJECUTAR HERRAMIENTA: CONSULTAR DOCUMENTOS
// ============================================================================
async function consultarDocumentos({ tipo, zona, presupuesto }) {
  log('🔍', 'Consultando documentos', { tipo, zona, presupuesto });
  
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/documents.readonly']);
    const docs = google.docs({ version: 'v1', auth });
    const docId = process.env.GOOGLE_DOCS_ID;

    const response = await docs.documents.get({ documentId: docId });
    let fullText = '';
    response.data.body.content.forEach(el => {
      if (el.paragraph) {
        el.paragraph.elements.forEach(e => {
          if (e.textRun) fullText += e.textRun.content;
        });
      }
    });

    return { 
      success: true, 
      content: fullText,
      busqueda: { tipo, zona, presupuesto }
    };
  } catch (error) {
    log('❌', 'Error en consultar_documentos', { error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EJECUTAR HERRAMIENTA: AGENDAR CITA
// ============================================================================
async function agendarCita({ resumen, fecha, hora_inicio, duracion_minutos = 60 }) {
  log('📅', '=== INICIANDO AGENDAR CITA ===');
  log('📅', 'Datos recibidos:', { resumen, fecha, hora_inicio, duracion_minutos });
  
  try {
    log('🔑', 'Obteniendo autenticación de Google...');
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/calendar']);
    
    log('📅', 'Creando cliente de Calendar...');
    const calendar = google.calendar({ version: 'v3', auth });
    
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    log('📅', `Calendar ID configurado: ${calendarId}`);
    
    if (!calendarId) {
      log('❌', 'GOOGLE_CALENDAR_ID no está definido!');
      return { success: false, error: 'GOOGLE_CALENDAR_ID no configurado' };
    }

    // DIAGNÓSTICO: Verificar acceso al calendario
    try {
      log('🔍', 'Verificando acceso al calendario...');
      const calendarInfo = await calendar.calendars.get({ calendarId });
      log('✅', `Calendario encontrado: "${calendarInfo.data.summary}" (ID: ${calendarInfo.data.id})`);
      log('📋', `Zona horaria del calendario: ${calendarInfo.data.timeZone}`);
      log('📋', `Acceso: ${calendarInfo.data.accessRole || 'no especificado'}`);
    } catch (calError) {
      log('⚠️', `Error al verificar calendario: ${calError.message}`);
      log('⚠️', 'Esto puede indicar que el Service Account no tiene acceso al calendario');
    }

    const [year, month, day] = fecha.split('-').map(Number);
    const [horas, minutos] = hora_inicio.split(':').map(Number);

    const inicio = DateTime.fromObject(
      { year, month, day, hour: horas, minute: minutos }, 
      { zone: CONFIG.TIMEZONE }
    );
    const fin = inicio.plus({ minutes: duracion_minutos });
    
    log('📅', `Inicio: ${inicio.toISO()}, Fin: ${fin.toISO()}`);

    const eventData = {
      summary: resumen,
      start: { dateTime: inicio.toISO(), timeZone: CONFIG.TIMEZONE },
      end: { dateTime: fin.toISO(), timeZone: CONFIG.TIMEZONE },
      // Agregar descripción para identificar el evento
      description: `Cita agendada automáticamente por el Agente WhatsApp.\nFecha de creación: ${DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss')}`
    };
    log('📅', 'Evento a crear:', eventData);

    log('📅', 'Insertando evento en Google Calendar...');
    const result = await calendar.events.insert({
      calendarId,
      requestBody: eventData
    });

    log('✅', '=== CITA AGENDADA EXITOSAMENTE ===');
    log('✅', `Event ID: ${result.data.id}`);
    log('✅', `Event Link: ${result.data.htmlLink}`);
    log('✅', `Organizador: ${result.data.organizer?.email}`);
    log('✅', `Creador: ${result.data.creator?.email}`);
    log('✅', `Status: ${result.data.status}`);
    
    // Verificar que el evento se creó listando eventos
    try {
      const eventCheck = await calendar.events.get({
        calendarId,
        eventId: result.data.id
      });
      log('✅', `Evento verificado en calendario: ${eventCheck.data.summary}`);
    } catch (verifyError) {
      log('⚠️', `No se pudo verificar el evento: ${verifyError.message}`);
    }
    
    return { 
      success: true, 
      mensaje: `Cita agendada exitosamente para el ${inicio.toFormat("d 'de' MMMM 'a las' HH:mm", { locale: 'es' })}`,
      eventLink: result.data.htmlLink,
      eventId: result.data.id,
      instruccion: 'DEBES incluir este link en tu respuesta al cliente para que pueda agregarlo a su calendario'
    };
  } catch (error) {
    log('❌', '=== ERROR EN AGENDAR CITA ===');
    log('❌', `Error: ${error.message}`);
    log('❌', `Código de error: ${error.code}`);
    log('❌', `Detalles: ${JSON.stringify(error.errors || {})}`);
    log('❌', `Stack: ${error.stack?.substring(0, 500)}`);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CONSTRUIR MENSAJES PARA CLAUDE (con alternancia correcta)
// ============================================================================
function construirMensajesParaClaude(historial, mensajeActual, estado) {
  let messages = [];
  
  // Agregar historial previo con alternancia correcta
  if (historial.length > 0) {
    let lastRole = null;
    
    for (const msg of historial) {
      const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
      const contenido = msg.mensaje?.trim();
      
      if (!contenido) continue;
      
      // Fusionar mensajes consecutivos del mismo rol
      if (role === lastRole && messages.length > 0) {
        messages[messages.length - 1].content += '\n' + contenido;
      } else {
        messages.push({ role, content: contenido });
        lastRole = role;
      }
    }
    
    // Asegurar que termine en 'assistant' para que el nuevo 'user' alterne
    while (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      messages.pop();
    }
  }
  
  // Agregar mensaje actual con contexto de estado
  const tipo = estado.tipo_propiedad || 'NO_DEFINIDO';
  const zona = estado.zona || 'NO_DEFINIDO';
  const presupuesto = estado.presupuesto || 'NO_DEFINIDO';
  
  const mensajeConContexto = `[Estado actual del cliente: tipo=${tipo}, zona=${zona}, presupuesto=${presupuesto}]

Mensaje del cliente: ${mensajeActual}`;
  
  messages.push({ role: 'user', content: mensajeConContexto });
  
  return messages;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { Body, From, MessageSid } = req.body;
  
  if (!Body || !From) {
    return res.status(400).json({ error: 'Faltan parámetros Body o From' });
  }

  const telefono = normalizarTelefono(From);
  
  log('═══════════════════════════════════════════════════════════════');
  log('📨', `NUEVO MENSAJE de ${telefono}`);
  log('📝', `Contenido: "${Body}"`);
  log('═══════════════════════════════════════════════════════════════');

  // Guardar mensaje entrante
  await guardarMensajeEnSheet({ 
    telefono, 
    direccion: 'inbound', 
    mensaje: Body, 
    messageId: MessageSid 
  });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // 1. Obtener estado actual
    log('📖', 'PASO 1: Obteniendo estado del cliente...');
    let estadoActual = await obtenerEstadoConversacion(telefono);

    // 2. Verificar si la sesión expiró (auto-reset después de 24 horas)
    if (sesionExpirada(estadoActual.ultima_actualizacion) && estadoActual.tipo_propiedad) {
      log('⏰', 'Sesión expirada, reseteando estado automáticamente');
      estadoActual = await resetearEstadoCliente(telefono);
    }
    
    // 2.5 Verificar cliente inactivo para seguimiento (7+ días sin interacción)
    const ahora = DateTime.now().setZone(CONFIG.TIMEZONE);
    if (estadoActual.ultima_actualizacion && estadoActual.etapa !== 'inicial') {
      const ultimaInteraccion = DateTime.fromFormat(
        estadoActual.ultima_actualizacion.split(' ')[0], 
        'yyyy-MM-dd', 
        { zone: CONFIG.TIMEZONE }
      );
      const diasInactivo = Math.floor(ahora.diff(ultimaInteraccion, 'days').days);
      
      if (diasInactivo >= 7 && estadoActual.etapa !== 'seguimiento') {
        log('📅', `Cliente inactivo por ${diasInactivo} días. Cambiando a seguimiento.`);
        estadoActual.etapa = 'seguimiento';
        estadoActual.notas = `${estadoActual.notas || ''} | Inactivo ${diasInactivo} días - ${ahora.toFormat('dd/MM/yyyy')}`;
        await guardarEstadoConversacion(estadoActual);
      }
    }

    // 3. Procesar comandos especiales
    log('🎯', 'PASO 2: Verificando comandos especiales...');
    const comandoResult = await procesarComandoEspecial(Body, telefono, estadoActual);
    
    if (comandoResult.esComando) {
      log('⚡', 'Comando especial detectado, respondiendo directamente');
      
      // Enviar respuesta del comando
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const twilioMsg = await client.messages.create({
        from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
        to: From,
        body: comandoResult.respuesta
      });
      
      await guardarMensajeEnSheet({ 
        telefono, 
        direccion: 'outbound', 
        mensaje: comandoResult.respuesta, 
        messageId: twilioMsg.sid 
      });
      
      log('✅', 'Comando procesado exitosamente');
      return res.status(200).json({ success: true, comando: true });
    }

    // 4. Detectar datos en el mensaje actual
    log('🔍', 'PASO 3: Detectando datos en mensaje...');
    const datosDetectados = detectarDatosEnMensaje(Body);
    log('🎯', 'Datos detectados', datosDetectados);

    // 5. Actualizar estado con datos detectados
    const estadoActualizado = actualizarEstadoConDatos(estadoActual, datosDetectados);
    
    // Si hay cambios, guardar inmediatamente
    if (Object.keys(datosDetectados).length > 0) {
      log('💾', 'PASO 4: Guardando estado actualizado...');
      await guardarEstadoConversacion(estadoActualizado);
    }
    
    log('📋', 'Estado final', estadoActualizado);

    // 6. Obtener historial
    log('📚', 'PASO 5: Obteniendo historial...');
    const historial = await obtenerHistorialConversacion(telefono);

    // 7. Construir mensajes para Claude
    log('🔧', 'PASO 6: Construyendo mensajes para Claude...');
    const messages = construirMensajesParaClaude(historial, Body, estadoActualizado);
    log('📝', `Mensajes construidos: ${messages.length}`);
    log('📝', 'Roles: ' + messages.map(m => m.role).join(' → '));

    // 8. Construir system prompt
    const systemPrompt = construirSystemPrompt(estadoActualizado);
    log('📋', 'System prompt construido');

    // 9. Llamar a Claude
    log('🤖', 'PASO 7: Llamando a Claude...');
    let response = await anthropic.messages.create({
      model: CONFIG.MODEL,
      max_tokens: CONFIG.MAX_TOKENS,
      system: systemPrompt,
      tools,
      messages
    });

    // 10. Procesar tool calls si las hay
    let iteraciones = 0;
    const MAX_ITERACIONES = 3;
    let citaAgendadaInfo = null;  // Para guardar info de la cita
    
    while (response.stop_reason === 'tool_use' && iteraciones < MAX_ITERACIONES) {
      iteraciones++;
      const toolUse = response.content.find(b => b.type === 'tool_use');
      
      if (!toolUse) break;

      log('🔧', `Tool call #${iteraciones}: ${toolUse.name}`, toolUse.input);
      
      let toolResult;
      if (toolUse.name === 'consultar_documentos') {
        toolResult = await consultarDocumentos(toolUse.input);
      } else if (toolUse.name === 'agendar_cita') {
        toolResult = await agendarCita(toolUse.input);
        // Guardar info de la cita para actualizar estado después
        if (toolResult.success) {
          citaAgendadaInfo = {
            fecha: toolUse.input.fecha,
            hora: toolUse.input.hora_inicio,
            propiedad: toolUse.input.resumen
          };
        }
      } else {
        toolResult = { error: 'Tool no reconocida' };
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ 
        role: 'user', 
        content: [{ 
          type: 'tool_result', 
          tool_use_id: toolUse.id, 
          content: JSON.stringify(toolResult) 
        }] 
      });

      response = await anthropic.messages.create({
        model: CONFIG.MODEL,
        max_tokens: CONFIG.MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages
      });
    }

    // 9. Extraer respuesta final
    const respuestaTexto = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    log('💬', 'Respuesta de Claude', { respuesta: respuestaTexto.substring(0, 200) + '...' });

    // 10. Detectar si hubo cita agendada y actualizar estado con TODOS los datos
    if (citaAgendadaInfo) {
      estadoActualizado.etapa = 'cita_agendada';
      estadoActualizado.fecha_cita = `${citaAgendadaInfo.fecha} ${citaAgendadaInfo.hora}`;
      estadoActualizado.propiedad_interes = citaAgendadaInfo.propiedad;
      estadoActualizado.notas = `Cita confirmada el ${DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('dd/MM/yyyy HH:mm')}`;
      await guardarEstadoConversacion(estadoActualizado);
      log('📅', 'Estado actualizado: cita_agendada con fecha:', citaAgendadaInfo);
    }
    
    // 11. Detectar cambio de etapa basado en la respuesta
    const respuestaLower = respuestaTexto.toLowerCase();
    if (respuestaLower.includes('qué día') || respuestaLower.includes('qué fecha') || respuestaLower.includes('qué hora')) {
      if (estadoActualizado.etapa !== 'esperando_fecha') {
        estadoActualizado.etapa = 'esperando_fecha';
        estadoActualizado.ultima_interaccion = new Date().toISOString();
        await guardarEstadoConversacion(estadoActualizado);
        log('📅', 'Estado actualizado: esperando_fecha (detectado en respuesta)');
      }
    }

    // 12. Enviar por WhatsApp
    log('📤', 'PASO 8: Enviando respuesta por WhatsApp...');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioMsg = await client.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: From,
      body: respuestaTexto
    });

    // 13. Guardar respuesta en historial
    await guardarMensajeEnSheet({ 
      telefono, 
      direccion: 'outbound', 
      mensaje: respuestaTexto, 
      messageId: twilioMsg.sid 
    });

    log('✅', 'PROCESO COMPLETADO EXITOSAMENTE');
    log('═══════════════════════════════════════════════════════════════');
    
    return res.status(200).json({ success: true });

  } catch (error) {
    log('❌', 'ERROR CRÍTICO', { 
      message: error.message, 
      stack: error.stack?.substring(0, 500) 
    });
    return res.status(500).json({ error: error.message });
  }
}
