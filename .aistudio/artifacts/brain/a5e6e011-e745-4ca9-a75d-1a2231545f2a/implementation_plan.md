# Plan de Migración Integral de Iconos a Hugeicons

Este plan detalla la sustitución de todos los iconos de interfaz (SVGs genéricos y emojis del sistema) por vectores oficiales de **Hugeicons** (*Stroke Rounded*), conservando las insignias oficiales de las marcas de redes sociales (Instagram, TikTok, YouTube, Facebook).

---

## 1. Actualización de `HugeIconComponent`

Ampliaremos el catálogo de iconos vectoriales en `src/app/components/huge-icon/huge-icon.component.ts` para cubrir todos los casos requeridos:
- **`layers-01`**: Logo de la cabecera "Market Intelligence PRO" (sustituyendo el SVG actual).
- **`menu-02` / `filter-horizontal`**: Icono del encabezado "Canal Digital:" (sustituyendo el SVG de 3 líneas).
- **`refresh` / `refresh-circle`**: Icono para "Refrescar Análisis" en la tarjeta de Gemini AI y botón "Sincronizar" en la barra lateral (eliminando el emoji `🔄`).
- **`book-open-01`**: Icono para "Guía Metodológica" y botón "Metodología" en la barra flotante.
- **`search-01`**: Icono de lupa para el campo de búsqueda en la tabla de ejecuciones (`Historial de Ejecuciones`).
- **`sparkles`**: Insignia de Gemini AI (eliminando el emoji `✨`).
- **`bubble-chat`**: Botón "Preguntar al Asistente" (eliminando el emoji `💬`).
- **`arrow-right-01`, `arrow-left-01`, `arrow-down-01`**: Flechas de paginación y selectores desplegables.

---

## 2. Archivos y Componentes a Modificar

1. **`src/app/components/huge-icon/huge-icon.component.ts`**:
   - Añadir los trazados SVG precisos de `layers-01`, `menu-02`, `book-open-01` y `search-01`.
2. **`src/app/components/apify-viewer/apify-viewer.component.html`**:
   - Reemplazar el logo en `brand-logo-badge` por `<app-huge-icon name="layers-01">`.
   - Reemplazar el botón "Guía Metodológica" en la barra lateral por `<app-huge-icon name="book-open-01">`.
   - Reemplazar el botón "Metodología" en la cabecera fija por `<app-huge-icon name="book-open-01">`.
3. **`src/app/components/apify-runs-table/apify-runs-table.component.html` & `.ts`**:
   - Importar `HugeIconComponent`.
   - Reemplazar el icono de "Canal Digital:" por `<app-huge-icon name="menu-02">`.
   - Reemplazar el icono de búsqueda en el input de filtrado por `<app-huge-icon name="search-01">`.
4. **`src/app/components/ai-insights-card/ai-insights-card.component.ts`**:
   - Importar `HugeIconComponent`.
   - Reemplazar los emojis `✨`, `🔄` y `💬` por `<app-huge-icon name="sparkles">`, `<app-huge-icon name="refresh">` y `<app-huge-icon name="bubble-chat">`.

---

## 3. Verificación

1. Comprobar que no queden emojis de sistema ni SVGs genéricos en los elementos señalados.
2. Ejecutar `compile_applet` para garantizar cero errores de tipos o compilación.
3. Verificar visualmente la coherencia estética de trazo (1.8px) y color uniforme en toda la plataforma.
