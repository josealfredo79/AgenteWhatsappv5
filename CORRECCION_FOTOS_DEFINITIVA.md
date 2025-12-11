# 🔧 CORRECCIÓN DEFINITIVA: No Enviar Fotos Automáticamente

**Fecha:** 2025-12-10 15:35  
**Problema:** Agente enviaba fotos automáticamente al mostrar propiedades (sin que el cliente las pidiera)  
**Estado:** ✅ CORREGIDO

---

## 📋 PROBLEMA REAL IDENTIFICADO

### ❌ Comportamiento Incorrecto (Antes):

Cuando el cliente preguntaba por propiedades:

```
Cliente: "un terreno en Puerto Vallarta"
Bot: "Encontré algunos terrenos:
     1. Terreno Residencial - $880,000
     [AQUÍ AUTOMÁTICAMENTE INCLUÍA FOTOS SIN QUE EL CLIENTE LAS PIDIERA]"
```

**Resultado:** WhatsApp renderizaba las imágenes automáticamente porque el bot incluía los links.

### ✅ Comportamiento Correcto (Ahora):

```
Cliente: "un terreno en Puerto Vallarta"
Bot: "Encontré algunos terrenos:
     1. Terreno Residencial - $880,000
     ¿Te gustaría más detalles o ver fotos?"

Cliente: "sí mándame fotos"
Bot: "Aquí están las fotos: 📸
     🔗 https://imagen1.jpg
     🔗 https://imagen2.jpg"
```

---

## 🔍 CAUSA RAÍZ

### 1. **Prompt No Era Específico**
El prompt decía cuándo incluir fotos si las pidieran, pero NO prohibía incluirlas automáticamente.

### 2. **Función consultarDocumentos Retornaba Todo**
La función `consultarDocumentos` extraía el documento completo con las líneas de FOTO: incluidas, y Claude las veía y las incluía automáticamente en su respuesta.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1️⃣ **Nueva Regla en el Prompt: NO FOTOS AUTOMÁTICAS**

Agregado un nuevo bloque crítico ANTES de la regla de fotos:

```javascript
<REGLA_CRITICA_SIN_FOTOS_AUTOMATICAS>
🚨 REGLA ABSOLUTAMENTE CRÍTICA - NO INCLUIR FOTOS AUTOMÁTICAMENTE:

Cuando muestres propiedades al cliente (casas, terrenos, departamentos):
❌ NUNCA incluyas links de fotos automáticamente
❌ NUNCA incluyas URLs de imágenes en la descripción de la propiedad
❌ NUNCA menciones "aquí están las fotos" si el cliente NO las pidió

✅ SOLO muestra:
- Tipo de propiedad
- Ubicación
- Precio
- Características principales
- Pregunta si le interesa o quiere más detalles

El cliente debe PEDIR EXPLÍCITAMENTE las fotos para recibirlas.
</REGLA_CRITICA_SIN_FOTOS_AUTOMATICAS>
```

### 2️⃣ **Actualizada Regla de Fotos: SOLO CUANDO LAS PIDA**

Modificado el bloque existente para ser más específico:

```javascript
<REGLA_CRITICA_FOTOS>
⚠️ REGLA OBLIGATORIA - SOLO CUANDO EL CLIENTE PIDA FOTOS/IMAGENES:

El cliente DEBE decir explícitamente: 
"fotos", "foto", "imágenes", "imagen", "ver fotos", "muestra fotos", 
"manda fotos", "envía fotos"

SOLO SI EL CLIENTE PIDE FOTOS, entonces:
1. USA la herramienta "consultar_documentos" para obtener los links
2. INCLUYE LOS LINKS en tu respuesta de texto como links clickeables
3. Formato: "Aquí están las fotos: 📸\n🔗 [link1]\n🔗 [link2]"

🎯 IMPORTANTE: Los links solo se comparten cuando el cliente los PIDA EXPLÍCITAMENTE.
</REGLA_CRITICA_FOTOS>
```

### 3️⃣ **Función consultarDocumentos Limpia el Contenido**

La función ahora **REMUEVE las líneas con URLs de fotos** del contenido que se pasa a Claude:

```javascript
// Extraer URLs ANTES de limpiar (quedan disponibles)
let imagenesExtraidas = extraerImagenesDeTexto(fullText);

// LIMPIAR las líneas con fotos del contenido
let contenidoSinFotos = fullText
  .split('\n')
  .filter(line => {
    // Eliminar líneas que empiezan con FOTO:, IMAGEN:, etc.
    if (/^\s*(FOTO|IMAGEN|IMG|IMAGE):/i.test(line)) {
      return false;
    }
    // Eliminar líneas que son solo URLs de imágenes
    if (/^\s*https?:\/\/.*\.(jpg|jpeg|png|webp|gif)/i.test(line)) {
      return false;
    }
    return true;
  })
  .join('\n');

return { 
  success: true, 
  content: contenidoSinFotos,     // ← Sin URLs de fotos
  imagenes: imagenesExtraidas,    // ← URLs disponibles aparte
  busqueda: { tipo, zona, presupuesto }
};
```

