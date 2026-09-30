// api/gemini/chat.js - Vercel Serverless Function (CommonJS Universal, Zero Dependencies)

const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

async function handler(req, res) {
  // Configuración de encabezados CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error('[Vercel API] Error parseando body JSON:', e);
    }
  }

  const { message, context, history = [] } = body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Mensaje requerido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[Vercel API] GEMINI_API_KEY no encontrada en variables de entorno.');
    const localReply = generateDataDrivenReply(message, context);
    return res.status(200).json({
      success: true,
      reply: `${localReply}\n\n> ⚠️ **Aviso de configuración en Vercel:** La variable de entorno \`GEMINI_API_KEY\` no fue detectada. Verifica en Vercel > Settings > Environment Variables y haz un Redeploy.`,
      timestamp: new Date().toISOString(),
      source: 'dataset_analytics_no_key'
    });
  }

  const systemInstruction = `Eres el Asistente Senior de Inteligencia de Mercado y Analítica Competitiva de la plataforma.
Tu misión es responder preguntas sobre el dataset de publicaciones, marcas, métricas de engagement, visualizaciones, creativos con más likes y videos virales.

Reglas de respuesta:
1. Responde siempre en español claro, profesional y estructurado con markdown.
2. Si el usuario saluda (ej: "Hola", "Buenos días", "¿Qué tal?"), responde de manera cordial y preséntate brevemente explicando qué datos tienes disponibles para analizar.
3. Si te preguntan cuál es el post, creativo o video con más vistas o más likes (por ejemplo de una marca específica como Royal Canin, Monello, Hills, etc.), busca en el resumen de publicaciones y proporciona: autor/marca, cantidad exacta de likes, views, comentarios, formato, fragmento del texto y enlace.
4. Utiliza negritas para cifras clave (ej. **14,520 likes**, **1.4M views**, **8.5% engagement**).
5. Proporciona contexto estratégico y recomendaciones prácticas cuando aplique.
6. Mantén las respuestas concisas pero de alto valor analítico.

Contexto actual de datos en pantalla:
- Plataforma: ${context?.platform || 'Omnicanal'}
- Rango de fechas: ${context?.dateRange?.start || ''} a ${context?.dateRange?.end || ''}
- Total posts analizados: ${context?.totalPosts || 0}
- Marcas: ${context?.brands ? context?.brands.join(', ') : 'Todas'}
- Métricas Globales: Views = ${context?.metricsSummary?.totalViews?.toLocaleString() || 0}, Likes = ${context?.metricsSummary?.totalLikes?.toLocaleString() || 0}, Engagement Promedio = ${(context?.metricsSummary?.avgEngagementRate || 0).toFixed(2)}%
- Resumen de Top Publicaciones: ${JSON.stringify(context?.topPostsSummary || [], null, 2)}
- Desempeño por Marca: ${JSON.stringify(context?.brandPerformance || [], null, 2)}`;

  const formattedContents = [];

  if (Array.isArray(history) && history.length > 0) {
    for (const item of history.slice(-6)) {
      formattedContents.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.parts?.[0]?.text || item.text || '' }]
      });
    }
  }

  formattedContents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const requestPayload = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: formattedContents,
    generationConfig: {
      temperature: 0.4
    }
  };

  let lastModelError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aistudio-build'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const msg = errorJson?.error?.message || `HTTP ${response.status}`;
        lastModelError = new Error(msg);
        console.warn(`[Vercel API] Modelo ${model} error: ${msg}. Probando siguiente modelo...`);
        continue;
      }

      const resData = await response.json();
      const reply = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (reply) {
        return res.status(200).json({
          success: true,
          reply,
          timestamp: new Date().toISOString(),
          modelUsed: model
        });
      }
    } catch (err) {
      lastModelError = err;
      console.warn(`[Vercel API] Excepción al llamar modelo ${model}:`, err?.message);
    }
  }

  const fallbackReply = generateDataDrivenReply(message, context);
  const errMsg = lastModelError?.message || 'Error de conexión con Gemini';
  return res.status(200).json({
    success: true,
    reply: `${fallbackReply}\n\n> ⚠️ **Aviso de Gemini en Vercel:** No se pudo completar la llamada al modelo (${errMsg}).`,
    timestamp: new Date().toISOString(),
    source: 'dataset_analytics_fallback'
  });
}

