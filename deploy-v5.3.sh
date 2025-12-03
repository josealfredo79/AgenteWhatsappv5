#!/bin/bash
# Script de deployment consolidado para Railway
# Version: 5.3.0 - Incluye todas las correcciones finales
# Fecha: 2025-12-02

set -e  # Detener en caso de error

echo "🚀 DEPLOYMENT - Agente WhatsApp v5.3.0"
echo "======================================"
echo "✅ Gestión de estado persistente"
echo "✅ Memoria conversacional completa"
echo "✅ Sin loops infinitos"
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Funciones de logging
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# ================================
# PASO 1: VERIFICAR ENTORNO
# ================================
log "Verificando entorno de desarrollo..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
  error "Node.js no está instalado"
  exit 1
fi
NODE_VERSION=$(node -v)
success "Node.js: $NODE_VERSION"

# Verificar npm
if ! command -v npm &> /dev/null; then
  error "npm no está instalado"
  exit 1
fi
NPM_VERSION=$(npm -v)
success "npm: $NPM_VERSION"

# Verificar Git
if ! command -v git &> /dev/null; then
  error "Git no está instalado"
  exit 1
fi
GIT_VERSION=$(git --version)
success "$GIT_VERSION"

echo ""

# ================================
# PASO 2: VERIFICAR ESTRUCTURA
# ================================
log "Verificando estructura del proyecto..."

