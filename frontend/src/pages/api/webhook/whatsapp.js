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
  TIMEZONE: 'America/Mexico_City'
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

  const credentialsRaw = fs.readFileSync(keyFile, 'utf8');
  const credentials = JSON.parse(credentialsRaw);

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
      range: 'Estados!A:G'
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
        ultima_actualizacion: estadoRow[6] || ''
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
      ultima_actualizacion: ''
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
      ultima_actualizacion: ''
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
    const rowData = [
      telefonoNormalizado,
      estado.tipo_propiedad || '',
      estado.zona || '',
      estado.presupuesto || '',
      estado.etapa || 'inicial',
      estado.resumen || '',
      timestamp
    ];

    if (rowIndex > -1) {
      log('🔄', `Actualizando fila ${rowIndex + 1}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Estados!A${rowIndex + 1}:G${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
      });
    } else {
      log('➕', 'Creando nueva fila de estado');
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Estados!A:G',
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
// DETECCIÓN AUTOMÁTICA DE DATOS EN MENSAJE
// ============================================================================
function detectarDatosEnMensaje(mensaje) {
  const mensajeLower = mensaje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let datos = {};
  
  // Detectar si es un cambio de opinión (para logging)
  const esCambioOpinion = /mejor|cambio|cambie|prefiero|en realidad|ya no|ahora quiero|pensandolo bien/.test(mensajeLower);
  if (esCambioOpinion) {
    log('🔄', 'Detectado posible cambio de opinión');
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

  return datos;
}

// ============================================================================
// ACTUALIZAR ESTADO CON NUEVOS DATOS DETECTADOS
// ============================================================================
function actualizarEstadoConDatos(estadoActual, datosNuevos) {
  return {
    ...estadoActual,
    tipo_propiedad: datosNuevos.tipo_propiedad || estadoActual.tipo_propiedad,
    zona: datosNuevos.zona || estadoActual.zona,
    presupuesto: datosNuevos.presupuesto || estadoActual.presupuesto
  };
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
// SYSTEM PROMPT PROFESIONAL (basado en documentación de Anthropic)
// ============================================================================
function construirSystemPrompt(estado) {
  const tipo = estado.tipo_propiedad || null;
  const zona = estado.zona || null;
  const presupuesto = estado.presupuesto || null;
  
  // Construir contexto del cliente
  let clienteContext = '';
  if (tipo || zona || presupuesto) {
    clienteContext = `
<cliente_datos_confirmados>
${tipo ? `- Tipo de propiedad: ${tipo}` : '- Tipo de propiedad: [PENDIENTE]'}
${zona ? `- Zona: ${zona}` : '- Zona: [PENDIENTE]'}
${presupuesto ? `- Presupuesto: ${presupuesto}` : '- Presupuesto: [PENDIENTE]'}
</cliente_datos_confirmados>`;
  }

  // Determinar siguiente acción
  let siguienteAccion = '';
  if (!tipo && !zona && !presupuesto) {
    siguienteAccion = 'Este es un cliente nuevo. Saluda brevemente y pregunta qué tipo de propiedad busca.';
  } else if (!tipo) {
    siguienteAccion = 'Pregunta qué tipo de propiedad busca (casa, terreno, departamento, etc.)';
  } else if (!zona) {
    siguienteAccion = 'Pregunta en qué zona o ciudad le gustaría encontrar la propiedad.';
  } else if (!presupuesto) {
    siguienteAccion = 'Pregunta cuál es su presupuesto aproximado.';
  } else {
    siguienteAccion = 'Ya tienes todos los datos. USA LA HERRAMIENTA consultar_documentos para buscar propiedades disponibles.';
  }

  return `Eres Ana, una asesora inmobiliaria profesional y amable.

<tu_objetivo>
Ayudar al cliente a encontrar la propiedad ideal recopilando 3 datos esenciales:
1. Tipo de propiedad (casa, terreno, departamento, local)
2. Zona o ciudad de interés
3. Presupuesto aproximado
</tu_objetivo>

${clienteContext}

<siguiente_accion>
${siguienteAccion}
</siguiente_accion>

<reglas_criticas>
1. NUNCA preguntes por un dato que ya está confirmado arriba
2. Si el cliente ya proporcionó un dato en este mensaje, NO lo vuelvas a preguntar
3. Respuestas cortas: máximo 2-3 oraciones
4. Usa 1-2 emojis por mensaje
5. Si tienes los 3 datos, DEBES usar la herramienta consultar_documentos
6. CAMBIOS DE OPINIÓN: Si el cliente dice "mejor quiero casa" o "cambié, prefiero terreno", 
   acepta el cambio naturalmente con algo como "¡Perfecto! Ahora buscaremos [nuevo tipo]..."
   El sistema ya actualizó el estado, solo confirma el cambio amablemente.
</reglas_criticas>

<formato_respuesta>
- Sé conciso y directo
- No hagas listas largas de opciones
- No repitas información que el cliente ya dio
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
    description: 'Agenda una visita a una propiedad cuando el cliente confirme interés.',
    input_schema: {
      type: 'object',
      properties: {
        resumen: { type: 'string' },
        fecha: { type: 'string', description: 'Formato: YYYY-MM-DD' },
        hora_inicio: { type: 'string', description: 'Formato: HH:MM' },
        duracion_minutos: { type: 'number' }
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
  log('📅', 'Agendando cita', { resumen, fecha, hora_inicio });
  
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    const [year, month, day] = fecha.split('-').map(Number);
    const [horas, minutos] = hora_inicio.split(':').map(Number);

    const inicio = DateTime.fromObject(
      { year, month, day, hour: horas, minute: minutos }, 
      { zone: CONFIG.TIMEZONE }
    );
    const fin = inicio.plus({ minutes: duracion_minutos });

    const result = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: resumen,
        start: { dateTime: inicio.toISO(), timeZone: CONFIG.TIMEZONE },
        end: { dateTime: fin.toISO(), timeZone: CONFIG.TIMEZONE }
      }
    });

    return { success: true, eventLink: result.data.htmlLink };
  } catch (error) {
    log('❌', 'Error en agendar_cita', { error: error.message });
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
    const estadoActual = await obtenerEstadoConversacion(telefono);

    // 2. Detectar datos en el mensaje actual
    log('🔍', 'PASO 2: Detectando datos en mensaje...');
    const datosDetectados = detectarDatosEnMensaje(Body);
    log('🎯', 'Datos detectados', datosDetectados);

    // 3. Actualizar estado con datos detectados
    const estadoActualizado = actualizarEstadoConDatos(estadoActual, datosDetectados);
    
    // Si hay cambios, guardar inmediatamente
    if (Object.keys(datosDetectados).length > 0) {
      log('💾', 'PASO 3: Guardando estado actualizado...');
      await guardarEstadoConversacion(estadoActualizado);
    }
    
    log('📋', 'Estado final', estadoActualizado);

    // 4. Obtener historial
    log('📚', 'PASO 4: Obteniendo historial...');
    const historial = await obtenerHistorialConversacion(telefono);

    // 5. Construir mensajes para Claude
    log('🔧', 'PASO 5: Construyendo mensajes para Claude...');
    const messages = construirMensajesParaClaude(historial, Body, estadoActualizado);
    log('📝', `Mensajes construidos: ${messages.length}`);
    log('📝', 'Roles: ' + messages.map(m => m.role).join(' → '));

    // 6. Construir system prompt
    const systemPrompt = construirSystemPrompt(estadoActualizado);
    log('📋', 'System prompt construido');

    // 7. Llamar a Claude
    log('🤖', 'PASO 6: Llamando a Claude...');
    let response = await anthropic.messages.create({
      model: CONFIG.MODEL,
      max_tokens: CONFIG.MAX_TOKENS,
      system: systemPrompt,
      tools,
      messages
    });

    // 8. Procesar tool calls si las hay
    let iteraciones = 0;
    const MAX_ITERACIONES = 3;
    
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

    // 10. Enviar por WhatsApp
    log('📤', 'PASO 7: Enviando respuesta por WhatsApp...');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioMsg = await client.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: From,
      body: respuestaTexto
    });

    // 11. Guardar respuesta en historial
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
