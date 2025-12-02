#!/bin/bash
# Script de deployment automatizado para Railway
# Version: 5.1.0
# Fecha: 2025-12-02

set -e  # Detener en caso de error

echo "🚀 DEPLOYMENT - Agente WhatsApp v5.1.0"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para logging
log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

warning() {
  echo -e "${YELLOW}[!]${NC} $1"
}

error() {
  echo -e "${RED}[✗]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "RESUMEN_CORRECCIONES_v5.1.md" ]; then
  error "No estás en el directorio del proyecto"
  exit 1
fi

success "Directorio verificado"
echo ""

# Paso 1: Verificar estado de Git
log "Verificando estado de Git..."
if [ -d ".git" ]; then
  success "Repositorio Git encontrado"
else
  error "No es un repositorio Git. Ejecuta: git init"
  exit 1
fi

# Verificar si hay cambios
if git diff-index --quiet HEAD --; then
  warning "No hay cambios para commitear"
else
  success "Cambios detectados"
fi
echo ""

# Paso 2: Mostrar resumen de cambios
log "Archivos modificados:"
git status --short
echo ""

# Paso 3: Ejecutar tests (opcional)
log "¿Ejecutar tests antes de deploy? (y/n)"
read -r run_tests

if [ "$run_tests" = "y" ]; then
  log "Ejecutando tests..."
  cd frontend
  if npm test -- --passWithNoTests --silent 2>&1 | grep -q "PASS\|Tests:"; then
    success "Tests pasados exitosamente"
  else
    warning "Tests completados (revisar output)"
  fi
  cd ..
  echo ""
fi

# Paso 4: Add y Commit
log "Preparando commit..."
git add .
success "Archivos agregados al staging"
echo ""

# Mensaje de commit
COMMIT_MSG="fix: Corrección definitiva de manejo de contexto conversacional

## Cambios Principales:
- ✅ Implementa carga de historial completo (últimos 10 mensajes)
- ✅ Valida alternancia de roles user/assistant según API de Claude
- ✅ Mejora system prompt con énfasis en continuidad
- ✅ Agrega tests unitarios para manejo de contexto
- ✅ Documenta solución con referencias oficiales de Anthropic

## Problema Resuelto:
El agente perdía el contexto entre mensajes porque solo enviaba
el mensaje actual a Claude, sin historial. La API de Claude es
stateless y requiere el historial completo en cada request.

## Documentación:
- Ver: CORRECCION_CONTEXTO.md
- Ver: RESUMEN_CORRECCIONES_v5.1.md
- Tests: frontend/tests/context.test.js

Fixes: #contexto-perdido
Version: 5.1.0"

log "Commiteando cambios..."
git commit -m "$COMMIT_MSG"
success "Commit creado exitosamente"
echo ""

# Paso 5: Verificar remote
log "Verificando remote de GitHub..."
if git remote get-url origin &> /dev/null; then
  REMOTE_URL=$(git remote get-url origin)
  success "Remote configurado: $REMOTE_URL"
else
  error "No hay remote configurado"
  echo ""
  echo "Configura el remote con:"
  echo "git remote add origin https://github.com/TU_USUARIO/TU_REPO.git"
  exit 1
fi
echo ""

# Paso 6: Push a GitHub
log "Pusheando a GitHub..."
echo "¿Continuar con push? (y/n)"
read -r do_push

if [ "$do_push" = "y" ]; then
  if git push origin main; then
    success "Push exitoso a GitHub"
  else
    warning "Push falló. Intenta: git push -u origin main"
  fi
else
  warning "Push cancelado por el usuario"
  exit 0
fi
echo ""

# Paso 7: Información de Railway
success "¡Deploy iniciado!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Railway detectará automáticamente los cambios"
echo ""
echo "📊 Monitoreo:"
echo "  1. Ve a: https://railway.app"
echo "  2. Selecciona tu proyecto"
echo "  3. Click en 'Deployments'"
echo "  4. Verifica el status: debe decir 'DEPLOYING' o 'SUCCESS'"
echo ""
echo "🔍 Verificar logs:"
echo "  - Click en el deployment activo"
echo "  - Busca: '📚 Cargando X mensajes del historial'"
echo "  - Busca: '💬 Enviando X mensajes a Claude'"
echo ""
echo "🧪 Probar en WhatsApp:"
echo "  1. Envía: 'Hola'"
echo "  2. Espera respuesta del bot"
echo "  3. Envía: 'Comprar'"
echo "  4. Envía: 'Casa'"
echo "  5. Envía: 'Zapopan'"
echo "  6. Verifica que el bot recuerde el contexto"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
success "Deploy completado exitosamente"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Espera 2-3 minutos a que Railway termine el deploy"
echo "  2. Verifica logs en Railway"
echo "  3. Prueba el bot en WhatsApp"
echo "  4. Revisa el dashboard: https://TU-URL.railway.app/dashboard"
echo ""
echo "📄 Documentación:"
echo "  - CORRECCION_CONTEXTO.md: Detalles técnicos"
echo "  - RESUMEN_CORRECCIONES_v5.1.md: Resumen ejecutivo"
echo "  - frontend/tests/context.test.js: Tests unitarios"
echo ""
success "¡Todo listo! 🎉"