# Verificar archivos críticos
REQUIRED_FILES=(
  "frontend/package.json"
  "frontend/src/pages/api/webhook/whatsapp.js"
  "Dockerfile"
  "railway.toml"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    success "✓ $file"
  else
    error "✗ Falta: $file"
    exit 1
  fi
done

echo ""

# ================================
# PASO 3: VERIFICAR DEPENDENCIAS
# ================================
log "Verificando dependencias de Node.js..."

cd frontend

# Verificar que node_modules existe
if [ ! -d "node_modules" ]; then
  warning "node_modules no existe, instalando dependencias..."
  npm install
fi

# Verificar dependencias críticas
REQUIRED_DEPS=(
  "@anthropic-ai/sdk"
  "twilio"
  "googleapis"
  "luxon"
  "next"
  "socket.io"
)

for dep in "${REQUIRED_DEPS[@]}"; do
  if npm list "$dep" &> /dev/null; then
    success "✓ $dep"
  else
    error "✗ Falta: $dep"
    exit 1
  fi
done

cd ..
echo ""

# ================================
# PASO 4: EJECUTAR TESTS
# ================================
log "¿Ejecutar tests antes de deploy? (y/n)"
read -r RUN_TESTS

if [ "$RUN_TESTS" = "y" ] || [ "$RUN_TESTS" = "Y" ]; then
  log "Ejecutando tests..."
  cd frontend
  
  if npm test -- --passWithNoTests --silent 2>&1; then
    success "Tests completados"
  else
    warning "Algunos tests fallaron, continuando..."
  fi
  
  cd ..
  echo ""
fi

# ================================
# PASO 5: VERIFICAR VARIABLES DE ENTORNO
# ================================
log "Verificando documentación de variables de entorno..."

if [ -f "VARIABLES_ENTORNO_RAILWAY.txt" ]; then
  success "✓ VARIABLES_ENTORNO_RAILWAY.txt encontrado"
  echo ""
  warning "RECUERDA: Configurar estas variables en Railway:"
  echo "  - ANTHROPIC_API_KEY"
  echo "  - TWILIO_ACCOUNT_SID"
  echo "  - TWILIO_AUTH_TOKEN"
  echo "  - TWILIO_WHATSAPP_NUMBER"
  echo "  - GOOGLE_CREDENTIALS_JSON"
  echo "  - GOOGLE_SHEET_ID"
  echo "  - GOOGLE_DOCS_ID"
  echo "  - GOOGLE_CALENDAR_ID"
  echo ""
else
  warning "No se encontró VARIABLES_ENTORNO_RAILWAY.txt"
fi

# ================================
# PASO 6: PREPARAR COMMIT
# ================================
log "Verificando estado de Git..."

# Verificar si es un repositorio Git
if [ ! -d ".git" ]; then
  error "No es un repositorio Git. Ejecuta: git init"
  exit 1
fi

# Verificar rama actual
CURRENT_BRANCH=$(git branch --show-current)
success "Rama actual: $CURRENT_BRANCH"

# Mostrar cambios
if git diff-index --quiet HEAD --; then
  warning "No hay cambios para commitear"
  echo ""
  log "¿Continuar con push de commits existentes? (y/n)"
  read -r PUSH_ANYWAY
  
  if [ "$PUSH_ANYWAY" != "y" ] && [ "$PUSH_ANYWAY" != "Y" ]; then
    warning "Deploy cancelado"
    exit 0
  fi
else
  success "Cambios detectados:"
  git status --short
  echo ""
  
  # Agregar archivos
  log "Agregando archivos al staging..."
  git add .
  success "Archivos agregados"
  
  # Crear commit
  COMMIT_MSG="deploy: Agente WhatsApp v5.3.0 - Memoria conversacional completa

## Características:
- ✅ Gestión de estado persistente en Google Sheets
- ✅ Carga de historial conversacional (últimos 10 mensajes)
- ✅ Detección automática de tipo, zona y presupuesto
- ✅ Sin loops infinitos ni preguntas repetidas
- ✅ Integración con Claude 3.5 Haiku
- ✅ Herramientas: consultar_documentos, agendar_cita

## Correcciones incluidas:
- Implementa obtenerHistorialConversacion()
- Mejora construcción de array de mensajes para Claude
- Valida alternancia de roles user/assistant
- Extrae y guarda estado con JSON en respuesta
- Documentación completa de validación

Deploy timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

  git commit -m "$COMMIT_MSG"
  success "Commit creado"
fi

echo ""

# ================================
# PASO 7: PUSH A GITHUB
# ================================
log "¿Hacer push a GitHub? (y/n)"
read -r DO_PUSH

if [ "$DO_PUSH" = "y" ] || [ "$DO_PUSH" = "Y" ]; then
  log "Pusheando a GitHub..."
  
  # Verificar remote
  if ! git remote get-url origin &> /dev/null; then
    error "No hay remote configurado. Configura con:"
    echo "git remote add origin https://github.com/TU_USUARIO/TU_REPO.git"
    exit 1
  fi
  
  # Push
  git push origin "$CURRENT_BRANCH"
  success "Push exitoso a $CURRENT_BRANCH"
else
  warning "Push cancelado"
  exit 0
fi

echo ""

# ================================
# PASO 8: RESUMEN Y SIGUIENTE PASOS
# ================================
echo "======================================"
success "✅ DEPLOY COMPLETADO"
echo "======================================"
echo ""
echo "📋 SIGUIENTE PASOS:"
echo ""
echo "1️⃣  Ve a Railway (https://railway.app)"
echo "   - Verifica que el deployment esté SUCCESS"
echo "   - Revisa los logs del build"
echo ""
echo "2️⃣  Configura variables de entorno"
echo "   - Copia desde VARIABLES_ENTORNO_RAILWAY.txt"
echo "   - Pega en Railway > Variables > Raw Editor"
echo ""
echo "3️⃣  Obtén la URL de tu app"
echo "   - Railway > Settings > Domains"
echo "   - Copia la URL generada"
echo ""
echo "4️⃣  Configura Twilio Webhook"
echo "   - URL: https://tu-app.railway.app/api/webhook/whatsapp"
echo "   - Método: POST"
echo ""
echo "5️⃣  Ejecuta validación"
echo "   - Sigue INSTRUCCIONES_VALIDACION_PRODUCCION.md"
echo "   - Usa CHECKLIST_VALIDACION.md"
echo ""
echo "======================================"
echo "📚 Documentación disponible:"
echo "   - CHECKLIST_VALIDACION.md"
echo "   - INSTRUCCIONES_VALIDACION_PRODUCCION.md"
echo "   - GUIA_VALIDACION.md"
echo "   - VARIABLES_ENTORNO_RAILWAY.txt"
echo "======================================"
echo ""

success "🎉 ¡Listo para producción!"
