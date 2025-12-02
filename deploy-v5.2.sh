#!/bin/bash
# Script de deployment automatizado para Railway
# Version: 5.2.0 (Incluye detección automática de estado)
# Fecha: 2025-12-02

set -e

echo "🚀 DEPLOYMENT - Agente WhatsApp v5.2.0"
echo "======================================"
echo "Incluye: Solución definitiva al loop infinito mediante detección por código"
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# 1. Verificar directorio
if [ ! -f "SOLUCION_DEFINITIVA_LOOP.md" ]; then
  error "No estás en el directorio correcto o falta documentación"
  exit 1
fi

# 2. Ejecutar Tests
log "Ejecutando tests de detección automática..."
cd frontend
if npm test -- tests/auto_detection.test.js --passWithNoTests --silent 2>&1 | grep -q "PASS"; then
  success "Tests de detección automática PASADOS"
else
  error "Tests fallaron. Revisa el código."
  exit 1
fi
cd ..
echo ""

# 3. Git Commit
log "Preparando commit..."
git add .

COMMIT_MSG="fix: Solución definitiva a loop infinito (Detección por código) v5.2.0

- Implementa 'detectarYActualizarEstado' en whatsapp.js
- Detecta tipo, zona y presupuesto mediante RegEx antes de llamar a Claude
- Actualiza Google Sheets proactivamente
- Elimina dependencia de tool-use para datos críticos
- Agrega tests unitarios (tests/auto_detection.test.js)

Fixes: Bot preguntando repetidamente lo mismo"

git commit -m "$COMMIT_MSG"
success "Commit creado"

# 4. Push
log "Pusheando a GitHub..."
git push origin main
success "Push exitoso"

echo ""
success "✅ DEPLOY INICIADO EN RAILWAY"
echo "Monitorea el progreso en https://railway.app"
