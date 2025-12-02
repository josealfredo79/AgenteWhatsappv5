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
  let infoConocida = [];
  if (estado.tipo_propiedad) {
    infoConocida.push(`- Tipo de propiedad: ${estado.tipo_propiedad}`);
  }
  if (estado.zona) {
    infoConocida.push(`- Zona/Ciudad: ${estado.zona}`);
  }
  if (estado.presupuesto) {
    infoConocida.push(`- Presupuesto: ${estado.presupuesto}`);
  }

  const estadoTexto = infoConocida.length > 0
    ? `\n\n**🔥 INFORMACIÓN YA CONFIRMADA (NO VOLVER A PREGUNTAR):**\n${infoConocida.join('\n')}\n\n**CRÍTICO:** Estos datos YA ESTÁN GUARDADOS. Si vuelves a preguntar por ellos, el cliente se frustrará.`
    : '';

  return `Eres un asesor inmobiliario EXPERTO que DETECTA automáticamente lo que el cliente necesita.
${estadoTexto}

**🎯 REGLA DE ORO:**
Cuando el cliente mencione CUALQUIERA de estos datos, INMEDIATAMENTE llama a 'actualizar_estado':
- Tipo: terreno, casa, departamento, local, etc.
- Zona: Zapopan, Guadalajara, Centro, Norte, etc.
- Presupuesto: "2 millones", "500 mil", "15000 renta", etc.

**📋 FLUJO SIMPLIFICADO:**

1️⃣ **DETECTAR → ACTUALIZAR:**
   Cliente: "quiero un terreno en Zapopan"
   TÚ: Llama actualizar_estado({tipo_propiedad: "Terreno", zona: "Zapopan"})
   Responde: "Perfecto, terreno en Zapopan. ¿Cuál es tu presupuesto? 💰"

2️⃣ **COMPLETAR DATOS:**
   Si falta tipo → pregunta tipo
   Si falta zona → pregunta zona
   Si falta presupuesto → pregunta presupuesto

3️⃣ **BUSCAR PROPIEDADES:**
   Solo cuando tengas: tipo + zona + presupuesto
   Llama: consultar_documentos({query: "terrenos Zapopan 2 millones"})
   Presenta 2-3 opciones máximo

4️⃣ **CERRAR:**
   Si cliente se interesa → ofrece agendar visita

**⚠️ PROHIBICIONES ABSOLUTAS:**

❌ NUNCA preguntes datos que YA ESTÁN en "INFORMACIÓN YA CONFIRMADA"
❌ NUNCA digas "Hola" si ya hay conversación (solo en el primer mensaje)
❌ NUNCA ignores información que el cliente da - SIEMPRE usa actualizar_estado
❌ NUNCA des largas respuestas - máximo 3 líneas

**✅ OBLIGACIONES:**

✅ SIEMPRE detecta tipo/zona/presupuesto en el mensaje del cliente
✅ SIEMPRE llama actualizar_estado cuando detectes datos nuevos
✅ SIEMPRE revisa "INFORMACIÓN YA CONFIRMADA" antes de preguntar
✅ SIEMPRE termina con una pregunta concreta
✅ SIEMPRE usa emojis (1-2 por mensaje) 🏡 💰 📍

**🔍 EJEMPLOS DE DETECCIÓN:**

Cliente: "un terreno no mas de 2 millones en zapopan"
→ Detectas: tipo=Terreno, presupuesto=2 millones, zona=Zapopan
→ Llamas: actualizar_estado({tipo_propiedad: "Terreno", zona: "Zapopan", presupuesto: "2 millones"})
→ Respondes: "Excelente, busco terrenos en Zapopan hasta 2 millones. Dame un momento..." 
→ Llamas: consultar_documentos({query: "terrenos Zapopan 2 millones"})

Cliente: "zapopan jalisco"
→ Detectas: zona=Zapopan, Jalisco
→ Si ya tienes tipo y presupuesto → consulta documentos
→ Si falta algo → pregunta lo que falta

**🎨 TONO:**
- Directo y profesional
- Sin repetirte
- Sin saludar en cada mensaje
- Máximo 2-3 líneas (excepto al mostrar propiedades)

Zona horaria: America/Mexico_City`;
}

