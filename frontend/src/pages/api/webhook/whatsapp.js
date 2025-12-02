import { Anthropic } from '@anthropic-ai/sdk';
import twilio from 'twilio';
import { google } from 'googleapis';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';

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

async function obtenerEstadoConversacion(telefono) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Estados!A:G'
    });

    const rows = response.data.values || [];
    const estadoRow = rows.find(row => row[0] === telefono);

    if (estadoRow) {
      return {
        telefono: estadoRow[0],
        tipo_propiedad: estadoRow[1] || '',
        zona: estadoRow[2] || '',
        presupuesto: estadoRow[3] || '',
        etapa: estadoRow[4] || 'inicial',
        resumen: estadoRow[5] || '',
        ultima_actualizacion: estadoRow[6] || ''
      };
    }

    return {
      telefono,
      tipo_propiedad: '',
      zona: '',
      presupuesto: '',
      etapa: 'inicial',
      resumen: '',
      ultima_actualizacion: ''
    };
  } catch (error) {
    console.error('Error obtener estado:', error.message);
    return {
      telefono,
      tipo_propiedad: '',
      zona: '',
      presupuesto: '',
      etapa: 'inicial',
      resumen: '',
      ultima_actualizacion: ''
    };
  }
}

async function guardarEstadoConversacion(estado) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Estados!A:A'
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === estado.telefono);

    const timestamp = DateTime.now().setZone('America/Mexico_City').toFormat('yyyy-MM-dd HH:mm:ss');
    const rowData = [
      estado.telefono,
      estado.tipo_propiedad || '',
      estado.zona || '',
      estado.presupuesto || '',
      estado.etapa || 'inicial',
      estado.resumen || '',
      timestamp
    ];

    if (rowIndex > -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Estados!A${rowIndex + 1}:G${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Estados!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
      });
    }

    console.log('💾 Estado guardado para', estado.telefono);
    return { success: true };
  } catch (error) {
    console.error('Error guardar estado:', error.message);
    return { success: false };
  }
}

function construirPromptConEstado(estado) {
  // Construir sección de información ya conocida
  let infoConocida = [];
  if (estado.tipo_propiedad) infoConocida.push(`✅ Tipo de propiedad: ${estado.tipo_propiedad}`);
  if (estado.zona) infoConocida.push(`✅ Zona: ${estado.zona}`);
  if (estado.presupuesto) infoConocida.push(`✅ Presupuesto: ${estado.presupuesto}`);
  
  let infoFaltante = [];
  if (!estado.tipo_propiedad) infoFaltante.push('❌ Tipo de propiedad (casa/terreno/departamento)');
  if (!estado.zona) infoFaltante.push('❌ Zona o ciudad');
  if (!estado.presupuesto) infoFaltante.push('❌ Presupuesto');

  return `Eres un asesor inmobiliario profesional en WhatsApp.

═══════════════════════════════════════════════
📋 INFORMACIÓN QUE YA TIENES DEL CLIENTE:
${infoConocida.length > 0 ? infoConocida.join('\n') : '(Ninguna todavía)'}

📝 INFORMACIÓN QUE AÚN FALTA:
${infoFaltante.length > 0 ? infoFaltante.join('\n') : '(¡Ya tienes todo!)'}
═══════════════════════════════════════════════

🎯 INSTRUCCIONES CRÍTICAS:

1. **NUNCA vuelvas a preguntar información marcada con ✅**
   (EXCEPTO si el cliente dice "cambio de opinión" o "prefiero otro")
   
2. **Si ya tienes los 3 datos** → Usa INMEDIATAMENTE 'consultar_documentos'
   → NO respondas con texto
   → NO preguntes confirmaciones
   → USA LA HERRAMIENTA DIRECTO
   
3. **Si te falta información** (marcada con ❌):
   → Pregunta SOLO UNO de los datos que faltan
   → Una pregunta corta
   
4. **Después de usar consultar_documentos:**
5. **Respuestas cortas**: Máximo 2 líneas de texto

6. **Al final de tu respuesta**, incluye:
   [ESTADO]{"tipo":"${estado.tipo_propiedad || ''}","zona":"${estado.zona || ''}","presupuesto":"${estado.presupuesto || ''}"}[/ESTADO]

═══════════════════════════════════════════════
❌ EJEMPLO DE LO QUE NO DEBES HACER:

Cliente: "terreno en Zapopan de 2 millones"
[Tienes: ✅tipo ✅zona ✅presupuesto]
Tú: "¿Qué tipo buscas?" ← ❌ YA LO TIENES, USA LA HERRAMIENTA

✅ EJEMPLO CORRECTO:

Cliente: "terreno en Zapopan de 2 millones"  
[Tienes: ✅tipo ✅zona ✅presupuesto]
Tú: [USAS consultar_documentos con query="terrenos Zapopan 2 millones"]
Tú: "Encontré estas opciones: 🏡 Terreno 250m²..."`;
}

