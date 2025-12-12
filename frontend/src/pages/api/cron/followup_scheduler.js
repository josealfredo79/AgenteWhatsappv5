
import twilio from 'twilio';
import { google } from 'googleapis';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const CONFIG = {
    TIMEZONE: 'America/Mexico_City',
    DRIP_CONFIG: {
        WARM_UP_DAYS: 3,  // Días de inactividad para mensaje 1 (Guía de valor)
        REVIVAL_DAYS: 7,  // Días de inactividad para mensaje 2 (Reactivación)
    }
};

// ============================================================================
// HELPERS (Duplicados de whatsapp.js para independencia)
// ============================================================================
function log(emoji, mensaje, datos = null) {
    const timestamp = DateTime.now().setZone(CONFIG.TIMEZONE).toFormat('HH:mm:ss');
    if (datos) {
        console.log(`[${timestamp}] ${emoji} ${mensaje}:`, JSON.stringify(datos, null, 2));
    } else {
        console.log(`[${timestamp}] ${emoji} ${mensaje}`);
    }
}

function getGoogleAuth(scopes) {
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
        path.join(process.cwd(), 'google-credentials.json');

    if (!fs.existsSync(keyFile)) {
        throw new Error(`Archivo de credenciales no encontrado: ${keyFile}`);
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
        scopes: Array.isArray(scopes) ? scopes : [scopes]
    });
}

// ============================================================================
// TEMPLATES DE MENSAJES (Estrategia Drip)
// ============================================================================
function obtenerMensajeDrip(nivel, nombre, zona, perfil) {
    const nombreCliente = nombre ? ` ${nombre}` : '';
    const zonaInteres = zona || 'tu zona de interés';

    // NIVEL 1: VALUE ADD (3 Días)
    if (nivel === 1) {
        if (perfil === 'inversor') {
            return `Hola${nombreCliente}, ¿cómo va tu análisis de inversión? 📈\n\nEncontré este artículo sobre plusvalía en ${zonaInteres} que creo te servirá para tomar una mejor decisión.\n\n¿Quieres que te lo comparta?`;
        } else {
            // Perfil vivienda o general
            return `Hola${nombreCliente}, espero que estés muy bien. 👋\n\nEstaba actualizando nuestro inventario en ${zonaInteres} y recordé que estás buscando. ✨\n\n¿Te gustaría ver las opciones nuevas que llegaron esta semana?`;
        }
    }

    // NIVEL 2: REACTIVATION (7 Días)
    if (nivel === 2) {
        return `Hola${nombreCliente}, ¿sigues buscando propiedad en ${zonaInteres}?\n\nSi ya encontraste algo ¡felicidades! 🎉\n\nSi no, avísame para reactivar tu búsqueda con las oportunidades de "Ocasión" que acaban de salir.`;
    }

    return null;
}

