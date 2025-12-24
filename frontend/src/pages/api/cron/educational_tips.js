/**
 * CRON: Tips Educativos Automáticos
 * 
 * Envía contenido educativo sobre inmuebles cada 8 días a los clientes registrados.
 * Personaliza el contenido según el perfil del cliente (inversor/vivienda).
 * 
 * Ejecutar manualmente: POST /api/cron/educational_tips
 */

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
    DIAS_ENTRE_TIPS: 8,  // Días entre cada tip educativo
};

// ============================================================================
// BANCO DE TIPS EDUCATIVOS (8 semanas de contenido rotativo)
// ============================================================================
const TIPS_INVERSOR = [
    {
        titulo: '📈 Plusvalía en Zonas de Desarrollo',
        mensaje: '¿Sabías que las propiedades en zonas de desarrollo aumentan entre 8-15% de valor anual? 📈\n\nLas zonas en crecimiento son las mejores oportunidades de inversión.\n\n¿Te gustaría conocer las zonas con mayor potencial en tu área de interés?'
    },
    {
        titulo: '🎯 Ventaja del First Mover',
        mensaje: 'Los primeros compradores en desarrollos nuevos obtienen los mejores precios 🎯\n\nComprar en preventa puede significar un ahorro del 15-25% vs el precio terminado.\n\n¿Quieres ver las preventas disponibles?'
    },
    {
        titulo: '📊 Potencial de Terrenos',
        mensaje: 'Un terreno bien ubicado puede duplicar su valor en 3-5 años 📊\n\nA diferencia de otros activos, los terrenos no se deprecian y requieren mínimo mantenimiento.\n\n¿Te muestro opciones de terrenos de inversión?'
    },
    {
        titulo: '💰 Bajo Mantenimiento, Alta Rentabilidad',
        mensaje: 'Invertir en lotes = bajo mantenimiento y alta rentabilidad 💰\n\nNo necesitas pagar servicios ni preocuparte por inquilinos. Tu dinero trabaja solo.\n\n¿Quieres conocer nuestros lotes de inversión?'
    },
    {
        titulo: '🏗️ El Poder de la Preventa',
        mensaje: 'La preventa permite asegurar la plusvalía futura a precio de hoy 🏗️\n\nMientras otros esperan, tú ya estás capitalizando.\n\n¿Te interesa ver las preventas actuales?'
    },
    {
        titulo: '🔄 Estrategia Multi-Lotes',
        mensaje: 'Muchos inversores compran 2-3 lotes: uno para construir y otros para revender 🔄\n\nEsta estrategia maximiza el retorno a mediano plazo.\n\n¿Te gustaría explorar esta estrategia?'
    },
    {
        titulo: '🛣️ Desarrollo de Infraestructura',
        mensaje: 'Las zonas cerca de nuevas carreteras o centros comerciales proyectan mayor plusvalía 🛣️\n\nEstar informado sobre proyectos de gobierno te da ventaja competitiva.\n\n¿Quieres saber qué proyectos hay cerca de tu zona de interés?'
    },
    {
        titulo: '⏰ El Momento Ideal',
        mensaje: 'El mejor momento para invertir es ANTES de que lleguen servicios y comercios a la zona ⏰\n\nCuando todos ven la oportunidad, ya es demasiado tarde.\n\n¿Identificamos juntos las zonas con más potencial?'
    }
];

