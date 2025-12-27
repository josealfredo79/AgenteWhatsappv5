/**
 * PRUEBA: Enviar un tip educativo de prueba
 * POST /api/cron/test_tip
 */

import twilio from 'twilio';

export default async function handler(req, res) {
    console.log('🧪 Enviando tip de prueba (DEBUG MODE)...');

    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;

        // Debug de variables (sin revelar secretos completos)
        console.log('🔧 Configuración:');
        console.log('- SID:', accountSid ? '***' + accountSid.slice(-4) : 'FALTA');
        console.log('- Token:', authToken ? '***' + authToken.slice(-4) : 'FALTA');
        console.log('- From:', fromNumber);
        console.log('- Owner:', ownerNumber);

        if (!accountSid || !authToken || !fromNumber) {
            throw new Error("Faltan credenciales de Twilio en variables de entorno");
        }

        const client = twilio(accountSid, authToken);

        const tipPrueba = `Hola! 👋

🧪 *PRUEBA DE CONEXIÓN*

Si ves este mensaje, el sistema de Tips Educativos está funcionando correctamente.

Hora: ${new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' })}

---
Agente Inmobiliario IA 🤖`;

        // Construir número destino
        const numeroDestino = 'whatsapp:+52' + (ownerNumber || '9531953182').replace(/\D/g, ''); // Limpiar caracteres no numéricos
        const numeroOrigen = 'whatsapp:' + fromNumber;

        console.log(`📨 Intentando enviar de ${numeroOrigen} a ${numeroDestino}`);

        const message = await client.messages.create({
            from: numeroOrigen,
            to: numeroDestino,
            body: tipPrueba
        });

        console.log('✅ Twilio Respuesta:', message.sid, message.status);

        return res.status(200).json({
            success: true,
            sid: message.sid,
            status: message.status,
            from: numeroOrigen,
            to: numeroDestino,
            errorCode: message.errorCode,
            errorMessage: message.errorMessage
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}