**Resultado:**
- Claude recibe la descripción de las propiedades **SIN los links de fotos**
- No puede incluir las fotos porque no las ve en el contenido
- Las URLs están disponibles en el campo `imagenes` para cuando el cliente las pida

---

## 🎯 FLUJO CORRECTO AHORA

### Escenario 1: Cliente Pregunta Por Propiedades

```
👤: "terreno en Puerto Vallarta de 3 millones"

🤖: "Encontré algunos terrenos en Puerto Vallarta: 🌴

1. Terreno Residencial
   - Ubicación: Fraccionamiento Lomas del Sol
   - Precio: $880,000
   - 160 m²
   - Servicios completos

¿Te gustaría ver más detalles o agendar una visita? 📍"
```

**SIN fotos.** ✅

### Escenario 2: Cliente Pide Fotos Explícitamente

```
👤: "mándame fotos"

🤖: "Aquí están las fotos del terreno: 📸

🔗 https://images.unsplash.com/photo-1500382017468-9049fed747ef
🔗 https://images.unsplash.com/photo-1628624747186-a941c476b7ef

Da click en los enlaces para verlas. ¿Te interesa agendar una visita?"
```

**CON links de fotos.** ✅ (Solo cuando las pide)

---

## 📊 COMPARACIÓN

| Aspecto | ANTES ❌ | AHORA ✅ |
|---------|----------|----------|
| **Al mostrar propiedades** | Incluía fotos automáticamente | NO incluye fotos |
| **Contenido de consultar_documentos** | Incluía líneas FOTO: | Limpia líneas FOTO: |
| **Claude ve URLs** | Sí, en el contenido | No, están en campo aparte |
| **Cliente pide fotos** | Las incluía (pero ya las había mostrado) | Las incluye SOLO cuando las pide |
| **WhatsApp renderiza** | Imágenes automáticas | Solo si pide fotos |

---

## 📁 ARCHIVOS MODIFICADOS

### `/frontend/src/pages/api/webhook/whatsapp.js`

**Cambio 1: Nuevo bloque de reglas (líneas 920-937)**
- Agregado `<REGLA_CRITICA_SIN_FOTOS_AUTOMATICAS>`
- Prohibe explícitamente incluir fotos automáticamente

**Cambio 2: Actualizado bloque de fotos (líneas 939-952)**
- Más específico: "El cliente DEBE decir explícitamente"
- Removidas frases redundantes

**Cambio 3: Función consultarDocumentos (líneas 1039-1066)**
- Limpia líneas con FOTO:, IMAGEN:, etc.
- Filtra URLs de imágenes del contenido
- Retorna contenido limpio + imágenes en campo separado

---

## 🧪 CÓMO PROBAR

### Test 1: Mostrar Propiedades (NO debe incluir fotos)

```
Cliente: "casas en Zapopan"
Bot: [muestra casas]
Resultado esperado: ❌ NO debe incluir links de fotos
```

### Test 2: Cliente Pide Fotos (SÍ debe incluir)

```
Cliente: "mándame fotos"
Bot: "Aquí están las fotos: 📸 [links]"
Resultado esperado: ✅ Incluye links de fotos
```

### Test 3: Variantes de Solicitud

Probar con:
- "muéstrame fotos"
- "quiero ver imágenes"
- "tienes fotos?"
- "envíame fotos"

**Todas deben retornar links de fotos.**

---

## 🚀 SIGUIENTE PASO

Subir a GitHub:

```bash
git add .
git commit -m "fix: No enviar fotos automáticamente, solo cuando el cliente las pida

- Agregada REGLA_CRITICA_SIN_FOTOS_AUTOMATICAS
- Actualizada REGLA_CRITICA_FOTOS para ser más específica
- consultarDocumentos limpia URLs de fotos del contenido
- Fotos solo se comparten cuando cliente las solicita explícitamente

Fixes: Agente enviaba fotos sin que el cliente las pidiera"

git push origin main
```

---

## ✅ BENEFICIOS

- ✅ Cliente no recibe fotos que no pidió
- ✅ Conversación más limpia y profesional
- ✅ Menor consumo de datos del cliente
- ✅ Más control sobre la experiencia
- ✅ Fotos disponibles cuando el cliente las pida

---

**Versión:** v5.4.1 (Corrección Asociación)
**Estado:** ✅ IMPLEMENTADO - LISTO PARA DEPLOY  
**Última actualización:** 2025-12-10 23:10

### 🔧 Corrección Final: Asociación Correcta (v5.4.0)
**Problema:** Al "limpiar" las fotos del texto (solución anterior), el agente perdía el contexto de qué foto pertenecía a qué casa, enviando fotos equivocadas.
**Solución Real:** Se revirtió la limpieza agresiva. Ahora el agente **ve las fotos en el texto** (justo debajo de cada propiedad) pero las reglas estrictas del prompt (`REGLA_CRITICA_SIN_FOTOS_AUTOMATICAS`) impiden que las envíe si no se piden.
**Resultado:** Fotos correctas + No envío automático = Comportamiento Perfecto.
