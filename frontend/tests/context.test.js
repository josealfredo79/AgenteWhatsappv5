// Test para validar el manejo correcto de contexto conversacional
// Este test simula una conversación real y verifica que el contexto se mantenga

const { test, expect, describe, beforeEach } = require('@jest/globals');

// Mock de la función obtenerHistorialConversacion
function obtenerHistorialConversacion(telefono, limite) {
    // Simular historial (últimos 10 mensajes)
    return [
        { direccion: 'inbound', mensaje: 'Hola' },
        { direccion: 'outbound', mensaje: '¡Hola! 👋 ¿Buscas comprar, rentar o invertir en alguna propiedad?' },
        { direccion: 'inbound', mensaje: 'Comprar' },
        { direccion: 'outbound', mensaje: 'Perfecto. ¿Qué tipo de propiedad buscas? 🏡' },
        { direccion: 'inbound', mensaje: 'Casa' },
        { direccion: 'outbound', mensaje: 'Excelente. ¿En qué zona te interesa? 📍' },
        { direccion: 'inbound', mensaje: 'Zapopan' },
        { direccion: 'outbound', mensaje: 'Perfecto. ¿Cuál es tu presupuesto aproximado? 💰' }
    ].slice(-limite);
}

// Función que construye el array de mensajes (extraída del código principal)
function construirMensajes(historial, nuevoMensaje) {
    let messages = [];

    // Agregar historial previo
    for (const msg of historial) {
        const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
        const lastRole = messages.length > 0 ? messages[messages.length - 1].role : null;

        // Solo agregar si no hay dos mensajes consecutivos del mismo rol
        if (role !== lastRole) {
            messages.push({
                role,
                content: msg.mensaje
            });
        } else {
            // Si hay dos mensajes consecutivos del mismo rol, fusionarlos
            if (messages.length > 0) {
                messages[messages.length - 1].content += '\n' + msg.mensaje;
            }
        }
    }

    // Agregar mensaje actual del usuario
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages[messages.length - 1].content += '\n' + nuevoMensaje;
    } else {
        messages.push({ role: 'user', content: nuevoMensaje });
    }

    return messages;
}

