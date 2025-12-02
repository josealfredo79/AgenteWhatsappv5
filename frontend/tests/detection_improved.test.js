/**
 * 🧪 TEST DE DETECCIÓN MEJORADA
 * 
 * Valida que la función detectarInformacionDelMensaje detecte correctamente:
 * - Tipos de propiedad con variaciones (terreno/lote, casa/residencia, depto/apartamento)
 * - Zonas con y sin acentos
 * - Presupuestos en múltiples formatos (millones, mil, números con comas, palabras)
 */

const { describe, test, expect } = require('@jest/globals');

// Función de detección (copiada para testing)
function detectarInformacionDelMensaje(mensaje, estadoActual) {
  const mensajeLower = mensaje.toLowerCase();
  let nuevoEstado = { ...estadoActual };
  
  // Detectar si el usuario está CAMBIANDO información (palabras clave)
  const esCambio = mensajeLower.match(/\b(mejor|ahora|cambio|cambi[oó]|prefiero|en realidad|corrección|correcci[oó]n|no\s*,?\s*(quiero|busco|prefiero)|en vez de|instead)\b/);
  
  // Detectar tipo de propiedad (más variaciones)
  const tipoDetectado = 
    mensajeLower.match(/\b(terreno|lote|predio)s?\b/) ? 'terreno' :
    mensajeLower.match(/\b(casa|residencia|vivienda)s?\b/) ? 'casa' :
    mensajeLower.match(/\b(departamento|depto|piso|apartamento)s?\b/) ? 'departamento' :
    null;
  
  // Solo actualizar si: NO tiene valor previo O está cambiando explícitamente
  if (tipoDetectado) {
    if (!nuevoEstado.tipo_propiedad) {
      nuevoEstado.tipo_propiedad = tipoDetectado;
    } else if (esCambio) {
      nuevoEstado.tipo_propiedad = tipoDetectado;
    }
  }
  
  // Detectar zona (ciudades conocidas de Jalisco) - más flexible
  const zonas = [
    { pattern: /\b(zapopan)\b/, nombre: 'Zapopan' },
    { pattern: /\b(guadalajara|gdl)\b/, nombre: 'Guadalajara' },
    { pattern: /\b(tlaquepaque)\b/, nombre: 'Tlaquepaque' },
    { pattern: /\b(tonalá|tonala)\b/, nombre: 'Tonalá' },
    { pattern: /\b(tlajomulco)\b/, nombre: 'Tlajomulco' },
    { pattern: /\b(el salto)\b/, nombre: 'El Salto' }
  ];
  
  let zonaDetectada = null;
  for (const zona of zonas) {
    if (zona.pattern.test(mensajeLower)) {
      zonaDetectada = zona.nombre;
      break;
    }
  }
  
  if (zonaDetectada) {
    if (!nuevoEstado.zona) {
      nuevoEstado.zona = zonaDetectada;
    } else if (esCambio) {
      nuevoEstado.zona = zonaDetectada;
    }
  }
  
  // Detectar presupuesto (más formatos)
  let presupuestoDetectado = null;
  
  // Formato: "2 millones", "3.5 millones", "medio millón"
  const matchMillon = mensajeLower.match(/(\d+(?:\.\d+)?)\s*mill(?:ones|ón)?/);
  if (matchMillon) {
    presupuestoDetectado = `${matchMillon[1]} millones`;
  }
  
  // Formato: "500 mil", "800k"
  const matchMil = mensajeLower.match(/(\d+)\s*(?:mil|k)\b/);
  if (matchMil && !presupuestoDetectado) {
    presupuestoDetectado = `${matchMil[1]} mil pesos`;
  }
  
  // Formato: "$450,000", "450000 pesos"
  const matchNumero = mensajeLower.match(/\$?\s*(\d{1,3}(?:,\d{3})+)/);
  if (matchNumero && !presupuestoDetectado) {
    presupuestoDetectado = `$${matchNumero[1]}`;
  }
  
  // Formato: "medio millón", "un millón"
  if (mensajeLower.includes('medio millón') || mensajeLower.includes('medio millon')) {
    presupuestoDetectado = '0.5 millones';
  } else if (mensajeLower.match(/\bun millón\b/) || mensajeLower.match(/\bun millon\b/)) {
    presupuestoDetectado = '1 millón';
  }
  
  if (presupuestoDetectado) {
    if (!nuevoEstado.presupuesto) {
      nuevoEstado.presupuesto = presupuestoDetectado;
    } else if (esCambio) {
      nuevoEstado.presupuesto = presupuestoDetectado;
    }
  }
  
  return nuevoEstado;
}

