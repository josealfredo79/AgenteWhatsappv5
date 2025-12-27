/**
 * PRUEBA: Enviar un tip educativo de prueba
 * POST /api/cron/test_tip
 */

import twilio from 'twilio';

export default async function handler(req, res) {
    console.log('🧪 Enviando tip de prueba...');

    try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        const tipPrueba = `Hola! 👋

📈 *Plusvalía en Zonas de Desarrollo*

¿Sabías que las propiedades en zonas de desarrollo aumentan entre 8-15% de valor anual? 📈

Las zonas en crecimiento son las mejores oportunidades de inversión.

¿Te gustaría conocer las zonas con mayor potencial en tu área de interés?

---
🧪 Este es un mensaje de PRUEBA del sistema de Tips Educativos.`;

        // Enviar al número del dueño
        const numeroDestino = '+52' + (process.env.OWNER_WHATSAPP_NUMBER || '9531953182');

        await client.messages.create({
            from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
            to: 'whatsapp:' + numeroDestino,
            body: tipPrueba
        });

        console.log('✅ Tip de prueba enviado a:', numeroDestino);

        return res.status(200).json({
            success: true,
            mensaje: 'Tip de prueba enviado',
            destino: numeroDestino
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
