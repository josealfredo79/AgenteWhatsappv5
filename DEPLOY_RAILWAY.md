# 🚀 GUÍA RÁPIDA: DESPLEGAR EN RAILWAY

## ✅ Checklist Pre-Deployment
- [x] Código local funcionando (Dashboard OK)
- [x] Git repositorio inicializado
- [x] Commit inicial creado
- [x] Prompt profesional implementado
- [x] Dashboard fix aplicado

---

## 📋 PASO 1: CREAR REPOSITORIO EN GITHUB (5 min)

1. Ve a: **https://github.com/new**
2. Configura:
   - **Repository name:** `agente-whatsapp-claude`
   - **Description:** "Agente WhatsApp con Claude AI para consultas inmobiliarias"
   - **Visibility:** **Private** (IMPORTANTE: contiene IDs de Google)
   - **NO marques** "Initialize this repository with"
3. Clic en **"Create repository"**
4. **COPIA la URL** que aparece (algo como: `https://github.com/TU_USUARIO/agente-whatsapp-claude.git`)

---

## 📤 PASO 2: SUBIR CÓDIGO A GITHUB (2 min)

Ejecuta estos comandos en la terminal (reemplaza `TU_USUARIO`):

```bash
cd /home/josealfredo/proyecto\ whatsppv4

# Conectar con GitHub
git remote add origin https://github.com/TU_USUARIO/agente-whatsapp-claude.git

# Subir código
git push -u origin main
```

**Nota:** Te pedirá usuario y contraseña de GitHub. Si tienes 2FA activo, necesitas un **Personal Access Token** en lugar de la contraseña:
- Ve a: https://github.com/settings/tokens
- Clic en "Generate new token (classic)"
- Selecciona: `repo` (full control)
- Copia el token y úsalo como contraseña

---

## 🚄 PASO 3: CREAR PROYECTO EN RAILWAY (5 min)

1. Ve a: **https://railway.app**
2. **Login with GitHub**
3. Clic en **"New Project"**
4. Selecciona **"Deploy from GitHub repo"**
5. Si es la primera vez:
   - Clic en **"Configure GitHub App"**
   - Autoriza Railway
   - Selecciona el repo: `agente-whatsapp-claude`
6. Railway detectará:
   - ✅ Dockerfile
   - ✅ Node.js project
   - ✅ Next.js framework

---

## ⚙️ PASO 4: CONFIGURAR VARIABLES DE ENTORNO (10 min)

En el dashboard de Railway:

1. Clic en tu proyecto
2. Ve a **"Variables"**
3. Clic en **"+ New Variable"**
4. **Agrega estas variables UNA POR UNA:**

### Variables Críticas (OBLIGATORIAS):

```plaintext
ANTHROPIC_API_KEY
```
**Valor:** Tu API key de Claude (empieza con `sk-ant-...`)

```plaintext
TWILIO_ACCOUNT_SID
```
**Valor:** Tu SID de Twilio (empieza con `AC...`)

```plaintext
TWILIO_AUTH_TOKEN
```
**Valor:** Tu Auth Token de Twilio

```plaintext
TWILIO_WHATSAPP_NUMBER
```
**Valor:** `+14155238886`

```plaintext
GOOGLE_CREDENTIALS_JSON
```
**Valor:** El JSON completo de tu Service Account Google
*(Copia TODO desde la primera `{` hasta la última `}`)*
**IMPORTANTE:** Debe ser en UNA SOLA LÍNEA (sin saltos de línea)

```plaintext
GOOGLE_CALENDAR_ID
```
**Valor:** Tu email de Google Calendar

```plaintext
GOOGLE_SHEET_ID
```
**Valor:** El ID de tu Google Sheet
*(ejemplo: `1-YTVjIqYO-m1XS_t_MRUlE7O4u_8WXKiZTQLh8BrhSE`)*

```plaintext
GOOGLE_DOCS_ID
```
**Valor:** El ID de tu Google Doc con las propiedades

```plaintext
NODE_ENV
```
**Valor:** `production`

