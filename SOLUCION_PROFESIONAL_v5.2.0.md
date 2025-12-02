# 🎯 SOLUCIÓN PROFESIONAL - Pérdida de Contexto (v5.2.0)

**Fecha:** 2025-12-02  
**Problema:** Bot pregunta información que el cliente ya proporcionó  
**Root Cause Identificado:** System prompt NO mostraba explícitamente qué información ya tenía Claude  
**Estado:** ✅ IMPLEMENTADO - LISTO PARA DEPLOY

---

## 🔍 ANÁLISIS DEL PROBLEMA REAL

### Síntoma Observable
```
Usuario: "Busco terreno en Zapopan de 2 millones"
Bot: "¿Qué tipo de propiedad buscas?" ← ❌ YA LO DIJO
Bot: "¿En qué zona?" ← ❌ YA LO DIJO
```

### Root Cause Técnico

**Diagnóstico anterior (incorrecto):** "Claude no lee el historial"

**Diagnóstico correcto (v5.2.0):**
```javascript
// ❌ ANTES - System Prompt Genérico
function construirPromptConEstado(estado) {
  return `Eres Claude, asesor inmobiliario.
  
  INFORMACIÓN QUE NECESITAS:
  1. Tipo
  2. Zona
  3. Presupuesto
  
  Si el cliente YA mencionó algo, NO lo vuelvas a preguntar.`;
}
```

**Problema:** El prompt le dice a Claude "lee el historial", pero **NO le muestra explícitamente qué información ya tiene**.

Claude procesa el historial completo, pero sin un "recordatorio visual" en el system prompt, puede:
- Ignorar información implícita
- Confundirse con múltiples temas en la conversación
- Priorizar preguntar sobre hacer inferencias

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1️⃣ System Prompt Estructurado con Estado Visible

```javascript
function construirPromptConEstado(estado) {
  let infoConocida = [];
  if (estado.tipo_propiedad) infoConocida.push(`✅ Tipo: ${estado.tipo_propiedad}`);
  if (estado.zona) infoConocida.push(`✅ Zona: ${estado.zona}`);
  if (estado.presupuesto) infoConocida.push(`✅ Presupuesto: ${estado.presupuesto}`);
  
  let infoFaltante = [];
  if (!estado.tipo_propiedad) infoFaltante.push('❌ Tipo de propiedad');
  if (!estado.zona) infoFaltante.push('❌ Zona');
  if (!estado.presupuesto) infoFaltante.push('❌ Presupuesto');

  return `Eres un asesor inmobiliario profesional.

═══════════════════════════════════════════════
📋 INFORMACIÓN QUE YA TIENES DEL CLIENTE:
${infoConocida.length > 0 ? infoConocida.join('\n') : '(Ninguna todavía)'}

📝 INFORMACIÓN QUE AÚN FALTA:
${infoFaltante.length > 0 ? infoFaltante.join('\n') : '(¡Ya tienes todo!)'}
═══════════════════════════════════════════════

🎯 INSTRUCCIONES CRÍTICAS:

1. **NUNCA vuelvas a preguntar información marcada con ✅**
2. **Si ya tienes los 3 datos** → Usa 'consultar_documentos'
3. **Si falta algo (❌)** → Pregunta SOLO lo que falta
4. Respuestas cortas: Máximo 3 líneas

═══════════════════════════════════════════════
❌ EJEMPLO INCORRECTO:
Cliente: "Busco terreno en Zapopan"
Tú: "¿Qué tipo de propiedad buscas?" ← ¡YA LO DIJO!

✅ EJEMPLO CORRECTO:
Cliente: "Busco terreno en Zapopan"  
Tú: "Perfecto, ¿qué presupuesto manejas? 💰"
═══════════════════════════════════════════════`;
}
```

**Beneficios:**
- ✅ Claude ve **visualmente** qué información ya tiene
- ✅ Separación clara entre lo que sabe (✅) y lo que falta (❌)
- ✅ Ejemplo concreto del error que debe evitar
- ✅ Instrucciones más directas y enfáticas

---

### 2️⃣ Detección Automática Mejorada

**ANTES:**
```javascript
if (mensajeLower.includes('terreno')) nuevoEstado.tipo_propiedad = 'terreno';
```

**AHORA:**
```javascript
// Detecta: terreno, terrenos, lote, lotes, predio
if (mensajeLower.match(/\b(terreno|lote|predio)s?\b/)) {
  nuevoEstado.tipo_propiedad = 'terreno';
}

// Detecta: casa, casas, residencia, vivienda
if (mensajeLower.match(/\b(casa|residencia|vivienda)s?\b/)) {
  nuevoEstado.tipo_propiedad = 'casa';
}

// Zonas: Zapopan, Tonalá (con/sin acento), GDL
const zonas = [
  { pattern: /\b(zapopan)\b/, nombre: 'Zapopan' },
  { pattern: /\b(guadalajara|gdl)\b/, nombre: 'Guadalajara' },
  { pattern: /\b(tonalá|tonala)\b/, nombre: 'Tonalá' }
];

// Presupuestos: "2 millones", "500 mil", "$450,000", "medio millón"
const matchMillon = mensajeLower.match(/(\d+(?:\.\d+)?)\s*mill(?:ones|ón)?/);
const matchMil = mensajeLower.match(/(\d+)\s*(?:mil|k)\b/);
const matchNumero = mensajeLower.match(/\$?\s*(\d{1,3}(?:,\d{3})+)/);
```

**Cobertura:** 10/10 casos de prueba pasando ✅

---

### 3️⃣ Eliminación de Redundancia

