# 🚀 INSTRUCCIONES DE VALIDACIÓN EN PRODUCCIÓN

## 📌 Requisitos Previos

Antes de comenzar, asegúrate de tener:
- ✅ Cuenta activa en Railway.app
- ✅ Cuenta de Twilio con WhatsApp Sandbox configurado
- ✅ Cuenta de servicio de Google Cloud con APIs habilitadas
- ✅ Google Sheet con hojas "Mensajes" y "Estados"
- ✅ Google Doc con catálogo de propiedades
- ✅ Google Calendar configurado

---

## 🔧 FASE 1: CONFIGURACIÓN INICIAL

### Paso 1: Preparar Google Sheets

1. **Crear/Abrir el Google Sheet**
   - Ve a [sheets.google.com](https://sheets.google.com)
   - Crea un nuevo spreadsheet o abre el existente
   - Copia el ID del Sheet (está en la URL)

2. **Crear Hoja "Mensajes"**
   ```
   Columna A: Timestamp
   Columna B: Telefono
   Columna C: Direccion
   Columna D: Mensaje
   Columna E: MessageId
   ```

3. **Crear Hoja "Estados"**
   ```
   Columna A: Telefono
   Columna B: TipoPropiedad
   Columna C: Zona
   Columna D: Presupuesto
   Columna E: Etapa
   Columna F: Resumen
   Columna G: UltimaActualizacion
   ```

4. **Compartir con la cuenta de servicio**
   - Click en "Compartir" (arriba derecha)
   - Agregar el email de la cuenta de servicio (termina en @*.iam.gserviceaccount.com)
   - Rol: **Editor**
   - Desmarcar "Notificar a las personas"
   - Click en "Compartir"

### Paso 2: Preparar Google Docs

1. **Crear documento de propiedades**
   - Ve a [docs.google.com](https://docs.google.com)
   - Crea un nuevo documento
   - Agregar propiedades en formato:
   ```
   TERRENO EN ZAPOPAN
   Ubicación: Zapopan, Jalisco
   Precio: $2,000,000 MXN
   Superficie: 500 m²
   Características: Zona residencial, servicios completos
   
   CASA EN TLAQUEPAQUE
   Ubicación: Tlaquepaque, Jalisco
   Precio: $3,500,000 MXN
   Características: 3 recámaras, 2 baños, cochera
   ```

2. **Compartir con cuenta de servicio**
   - Click en "Compartir"
   - Agregar email de cuenta de servicio
   - Rol: **Lector**
   - Compartir

3. **Copiar ID del documento**
   - Está en la URL: `docs.google.com/document/d/ESTE_ES_EL_ID/edit`

### Paso 3: Preparar Google Calendar

1. **Abrir Google Calendar**
   - Ve a [calendar.google.com](https://calendar.google.com)
   - Usa el calendario principal o crea uno nuevo

2. **Compartir calendario**
   - Click en ⚙️ Settings
   - Click en el calendario a usar
   - En "Compartir con personas específicas", agregar:
     - Email de cuenta de servicio
     - Permisos: **Hacer cambios en eventos**

3. **Copiar Calendar ID**
   - En Settings del calendario
   - Buscar "Integrar calendario"
   - Copiar el "ID del calendario"

---

## 🚀 FASE 2: DEPLOY EN RAILWAY

### Paso 1: Conectar Repositorio

1. **Ir a Railway**
   - Ve a [railway.app](https://railway.app)
   - Login con GitHub

2. **Crear nuevo proyecto**
   - Click en "New Project"
   - Click en "Deploy from GitHub repo"
   - Seleccionar tu repositorio
   - Click en "Deploy Now"

### Paso 2: Configurar Variables de Entorno

1. **Ir a Variables**
   - En el proyecto, click en "Variables"
   - Click en "Raw Editor"

2. **Copiar y pegar variables**
   ```bash
   ANTHROPIC_API_KEY=tu_clave_de_anthropic
   TWILIO_ACCOUNT_SID=tu_account_sid
   TWILIO_AUTH_TOKEN=tu_auth_token
   TWILIO_WHATSAPP_NUMBER=+14155238886
   GOOGLE_CREDENTIALS_JSON={"type":"service_account",...todo el JSON en una línea...}
   GOOGLE_CALENDAR_ID=tu_calendar_id@group.calendar.google.com
   GOOGLE_SHEET_ID=1-YTVjIqYO-m1XS_t_MRUlE7O4u_8WXKiZTQLh8BrhSE
   GOOGLE_DOCS_ID=1CWRkJNcsScJOK-NMxtxnUdpuxrYcqaru5qiu9rHzbbw
   NODE_ENV=production
   ```

3. **Guardar**
   - Click en "Update Variables"
   - Railway hará redeploy automáticamente

### Paso 3: Verificar Deploy

1. **Ver Logs**
   - Click en "Deployments"
   - Click en el deployment activo
   - Click en "View Logs"

2. **Buscar mensajes de éxito**
   ```
   ✅ Servidor Next.js + Socket.io + MCP listo
   ✅ Puerto: XXXX
   ```

3. **Obtener URL de la aplicación**
   - En Settings → Domains
   - Copiar la URL generada: `https://tu-app.railway.app`

---

## 📱 FASE 3: CONFIGURAR TWILIO WEBHOOK

### Paso 1: Ir a Twilio Console

1. **Abrir Twilio Console**
   - Ve a [console.twilio.com](https://console.twilio.com)
   - Login con tu cuenta

2. **Ir a WhatsApp Sandbox**
   - Menú lateral: Messaging → Try it out → Send a WhatsApp message

### Paso 2: Configurar Webhook

1. **En "Sandbox Configuration"**
   - Scroll hasta "When a message comes in"
   - URL: `https://tu-app.railway.app/api/webhook/whatsapp`
   - Método: **POST**
   - Click en "Save"

2. **Conectar tu teléfono**
   - Sigue las instrucciones para conectar tu WhatsApp
   - Envía el código de activación

---

## 🧪 FASE 4: PRUEBAS DE VALIDACIÓN

### Test 1: Primera Conversación

1. **Enviar desde WhatsApp**
   ```
   Hola
   ```

2. **Verificar respuesta**
   - Debe responder con saludo
   - Debe preguntar qué tipo de propiedad buscas

3. **Verificar en Google Sheets**
   - Abrir hoja "Mensajes"
   - Debe haber 2 filas nuevas (entrada y salida)
   - Abrir hoja "Estados"
   - Debe haber 1 fila con tu número

### Test 2: Proporcionar Información

1. **Enviar**
   ```
   Busco un terreno
   ```

2. **Verificar**
   - Debe reconocer "terreno"
   - Debe preguntar por zona
   - En hoja "Estados", columna B debe tener "terreno"

3. **Enviar**
   ```
   En Zapopan
   ```

4. **Verificar**
   - Debe preguntar por presupuesto
   - En hoja "Estados", columna C debe tener "Zapopan"

### Test 3: Búsqueda de Propiedades

1. **Enviar**
   ```
   Tengo 2 millones
   ```

2. **Verificar**
   - Debe buscar en Google Docs
   - Debe mostrar propiedades disponibles
   - En hoja "Estados", columna D debe tener "2 millones"

### Test 4: Memoria Conversacional (CRÍTICO)

1. **Cerrar WhatsApp completamente**
2. **Esperar 5 minutos**
3. **Abrir WhatsApp y enviar**
   ```
   ¿Qué opciones me habías mencionado?
   ```

4. **Verificar (ESTO ES LO MÁS IMPORTANTE)**
   - ✅ Debe recordar: terreno, Zapopan, 2 millones
   - ✅ Debe mencionar las propiedades anteriores
   - ✅ NO debe volver a preguntar tipo, zona o presupuesto
   - ✅ Debe continuar la conversación naturalmente

### Test 5: Agendar Cita

1. **Enviar**
   ```
   Me interesa el terreno, quiero agendar una visita
   ```

2. **Verificar**
   - Debe preguntar fecha y hora
   
3. **Enviar**
   ```
   El viernes 6 de diciembre a las 3 PM
   ```

4. **Verificar**
   - Debe confirmar la cita
   - Debe aparecer en Google Calendar
   - Debe enviar link de confirmación

---

## 🔍 FASE 5: MONITOREO DE LOGS

### Ver Logs en Railway

1. **Ir a Railway Dashboard**
2. **Click en Deployments → Ver logs activos**

3. **Logs esperados al recibir mensaje**
   ```
   📨 Mensaje de +5215512345678 : Hola
   📋 Estado actual: {"telefono":"+5215512345678",...}
   📚 Cargando 0 mensajes del historial
   💬 Enviando 1 mensajes a Claude
   🔧 Tool: (si aplica)
   ✅ Respuesta enviada, estado guardado
   ```

### Verificar Errores

Si hay errores, buscar:
- ❌ Error obtener estado → Revisar permisos Google Sheets
- ❌ Error docs → Revisar GOOGLE_DOCS_ID y permisos
- ❌ Error cita → Revisar GOOGLE_CALENDAR_ID y permisos
- ❌ Error Twilio → Revisar TWILIO_* credentials

---

## ✅ CHECKLIST FINAL

- [ ] WhatsApp responde mensajes
- [ ] Mensajes se guardan en Google Sheets
- [ ] Estado se mantiene entre mensajes
- [ ] Historial se carga correctamente
- [ ] No repite preguntas sobre datos ya proporcionados
- [ ] Busca propiedades cuando tiene datos completos
- [ ] Agenda citas en Google Calendar
- [ ] Múltiples conversaciones no se cruzan

---

## 🚨 TROUBLESHOOTING COMÚN

### Problema: No responde mensajes

**Solución:**
1. Verificar webhook en Twilio está correcto
2. Verificar que la URL de Railway funciona
3. Ver logs en Railway para ver el error

### Problema: No recuerda conversaciones

**Solución:**
1. Verificar que `obtenerHistorialConversacion()` se ejecuta
2. Ver logs: debe decir "📚 Cargando X mensajes"
3. Verificar hoja "Mensajes" tiene los registros

### Problema: Error al guardar estado

**Solución:**
1. Verificar permisos de Google Sheets (cuenta de servicio debe ser Editor)
2. Verificar GOOGLE_SHEET_ID es correcto
3. Verificar hojas "Mensajes" y "Estados" existen

### Problema: No encuentra propiedades

**Solución:**
1. Verificar GOOGLE_DOCS_ID
2. Verificar permisos de lectura en el documento
3. Verificar que el documento tiene contenido

---

## 📞 SOPORTE

Si después de seguir todos los pasos sigue sin funcionar:

1. **Revisar logs completos en Railway**
2. **Verificar todas las variables de entorno**
3. **Probar endpoints manualmente:**
   ```bash
   curl https://tu-app.railway.app/api/health
   ```

4. **Documentar el error exacto y consultarlo**