### Variables del Dashboard (Opcionales):

```plaintext
NEXT_PUBLIC_DASHBOARD_USER
```
**Valor:** `admin` (o el que prefieras)

```plaintext
NEXT_PUBLIC_DASHBOARD_PASS
```
**Valor:** `admin123` (o la que prefieras - CÁMBIALA en producción)

---

## 🚀 PASO 5: HACER DEPLOY (AUTOMÁTICO)

1. Railway iniciará el deploy automáticamente
2. Verás el progreso:
   - 📦 Building...
   - 🔨 Running Dockerfile...
   - 🚀 Starting server...
3. Espera **3-5 minutos**
4. Cuando veas **"SUCCESS"**, tu app está lista

---

## 🌐 PASO 6: OBTENER URL PÚBLICA

1. En Railway, ve a **"Settings"**
2. Busca **"Networking"** → **"Public Networking"**
3. Clic en **"Generate Domain"**
4. Railway generará algo como:
   ```
   https://agente-whatsapp-production.up.railway.app
   ```
5. ✅ **COPIA esta URL** (la necesitas para Twilio)

---

## 📞 PASO 7: CONFIGURAR WEBHOOK DE TWILIO

1. Ve a: **https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox**
2. En **"Sandbox Configuration"**:
   - **When a message comes in:**
     ```
     https://TU-URL-DE-RAILWAY.up.railway.app/api/webhook/whatsapp
     ```
   - **HTTP Method:** `POST`
3. Clic en **"Save"**

---

## ✅ PASO 8: PROBAR TODO

### Probar el Webhook:
1. Envía WhatsApp a: **+1 415 523 8886**
2. Primero: `join <codigo-sandbox>` (lo ves en Twilio)
3. Luego: `Hola, busco un terreno en Zapopan`
4. El bot debe responder con el nuevo prompt profesional

### Probar el Dashboard:
1. Ve a: `https://TU-URL-DE-RAILWAY.up.railway.app/dashboard`
2. Login con:
   - Usuario: `admin`
   - Password: `admin123`
3. Deberías ver la conversación con el cliente

### Probar Socket.io:
- El dashboard debe actualizarse en tiempo real cuando lleguen mensajes

---

## 🔍 TROUBLESHOOTING

### Si el deploy falla:
1. Ve a Railway → **"Deployments"** → **"View Logs"**
2. Busca errores relacionados con variables de entorno
3. Verifica que `GOOGLE_CREDENTIALS_JSON` esté en UNA SOLA LÍNEA

### Si el bot no responde:
1. Revisa logs en Railway
2. Verifica que el webhook de Twilio apunte a la URL correcta
3. Asegúrate de que termine en `/api/webhook/whatsapp`

### Si el Dashboard muestra error 500:
1. Revisa que `GOOGLE_SHEET_ID` y `GOOGLE_CREDENTIALS_JSON` estén bien
2. Verifica que la Service Account tenga permisos en la Sheet

---

## 💰 COSTOS

- **Railway:** $5 crédito gratis → luego $5-15/mes (según uso)
- **Twilio:** Gratis en sandbox, $0.005/mensaje en producción
- **Anthropic:** Según uso de Claude

---

## 🎉 ¡LISTO!

Tu agente WhatsApp está funcionando 24/7 en Railway con:
- ✅ Prompt profesional (The Way of the Wolf)
- ✅ Dashboard mejorado con fix de errores
- ✅ Socket.io configurado correctamente
- ✅ Integración con Google (Calendar, Sheets, Docs)

---

## 📝 COMANDOS GIT ÚTILES

### Para actualizar el código después:
```bash
cd /home/josealfredo/proyecto\ whatsppv4
git add .
git commit -m "Descripción de cambios"
git push
```
**Railway hará auto-deploy automáticamente**

### Ver historial:
```bash
git log --oneline
```

### Ver estado:
```bash
git status
```

---

**¿Necesitas ayuda?** Consulta los logs de Railway o revisa `INSTRUCCIONES_RAILWAY.md` para más detalles.
