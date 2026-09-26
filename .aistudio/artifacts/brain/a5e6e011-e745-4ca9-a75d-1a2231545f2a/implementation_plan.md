# Plan de Rediseño: Selector de Ordenación en Comunidad de Marca

Rediseñar el selector nativo HTML `<select>` actual de la sección **Comunidad de Marca** por un selector interactivo tipo Popover Dropdown de alta gama, alineado con el lenguaje visual del dashboard y los filtros de cuadrícula existentes (`custom-filter-dropdown`), integrando iconos contextuales, badge de ordenación activa, microanimaciones y soporte para cierre al hacer clic fuera o presionar Escape.

---

## User Review Required

> [!NOTE]
> Se ha seleccionado el formato **Menú desplegable con Popover y Chevron**, con **iconos contextuales por métrica** y **check de selección activa**.

- **Opciones de ordenación disponibles:**
  1. 👥 **Mayor Comunidad** (`followers`): Ordena por volumen total de comunidad/seguidores acumulados.
  2. 👁️ **Más Vistas** (`views`): Ordena por total de reproducciones/impresiones.
  3. ❤️ **Más Likes** (`likes`): Ordena por interacciones de me gusta.
  4. 📝 **Más Publicaciones** (`posts`): Ordena por volumen de posts publicados.

---

## Proposed Changes

### `src/app/components/apify-viewer/apify-viewer.component.ts`
- Actualizar el tipo del signal de dropdown activo o añadir `activeKpiSortDropdown = signal<boolean>(false)` (o integrar `'kpi-sort'` a `activeGridDropdown`).
- Añadir métodos de control:
  - `toggleKpiSortDropdown(event: MouseEvent)`
  - `selectKpiSort(metric: KpiSortOption)`
  - Integrar en el listener global `onDocumentClick(event: MouseEvent)` el cierre automático de este popover cuando se haga clic fuera.
- Añadir helpers para obtener la etiqueta e icono actual de la opción seleccionada:
  - `getKpiSortLabel(metric: KpiSortOption): string`
  - `getKpiSortIcon(metric: KpiSortOption): string`

### `src/app/components/apify-viewer/apify-viewer.component.html`
- Sustituir el `<select>` nativo básico dentro de `<div class="kpi-controls-header">` por la estructura de Popover:
  - Botón disparador con estilo pill/card compacto:
    - Prefijo sutil `"Ordenar por:"`
    - Icono de la métrica activa
    - Nombre de la métrica en tipografía clara
    - Indicador chevron animado (`expand_more`) con rotación a 180° al abrir
  - Menú flotante (Popover Dropdown):
    - Elevación suave (`box-shadow`), bordes redondeados (`rounded-xl` / `14px`), fondo blanco nítido con borde sutil.
    - Lista de opciones accesibles con roles `menu` y `menuitem`.
    - Cada item con:
      - Icono temático representativo (👥 Followers, 👁️ Vistas, ❤️ Likes, 📝 Posts).
      - Título claro y descriptivo.
      - Checkmark activo animado (icono `check` o checkmark con color primario) cuando está seleccionado.
      - Estados hover y active con feedback visual y transición suave.

### `src/app/components/apify-viewer/apify-viewer.component.scss`
- Añadir estilos personalizados para el componente selector de KPIs:
  - `.kpi-sort-dropdown`: contenedor relativo y aislado.
  - `.kpi-sort-trigger`: botón con acabado premium, bordes refinados, tipografía nítida e interactividad accesible.
  - `.kpi-sort-menu`: popover flotante con animación de entrada (`fade-in` + `translateY`), z-index adecuado sobre los listados de competidores.
  - `.kpi-sort-item`: diseño en renglón con alineación flexible, microinteracción al pasar el mouse, y estado `.is-selected` con fondo suave y acento de color.

---

## Verification Plan

### Verificación Automatizada
- Ejecutar `compile_applet` para garantizar que la compilación de Angular 21 (AOT y Type-Checking estricto) sea 100% exitosa sin errores de tipado ni de sintaxis.

### Verificación Manual / Visual
- Abrir la sección de **Comunidad de Marca** en la vista principal.
- Comprobar que el disparador muestra correctamente la opción seleccionada inicial (por defecto "Mayor Comunidad").
- Hacer clic en el disparador y verificar que el menú desplegable abre con animación suave y chevron rotado.
- Seleccionar cada métrica ("Más Vistas", "Más Likes", "Más Publicaciones", "Mayor Comunidad"):
  - Verificar que la lista de competidores se reordena inmediatamente en tiempo real según la métrica elegida.
  - Verificar que el check activo se actualiza a la opción seleccionada.
  - Comprobar que el popover se cierra automáticamente al seleccionar.
- Verificar el cierre con clic fuera del menú desplegable.
- Validar el responsive y contraste tanto en pantallas de escritorio como en vistas compactas.
