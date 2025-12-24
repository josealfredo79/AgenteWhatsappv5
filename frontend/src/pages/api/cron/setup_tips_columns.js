/**
 * SETUP: Agregar columnas de Tips Educativos a Google Sheets
 * 
 * Ejecutar UNA VEZ para agregar las columnas T y U a la hoja Estados.
 * 
 * Uso: GET /api/cron/setup_tips_columns
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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

export default async function handler(req, res) {
    console.log('🔧 SETUP: Agregando columnas de Tips Educativos...');

    try {
        const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        // 1. Primero, verificar si ya existen las columnas leyendo la fila 1
        const checkResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Estados!T1:U1'
        });

        const existingHeaders = checkResponse.data.values?.[0] || [];

        if (existingHeaders.length >= 2 && existingHeaders[0] && existingHeaders[1]) {
            console.log('✅ Las columnas ya existen:', existingHeaders);
            return res.status(200).json({
                success: true,
                message: 'Las columnas ya existen',
                columnas: existingHeaders
            });
        }

        // 2. Agregar los headers de las columnas T y U
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Estados!T1:U1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['ultimo_tip_enviado', 'numero_tip']]
            }
        });

        console.log('✅ Columnas T y U agregadas correctamente');

        return res.status(200).json({
            success: true,
            message: 'Columnas agregadas exitosamente',
            columnas: {
                T: 'ultimo_tip_enviado (fecha del último tip)',
                U: 'numero_tip (número consecutivo del tip)'
            }
        });

    } catch (error) {
        console.error('❌ Error en setup:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