const TIPS_VIVIENDA = [
    {
        titulo: '💰 El Enganche',
        mensaje: 'El enganche típico es del 10-20% del valor de la propiedad 💰\n\nEmpieza a ahorrar desde ahora para tener más opciones cuando encuentres tu casa ideal.\n\n¿Tienes dudas sobre cómo calcular tu presupuesto?'
    },
    {
        titulo: '🏠 Aprovecha tu INFONAVIT',
        mensaje: 'Con INFONAVIT puedes usar tu crédito + subcuenta de vivienda + ahorro personal 🏠\n\nMuchas personas no saben que pueden combinar estas opciones para comprar algo mejor.\n\n¿Quieres que te explique cómo funciona?'
    },
    {
        titulo: '👶 Comprar Joven = Pagar Menos',
        mensaje: 'Comprar joven = menos intereses y mensualidades ajustadas a tu capacidad 👶\n\nEntre más pronto empieces, más rápido terminas de pagar y menos intereses generas.\n\n¿Ya tienes tu crédito precalificado?'
    },
    {
        titulo: '🏫 Ubicación y Servicios',
        mensaje: 'Busca zonas con escuelas, hospitales y comercios cerca para mejor calidad de vida 🏫\n\nUna buena ubicación también significa mejor plusvalía a futuro.\n\n¿En qué zona te gustaría vivir?'
    },
    {
        titulo: '📋 Documentación en Regla',
        mensaje: 'Revisa siempre que el terreno o casa tenga escrituras en regla 📋\n\nEsto te evitará problemas legales y gastos extra. Siempre pide ver la documentación.\n\n¿Necesitas ayuda para saber qué revisar?'
    },
    {
        titulo: '🔧 Garantía de Construcción',
        mensaje: 'Las casas de desarrolladora incluyen garantía de construcción 🔧\n\nEsto te protege contra defectos y te da tranquilidad los primeros años.\n\n¿Quieres conocer desarrollos con garantía?'
    },
    {
        titulo: '🕐 Visita a Diferentes Horas',
        mensaje: 'Antes de comprar, visita la zona a diferentes horas del día 🕐\n\nAsí conocerás el tráfico, ruido, seguridad y el "ambiente real" del vecindario.\n\n¿Quieres agendar visitas a las propiedades que te interesan?'
    },
    {
        titulo: '📝 Gastos de Escrituración',
        mensaje: 'Pregunta siempre por el costo de escrituración y gastos notariales 📝\n\nEstos pueden representar entre 5-8% adicional al precio de la propiedad.\n\n¿Tienes dudas sobre los gastos de compra?'
    }
];

const TIPS_GENERAL = [
    {
        titulo: '🏡 El Mejor Momento es Ahora',
        mensaje: '¿Sabías que el mejor momento para comprar una propiedad fue hace 5 años? 🏡\n\nEl segundo mejor momento es AHORA. Los precios siguen subiendo.\n\n¿Te ayudo a encontrar opciones dentro de tu presupuesto?'
    },
    {
        titulo: '📈 Tu Patrimonio',
        mensaje: 'Una propiedad es el mejor patrimonio que puedes dejar a tu familia 📈\n\nMientras pagas renta, estás pagando la hipoteca de alguien más.\n\n¿Quieres explorar opciones de compra?'
    },
    {
        titulo: '💡 Paso a Paso',
        mensaje: 'Comprar una propiedad parece complicado, pero el proceso es más simple de lo que crees 💡\n\n1. Define presupuesto\n2. Elige zona\n3. Visita opciones\n4. ¡Elige la tuya!\n\n¿En qué paso estás?'
    },
    {
        titulo: '🤝 Estoy Aquí para Ayudarte',
        mensaje: 'Soy Ana, tu asesora inmobiliaria 🤝\n\nMi trabajo es ayudarte a encontrar la propiedad perfecta para ti, ya sea para vivir o invertir.\n\n¿Tienes alguna pregunta que pueda resolver?'
    }
];

// ============================================================================
// HELPERS
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

/**
 * Selecciona el tip adecuado según el perfil y el número de tip
 */
function obtenerTipEducativo(perfil, numeroTip) {
    let banco;

    if (perfil === 'inversor') {
        banco = TIPS_INVERSOR;
    } else if (perfil === 'vivienda') {
        banco = TIPS_VIVIENDA;
    } else {
        // Para perfiles desconocidos, alternar entre general e inversor/vivienda
        const bancosCombinados = [...TIPS_GENERAL, ...TIPS_INVERSOR.slice(0, 2), ...TIPS_VIVIENDA.slice(0, 2)];
        banco = bancosCombinados;
    }

    // Usar módulo para rotar los tips
    const indice = numeroTip % banco.length;
    return banco[indice];
}

/**
 * Personaliza el mensaje con el nombre del cliente
 */
