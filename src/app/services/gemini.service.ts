// src/app/services/gemini.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface TopOutlierContent {
  brand: string;
  type: string;
  views: number;
  likes: number;
  comments: number;
  engagementRate: number;
  captionSnippet: string;
  url?: string;
  viralFactorReason: string;
}

export interface LeaderVsCompetitors {
  leaderBrand: string;
  shareOfAttention: string;
  competitiveEdge: string;
  competitorOpportunities: string;
}

export interface GeminiInsightsData {
  topOutlierContent: TopOutlierContent;
  executiveSummary: string[];
  leaderVsCompetitors: LeaderVsCompetitors;
  actionableRecommendations: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface DatasetContextPayload {
  platform: string;
  dateRange: { start: string; end: string };
  totalPosts: number;
  brands: string[];
  metricsSummary: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    avgEngagementRate: number;
  };
  brandPerformance: Array<{
    brand: string;
    postCount: number;
    totalViews: number;
    avgLikes: number;
    avgEngagement: number;
  }>;
  topPosts: Array<{
    id: string;
    brand: string;
    author: string;
    caption: string;
    url: string;
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
    type: string;
    date: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private http = inject(HttpClient);

  // Estados Reactivos con Signals
  public insights = signal<GeminiInsightsData | null>(null);
  public isGeneratingInsights = signal<boolean>(false);
  public insightsError = signal<string | null>(null);
  public lastUpdated = signal<Date | null>(null);

  // Estado del Asistente de Chat
  public isChatOpen = signal<boolean>(false);
  public chatHistory = signal<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: '¡Hola! Soy tu **Asistente de Marketing Intelligence con Gemini 3.8**.\n\nPuedo responder preguntas sobre el rendimiento de competidores, identificar el video con más reproducciones, comparar métricas de marcas o sugerir ideas de contenido. ¿Qué te gustaría consultar?',
      timestamp: new Date()
    }
  ]);
  public isChatSending = signal<boolean>(false);

  // Control de suscripción activa para cancelar/detener consultas
  private chatSubscription?: any;

  // Clave de caché para evitar consultas redundantes
  private lastContextKey = '';

  /**
   * Obtiene o actualiza los insights estratégicos de Gemini
   */
  async fetchInsights(context: DatasetContextPayload, forceRefresh = false): Promise<void> {
    if (!context || !context.metricsSummary || context.totalPosts === 0) {
      return;
    }

    const contextKey = `${context.platform}_${context.dateRange.start}_${context.dateRange.end}_${context.totalPosts}_${context.brands.join(',')}`;

    if (!forceRefresh && this.insights() && this.lastContextKey === contextKey) {
      return; // Usar caché si no cambió el contexto
    }

    this.isGeneratingInsights.set(true);
    this.insightsError.set(null);

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; insights: GeminiInsightsData; timestamp?: string; fallbackInsights?: GeminiInsightsData }>(
          '/api/gemini/insights',
          context
        )
      );

      if (res && res.insights) {
        this.insights.set(res.insights);
        this.lastUpdated.set(new Date());
        this.lastContextKey = contextKey;
      } else if (res && res.fallbackInsights) {
        this.insights.set(res.fallbackInsights);
        this.lastUpdated.set(new Date());
      }
    } catch (err: any) {
      console.warn('Error al llamar a /api/gemini/insights, aplicando fallback estructurado:', err);
      // Fallback local en caso de error de red o timeout
      const fallback = this.generateLocalFallback(context);
      this.insights.set(fallback);
      this.lastUpdated.set(new Date());
      this.insightsError.set(err?.error?.error || 'Se cargaron estimaciones analíticas basadas en el dataset.');
    } finally {
      this.isGeneratingInsights.set(false);
    }
  }

  /**
   * Envía un mensaje al asistente de chat de Gemini
   */
  sendChatMessage(userText: string, context: DatasetContextPayload): void {
    if (!userText.trim() || this.isChatSending()) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: userText.trim(),
      timestamp: new Date()
    };

    this.chatHistory.update(prev => [...prev, userMessage]);
    this.isChatSending.set(true);

    // Formatear historial para el endpoint
    const historyPayload = this.chatHistory()
      .filter(m => m.id !== 'welcome')
      .map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

    const body = {
      message: userText.trim(),
      context: {
        platform: context.platform,
        dateRange: context.dateRange,
        totalPosts: context.totalPosts,
        brands: context.brands,
        metricsSummary: context.metricsSummary,
        topPostsSummary: context.topPosts.slice(0, 30).map(p => ({
          brand: p.brand,
          author: p.author,
          views: p.views,
          likes: p.likes,
          comments: p.comments,
          engagementRate: p.engagementRate,
          type: p.type,
          caption: p.caption ? p.caption.slice(0, 150) : '',
          url: p.url
        })),
        brandPerformance: context.brandPerformance
      },
      history: historyPayload
    };

    this.chatSubscription = this.http.post<{ success: boolean; reply: string }>('/api/gemini/chat', body).subscribe({
      next: (res) => {
        const replyText = res?.reply || 'No pude obtener una respuesta en este momento.';
        const modelMessage: ChatMessage = {
          id: `model_${Date.now()}`,
          role: 'model',
          text: replyText,
          timestamp: new Date()
        };
        this.chatHistory.update(prev => [...prev, modelMessage]);
        this.isChatSending.set(false);
        this.chatSubscription = undefined;
      },
      error: (err: any) => {
        console.warn('Error en la llamada al endpoint /api/gemini/chat:', err);

        // Generar respuesta analítica directa utilizando el dataset en memoria del cliente
        const clientAnswer = this.generateClientDataDrivenReply(userText, context);

        let diagNotice = '';
        if (err.status === 404) {
          diagNotice = '\n\n> ℹ️ *Respuesta obtenida del dataset local. El endpoint `/api/gemini/chat` no fue encontrado (404) en este dominio de Vercel. Asegúrate de incluir la carpeta `/api` y el archivo `vercel.json` en tu repositorio.*';
        } else if (err.status === 500) {
          diagNotice = '\n\n> ℹ️ *Respuesta obtenida del dataset local. El servidor reportó error 500 (posible ausencia de la variable `GEMINI_API_KEY` en Vercel > Settings > Environment Variables).*';
        } else {
          diagNotice = '\n\n> ℹ️ *Respuesta generada a partir del dataset analítico activo.*';
        }

        const modelMessage: ChatMessage = {
          id: `model_${Date.now()}`,
          role: 'model',
          text: `${clientAnswer}${diagNotice}`,
          timestamp: new Date()
        };

        this.chatHistory.update(prev => [...prev, modelMessage]);
        this.isChatSending.set(false);
        this.chatSubscription = undefined;
      }
    });
  }

  /**
   * Detiene / Cancela inmediatamente la consulta en curso
   */
  cancelChatMessage(): void {
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
      this.chatSubscription = undefined;
    }

    if (this.isChatSending()) {
      this.isChatSending.set(false);
      const cancelMessage: ChatMessage = {
        id: `cancelled_${Date.now()}`,
        role: 'model',
        text: '⏹ *Consulta detenida por el usuario.* Puedes escribir una nueva pregunta o consultar otro dato.',
        timestamp: new Date()
      };
      this.chatHistory.update(prev => [...prev, cancelMessage]);
    }
  }

  toggleChatDrawer(open?: boolean): void {
    if (open !== undefined) {
      this.isChatOpen.set(open);
    } else {
      this.isChatOpen.update(v => !v);
    }
  }

  clearChat(): void {
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
      this.chatSubscription = undefined;
    }
    this.isChatSending.set(false);

    this.chatHistory.set([
      {
        id: 'welcome',
        role: 'model',
        text: '¡Historial reiniciado! Estoy listo para responder nuevas preguntas sobre el rendimiento de competidores y contenidos.',
        timestamp: new Date()
      }
    ]);
  }

  private generateLocalFallback(context: DatasetContextPayload): GeminiInsightsData {
    const top = context.topPosts[0] || {
      brand: context.brands[0] || 'Marca Líder',
      type: 'Reel / Video',
      views: context.metricsSummary.totalViews,
      likes: context.metricsSummary.totalLikes,
      comments: context.metricsSummary.totalComments,
      engagementRate: context.metricsSummary.avgEngagementRate,
      caption: 'Publicación con mayor impacto y reproducciones del periodo.',
      url: '#'
    };

    return {
      topOutlierContent: {
        brand: top.brand,
        type: top.type || 'Video Corto',
        views: top.views || 0,
        likes: top.likes || 0,
        comments: top.comments || 0,
        engagementRate: top.engagementRate || 0,
        captionSnippet: top.caption ? top.caption.slice(0, 120) : 'Video con alto ratio de retención y reproducciones orgánicas.',
        url: top.url || '#',
        viralFactorReason: 'Formato audiovisual dinámico de alta retención que maximiza comentarios y compartidos orgánicos.'
      },
      executiveSummary: [
        `Se procesaron ${context.totalPosts} publicaciones alcanzando un total de ${context.metricsSummary.totalViews.toLocaleString()} visualizaciones.`,
        `La tasa promedio de interacción se consolida en ${context.metricsSummary.avgEngagementRate.toFixed(2)}% a través de ${context.brands.length} marcas monitorizadas.`,
        `El formato audiovisual vertical concentra la mayor proporción de engagement frente a publicaciones estáticas.`
      ],
      leaderVsCompetitors: {
        leaderBrand: context.brandPerformance[0]?.brand || context.brands[0] || 'Líder de Categoría',
        shareOfAttention: 'Lidera en volumen total de visualizaciones y share de voz.',
        competitiveEdge: 'Mayor consistencia en ritmo de publicación y llamados a la acción efectivos.',
        competitorOpportunities: 'Optimizar los primeros 3 segundos de los videos y aumentar la frecuencia en días de alto tráfico.'
      },
      actionableRecommendations: [
        'Aprovechar las tendencias de audio y temáticas del video con mayor cantidad de reproducciones.',
        'Implementar preguntas directas en los copys para incentivar el volumen de comentarios.',
        'Monitorear la frecuencia semanal del competidor líder para cubrir los días con menor actividad de su parte.'
      ]
    };
  }

  /**
   * Motor analítico del cliente para responder preguntas sobre el dataset en caso de que el backend falle o no esté disponible (ej. Vercel)
   */
  public generateClientDataDrivenReply(userQuery: string, context: DatasetContextPayload): string {
    const query = (userQuery || '').toLowerCase();
    const posts = context?.topPosts || [];
    const brands = context?.brandPerformance || [];

    let matchedPosts = posts;
    let targetBrand = '';

    for (const b of context?.brands || []) {
      const brandLower = b.toLowerCase();
      const cleanBrandWords = brandLower.split(/[\s-]+/);
      if (query.includes(brandLower) || cleanBrandWords.some(w => w.length > 3 && query.includes(w))) {
        targetBrand = b;
        matchedPosts = posts.filter(
          p => (p.brand || '').toLowerCase().includes(brandLower) || (p.author || '').toLowerCase().includes(brandLower)
        );
        break;
      }
    }

    if (!targetBrand) {
      if (query.includes('royal') || query.includes('cannin') || query.includes('canin')) {
        targetBrand = 'Royal Canin';
        matchedPosts = posts.filter(
          p =>
            (p.brand || '').toLowerCase().includes('royal') ||
            (p.caption || '').toLowerCase().includes('royal') ||
            (p.author || '').toLowerCase().includes('royal')
        );
      } else if (query.includes('hill') || query.includes('hills')) {
        targetBrand = "Hill's Pet Nutrition";
        matchedPosts = posts.filter(
          p =>
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
      const brandsList = context?.brands?.length > 0 ? context.brands.join(', ') : 'las marcas del sector';
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
      const sortedPosts = [...matchedPosts];
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

El contenido con **${metricName}** en el periodo analizado es:

- **❤️ Likes:** **${(top.likes || 0).toLocaleString()}**
- **👁️ Reproducciones:** **${(top.views || 0).toLocaleString()}**
- **💬 Comentarios:** **${(top.comments || 0).toLocaleString()}**
- **📈 Engagement Rate:** **${(top.engagementRate || 0).toFixed(2)}%**
- **🎬 Formato:** ${top.type || 'Video / Post'}
- **👤 Cuenta / Autor:** \`${top.author || top.brand || 'Competidor'}\`
- **📝 Descripción / Copy:** *"${(top.caption || 'Publicación analizada').slice(0, 150)}..."*
${top.url && top.url !== '#' ? `\n🔗 **[Ver publicación original](${top.url})**` : ''}

> 💡 **Hallazgo Estratégico:** Esta publicación lidera la interacción orgánica dentro del benchmark activo.`;
    }

    if (query.includes('lider') || query.includes('gana') || query.includes('primer') || query.includes('benchmark')) {
      const leader = brands[0];
      if (leader) {
        return `### 👑 Marca Líder del Benchmark: **${leader.brand}**

- **👁️ Total Visualizaciones:** **${(leader.totalViews || 0).toLocaleString()}**
- **📊 Total Publicaciones:** **${leader.postCount || 0} posts**
- **❤️ Promedio de Likes por Post:** **${(leader.avgLikes || 0).toLocaleString()}**
- **📈 Tasa de Engagement Promedio:** **${(leader.avgEngagement || 0).toFixed(2)}%**

> **Análisis:** ${leader.brand} concentra la mayor atención del público objetivo en el periodo seleccionado.`;
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
}