function extraerEstadoDeRespuesta(respuesta, estadoActual) {
  const regex = /\[ESTADO\](.*?)\[\/ESTADO\]/s;
  const match = respuesta.match(regex);

  if (match) {
    try {
      const nuevosDatos = JSON.parse(match[1]);
      return {
        ...estadoActual,
        tipo_propiedad: nuevosDatos.tipo || estadoActual.tipo_propiedad || '',
        zona: nuevosDatos.zona || estadoActual.zona || '',
        presupuesto: nuevosDatos.presupuesto || estadoActual.presupuesto || ''
      };
    } catch (e) {
      console.error('Error parsing estado:', e);
    }
  }

  return estadoActual;
}

// Función auxiliar para detectar información del mensaje del usuario
function detectarInformacionDelMensaje(mensaje, estadoActual) {
  const mensajeLower = mensaje.toLowerCase();
  let nuevoEstado = { ...estadoActual };
  
  // Detectar si el usuario está CAMBIANDO información (palabras clave)
  const esCambio = mensajeLower.match(/\b(mejor|ahora|cambio|cambi[oó]|prefiero|en realidad|corrección|correcci[oó]n|no\s*,?\s*(quiero|busco|prefiero)|en vez de|instead)\b/);
  
  // Detectar tipo de propiedad (más variaciones)
  const tipoDetectado = 
    mensajeLower.match(/\b(terreno|lote|predio)s?\b/) ? 'terreno' :
    mensajeLower.match(/\b(casa|residencia|vivienda)s?\b/) ? 'casa' :
    mensajeLower.match(/\b(departamento|depto|piso|apartamento)s?\b/) ? 'departamento' :
    null;
  
  // Solo actualizar si: NO tiene valor previo O está cambiando explícitamente
  if (tipoDetectado) {
    if (!nuevoEstado.tipo_propiedad) {
      // No tenía valor, asignar
      nuevoEstado.tipo_propiedad = tipoDetectado;
    } else if (esCambio) {
      // Tiene valor PERO usuario dice "mejor", "ahora", "prefiero", etc.
      console.log(`🔄 Usuario cambió tipo: ${nuevoEstado.tipo_propiedad} → ${tipoDetectado}`);
      nuevoEstado.tipo_propiedad = tipoDetectado;
    }
    // Si ya tiene valor y NO hay palabra de cambio, mantener el original
  }
  
  // Detectar zona (ciudades conocidas de Jalisco) - más flexible
  const zonas = [
    { pattern: /\b(zapopan)\b/, nombre: 'Zapopan' },
    { pattern: /\b(guadalajara|gdl)\b/, nombre: 'Guadalajara' },
    { pattern: /\b(tlaquepaque)\b/, nombre: 'Tlaquepaque' },
    { pattern: /\b(tonalá|tonala)\b/, nombre: 'Tonalá' },
    { pattern: /\b(tlajomulco)\b/, nombre: 'Tlajomulco' },
    { pattern: /\b(el salto)\b/, nombre: 'El Salto' }
  ];
  
  let zonaDetectada = null;
  for (const zona of zonas) {
    if (zona.pattern.test(mensajeLower)) {
      zonaDetectada = zona.nombre;
      break;
    }
  }
  
  if (zonaDetectada) {
    if (!nuevoEstado.zona) {
      nuevoEstado.zona = zonaDetectada;
    } else if (esCambio) {
      console.log(`🔄 Usuario cambió zona: ${nuevoEstado.zona} → ${zonaDetectada}`);
      nuevoEstado.zona = zonaDetectada;
    }
  }
  
  // Detectar presupuesto (más formatos)
  let presupuestoDetectado = null;
  
  // Formato: "2 millones", "3.5 millones", "medio millón"
  const matchMillon = mensajeLower.match(/(\d+(?:\.\d+)?)\s*mill(?:ones|ón)?/);
  if (matchMillon) {
    presupuestoDetectado = `${matchMillon[1]} millones`;
  }
  
  // Formato: "500 mil", "800k"
  const matchMil = mensajeLower.match(/(\d+)\s*(?:mil|k)\b/);
  if (matchMil && !presupuestoDetectado) {
    presupuestoDetectado = `${matchMil[1]} mil pesos`;
  }
  
  // Formato: "$450,000", "450000 pesos"
  const matchNumero = mensajeLower.match(/\$?\s*(\d{1,3}(?:,\d{3})+)/);
  if (matchNumero && !presupuestoDetectado) {
    presupuestoDetectado = `$${matchNumero[1]}`;
  }
  
  // Formato: "medio millón", "un millón"
  if (mensajeLower.includes('medio millón') || mensajeLower.includes('medio millon')) {
    presupuestoDetectado = '0.5 millones';
  } else if (mensajeLower.match(/\bun millón\b/) || mensajeLower.match(/\bun millon\b/)) {
    presupuestoDetectado = '1 millón';
  }
  
  if (presupuestoDetectado) {
    if (!nuevoEstado.presupuesto) {
      nuevoEstado.presupuesto = presupuestoDetectado;
    } else if (esCambio) {
      console.log(`🔄 Usuario cambió presupuesto: ${nuevoEstado.presupuesto} → ${presupuestoDetectado}`);
      nuevoEstado.presupuesto = presupuestoDetectado;
    }
  }
  
  return nuevoEstado;
}