function personalizarMensaje(tip, nombre) {
    const saludo = nombre ? `Hola ${nombre}! 👋\n\n` : 'Hola! 👋\n\n';
    return saludo + tip.mensaje;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
export default async function handler(req, res) {
    log('🎓', '=== INICIANDO CRON DE TIPS EDUCATIVOS ===');

    try {
        const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        // 1. LEER TODOS LOS ESTADOS (Columnas A a U)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Estados!A:U'
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            log('⚠️', 'No hay datos en la hoja Estados');
            return res.status(200).json({ success: true, enviados: 0, mensaje: 'Sin clientes registrados' });
        }

        let procesados = 0;
        let actualizados = [];
        const ahora = DateTime.now().setZone(CONFIG.TIMEZONE);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const telefono = row[0];

            // Validar que sea una fila válida (teléfono con formato correcto)
            if (!telefono || !telefono.includes('+')) continue;

            const nombre = row[7] || '';           // Columna H: Nombre
            const perfil = row[16] || 'desconocido'; // Columna Q: Perfil
            const etapa = row[4] || '';            // Columna E: Etapa

            // Nuevas columnas para tips educativos
            const ultimoTipEnviadoStr = row[19] || ''; // Columna T: Fecha último tip
            const numeroTip = parseInt(row[20] || '0', 10); // Columna U: Número de tip

            // Ignorar si está en etapa final
            if (etapa === 'cerrado' || etapa === 'comprado') {
                log('⏭️', `Saltando ${telefono}: etapa ${etapa}`);
                continue;
            }

            // Calcular días desde último tip
            let diasDesdeUltimoTip = CONFIG.DIAS_ENTRE_TIPS + 1; // Default: enviar si no hay fecha
            if (ultimoTipEnviadoStr) {
                try {
                    const ultimoTip = DateTime.fromFormat(ultimoTipEnviadoStr.split(' ')[0], 'yyyy-MM-dd', { zone: CONFIG.TIMEZONE });
                    diasDesdeUltimoTip = Math.floor(ahora.diff(ultimoTip, 'days').days);
                } catch (e) {
                    log('⚠️', `Error parseando fecha para ${telefono}: ${ultimoTipEnviadoStr}`);
                }
            }

            // Solo enviar si han pasado suficientes días
            if (diasDesdeUltimoTip < CONFIG.DIAS_ENTRE_TIPS) {
                log('⏭️', `Saltando ${telefono}: solo ${diasDesdeUltimoTip} días desde último tip`);
                continue;
            }

            // Obtener el siguiente tip
            const tip = obtenerTipEducativo(perfil, numeroTip);
            const mensajeCompleto = personalizarMensaje(tip, nombre);
            const nuevoNumeroTip = numeroTip + 1;

            log('📨', `Enviando Tip #${nuevoNumeroTip} (${tip.titulo}) a ${telefono} - Perfil: ${perfil}`);

            try {
                // Enviar mensaje via Twilio
                await client.messages.create({
                    from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
                    to: 'whatsapp:' + telefono,
                    body: mensajeCompleto
                });

                // Actualizar columnas T (fecha) y U (número de tip)
                const rowIndex = i + 1; // 1-based index para Sheets
                const fechaHoy = ahora.toFormat('yyyy-MM-dd HH:mm:ss');

                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `Estados!T${rowIndex}:U${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [[fechaHoy, nuevoNumeroTip]] }
                });

                // Registrar en hoja de mensajes
                await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: 'Mensajes!A:E',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[fechaHoy, telefono, 'outbound-educational', `[TIP #${nuevoNumeroTip}] ${tip.titulo}`, 'educational-cron']]
                    }
                });

                procesados++;
                actualizados.push({ telefono, tip: tip.titulo, numero: nuevoNumeroTip });

            } catch (error) {
                log('❌', `Error enviando a ${telefono}: ${error.message}`);

                // Si es error de ventana de 24h, registrar pero continuar
                if (error.code === 63007) {
                    log('⚠️', `${telefono}: Fuera de ventana de 24 horas (sandbox)`);
                }
            }
        }

        log('✅', `Ciclo completado. Tips enviados: ${procesados}`);
        return res.status(200).json({
            success: true,
            enviados: procesados,
            detalles: actualizados,
            fecha: ahora.toFormat('yyyy-MM-dd HH:mm:ss')
        });

    } catch (error) {
        log('❌', 'Error crítico en cron educativo', { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
}
