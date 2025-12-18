import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// --- ÚTILES PARA NORMALIZACIÓN (Copiados de whatsapp.js para consistencia) ---
function normalizarTelefono(telefono) {
  if (!telefono) return '';
  // Remover 'whatsapp:' si existe, espacios, y cualquier caracter no numérico excepto +
  let normalizado = telefono
    .replace('whatsapp:', '')
    .replace(/\s/g, '')
    .trim();

  // Extraer solo los últimos 10 dígitos para comparación más flexible
  return normalizado;
}

function telefonosCoinciden(tel1, tel2) {
  if (!tel1 || !tel2) return false;
  // Extraer solo dígitos
  const digitos1 = tel1.replace(/\D/g, '').slice(-10);
  const digitos2 = tel2.replace(/\D/g, '').slice(-10);
  return digitos1 === digitos2 && digitos1.length > 0;
}
// ---------------------------------------------------------------------------

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

export default async function handler(req, res) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 1. Obtener Mensajes Y Estados en paralelo
    const [mensajesRes, estadosRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Mensajes!A:E',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Estados!A:S', // Ampliado hasta S para tener score, perfil, etc.
      })
    ]);

    const mensajesRows = mensajesRes.data.values || [];
    const estadosRows = estadosRes.data.values || [];

    if (mensajesRows.length <= 1) {
      return res.json([]);
    }

    // 2. Procesar Estados para búsqueda rápida
    // Mapa: TelefonoNormalizado -> DatosEstado
    const datosEstados = new Map();

    estadosRows.forEach(row => {
      // Estado row structure based on whatsapp.js logic:
      // 0: Teléfono, 1: Tipo, 2: Zona, ..., 12: Score, 13: Calificación, 14: Acción, ..., 16: Perfil
      const telefono = row[0];
      if (!telefono) return;

      const datos = {
        telefono: telefono,
        // Datos básicos
        tipo_propiedad: row[1] || '',
        zona: row[2] || '',
        presupuesto: row[3] || '',
        etapa: row[4] || '',
        // Lead Scoring & Perfilado
        score: parseInt(row[12] || '0', 10),
        calificacion: row[13] || 'COLD ❄️',
        accion_sugerida: row[14] || '',
        perfil: row[16] || 'desconocido', // inversor | vivienda
        intencion: row[17] || ''
      };

      // Usamos los ultimos 10 digitos como clave para mayor coincidencia
      const key = normalizarTelefono(telefono).replace(/\D/g, '').slice(-10);
      if (key) {
        datosEstados.set(key, datos);
      }
    });

    const conversacionesMap = new Map();

    // 3. Procesar Mensajes y mezclar con estados
    mensajesRows.slice(1).forEach(row => {
      const [timestamp, telefono, direccion, mensaje, messageId] = row;

      if (!telefono) return;

      if (!conversacionesMap.has(telefono)) {
        // Buscar info extra en el mapa de estados
        const key = normalizarTelefono(telefono).replace(/\D/g, '').slice(-10);
        const estadoExtra = datosEstados.get(key) || {};

        conversacionesMap.set(telefono, {
          id: telefono,
          usuario: telefono,
          mensajes: [],
          ultimoMensaje: '',
          timestamp: new Date(timestamp).getTime(),
          // Campos nuevos inyectados del estado
          score: estadoExtra.score || 0,
          calificacion: estadoExtra.calificacion || 'COLD ❄️',
          perfil: estadoExtra.perfil || 'desconocido',
          etapa: estadoExtra.etapa || 'inicial',
          accion_sugerida: estadoExtra.accion_sugerida || ''
        });
      }

      const conv = conversacionesMap.get(telefono);
      conv.mensajes.push({
        timestamp,
        direccion,
        mensaje,
        messageId
      });

      if (new Date(timestamp).getTime() > conv.timestamp) {
        conv.timestamp = new Date(timestamp).getTime();
        conv.ultimoMensaje = mensaje;
      }
    });

    const conversaciones = Array.from(conversacionesMap.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json(conversaciones);
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ error: 'Error al obtener conversaciones', message: error.message });
  }
}
