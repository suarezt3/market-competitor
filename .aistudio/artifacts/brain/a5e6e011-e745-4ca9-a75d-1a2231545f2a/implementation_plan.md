# Plan de Implementación: Optimización Integral de Media Queries y Adaptabilidad Responsiva

Este plan aborda la revisión y reestructuración completa del sistema de estilos responsivos para asegurar que toda la suite de Market Intelligence (sidebar, cabecera fija, tarjetas KPI, cuadrícula de gráficos ECharts, tablas de datos, visualizador de contenido viral y modal de guía metodológica) se adapte con fluidez desde dispositivos móviles de 360px hasta monitores ultra-wide de más de 1440px.

---

## User Review Required

> [!IMPORTANT]
> **Puntos Críticos de Adaptabilidad Detectados:**
> 1. **Sidebar vs. Área Principal:** Actualmente solo existe una media query mínima en 1024px. En pantallas medianas y móviles, el sidebar y el área principal necesitan un comportamiento ergonómico (apilamiento limpio, cabecera colapsable y botones de acción accesibles con un solo dedo).
> 2. **Cuadrículas de Gráficas (`charts-grid`):** El valor actual `minmax(450px, 1fr)` fuerza desbordamientos horizontales en pantallas menores a 500px. Se adaptará dinámicamente con `minmax(100%, 1fr)` en móviles y alturas óptimas para evitar cortes en leyendas o ejes.
> 3. **Cabecera Fija y Selector de Métricas:** En móviles (< 768px y < 480px), la fila de métricas ("Total Interacciones", "Vistas", "Likes", "Comentarios") y el selector de fechas deben convertirse en controles táctiles fluidos (scroll horizontal suave o cuadrícula 2x2) sin desbordar la pantalla.
> 4. **Modal de Guía Metodológica:** En resoluciones pequeñas (< 860px), el modal de 2 columnas debe reorganizarse automáticamente a pantalla completa o vista apilada con selector de secciones superior.
> 5. **Popovers de Información `(?)`:** Los tooltips contextuales tendrán límites automáticos de ancho (`max-width: min(340px, calc(100vw - 32px))`) y posicionamiento inteligente para no salirse de la pantalla en pantallas angostas.

---

## Proposed Changes

### 1. Sistema de Breakpoints Estandarizado en `src/app/components/apify-viewer/apify-viewer.component.scss`
Implementaremos una jerarquía fluida con breakpoints bien definidos:
- **Ultra-Wide (> 1600px):** Contención de lectura máxima y cuadrículas de 3 columnas para maximizar el uso de pantalla.
- **Desktop Estándar (1025px - 1440px):** Layout original refinado, 2 columnas de gráficos y KPIs en 4 columnas.
- **Laptop Pequeña / Tablet Horizontal (769px - 1024px):**
  - Layout en una columna vertical con sidebar superior compacto.
  - KPIs en 2 columnas.
  - Gráficas al 100% de ancho con altura ajustada (380px - 420px).
- **Tablet Vertical / Mobile Grande (481px - 768px):**
  - Reducción del padding del dashboard de `3rem` a `1.25rem`.
  - Selector de métricas en scroll horizontal o wrap compacto.
  - Botones de exportación (CSV, XLSX, PDF) agrupados con iconos concisos.
  - Filtros de fecha en bloque vertical.
- **Mobile Estándar (360px - 480px):**
  - Padding de seguridad de `0.75rem` - `1rem`.
  - KPIs en 1 columna (o 2 columnas ultracompactas con fuentes escaladas).
  - Títulos de gráficos con soporte de saltos de línea elegantes para que el botón `(?)` no se superponga con el título ni la leyenda.
  - Tablas de datos con contenedor `overflow-x: auto` con indicador sutil de desplazamiento.

### 2. Ajuste del Modal de Metodología (`src/app/components/methodology-guide/methodology-guide.component.scss`)
- En pantallas < 768px:
  - Rediseño del modal para ocupar `96vw` y `92vh` (o fullscreen táctil).
  - Reemplazo de la barra lateral fija por un menú de pestañas horizontal desplazable con chips interactivos (`overflow-x: auto`).
  - Bloques de fórmulas mono-espaciadas con scroll horizontal suave para que las fórmulas matemáticas largas no se trunquen ni rompan el layout.

### 3. Ajuste del Componente de Tooltip (`src/app/components/metric-info-tooltip/metric-info-tooltip.component.scss`)
- Añadir reglas de contención de viewport:
  - `right: 0` por defecto en pantallas móviles con `max-width: calc(100vw - 3rem)`.
  - Sombra y z-index optimizados para evitar que elementos hermanos o canvas interfieran.

### 4. Componente de Contenido Viral (`src/app/components/viral-highlights/viral-highlights.component.scss`)
- Refuerzo de las media queries existentes para que las tarjetas de posts virales pasen de 3-4 columnas a 2 columnas en tablets y 1 columna en móviles, con previsualizaciones de video/imagen que preserven el aspect-ratio.

### 5. Redimensionamiento Reactivo de ECharts (`src/app/components/apify-viewer/apify-viewer.component.ts`)
- Asegurar que el evento `resize` de la ventana redibuje automáticamente todas las instancias activas de ECharts mediante ResizeObserver o handler debounced, evitando que los gráficos queden con anchos desactualizados tras rotar la pantalla o cambiar el tamaño de ventana.

---

## Verification Plan

### Verificación Automatizada
- Ejecutar `compile_applet` para garantizar que la compilación Angular y de SCSS sea completamente exitosa sin errores de sintaxis.

### Verificación de Resoluciones (Manual / Emulada)
- **Móvil (375px - iPhone SE / 390px - iPhone 12/14):**
  - Comprobar que no existe desplazamiento horizontal no deseado en la página principal (`overflow-x: hidden` en el viewport raíz).
  - Verificar que el botón de *Guía Metodológica*, los selectores de fecha y el selector de métricas se muestran alineados y son fáciles de presionar.
  - Verificar que las tarjetas de gráficos se visualizan al 100% de ancho con leyendas y títulos legibles.
  - Abrir el popover `(?)` y verificar que no se corta en el margen derecho.
- **Tablet (768px - iPad):**
  - Verificar transición fluida entre layout apilado y controles compactos.
- **Laptop / Monitor 1080p (1024px - 1440px):**
  - Comprobar que el sidebar permanece fijo y la cuadrícula de gráficos aprovecha el espacio en 2 columnas sin solapamientos.
