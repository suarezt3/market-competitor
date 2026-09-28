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
        console.error('Error en sendChatMessage:', err);
        let errorDetail = 'Los servidores de Gemini están experimentando alta demanda momentánea. Por favor intenta de nuevo en unos segundos.';
        
        if (err?.error?.error && typeof err.error.error === 'string') {
          if (!err.error.error.includes('{') && !err.error.error.includes('UNAVAILABLE')) {
            errorDetail = err.error.error;
          }
        }

        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          role: 'model',
          text: `⚠️ **Aviso de Conexión:** ${errorDetail}`,
          timestamp: new Date()
        };
        this.chatHistory.update(prev => [...prev, errorMessage]);
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
}
