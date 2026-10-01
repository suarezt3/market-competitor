# Plan de Estandarización de Métricas, Normalización de Scrapers y Actualización Documental

## 1. Diagnóstico del Problema y Objetivos Ejecutivos

Para la presentación ante los directivos de la compañía, las métricas deben ser **100% confiables, auditables y con rigor estadístico y publicitario**. Hemos identificado los siguientes puntos críticos a resolver:

1. **Confusión en Facebook (Seguidores vs. Likes):**
   * El scraper de Facebook en ocasiones extrae registros de páginas/perfiles institucionales (como la página de *Agility Gold*) donde el campo `likes` o `followers` indica los seguidores de la fanpage (11,110 seguidores), confundiéndose con un post individual con 11,110 "me gusta".
   * **Solución acordada:** Separar y **excluir los registros de páginas o perfiles del feed/grid de publicaciones**, utilizándolos exclusivamente para la ficha de seguidores y presencia de marca. En el grid de publicaciones solo participarán posts y reels reales con sus interacciones directas.

2. **Estandarización Canónica de los 4 Scrapers:**
   * Cada plataforma y actor de Apify nombra sus campos de manera dispar (`diggCount` en TikTok, `reactionLikeCount` en Facebook, `videoViewCount` en Instagram, `viewCount` en YouTube).
   * Unificar el objeto normalizado `_kpi` y los extractores de `apify-chart.service.ts` para que cada métrica represente con certeza matemática su dimensión real.

3. **Revisión y Ajuste del Engagement Rate (ER):**
   * **Fórmula actual:** En algunos tooltips y gráficos se referenciaba `(Interacciones / Seguidores) * 100`, la cual en publicaciones con alcance viral algorítmico (Reels, TikTok, Shorts) distorsiona la realidad, ya que las vistas provienen de usuarios que no necesariamente son seguidores.
   * **Fórmula ejecutiva aprobada:** 
     $$\text{Engagement Rate (ER)} = \left(\frac{\text{Likes} + \text{Comentarios}}{\text{Visualizaciones (Views)}}\right) \times 100$$
     (Proporciona a la junta directiva la tasa real de conversión de reproducciones en interacciones activas).

4. **Claridad en Cuota de Mercado e Interacciones Totales:**
   * Desglose explícito de la Cuota de Mercado (Share of Interactions / Share of Views) para que quede claro si el porcentaje mide volumen de interacción acumulado o cuota de reproducciones.

5. **Actualización Integral de la Guía Metodológica y Tooltips:**
   * Reflejar con precisión las nuevas fórmulas y definiciones en el modal interactivo `app-methodology-guide` y en todos los tooltips `[formula]` de la vista principal.

---

## 2. Matriz Canónica de Normalización de Scrapers

Se define la siguiente matriz de ingestión para garantizar que **likes son likes, comentarios son comentarios y vistas son vistas**:

