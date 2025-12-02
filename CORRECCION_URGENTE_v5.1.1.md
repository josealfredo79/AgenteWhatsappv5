# 🔥 CORRECCIÓN URGENTE APLICADA - v5.1.1

**Fecha:** 2025-12-02 11:30  
**Problema:** Bot se resetea constantemente y no usa herramientas  
**Estado:** ✅ CORREGIDO - LISTO PARA PROBAR

---

## 📊 PROBLEMAS IDENTIFICADOS (según tu conversación)

1. ❌ Bot pregunta "¿Qué tipo de propiedad?" después de que dijiste "terreno" 5 veces
2. ❌ Bot pregunta "¿En qué zona?" después de que dijiste "Zapopan" 4 veces
3. ❌ Bot saluda con "¡Hola! 👋" en CADA mensaje
4. ❌ Bot NO usa las herramientas `actualizar_estado` ni `consultar_documentos`
5. ❌ Bot da respuestas genéricas sin contexto

---

## ✅ CORRECCIONES APLICADAS

### 1️⃣ **Prompt ULTRA-DIRECTO**

ANTES ❌:
```
"Si el cliente dice tipo de propiedad, podrías considerar usar actualizar_estado..."
```

AHORA ✅:
```
**🎯 REGLA DE ORO:**
Cuando el cliente mencione CUALQUIERA de estos datos, 
INMEDIATAMENTE llama a 'actualizar_estado':
- Tipo: terreno, casa, departamento
- Zona: Zapopan, Guadalajara
- Presupuesto: "2 millones", etc.
```

### 2️⃣ **Ejemplos Específicos en el Prompt**

```
Cliente: "un terreno no mas de 2 millones en zapopan"
→ Detectas: tipo=Terreno, presupuesto=2 millones, zona=Zapopan
→ Llamas: actualizar_estado({...})
→ Llamas: consultar_documentos({query: "terrenos Zapopan 2 millones"})
```

### 3️⃣ **Prohibiciones Claras**

```
❌ NUNCA digas "Hola" si ya hay conversación
❌ NUNCA preguntes datos que YA ESTÁN CONFIRMADOS
❌ NUNCA ignores información - SIEMPRE usa actualizar_estado
```

### 4️⃣ **Parámetros Optimizados**

```javascript
max_tokens: 400  // Aumentado de 300
temperature: 0.7  // Agregado para consistencia
```

### 5️⃣ **Mejor Logging**

```
🔧 Herramienta llamada: actualizar_estado
📥 Input: {
  "tipo_propiedad": "Terreno",
  "zona": "Zapopan",
  "presupuesto": "2 millones"
}
```

---

## 🚀 CÓMO PROBAR AHORA

### **Opción A: Probar Localmente (Recomendado)**

```bash
# Terminal 1 - Iniciar servidor
cd /home/josealfredo/proyecto-whatsappv5/frontend
npm run dev

# Espera a ver:
# ✅ Servidor Next.js + Socket.io + MCP listo en http://0.0.0.0:5000
```

```bash
# Terminal 2 - Proxy ngrok (para recibir webhooks de Twilio)
ngrok http 5000

# Copia la URL https://XXXX.ngrok.io
# Configúrala en Twilio:
# https://XXXX.ngrok.io/api/webhook/whatsapp
```

**Luego envía en WhatsApp:**
```
1. "un terreno en Zapopan de 2 millones"
```

**Resultado esperado:**
```
Bot: Excelente, busco terrenos en Zapopan hasta 2 millones. Dame un momento... 🏡
[Debe llamar actualizar_estado Y consultar_documentos]
[Debe mostrar propiedades del Google Doc]
```

---

### **Opción B: Deploy Directo a Railway**

```bash
cd /home/josealfredo/proyecto-whatsappv5

git add .
git commit -m "fix: Prompt ultra-directo para detección automática

- Prompt completamente reescrito para ser más imperativo
- Ejemplos específicos de detección de datos
- Prohibiciones claras contra repetición
- Parámetros optimizados (max_tokens=400, temp=0.7)
- Mejor logging de herramientas

Fixes: Bot se resetea y no usa herramientas"

git push origin main
```

Railway detectará el push y desplegará automáticamente.

---

## 📋 TEST COMPLETO

### Test 1: Detección en una sola línea
```
Tu mensaje: "un terreno en Zapopan de 2 millones"

Logs esperados:
📚 Cargando X mensajes del historial
💬 Enviando X mensajes a Claude
🔧 Herramienta llamada: actualizar_estado
📥 Input: {
  "tipo_propiedad": "Terreno",
  "zona": "Zapopan",  
  "presupuesto": "2 millones"
}
🔧 Herramienta llamada: consultar_documentos
📥 Input: {
  "query": "terrenos Zapopan 2 millones"
}

Bot responde:
"Encontré estas opciones:
1. Terreno en [ubicación] - [precio]
2. Terreno en [ubicación] - [precio]
¿Alguna te interesa?"
```

### Test 2: NO debe resetear
```
Tu mensaje: "zapopan jalisco"

Bot NO debe responder:
❌ "¡Hola! 👋 ¿Qué tipo de propiedad buscas?"

Bot SÍ debe responder:
✅ "Perfecto. ¿Cuál es tu presupuesto para el terreno? 💰"
```

### Test 3: NO debe repetir saludos
```
Conversación larga (5+ mensajes)

Bot NO debe decir "Hola" después del primer mensaje
Bot SÍ debe mantener el contexto
```

---

## 🔍 VERIFICAR EN LOGS

Busca estos indicadores en los logs:

✅ **BUENO:**
```
🔧 Herramienta llamada: actualizar_estado
🔧 Herramienta llamada: consultar_documentos
```

❌ **MALO:**
```
(Sin llamadas a herramientas)
O solo texto sin usar tools
```

---

## 📊 COMPARACIÓN

| Aspecto | Antes ❌ | Después ✅ |
|---------|----------|------------|
| Prompt | Vago y sugiere | Imperativo y obligatorio |
| Ejemplos | Ninguno | Específicos en prompt |
| Detección | Manual/reactiva | Automática/proactiva |
| Logging herramientas | Básico | Detallado con input |
| max_tokens | 300 | 400 |
| temperature | No definida | 0.7 |

---

## ⚠️ SI AÚN NO FUNCIONA

Si después de estos cambios el bot TODAVÍA se resetea:

1. **Verificar Google Sheets:**
   - Hoja "Estados" debe existir
   - Hoja "Mensajes" debe tener datos
   - Service Account debe tener permisos

2. **Verificar logs:**
   - Buscar errores de Google API
   - Verificar que `obtenerEstadoConversacion` devuelve datos

3. **Probar con mensajes simples:**
   - "Hola" → debe responder
   - "terreno" → debe llamar actualizar_estado
   - Revisar logs step by step

---

## 📁 ARCHIVOS MODIFICADOS

- `/frontend/src/pages/api/webhook/whatsapp.js`
  - Líneas 137-206: Prompt completamente reescrito
  - Líneas 470-476: max_tokens y temperature
  - Líneas 482-484: Logging mejorado
  - Líneas 518-525: temperature en tool loop

---

## 🎯 PRÓXIMO PASO INMEDIATO

**Decide:**

A. ¿Probar localmente primero con ngrok?
B. ¿Deployar directo a Railway y probar allá?

**Mi recomendación:** Opción A (local + ngrok)
- Más rápido para iterar
- Ves logs en tiempo real
- Fácil de debuggear

---

**Estado:** 🟡 CORREGIDO - ESPERANDO PRUEBA

**Acción requerida:** Iniciar servidor y probar
