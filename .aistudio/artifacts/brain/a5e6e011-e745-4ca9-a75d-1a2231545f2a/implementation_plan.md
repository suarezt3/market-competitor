# Plan de Implementación: Asistente Inteligente Gemini AI para Analítica y Marketing Intelligence

Este plan detalla la arquitectura e integración del motor de IA **Gemini (gemini-3.8-flash)** para analizar en tiempo real el dataset de competidores, detectar automáticamente los contenidos de mayor impacto (posts/videos más vistos y virales), generar tarjetas de insights ejecutivos y proporcionar un asistente de chat interactivo con preguntas rápidas en 1 clic.

---

## 1. Arquitectura y Backend Server-Side (Gemini API)

### 1.1 Configuración Full-Stack con Angular SSR / Express
- **Instalación de SDK:** `@google/genai` y dependencias del servidor.
- **Seguridad Server-Side:** Inicialización centralizada de `GoogleGenAI` en `server.ts` con `process.env.GEMINI_API_KEY` (sin exponer credenciales al cliente) y header `User-Agent: aistudio-build`.
- **Configuración de `angular.json` y `metadata.json`:**
  - Agregar soporte SSR en `angular.json` para enrutar `/api/gemini/*` a través del middleware Vite/Express.
  - Agregar `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]` en `metadata.json`.
- **Modelo:** `gemini-3.8-flash` para alta velocidad, razonamiento analítico preciso y baja latencia.

### 1.2 Endpoints API REST
1. **`POST /api/gemini/insights`**:
   - Recibe el contexto estructurado de los datos filtrados (marcas, total de posts/reels/tiktoks, métricas agregadas de visualizaciones, likes, comentarios, engagement rate, top 5 posts por views, y comparativa líder vs rivales).
   - Retorna un JSON estructurado con:
     - **Top Outlier Content:** Identificación del post o video más exitoso (views, formato, autor, por qué funcionó).
     - **Executive Summary:** Resumen ejecutivo de 3 bullets de impacto.
     - **Leader vs Competitor Benchmarking:** Fortalezas clave del líder y oportunidades detectadas.
     - **Actionable Recommendations:** 3 acciones tácticas de contenido recomendadas.
2. **`POST /api/gemini/chat`**:
   - Recibe el historial de conversación, la pregunta del usuario y el contexto actualizado del dataset activo.
   - Responde de forma concisa, con números exactos y enlaces o referencias directas a los posts/creadores analizados.

---

## 2. Componentes Frontend y Experiencia de Usuario (UI/UX)

### 2.1 Tarjeta Inteligente de Insights en el Dashboard Principal (`AiInsightsCard`)
- **Ubicación Estratégica:** Justo debajo de la barra de filtros o en la parte superior del dashboard para máxima visibilidad.
- **Componentes Visuales:**
  - **Badge de Estado:** Indicador en vivo "Gemini 3.8 AI Intelligence" con botón de "Refrescar Análisis".
  - **Tarjeta Destacada del Post/Video Estrella:** Muestra en formato visual el post/video con más visualizaciones y engagement, con métricas destacadas (views, likes, engagement score) y la razón del éxito analizada por la IA.
  - **Grid de Puntos Clave:** 3 tarjetas estilizadas con los hallazgos principales (Tendencias de formato, Rendimiento de marcas y Recomendaciones).
  - **Skeleton Loaders & Transiciones:** Animaciones suaves de carga mientras la IA procesa nuevos filtros.

### 2.2 Panel de Asistente Lateral Desplegable (`AiAssistantSidebar` / Drawer)
- **Activador:** Botón flotante accesible y botón dedicado en el menú lateral ("Asistente Gemini AI" con indicador de pulso).
- **Características:**
  - **Header con Acciones Rápidas:** Selector de preguntas predefinidas en 1 clic:
    - ⚡ *"¿Cuál es el post o video con más visualizaciones?"*
    - 📊 *"¿Qué formato genera mayor interacción: Reels, TikTok o Fotos?"*
    - 🏆 *"¿Quién lidera el benchmark de engagement y por qué?"*
    - 💡 *"Dame 3 ideas de contenido basadas en los competidores ganadores."*
  - **Historial de Conversación:** Mensajes en burbujas elegantes estilo Enterprise/Apple con markdown estilizado y etiquetas numéricas.
  - **Caja de Entrada Inteligente:** Prompt libre para hacer cualquier pregunta ad-hoc sobre los datos cargados.
  - **Context-Aware:** El asistente siempre conoce los filtros actualmente aplicados en pantalla (rango de fechas, marcas seleccionadas, red social).

---

## 3. Flujo de Datos y Reactividad con Angular Signals

- **`GeminiService`**: Servicio singleton en Angular que orquesta las llamadas al backend, gestiona estados (`loading`, `error`, `insightsData`, `chatMessages`), y cachea respuestas basadas en los filtros activos para evitar llamadas redundantes.
- **Disparo Automático e Inteligente:**
  - Al cambiar de red social o aplicar filtros de fechas, se activa una actualización silenciosa con debounce.
  - Botón de refresco manual siempre disponible para forzar una nueva reevaluación.

---

## 4. Plan de Verificación y Testing

- **Verificación de Compilación:** Ejecución de `compile_applet` y validación de tipos estrictos de Angular 21 y TypeScript.
- **Pruebas de Flujo End-to-End:**
  1. Filtrar por fecha o red (Instagram / TikTok / YouTube) y comprobar la generación automática de la tarjeta de insights.
  2. Probar el botón de refresco manual.
  3. Probar las preguntas rápidas en 1 clic en el chat y preguntas libres ("¿cuál es el video más visto?").
  4. Comprobar que el sidebar fijo y la barra de filtros sigan perfectamente fijos sin alterar el scroll del dashboard.
