import twilio from 'twilio';

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
    
    console.log('📤 [SEND-MESSAGE] Enviando a:', destinatario, 'desde:', whatsappNumber);
    
    const message = await client.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${destinatario}`,
      body
    });
    
    console.log('✅ [SEND-MESSAGE] Mensaje enviado! SID:', message.sid);
    res.json({ ok: true, sid: message.sid });
  } catch (error) {
    console.error('❌ [SEND-MESSAGE] Error al enviar:', error.message);
    console.error('❌ [SEND-MESSAGE] Detalles:', error);
    res.status(500).json({ error: 'Error al enviar mensaje', details: error.message });
  }
}
