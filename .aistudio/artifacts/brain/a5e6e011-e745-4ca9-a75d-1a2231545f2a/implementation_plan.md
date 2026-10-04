# Plan de Corrección: Gráfico Duplicado y Estilización de Barra de Scroll

## 1. Corrección del Gráfico de Dona Duplicado
- **Problema detectado**: En `src/app/components/apify-viewer/apify-viewer.component.html`, existían dos bloques `@if (marketShareChartOptions())`:
  1. El principal ubicado en la fila superior (junto a "Comunidad de Marca").
  2. Un segundo bloque residual que se añadió debajo del gráfico de evolución temporal.
- **Acción**: Eliminar el segundo bloque residual en `apify-viewer.component.html`, conservando únicamente el gráfico superior de cuota de mercado con sus gradientes y tooltip mejorado.

---

## 2. Estilización Minimalista de la Barra de Scroll Nativa (CSS Cross-Browser)
- **Implementación 100% nativa** (sin librerías adicionales ni impacto en rendimiento):
  - **Soporte WebKit (Chrome, Safari, Edge, Opera)**:
    - Anchura reducida y discreta: `width: 7px; height: 7px;`
    - Pista transparente: `background: transparent;`
    - Deslizador (Thumb) redondeado y suave: `background: #cbd5e1; border-radius: 9999px;`
    - Estado Hover interactivo: `background: #94a3b8;`
  - **Soporte Estándar W3C / Firefox**:
    - `scrollbar-width: thin;`
    - `scrollbar-color: #cbd5e1 transparent;`
- **Ámbito de aplicación**:
  - `src/styles.css`: A nivel global para toda la aplicación y contenedores con scroll vertical/horizontal.
  - `src/app/components/apify-viewer/apify-viewer.component.scss`: Reforzar en `.dashboard-content`, `.kpi-competitors-scroll` y tablas deslizables.

---

## 3. Verificación
1. Ejecutar `compile_applet` para asegurar compilación limpia sin errores.
2. Confirmar que solo exista una única gráfica de dona en la parte superior.
3. Verificar que la barra de scroll lateral sea delgada, elegante y con bordes suaves tipo píldora al deslizar.