describe('🔍 Detección Mejorada de Información', () => {
  
  test('✅ Detecta variaciones de "terreno"', () => {
    const casos = [
      'Quiero un terreno',
      'Busco lote',
      'Me interesa un predio',
      'terrenos en venta'
    ];
    
    casos.forEach(mensaje => {
      const resultado = detectarInformacionDelMensaje(mensaje, {});
      expect(resultado.tipo_propiedad).toBe('terreno');
    });
  });

  test('✅ Detecta variaciones de "casa"', () => {
    const casos = [
      'Una casa en Zapopan',
      'Busco residencia',
      'Vivienda familiar'
    ];
    
    casos.forEach(mensaje => {
      const resultado = detectarInformacionDelMensaje(mensaje, {});
      expect(resultado.tipo_propiedad).toBe('casa');
    });
  });

  test('✅ Detecta variaciones de "departamento"', () => {
    const casos = [
      'Quiero departamento',
      'Busco depto',
      'Un piso en GDL',
      'Apartamento 2 recámaras'
    ];
    
    casos.forEach(mensaje => {
      const resultado = detectarInformacionDelMensaje(mensaje, {});
      expect(resultado.tipo_propiedad).toBe('departamento');
    });
  });

  test('✅ Detecta zonas con/sin acentos', () => {
    const casos = [
      { mensaje: 'en zapopan', zona: 'Zapopan' },
      { mensaje: 'zona tonala', zona: 'Tonalá' },
      { mensaje: 'guadalajara centro', zona: 'Guadalajara' },
      { mensaje: 'en gdl', zona: 'Guadalajara' },
      { mensaje: 'el salto', zona: 'El Salto' }
    ];
    
    casos.forEach(({ mensaje, zona }) => {
      const resultado = detectarInformacionDelMensaje(mensaje, {});
      expect(resultado.zona).toBe(zona);
    });
  });

  test('✅ Detecta presupuestos en formato millones', () => {
    const casos = [
      { mensaje: '2 millones', presupuesto: '2 millones' },
      { mensaje: '3.5 millones', presupuesto: '3.5 millones' },
      { mensaje: 'medio millón', presupuesto: '0.5 millones' },
      { mensaje: 'un millón', presupuesto: '1 millón' }
    ];
    
    casos.forEach(({ mensaje, presupuesto }) => {
      const resultado = detectarInformacionDelMensaje(mensaje, {});
      expect(resultado.presupuesto).toBe(presupuesto);
    });
  });

  test('✅ Detecta presupuestos en formato miles/k', () => {
    const casos = [
      { mensaje: '500 mil', presupuesto: '500 mil pesos' },
      { mensaje: '800k', presupuesto: '800 mil pesos' }
    ];
    
    casos.forEach(({ mensaje, presupuesto }) => {
      const resultado = detectarInformacionDelMensaje(mensaje, {});
      expect(resultado.presupuesto).toBe(presupuesto);
    });
  });

  test('✅ Detecta presupuestos con formato numérico', () => {
    const casos = [
      { mensaje: '$450,000', presupuesto: '$450,000' },
      { mensaje: '1,200,000 pesos', presupuesto: '$1,200,000' }
    ];
    
    casos.forEach(({ mensaje, presupuesto }) => {
      const resultado = detectarInformacionDelMensaje(mensaje, {});
      expect(resultado.presupuesto).toBe(presupuesto);
    });
  });

  test('✅ Detecta múltiple información en un solo mensaje', () => {
    const mensaje = 'Busco terreno en Zapopan de 2 millones';
    const resultado = detectarInformacionDelMensaje(mensaje, {});
    
    expect(resultado.tipo_propiedad).toBe('terreno');
    expect(resultado.zona).toBe('Zapopan');
    expect(resultado.presupuesto).toBe('2 millones');
  });

  test('✅ Caso real del usuario: "terreno en Zapopan de 2 millones"', () => {
    const mensaje = 'terreno en Zapopan de 2 millones';
    const resultado = detectarInformacionDelMensaje(mensaje, {});
    
    expect(resultado.tipo_propiedad).toBe('terreno');
    expect(resultado.zona).toBe('Zapopan');
    expect(resultado.presupuesto).toBe('2 millones');
  });

  test('✅ No sobrescribe información existente', () => {
    const estadoInicial = {
      tipo_propiedad: 'casa',
      zona: 'Guadalajara',
      presupuesto: '1 millón'
    };
    
    const mensaje = 'Quiero un terreno en Zapopan de 3 millones';
    const resultado = detectarInformacionDelMensaje(mensaje, estadoInicial);
    
    // Debe mantener los valores originales
    expect(resultado.tipo_propiedad).toBe('casa');
    expect(resultado.zona).toBe('Guadalajara');
    expect(resultado.presupuesto).toBe('1 millón');
  });

  test('✅ Permite cambiar información con palabras clave', () => {
    const estadoInicial = {
      tipo_propiedad: 'terreno',
      zona: 'Zapopan',
      presupuesto: '2 millones'
    };
    
    const mensaje = 'Mejor quiero una casa en Guadalajara de 3 millones';
    const resultado = detectarInformacionDelMensaje(mensaje, estadoInicial);
    
    // Debe actualizar porque tiene "mejor"
    expect(resultado.tipo_propiedad).toBe('casa');
    expect(resultado.zona).toBe('Guadalajara');
    expect(resultado.presupuesto).toBe('3 millones');
  });

  test('✅ Permite corrección: "No, prefiero..."', () => {
    const estadoInicial = {
      tipo_propiedad: 'terreno',
      zona: 'Zapopan'
    };
    
    const mensaje = 'No, prefiero casa en Tlaquepaque';
    const resultado = detectarInformacionDelMensaje(mensaje, estadoInicial);
    
    expect(resultado.tipo_propiedad).toBe('casa');
    expect(resultado.zona).toBe('Tlaquepaque');
  });

  test('✅ Detecta cambio cuando menciona tipo diferente sin palabra clave', () => {
    const estadoInicial = {
      tipo_propiedad: 'terreno'
    };
    
    const mensaje = 'Ahora busco departamento';
    const resultado = detectarInformacionDelMensaje(mensaje, estadoInicial);
    
    // Debe cambiar porque "ahora" indica cambio
    expect(resultado.tipo_propiedad).toBe('departamento');
  });

});

console.log(`
🧪 TEST DE DETECCIÓN MEJORADA
====================================

Este test valida:
✅ Detección de variaciones de tipo (terreno/lote, casa/residencia, depto/piso)
✅ Detección de zonas con/sin acentos (Zapopan, Tonalá, GDL)
✅ Detección de presupuestos en múltiples formatos
✅ Detección múltiple en un solo mensaje
✅ Protección contra sobrescritura
✅ Caso real reportado por el usuario

Ejecutar con: npm test tests/detection_improved.test.js
`);
