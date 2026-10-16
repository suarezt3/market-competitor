# Plan de Corrección: Contadores y Filtrado Inmediato por Canal

## Diagnóstico del Problema

1. **Inconsistencia en los Contadores de la Barra Lateral (`getChannelBadge`):**
   - La función `getChannelBadge(net)` utilizaba `this.data().length` cuando el canal seleccionado coincidía con la red (`this.loadedNetwork() === net`). Como `this.data()` contiene todo el conjunto descargado (660 registros: 514 de TikTok + 146 de YouTube), al hacer clic en YouTube se asignaba el total (660) a la etiqueta de YouTube.
   - Además, al estar en un canal individual, los otros canales perdían su contador y mostraban la etiqueta genérica "Live", impidiendo al usuario ver la distribución real de publicaciones disponibles por plataforma.

2. **Comportamiento del Dashboard al Seleccionar Canal:**
   - El usuario requiere que al hacer clic en un canal (ej. TikTok o YouTube), el dashboard filtre inmediatamente las publicaciones de ese canal específico sin mostrar 660 registros en todas partes ni recargar llamadas innecesarias a Apify.
   - La cabecera del dashboard caía en la rama genérica "Se consolidaron 660 registros", generando confusión visual respecto a si el filtro estaba aplicado.

---

## Cambios Propuestos

### 1. Corrección de Contadores en la Barra Lateral (`apify-viewer.component.ts`)
- Modificar `getChannelBadge(net)` para que consulte en tiempo real el desglose de `omnichannelStats()` para el mercado activo (Colombia / México):
  - **Visión Ecosistema:** Muestra el total consolidado (ej. `660 items`).
  - **TikTok:** Muestra siempre sus registros reales (ej. `514`).
  - **YouTube:** Muestra siempre sus registros reales (ej. `146`).
  - **Instagram / Facebook:** Muestra `Live` o `0` si no tienen ejecuciones aún.
- Los contadores permanecerán visibles e independientes en todo momento, sin importar qué elemento esté seleccionado en la barra lateral.

### 2. Filtrado Inmediato y Consistente en el Dashboard (`apify-viewer.component.ts` & `apify-viewer.component.html`)
- Ajustar `filterOrLoadNetwork(net)` y `filteredData` para garantizar que cuando el usuario haga clic en un canal individual (ej. YouTube):
  - `gridNetworkFilter` se establezca en el canal (`youtube`).
  - `filteredData` contenga únicamente los 146 registros de YouTube.
  - El subtítulo principal del dashboard comunique con precisión: *"Mostrando **146 registros** de YouTube (de 660 totales en Colombia)"*.
  - Las métricas, el grid de publicaciones, los destacados virales y los análisis de Gemini reflejen únicamente los datos del canal activo.
- Al seleccionar "Visión Ecosistema", se restablece `gridNetworkFilter = 'ALL'` y se visualizan los 660 registros consolidados.

### 3. Verificación y Validación
- Probar la interacción entre **Visión Ecosistema** (660), **TikTok** (514) y **YouTube** (146).
- Verificar que los badges numéricos de la barra lateral no se alteren erróneamente al cambiar de selección.
- Validar la compilación con `compile_applet` para asegurar cero errores de TypeScript o AOT.
