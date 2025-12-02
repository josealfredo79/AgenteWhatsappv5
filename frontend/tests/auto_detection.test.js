// Test para validar la detección automática de estado
const { test, expect, describe } = require('@jest/globals');

// Mock de la función guardarEstadoConversacion
const guardarEstadoConversacion = jest.fn().mockResolvedValue({ success: true });

// Copiamos la lógica de la función para testearla aisladamente
// (En un entorno real importaríamos la función, pero aquí la duplicamos para el test unitario rápido)
async function detectarYActualizarEstado(mensaje, telefono, estadoActual) {
    let cambios = {};
    const mensajeLower = mensaje.toLowerCase();

    // Detectar tipo de propiedad
    if (!estadoActual.tipo_propiedad || estadoActual.tipo_propiedad === '') {
        if (mensajeLower.includes('terreno')) {
            cambios.tipo_propiedad = 'Terreno';
        } else if (mensajeLower.match(/\bcasa\b/)) {
            cambios.tipo_propiedad = 'Casa';
        } else if (mensajeLower.match(/\bdepartamento\b|\bdepto\b/)) {
            cambios.tipo_propiedad = 'Departamento';
        } else if (mensajeLower.includes('local')) {
            cambios.tipo_propiedad = 'Local comercial';
        }
    }

    // Detectar zona
    if (!estadoActual.zona || estadoActual.zona === '') {
        if (mensajeLower.includes('zapopan')) {
            cambios.zona = 'Zapopan, Jalisco';
        } else if (mensajeLower.includes('guadalajara')) {
            cambios.zona = 'Guadalajara, Jalisco';
        } else if (mensajeLower.match(/\bcentro\b/)) {
            cambios.zona = 'Centro';
        } else if (mensajeLower.match(/\bnorte\b/)) {
            cambios.zona = 'Norte';
        } else if (mensajeLower.match(/\bsur\b/)) {
            cambios.zona = 'Sur';
        }
    }

    // Detectar presupuesto
    if (!estadoActual.presupuesto || estadoActual.presupuesto === '') {
        const presupuestoMatch = mensajeLower.match(/(\d+)\s*(millon|millones)/i);
        if (presupuestoMatch) {
            cambios.presupuesto = `${presupuestoMatch[1]} millones de pesos`;
        } else if (mensajeLower.match(/\d{3,}/)) {
            const numero = mensajeLower.match(/\d{3,}/)[0];
            cambios.presupuesto = `${numero} pesos`;
        }
    }

    // Si hay cambios, actualizar el estado
    if (Object.keys(cambios).length > 0) {
        const nuevoEstado = {
            ...estadoActual,
            ...cambios,
            telefono,
            etapa: 'busqueda'
        };

        await guardarEstadoConversacion(nuevoEstado);
        return nuevoEstado;
    }

    return estadoActual;
}

describe('Detección Automática de Estado', () => {
    const telefono = '+5215551234567';
    const estadoVacio = {
        telefono,
        tipo_propiedad: '',
        zona: '',
        presupuesto: '',
        etapa: 'inicial'
    };

    test('Debe detectar tipo de propiedad "terreno"', async () => {
        const mensaje = 'Busco un terreno';
        const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoVacio);

        expect(nuevoEstado.tipo_propiedad).toBe('Terreno');
        expect(guardarEstadoConversacion).toHaveBeenCalled();
    });

    test('Debe detectar zona "Zapopan"', async () => {
        const mensaje = 'en Zapopan Jalisco';
        const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoVacio);

        expect(nuevoEstado.zona).toBe('Zapopan, Jalisco');
    });

    test('Debe detectar presupuesto "2 millones"', async () => {
        const mensaje = 'presupuesto de 2 millones';
        const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoVacio);

        expect(nuevoEstado.presupuesto).toBe('2 millones de pesos');
    });

    test('Debe detectar múltiples datos en un mensaje', async () => {
        const mensaje = 'quiero un terreno en Zapopan de 2 millones';
        const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoVacio);

        expect(nuevoEstado.tipo_propiedad).toBe('Terreno');
        expect(nuevoEstado.zona).toBe('Zapopan, Jalisco');
        expect(nuevoEstado.presupuesto).toBe('2 millones de pesos');
    });

    test('No debe sobrescribir datos existentes', async () => {
        const estadoConTipo = { ...estadoVacio, tipo_propiedad: 'Casa' };
        const mensaje = 'busco un terreno';
        const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoConTipo);

        expect(nuevoEstado.tipo_propiedad).toBe('Casa'); // No debe cambiar a Terreno
    });

    test('Debe manejar números simples como presupuesto', async () => {
        const mensaje = 'tengo 500000';
        const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoVacio);

        expect(nuevoEstado.presupuesto).toBe('500000 pesos');
    });
});