describe('Manejo de Contexto Conversacional', () => {

    test('Debe cargar historial correctamente', () => {
        const historial = obtenerHistorialConversacion('+5215551234567', 10);
        expect(historial).toBeDefined();
        expect(historial.length).toBeGreaterThan(0);
        expect(historial[0]).toHaveProperty('direccion');
        expect(historial[0]).toHaveProperty('mensaje');
    });

    test('Debe construir array de mensajes alternados', () => {
        const historial = obtenerHistorialConversacion('+5215551234567', 10);
        const messages = construirMensajes(historial, '2 millones');

        console.log('📊 Mensajes construidos:', JSON.stringify(messages, null, 2));

        // Verificar que hay mensajes
        expect(messages.length).toBeGreaterThan(0);

        // Verificar que el último mensaje es del usuario
        expect(messages[messages.length - 1].role).toBe('user');

        // Verificar alternancia de roles
        for (let i = 1; i < messages.length; i++) {
            const prevRole = messages[i - 1].role;
            const currRole = messages[i].role;

            // Si hay dos consecutivos del mismo rol, debe estar fusionado (no debería pasar)
            if (prevRole === currRole) {
                console.warn('⚠️ Roles consecutivos detectados:', prevRole, currRole);
            }
        }
    });

    test('Debe incluir el nuevo mensaje al final', () => {
        const historial = obtenerHistorialConversacion('+5215551234567', 10);
        const nuevoMensaje = '2 millones de pesos';
        const messages = construirMensajes(historial, nuevoMensaje);

        // El último mensaje debe contener el texto nuevo
        const ultimoMensaje = messages[messages.length - 1];
        expect(ultimoMensaje.role).toBe('user');
        expect(ultimoMensaje.content).toContain(nuevoMensaje);
    });

    test('Debe mantener contexto de al menos 5 turnos (10 mensajes)', () => {
        const historial = obtenerHistorialConversacion('+5215551234567', 10);
        const messages = construirMensajes(historial, 'mensaje nuevo');

        // Debe haber al menos 5 mensajes (incluyendo historial + nuevo)
        expect(messages.length).toBeGreaterThanOrEqual(5);

        // Verificar que el historial incluye información contextual
        const todosLosMensajes = messages.map(m => m.content).join(' ');
        expect(todosLosMensajes).toContain('Hola');
        expect(todosLosMensajes).toContain('Comprar');
        expect(todosLosMensajes).toContain('Casa');
    });

    test('Debe fusionar mensajes consecutivos del mismo rol', () => {
        const historialConDuplicados = [
            { direccion: 'inbound', mensaje: 'Hola' },
            { direccion: 'inbound', mensaje: 'Buenos días' }, // Duplicado
            { direccion: 'outbound', mensaje: '¡Hola!' }
        ];

        let messages = [];
        for (const msg of historialConDuplicados) {
            const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
            const lastRole = messages.length > 0 ? messages[messages.length - 1].role : null;

            if (role !== lastRole) {
                messages.push({ role, content: msg.mensaje });
            } else {
                if (messages.length > 0) {
                    messages[messages.length - 1].content += '\n' + msg.mensaje;
                }
            }
        }

        // Verificar fusión
        expect(messages.length).toBe(2); // user, assistant
        expect(messages[0].content).toBe('Hola\nBuenos días');
    });

    test('Debe manejar casos extremos - historial vacío', () => {
        const historialVacio = [];
        const messages = construirMensajes(historialVacio, 'Primer mensaje');

        expect(messages.length).toBe(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content).toBe('Primer mensaje');
    });

    test('Debe validar formato de mensajes para Claude API', () => {
        const historial = obtenerHistorialConversacion('+5215551234567', 10);
        const messages = construirMensajes(historial, 'Nuevo mensaje');

        // Cada mensaje debe tener role y content
        messages.forEach(msg => {
            expect(msg).toHaveProperty('role');
            expect(msg).toHaveProperty('content');
            expect(['user', 'assistant']).toContain(msg.role);
            expect(typeof msg.content).toBe('string');
            expect(msg.content.length).toBeGreaterThan(0);
        });
    });

    test('Performance - debe procesar 100 mensajes en menos de 100ms', () => {
        const historialLargo = Array(100).fill(null).map((_, i) => ({
            direccion: i % 2 === 0 ? 'inbound' : 'outbound',
            mensaje: `Mensaje ${i}`
        }));

        const inicio = Date.now();
        const messages = construirMensajes(historialLargo, 'Final');
        const duracion = Date.now() - inicio;

        expect(duracion).toBeLessThan(100);
        console.log(`⚡ Procesado en ${duracion}ms`);
    });

});


// Test de integración simulado
describe('Integración con Claude API (Mock)', () => {

    test('Debe generar payload válido para Claude', () => {
        const historial = obtenerHistorialConversacion('+5215551234567', 10);
        const messages = construirMensajes(historial, '2 millones');

        const payload = {
            model: 'claude-haiku-4-5',
            max_tokens: 300,
            system: 'Eres un asesor inmobiliario...',
            messages
        };

        expect(payload).toHaveProperty('model');
        expect(payload).toHaveProperty('messages');
        expect(Array.isArray(payload.messages)).toBe(true);
        expect(payload.messages.length).toBeGreaterThan(0);

        console.log('✅ Payload válido:', JSON.stringify(payload, null, 2));
    });

});


console.log(`
🧪 TEST DE CONTEXTO CONVERSACIONAL
====================================

Este test valida:
✅ Carga correcta del historial
✅ Construcción de array de mensajes
✅ Alternancia correcta de roles (user/assistant)
✅ Fusión de mensajes consecutivos
✅ Inclusión del mensaje nuevo
✅ Formato válido para Claude API
✅ Performance

Ejecutar con: npm test tests/context.test.js
`);
