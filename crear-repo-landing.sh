#!/bin/bash

# ============================================
# Script para crear repositorio de Landing Page
# ============================================

echo "🚀 Creando repositorio para Landing Page..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Crear directorio
echo -e "${YELLOW}[1/5] Creando directorio...${NC}"
mkdir -p ~/landing-agente-ai
cp -r ~/proyecto-whatsappv5/landing_standalone/* ~/landing-agente-ai/
cd ~/landing-agente-ai

# 2. Limpiar node_modules
echo -e "${YELLOW}[2/5] Limpiando archivos temporales...${NC}"
rm -rf node_modules package-lock.json

# 3. Inicializar Git
echo -e "${YELLOW}[3/5] Inicializando Git...${NC}"
git init
git add .
git commit -m "feat: Landing page Agente AI - versión inicial

- Hero con Three.js particles background
- Sección servicios (Chatbot, Lead Scoring, Agendamiento, Publicidad)
- Sección 'Por qué somos diferentes' con diferenciadores
- Demo con mockup de WhatsApp
- Contacto con precio y CTA
- Menú hamburguesa responsive
- SEO optimizado con Open Graph
- Servidor Express para Railway"

echo ""
echo -e "${GREEN}✅ Repositorio local creado exitosamente!${NC}"
echo ""
echo "========================================"
echo "📋 PRÓXIMOS PASOS MANUALES:"
echo "========================================"
echo ""
echo "1. Ve a: https://github.com/new"
echo "   - Nombre del repo: landing-agente-ai"
echo "   - NO marques ninguna opción adicional"
echo "   - Click 'Create repository'"
echo ""
echo "2. Luego ejecuta estos comandos:"
echo ""
echo "   cd ~/landing-agente-ai"
echo "   git branch -M main"
echo "   git remote add origin https://github.com/josealfredo79/landing-agente-ai.git"
echo "   git push -u origin main"
echo ""
echo "3. Finalmente en Railway:"
echo "   - New Project → Deploy from GitHub → landing-agente-ai"
echo "   - Settings → Generate Domain"
echo ""
echo -e "${GREEN}🎉 ¡Listo para desplegar!${NC}"
