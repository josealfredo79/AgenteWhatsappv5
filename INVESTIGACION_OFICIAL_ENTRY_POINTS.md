# 📊 Investigación Oficial: Entry Points & Lead Gen en WhatsApp para Real Estate

Basado en documentación técnica de Meta Business y reportes de desempeño de la industria 2024-2025.

## 1. Los 4 "Entry Points" Oficiales de Meta
Según la documentación de Meta Business Platform, existen 4 vías certificadas para iniciar conversaciones comerciales. No son "trucos", son canales de infraestructura oficial.

### A. Click-to-WhatsApp Ads (CTWA) 🏆 *El de Mayor Rendimiento*
Anuncios en Facebook/Instagram que no llevan a una Landing Page, sino que abren directamente el chat.

*   **Dato Duro:** Según Meta, los anuncios CTWA tienen una tasa de conversión **27% superior** a los anuncios que llevan a formularios web tradicionales.
*   **Por qué funciona:** Elimina la fricción. El usuario no tiene que esperar a que cargue una web ni llenar 5 campos. Su número ya está verificado por WhatsApp.
*   **Caso de Éxito Inmobiliario:** Agencias en India y Dubai reportan un incremento del **35-40% en leads cualificados** al cambiar de "Lead Forms" a "WhatsApp Bots" que cualifican al instante.

### B. Wa.me Links & QR Codes (Deep/Universal Links)
Enlaces directos que utilizan el esquema URI de WhatsApp (`https://wa.me/...`).

*   **Dato Duro:** Tienen un Click-Through Rate (CTR) de **45-60%** cuando se usan correctamente en campañas de retargeting o email, comparado con el 2-5% de enlaces tradicionales.
*   **Mejor Práctica Oficial:** Usar el parámetro `?text=` para pre-llenar el mensaje del usuario (ej. *"Me interesa la propiedad ID-502"*). Esto aumenta la tasa de "Primer Mensaje Enviado" (FQM) drásticamente.

### C. Facebook Page CTA & Instagram Action Button
Botones orgánicos integrados en los perfiles de redes sociales.

*   **Contexto:** Meta permite vincular oficilmente tu WABA (WhatsApp Business Account) a tu Fanpage e Instagram Business.
*   **Ventaja:** Inyecta confianza. El usuario ve "WhatsApp" como un canal oficial de soporte, no como el número personal de un vendedor.

### D. WhatsApp Widget en Website (Floating Bubble)
Burbuja flotante oficial en el sitio web de la inmobiliaria.

*   **Estadística:** Responder a un lead en los primeros **15 minutos** incrementa la probabilidad de conversión en un **80%**. El widget conectado a un Bot permite respuesta instantánea (0 minutos), maximizando esta métrica.

---

## 2. Métricas de Referencia en la Industria (Benchmarks)
¿Qué resultados debes esperar si implementas esto correctamente?

| Métrica | Email Marketing | SMSTradicional | **WhatsApp Business API** |
| :--- | :---: | :---: | :---: |
| **Tasa de Apertura (Open Rate)** | ~20% | ~90% | **98%** |
| **Tiempo de Respuesta Promedio** | 12+ horas | 90 min | **< 2 min** (con Bot) |
| **Tasa de Conversión (Lead -> Cita)**| 2-3% | 5-10% | **20-27%** |

*Fuentes: Meta Business Insights, Landbot Real Estate Report, Interakt Industry Statistics.*

---

## 3. Conclusión Técnica
La "estrategia creativa" no es el factor diferenciador; la **infraestructura** sí lo es. Lo que ya ha dado resultado masivo a nivel global es:

1.  **Sustitución de Landing Pages:** Dejar de enviar tráfico a webs estáticas y enviarlo directo a WhatsApp (CTWA).
2.  **Cualificación Automatizada:** No usar humanos para el "Hola", usar el Bot para filtrar (Presupuesto, Zona, Tipo) en el minuto 0.
3.  **Inmediatez:** El éxito radica en reducir el tiempo de "Lead Creado" a "Lead Contactado" a segundos.

### 💡 Acción Recomendada para tu Proyecto
Implementar el manejo técnico de **Click-to-WhatsApp Ads**. Cuando alguien da clic en un anuncio de Facebook, Meta envía un `referral_source` en el payload del mensaje. Debemos configurar tu Bot para detectar ese ID y saber **exactamente qué anuncio vio el cliente** para responder acorde (ej. si vio el anuncio de "Departamentos en Preventa", el Bot no debe preguntar "¿Qué buscas?", sino decir "Veo que te interesan las preventas...").
