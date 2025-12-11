
const { test, expect, describe } = require('@jest/globals');

// Función copiada de whatsapp.js para testing aislado
function detectarDatosEnMensaje(mensaje) {
    const mensajeLower = mensaje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let datos = {};

    // DETECTAR PERFIL INVERSOR
    const palabrasInversion = /\b(inversion|inversión|invertir|rentabilidad|roi|ganancia|negocio|plusvalia|plusvalía|revender|preventa|lote de inversion|macrolote|monopoly|mayoreo)\b/i;
    if (palabrasInversion.test(mensajeLower)) {
        datos.perfil = 'inversor';
        datos.intencion = 'negocio'; // Default para inversor
        if (/\b(rentar|rentas|flujo)\b/i.test(mensajeLower)) datos.intencion = 'rentar';
        if (/\b(revender|venta futura|capitalizar)\b/i.test(mensajeLower)) datos.intencion = 'revender';
    }

    // DETECTAR PERFIL VIVIENDA (VIDA PERSONAL)
    const palabrasVivienda = /\b(vivir|mi casa|mi familia|hijos|escuela|trabajo|cerca de mi|mudarme|habitar|crédito|credito|infonavit|fovissste)\b/i;
    if (palabrasVivienda.test(mensajeLower)) {
        datos.perfil = 'vivienda';
        datos.intencion = 'vivir';
    }

    // DETECTAR MÉTODO DE PAGO
    if (/\b(contado|efectivo|transferencia|recursos propios|liquidez)\b/i.test(mensajeLower)) {
        datos.metodo_pago = 'contado';
    } else if (/\b(credito|crédito|hipoteca|infonavit|banco|financiamiento)\b/i.test(mensajeLower)) {
        datos.metodo_pago = 'credito';
        if (/\b(aprobado|autorizado|ya tengo|listo)\b/i.test(mensajeLower)) {
            datos.credito_status = 'aprobado';
        }
    }

    return datos;
}

// Función copiada para Lead Scoring
function calcularLeadScore(estado) {
    let score = 0;

    // 1. IDENTIDAD BÁSICA
    if (estado.zona) score += 5;
    if (estado.tipo_propiedad) score += 5;
    if (estado.presupuesto) score += 15;

    // 2. PERFIL E INTENCIÓN
    if (estado.perfil === 'inversor') {
        score += 10;
        if (estado.metodo_pago === 'contado') score += 20;
        if (estado.intencion === 'negocio' || estado.intencion === 'revender') score += 5;
    } else if (estado.perfil === 'vivienda') {
        if (estado.credito_status === 'aprobado') score += 25;
        else if (estado.metodo_pago === 'credito') score += 10;
        if (estado.intencion === 'vivir') score += 5;
    }

    return score;
}

describe('Detector de Perfiles Inmobiliarios', () => {

    test('Detecta Inversor por palabra clave directa', () => {
        const msg = "Hola, busco lotes de inversión en Yucatán";
        const res = detectarDatosEnMensaje(msg);
        expect(res.perfil).toBe('inversor');
        expect(res.intencion).toBe('negocio');
    });

    test('Detecta Inversor por ROI/Rentabilidad', () => {
        const msg = "Quiero comprar depas para rentar con buen ROI";
        const res = detectarDatosEnMensaje(msg);
        expect(res.perfil).toBe('inversor');
        expect(res.intencion).toBe('rentar');
    });

    test('Detecta Vivienda Familiar', () => {
        const msg = "Busco una casa para mi familia cerca de escuelas";
        const res = detectarDatosEnMensaje(msg);
        expect(res.perfil).toBe('vivienda');
        expect(res.intencion).toBe('vivir');
    });

    test('Detecta Vivienda por Crédito Infonavit', () => {
        const msg = "cuento con credito infonavit aprobado";
        const res = detectarDatosEnMensaje(msg);
        expect(res.perfil).toBe('vivienda');
        expect(res.metodo_pago).toBe('credito');
        expect(res.credito_status).toBe('aprobado');
    });

    test('Detecta Inversor + Contado (Lead HOT)', () => {
        const msg = "Busco oportunidad de inversión pago de contado";
        const res = detectarDatosEnMensaje(msg);
        expect(res.perfil).toBe('inversor');
        expect(res.metodo_pago).toBe('contado');

        // Validar scoring
        const score = calcularLeadScore({ ...res, zona: 'x', tipo_propiedad: 'x', presupuesto: 'x' });
        // Base 25 + Inversor 10 + Contado 20 + Intencion 5 = 60 puntos extra
        expect(score).toBeGreaterThan(50);
    });
});