// ============================================================================
// HANDLER CRON
// ============================================================================
export default async function handler(req, res) {
    // Verificación básica de seguridad (opcional, para evitar abuso público)
    // if (req.query.key !== process.env.CRON_SECRET_KEY) return res.status(401).json({error: 'Unauthorized'});

    log('🚀', '=== INICIANDO CRON DE SEGUIMIENTO (DRIP) ===');

    try {
        const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        // 1. LEER TODOS LOS ESTADOS (Columnas A a S)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Estados!A:S'
        });

        const rows = response.data.values || [];
        const headers = rows.shift(); // Remover encabezado si existe (asumimos que la fila 1 puede ser header)
        // Nota: Si la fila 1 es header real, ok. Si es dato, cuidado. Asumiremos que rows[0] ya es dato si parece telefono.
        // Ajuste: whatsapp.js usa rows.find sin saltar header, pero aquí iteramos todo.
        // Si la fila 0 no parece teléfono, la ignoramos.

        let procesados = 0;
        let actualizados = [];
        const ahora = DateTime.now().setZone(CONFIG.TIMEZONE);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const telefono = row[0];

            // Validar que sea un fila válida
            if (!telefono || !telefono.includes('+')) continue;

            const ultimaActualizacionStr = row[6]; // Columna G
            const zona = row[2];
            const nombre = row[7];
            const perfil = row[16]; // Columna Q
            const nivelSeguimiento = parseInt(row[18] || '0', 10); // Columna S
            const etapa = row[4]; // Columna E

            // Ignorar si ya compró o está en etapa final (ajustar según tu flujo)
            if (etapa === 'cerrado' || etapa === 'comprado') continue;
            // Si ya completó el ciclo (Nivel 2), ignorar
            if (nivelSeguimiento >= 2) continue;

            if (!ultimaActualizacionStr) continue;

            const ultimaActualizacion = DateTime.fromFormat(ultimaActualizacionStr.split(' ')[0], 'yyyy-MM-dd', { zone: CONFIG.TIMEZONE });
            const diasInactivo = Math.floor(ahora.diff(ultimaActualizacion, 'days').days);

            let nuevoNivel = 0;
            let mensajeEnviar = null;

            // --- REGLA 1: WARM UP (3 días) ---
            if (diasInactivo >= CONFIG.DRIP_CONFIG.WARM_UP_DAYS && nivelSeguimiento < 1) {
                nuevoNivel = 1;
                mensajeEnviar = obtenerMensajeDrip(1, nombre, zona, perfil);
            }
            // --- REGLA 2: REVIVAL (7 días) ---
            else if (diasInactivo >= CONFIG.DRIP_CONFIG.REVIVAL_DAYS && nivelSeguimiento < 2) {
                nuevoNivel = 2;
                mensajeEnviar = obtenerMensajeDrip(2, nombre, zona, perfil);
            }

            if (mensajeEnviar) {
                log('📨', `Enviando DRIP Nivel ${nuevoNivel} a ${telefono} (Inactivo: ${diasInactivo} días)`);

                try {
                    // Enviar mensaje Twilio
                    await client.messages.create({
                        from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
                        to: 'whatsapp:' + telefono,
                        body: mensajeEnviar
                    });

                    // Actualizar hoja: Solo columna S (índice 18) y tal vez G (Última actualización)?
                    // ESTRATEGIA: Si actualizamos "Última actualización" (Col G), reiniciamos el contador de inactividad.
                    // ¿Queremos eso? SI, porque acabamos de interactuar.
                    // PERO si lo reiniciamos, nunca llegará a los 7 días si contamos desde "último mensaje del bot".
                    // MEJOR ESTRATEGIA: No tocar "Última actualización" (que refleje último mensaje del USUARIO o interacción real).
                    // Solo actualizar Nivel Seguimiento.

                    // NOTA IMPORTANTE: Google Sheets API update por celda es lento en loop. 
                    // Idealmente batchUpdate, pero para MVP fila por fila está bien si no son miles.

                    // El índice de fila en sheet es i + 1 (si quitamos header) o i (si no).
                    // Asumimos que rows original incluía header en index 0, lo quitamos con shift.
                    // Entonces el index real en Sheet es i + 2 (1-based + 1 header).
                    const rowIndex = i + 2;

                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `Estados!S${rowIndex}`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: [[nuevoNivel]] }
                    });

                    // Registrar en log de mensajes (opcional, pero recomendado)
                    const timestamp = ahora.toFormat('yyyy-MM-dd HH:mm:ss');
                    await sheets.spreadsheets.values.append({
                        spreadsheetId,
                        range: 'Mensajes!A:E',
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [[timestamp, telefono, 'outbound-bot-drip', mensajeEnviar, 'drip-cron']]
                        }
                    });

                    procesados++;
                    actualizados.push({ telefono, nivel: nuevoNivel });

                } catch (error) {
                    log('❌', `Error enviando a ${telefono}: ${error.message}`);
                }
            }
        }

        log('✅', `Ciclo completado. Mensajes enviados: ${procesados}`);
        return res.status(200).json({ success: true, enviados: procesados, detalles: actualizados });

    } catch (error) {
        log('❌', 'Error crítico en cron', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