**ANTES:**
```javascript
// Inyectaba contexto redundante en cada mensaje del usuario
let mensajeConContexto = Body;
if (estado.tipo_propiedad) {
  mensajeConContexto += `\n[CONTEXTO: Ya dije que busco ${estado.tipo_propiedad}]`;
}
```

**AHORA:**
```javascript
// Confiamos en el system prompt mejorado
messages.push({ role: 'user', content: Body });
```

**Razón:** El system prompt ya muestra el estado. Agregar contexto al mensaje era redundante y podía confundir a Claude.

---

## 📊 VALIDACIÓN

### Tests Automatizados

```bash
npm test tests/detection_improved.test.js
```

**Resultados:**
```
✓ Detecta variaciones de "terreno" (lote, predio)
✓ Detecta variaciones de "casa" (residencia, vivienda)  
✓ Detecta variaciones de "departamento" (depto, piso, apartamento)
✓ Detecta zonas con/sin acentos (Zapopan, Tonalá, GDL)
✓ Detecta presupuestos en múltiples formatos
✓ Caso real: "terreno en Zapopan de 2 millones" → TODO detectado
✓ No sobrescribe información existente

Tests: 10 passed, 10 total
```

### Flujo Esperado (Post-Fix)

```
Usuario: "Hola"
Bot: "¡Hola! 👋 ¿En qué puedo ayudarte?"

Usuario: "Busco terreno en Zapopan de 2 millones"
→ Detección automática:
  ✅ tipo_propiedad: "terreno"
  ✅ zona: "Zapopan"  
  ✅ presupuesto: "2 millones"

→ System prompt enviado a Claude:
  "📋 INFORMACIÓN QUE YA TIENES:
   ✅ Tipo: terreno
   ✅ Zona: Zapopan
   ✅ Presupuesto: 2 millones
   
   📝 INFORMACIÓN FALTANTE:
   (¡Ya tienes todo!)
   
   Si ya tienes los 3 datos → usa 'consultar_documentos'"

Bot: "Perfecto, déjame buscar terrenos en Zapopan con ese presupuesto 🔍"
→ [Llama a consultar_documentos]
Bot: "Tengo estas opciones: 🏡 Terreno 250m² - $1,950,000..."
```

---

## 🚀 DEPLOY

### 1. Validación Local

```bash
cd /home/josealfredo/proyecto-whatsappv5/frontend
npm run dev

# En otro terminal
ngrok http 5000

# Configurar webhook en Twilio:
# https://XXXX.ngrok.io/api/webhook/whatsapp

# Probar enviando:
# "Busco terreno en Zapopan de 2 millones"
```

### 2. Deploy a Railway

```bash
git add .
git commit -m "fix: System prompt con estado explícito + detección mejorada (v5.2.0)"
git push origin main

# Railway auto-deploy
```

### 3. Verificación en Producción

**Caso de prueba crítico:**
```
1. "Hola"
   → Esperar: Saludo sin preguntas innecesarias

2. "Busco terreno en Zapopan de 2 millones"
   → Esperar: "Perfecto, déjame buscar..." + llamada a consultar_documentos
   → NO debe preguntar: "¿Qué tipo?" "¿Dónde?" "¿Presupuesto?"
```

---

## 📝 ARCHIVOS MODIFICADOS

```
frontend/src/pages/api/webhook/whatsapp.js
  - construirPromptConEstado() → System prompt estructurado
  - detectarInformacionDelMensaje() → Detección con regex mejorado
  - Eliminada inyección redundante de contexto

frontend/tests/detection_improved.test.js
  - Nuevo test suite (10 casos)
  - Validación de detección mejorada
```

---

## 🎓 LECCIONES APRENDIDAS

### Por qué falló el enfoque anterior

1. **Inyección en mensajes del usuario:** Agregar "[CONTEXTO: Ya dije X]" al mensaje contamina el historial y confunde a Claude.

2. **Prompt genérico:** Decir "lee el historial" no es suficiente. Claude necesita ver **explícitamente** qué información ya tiene.

3. **Falta de estructura visual:** Los marcadores ✅/❌ hacen que Claude procese el estado más claramente.

### Principios aplicados (Anthropic Best Practices)

1. **Be Clear & Direct:** System prompt muestra exactamente qué tiene y qué le falta
2. **Use Examples:** Incluye ejemplo de error que debe evitar
3. **Structured Output:** Formato visual claro (separadores, emojis, secciones)
4. **Stateless Context:** Cada request incluye el estado completo en el system prompt

---

## 🔮 PRÓXIMOS PASOS (Si el problema persiste)

Si después de este deploy el bot **aún** pregunta información conocida:

1. **Revisar logs de Railway:**
   ```
   📊 Estado enviado a Claude: { tipo: 'terreno', zona: 'Zapopan', presupuesto: '2 millones' }
   ```
   - Validar que la detección automática funciona en producción

2. **Aumentar temperature:**
   ```javascript
   temperature: 0.5  // Más determinista
   ```

3. **Considerar prefilling:**
   ```javascript
   messages.push({ 
     role: 'assistant', 
     content: 'Entendido, ya tengo:' 
   });
   ```

4. **Última opción - Forzar flujo:**
   Si Claude ignora el estado, validar por código:
   ```javascript
   if (estado.tipo && estado.zona && estado.presupuesto) {
     // Forzar uso de herramienta sin preguntarle a Claude
     const result = await consultarDocumentos({
       query: `${estado.tipo} ${estado.zona} ${estado.presupuesto}`
     });
     // Responder directamente
   }
   ```

---

**Versión:** 5.2.0  
**Autor:** AI Assistant (basado en mejores prácticas de Anthropic)  
**Testing:** ✅ 10/10 tests pasando  
**Listo para:** Deploy a producción