function limpiarRespuesta(respuesta) {
  return respuesta.replace(/\[ESTADO\].*?\[\/ESTADO\]/s, '').trim();
}

const tools = [
  {
    name: 'consultar_documentos',
    description: 'DEBES usar esta herramienta INMEDIATAMENTE cuando tengas los 3 datos: tipo + zona + presupuesto. NO preguntes nada más, USA LA HERRAMIENTA.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Búsqueda (ej: "terrenos Zapopan 2 millones")' }
      },
      required: ['query']
    }
  },
  {
    name: 'agendar_cita',
    description: 'Agenda visita cuando el cliente CONFIRME interés en una propiedad específica.',
    input_schema: {
      type: 'object',
      properties: {
        resumen: { type: 'string' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora_inicio: { type: 'string', description: 'HH:MM' },
        duracion_minutos: { type: 'number' }
      },
      required: ['resumen', 'fecha', 'hora_inicio']
    }
  }
];

async function consultarDocumentos({ query }) {
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

    return { success: true, content: fullText, query };
  } catch (error) {
    console.error('Error docs:', error);
    return { success: false, error: error.message };
  }
}

async function obtenerHistorialConversacion(telefono, limite = 10) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Mensajes!A:E'
    });

    const rows = response.data.values || [];

    const mensajesCliente = rows
      .filter(row => row[1] === telefono && row[3])
      .slice(-limite);

    return mensajesCliente.map(row => ({
      direccion: row[2],
      mensaje: row[3]
    }));
  } catch (error) {
    console.error('Error historial:', error);
    return [];
  }
}

async function guardarMensajeEnSheet({ telefono, direccion, mensaje, messageId }) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const timestamp = DateTime.now().setZone('America/Mexico_City').toFormat('yyyy-MM-dd HH:mm:ss');

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Mensajes!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[timestamp, telefono, direccion, mensaje, messageId || '']] }
    });
    return { success: true };
  } catch (error) {
    console.error('Error guardar:', error);
    return { success: false };
  }
}