| Red Social | Publicación Válida | Vistas (`postViews`) | Me Gusta (`postLikes`) | Comentarios (`comments`) | Compartidos (`shares`) | Seguidores (`followers`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Instagram** | Posts, Reels, Carruseles (`id`, `shortCode`, `url`) | `videoViewCount` \|\| `videoPlayCount` \|\| `viewsCount` \|\| `playCount` | `likesCount` \|\| `likes` | `commentsCount` \|\| `comments` | `sharesCount` \|\| 0 | `owner.followersCount` \|\| `followersCount` |
| **TikTok** | Videos / TikToks (`webVideoUrl`, `videoUrl`, `id`) | `playCount` \|\| `stats.playCount` \|\| `videoMeta.playCount` | `diggCount` \|\| `stats.diggCount` \|\| `videoMeta.diggCount` | `commentCount` \|\| `stats.commentCount` | `shareCount` \|\| `stats.shareCount` | `authorMeta.fans` \|\| `authorStats.followerCount` |
| **YouTube** | Videos largos / Shorts (`videoId`, `url` con `/watch` o `/shorts/`) | `viewCount` \|\| `views` | `likes` \|\| `likeCount` | `commentsCount` \|\| `commentCount` | 0 (no provisto por scraper estándar) | `numberOfSubscribers` \|\| `subscriberCount` |
| **Facebook** | **Únicamente posts reales** (`postId`, o URLs con `/posts/`, `/videos/`, `permalinkUrl`) | `viewsCount` \|\| `videoPostViewCount` \|\| `views` | `reactionLikeCount` \|\| `postLikes` \|\| `reactionsCount` *(nunca `page.likes`)* | `commentsCount` \|\| `comments` | `sharesCount` \|\| `shares` | `followers` \|\| `pageFollowers` *(a nivel de marca)* |

> **Regla de Filtrado para Facebook:** Si un registro no posee `postId`, o su URL apunta a `facebook.com/[pagina]` sin identificador de post, y solo contiene contadores de fanpage, se catalogará como registro de perfil institucional (`_isPageProfile = true`), extrayendo sus seguidores para el ranking de competidores pero omitiéndolo del ranking y grid de publicaciones.

---

## 3. Plan de Acción y Tareas de Implementación

### Tarea 1: Normalización de Scrapers y Aislamiento de Perfiles Facebook
* **Archivo:** `src/app/components/apify-viewer/apify-viewer.component.ts`
  * Perfeccionar la función `processRawItems()`:
    * Detección estricta de posts reales de Facebook frente a fichas de página institucional.
    * Mapeo blindado de campos numéricos (convirtiendo strings con formato o nulos a números enteros limpios).
    * Asignación inequívoca de `_kpi.postLikes` (exclusivamente likes del post, excluyendo seguidores o page likes).
    * Filtrado en `filteredData()` para que el feed y tablas de publicaciones solo muestren publicaciones reales.

### Tarea 2: Sincronización en el Servicio de Métricas y Gráficos
* **Archivo:** `src/app/services/apify-chart.service.ts`
  * Actualizar `getMetricValue(item, network, metric)`:
    * Reemplazar la condición ambigua `item.likes` en Facebook por la comprobación estricta de métricas de post (`item.reactionLikeCount || item._kpi?.postLikes || item.postLikes`).
    * Reforzar el cálculo del total de interacciones: `Interacciones = Likes + Comentarios + Compartidos` (o `Likes + Comentarios` según disponibilidad de canal).
  * Actualizar el gráfico de dispersión (Scatter Plot) y la evolución temporal para utilizar la fórmula oficial de **Engagement Rate sobre Visualizaciones**:
    $$\text{ER} = \left(\frac{\text{Interacciones Totales}}{\text{Views}}\right) \times 100$$
  * Garantizar que si un post no tiene visualizaciones (ej. imagen estática sin métrica de alcance público), se calcule el ratio sobre la media o se indique explícitamente para no desvirtuar el promedio.

### Tarea 3: Actualización de la Guía Metodológica Oficial
* **Archivo:** `src/app/components/methodology-guide/methodology-guide.component.html`
  * Actualizar la **Sección 3: Fórmulas de Interacciones Base**:
    * Detallar la procedencia exacta de Likes, Comentarios, Vistas y Compartidos por red social.
  * Actualizar la **Sección 4: Cálculo del Engagement Rate**:
    * Documentar la fórmula oficial aprobada por la dirección basada en visualizaciones reales ($ER = (\text{Interacciones} / \text{Views}) \times 100$).
    * Explicar el fundamento de negocio (evaluación de la eficacia creativa y retención de la atención por cada mil reproducciones).
  * Actualizar la **Sección 6: Cuota de Mercado (Share of Voice)**:
    * Clarificar la fórmula de participación sobre interacciones acumuladas frente a participación sobre visualizaciones.
  * Actualizar la **Sección 8: Diccionario Técnico de Campos JSON**:
    * Incluir la tabla comparativa con los nombres de campos de cada scraper de Apify (Facebook, Instagram, TikTok, YouTube) y cómo se convierten en el modelo canónico.

### Tarea 4: Actualización de Tooltips de Fórmulas en el Dashboard
* **Archivo:** `src/app/components/apify-viewer/apify-viewer.component.html`
  * Actualizar los componentes `<app-metric-info-tooltip>` para que las descripciones emergentes coincidan exactamente con la nueva fórmula de Engagement Rate sobre vistas y la cuota de interacciones.

---

## 4. Plan de Verificación y Pruebas

1. **Verificación de Facebook y Agility Gold:**
   * Cargar el dataset de Facebook o el conjunto unificado y comprobar que la página de *Agility Gold* ya no figure como un "post de 11,110 likes", sino que sus publicaciones muestren sus likes reales (ej. 15, 45, 120 likes) y los 11,110 figuren correctamente como comunidad/seguidores de marca.
2. **Validación Numérica en los 4 Canales:**
   * Verificar en el inspector que Instagram muestre views y likes de publicaciones.
   * Verificar que TikTok muestre `playCount` como vistas y `diggCount` como likes.
   * Verificar que YouTube Shorts y Videos muestren `viewCount` como vistas y `likes` como likes.
3. **Validación de la Fórmula de Engagement:**
   * Comprobar que en las tarjetas KPI y el gráfico de engagement se aplique la fórmula sobre vistas.
4. **Verificación de la Guía Metodológica:**
   * Abrir el modal de la Guía Metodológica desde el botón superior y revisar que todas las secciones reflejen las nuevas fórmulas y el diccionario de campos.
5. **Compilación y Build:**
   * Ejecutar `compile_applet` para certificar cero errores de compilación de TypeScript y Angular.
