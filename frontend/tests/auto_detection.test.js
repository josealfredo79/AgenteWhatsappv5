// Test para validar la detección automática de estado
const { test, expect, describe } = require('@jest/globals');

// Mock de la función guardarEstadoConversacion
const guardarEstadoConversacion = jest.fn().mockResolvedValue({ success: true });

/**
 * Detecta y actualiza el estado del cliente basándose en el mensaje.
 * PERMITE CAMBIOS si el usuario usa palabras clave de cambio de opinión.
 */
function detectarDatosEnMensaje(mensaje, estadoActual) {
  const mensajeLower = mensaje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Detectar si el usuario quiere CAMBIAR algo
  const quiereCambiar = /\b(mejor|cambio|cambie|prefiero|en vez de|en lugar de|no,?\s|ahora quiero|finalmente|mejor dicho)\b/i.test(mensajeLower);
  
  let cambios = {};
  
  // ===== DETECTAR TIPO DE PROPIEDAD =====
  const tipoActual = estadoActual.tipo_propiedad || '';
  const debeCambiarTipo = !tipoActual || quiereCambiar;
  
  if (debeCambiarTipo) {
    if (/\b(terreno|terrenos|lote|lotes)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Terreno';
    } else if (/\b(casa|casas|residencia)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Casa';
    } else if (/\b(departamento|depto|deptos|apartamento)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Departamento';
    } else if (/\b(local|locales|comercial|oficina|oficinas)\b/.test(mensajeLower)) {
      cambios.tipo_propiedad = 'Local comercial';
    }
  }
  
  // ===== DETECTAR ZONA =====
  const zonaActual = estadoActual.zona || '';
  const debeCambiarZona = !zonaActual || quiereCambiar;
  
  if (debeCambiarZona) {
    if (/\bzapopan\b/.test(mensajeLower)) {
      cambios.zona = 'Zapopan, Jalisco';
    } else if (/\bguadalajara\b/.test(mensajeLower)) {
      cambios.zona = 'Guadalajara, Jalisco';
    } else if (/\bcentro\b/.test(mensajeLower)) {
      cambios.zona = 'Centro';
    }
  }
  
  // ===== DETECTAR PRESUPUESTO =====
  const presupuestoActual = estadoActual.presupuesto || '';
  const debeCambiarPresupuesto = !presupuestoActual || quiereCambiar;
  
  if (debeCambiarPresupuesto) {
    const matchMillones = mensajeLower.match(/(\d+(?:\.\d+)?)\s*(millon|millones|mdp|m)/i);
    if (matchMillones) {
      cambios.presupuesto = `${matchMillones[1]} millones de pesos`;
    } else if (mensaje.match(/\d{6,}/)) {
      const numero = mensaje.match(/\d{6,}/)[0];
      cambios.presupuesto = `${numero} pesos`;
    }
  }
  
  return cambios;
}

async function detectarYActualizarEstado(mensaje, telefono, estadoActual) {
  const cambios = detectarDatosEnMensaje(mensaje, estadoActual);
  
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

  beforeEach(() => {
    guardarEstadoConversacion.mockClear();
  });

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

  test('No debe sobrescribir datos sin palabra de cambio', async () => {
    const estadoConTipo = { ...estadoVacio, tipo_propiedad: 'Casa' };
    const mensaje = 'busco un terreno';
    const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoConTipo);
    // Sin palabra de cambio, mantiene Casa
    expect(nuevoEstado.tipo_propiedad).toBe('Casa');
  });

  // ⭐ NUEVOS TESTS PARA CAMBIO DE OPINIÓN
  test('Debe permitir cambio con "mejor quiero"', async () => {
    const estadoConTipo = { ...estadoVacio, tipo_propiedad: 'Casa' };
    const mensaje = 'mejor quiero un terreno';
    const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoConTipo);
    expect(nuevoEstado.tipo_propiedad).toBe('Terreno');
  });

  test('Debe permitir cambio con "prefiero"', async () => {
    const estadoConZona = { ...estadoVacio, zona: 'Zapopan, Jalisco' };
    const mensaje = 'prefiero en Guadalajara';
    const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoConZona);
    expect(nuevoEstado.zona).toBe('Guadalajara, Jalisco');
  });

  test('Debe permitir cambio con "cambié de opinión"', async () => {
    const estadoCompleto = { 
      ...estadoVacio, 
      tipo_propiedad: 'Casa',
      zona: 'Zapopan, Jalisco',
      presupuesto: '2 millones de pesos'
    };
    const mensaje = 'cambié de opinión, ahora quiero departamento en Guadalajara';
    const nuevoEstado = await detectarYActualizarEstado(mensaje, telefono, estadoCompleto);
    expect(nuevoEstado.tipo_propiedad).toBe('Departamento');
    expect(nuevoEstado.zona).toBe('Guadalajara, Jalisco');
  });
});