// Función auxiliar para limpiar respuesta (importante para no ensuciar el historial con tags viejos)
function limpiarRespuesta(respuesta) {
  return respuesta.replace(/\[ESTADO\].*?\[\/ESTADO\]/s, '').trim();
}

const tools = [
  {
    name: 'actualizar_estado',
    description: 'Actualiza el perfil del cliente con nueva información detectada en la conversación. Úsalo SIEMPRE que el cliente mencione o cambie: tipo de propiedad, zona, presupuesto o etapa.',
    input_schema: {
      type: 'object',
      properties: {
        tipo_propiedad: { type: 'string', description: 'Ej: Casa, Departamento, Terreno' },
        zona: { type: 'string', description: 'Ej: Centro, Norte, Zapopan' },
        presupuesto: { type: 'string', description: 'Ej: 2 millones, 15000 renta' },
        etapa: { type: 'string', enum: ['inicial', 'busqueda', 'interesado', 'cita_agendada'] },
        resumen: { type: 'string', description: 'Resumen breve de lo que busca el cliente' }
      }
    }
  },
  {
    name: 'consultar_documentos',
    description: 'Consulta propiedades disponibles. Usa cuando tengas: tipo + zona + presupuesto.',
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

async function obtenerHistorialConversacion(telefono, limite = 3) {
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

// ✨ DETECCIÓN AUTOMÁTICA DE DATOS - Antes de enviar a Claude
async function detectarYActualizarEstado(mensaje, telefono, estadoActual) {
  let cambios = {};
  const mensajeLower = mensaje.toLowerCase();

  // Detectar tipo de propiedad
  if (!estadoActual.tipo_propiedad || estadoActual.tipo_propiedad === '') {
    if (mensajeLower.includes('terreno')) {
      cambios.tipo_propiedad = 'Terreno';
    } else if (mensajeLower.match(/\bcasa\b/)) {
      cambios.tipo_propiedad = 'Casa';
    } else if (mensajeLower.match(/\bdepartamento\b|\bdepto\b/)) {
      cambios.tipo_propiedad = 'Departamento';
    } else if (mensajeLower.includes('local')) {
      cambios.tipo_propiedad = 'Local comercial';
    }
  }

  // Detectar zona
  if (!estadoActual.zona || estadoActual.zona === '') {
    if (mensajeLower.includes('zapopan')) {
      cambios.zona = 'Zapopan, Jalisco';
    } else if (mensajeLower.includes('guadalajara')) {
      cambios.zona = 'Guadalajara, Jalisco';
    } else if (mensajeLower.match(/\bcentro\b/)) {
      cambios.zona = 'Centro';
    } else if (mensajeLower.match(/\bnorte\b/)) {
      cambios.zona = 'Norte';
    } else if (mensajeLower.match(/\bsur\b/)) {
      cambios.zona = 'Sur';
    }
  }

  // Detectar presupuesto
  if (!estadoActual.presupuesto || estadoActual.presupuesto === '') {
    const presupuestoMatch = mensajeLower.match(/(\d+)\s*(millon|millones)/i);
    if (presupuestoMatch) {
      cambios.presupuesto = `${presupuestoMatch[1]} millones de pesos`;
    } else if (mensajeLower.match(/\d{3,}/)) {
      const numero = mensajeLower.match(/\d{3,}/)[0];
      cambios.presupuesto = `${numero} pesos`;
    }
  }

  // Si hay cambios, actualizar el estado
  if (Object.keys(cambios).length > 0) {
    const nuevoEstado = {
      ...estadoActual,
      ...cambios,
      telefono,
      etapa: 'busqueda'
    };

    console.log('🔍 DETECCIÓN AUTOMÁTICA:', cambios);
    await guardarEstadoConversacion(nuevoEstado);
    return nuevoEstado;
  }

  return estadoActual;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { Body, From, MessageSid } = req.body;
  if (!Body || !From) return res.status(400).json({ error: 'Faltan params' });

  const telefono = From.replace('whatsapp:', '');
  console.log('📨 Mensaje de', telefono, ':', Body);

  await guardarMensajeEnSheet({ telefono, direccion: 'inbound', mensaje: Body, messageId: MessageSid });

  // Detectar saludos simples y responder directamente sin Claude (como v1)
  const mensajeNormalizado = Body.toLowerCase().trim();
  const saludosSimples = /^(hola|hi|hello|hey|buenos días|buenas tardes|buenas noches|qué tal|cómo estás|que tal|como estas|saludos|hola\?|hola!|👋|hola 👋)$/i;

  if (saludosSimples.test(mensajeNormalizado)) {
    console.log('👋 Saludo simple detectado, respondiendo directamente');

    const respuestasSaludos = [
      '¡Hola! 👋 ¿Buscas comprar, rentar o invertir en alguna propiedad?',
      '¡Hola! 😊 ¿Qué tipo de propiedad te interesa?',
      '¡Buenas! ✨ ¿En qué puedo ayudarte con tu búsqueda inmobiliaria?'
    ];

    const respuestaRandom = respuestasSaludos[Math.floor(Math.random() * respuestasSaludos.length)];

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioMsg = await client.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: From,
      body: respuestaRandom
    });

    console.log('✅ Saludo enviado directamente, SID:', twilioMsg.sid);

    await guardarMensajeEnSheet({
      telefono,
      direccion: 'outbound',
      mensaje: respuestaRandom,
      messageId: twilioMsg.sid
    });

    return res.status(200).json({ success: true, sid: twilioMsg.sid, direct: true });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const estado = await obtenerEstadoConversacion(telefono);
    console.log('📋 Estado actual (antes):', JSON.stringify(estado));

    //🔍 DETECCIÓN AUTOMÁTICA EN CÓDIGO (no esperar a que Claude use herramientas)
    const estadoActualizado = await detectarYActualizarEstado(Body, telefono, estado);
    console.log('📋 Estado actualizado (después):', JSON.stringify(estadoActualizado));

    // ✅ CORRECCIÓN CRÍTICA: Claude API es STATELESS
    // Debemos enviar el historial completo en cada request
    // Fuente: https://docs.anthropic.com/en/api-reference/messages/

    // Cargar últimos 10 mensajes de conversación (5 turnos user-assistant)
    const historial = await obtenerHistorialConversacion(telefono, 10);
    console.log(`📚 Cargando ${historial.length} mensajes del historial`);

    // Construir array de mensajes en formato correcto para Claude
    // IMPORTANTE: Claude requiere que:
    // 1. Los mensajes se alternen user-assistant-user-assistant
    // 2. El PRIMER mensaje SIEMPRE debe ser del usuario
    // 3. El ÚLTIMO mensaje SIEMPRE debe ser del usuario
    let messages = [];

    // Agregar historial previo
    for (const msg of historial) {
      const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
      const lastRole = messages.length > 0 ? messages[messages.length - 1].role : null;

      // Solo agregar si no hay dos mensajes consecutivos del mismo rol
      if (role !== lastRole) {
        messages.push({
          role,
          content: msg.mensaje
        });
      } else {
        // Si hay dos mensajes consecutivos del mismo rol, fusionarlos
        if (messages.length > 0) {
          messages[messages.length - 1].content += '\n' + msg.mensaje;
        }
      }
    }

    // VALIDACIÓN CRÍTICA: El primer mensaje DEBE ser del usuario
    // Si el historial empieza con un mensaje del asistente, lo removemos
    if (messages.length > 0 && messages[0].role === 'assistant') {
      console.warn('⚠️ Removiendo mensaje inicial del asistente del historial');
      messages.shift();
    }

    // Agregar mensaje actual del usuario
    // Si el último mensaje del historial era del user, fusionarlo
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      messages[messages.length - 1].content += '\n' + Body;
    } else {
      messages.push({ role: 'user', content: Body });
    }

    // VALIDACIÓN FINAL: Asegurar que tenemos al menos un mensaje del usuario
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      console.error('❌ Error: El último mensaje no es del usuario');
      messages = [{ role: 'user', content: Body }];
    }

    console.log(`💬 Enviando ${messages.length} mensajes a Claude`);

    // Log de debugging detallado
    if (messages.length > 0) {
      console.log('📝 Primer mensaje:', messages[0].role, '-', messages[0].content.substring(0, 50) + '...');
      console.log('📝 Último mensaje:', messages[messages.length - 1].role, '-', messages[messages.length - 1].content.substring(0, 50) + '...');
    }

    const systemPrompt = construirPromptConEstado(estadoActualizado);

    console.log('📤 Enviando a Claude con estado estructurado');

    let response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      temperature: 0.7,
      system: systemPrompt,
      tools,
      messages
    });

    while (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(b => b.type === 'tool_use');
      if (!toolUse) break;

      console.log('🔧 Herramienta llamada:', toolUse.name);
      console.log('📥 Input:', JSON.stringify(toolUse.input, null, 2));
      let toolResult;

      if (toolUse.name === 'consultar_documentos') {
        toolResult = await consultarDocumentos(toolUse.input);
      } else if (toolUse.name === 'agendar_cita') {
        toolResult = await agendarCita(toolUse.input);
      } else if (toolUse.name === 'actualizar_estado') {
        // Fusionar estado actual con nuevos datos de forma INCREMENTAL
        // Solo sobrescribimos si el nuevo valor no está vacío
        const input = toolUse.input;
        const nuevoEstado = { ...estadoActualizado };

        if (input.tipo_propiedad) nuevoEstado.tipo_propiedad = input.tipo_propiedad;
        if (input.zona) nuevoEstado.zona = input.zona;
        if (input.presupuesto) nuevoEstado.presupuesto = input.presupuesto;
        if (input.etapa) nuevoEstado.etapa = input.etapa;
        if (input.resumen) nuevoEstado.resumen = input.resumen;

        nuevoEstado.telefono = telefono;

        const saveResult = await guardarEstadoConversacion(nuevoEstado);
        toolResult = { success: saveResult.success, estado_actualizado: nuevoEstado };

        // Actualizamos la variable local 'estadoActualizado' para el resto del ciclo
        Object.assign(estadoActualizado, nuevoEstado);
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] });

      response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 400,
        temperature: 0.7,
        system: construirPromptConEstado(estadoActualizado), // Reconstruimos el prompt con el nuevo estado por si acaso
        tools,
        messages
      });
    }

    const respuestaTexto = response.content.find(b => b.type === 'text');

    if (!respuestaTexto || !respuestaTexto.text) {
      console.error('❌ Claude no devolvió texto en la respuesta');
      console.error('📋 Response content:', JSON.stringify(response.content, null, 2));
      console.error('📋 Stop reason:', response.stop_reason);
      console.error('📋 Messages enviados:', JSON.stringify(messages, null, 2));
    }

    const respuestaCompleta = respuestaTexto?.text || '';
    let respuestaLimpia = limpiarRespuesta(respuestaCompleta);

    // Si la respuesta está vacía después de usar herramientas, generamos una respuesta automática
    if (!respuestaLimpia) {
      console.warn('⚠️ La respuesta de Claude estaba vacía. Generando respuesta de fallback.');
      // Verificamos si se actualizó el estado recientemente para dar una respuesta coherente
      if (estadoActualizado.tipo_propiedad || estadoActualizado.zona) {
        respuestaLimpia = "Entendido. He actualizado tus preferencias. ¿Hay algún otro detalle que te gustaría agregar?";
      } else {
        respuestaLimpia = "Disculpa, déjame ayudarte mejor. ¿En qué puedo asistirte? 🏡";
      }
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioMsg = await client.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: From,
      body: respuestaLimpia
    });

    await guardarMensajeEnSheet({ telefono, direccion: 'outbound', mensaje: respuestaLimpia, messageId: twilioMsg.sid });

    console.log('✅ Respuesta enviada');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
