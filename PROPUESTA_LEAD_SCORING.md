# Propuesta de Optimización: Clasificación de Clientes e Inversores (Lead Scoring v2.0)

Basado en el análisis de mejores prácticas inmobiliarias y el estado actual de tu bot, presento esta propuesta para diferenciar entre **Compradores de Vivienda** e **Inversores**, mejorando la calificación de leads y la tasa de conversión.

## 1. Análisis de la Situación Actual
Actualmente, el bot utiliza un flujo lineal único:
`Saludo -> Tipo -> Zona -> Presupuesto -> Mostrar Opciones`

**Problema:** Un inversor se aburre con preguntas sobre "cómo se ve viviendo ahí", y un comprador de vivienda se asusta si le hablas de "TIR" o "Cap Rate". Tratar a todos igual reduce la efectividad.

## 2. Diferenciación de Perfiles (Investigación Oficial)

| Característica | Comprador de Vivienda (Homebuyer) | Inversor (Investor) |
| :--- | :--- | :--- |
| **Motivación** | Emocional, familiar, cambio de vida. | ROl, flujo de efectivo, plusvalía, negocio. |
| **Urgencia** | "Necesito mudarme en 2 meses". | "Compro cuando los números cuadren". |
| **Lenguaje** | "Bonito", "Seguro", "Cerca de escuelas". | "Rentabilidad", "Precio m2", "Zona de crecimiento". |
| **Clave de Venta** | Visualización de estilo de vida. | Datos duros y oportunidad financiera. |

## 3. Estrategia Propuesta para el Bot

### A. Detección Temprana de Perfil
Implementar un "termómetro de intención" en el primer mensaje y durante la conversación.

**Palabras clave a detectar:**
*   **Inversor:** *Inversión, rentabilidad, ROI, preventa, lotes, mayoreo, negocio, ganancia, plusvalía.*
*   **Vivienda:** *Vivir, mi familia, casa para mi, mudanza, crédito Infonavit/Fovissste, escuelas, cerca de trabajo.*

### B. Flujo Adaptativo (System Prompt Dinámico)

**Si detectamos PERFIL INVERSOR:**
*   **Tono:** Analítico, directo, enfocado en números.
*   **Preguntas Clave:**
    1.  *¿Buscas flujo de efectivo (rentas) o capitalización (revender)?*
    2.  *¿Tienes experiencia invirtiendo en la zona?*
    3.  *¿Presupuesto de recursos propios o apalancamiento?*
*   **Acción Sugerida:** Enviar ficha técnica financiera, mostrar proyecciones.

**Si detectamos PERFIL VIVIENDA:**
*   **Tono:** Empático, cálido, enfocado en estilo de vida.
*   **Preguntas Clave:**
    1.  *¿Cuándo planeas mudarte?*
    2.  *¿Cuántas personas vivirán en la propiedad?*
    3.  *¿Ya cuentas con algún crédito pre-aprobado?*

### C. Sistema de Calificación (Lead Scoring) Mejorado

Actualizaremos el algoritmo de puntaje (0-100) con estos criterios:

**Para Inversores (+Puntos):**
*   Pago de contado / Recursos propios (+20 pts)
*   Habla de "comprar varios" o "lotes" (+15 pts)
*   Decisión rápida / Ya conoce la zona (+10 pts)

**Para Vivienda (+Puntos):**
*   Crédito YA aprobado (+25 pts) - *Factor crítico*
*   Urgencia de mudanza < 3 meses (+15 pts)

**Clasificación Final:**
*   🔥 **HOT:** Listo para comprar/visitar YA (Score > 80)
*   ⛅ **WARM:** En proceso, perfilándose (Score 50-79)
*   ❄️ **COLD:** Curioso, sin presupuesto o largo plazo (Score < 50)

## 4. Implementación Técnica

Requiero tu autorización para realizar los siguientes cambios en `whatsapp.js`:

1.  **Ampliar `detectarDatosEnMensaje`**: Agregar lógica para identificar palabras clave de *Inversión* vs *Vivienda*.
2.  **Modificar `actualizarEstadoConDatos`**: Guardar el `perfil` detectado en una nueva columna del Google Sheet (Columna Q).
3.  **Actualizar `construirSystemPrompt`**: Enviar instrucciones diferentes a Claude dependiendo del `perfil`.
4.  **Refinar `calcularLeadScore`**: Integrar las nuevas reglas de puntaje.

¿Procedemos con estos cambios?
