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
    ? `\n\n**INFORMACIÓN YA RECOPILADA DEL CLIENTE:**\n${infoConocida.join('\n')}\n\n**IMPORTANTE:** No vuelvas a preguntar por estos datos. Solo pregunta lo que falte para personalizar la búsqueda.\n\n**INSTRUCCIÓN OBLIGATORIA:** Al final de cada respuesta SIEMPRE incluye el bloque [ESTADO]{...}[/ESTADO] con los datos actualizados (tipo, zona, presupuesto). Si no hay cambios, mantén los anteriores. Si omites este bloque, la respuesta será ignorada.`
    : '';

  return `Eres un Asesor Inmobiliario Senior, experto en ventas consultivas y atención al cliente. Tu nombre es Claude.
${estadoTexto}

**CONTEXTO CRÍTICO:**
Esta es una conversación CONTINUA. Si ya hay mensajes previos, NUNCA te presentes de nuevo ni reinicies la conversación. Continúa desde donde quedó el último mensaje.

**OBJETIVO:**
Guiar al cliente de manera profesional y empática hacia la compra de su propiedad ideal, recopilando solo la información que falte para ofrecerle las mejores opciones, o agendar una cita si ya muestra interés claro.

**ESTILO DE COMUNICACIÓN:**
- Profesional, cálido y directo (máximo 3-4 líneas por mensaje).
- Usa emojis con moderación (1-2 por mensaje).
- Escucha activa: valida lo que dice el cliente antes de preguntar.
- Nunca repitas preguntas sobre datos ya proporcionados.
- Si el cliente da una respuesta corta o ambigua (ej: "no", "ok", "sí"), NO reinicies la conversación. Pide clarificación o continúa con el siguiente paso lógico.

**FLUJO DE CONVERSACIÓN SUGERIDO:**
1. Si faltan datos clave (tipo, zona, presupuesto), pregunta solo lo que falte, integrando la pregunta en la conversación.
2. Si el cliente proporciona datos nuevos, USA INMEDIATAMENTE la herramienta 'actualizar_estado'.
3. Si ya tienes todos los datos, consulta propiedades y ofrece opciones concretas.
4. Si el cliente muestra interés, propón agendar una cita.
5. Si el cliente dice "no" o algo ambiguo, pregunta qué necesita en lugar de reiniciar.

**REGLAS DE NEGOCIO:**
- No inventes propiedades. Usa solo la información de 'consultar_documentos'.
- Si no sabes algo, ofrece averiguarlo.
- Respeta el presupuesto del cliente.
- NUNCA te presentes de nuevo si ya hay historial de conversación.
- NUNCA preguntes "¿En qué puedo ayudarte?" si ya estás en medio de una conversación.

**GESTIÓN DE ESTADO:**
Es CRÍTICO que mantengas el estado del cliente actualizado.
1. En cuanto detectes CUALQUIER dato nuevo (tipo, zona, presupuesto), llama a la herramienta 'actualizar_estado' INMEDIATAMENTE.
2. No esperes a tener todos los datos. Guarda lo que tengas.
3. Si el cliente corrige un dato, usa la herramienta para actualizarlo.
**PROHIBIDO:** No escribas nunca bloques como [ESTADO]...[/ESTADO] en tu respuesta. Usa SOLO la herramienta.

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
    console.log('📋 Estado actual:', JSON.stringify(estado));

    const historial = await obtenerHistorialConversacion(telefono, 10);

    let messages = [];

    if (historial.length > 0) {
      // Tomamos los últimos 10 mensajes para dar buen contexto
      // Aseguramos que estén en orden cronológico
      historial.forEach(msg => {
        const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
        const contenido = limpiarRespuesta(msg.mensaje);
        // Evitamos duplicar el mensaje actual si ya se guardó en sheet y apareció en historial
        if (role === 'user' && contenido === Body) return;

        if (contenido) {
          messages.push({ role, content: contenido });
        }
      });
    }

    messages.push({ role: 'user', content: Body });

    const systemPrompt = construirPromptConEstado(estado);

    console.log('📤 Enviando a Claude con estado estructurado');

    let response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: systemPrompt,
      tools,
      messages
    });

    while (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(b => b.type === 'tool_use');
      if (!toolUse) break;

      console.log('🔧 Tool:', toolUse.name);
      let toolResult;

      if (toolUse.name === 'consultar_documentos') {
        toolResult = await consultarDocumentos(toolUse.input);
      } else if (toolUse.name === 'agendar_cita') {
        toolResult = await agendarCita(toolUse.input);
      } else if (toolUse.name === 'actualizar_estado') {
        // Fusionar estado actual con nuevos datos de forma INCREMENTAL
        // Solo sobrescribimos si el nuevo valor no está vacío
        const input = toolUse.input;
        const nuevoEstado = { ...estado };

        if (input.tipo_propiedad) nuevoEstado.tipo_propiedad = input.tipo_propiedad;
        if (input.zona) nuevoEstado.zona = input.zona;
        if (input.presupuesto) nuevoEstado.presupuesto = input.presupuesto;
        if (input.etapa) nuevoEstado.etapa = input.etapa;
        if (input.resumen) nuevoEstado.resumen = input.resumen;

        nuevoEstado.telefono = telefono;

        const saveResult = await guardarEstadoConversacion(nuevoEstado);
        toolResult = { success: saveResult.success, estado_actualizado: nuevoEstado };

        // Actualizamos la variable local 'estado' para el resto del ciclo
        Object.assign(estado, nuevoEstado);
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] });

      response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        system: construirPromptConEstado(estado), // Reconstruimos el prompt con el nuevo estado por si acaso
        tools,
        messages
      });
    }

    const respuestaCompleta = response.content.find(b => b.type === 'text')?.text || 'Error generando respuesta';
    let respuestaLimpia = limpiarRespuesta(respuestaCompleta);

    // Si la respuesta está vacía después de usar herramientas, generamos una respuesta automática
    if (!respuestaLimpia) {
      console.warn('⚠️ La respuesta de Claude estaba vacía. Generando respuesta de fallback.');
      // Verificamos si se actualizó el estado recientemente para dar una respuesta coherente
      if (estado.tipo_propiedad || estado.zona) {
        respuestaLimpia = "Entendido. He actualizado tus preferencias. ¿Hay algún otro detalle que te gustaría agregar?";
      } else {
        respuestaLimpia = "Entendido. ¿En qué más puedo ayudarte?";
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
