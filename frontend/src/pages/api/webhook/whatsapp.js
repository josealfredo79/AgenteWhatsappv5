import { Anthropic } from '@anthropic-ai/sdk';
import twilio from 'twilio';
import { google } from 'googleapis';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';

// ============================================================================
// DETECCIÓN AUTOMÁTICA DE ESTADO (por código, no depende de Claude)
// ============================================================================

/**
 * Detecta y actualiza el estado del cliente basándose en el mensaje.
 * PERMITE CAMBIOS si el usuario usa palabras clave de cambio de opinión.
 */
function detectarDatosEnMensaje(mensaje, estadoActual) {
  const mensajeLower = mensaje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Detectar si el usuario quiere CAMBIAR algo
  const quiereCambiar = /\b(mejor|cambio|cambie|prefiero|en vez de|en lugar de|no,?\s|ahora quiero|finalmente|mejor dicho)\b/i.test(mensajeLower);
  
  let cambios = {};
  
  // ===== DETECTAR TIPO DE PROPIEDAD =====
  const tipoActual = estadoActual.tipo_propiedad || '';
  const debeCambiarTipo = !tipoActual || quiereCambiar;
  
  if (debeCambiarTipo) {
    if (/\b(terreno|terrenos|lote|lotes)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Terreno';
    } else if (/\b(casa|casas|residencia)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Casa';
    } else if (/\b(departamento|depto|deptos|apartamento)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Departamento';
    } else if (/\b(local|locales|comercial|oficina|oficinas)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Local comercial';
    } else if (/\b(bodega|nave|industrial)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Bodega/Nave industrial';
    }
  }
  
  // ===== DETECTAR ZONA =====
  const zonaActual = estadoActual.zona || '';
  const debeCambiarZona = !zonaActual || quiereCambiar;
  
  if (debeCambiarZona) {
    // Zonas específicas de Jalisco (expandir según necesidad)
    if (/\bzapopan\b/.test(mensajeLower)) {
      cambios.zona = 'Zapopan, Jalisco';
    } else if (/\bguadalajara\b/.test(mensajeLower)) {
      cambios.zona = 'Guadalajara, Jalisco';
    } else if (/\btlajomulco\b/.test(mensajeLower)) {
      cambios.zona = 'Tlajomulco, Jalisco';
    } else if (/\btonala\b/.test(mensajeLower)) {
      cambios.zona = 'Tonalá, Jalisco';
    } else if (/\btlaquepaque\b/.test(mensajeLower)) {
      cambios.zona = 'Tlaquepaque, Jalisco';
    } else if (/\bchapala\b/.test(mensajeLower)) {
      cambios.zona = 'Chapala, Jalisco';
    } else if (/\bajijic\b/.test(mensajeLower)) {
      cambios.zona = 'Ajijic, Jalisco';
    } else if (/\bpuerto vallarta\b|\bvallarta\b/.test(mensajeLower)) {
      cambios.zona = 'Puerto Vallarta, Jalisco';
    } else if (/\bcentro\b/.test(mensajeLower)) {
      cambios.zona = 'Centro';
    } else if (/\bnorte\b/.test(mensajeLower)) {
      cambios.zona = 'Zona Norte';
    } else if (/\bsur\b/.test(mensajeLower)) {
      cambios.zona = 'Zona Sur';
    }
  }
  
  // ===== DETECTAR PRESUPUESTO =====
  const presupuestoActual = estadoActual.presupuesto || '';
  const debeCambiarPresupuesto = !presupuestoActual || quiereCambiar;
  
  if (debeCambiarPresupuesto) {
    // Detectar "X millones" o "X.X millones"
    const matchMillones = mensajeLower.match(/(\d+(?:\.\d+)?)\s*(millon|millones|mdp|m)/i);
    if (matchMillones) {
      const cantidad = matchMillones[1];
      cambios.presupuesto = `${cantidad} millones de pesos`;
    } else {
      // Detectar números grandes (posibles precios)
      const matchNumero = mensaje.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{6,})/);
      if (matchNumero) {
        const numero = matchNumero[1].replace(/,/g, '');
        const valor = parseInt(numero, 10);
        if (valor >= 100000) {
          if (valor >= 1000000) {
            cambios.presupuesto = `${(valor / 1000000).toFixed(1)} millones de pesos`;
          } else {
            cambios.presupuesto = `${valor.toLocaleString('es-MX')} pesos`;
          }
        }
      }
    }
  }
  
  // ===== DETECTAR INTENCIÓN/ETAPA =====
  if (/\b(agendar|cita|visita|ver la propiedad|conocer|mostrar)\b/.test(mensajeLower)) {
    cambios.etapa = 'agendar';
  } else if (/\b(comprar|adquirir|interesa|busco|quiero)\b/.test(mensajeLower)) {
    cambios.etapa = 'busqueda';
  }
  
  return cambios;
}

/**
 * Aplica los cambios detectados al estado y lo guarda
 */