async function agendarCita({ resumen, fecha, hora_inicio, duracion_minutos = 60 }) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/calendar']);
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    const [year, month, day] = fecha.split('-').map(Number);
    const [horas, minutos] = hora_inicio.split(':').map(Number);

    const inicio = DateTime.fromObject({ year, month, day, hour: horas, minute: minutos }, { zone: 'America/Mexico_City' });
    const fin = inicio.plus({ minutes: duracion_minutos });

    const result = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: resumen,
        start: { dateTime: inicio.toISO(), timeZone: 'America/Mexico_City' },
        end: { dateTime: fin.toISO(), timeZone: 'America/Mexico_City' }
      }
    });

    return { success: true, eventLink: result.data.htmlLink };
  } catch (error) {
    console.error('Error cita:', error);
    return { success: false, error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { Body, From, MessageSid } = req.body;
  if (!Body || !From) return res.status(400).json({ error: 'Faltan params' });

  const telefono = From.replace('whatsapp:', '');
  console.log('📨 Mensaje de', telefono, ':', Body);

  await guardarMensajeEnSheet({ telefono, direccion: 'inbound', mensaje: Body, messageId: MessageSid });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const estado = await obtenerEstadoConversacion(telefono);
    
    // IMPORTANTE: Detectar información del mensaje ACTUAL antes de enviar a Claude
    const estadoActualizado = detectarInformacionDelMensaje(Body, estado);
    
    console.log('📋 Estado actual:', JSON.stringify(estado));
    console.log('🔍 Estado detectado del mensaje:', JSON.stringify(estadoActualizado));
    console.log('📋 Tipo:', estadoActualizado.tipo_propiedad || 'NO DEFINIDO');
    console.log('📋 Zona:', estadoActualizado.zona || 'NO DEFINIDO');
    console.log('📋 Presupuesto:', estadoActualizado.presupuesto || 'NO DEFINIDO');
    
    // CRÍTICO: Guardar estado INMEDIATAMENTE si detectamos información nueva
    if (estadoActualizado.tipo_propiedad !== estado.tipo_propiedad ||
        estadoActualizado.zona !== estado.zona ||
        estadoActualizado.presupuesto !== estado.presupuesto) {
      console.log('💾 Guardando estado actualizado ANTES de enviar a Claude...');
      await guardarEstadoConversacion(estadoActualizado);
    }

    const historial = await obtenerHistorialConversacion(telefono, 10);
    console.log(`📚 Historial: ${historial.length} mensajes cargados`);
    
    // DEBUG: Mostrar historial completo
    if (historial.length > 0) {
      console.log('📜 HISTORIAL COMPLETO:');
      historial.forEach((msg, idx) => {
        console.log(`  ${idx + 1}. [${msg.direccion}] ${msg.mensaje.substring(0, 80)}...`);
      });
    }

    let messages = [];

    if (historial.length > 0) {
      // Construir mensajes con validación de alternancia
      historial.forEach(msg => {
        const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
        const contenido = limpiarRespuesta(msg.mensaje);
        
        if (contenido && contenido.trim()) {
          const lastRole = messages.length > 0 ? messages[messages.length - 1].role : null;
          
          // Solo agregar si alterna correctamente
          if (role !== lastRole) {
            messages.push({ role, content: contenido });
          } else {
            // Fusionar mensajes consecutivos del mismo rol
            if (messages.length > 0) {
              messages[messages.length - 1].content += '\n' + contenido;
            }
          }
        }
      });
    }

    // VALIDACIÓN: El primer mensaje DEBE ser del usuario
    if (messages.length > 0 && messages[0].role === 'assistant') {
      console.warn('⚠️ Removiendo mensaje inicial del asistente');
      messages.shift();
    }

    // Agregar mensaje actual del usuario
    // Ya NO agregamos contexto redundante - el system prompt ya tiene esta info
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      messages[messages.length - 1].content += '\n' + Body;
    } else {
      messages.push({ role: 'user', content: Body });
    }

    // VALIDACIÓN FINAL: Debe terminar con mensaje del usuario
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      console.error('❌ Error en construcción de mensajes');
      messages = [{ role: 'user', content: Body }];
    }

    console.log(`💬 ${messages.length} mensajes → Claude (primer: ${messages[0]?.role}, último: ${messages[messages.length - 1]?.role})`);

    const systemPrompt = construirPromptConEstado(estadoActualizado);
    
    console.log('📊 Estado enviado a Claude:', {
      tipo: estadoActualizado.tipo_propiedad || 'PENDIENTE',
      zona: estadoActualizado.zona || 'PENDIENTE', 
      presupuesto: estadoActualizado.presupuesto || 'PENDIENTE'
    });

    console.log('📤 Enviando a Claude con estado estructurado');

    let response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      temperature: 0.7,
      system: systemPrompt,
      tools,
      messages
    });

    while (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(b => b.type === 'tool_use');
      if (!toolUse) break;

      console.log('🔧 Tool:', toolUse.name);
      let toolResult = toolUse.name === 'consultar_documentos'
        ? await consultarDocumentos(toolUse.input)
        : await agendarCita(toolUse.input);

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] });

      response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        temperature: 0.7,
        system: systemPrompt,
        tools,
        messages
      });
    }

    const respuestaCompleta = response.content.find(b => b.type === 'text')?.text || 'Error generando respuesta';

    const nuevoEstado = extraerEstadoDeRespuesta(respuestaCompleta, estadoActualizado);
    await guardarEstadoConversacion(nuevoEstado);

    const respuestaLimpia = limpiarRespuesta(respuestaCompleta);

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioMsg = await client.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: From,
      body: respuestaLimpia
    });

    await guardarMensajeEnSheet({ telefono, direccion: 'outbound', mensaje: respuestaLimpia, messageId: twilioMsg.sid });

    console.log('✅ Respuesta enviada, estado guardado');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
