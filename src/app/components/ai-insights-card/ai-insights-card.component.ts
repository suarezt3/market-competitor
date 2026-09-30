import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiInsightsData } from '../../services/gemini.service';

@Component({
  selector: 'app-ai-insights-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ai-insights-container">
      <!-- HEADER PRINCIPAL DE LA TARJETA INTELIGENTE -->
      <div class="ai-header">
        <div class="ai-title-block">
          <div class="ai-badge-icon">
            <span class="sparkle-icon">✨</span>
          </div>
          <div>
            <div class="ai-headline-row">
              <h3 class="ai-title">Gemini 3.8 AI • Intelligence & Executive Insights</h3>
              <span class="ai-tag">En Tiempo Real</span>
            </div>
            <p class="ai-subtitle">
              Diagnóstico predictivo y retroalimentación automática de competidores
              @if (lastUpdated()) {
                <span class="update-time">• Actualizado hace un momento</span>
              }
            </p>
          </div>
        </div>

        <div class="ai-actions">
          <button
            type="button"
            class="ai-btn ai-btn-secondary"
            (click)="onRefresh()"
            [disabled]="isLoading()"
            title="Reevaluar y generar nuevos insights con Gemini">
            <span class="btn-icon" [class.spin-anim]="isLoading()">🔄</span>
            <span>{{ isLoading() ? 'Analizando...' : 'Refrescar Análisis' }}</span>
          </button>

          <button
            type="button"
            class="ai-btn ai-btn-primary"
            (click)="onOpenChat('¿Cuáles son los posts o videos con más impacto en el periodo?')"
            title="Abrir asistente de chat interactivo">
            <span class="btn-icon">💬</span>
            <span>Preguntar al Asistente</span>
          </button>
        </div>
      </div>

      <!-- ESTADO DE CARGA (SKELETON ANIMADO) -->
      @if (isLoading()) {
        <div class="ai-loading-state">
          <div class="loading-pulse-header">
            <div class="ai-spinner"></div>
            <div class="loading-text-group">
              <strong>Gemini está procesando el dataset de publicaciones...</strong>
              <span>Extrayendo métricas de visualizaciones, factores de viralidad y patrones de competidores.</span>
            </div>
          </div>
          <div class="skeleton-grid">
            <div class="skeleton-card skeleton-highlight"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
          </div>
        </div>
      } @else if (insights()) {
        <!-- CONTENIDO PRINCIPAL DE INSIGHTS -->
        <div class="ai-content-body">
          <!-- 1. TARJETA DESTACADA: POST / VIDEO CON MÁS IMPACTO Y REPRODUCCIONES -->
          @if (insights()?.topOutlierContent; as topPost) {
            <div class="top-performer-card">
              <div class="top-performer-header">
                <div class="performer-badge">
                  <span class="trophy-icon">🏆</span>
                  <span class="badge-label">PUBLICACIÓN / VIDEO CON MAYOR IMPACTO (TOP VIEWS)</span>
                </div>
                <div class="format-pill">
                  <span>{{ topPost.type || 'Video / Reel' }}</span>
                </div>
              </div>

              <div class="top-performer-content-grid">
                <!-- Columna Datos del Contenido -->
                <div class="performer-details">
                  <div class="brand-author-row">
                    <span class="brand-name">{{ topPost.brand }}</span>
                  </div>

                  <p class="caption-snippet" [title]="topPost.captionSnippet">
                    "{{ topPost.captionSnippet || 'Publicación líder en captación de visualizaciones e interacciones.' }}"
                  </p>

                  <!-- Métricas Destacadas del Post -->
                  <div class="metrics-chips-row">
                    <div class="metric-chip views-chip">
                      <span class="chip-label">👀 Visualizaciones</span>
                      <strong class="chip-value">{{ (topPost.views || 0) | number }}</strong>
                    </div>

                    <div class="metric-chip likes-chip">
                      <span class="chip-label">❤️ Likes</span>
                      <strong class="chip-value">{{ (topPost.likes || 0) | number }}</strong>
                    </div>

                    <div class="metric-chip comments-chip">
                      <span class="chip-label">💬 Comentarios</span>
                      <strong class="chip-value">{{ (topPost.comments || 0) | number }}</strong>
                    </div>

                    <div class="metric-chip er-chip">
                      <span class="chip-label">⚡ Engagement</span>
                      <strong class="chip-value">{{ (topPost.engagementRate || 0) | number:'1.2-2' }}%</strong>
                    </div>
                  </div>
                </div>

                <!-- Columna Análisis de Viralidad por Gemini -->
                <div class="viral-analysis-box">
                  <div class="viral-box-header">
                    <span class="brain-icon">🧠</span>
                    <h4>¿Por qué este contenido se convirtió en el ganador?</h4>
                  </div>
                  <p class="viral-reason-text">
                    {{ topPost.viralFactorReason || 'Este contenido lidera la interacción orgánica dentro del benchmark gracias a un alto ratio de retención y formato dinámico.' }}
                  </p>
                  <div class="viral-box-footer">
                    @if (topPost.url && topPost.url !== '#') {
                      <a [href]="topPost.url" target="_blank" rel="noopener noreferrer" class="link-btn">
                        <span>Ver publicación original ↗</span>
                      </a>
                    }
                    <button
                      type="button"
                      class="quick-ask-btn"
                      (click)="onOpenChat('Cuéntame más sobre la estrategia del video ganador de ' + topPost.brand)">
                      Preguntar sobre este post 💬
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- 2. GRID DE 3 PILARES ANALÍTICOS -->
          <div class="strategic-pillars-grid">
            <!-- Pilar 1: Resumen Ejecutivo -->
            <div class="pillar-card executive-pillar">
              <div class="pillar-header">
                <span class="pillar-icon">📊</span>
                <h4>Resumen Ejecutivo del Periodo</h4>
              </div>
              <ul class="pillar-list">
                @for (bullet of executiveBullets(); track $index) {
                  <li>
                    <span class="list-bullet">•</span>
                    <span>{{ bullet }}</span>
                  </li>
                }
              </ul>
            </div>

            <!-- Pilar 2: Benchmarking Líder vs Competidores -->
            <div class="pillar-card benchmark-pillar">
              <div class="pillar-header">
                <span class="pillar-icon">⚔️</span>
                <h4>Líder vs Competidores</h4>
              </div>
              <div class="benchmark-info">
                <div class="leader-row">
                  <span class="leader-label">Marca Líder:</span>
                  <strong class="leader-name">{{ insights()?.leaderVsCompetitors?.leaderBrand || 'Marca Líder' }}</strong>
                  <span class="share-badge">{{ insights()?.leaderVsCompetitors?.shareOfAttention || 'Mayor cuota de views' }}</span>
                </div>
                <div class="edge-block">
                  <span class="edge-title">Ventaja Competitiva:</span>
                  <p>{{ insights()?.leaderVsCompetitors?.competitiveEdge || 'Consistencia en ritmo de publicación y alto impacto de formato audiovisual.' }}</p>
                </div>
                <div class="opportunity-block">
                  <span class="opp-title">Oportunidad para Competidores:</span>
                  <p>{{ insights()?.leaderVsCompetitors?.competitorOpportunities || 'Aprovechar ganchos en los primeros 3 segundos e incentivar conversación comunitaria.' }}</p>
                </div>
              </div>
            </div>

            <!-- Pilar 3: Recomendaciones Accionables -->
            <div class="pillar-card action-pillar">
              <div class="pillar-header">
                <span class="pillar-icon">💡</span>
                <h4>Recomendaciones Tácticas</h4>
              </div>
              <ul class="pillar-list numbered-list">
                @for (tip of recommendations(); track $index) {
                  <li>
                    <span class="list-number">{{ $index + 1 }}</span>
                    <span>{{ tip }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .ai-insights-container {
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #cbd5e1;
      border-radius: 1rem;
      padding: 1.5rem 1.75rem;
      margin-bottom: 2rem;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      }
    }

    .ai-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 1.5rem;
    }

    .ai-title-block {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .ai-badge-icon {
      width: 44px;
      height: 44px;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
      border: 1px solid #bfdbfe;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
      flex-shrink: 0;
    }

    .ai-headline-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .ai-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .ai-tag {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      letter-spacing: 0.04em;
    }

    .ai-subtitle {
      font-size: 0.85rem;
      color: #64748b;
      margin: 0.25rem 0 0 0;

      .update-time {
        color: #059669;
        font-weight: 600;
      }
    }

    .ai-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .ai-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1rem;
      border-radius: 0.65rem;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    }

    .ai-btn-secondary {
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

      &:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #94a3b8;
        color: #0f172a;
      }
    }

    .ai-btn-primary {
      background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
      color: #ffffff;
      border: 1px solid #1d4ed8;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
      }
    }

    .spin-anim {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* SKELETON LOADING */
    .ai-loading-state {
      padding: 1.5rem 0;
    }

    .loading-pulse-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 1rem 1.25rem;
      border-radius: 0.75rem;

      .ai-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #93c5fd;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        flex-shrink: 0;
      }

      .loading-text-group {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        font-size: 0.88rem;
        color: #1e3a8a;

        span {
          font-size: 0.78rem;
          color: #3b82f6;
        }
      }
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
    }

    .skeleton-card {
      height: 140px;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 0.75rem;

      &.skeleton-highlight {
        grid-column: 1 / -1;
        height: 180px;
      }
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* TARJETA DESTACADA (TOP PERFORMER) */
    .top-performer-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 0.85rem;
      padding: 1.35rem 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      border-left: 4px solid #3b82f6;
    }

    .top-performer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .performer-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.76rem;
      font-weight: 800;
      color: #1e40af;
      letter-spacing: 0.03em;
    }

    .format-pill {
      background: #f1f5f9;
      color: #475569;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid #cbd5e1;
    }

    .top-performer-content-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 1.5rem;
      align-items: stretch;
    }

    .brand-author-row {
      margin-bottom: 0.5rem;

      .brand-name {
        font-size: 1.15rem;
        font-weight: 800;
        color: #0f172a;
      }
    }

    .caption-snippet {
      font-size: 0.88rem;
      color: #334155;
      line-height: 1.5;
      margin: 0 0 1rem 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-style: italic;
    }

    .metrics-chips-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.6rem;
    }

    .metric-chip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.6rem;
      padding: 0.45rem 0.65rem;
      display: flex;
      flex-direction: column;

      .chip-label {
        font-size: 0.7rem;
        color: #64748b;
        font-weight: 600;
      }

      .chip-value {
        font-size: 0.95rem;
        color: #0f172a;
        font-weight: 800;
      }

      &.views-chip {
        border-color: #bfdbfe;
        background: #f0f7ff;
        .chip-value { color: #1d4ed8; }
      }

      &.er-chip {
        border-color: #fed7aa;
        background: #fffbeb;
        .chip-value { color: #b45309; }
      }
    }

    /* CAJA DE VIRALIDAD */
    .viral-analysis-box {
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
      border: 1px solid #e9d5ff;
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .viral-box-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;

        h4 {
          font-size: 0.85rem;
          font-weight: 700;
          color: #6b21a8;
          margin: 0;
        }
      }

      .viral-reason-text {
        font-size: 0.83rem;
        color: #4c1d95;
        line-height: 1.5;
        margin: 0 0 0.85rem 0;
      }

      .viral-box-footer {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;

        .link-btn {
          font-size: 0.78rem;
          color: #7c3aed;
          font-weight: 700;
          text-decoration: none;

          &:hover {
            text-decoration: underline;
          }
        }

        .quick-ask-btn {
          background: #ffffff;
          border: 1px solid #d8b4fe;
          color: #6b21a8;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.3rem 0.65rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: background 0.15s;

          &:hover {
            background: #f3e8ff;
          }
        }
      }
    }

    /* 3 PILARES GRID */
    .strategic-pillars-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .pillar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.15rem 1.25rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);

      .pillar-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #f1f5f9;
        margin-bottom: 0.85rem;

        h4 {
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
      }
    }

    .pillar-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;

      li {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        font-size: 0.82rem;
        color: #334155;
        line-height: 1.45;

        .list-bullet {
          color: #3b82f6;
          font-weight: 900;
        }

        .list-number {
          background: #e0e7ff;
          color: #4338ca;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }
      }
    }

    .benchmark-info {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      font-size: 0.82rem;

      .leader-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;

        .leader-label {
          color: #64748b;
        }

        .leader-name {
          color: #0f172a;
          font-size: 0.9rem;
        }

        .share-badge {
          background: #dcfce7;
          color: #15803d;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 9999px;
        }
      }

      .edge-block, .opportunity-block {
        span {
          font-weight: 700;
          font-size: 0.75rem;
          color: #475569;
          display: block;
          margin-bottom: 0.15rem;
        }

        p {
          margin: 0;
          color: #334155;
          line-height: 1.4;
        }
      }
    }

    /* RESPONSIVE */
    @media (max-width: 900px) {
      .top-performer-content-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
    }

    @media (max-width: 640px) {
      .ai-insights-container {
        padding: 1rem;
      }

      .ai-header {
        flex-direction: column;
        align-items: stretch;
      }

      .ai-actions {
        width: 100%;
        .ai-btn {
          flex: 1;
          justify-content: center;
        }
      }

      .metrics-chips-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AiInsightsCardComponent {
  public insights = input<GeminiInsightsData | null>(null);
  public isLoading = input<boolean>(false);
  public lastUpdated = input<Date | null>(null);

  public refreshRequested = output<void>();
  public openChatRequested = output<string | void>();

  public executiveBullets = computed(() => {
    const raw = this.insights()?.executiveSummary;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      if (raw.length > 10 && raw.every((x: any) => typeof x === 'string' && x.length <= 1)) {
        const full = raw.join('');
        return full
          .split(/\n+|•|- /)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 5);
      }
      return raw.map((x: any) => (typeof x === 'string' ? x : String(x))).filter((s: string) => s.length > 0);
    }
    if (typeof raw === 'string') {
      const split = (raw as string)
        .split(/\n+|•|- |\.\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);
      return split.length > 0 ? split : [raw];
    }
    return [];
  });

  public recommendations = computed(() => {
    const raw = this.insights()?.actionableRecommendations;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((x: any) => (typeof x === 'string' ? x : String(x))).filter((s: string) => s.length > 0);
    }
    if (typeof raw === 'string') {
      const split = (raw as string)
        .split(/\n+|\d+\.\s+|•|- /)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);
      return split.length > 0 ? split : [raw];
    }
    return [];
  });

  onRefresh(): void {
    this.refreshRequested.emit();
  }

  onOpenChat(initialPrompt?: string): void {
    this.openChatRequested.emit(initialPrompt);
  }
}
