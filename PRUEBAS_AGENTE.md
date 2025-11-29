# 🧪 GUÍA DE PRUEBAS - AGENTE WHATSAPP

## ✅ CHECKLIST DE VERIFICACIÓN

### 1️⃣ Prueba de Memoria y Contexto

**Objetivo:** Verificar que el agente NO repite preguntas sobre datos ya proporcionados.

**Pasos:**
1. Envía: `Hola`
   - ✅ Espera: Saludo del agente + pregunta inicial
   
2. Envía: `necesito un terreno`
   - ✅ Espera: Confirmación + pregunta sobre zona o presupuesto
   - ❌ NO debe volver a preguntar qué tipo de propiedad buscas
   
3. Envía: `en Zapopan`
   - ✅ Espera: Confirmación + pregunta sobre presupuesto
   - ❌ NO debe volver a preguntar por zona o tipo
   
4. Envía: `mi presupuesto es de 2 millones`
   - ✅ Espera: Confirmación + consulta de propiedades disponibles
   - ❌ NO debe volver a preguntar por datos ya proporcionados

**Verificación en Google Sheet:**
- Abre tu Google Sheet "Estados"
- Busca tu número de teléfono
- Verifica que tenga:
  - `tipo_propiedad`: Terreno
  - `zona`: Zapopan
  - `presupuesto`: 2 millones
  - `ultima_actualizacion`: Timestamp reciente

---

### 2️⃣ Prueba de Respuestas (No Silencio)

**Objetivo:** Verificar que el agente SIEMPRE responde, nunca se queda callado.

**Pasos:**
1. Envía cualquier mensaje
2. ✅ Espera: Respuesta en menos de 5 segundos
3. ❌ Si no responde: FALLO - revisar logs de Railway

**Nota:** Si el agente guarda datos pero no genera texto, debe enviar mensaje de fallback automático.

---

### 3️⃣ Prueba de Dashboard

**Objetivo:** Verificar que los mensajes se muestran correctamente alineados.

**Pasos:**
1. Abre el dashboard: `https://tu-app.railway.app/dashboard`
2. Inicia sesión (usuario: `admin`, contraseña: `admin123`)
3. Selecciona tu conversación de prueba
4. Verifica:
   - ✅ Tus mensajes (cliente) aparecen a la IZQUIERDA en GRIS
   - ✅ Mensajes del agente aparecen a la DERECHA en VERDE
   - ✅ Los mensajes están en orden cronológico
   - ✅ No hay mensajes duplicados

---

### 4️⃣ Prueba de Actualización de Datos

**Objetivo:** Verificar que el agente puede actualizar datos si el cliente cambia de opinión.

**Pasos:**
1. Envía: `Hola, busco una casa`
   - Verifica Sheet: `tipo_propiedad` = Casa
   
2. Envía: `Mejor quiero un departamento`
   - ✅ Espera: Confirmación del cambio
   - Verifica Sheet: `tipo_propiedad` = Departamento (actualizado)

3. Envía: `Cambié de opinión, prefiero en Guadalajara`
   - ✅ Espera: Confirmación del cambio
   - Verifica Sheet: `zona` = Guadalajara (actualizado)

---

### 5️⃣ Prueba de Conversación Larga

**Objetivo:** Verificar que el agente mantiene contexto en conversaciones extensas.

**Pasos:**
1. Inicia conversación nueva desde otro número (o borra el estado en Sheet)
2. Envía 15-20 mensajes variados:
   - Saludos
   - Preguntas sobre propiedades
   - Cambios de preferencias
   - Preguntas sobre servicios
3. En el mensaje 15+, menciona algo del mensaje 3
4. ✅ Espera: El agente debe recordar el contexto (últimos 10 mensajes)

---

## 🔍 VERIFICACIÓN DE LOGS EN RAILWAY

1. Ve a Railway → Tu proyecto → Logs
2. Busca estos indicadores:

**✅ Logs Correctos:**
```
📨 Mensaje de +52... : [mensaje]
📋 Estado actual: {"telefono":"...","tipo_propiedad":"..."}
🔧 Tool: actualizar_estado
💾 Estado guardado para +52...
✅ Respuesta enviada
```

**❌ Logs de Error:**
```
❌ Error: RestException [Error]: A text message body...
⚠️ La respuesta de Claude estaba vacía
```

---

## 📊 VERIFICACIÓN EN GOOGLE SHEETS

### Hoja "Estados"
Columnas esperadas:
- A: Teléfono
- B: Tipo de propiedad
- C: Zona
- D: Presupuesto
- E: Etapa
- F: Resumen
- G: Última actualización

### Hoja "Mensajes"
Columnas esperadas:
- A: Timestamp
- B: Teléfono
- C: Dirección (inbound/outbound)
- D: Mensaje
- E: MessageId

**Verificación:**
- ✅ Cada mensaje enviado/recibido debe aparecer aquí
- ✅ `inbound` = mensajes del cliente
- ✅ `outbound` = mensajes del agente

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### Problema: "El agente repite preguntas"
**Causa:** No está llamando a `actualizar_estado`
**Solución:** 
1. Verifica logs: debe aparecer `🔧 Tool: actualizar_estado`
2. Si no aparece, el prompt no está funcionando
3. Contacta para revisar configuración de Claude

### Problema: "El agente no responde"
**Causa:** Respuesta vacía sin fallback
**Solución:**
1. Verifica logs: debe aparecer `⚠️ La respuesta de Claude estaba vacía`
2. Si aparece pero no hay mensaje de fallback, hay un error en el código
3. Verifica que el último commit esté desplegado

### Problema: "Dashboard muestra mensajes al revés"
**Causa:** Lógica de dirección incorrecta
**Solución:**
1. Verifica Google Sheet: columna C debe tener `inbound` o `outbound` (minúsculas)
2. Si tiene mayúsculas o espacios, el código actual debería manejarlo
3. Refresca el dashboard (Ctrl+F5)

### Problema: "No guarda el estado en Sheet"
**Causa:** Error de permisos de Google API
**Solución:**
1. Verifica logs: busca `Error guardar estado`
2. Verifica que `GOOGLE_CREDENTIALS_JSON` esté configurado en Railway
3. Verifica que la Service Account tenga permisos de Editor en el Sheet

---

## 📝 REPORTE DE PRUEBAS

Completa este checklist después de probar:

- [ ] ✅ Prueba 1: Memoria y Contexto
- [ ] ✅ Prueba 2: Respuestas (No Silencio)
- [ ] ✅ Prueba 3: Dashboard
- [ ] ✅ Prueba 4: Actualización de Datos
- [ ] ✅ Prueba 5: Conversación Larga

**Fecha de prueba:** _________________

**Número usado para pruebas:** _________________

**Resultado general:** 
- [ ] ✅ Todo funciona correctamente
- [ ] ⚠️ Funciona con problemas menores
- [ ] ❌ Hay errores críticos

**Notas adicionales:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
