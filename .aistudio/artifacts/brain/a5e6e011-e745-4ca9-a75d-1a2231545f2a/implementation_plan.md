# Plan de Sincronización Global de Filtros por Red en Visión Ecosistema

Armonización del flujo de filtrado en toda la plataforma para que la selección de un canal (Instagram, Facebook, TikTok, YouTube) recalcule integralmente las métricas superiores (KPIs, Cuota de Mercado, Share of Voice, Calidad de Contenido) además de la cuadrícula de contenido.

---

## Arquitectura de Filtrado Unificado

1. **Flujo de Reactividad Global (`filteredData`)**:
   - Actualmente, `filteredData` solo evalúa el rango de fechas (`startDate`, `endDate`).
   - Se actualizará `filteredData` para que, cuando estemos en **Visión Ecosistema (Omnicanal)** y exista un filtro de canal activo (`gridNetworkFilter !== 'ALL'`), se filtre el conjunto de datos completo por red.
   - De este modo, todas las señales dependientes (`kpiSummary`, `kpiCompetitors`, `chartOptions`, `summaryMetrics` y `gridDisplayData`) se recalcularán automáticamente en tiempo real.

2. **Sincronización Bidireccional de la Interfaz**:
   - **Sidebar (Panel Izquierdo)**: Si el usuario ya cargó la data de Visión Ecosistema y hace clic en *Instagram*, no necesita volver a descargar datos desde Apify: se activa el filtro global de Instagram de inmediato sobre la data ya en memoria. Al hacer clic en *Visión Ecosistema*, se restablece a todos los canales.
   - **Barra de Canales Omnicanal (Header / Badges)**: Las tarjetas y chips superiores reflejan el estado activo sincronizado con el sidebar y el dropdown.
   - **Selector de Plataforma en Desglose de Contenido**: Comparte exactamente el mismo estado `gridNetworkFilter`, actualizando KPIs y gráficos en toda la pantalla.
   - **Indicador Visual de Filtro Activo**: Si un canal está filtrado en modo Omnicanal, se muestra un aviso/badge elegante en la cabecera del dashboard (*"Filtrado por: Instagram (X publicaciones) — [Restablecer a Todos]"*).

3. **Historial de Ejecuciones**:
   - Mantiene su rol específico de auditoría: consultar y cargar ejecuciones históricas puntuales de Apify. Si el usuario carga una ejecución individual de una red desde la tabla, el dashboard cambia al modo monored de dicha ejecución.

---

## Fases de Implementación

### Fase 1: Actualización del Motor Reactivo en `apify-viewer.component.ts`
- Modificar el signal computed `filteredData` para considerar `networkFilter` cuando `loadedNetwork() === 'omnicanal'`.
- Adaptar las llamadas y helpers para que los KPIs de seguidores/audiencia muestren las métricas de la red seleccionada o el consolidado cuando esté en `ALL`.
- Asegurar que la función `handleNavSelection(net)` alterne el filtro sin recargas innecesarias.

### Fase 2: Sincronización Visual en la Plantilla HTML (`apify-viewer.component.html`)
- Sincronizar los botones/chips de canal del panel superior omnicanal con `gridNetworkFilter`.
- Agregar un banner/chip informativo de estado cuando hay un canal filtrado en Omnicanal para dar retroalimentación visual inmediata y un botón directo de "Ver Todos los Canales".

### Fase 3: Ajustes Estilísticos en SCSS (`apify-viewer.component.scss`)
- Estilos para el chip de filtro activo global en el header del dashboard.

### Fase 4: Compilación y Verificación
- Ejecutar `compile_applet`.
- Probar el comportamiento de filtrado entre Omnicanal (todos) y cada canal individual (Instagram, Facebook, TikTok, YouTube).
