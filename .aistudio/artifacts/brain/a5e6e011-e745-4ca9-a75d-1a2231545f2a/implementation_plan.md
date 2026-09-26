# Plan de Implementación: Corrección de Documentación de "Share of Voice Omnicanal" y Rediseño de Botón en Sidebar

Este plan aborda las dos correcciones solicitadas por el usuario:
1. **Corrección de la Documentación del Gráfico 'Share of Voice Omnicanal':** Sustituir el tooltip erróneo de *"Evolución y Tendencia Temporal"* por la definición, fórmula matemática y campos API exactos de la comparativa multicanal por red (Facebook, Instagram, TikTok, YouTube), además de profundizar esta explicación en la guía metodológica.
2. **Rediseño Profesional del Botón en la Barra Lateral:** Mover y rediseñar el botón de *"Guía Metodológica & Fórmulas"* para que coincida con el estilo estético del dashboard (tarjeta interactiva con micro-badge, icono vectorizado, subtítulo explicativo y micro-interacciones de hover).

---

## User Review Required

> [!IMPORTANT]
> **Detalles de los Cambios Confirmados:**
> 1. **Gráfico 'Share of Voice Omnicanal':**
>    - **Título del Tooltip:** *"Share of Voice Omnicanal (Comparativa Multicanal)"*
>    - **Definición:** *"Desglose del volumen generado por cada marca competidora en cada una de las redes sociales del ecosistema (Facebook, Instagram, TikTok, YouTube) para la métrica activa seleccionada."*
>    - **Fórmula Matemática:** $\text{Volumen}(\text{Marca}, \text{Red}) = \sum_{i \in \text{Posts}(\text{Marca}, \text{Red})} \text{Métrica}_i$
>    - **Campos API:** `__network`, `likes`, `comments`, `views`, `shares`.
>    - **Enlace de Documentación:** Sección 06 de la Guía Metodológica (*Cuota de Mercado y Comparativa Omnicanal*), enriquecida con la explicación de dominancia canal por canal.
> 2. **Botón en Sidebar Lateral:**
>    - Se elimina el estilo por defecto de navegador causado por un anidamiento CSS erróneo fuera de `.dashboard-sidebar`.
>    - Se implementa como una tarjeta de acción refinada: icono de documento/fórmulas con fondo suave índigo, tipografía nítida con título y subtítulo, borde sutil (`#e2e8f0`), elevación suave y transición al pasar el cursor.

---

## Proposed Changes

### 1. Corrección en `src/app/components/apify-viewer/apify-viewer.component.html`
- Localizar el bloque `@if (masterChartOptions())` (línea ~732).
- Actualizar los parámetros de `<app-metric-info-tooltip>`:
  - `title`: `'Share of Voice Omnicanal (Comparativa por Red)'`
  - `definition`: `'Distribución y comparativa del desempeño de cada competidor a través de las distintas redes sociales (Facebook, Instagram, TikTok, YouTube) para la métrica activa.'`
  - `formula`: `'Volumen(Marca, Red) = Σ Métrica_Activa de publicaciones de esa marca en dicha plataforma'`
  - `fieldsUsed`: `['__network', 'likes', 'comments', 'views', 'shares']`
  - `topicId`: `'market_share'`
- Mejorar el marcado del botón en el sidebar para incluir estructura de icono badge, textos jerárquicos (título + subtítulo) e icono de flecha `→`.

### 2. Actualización de Estilos en `src/app/components/apify-viewer/apify-viewer.component.scss`
- Reubicar y perfeccionar la clase `.sidebar-methodology-btn` y su contenedor `.sidebar-help-section` directamente dentro del bloque `.dashboard-sidebar` para garantizar que los estilos se apliquen correctamente.
- Aplicar:
  - `background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.75rem;`
  - Badge de icono SVG con gradiente o fondo `#eef2ff` y color `#4f46e5`.
  - Estructura flex con `title` (`font-weight: 700; font-size: 0.82rem`) y `subtitle` (`color: #64748b; font-size: 0.7rem`).
  - Efecto `:hover` con elevación (`transform: translateY(-1px)`), sombra sutil y borde `#c7d2fe`.

### 3. Profundización en `src/app/components/methodology-guide/methodology-guide.component.html`
- En la sección **06 (Cuota de Mercado y Share of Voice)**, añadir el apartado específico de **Comparativa Omnicanal por Red Social**:
  - Explicar cómo se construye la matriz de barras agrupadas por canal.
  - Cómo ayuda a identificar qué marcas dominan en Facebook (ej. Royal Canin con 4.3M), cuáles en TikTok o Instagram, y cómo evaluar si la estrategia de un competidor es monoplataforma u omnicanal.

---

## Verification Plan

### Verificación Automatizada
- Ejecutar `compile_applet` para confirmar compilación limpia en Angular 21 y SCSS sin advertencias.

### Verificación Manual
- Abrir la vista general omnicanal con data cargada.
- Hacer clic en el icono `(?)` en la esquina superior del gráfico **Share of Voice Omnicanal** y comprobar que muestra el título, definición, fórmula y campos correctos (en lugar del texto de evolución temporal).
- Hacer clic en *"Ver guía metodológica completa"* y verificar que lleva a la sección enriquecida de Cuota de Mercado y Desglose Omnicanal.
- Observar el panel lateral izquierdo y verificar que el botón de *"Guía Metodológica & Fórmulas"* luce con un diseño elegante, profesional y 100% integrado con el estilo visual de la aplicación.