async function detectarYActualizarEstado(mensaje, telefono, estadoActual, guardarFn) {
  const cambios = detectarDatosEnMensaje(mensaje, estadoActual);
  
  if (Object.keys(cambios).length > 0) {
    const nuevoEstado = {
      ...estadoActual,
      ...cambios,
      telefono
    };
    
    console.log('🔍 Datos detectados automáticamente:', cambios);
    
    // Guardar inmediatamente
    if (guardarFn) {
      await guardarFn(nuevoEstado);
    }
    
    return nuevoEstado;
  }
  
  return estadoActual;
}

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
  // Prompt minimalista y directo
  return `Eres Ana, asesora inmobiliaria profesional.

Tu trabajo es recopilar 3 datos del cliente:
1. Tipo de propiedad (casa/terreno/departamento/local)
2. Zona o ciudad
3. Presupuesto

Cuando tengas los 3 datos, usa la herramienta 'consultar_documentos'.

Reglas:
- Respuestas cortas (2-3 líneas)
- 1-2 emojis máximo
- NO repitas preguntas sobre datos que el cliente ya dio
- El contexto del cliente viene en cada mensaje con [ESTADO_CLIENTE]`;
}

function limpiarRespuesta(respuesta) {
  return respuesta.replace(/\[ESTADO\].*?\[\/ESTADO\]/s, '').trim();
}

const tools = [
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

async function obtenerHistorialConversacion(telefono, limite = 10, excluirUltimoMensaje = true) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Mensajes!A:E'
    });

    const rows = response.data.values || [];

    let mensajesCliente = rows
      .filter(row => row[1] === telefono && row[3]);

    // Excluir el último mensaje (el que acabamos de guardar)
    if (excluirUltimoMensaje && mensajesCliente.length > 0) {
      mensajesCliente = mensajesCliente.slice(0, -1);
    }

    // Tomar los últimos N mensajes
    mensajesCliente = mensajesCliente.slice(-limite);

    console.log(`📚 Cargando ${mensajesCliente.length} mensajes del historial para ${telefono}`);

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

    // 1. Obtener estado actual del cliente
    const estadoOriginal = await obtenerEstadoConversacion(telefono);
    console.log('📋 Estado antes de detección:', JSON.stringify(estadoOriginal));

    // 2. ⭐ DETECCIÓN AUTOMÁTICA: Analizar mensaje ANTES de llamar a Claude
    const estadoActualizado = await detectarYActualizarEstado(
      Body, 
      telefono, 
      estadoOriginal, 
      guardarEstadoConversacion
    );
    console.log('🔍 Estado después de detección:', JSON.stringify(estadoActualizado));

    // 3. Obtener historial de conversación
    const historial = await obtenerHistorialConversacion(telefono, 10, true);

    // 4. Construir mensajes para Claude con alternancia correcta
    let messages = [];

    if (historial.length > 0) {
      let lastRole = null;
      
      for (const msg of historial) {
        const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
        const contenido = limpiarRespuesta(msg.mensaje);
        
        if (!contenido) continue;
        
        // Si es el mismo rol que el anterior, fusionar mensajes
        if (role === lastRole && messages.length > 0) {
          messages[messages.length - 1].content += '\n' + contenido;
        } else {
          messages.push({ role, content: contenido });
          lastRole = role;
        }
      }

      // Asegurar que el último mensaje del historial sea 'assistant'
      // para que el nuevo 'user' alterne correctamente
      while (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages.pop();
      }
    }

    // 5. INYECCIÓN DE ESTADO EN MENSAJE (técnica de grounding de Anthropic)
    // El estado SIEMPRE va en el mensaje para que Claude no lo ignore
    const tipo = estadoActualizado.tipo_propiedad || 'NO_TIENE';
    const zona = estadoActualizado.zona || 'NO_TIENE';
    const presupuesto = estadoActualizado.presupuesto || 'NO_TIENE';
    
    // Calcular qué falta
    let faltantes = [];
    if (tipo === 'NO_TIENE') faltantes.push('tipo');
    if (zona === 'NO_TIENE') faltantes.push('zona');
    if (presupuesto === 'NO_TIENE') faltantes.push('presupuesto');
    
    const mensajeConEstado = `[ESTADO_CLIENTE]
Tipo: ${tipo}
Zona: ${zona}
Presupuesto: ${presupuesto}
Faltan: ${faltantes.length > 0 ? faltantes.join(', ') : 'NINGUNO - BUSCAR PROPIEDADES'}
[/ESTADO_CLIENTE]

Cliente dice: ${Body}`;
    
    console.log('📎 Mensaje con estado inyectado:', mensajeConEstado);
    
    messages.push({ role: 'user', content: mensajeConEstado });

    // 6. Construir prompt con estado YA ACTUALIZADO
    const systemPrompt = construirPromptConEstado(estadoActualizado);

    console.log(`💬 Enviando ${messages.length} mensajes a Claude`);
    console.log('📝 Roles:', messages.map(m => m.role).join(' → '));
    console.log('📊 Estado enviado:', JSON.stringify(estadoActualizado));

    // 7. Llamar a Claude
    let response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: systemPrompt,
      tools,
      messages
    });

    // 8. Procesar tool calls si las hay
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
        system: systemPrompt,
        tools,
        messages
      });
    }

    // 9. Obtener respuesta final
    const respuestaCompleta = response.content.find(b => b.type === 'text')?.text || 'Error generando respuesta';
    const respuestaLimpia = limpiarRespuesta(respuestaCompleta);

    // 10. Enviar por WhatsApp
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioMsg = await client.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: From,
      body: respuestaLimpia
    });

    // 11. Guardar respuesta en historial
    await guardarMensajeEnSheet({ telefono, direccion: 'outbound', mensaje: respuestaLimpia, messageId: twilioMsg.sid });

    console.log('✅ Respuesta enviada');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