function generateDataDrivenReply(userQuery, context) {
  const query = (userQuery || '').toLowerCase();
  const posts = context?.topPostsSummary || context?.topPosts || [];
  const brands = context?.brandPerformance || [];

  let matchedPosts = posts;
  let targetBrand = '';

  for (const b of context?.brands || []) {
    const brandLower = b.toLowerCase();
    const cleanBrandWords = brandLower.split(/[\s-]+/);
    if (query.includes(brandLower) || cleanBrandWords.some((w) => w.length > 3 && query.includes(w))) {
      targetBrand = b;
      matchedPosts = posts.filter(
        (p) => (p.brand || '').toLowerCase().includes(brandLower) || (p.author || '').toLowerCase().includes(brandLower)
      );
      break;
    }
  }

  if (!targetBrand) {
    if (query.includes('royal') || query.includes('cannin') || query.includes('canin')) {
      targetBrand = 'Royal Canin';
      matchedPosts = posts.filter(
        (p) =>
          (p.brand || '').toLowerCase().includes('royal') ||
          (p.caption || '').toLowerCase().includes('royal') ||
          (p.author || '').toLowerCase().includes('royal')
      );
    } else if (query.includes('hill') || query.includes('hills')) {
      targetBrand = "Hill's Pet Nutrition";
      matchedPosts = posts.filter(
        (p) =>
          (p.brand || '').toLowerCase().includes('hill') ||
          (p.caption || '').toLowerCase().includes('hill') ||
          (p.author || '').toLowerCase().includes('hill')
      );
    }
  }

  const trimmed = query.trim();
  const isGreeting =
    /^(hola|buen[oa]s\s*(d[ií]as|tardes|noches)?|saludos|qu[eé]\s*tal|hey|hi)\b/i.test(trimmed) ||
    trimmed === 'hola' ||
    trimmed === 'hola!' ||
    trimmed === 'holaa';

  if (isGreeting) {
    const brandsList = context?.brands?.length > 0 ? context.brands.join(', ') : 'las marcas analizadas';
    const totalPosts = context?.totalPosts || 0;
    return `¡Hola! ¿En qué puedo apoyarte hoy?

Tengo a mi disposición los datos analíticos de **${context?.platform || 'Redes Sociales'}** con un total de **${totalPosts} publicaciones** monitoreadas para marcas como: **${brandsList}**.

Puedo ayudarte con:
* 🏆 **Top creativos y videos** con más reproducciones, likes o interacción.
* 📊 **Comparativas de rendimiento** entre competidores (Views, Likes, Engagement Rate).
* 🎬 **Análisis de formatos** (Reels vs Videos vs Posts estáticos).
* 💡 **Estrategias y recomendaciones tácticas** para tus contenidos.

Dime qué consulta estratégica o dato específico necesitas revisar.`;
  }

  const isLikesQuery = query.includes('like') || query.includes('me gusta') || query.includes('corazon');
  const isViewsQuery = query.includes('view') || query.includes('reproduccion') || query.includes('visto') || query.includes('visualiza');
  const isCommentsQuery = query.includes('comentario') || query.includes('interaccion');
  const isContentQuery =
    isLikesQuery ||
    isViewsQuery ||
    isCommentsQuery ||
    Boolean(targetBrand) ||
    query.includes('post') ||
    query.includes('video') ||
    query.includes('creativo') ||
    query.includes('contenido') ||
    query.includes('mas') ||
    query.includes('mejor') ||
    query.includes('top');

  if (matchedPosts.length > 0 && isContentQuery) {
    let sortedPosts = [...matchedPosts];
    if (isLikesQuery) {
      sortedPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (isCommentsQuery) {
      sortedPosts.sort((a, b) => (b.comments || 0) - (a.comments || 0));
    } else {
      sortedPosts.sort((a, b) => (b.views || 0) - (a.views || 0));
    }

    const top = sortedPosts[0];
    const metricName = isLikesQuery
      ? 'mayor número de Likes'
      : isCommentsQuery
        ? 'mayor número de Comentarios'
        : 'mayor número de Reproducciones';

    return `### 🏆 Creativo Destacado: ${top.brand || targetBrand || 'Competidor'}

El contenido con **${metricName}** registrado en el periodo analizado es:

- **❤️ Likes:** **${(top.likes || 0).toLocaleString()}**
- **👁️ Reproducciones:** **${(top.views || 0).toLocaleString()}**
- **💬 Comentarios:** **${(top.comments || 0).toLocaleString()}**
- **📈 Engagement Rate:** **${(top.engagementRate || 0).toFixed(2)}%**
- **🎬 Formato:** ${top.type || 'Video / Post'}
- **👤 Cuenta / Autor:** \`${top.author || top.brand || 'Competidor'}\`
- **📝 Descripción / Copy:** *"${(top.caption || 'Publicación en redes sociales').slice(0, 150)}..."*
${top.url && top.url !== '#' ? `\n🔗 **[Ver publicación original](${top.url})**` : ''}

> 💡 **Hallazgo Estratégico:** Este contenido lidera la interacción gracias a su formato dinámico y alta retención de audiencia.`;
  }

  if (query.includes('lider') || query.includes('gana') || query.includes('primer') || query.includes('benchmark')) {
    const leader = brands[0];
    if (leader) {
      return `### 👑 Marca Líder del Benchmark: **${leader.brand}**

- **👁️ Total Visualizaciones:** **${(leader.totalViews || 0).toLocaleString()}**
- **📊 Total Publicaciones:** **${leader.postCount || 0} posts**
- **❤️ Promedio de Likes por Post:** **${(leader.avgLikes || 0).toLocaleString()}**
- **📈 Tasa de Engagement Promedio:** **${(leader.avgEngagement || 0).toFixed(2)}%**

> **Análisis:** ${leader.brand} concentra la mayor atención del público objetivo en el periodo analizado.`;
    }
  }

  return `### 📊 Resumen Analítico del Dataset

- **Publicaciones Analizadas:** **${context?.totalPosts || 0}**
- **Total de Visualizaciones:** **${(context?.metricsSummary?.totalViews || 0).toLocaleString()}**
- **Total de Interacciones (Likes):** **${(context?.metricsSummary?.totalLikes || 0).toLocaleString()}**
- **Tasa de Engagement Promedio:** **${(context?.metricsSummary?.avgEngagementRate || 0).toFixed(2)}%**

Puedes hacerme consultas directas como:
- *"¿Cuál es la publicación o video con más visualizaciones?"*
- *"¿Cuál es el post con más likes de Royal Canin?"*
- *"¿Quién lidera el benchmark?"*`;
}

module.exports = handler;
module.exports.default = handler;
