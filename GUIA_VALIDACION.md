# ✅ GUÍA DE VALIDACIÓN POST-DEPLOY

## 🎯 Objetivo
Verificar que la corrección de contexto conversacional funcione correctamente en producción.

---

## 📋 CHECKLIST DE VALIDACIÓN

### ✅ 1. Verificar Deploy en Railway

**Pasos:**
1. Ir a [railway.app](https://railway.app)
2. Login y seleccionar tu proyecto
3. Click en "Deployments"
4. Verificar que el último deployment tenga status: **SUCCESS** ✅

**Indicadores de éxito:**
- 🟢 Build: SUCCESS
- 🟢 Deploy: ACTIVE
- 🟢 Healthcheck: PASSING

**Captura esperada:**
```
┌─────────────────────────────────────┐
│ Deployment #XX                      │
│ Status: SUCCESS ✅                  │
│ Time: 2m 34s                        │
│ Commit: fix: Corrección definitiva  │
└─────────────────────────────────────┘
```

---

### ✅ 2. Revisar Logs del Servidor

**Pasos:**
1. En Railway → Click en el deployment activo
2. Click en "View Logs"
3. Filtrar por palabras clave

**Buscar en logs:**
```bash
✅ Servidor Next.js + Socket.io + MCP listo
📨 Mensaje de +521XXXXXXXXXX : [mensaje]
📚 Cargando X mensajes del historial
💬 Enviando X mensajes a Claude
✅ Respuesta enviada
```

**Ejemplo de log correcto:**
```
[2025-12-02 09:00:00] 📨 Mensaje de +5215551234567 : Casa
[2025-12-02 09:00:00] 📋 Estado actual: {"telefono":"+5215551234567","tipo_propiedad":"","zona":"","presupuesto":"","etapa":"inicial"}
[2025-12-02 09:00:00] 📚 Cargando 4 mensajes del historial
[2025-12-02 09:00:01] 💬 Enviando 5 mensajes a Claude
[2025-12-02 09:00:02] ✅ Respuesta enviada
```

**Si ves esto:**
```
📚 Cargando 0 mensajes del historial  ❌ PROBLEMA
```
**Acción:** Verificar que Google Sheets tenga datos en la hoja "Mensajes"

---

### ✅ 3. Prueba de Conversación Básica

**Test Case 1: Flujo completo de 5 mensajes**

Envía estos mensajes uno por uno en WhatsApp:

```
1. Usuario: "Hola"
   ✅ Bot debe responder con saludo y pregunta inicial
   
2. Usuario: "Comprar"
   ✅ Bot debe preguntar tipo de propiedad
   ✅ Bot NO debe volver a preguntar "¿comprar o rentar?"
   
3. Usuario: "Casa"
   ✅ Bot debe preguntar zona
   ✅ Bot debe recordar que es para comprar
   
4. Usuario: "Zapopan"
   ✅ Bot debe preguntar presupuesto
   ✅ Bot debe recordar: comprar + casa + Zapopan
   
5. Usuario: "2 millones"
   ✅ Bot debe buscar propiedades con esos criterios
   ✅ Bot debe presentar opciones específicas
```

**Ejemplo de conversación exitosa:**
```
👤 Usuario: Hola
🤖 Bot: ¡Hola! 👋 ¿Buscas comprar, rentar o invertir en alguna propiedad?

👤 Usuario: Comprar
🤖 Bot: Perfecto. ¿Qué tipo de propiedad buscas? 🏡

👤 Usuario: Casa
🤖 Bot: Excelente. ¿En qué zona te interesa? 📍

👤 Usuario: Zapopan
🤖 Bot: Genial. ¿Cuál es tu presupuesto aproximado? 💰

👤 Usuario: 2 millones
🤖 Bot: Perfecto, déjame buscar casas en Zapopan con ese presupuesto...
[Presenta opciones]
```

---

### ✅ 4. Prueba de Respuestas Cortas (Anti-Reset)

**Test Case 2: Respuestas ambiguas**

```
1. Usuario: "Hola"
   Bot: "¿Buscas comprar o rentar?"
   
2. Usuario: "no"  ← RESPUESTA CORTA
   ✅ Bot NO debe resetear
   ✅ Bot debe pedir clarificación
   ❌ Bot NO debe re-presentarse
   
   Ejemplo correcto:
   "Entendido. ¿Hay algo más en lo que pueda ayudarte? 🤔"
   
   Ejemplo INCORRECTO (reseteo):
   "¡Hola! 👋 ¿Buscas comprar, rentar o invertir?" ← ❌ ESTO ES MALO
```

**Otras respuestas cortas a probar:**
- "ok"
- "si"
- "vale"
- "no"
- "maybe"

**Comportamiento esperado:**
- ✅ Pide clarificación
- ✅ Mantiene el hilo conversacional
- ❌ NO se re-presenta
- ❌ NO reinicia desde cero

---

### ✅ 5. Prueba de Continuidad Extendida

**Test Case 3: Conversación larga (15+ mensajes)**

Mantén una conversación de al menos 15 mensajes seguidos.

**Verificar:**
- ✅ El bot recuerda datos de mensajes 5-10 mensajes atrás
- ✅ No se resetea en ningún punto
- ✅ Mantiene coherencia en las respuestas
- ✅ No vuelve a preguntar datos ya recopilados

**Ejemplo:**
```
Mensaje 1-5: Recopilar datos (tipo, zona, presupuesto)
Mensaje 6-10: Ver opciones de propiedades
Mensaje 11: Usuario dice "no me convencen"
✅ Bot debe recordar los criterios y ofrecer alternativas
❌ Bot NO debe volver a preguntar tipo/zona/presupuesto
```

---

### ✅ 6. Verificar Dashboard

**Pasos:**
1. Ir a: `https://TU-URL.railway.app/dashboard`
2. Login con credenciales
3. Buscar tu número de teléfono

**Verificar en dashboard:**
- ✅ La conversación completa aparece
- ✅ Mensajes ordenados cronológicamente
- ✅ Mensajes del usuario (derecha, gris)
- ✅ Mensajes del bot (izquierda, verde)
- ✅ Timestamps correctos

**Captura esperada:**
```
┌─────────────────────────────────────┐
│ +5215551234567                      │
├─────────────────────────────────────┤
│              Hola            [09:00]│
│ ¡Hola! 👋 ¿Comprar o rentar?        │
│ [09:00]                             │
│              Comprar         [09:01]│
│ Perfecto. ¿Qué tipo?                │
│ [09:01]                             │
│              Casa            [09:02]│
│ Excelente. ¿Zona?                   │
│ [09:02]                             │
└─────────────────────────────────────┘
```

---

### ✅ 7. Verificar Google Sheets

**Pasos:**
1. Abrir tu Google Sheet
2. Ir a la hoja "Mensajes"
3. Verificar últimas filas

**Estructura esperada:**
```
| Timestamp           | Telefono        | Direccion | Mensaje  | MessageSid |
|---------------------|-----------------|-----------|----------|------------|
| 2025-12-02 09:00:00 | +5215551234567  | inbound   | Hola     | SMxxxx     |
| 2025-12-02 09:00:01 | +5215551234567  | outbound  | ¡Hola!   | SMxxxx     |
| 2025-12-02 09:01:00 | +5215551234567  | inbound   | Comprar  | SMxxxx     |
| 2025-12-02 09:01:01 | +5215551234567  | outbound  | Perfecto | SMxxxx     |
```

**Verificar:**
- ✅ Todos los mensajes se guardan
- ✅ Alternancia de inbound/outbound
- ✅ Timestamps correctos
- ✅ MessageSid únicos

---

### ✅ 8. Verificar Estado Persistente

**Pasos:**
1. Google Sheet → Hoja "Estados"
2. Buscar tu número de teléfono

**Verificar que se actualice:**
```
| Telefono       | Tipo  | Zona    | Presupuesto | Etapa     | Resumen           | Última Act.         |
|----------------|-------|---------|-------------|-----------|-------------------|---------------------|
| +5215551234567 | Casa  | Zapopan | 2 millones  | busqueda  | Busca casa en... | 2025-12-02 09:05:00 |
```

**Comprobar:**
- ✅ Se actualiza cuando mencionas tipo/zona/presupuesto
- ✅ Etapa cambia según el flujo
- ✅ Última actualización es reciente

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### ❌ Problema: "Cargando 0 mensajes del historial"

**Causa:** Google Sheets vacío o sin permisos

**Solución:**
1. Verificar que la Service Account tenga acceso al Sheet
2. Verificar que la hoja "Mensajes" exista
3. Enviar un mensaje de prueba en WhatsApp
4. Verificar en Sheet que se guardó

---

### ❌ Problema: Bot se resetea cada mensaje

**Causa:** Código antiguo aún en producción

**Solución:**
1. Verificar commit en Railway
2. Debe decir: "fix: Corrección definitiva de manejo de contexto"
3. Si no, hacer redeploy: `./deploy-v5.1.sh`

---

### ❌ Problema: Error 500 en webhook

**Causa:** Error en construcción del historial

**Solución:**
1. Ver logs en Railway
2. Buscar stack trace
3. Verificar formato de mensajes en Google Sheets
4. Columnas deben ser: A=timestamp, B=telefono, C=direccion, D=mensaje, E=messageId

---

### ❌ Problema: Mensajes duplicados

**Causa:** Twilio reenvía webhook si no recibe respuesta rápida

**Solución:**
1. Optimizar tiempo de respuesta (< 3 segundos)
2. Considerar implementar deduplicación por MessageSid
3. Verificar que no haya múltiples webhooks configurados en Twilio

---

## 📊 MÉTRICAS DE ÉXITO

✅ **Corrección exitosa si:**
- [ ] Bot mantiene contexto por al menos 5 turnos
- [ ] No se resetea con respuestas cortas
- [ ] Logs muestran "Cargando X mensajes del historial" (X > 0)
- [ ] Dashboard muestra conversación completa
- [ ] Google Sheets se actualiza correctamente
- [ ] No hay errores 500 en logs
- [ ] Tiempo de respuesta < 5 segundos

---

## 📞 SOPORTE

Si encuentras problemas:

1. **Revisa logs en Railway** primero
2. **Verifica Google Sheets** que tenga datos
3. **Prueba con otro número** para descartar casos aislados
4. **Revisa documentación:**
   - `CORRECCION_CONTEXTO.md`
   - `RESUMEN_CORRECCIONES_v5.1.md`

---

**Fecha de validación:** _____________  
**Validado por:** _____________  
**Resultado:** ✅ APROBADO / ❌ CON OBSERVACIONES

---

> 💡 **Tip:** Guarda capturas de pantalla de las pruebas exitosas para documentación futura.
