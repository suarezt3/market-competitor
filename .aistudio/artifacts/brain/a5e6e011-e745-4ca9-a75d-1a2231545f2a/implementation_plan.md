# Sincronización Bidireccional: Market Intelligence & Tabla de Ejecuciones

Garantizar una sincronización total de dos vías entre el panel lateral (**Market Intelligence / Canales & Ecosistema**) y la **Tabla de Ejecuciones (Nube)**, de modo que al seleccionar una plataforma en cualquiera de los dos componentes, la tabla se filtre mostrando exclusivamente esa plataforma, el panel lateral refleje el canal activo y la data de analítica y métricas se cargue de inmediato.

## Decisiones Críticas Confirmadas

> [!IMPORTANT]
> **Decisiones del Usuario (Fase 1 Clarificada):**
> - **Comportamiento de la Tabla al Seleccionar Canal**: La tabla de ejecuciones se filtrará para mostrar **únicamente la plataforma seleccionada** (ej. al seleccionar TikTok, la tabla mostrará solo la corrida de TikTok). Al elegir *Visión Ecosistema*, la tabla mostrará todas las plataformas disponibles.
> - **Carga de Datos desde el Panel Lateral**: Al hacer clic en un canal del panel lateral (TikTok, YouTube, etc.), la aplicación cargará directamente la ejecución correspondiente de esa plataforma y sincronizará la tabla y las métricas en un solo flujo continuo.

---

## 1. Visión General & Concepto Central

- **Problema**: Actualmente existía una desconexión de estado. Al hacer clic en una fila de la tabla, `resetState()` restablecía el filtro a `ALL` ("Visión Ecosistema"), provocando que el menú lateral no marcara la red activa y la tabla volviera a mostrar todas las filas. Además, hacer clic en el panel lateral solo aplicaba un filtro cosmético sin cargar la ejecución de Apify si no estaba en memoria.
- **Solución**: Unificar el estado del canal activo (`activeChannel`) a nivel del componente principal (`ApifyViewerComponent`), permitiendo que tanto el clic en el panel lateral como el clic en una fila de la tabla actualicen el mismo canal, carguen los datos de la corrida en Apify y mantengan la tabla filtrada a esa plataforma con su estado visual destacado.

---

## 2. Experiencia de Usuario & Diseño Visual

### Flujos de Interacción

1. **Selección desde la Tabla de Ejecuciones**:
   - El usuario hace clic en la fila de **TikTok** (o **YouTube**).
   - El panel lateral izquierdo actualiza inmediatamente su botón activo a **TikTok** (badge iluminado, fondo oscuro y aria-current).
   - La tabla se filtra para mostrar **únicamente la fila de TikTok**, con un indicador sutil de fila activa y un botón rápido `"Ver todas las plataformas (Visión Ecosistema)"`.
   - Se disparan las métricas, tarjetas KPI, gráficos y el análisis de Gemini AI para TikTok.

2. **Selección desde el Panel Lateral (Market Intelligence)**:
   - El usuario hace clic en **YouTube** en el panel lateral.
   - El sistema localiza la corrida oficial de YouTube para el mercado activo (Colombia o México) y llama directamente a la carga del dataset.
   - La tabla se filtra mostrando **únicamente la corrida de YouTube**.
   - Si se selecciona **Instagram** o **Facebook** (canales sin ejecuciones en Apify), la tabla y el visor muestran el aviso informativo oficial explicando que no hay ejecuciones activas con el botón para volver a Visión Ecosistema.

3. **Retorno a Visión Ecosistema**:
   - Al hacer clic en **Visión Ecosistema** (en el panel o en el botón de restablecer de la tabla), la tabla vuelve a desplegar todas las plataformas consolidadas del país (TikTok + YouTube) y se cargan las métricas omnicanal combinadas.

---

## 3. Decisiones Técnicas & Trade-Offs

- **Estado Único de Verdad (`selectedChannelState`)**:
  - *Decisión*: Reemplazar el reseteo indiscriminado en `resetState()` para que respete y propague el canal correspondiente (`'omnicanal' | 'tiktok' | 'youtube' | 'instagram' | 'facebook'`).
  - *Por qué*: Evita la carrera de estados donde `loadSpecificRun` limpiaba la red activa antes de terminar de renderizar.
- **Carga Automática de Ejecución al Navegar**:
  - *Decisión*: Si el usuario hace clic en una red en el panel lateral, el sistema busca la corrida de esa red en `runsList()` y dispara `loadSpecificRun(run.id, run.actorTaskId)`.
  - *Por qué*: Resuelve el error reportado por el usuario de que al hacer clic en el panel la data "no carga, no carga".

---

## 4. Arquitectura Técnica & Mapeo de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ApifyViewerComponent                            │
│  State: selectedMarket ('COL' | 'MX'), activeChannel ('ALL' | 'net')  │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Sidebar: Market Intelligence   │  │    ApifyRunsTableComponent   │
│  - Visión Ecosistema (ALL)           │  │  - Inputs:                   │
│  - Instagram / Facebook / TikTok / YT │  │    [market]="selectedMarket"│
│  - Active state reflects activeChannel│  │    [selectedPlatform]=active │
│  - Click: emit activeChannel & load  │  │  - Outputs:                  │
│                                      │  │    (runSelected)             │
│                                      │  │    (resetPlatform)           │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### Plan de Cambios Específicos:

1. **`src/app/components/apify-viewer/apify-viewer.component.ts`**:
   - Modificar `handleNavSelection(net: string)` para que, si `net !== 'omnicanal'`, localice la corrida activa en `runsList()` para ese canal y mercado, ejecutando la carga real de la corrida (`loadSpecificRun`). Si no existe corrida (Instagram/Facebook), muestra el aviso informativo y limpia la vista.
   - En `loadSpecificRun(runId, actorInternalId)`, establecer `this.gridNetworkFilter.set(platform)` y `this.loadedNetwork.set(platform)` de forma atómica para que el panel lateral y la tabla queden sincronizados con la plataforma cargada.
   - Modificar `resetState()` para que acepte un parámetro opcional `keepNetwork?: boolean` y no borre el canal seleccionado cuando se carga una corrida específica.

2. **`src/app/components/apify-runs-table/apify-runs-table.component.ts`**:
   - Asegurar que `selectedPlatform` reciba el canal activo del visor.
   - Al filtrar por `selectedPlatform`, la tabla reduce su lista a la plataforma activa.
   - Añadir soporte visual de fila activa (`[class.row-selected]`) cuando una corrida esté cargada en el dashboard.

3. **`src/app/components/apify-runs-table/apify-runs-table.component.scss`**:
   - Añadir estilos de fila seleccionada (`.row-selected`) con sutil borde izquierdo o fondo contrastante para retroalimentación visual clara.

4. **Verificación**:
   - Compilación completa con `compile_applet`.
   - Comprobar que seleccionar en tabla actualiza el sidebar, y seleccionar en sidebar carga la data y filtra la tabla.
