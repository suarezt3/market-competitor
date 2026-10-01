# Plan de Rediseño Editorial y Blindaje Visual de Tarjetas Multimedia

## 1. Diagnóstico del Problema y Objetivos Visuales

En las capturas suministradas se aprecian dos problemas críticos de cara a la presentación directiva:
1. **Contenido Viral:** Varias tarjetas de TikTok muestran un recuadro oscuro con el icono de "imagen rota" del navegador (`img` sin carga exitosa o con URL de CDN expirada/bloqueada con error 403).
2. **Desglose de Contenido:** Las tarjetas de Instagram, Facebook y TikTok muestran un contenedor gris genérico con el texto *"Media Protegido"*, lo que genera una apariencia de error técnico o contenido incompleto.

### Objetivo
Transformar estas tarjetas en **piezas editoriales premium y de alta gama directiva**:
* Implementar un **proxy backend seguro** (`/api/proxy-image`) que añade cabeceras limpias (`Referer`, `User-Agent`, `Cache-Control`) para intentar rescatar y retransmitir las miniaturas de CDNs protegidos de TikTok, Instagram y Facebook.
* Si el CDN bloquea la imagen de forma definitiva o el enlace expira, presentar automáticamente una **portada editorial de marca con gradiente corporativo**, logotipo oficial, cita tipográfica destacada, marca de agua de la red y píldora de duración/formato, eliminando por completo cualquier mensaje de error, icono roto o caja gris de *"Media Protegido"*.

---

## 2. Arquitectura de la Solución

### A. Endpoint Proxy de Imágenes en el Servidor (`src/server.ts`)
* Endpoint `/api/proxy-image?url=...`
* Realiza peticiones del lado del servidor con User-Agent estándar de navegador, evitando los bloqueos de hotlinking y CORS de navegadores.
* Almacena en caché (`Cache-Control: public, max-age=86400`) para minimizar latencia y consumo de red.

### B. Fallback Editorial Elegante en la UI
Tanto en `viral-highlights` como en `apify-data-grid`:
* **Gestor de estado de carga por ítem:** Si la imagen falla (`(error)`), la tarjeta cambia instantáneamente a su modo **Portada Editorial**.
* **Composición visual de la Portada Editorial:**
  * Fondo: Gradiente cromático suave generado a partir del color corporativo de la marca (ej. Royal Canin, Agility Gold, Bonat, True Blue, Bancolombia, Nu).
  * Cabecera: Monograma o logotipo oficial de la marca junto con la insignia de la red social (TikTok, Instagram, Facebook).
  * Cuerpo: Cita tipográfica estilizada con comillas sutiles (`“...”`) extrayendo el gancho principal del copy o caption del post.
  * Pie: Duración del video (ej. `▶ 2:28`), badge de formato (`Reel`, `Video`, `Carrusel`) y marca de agua translúcida.

---

## 3. Tareas de Implementación

### Tarea 1: Implementar Endpoint `/api/proxy-image`
* **Archivo:** `src/server.ts`
  * Añadir ruta Express `/api/proxy-image` para solventar restricciones de CORS y referrer de CDNs de Meta (`*.cdninstagram.com`, `*.fbcdn.net`) y TikTok (`*.tiktokcdn.com`).
  * Validación segura de protocolo (`https:`) y gestión de errores con fallback a 404 para que el cliente active el diseño editorial.

### Tarea 2: Rediseño Editorial en Contenido Viral Destacado
* **Archivos:** `src/app/components/viral-highlights/viral-highlights.component.html`, `.ts`, `.scss`
  * Enriquecer el helper de miniaturas para priorizar rutas proxy cuando corresponda.
  * Añadir listener reactivo de error `onThumbnailError(postId)` en el componente TS.
  * Reemplazar el contenedor oscuro por el diseño editorial con gradiente corporativo, avatar/logo de marca, texto citado en tipografía legible y badge de duración.

### Tarea 3: Rediseño Editorial en el Desglose de Contenido (Data Grid)
* **Archivos:** `src/app/components/apify-data-grid/apify-data-grid.component.html`, `.ts`, `.scss`
  * Erradicar la caja gris de *"Media Protegido"*.
  * Implementar el bloque editorial de marca integrado con la paleta de colores del competidor (`getBrandInfo(item).color`).
  * Optimizar la visualización de duración (`0:30`, `2:28`) e insignia de formato sobre el gradiente editorial.

---

## 4. Plan de Verificación

1. **Prueba de Carga con Proxy:**
   * Cargar datasets de TikTok e Instagram y verificar si las imágenes que antes daban error 403 ahora se renderizan mediante el proxy.
2. **Prueba de Fallback Editorial:**
   * Simular una imagen fallida o bloqueada y certificar que la tarjeta muestra la portada editorial con logo, colores de marca y cita destacada.
   * Certificar que NUNCA aparezca un icono roto de imagen ni el texto "Media Protegido".
3. **Verificación en Ambos Módulos:**
   * Comprobar la sección "Contenido Viral Destacado" (Top 5).
   * Comprobar la sección "Desglose de Contenido Auditado" (Grid de publicaciones).
4. **Compilación y Build:**
   * Ejecutar `compile_applet` para confirmar cero errores en TypeScript, Angular y SSR.
