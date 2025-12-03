# ✅ CHECKLIST DE VALIDACIÓN - Agente WhatsApp v5

## 📋 Pre-Deploy

### 1. Código
- [x] Todas las dependencias instaladas en `package.json`
- [x] Archivo `whatsapp.js` con gestión de estado y historial
- [x] Función `obtenerHistorialConversacion()` implementada
- [x] Función `guardarEstadoConversacion()` implementada
- [x] Sistema de prompt con contexto estructurado
- [x] Manejo correcto de tool use (consultar_documentos, agendar_cita)

### 2. Configuración
- [ ] Variables de entorno configuradas en Railway:
  - [ ] `ANTHROPIC_API_KEY`
  - [ ] `TWILIO_ACCOUNT_SID`
  - [ ] `TWILIO_AUTH_TOKEN`
  - [ ] `TWILIO_WHATSAPP_NUMBER`
  - [ ] `GOOGLE_CREDENTIALS_JSON`
  - [ ] `GOOGLE_SHEET_ID`
  - [ ] `GOOGLE_DOCS_ID`
  - [ ] `GOOGLE_CALENDAR_ID`
  - [ ] `NODE_ENV=production`

### 3. Google Sheets
- [ ] Hoja "Mensajes" con columnas: Timestamp, Telefono, Direccion, Mensaje, MessageId
- [ ] Hoja "Estados" con columnas: Telefono, TipoPropiedad, Zona, Presupuesto, Etapa, Resumen, UltimaActualizacion
- [ ] Permisos de edición para la cuenta de servicio

### 4. Google Docs
- [ ] Documento con catálogo de propiedades creado
- [ ] Permisos de lectura para la cuenta de servicio

### 5. Google Calendar
- [ ] Calendario configurado
- [ ] Permisos de edición para la cuenta de servicio

---

## 🚀 Post-Deploy

### 1. Verificar Deploy en Railway
- [ ] Status: SUCCESS ✅
- [ ] Build completado sin errores
- [ ] Servicio ACTIVE

### 2. Verificar Logs
Buscar en logs de Railway:
- [ ] ✅ Servidor Next.js listo
- [ ] Sin errores de autenticación Google
- [ ] Sin errores de conexión Twilio

### 3. Configurar Webhook de Twilio
- [ ] Ir a Twilio Console > WhatsApp Sandbox
- [ ] Webhook URL: `https://tu-app.railway.app/api/webhook/whatsapp`
- [ ] Método: POST
- [ ] Guardar configuración

---

## 🧪 Pruebas Funcionales

### Test 1: Primer Mensaje (Sin Historial)
**Enviar:** "Hola"
**Esperar:**
- ✅ Respuesta de saludo
- ✅ Pregunta sobre tipo de propiedad
- ✅ Mensaje guardado en hoja "Mensajes"
- ✅ Estado inicial guardado en hoja "Estados"

### Test 2: Continuación de Conversación
**Enviar:** "Busco un terreno"
**Esperar:**
- ✅ Respuesta reconociendo el tipo
- ✅ Pregunta sobre zona/ciudad
- ✅ Estado actualizado con tipo_propiedad="terreno"
- ✅ NO vuelve a preguntar por tipo

### Test 3: Contexto Persistente
**Enviar:** "En Zapopan"
**Esperar:**
- ✅ Respuesta reconociendo la zona
- ✅ Pregunta sobre presupuesto
- ✅ Estado actualizado con zona="Zapopan"
- ✅ NO vuelve a preguntar tipo ni zona

### Test 4: Búsqueda de Propiedades
**Enviar:** "Tengo 2 millones"
**Esperar:**
- ✅ Claude usa tool `consultar_documentos`
- ✅ Respuesta con propiedades del Google Doc
- ✅ Estado actualizado con presupuesto="2 millones"

### Test 5: Agendar Cita
**Enviar:** "Me interesa, quiero agendar una visita"
**Esperar:**
- ✅ Pregunta por fecha/hora preferida
- ✅ Al confirmar, usa tool `agendar_cita`
- ✅ Evento creado en Google Calendar
- ✅ Link de confirmación enviado

### Test 6: Memoria Conversacional (CRÍTICO)
**Escenario:** Cerrar WhatsApp y volver a abrir después de 10 minutos
**Enviar:** "¿Qué opciones tenías para mí?"
**Esperar:**
- ✅ Claude recuerda: tipo, zona, presupuesto
- ✅ Claude recuerda propiedades mencionadas
- ✅ NO vuelve a preguntar datos ya proporcionados
- ✅ Continúa la conversación de forma natural

---

## 🔍 Validación de Datos

### Verificar en Google Sheets - Mensajes
Debe haber registros como:
```
2024-12-02 10:30:00 | +5215512345678 | inbound | Hola | SMXXXXXXXX
2024-12-02 10:30:05 | +5215512345678 | outbound | ¡Hola! Soy Claude... | SMXXXXXXXX
```

### Verificar en Google Sheets - Estados
Debe haber registro como:
```
+5215512345678 | terreno | Zapopan | 2 millones | consulta | Cliente busca... | 2024-12-02 10:35:00
```

### Verificar en Google Calendar
Debe haber evento como:
```
Título: Visita terreno Zapopan - Cliente: +5215512345678
Fecha: 2024-12-05 15:00
Duración: 60 min
```

---

## ❌ Troubleshooting

### Problema: Claude no recuerda conversaciones anteriores
**Causa:** Historial no se está cargando
**Verificar:**
1. Logs: Debe aparecer "📚 Cargando X mensajes del historial"
2. Sheet "Mensajes" tiene los registros
3. Función `obtenerHistorialConversacion()` se ejecuta

### Problema: Estado no se guarda
**Causa:** Permisos de Google Sheets
**Solución:**
1. Verificar que la cuenta de servicio tenga permisos de Editor
2. Verificar que GOOGLE_SHEET_ID sea correcto

### Problema: No encuentra propiedades
**Causa:** Google Docs no accesible
**Solución:**
1. Verificar GOOGLE_DOCS_ID
2. Verificar permisos de lectura
3. Verificar que el documento tenga contenido

### Problema: No agenda citas
**Causa:** Permisos de Google Calendar
**Solución:**
1. Verificar GOOGLE_CALENDAR_ID
2. Verificar permisos de la cuenta de servicio

---

## ✅ Criterios de Éxito

El sistema está funcionando correctamente si:
1. ✅ Responde a mensajes en WhatsApp
2. ✅ Guarda todos los mensajes en Google Sheets
3. ✅ Mantiene estado de conversación persistente
4. ✅ Recuerda conversaciones anteriores (carga historial)
5. ✅ No repite preguntas sobre datos ya proporcionados
6. ✅ Busca propiedades en Google Docs cuando tiene datos completos
7. ✅ Agenda citas en Google Calendar cuando el cliente confirma
8. ✅ Maneja múltiples conversaciones simultáneas sin cruzar contextos

---

## 📝 Notas Finales

- Probar con al menos 2 números de teléfono diferentes para verificar que no se cruzan contextos
- Simular interrupciones (cerrar chat, esperar, volver) para validar persistencia
- Verificar que los logs en Railway muestren el flujo completo sin errores
- Documentar cualquier comportamiento inesperado para ajustes futuros
