# Plan de Implementación: Cuota de Mercado a Ancho Completo con Lista Vertical Lateral

## 1. Reestructuración del Layout
- **Cuota de Mercado (Fila Superior - Ancho Completo)**:
  - La tarjeta ocupará el 100% del ancho (`grid-column: 1 / -1` / ancho total).
  - Altura óptima de 460px para máxima claridad.
  - **Dona espaciosa a la izquierda** (`center: ['35%', '52%']`, `radius: ['36%', '58%']`): espacio generoso a la izquierda, arriba y abajo para que todas las líneas guía y etiquetas de porcentajes en 2 líneas se desplieguen con holgura sin colisionar con nada.
  - **Leyenda vertical en lista a la derecha** (`orient: 'vertical'`, `right: 36`, `top: 'middle'`): lista limpia y ordenada de competidores con sus identificadores de color, nombres y tipografía legible.
  - **Título y Subtítulo**: Ubicados en la esquina superior izquierda (`left: 0`, `top: 0`) con estilo corporativo.

- **Comunidad de Marca (Fila Inferior - Ancho Completo)**:
  - Ocupará también el 100% del ancho por debajo de la cuota de mercado.
  - La tabla de KPIs y métricas consolidadas se beneficiará del ancho completo, mostrando todas las columnas y competidores con excelente respiración visual.

---

## 2. Modificaciones de Código
1. **`src/app/components/apify-viewer/apify-viewer.component.scss`**:
   - Ajustar `.charts-grid` para que las tarjetas se presenten en filas de ancho completo (`display: flex; flex-direction: column; gap: 1.75rem;`).
   - Ajustar el padding y responsividad de `.chart-card`.
2. **`src/app/services/apify-chart.service.ts`**:
   - Modificar `buildMarketShareChart`:
     - Título a la izquierda: `left: 8`, `top: 8`.
     - Centro de la dona: `['35%', '54%']`, radio: `['34%', '56%']`.
     - Leyenda vertical a la derecha: `orient: 'vertical'`, `right: 28`, `top: 'middle'`, `itemGap: 12`.
     - Etiquetas (`label`): `show: true`, `formatter: '{b}\n{d}%'`, `fontSize: 11`, `lineHeight: 15`.
     - Líneas guía (`labelLine`): `show: true`, `length: 12`, `length2: 16`, `smooth: 0.2`.

---

## 3. Verificación
1. Compilar con `compile_applet` para asegurar cero errores de TypeScript/SCSS.
2. Reiniciar el dev server con `restart_dev_server`.
