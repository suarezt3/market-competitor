# Plan de Implementación: Cabecera Fija (Sticky) de Filtros Globales y Gráfico de Barras Agrupadas de Engagement

Este plan detalla los cambios para optimizar la experiencia de usuario trasladando los filtros globales a una **cabecera fija flotante (sticky header)** siempre visible durante el scroll, e implementando el **gráfico de barras agrupadas dobles** para visualizar en paralelo el promedio de interacciones y la tasa de engagement (%) por cada competidor.

---

## User Review Required

> [!IMPORTANT]
> **Decisiones de diseño acordadas con el usuario:**
> 1. **Ubicación de Filtros Globales:**
>    - **Cabecera fija superior (`position: sticky; top: 0; z-index: 40`)**: La barra con el selector de rango de fechas y los controles segmentados de métricas (`Total`, `Vistas`, `Likes`, `Comentarios`) se anclará en la parte superior del área de trabajo del dashboard.
>    - Incorporará fondo translúcido con desenfoque de cristal (`backdrop-filter: blur(12px); background: rgba(255, 255, 255, 0.95)`), borde sutil inferior y sombra ligera al hacer scroll, garantizando que el usuario pueda cambiar fechas o métricas en cualquier punto sin tener que desplazarse hacia arriba.
> 2. **Gráfico de Barras Agrupadas Dobles (Engagement vs Interacciones):**
>    - Sustituir la visualización mixta (barra + línea) por **dos barras verticales agrupadas por competidor**:
>      - **Barra 1 (Azul / Color Marca):** Promedio de interacciones por publicación (Likes + Comentarios).
>      - **Barra 2 (Púrpura / Violeta):** Tasa de Engagement Rate estimada (`%`).
>    - Doble eje Y (Eje izquierdo: valor numérico compacto de interacciones; Eje derecho: porcentaje con formato `{value}%`).
>    - Etiquetas numéricas superiores en cada barra y tooltip detallado interactivo.

---

## Proposed Changes

### `src/app/services/apify-chart.service.ts`
- Actualizar `buildEngagementRateChart(network: string, rawData: any[]): EChartsOption`:
  - Configurar las dos series como tipo `'bar'` agrupadas (`barGap: '20%'`, `barMaxWidth: 28`):
    - Serie 1: `'Promedio Interacciones / Post'` con `yAxisIndex: 0`, color de la marca respectiva y bordes superiores redondeados `borderRadius: [4, 4, 0, 0]`.
    - Serie 2: `'Tasa Engagement (%)'` con `yAxisIndex: 1`, color violeta empresarial (`#8b5cf6`), bordes superiores redondeados `borderRadius: [4, 4, 0, 0]` y etiqueta de porcentaje visible `{c}%`.
  - Configurar doble eje Y equilibrado para evitar solapamientos visuales.

### `src/app/components/apify-viewer/apify-viewer.component.html`
- Reubicar la barra de controles `.enterprise-analytics-toolbar`:
  - Moverla a la parte superior de la sección de resultados (`@if (!isLoading() && !error() && data().length > 0)`), antes de los títulos de red y de las tablas de datos, convirtiéndola en la barra de control fija del dashboard.
  - Asegurar que el selector `<app-date-range-picker>` y el control segmentado de métricas queden integrados limpiamente en la cabecera fija.

### `src/app/components/apify-viewer/apify-viewer.component.scss`
- Adaptar `.enterprise-analytics-toolbar`:
  - `position: sticky; top: 0; z-index: 40;`
  - Efecto de desenfoque de cristal (`backdrop-filter: blur(12px); background: rgba(255, 255, 255, 0.94);`)
  - Margen negativo horizontal compensatorio o alineación con el padding del contenedor principal `.dashboard-content` para un acople perfecto de extremo a extremo.
  - Asegurar que el popover del calendario de fechas mantenga un `z-index` superior (`z-index: 50+`) para desplegarse limpiamente sobre cualquier elemento subyacente.

---

## Verification Plan

### Verificación Automatizada
- Ejecutar `compile_applet` para confirmar compilación exitosa sin errores de TypeScript, Angular ni ECharts.

### Verificación Manual / Visual
- Comprobar que al cargar un dataset y hacer scroll hacia abajo por las tablas o por los gráficos de contenido, la barra de filtros de fechas y métricas permanece fija arriba.
- Verificar que al hacer clic en el selector de fechas se abre el modal/dropdown sin recortes ni problemas de capas (z-index).
- Cambiar de fecha o de métrica desde cualquier punto del scroll y confirmar que todos los gráficos y tablas se actualizan instantáneamente.
- Verificar que el gráfico de **Engagement Rate y Promedio de Interacciones** muestra barras dobles agrupadas una al lado de la otra por cada marca competidora.
