# Plan de Restablecimiento del Contenedor e Integración de Hugeicons

Plan paso a paso para desbloquear el sistema de archivos del contenedor de desarrollo e integrar de forma ligera y optimizada la librería Hugeicons.

---

## 1. Acción Requerida del Usuario

Para liberar el bloqueo de sincronización del sistema de archivos (`Timed out waiting for applet file system condition to be met`), por favor ejecuta una de estas opciones en la interfaz de **Google AI Studio**:
- **Opción A (Recomendada)**: En el menú superior o en la barra de estado del entorno, haz clic en el botón de recarga/reinicio del contenedor de desarrollo (*Restart Container* / *Reset Environment*).
- **Opción B**: Haz un refresco forzado del navegador con `Ctrl + Shift + R` (o `Cmd + Shift + R` en Mac).

---

## 2. Acciones del Agente tras el Reinicio

Una vez que el contenedor se reinicie con el sistema de archivos operativo:

1. **Limpieza de Dependencias**:
   - Asegurar que `package.json` esté libre de paquetes masivos de miles de archivos como `@hugeicons/core-free-icons`.
2. **Componente Vectorial Liviano de Hugeicons**:
   - Crear un componente reutilizable de Angular `HugeIconComponent` que renderiza directamente los vectores SVG oficiales de Hugeicons (estilo *Stroke Rounded*, 18px-20px) sin dependencias pesadas.
3. **Actualización de la Interfaz**:
   - **`DateRangePickerComponent`**: Iconos de calendario, reloj y selectores de meses.
   - **`ApifyViewerComponent`**: Métricas de Vistas, Me gusta, Comentarios, Total y botón de sincronización.
   - **`ViralHighlightsComponent`**: Corona dorada #1 y previsualizaciones.
4. **Verificación**:
   - Ejecutar `compile_applet` para confirmar que el servidor compila y arranca en el puerto 3000 de forma inmediata.
