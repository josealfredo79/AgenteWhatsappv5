import twilio from 'twilio';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Función para obtener autenticación de Google
function getGoogleAuth() {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
    path.join(process.cwd(), 'google-credentials.json');

  if (!fs.existsSync(keyFile)) {
    console.log('⚠️ [SEND-MESSAGE] No se encontró archivo de credenciales');
    return null;
  }

  const credentialsRaw = fs.readFileSync(keyFile, 'utf8');
  const credentials = JSON.parse(credentialsRaw);

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key
      .split('\\n').join('\n')
      .replace(/\r\n/g, '\n');
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

// Guardar mensaje en Google Sheets
async function guardarMensajeEnSheet(telefono, mensaje, messageId) {
  try {
    const auth = getGoogleAuth();
    if (!auth) return;
    
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    const timestamp = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Mensajes!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { 
        values: [[timestamp, telefono, 'outbound', `[AGENTE HUMANO] ${mensaje}`, messageId || '']] 
      }
    });
    
    console.log('✅ [SEND-MESSAGE] Mensaje guardado en historial');
  } catch (error) {
    console.error('⚠️ [SEND-MESSAGE] Error guardando en historial:', error.message);
  }
}

export default async function handler(req, res) {
  console.log('📤 [SEND-MESSAGE] Recibida solicitud de envío');
  
  if (req.method !== 'POST') {
    console.log('❌ [SEND-MESSAGE] Método no permitido:', req.method);
    return res.status(405).end();
  }
  
  const { to, body } = req.body;
  console.log('📤 [SEND-MESSAGE] Datos recibidos:', { to, bodyLength: body?.length });
  
  if (!to || !body) {
    console.log('❌ [SEND-MESSAGE] Faltan parámetros:', { to: !!to, body: !!body });
    return res.status(400).json({ error: 'Faltan parámetros to o body' });
  }
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    
    // Asegurar formato correcto del número
    let destinatario = to;
    if (!destinatario.startsWith('+')) {
      destinatario = '+' + destinatario;
    }
    
    // Normalizar para guardar en sheet
    const telefonoNormalizado = destinatario.replace(/\D/g, '');
    
    console.log('📤 [SEND-MESSAGE] Enviando a:', destinatario, 'desde:', whatsappNumber);
    
    const message = await client.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${destinatario}`,
      body
    });
    
    console.log('✅ [SEND-MESSAGE] Mensaje enviado! SID:', message.sid);
    
    // Guardar en historial de Google Sheets
    await guardarMensajeEnSheet(telefonoNormalizado, body, message.sid);
    
    res.json({ ok: true, sid: message.sid });
  } catch (error) {
    console.error('❌ [SEND-MESSAGE] Error al enviar:', error.message);
    console.error('❌ [SEND-MESSAGE] Código:', error.code);
    console.error('❌ [SEND-MESSAGE] Más info:', error.moreInfo || 'N/A');
    
    // Mensaje de error más descriptivo
    let errorMsg = 'Error al enviar mensaje';
    if (error.code === 63007) {
      errorMsg = 'El destinatario no ha iniciado conversación en las últimas 24 horas (limitación de WhatsApp Sandbox)';
    } else if (error.code === 21608) {
      errorMsg = 'El número no está registrado en WhatsApp o no ha aceptado mensajes';
    }
    
    res.status(500).json({ error: errorMsg, details: error.message, code: error.code });
  }
}
