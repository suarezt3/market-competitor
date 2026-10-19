import { Component, inject, signal, computed, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApifyService, ApifyRunRecord, ApifyResponse, MarketCountry, KNOWN_APIFY_RUNS_MAP } from '../../services/apify.service';
import { SupabaseService } from '../../services/supabase.service';
import { ApifyChartService, ChartMetric } from '../../services/apify-chart.service';
import { GeminiService, DatasetContextPayload } from '../../services/gemini.service';
import { MarketCountryCode, isValidTaskName, isValidTaskForMarket, findTaskByApiId, findTaskByName, getTasksByCountry } from '../../models/apify-tasks';

import { ApifyDataGridComponent } from '../apify-data-grid/apify-data-grid.component';
import { ApifyRunsTableComponent } from '../apify-runs-table/apify-runs-table.component';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';
import { ViralHighlightsComponent } from '../viral-highlights/viral-highlights.component';
import { MetricInfoTooltipComponent } from '../metric-info-tooltip/metric-info-tooltip.component';
import { MethodologyGuideComponent } from '../methodology-guide/methodology-guide.component';
import { AiInsightsCardComponent } from '../ai-insights-card/ai-insights-card.component';
import { AiAssistantDrawerComponent } from '../ai-assistant-drawer/ai-assistant-drawer.component';
import { HugeIconComponent } from '../huge-icon/huge-icon.component';

export type KpiSortOption = 'followers' | 'views' | 'likes' | 'posts';

@Component({
  selector: 'app-apify-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    FormsModule,
    NgxEchartsDirective,
    ApifyDataGridComponent,
    ApifyRunsTableComponent,
    DateRangePickerComponent,
    ViralHighlightsComponent,
    MetricInfoTooltipComponent,
    MethodologyGuideComponent,
    AiInsightsCardComponent,
    AiAssistantDrawerComponent,
    HugeIconComponent
  ],
  templateUrl: './apify-viewer.component.html',
  styleUrl: './apify-viewer.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeGridDropdowns()'
  }
})
export class ApifyViewerComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  public apifyService = inject(ApifyService);
  private supabaseService = inject(SupabaseService);
  public apifyChartService = inject(ApifyChartService);
  public geminiService = inject(GeminiService);

  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Aviso informativo no bloqueante para canales con 0 runs
  channelEmptyNotice = signal<{ taskName: string; platform: string; country: string } | null>(null);

  // Modal de configuración del API Token de Apify
  showTokenModal = signal<boolean>(false);
  tokenInputValue = signal<string>('');

  data = signal<any[]>([]);
  runsList = signal<ApifyRunRecord[]>([]);
  activeRunId = signal<string | null>(null);

  loadedNetwork = signal<string>('');
  loadedCountry = signal<string>('');

  selectedMetric = signal<ChartMetric>('total');
  kpiSortMetric = signal<KpiSortOption>('followers');

  selectedCountry = signal<MarketCountry>('Colombia');
  public selectedMarket = this.apifyService.selectedMarket;

  onMarketChange(newMarket: MarketCountryCode) {
    if (this.selectedMarket() === newMarket) return;
    this.channelEmptyNotice.set(null);
    this.error.set(null);
    this.apifyService.setMarket(newMarket);
    this.selectedCountry.set(newMarket === 'MX' ? 'México' : 'Colombia');
    this.fetchOmnichannelData();
    this.loadHistory();
  }

  openTokenModal(): void {
    this.tokenInputValue.set(this.apifyService.apifyToken());
    this.showTokenModal.set(true);
  }

  closeTokenModal(): void {
    this.showTokenModal.set(false);
  }

  saveToken(token: string): void {
    this.apifyService.setToken(token);
    this.showTokenModal.set(false);
    this.fetchOmnichannelData();
    this.loadHistory();
  }

  /**
   * Purgado estricto de caché y datos antiguos, seguido de sincronización limpia de las 16 tareas oficiales
   */
  purgeAndSync(): void {
    this.resetState();
    this.isLoading.set(true);
    this.error.set(null);

    this.supabaseService.purgeLegacyData().subscribe({
      next: (res) => {
        console.info('[ApifyViewer] Purga completada:', res.message);
        this.fetchOmnichannelData();
      },
      error: (err) => {
        console.warn('[ApifyViewer] Error en purga, procediendo con sincronización limpia:', err);
        this.fetchOmnichannelData();
      }
    });
  }

  filterStartDate = signal<string>('');
  filterEndDate = signal<string>('');

  // Control de la Guía y Documentación Metodológica
  showMethodologyModal = signal<boolean>(false);
  selectedMethodologyTopic = signal<string>('overview');

  openMethodology(topicId: string = 'overview'): void {
    this.selectedMethodologyTopic.set(topicId);
    this.showMethodologyModal.set(true);
  }

  closeMethodology(): void {
    this.showMethodologyModal.set(false);
  }

  gridBrandFilter = signal<string>('ALL');
  gridNetworkFilter = signal<string>('ALL');
  gridContentTypeFilter = signal<string>('ALL');
  gridSortMetric = signal<string>('date_desc');
  gridSearchQuery = signal<string>('');

  activeGridDropdown = signal<'brand' | 'network' | 'format' | 'sort' | 'kpi-sort' | null>(null);

  readonly kpiSortOptions: Array<{
    value: KpiSortOption;
    label: string;
    sublabel: string;
    icon: string;
    color: string;
    bgTint: string;
  }> = [
    {
      value: 'followers',
      label: 'Mayor Comunidad',
      sublabel: 'Audiencia consolidada',
      icon: 'followers',
      color: '#2563eb',
      bgTint: '#eff6ff'
    },
    {
      value: 'views',
      label: 'Más Vistas',
      sublabel: 'Reproducciones totales',
      icon: 'views',
      color: '#9333ea',
      bgTint: '#faf5ff'
    },
    {
      value: 'likes',
      label: 'Más Likes',
      sublabel: 'Interacciones y likes',
      icon: 'likes',
      color: '#e11d48',
      bgTint: '#fff1f2'
    },
    {
      value: 'posts',
      label: 'Más Publicaciones',
      sublabel: 'Volumen de publicaciones',
      icon: 'posts',
      color: '#059669',
      bgTint: '#ecfdf5'
    }
  ];

  selectedKpiSortOption = computed(() => {
    const current = this.kpiSortMetric();
    return this.kpiSortOptions.find(opt => opt.value === current) ?? this.kpiSortOptions[0];
  });

  selectKpiSort(metric: KpiSortOption) {
    this.kpiSortMetric.set(metric);
    this.closeGridDropdowns();
  }

  hasActiveGridFilters = computed(() => {
    return this.gridBrandFilter() !== 'ALL' ||
           this.gridNetworkFilter() !== 'ALL' ||
           (this.showContentTypeFilter() && this.gridContentTypeFilter() !== 'ALL') ||
           this.gridSortMetric() !== 'date_desc' ||
           this.gridSearchQuery().trim() !== '';
  });

  toggleGridDropdown(menu: 'brand' | 'network' | 'format' | 'sort' | 'kpi-sort', event: MouseEvent) {
    event.stopPropagation();
    if (this.activeGridDropdown() === menu) {
      this.activeGridDropdown.set(null);
    } else {
      this.activeGridDropdown.set(menu);
    }
  }

  closeGridDropdowns() {
    this.activeGridDropdown.set(null);
  }

  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-filter-dropdown') && !target.closest('.kpi-sort-dropdown')) {
      this.closeGridDropdowns();
    }
  }

  selectGridBrand(brand: string) {
    this.gridBrandFilter.set(brand);
    this.closeGridDropdowns();
  }

  selectGridNetwork(net: string) {
    this.closeGridDropdowns();
    this.handleNavSelection(net === 'ALL' ? 'omnicanal' : net);
  }

  selectGridFormat(format: string) {
    this.gridContentTypeFilter.set(format);
    this.closeGridDropdowns();
  }

  selectGridSort(sort: string) {
    this.gridSortMetric.set(sort);
    this.closeGridDropdowns();
  }

  resetGridFilters() {
    this.gridBrandFilter.set('ALL');
    this.gridNetworkFilter.set('ALL');
    this.gridContentTypeFilter.set('ALL');
    this.gridSortMetric.set('date_desc');
    this.gridSearchQuery.set('');
    this.closeGridDropdowns();
  }

  getNetworkLabel(net: string): string {
    switch ((net || '').toLowerCase()) {
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      case 'tiktok': return 'TikTok';
      case 'youtube': return 'YouTube';
      case 'all': return 'Todas';
      default: return net || 'Todas';
    }
  }

  getFormatLabel(format: string): string {
    switch (format) {
      case 'video': return 'Videos / Reels';
      case 'image': return 'Imágenes';
      case 'carousel': return 'Carruseles';
      case 'text': return 'Solo Texto';
      case 'ALL':
      default: return 'Todos los formatos';
    }
  }

  getSortLabel(sort: string): string {
    switch (sort) {
      case 'views_desc': return 'Más Vistas';
      case 'likes_desc': return 'Más Likes';
      case 'comments_desc': return 'Más Comentarios';
      case 'date_desc':
      default: return 'Fecha (Reciente)';
    }
  }

  getBrandLogo(brand: string): string | null {
    const kpi = this.competitorsKpi().find(c => c.name.toLowerCase() === brand.toLowerCase());
    return kpi?.logoUrl || kpi?.avatar || null;
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadHistory();
      this.fetchOmnichannelData();
    }
  }

  // ==========================================
  // LÓGICA DE VALIDACIÓN Y UX CONDICIONAL
  // ==========================================

  onStartDateChange(newDate: string) {
    this.filterStartDate.set(newDate);
    const end = this.filterEndDate();
    if (newDate && end && new Date(newDate) > new Date(end)) {
      this.filterEndDate.set(newDate);
    }
  }

  onEndDateChange(newDate: string) {
    this.filterEndDate.set(newDate);
    const start = this.filterStartDate();
    if (newDate && start && new Date(newDate) < new Date(start)) {
      this.filterStartDate.set(newDate);
    }
  }

  onDateRangeChange(range: { startDate: string; endDate: string }) {
    this.filterStartDate.set(range.startDate);
    this.filterEndDate.set(range.endDate);
  }

  clearDateFilter() {
    this.filterStartDate.set('');
    this.filterEndDate.set('');
  }

  showContentTypeFilter = computed(() => {
    const mainNet = this.loadedNetwork();
    const gridNet = this.gridNetworkFilter();

    if (mainNet === 'youtube') return false;
    if (mainNet === 'omnicanal' && gridNet === 'youtube') return false;

    return true;
  });

  getNetworkIcon(net: string): string {
    const n = (net || '').toLowerCase();
    if (n.includes('instagram')) return '/assets/icons/instagram.svg';
    if (n.includes('facebook')) return '/assets/icons/facebook.svg';
    if (n.includes('tiktok')) return '/assets/icons/tiktok.svg';
    if (n.includes('youtube')) return '/assets/icons/youtube.svg';
    return '/assets/icons/omnichannel.svg';
  }

  // Conteo individual real en tiempo real por canal para el mercado activo
  channelCounts = computed(() => {
    const currentData = this.data();
    const market = this.selectedMarket();
    let instagram = 0;
    let tiktok = 0;
    let youtube = 0;
    let facebook = 0;

    currentData.forEach(item => {
      const c = (item.country || item.__country || item.country_code || '').toString().trim().toUpperCase();
      const matchesCountry = (market === 'MX') ? (c === 'MX') : (c === 'COL');
      if (!matchesCountry) return;

      const net = (item.__network || item.platform || '').toLowerCase();
      if (net.includes('instagram')) instagram++;
      else if (net.includes('tiktok')) tiktok++;
      else if (net.includes('youtube')) youtube++;
      else if (net.includes('facebook')) facebook++;
    });

    return {
      total: instagram + tiktok + youtube + facebook,
      instagram,
      tiktok,
      youtube,
      facebook
    };
  });

  // Red efectiva activa para títulos, métricas y gráficas
  effectiveNetwork = computed(() => {
    const filter = this.gridNetworkFilter();
    if (filter !== 'ALL') return filter;
    return this.loadedNetwork() || 'omnicanal';
  });

  isChannelActive(net: string): boolean {
    const filter = (this.gridNetworkFilter() || 'ALL').trim().toLowerCase();
    const target = (net || '').trim().toLowerCase();
    if (target === 'omnicanal') {
      return filter === 'all' || filter === 'omnicanal';
    }
    return filter === target;
  }

  getChannelBadge(net: string): string {
    const counts = this.channelCounts();
    if (net === 'omnicanal') {
      return counts.total > 0 ? `${counts.total} items` : 'Ecosistema';
    }
    const n = net.toLowerCase();
    let count = 0;
    if (n.includes('tiktok')) count = counts.tiktok;
    else if (n.includes('youtube')) count = counts.youtube;
    else if (n.includes('instagram')) count = counts.instagram;
    else if (n.includes('facebook')) count = counts.facebook;

    return count > 0 ? `${count}` : 'Live';
  }

  handleNavSelection(net: string) {
    if (net === 'omnicanal' || net === 'ALL') {
      this.activeRunId.set(null);
      this.gridNetworkFilter.set('ALL');
      this.loadedNetwork.set('omnicanal');
      this.channelEmptyNotice.set(null);
      this.error.set(null);
      this.fetchOmnichannelData();
      return;
    }

    // El usuario seleccionó un canal específico en el panel lateral (TikTok, YouTube, etc.)
    const market = this.selectedMarket();
    const marketLabel = market === 'MX' ? 'México' : 'Colombia';
    const channelLower = net.toLowerCase();

    this.gridNetworkFilter.set(channelLower);
    this.loadedNetwork.set(channelLower);
    this.channelEmptyNotice.set(null);
    this.error.set(null);

    // Buscar corrida correspondiente a esta plataforma en la lista del mercado activo
    const matchingRun = this.findRunForPlatform(channelLower, market);

    if (matchingRun) {
      // Cargar directamente la ejecución de esa plataforma sincronizando la tabla
      this.loadSpecificRun(matchingRun.id, matchingRun.actorTaskId || matchingRun.actorId || '', channelLower);
    } else {
      // No hay corridas para esta plataforma en este mercado (ej: Instagram o Facebook con 0 runs)
      this.activeRunId.set(null);
      this.resetState(true);
      this.gridNetworkFilter.set(channelLower);
      this.loadedNetwork.set(channelLower);

      const countryTasks = getTasksByCountry(market);
      const officialTask = countryTasks.find(t => t.platform.toLowerCase() === channelLower);
      const taskName = officialTask ? officialTask.taskName : `${channelLower.toUpperCase()}_${market}`;

      this.channelEmptyNotice.set({
        taskName,
        platform: this.getNetworkLabel(channelLower),
        country: `${marketLabel} (${market})`
      });
    }
  }

  findRunForPlatform(platform: string, market: MarketCountryCode): ApifyRunRecord | undefined {
    const p = platform.toLowerCase();

    // 1. Buscar en runsList()
    const foundInList = this.runsList().find(r => {
      const taskName = (r.taskName || '').toLowerCase();
      const rPlat = (r.platform || (taskName.includes('tiktok') ? 'tiktok' : (taskName.includes('youtube') ? 'youtube' : ''))).toLowerCase();
      const rCountry = (r.country === 'MX' || r.country === 'México' || taskName.includes('_mx') || taskName.includes('-mx') ? 'MX' : 'COL');
      return rPlat === p && rCountry === market;
    });
    if (foundInList) return foundInList;

    // 2. Fallback de catálogo conocido oficial para respuesta inmediata
    for (const [id, meta] of Object.entries(KNOWN_APIFY_RUNS_MAP)) {
      if (meta.platform === p && meta.country === market) {
        return {
          id,
          status: 'SUCCEEDED',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          usageTotalUsd: 0,
          actorId: '',
          actorTaskId: meta.apiTaskId,
          taskName: meta.taskName,
          country: meta.country,
          itemsCount: meta.approxItems,
          platform: meta.platform,
          contentType: meta.contentType,
          defaultDatasetId: id
        };
      }
    }
    return undefined;
  }

  filterOrLoadNetwork(net: string) {
    this.handleNavSelection(net);
  }

  // ==========================================
  // MOTOR REACTIVO PRINCIPAL
  // ==========================================

  filteredData = computed(() => {
    let currentData = this.data();
    const networkFilter = this.gridNetworkFilter();
    const market = this.selectedMarket();

    // FILTRO ESTRICTO DE VISUALIZACIÓN:
    // 1. Debe coincidir exactamente con el país/mercado activo ('COL' o 'MX')
    // 2. Debe poseer un task_name válido perteneciente al catálogo de 16 Actor Tasks
    // Ningún registro huérfano, sin task_name o de scrapers directos se mostrará en pantalla.
    currentData = currentData.filter(item => {
      const c = (item.country || item.__country || item.country_code || '').toString().trim().toUpperCase();
      const matchesCountry = (market === 'MX') ? (c === 'MX') : (c === 'COL');
      if (!matchesCountry) return false;

      const taskName = item.taskName || item.__taskName || item.task_name;
      if (!taskName || !isValidTaskName(taskName)) return false;

      return true;
    });

    // Sincronización Global por Canal:
    if (networkFilter !== 'ALL') {
      currentData = currentData.filter(item =>
        (item.__network || item.platform || '').toLowerCase().includes(networkFilter.toLowerCase())
      );
    }

    const startStr = this.filterStartDate();
    const endStr = this.filterEndDate();

    if (!startStr && !endStr) return currentData;

    const startMs = startStr ? new Date(startStr + 'T00:00:00').getTime() : 0;
    const endMs = endStr ? new Date(endStr + 'T23:59:59').getTime() : Infinity;

    return currentData.filter(item => {
      const rawDate = item.time || item.timestamp || item.date || item.createTimeISO || item.createdAt || item.videoMeta?.createTime || item.createTime;
      let itemMs = 0;

      if (typeof rawDate === 'number') {
        itemMs = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
      } else if (item.createTime && typeof item.createTime === 'number') {
        itemMs = item.createTime < 10000000000 ? item.createTime * 1000 : item.createTime;
      } else {
        itemMs = rawDate ? new Date(rawDate).getTime() : 0;
      }

      if (!itemMs || isNaN(itemMs)) return true;

      return itemMs >= startMs && itemMs <= endMs;
    });
  });

  // ==========================================
  // CONTEXTO REACTIVO PARA GEMINI AI INTELLIGENCE
  // ==========================================
  datasetContextPayload = computed<DatasetContextPayload>(() => {
    const currentData = this.filteredData().filter(item => !item._isPageProfile);
    const platform = this.effectiveNetwork() || 'Omnicanal';
    const start = this.filterStartDate();
    const end = this.filterEndDate();

    // Top 10 posts ordenados por reproducciones / views
    const topPosts = [...currentData]
      .sort((a, b) => (b._kpi?.postViews || b.views || b.playCount || 0) - (a._kpi?.postViews || a.views || a.playCount || 0))
      .slice(0, 10)
      .map((item, idx) => {
        const brand = this.apifyChartService.getNormalizedBrandName(item) || item.ownerUsername || 'Marca';
        const views = item._kpi?.postViews || item.views || item.playCount || 0;
        const likes = item._kpi?.postLikes || item.likes || item.likesCount || 0;
        const comments = item.commentsCount || item.commentCount || item.comments || 0;
        const er = views > 0 ? Number(((likes + comments) / views * 100).toFixed(2)) : 0;

        return {
          id: item.id || `post_${idx}`,
          brand,
          author: item.ownerUsername || item.authorMeta?.name || item.channelName || brand,
          caption: item.caption || item.text || item.title || item.cleanText || '',
          url: item.url || item.webVideoUrl || item.topLevelUrl || '#',
          views,
          likes,
          comments,
          engagementRate: er,
          type: item._contentType || (item.videoUrl ? 'Video' : 'Post'),
          date: item.time || item.timestamp || item.date || item.createdAt || ''
        };
      });

    // Rendimiento por marca
    const brandPerfMap = new Map<string, { brand: string; postCount: number; totalViews: number; totalLikes: number; totalComments: number }>();
    for (const item of currentData) {
      const b = this.apifyChartService.getNormalizedBrandName(item) || 'Otros';
      if (b === 'Embajadores / Creadores' || b === 'Medios y Eventos B2B') continue;
      const entry = brandPerfMap.get(b) || { brand: b, postCount: 0, totalViews: 0, totalLikes: 0, totalComments: 0 };
      entry.postCount++;
      entry.totalViews += (item._kpi?.postViews || item.views || item.playCount || 0);
      entry.totalLikes += (item._kpi?.postLikes || item.likes || item.likesCount || 0);
      entry.totalComments += (item.commentsCount || item.commentCount || item.comments || 0);
      brandPerfMap.set(b, entry);
    }

    const brandPerformance = Array.from(brandPerfMap.values()).map(b => ({
      brand: b.brand,
      postCount: b.postCount,
      totalViews: b.totalViews,
      avgLikes: b.postCount > 0 ? Math.round(b.totalLikes / b.postCount) : 0,
      avgEngagement: b.totalViews > 0 ? Number(((b.totalLikes + b.totalComments) / b.totalViews * 100).toFixed(2)) : 0
    })).sort((a, b) => b.totalViews - a.totalViews);

    const totalViews = brandPerformance.reduce((acc, curr) => acc + curr.totalViews, 0);
    const totalLikes = brandPerformance.reduce((acc, curr) => acc + (curr.avgLikes * curr.postCount), 0);
    const totalComments = currentData.reduce((acc, curr) => acc + (curr.commentsCount || curr.commentCount || 0), 0);
    const avgEngagementRate = totalViews > 0 ? Number(((totalLikes + totalComments) / totalViews * 100).toFixed(2)) : 4.5;

    return {
      selectedMarket: this.selectedMarket(),
      platform,
      dateRange: { start, end },
      totalPosts: currentData.length,
      brands: brandPerformance.map(b => b.brand),
      metricsSummary: {
        totalViews,
        totalLikes,
        totalComments,
        avgEngagementRate
      },
      brandPerformance,
      topPosts
    };
  });

  triggerGeminiInsights(force = false): void {
    const payload = this.datasetContextPayload();
    if (payload.totalPosts > 0) {
      this.geminiService.fetchInsights(payload, force);
    }
  }

  openGeminiChat(initialPrompt?: string | void): void {
    this.geminiService.toggleChatDrawer(true);
    if (typeof initialPrompt === 'string' && initialPrompt.trim()) {
      this.geminiService.sendChatMessage(initialPrompt, this.datasetContextPayload());
    }
  }

  closeGeminiChat(): void {
    this.geminiService.toggleChatDrawer(false);
  }

  sendChatMessage(text: string): void {
    this.geminiService.sendChatMessage(text, this.datasetContextPayload());
  }

  cancelGeminiChat(): void {
    this.geminiService.cancelChatMessage();
  }

  clearGeminiChat(): void {
    this.geminiService.clearChat();
  }

  // ==========================================
  // MOTOR REACTIVO ESPECÍFICO PARA EL GRID Y SIDEBAR
  // ==========================================

  datasetDateSummary = computed(() => {
    const items = this.data();
    if (!items || items.length === 0) return null;
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const item of items) {
      const d = item.timestamp || item.createTime || item.date || item.takenAt;
      if (d) {
        const time = new Date(d).getTime();
        if (!isNaN(time) && time > 0) {
          if (time < minTime) minTime = time;
          if (time > maxTime) maxTime = time;
        }
      }
    }
    if (minTime === Infinity || maxTime === -Infinity) return null;
    return {
      start: new Date(minTime),
      end: new Date(maxTime)
    };
  });

  availableBrands = computed(() => {
    const data = this.filteredData().filter(item => !item._isPageProfile);
    const brands = new Set<string>();

    data.forEach(item => {
      const brand = this.apifyChartService.getNormalizedBrandName(item);
      if (brand && brand !== 'Embajadores / Creadores' && brand !== 'Medios y Eventos B2B') {
        brands.add(brand);
      }
    });

    return Array.from(brands).sort();
  });

  gridDisplayData = computed(() => {
    let data = [...this.filteredData()].filter(item => !item._isPageProfile);
    const brandFilter = this.gridBrandFilter();
    const networkFilter = this.gridNetworkFilter();
    const contentTypeFilter = this.gridContentTypeFilter();
    const sortOption = this.gridSortMetric();

    if (networkFilter !== 'ALL') {
      data = data.filter(item => (item.__network || item.platform || '').toLowerCase().includes(networkFilter.toLowerCase()));
    }

    if (brandFilter !== 'ALL') {
      data = data.filter(item => this.apifyChartService.getNormalizedBrandName(item) === brandFilter);
    }

    if (this.showContentTypeFilter() && contentTypeFilter !== 'ALL') {
      data = data.filter(item => item._contentType === contentTypeFilter);
    }

    const search = this.gridSearchQuery().trim().toLowerCase();
    if (search) {
      data = data.filter(item => {
        const text = (item.text || item.caption || item.description || item.title || item.cleanText || '').toLowerCase();
        const brand = (item.brand || item.authorMeta?.name || item.ownerUsername || '').toLowerCase();
        const hashtags = Array.isArray(item.hashtags) ? item.hashtags.join(' ').toLowerCase() : '';
        return text.includes(search) || brand.includes(search) || hashtags.includes(search);
      });
    }

    data.sort((a, b) => {
      const kpiA = a._kpi || {};
      const kpiB = b._kpi || {};

      switch (sortOption) {
        case 'views_desc':
          return (kpiB.postViews || 0) - (kpiA.postViews || 0);
        case 'likes_desc':
          return (kpiB.postLikes || 0) - (kpiA.postLikes || 0);
        case 'comments_desc':
          return (b.commentsCount || b.commentCount || 0) - (a.commentsCount || a.commentCount || 0);
        case 'date_desc':
        default:
          const getMs = (item: any) => {
            const d = item.time || item.timestamp || item.date || item.createTimeISO || item.createdAt;
            if (typeof d === 'number') return d < 10000000000 ? d * 1000 : d;
            return d ? new Date(d).getTime() : 0;
          };
          return getMs(b) - getMs(a);
      }
    });

    return data;
  });

  // ==========================================
  // GRÁFICAS Y KPIs COMPUTADOS
  // ==========================================

  chartOptions = computed(() => {
    const data = this.filteredData().filter(item => !item._isPageProfile);
    const net = this.effectiveNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildChartOptions(net, data, this.selectedMetric());
  });

  marketShareChartOptions = computed(() => {
    const data = this.filteredData().filter(item => !item._isPageProfile);
    const net = this.effectiveNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildMarketShareChart(net, data, this.selectedMetric());
  });

  performanceChartOptions = computed(() => {
    const data = this.filteredData().filter(item => !item._isPageProfile);
    const net = this.effectiveNetwork();
    if (!data.length || !net || net === 'omnicanal') return null;
    return this.apifyChartService.buildPerformanceScatterChart(net, data);
  });

  masterChartOptions = computed(() => {
    const data = this.filteredData().filter(item => !item._isPageProfile);
    const net = this.effectiveNetwork();
    if (!data.length || net !== 'omnicanal') return null;
    return this.apifyChartService.buildMasterOmnichannelChart(data, this.selectedMetric());
  });

  engagementChartOptions = computed(() => {
    const data = this.filteredData().filter(item => !item._isPageProfile);
    const net = this.effectiveNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildEngagementRateChart(net, data);
  });

  formatPerformanceChartOptions = computed(() => {
    const data = this.filteredData().filter(item => !item._isPageProfile);
    const net = this.effectiveNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildContentTypePerformanceChart(net, data);
  });

  omnichannelStats = computed(() => {
    const currentData = this.data();
    if (!currentData.length) return null;
    const market = this.selectedMarket();

    const startStr = this.filterStartDate();
    const endStr = this.filterEndDate();
    const startMs = startStr ? new Date(startStr + 'T00:00:00').getTime() : 0;
    const endMs = endStr ? new Date(endStr + 'T23:59:59').getTime() : Infinity;

    let instagram = 0;
    let tiktok = 0;
    let youtube = 0;
    let facebook = 0;

    currentData.forEach(item => {
      const c = (item.country || item.__country || item.country_code || '').toString().trim().toUpperCase();
      const matchesCountry = (market === 'MX') ? (c === 'MX') : (c === 'COL');
      if (!matchesCountry) return;

      const rawDate = item.time || item.timestamp || item.date || item.createTimeISO || item.createdAt || item.videoMeta?.createTime || item.createTime;
      let itemMs = 0;
      if (typeof rawDate === 'number') {
        itemMs = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
      } else if (item.createTime && typeof item.createTime === 'number') {
        itemMs = item.createTime < 10000000000 ? item.createTime * 1000 : item.createTime;
      } else {
        itemMs = rawDate ? new Date(rawDate).getTime() : 0;
      }

      if (startStr || endStr) {
        if (itemMs && !isNaN(itemMs) && (itemMs < startMs || itemMs > endMs)) {
          return;
        }
      }

      const net = (item.__network || item.platform || '').toLowerCase();
      if (net.includes('instagram')) instagram++;
      else if (net.includes('tiktok')) tiktok++;
      else if (net.includes('youtube')) youtube++;
      else if (net.includes('facebook')) facebook++;
    });

    return {
      total: instagram + tiktok + youtube + facebook,
      instagram,
      tiktok,
      youtube,
      facebook
    };
  });

  omnichannelMatrix = computed(() => {
    const data = this.filteredData();
    if (this.effectiveNetwork() !== 'omnicanal' || !data.length) return [];

    const matrixMap: Record<string, {
      brand: string;
      color: string;
      avatar: string | null;
      platforms: { instagram: boolean; tiktok: boolean; youtube: boolean; facebook: boolean };
      postsCount: { instagram: number; tiktok: number; youtube: number; facebook: number; total: number };
      engagement: { instagram: number; tiktok: number; youtube: number; facebook: number; total: number };
      views: { instagram: number; tiktok: number; youtube: number; facebook: number; total: number };
      followers: { instagram: number; tiktok: number; youtube: number; facebook: number; total: number };
      topPlatform: string;
    }> = {};

    data.forEach(item => {
      const brand = this.apifyChartService.getNormalizedBrandName(item);
      if (brand === 'Embajadores / Creadores' || brand === 'Medios y Eventos B2B') return;

      const net = (item.__network as 'instagram' | 'tiktok' | 'youtube' | 'facebook') || 'unknown';
      if (!['instagram', 'tiktok', 'youtube', 'facebook'].includes(net)) return;

      if (!matrixMap[brand]) {
        matrixMap[brand] = {
          brand,
          color: this.apifyChartService.getBrandColor(brand),
          avatar: null,
          platforms: { instagram: false, tiktok: false, youtube: false, facebook: false },
          postsCount: { instagram: 0, tiktok: 0, youtube: 0, facebook: 0, total: 0 },
          engagement: { instagram: 0, tiktok: 0, youtube: 0, facebook: 0, total: 0 },
          views: { instagram: 0, tiktok: 0, youtube: 0, facebook: 0, total: 0 },
          followers: { instagram: 0, tiktok: 0, youtube: 0, facebook: 0, total: 0 },
          topPlatform: ''
        };
      }

      const b = matrixMap[brand];
      b.platforms[net] = true;

      const avatar = item.ownerProfilePicUrl || item.channelAvatarUrl || item.authorMeta?.avatar || item.user?.profilePic || item.profilePicUrl || item.pageProfilePic || null;
      if (avatar && !b.avatar) b.avatar = avatar;

      const isFbPage = net === 'facebook' && (item.pageId || item.category || !item.postId);
      if (!isFbPage) {
        b.postsCount[net]++;
        b.postsCount.total++;
      }

      const eng = this.apifyChartService.getMetricValue(item, net, 'total');
      const views = this.apifyChartService.getMetricValue(item, net, 'views');

      b.engagement[net] += eng;
      b.engagement.total += eng;
      b.views[net] += views;
      b.views.total += views;

      const kpi = item._kpi;
      let f = 0;
      if (kpi && kpi.followers > 0) f = kpi.followers;
      else if (net === 'facebook' && item.followers) f = item.followers;
      else if (net === 'tiktok' && item.authorMeta?.fans) f = item.authorMeta.fans;
      else if (net === 'youtube' && item.numberOfSubscribers) f = item.numberOfSubscribers;
      else if (net === 'instagram' && item.followersCount) f = item.followersCount;

      if (f > b.followers[net]) b.followers[net] = f;
    });

    const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

    return Object.values(matrixMap)
      .map(b => {
        b.followers.total = b.followers.instagram + b.followers.tiktok + b.followers.youtube + b.followers.facebook;

        const platformScores = [
          { name: 'Instagram', score: b.engagement.instagram, icon: '/assets/icons/instagram.svg' },
          { name: 'TikTok', score: b.engagement.tiktok, icon: '/assets/icons/tiktok.svg' },
          { name: 'YouTube', score: b.engagement.youtube, icon: '/assets/icons/youtube.svg' },
          { name: 'Facebook', score: b.engagement.facebook, icon: '/assets/icons/facebook.svg' }
        ].sort((x, y) => y.score - x.score);

        const top = platformScores[0]?.score > 0 ? platformScores[0] : null;
        b.topPlatform = top ? top.name : 'N/A';

        return {
          ...b,
          topPlatformIcon: top ? top.icon : null,
          logoUrl: this.apifyChartService.getBrandLogo(b.brand),
          followersStr: compactFormatter.format(b.followers.total),
          viewsStr: compactFormatter.format(b.views.total),
          engagementStr: compactFormatter.format(b.engagement.total),
          postsStr: compactFormatter.format(b.postsCount.total)
        };
      })
      .sort((a, b) => b.engagement.total - a.engagement.total);
  });

  dynamicDateRange = computed(() => {
    const currentData = this.filteredData();
    if (!currentData || currentData.length === 0) return null;

    const timestamps = currentData.map(item => {
      const rawDate = item.time || item.timestamp || item.date || item.createTimeISO || item.createdAt || item.videoMeta?.createTime || item.createTime;
      if (typeof rawDate === 'number') return rawDate < 10000000000 ? rawDate * 1000 : rawDate;
      if (item.createTime && typeof item.createTime === 'number') return item.createTime < 10000000000 ? item.createTime * 1000 : item.createTime;
      return rawDate ? new Date(rawDate).getTime() : null;
    }).filter(t => t !== null && !isNaN(t)) as number[];

    if (timestamps.length === 0) return null;
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    return `${minDate.toLocaleDateString('es-ES', opts)} - ${maxDate.toLocaleDateString('es-ES', opts)}`;
  });

  competitorsKpi = computed(() => {
    const currentData = this.filteredData();
    if (!currentData || currentData.length === 0) return [];

    const brandNetworkStats = new Map<string, Record<string, {
      followers: number, profileLikes: number, postLikesSum: number,
      profileViews: number, postViewsSum: number,
      profilePosts: number, postCountSum: number, avatar: string | null
    }>>();

    currentData.forEach(item => {
      const brand = this.apifyChartService.getNormalizedBrandName(item);
      if (brand === 'Embajadores / Creadores' || brand === 'Medios y Eventos B2B') return;

      const net = item.__network || 'unknown';
      let avatar = item.ownerProfilePicUrl || item.channelAvatarUrl || item.authorMeta?.avatar || item.user?.profilePic || item.user?.profile_pic_url || item.author?.profilePicture || item.profilePicUrl || item.pageProfilePic || item.avatarUrl || null;

      const kpi = item._kpi || { followers: 0, profileLikes: 0, postLikes: 0, profileViews: 0, postViews: 0, profilePosts: 0, postCount: 0 };

      if (!brandNetworkStats.has(brand)) brandNetworkStats.set(brand, {});
      const networkMap = brandNetworkStats.get(brand)!;

      if (!networkMap[net]) {
        networkMap[net] = {
          followers: kpi.followers, profileLikes: kpi.profileLikes, postLikesSum: kpi.postLikes,
          profileViews: kpi.profileViews, postViewsSum: kpi.postViews,
          profilePosts: kpi.profilePosts, postCountSum: kpi.postCount, avatar
        };
      } else {
        const ex = networkMap[net];
        ex.followers = Math.max(ex.followers, kpi.followers);
        ex.profileLikes = Math.max(ex.profileLikes, kpi.profileLikes);
        ex.profileViews = Math.max(ex.profileViews, kpi.profileViews);
        ex.profilePosts = Math.max(ex.profilePosts, kpi.profilePosts);
        ex.postLikesSum += kpi.postLikes;
        ex.postViewsSum += kpi.postViews;
        ex.postCountSum += kpi.postCount;

        if (avatar && !ex.avatar) ex.avatar = avatar;
      }
    });

    const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
    const sortMetric = this.kpiSortMetric();

    return Array.from(brandNetworkStats.entries())
      .map(([brandName, networkMap]) => {
        let totalFollowers = 0, totalLikes = 0, totalViews = 0, totalPosts = 0;
        let finalAvatar: string | null = null;

        Object.values(networkMap).forEach(stats => {
          totalFollowers += stats.followers;
          totalLikes += (stats.postCountSum > 0 || stats.postLikesSum > 0 ? stats.postLikesSum : stats.profileLikes);
          totalViews += (stats.postCountSum > 0 || stats.postViewsSum > 0 ? stats.postViewsSum : stats.profileViews);
          totalPosts += (stats.postCountSum > 0 ? stats.postCountSum : stats.profilePosts);
          if (stats.avatar && !finalAvatar) finalAvatar = stats.avatar;
        });

        return {
          name: brandName,
          avatar: finalAvatar,
          logoUrl: this.apifyChartService.getBrandLogo(brandName),
          color: this.apifyChartService.getBrandColor(brandName),
          followers: totalFollowers,
          accountLikes: totalLikes,
          accountViews: totalViews,
          accountPosts: totalPosts,
          followersStr: compactFormatter.format(totalFollowers),
          likesStr: compactFormatter.format(totalLikes),
          viewsStr: compactFormatter.format(totalViews),
          postsStr: compactFormatter.format(totalPosts)
        };
      })
      .sort((a, b) => {
        if (sortMetric === 'views') return b.accountViews - a.accountViews;
        if (sortMetric === 'likes') return b.accountLikes - a.accountLikes;
        if (sortMetric === 'posts') return b.accountPosts - a.accountPosts;
        return b.followers - a.followers;
      });
  });

  private formatDuration(val: any): string | null {
    if (!val) return null;

    if (typeof val === 'string' && val.includes(':')) {
      const parts = val.split(':');
      if (parts.length === 3 && parts[0] === '00') {
         return `${parseInt(parts[1], 10)}:${parts[2]}`;
      }
      return val;
    }

    const secs = Number(val);
    if (!isNaN(secs) && secs > 0) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);

      const sStr = s < 10 ? `0${s}` : `${s}`;
      if (h > 0) {
        const mStr = m < 10 ? `0${m}` : `${m}`;
        return `${h}:${mStr}:${sStr}`;
      }
      return `${m}:${sStr}`;
    }

    return null;
  }

  private getUnifiedContentType(net: string, item: any): string {
    if (net === 'youtube') return 'video';

    if (net === 'tiktok') {
      if (item.isSlideshow || (item.mediaUrls && item.mediaUrls.length > 0)) return 'carousel';
      return 'video';
    }

    if (net === 'instagram') {
      const typeStr = (item.type || item.productType || '').toLowerCase();
      if (typeStr.includes('video') || item.videoUrl) return 'video';
      if (typeStr === 'sidecar' || typeStr === 'carousel_container' || item.carouselMedia) return 'carousel';
      if (typeStr === 'image' || item.displayUrl) return 'image';
      return 'unknown';
    }

    if (net === 'facebook') {
      if (item.videoUrl || item.webVideoUrl || item.video) return 'video';
      if (item.imageUrl || (item.images && item.images.length > 0) || (item.photos && item.photos.length > 0)) return 'image';
      return 'text';
    }

    return 'unknown';
  }

  private standardizeData(rawData: any[], fallbackNetwork: string): any[] {
    let processed: any[] = [];

    rawData.forEach(item => {
      let net = item.__network;

      if (!net || net === 'omnicanal' || net === 'unknown') {
        const urlStr = String(item.url || item.facebookUrl || item.pageUrl || item.webVideoUrl || item.channelUrl || '').toLowerCase();

        if (item.authorMeta || item.authorStats || urlStr.includes('tiktok.com')) net = 'tiktok';
        else if (item.facebookUrl || item.pageName || urlStr.includes('facebook.com')) net = 'facebook';
        else if (item.channelName || item.channelTotalVideos || urlStr.includes('youtube.com')) net = 'youtube';
        else if (item.latestPosts || item.latestIgtvVideos || item.shortCode || item.type === 'Sidecar' || item.type === 'Image' || item.type === 'Video' || urlStr.includes('instagram.com')) net = 'instagram';
        else net = fallbackNetwork !== 'omnicanal' ? fallbackNetwork : 'unknown';
      }

      const uType = this.getUnifiedContentType(net, item);

      if (net === 'instagram') {
        if (item.latestPosts || item.latestIgtvVideos) {
          const allPosts = [...(item.latestPosts || []), ...(item.latestIgtvVideos || [])];
          allPosts.forEach((post: any) => {
            processed.push({
              ...post,
              _isPageProfile: false,
              ownerFullName: item.fullName || item.username,
              ownerUsername: item.username,
              ownerProfilePicUrl: item.profilePicUrlHD || item.profilePicUrl,
              __network: 'instagram',
              _contentType: this.getUnifiedContentType('instagram', post),
              _duration: this.formatDuration(post.videoDuration || post.duration),
              _kpi: {
                followers: item.followersCount || item.followsCount || 0,
                profileLikes: 0,
                postLikes: post.likesCount || post.likes || 0,
                profileViews: 0,
                postViews: post.videoViewCount || post.videoPlayCount || post.playCount || post.viewsCount || 0,
                profilePosts: item.postsCount || 0,
                postCount: 1
              }
            });
          });
        }
        else {
          processed.push({
            ...item,
            _isPageProfile: false,
            ownerFullName: item.ownerFullName || item.ownerUsername || item.owner?.username || 'Desconocido',
            ownerUsername: item.ownerUsername || item.owner?.username || 'Desconocido',
            ownerProfilePicUrl: item.ownerProfilePicUrl || item.owner?.profile_pic_url,
            __network: 'instagram',
            _contentType: uType,
            _duration: this.formatDuration(item.videoDuration || item.duration),
            _kpi: {
              followers: item.followersCount || item.owner?.followersCount || 0,
              profileLikes: 0,
              postLikes: item.likesCount || item.likes || 0,
              profileViews: 0,
              postViews: item.videoViewCount || item.viewCount || item.playCount || item.viewsCount || 0,
              profilePosts: 0,
              postCount: 1
            }
          });
        }
      }
      else if (net === 'tiktok') {
        processed.push({
          ...item,
          _isPageProfile: false,
          ownerFullName: item.authorMeta?.nickName || item.authorMeta?.name || item.author?.nickname,
          ownerUsername: item.authorMeta?.name || item.author?.uniqueId,
          ownerProfilePicUrl: item.authorMeta?.avatar || item.author?.avatarLarger,
          url: item.webVideoUrl || item.videoUrl || item.shareUrl,
          __network: 'tiktok',
          _contentType: uType,
          _duration: this.formatDuration(item.videoMeta?.duration || item.duration),
          _kpi: {
             followers: item.authorMeta?.fans || item.authorStats?.followerCount || 0,
             profileLikes: item.authorMeta?.heart || item.authorStats?.heartCount || 0,
             postLikes: item.diggCount || item.stats?.diggCount || item.videoMeta?.diggCount || 0,
             profileViews: 0,
             postViews: item.playCount || item.stats?.playCount || item.videoMeta?.playCount || 0,
             profilePosts: item.authorMeta?.video || item.authorStats?.videoCount || 0,
             postCount: 1
          }
        });
      }
      else if (net === 'facebook') {
        const urlCandidate = String(item.url || item.postUrl || item.topLevelUrl || item.link || item.facebookUrl || item.pageUrl || '');
        const hasPostUrl = urlCandidate.includes('/posts/') ||
                           urlCandidate.includes('/videos/') ||
                           urlCandidate.includes('/reel/') ||
                           urlCandidate.includes('/photos/') ||
                           urlCandidate.includes('story_fbid=') ||
                           urlCandidate.includes('fbid=') ||
                           urlCandidate.includes('/watch');
        const hasPostId = !!item.postId || (!!item.id && String(item.id).includes('_'));

        // Se cataloga como publicación real si tiene postId, url de post/video o métricas directas de post.
        // Si no tiene postId ni url de post, pero tiene pageUrl/facebookUrl y fans/followers de página, ES PÁGINA.
        const isPost = (hasPostId || hasPostUrl || !!item.reactionLikeCount || !!item.videoPostViewCount || !!item.reactionsCount) &&
                       !(item.pageUrl && !hasPostId && !hasPostUrl);
        const isPageProfile = !isPost;

        if (isPageProfile) {
          // Perfil / Fanpage institucional de Facebook: Se extraen seguidores para métricas de marca pero NO es post
          const pageFollowers = Number(item.followers || item.followersCount || item.likes || 0);
          processed.push({
            ...item,
            _isPageProfile: true,
            ownerFullName: item.title || item.pageName || 'Página de Facebook',
            ownerUsername: item.pageName || item.title || 'facebook_page',
            ownerProfilePicUrl: item.profilePictureUrl || item.pageProfilePic || item.user?.profilePic,
            url: item.pageUrl || item.facebookUrl || item.url || '#',
            __network: 'facebook',
            _contentType: 'page_profile',
            _duration: null,
            likes: 0,
            likesCount: 0,
            postLikes: 0,
            _kpi: {
              followers: pageFollowers,
              profileLikes: Number(item.likes || 0),
              postLikes: 0,
              profileViews: 0,
              postViews: 0,
              profilePosts: Number(item.postsCount || 0),
              postCount: 0
            }
          });
        } else {
          // Publicación legítima de Facebook
          const postLikes = Number(item.reactionLikeCount || item.reactionsCount || item.postLikes || (hasPostId ? item.likes : 0) || 0);
          const postViews = Number(item.viewsCount || item.videoPostViewCount || item.videoViews || item.views || 0);
          const postComments = Number(item.commentsCount || item.commentCount || item.comments || 0);
          const postShares = Number(item.sharesCount || item.shareCount || item.shares || 0);

          processed.push({
            ...item,
            _isPageProfile: false,
            ownerFullName: item.user?.name || item.pageName || 'Facebook User',
            ownerUsername: item.pageName || item.user?.name || 'Facebook User',
            ownerProfilePicUrl: item.user?.profilePic || item.profilePictureUrl,
            url: item.url || item.postUrl || item.topLevelUrl || item.link || '#',
            __network: 'facebook',
            _contentType: uType,
            _duration: this.formatDuration(item.duration || item.video_duration),
            likes: postLikes,
            likesCount: postLikes,
            commentsCount: postComments,
            sharesCount: postShares,
            viewsCount: postViews,
            _kpi: {
              followers: 0,
              profileLikes: 0,
              postLikes,
              profileViews: 0,
              postViews,
              profilePosts: 0,
              postCount: 1
            }
          });
        }
      }
      else if (net === 'youtube') {
        const isVideo = item.type === 'video' || item.videoId || item.url?.includes('watch') || item.url?.includes('shorts');
        processed.push({
          ...item,
          _isPageProfile: false,
          ownerFullName: item.channelName || item.aboutChannelInfo?.channelName,
          ownerUsername: item.channelUsername || item.aboutChannelInfo?.channelUsername,
          ownerProfilePicUrl: item.channelAvatarUrl || item.aboutChannelInfo?.channelAvatarUrl,
          __network: 'youtube',
          _contentType: uType,
          _duration: this.formatDuration(item.duration),
          _kpi: {
             followers: item.numberOfSubscribers || item.aboutChannelInfo?.numberOfSubscribers || 0,
             profileLikes: 0,
             postLikes: item.likes || item.likeCount || 0,
             profileViews: item.channelTotalViews || item.aboutChannelInfo?.channelTotalViews || 0,
             postViews: item.viewCount || 0,
             profilePosts: item.channelTotalVideos || item.aboutChannelInfo?.channelTotalVideos || 0,
             postCount: isVideo ? 1 : 0
          }
        });
      }
      else {
        processed.push({
          ...item,
          _isPageProfile: false,
          __network: net,
          _contentType: 'unknown',
          _kpi: {
            followers: item.followersCount || 0,
            profileLikes: 0,
            postLikes: item.likesCount || item.likes || 0,
            profileViews: 0,
            postViews: item.viewsCount || item.viewCount || 0,
            profilePosts: item.postsCount || 0,
            postCount: 1
          }
        });
      }
    });

    return processed;
  }

  // ==========================================
  // CARGA DE DATOS Y EVENTOS
  // ==========================================

  loadHistory() {
    this.isLoading.set(true);
    this.apifyService.listTaskRuns(this.selectedMarket()).subscribe({
      next: (runs) => {
        // Solo runs de las 16 tareas oficiales
        const validRuns = (runs || []).filter(r => isValidTaskName(r.taskName));
        this.runsList.set(validRuns);
        this.isLoading.set(false);
      },
      error: () => {
        this.runsList.set([]);
        this.isLoading.set(false);
      }
    });
  }

  loadSpecificRun(runId: string, actorInternalId: string, explicitPlatform?: string) {
    const historyRun = this.runsList().find(r => r.id === runId);
    const taskName = historyRun?.taskName;
    const task = taskName ? findTaskByName(taskName) : (historyRun?.actorTaskId ? findTaskByApiId(historyRun.actorTaskId) : undefined);

    const country = task?.country || (historyRun?.country === 'MX' || historyRun?.country === 'México' ? 'MX' : 'COL');
    const countryName = country === 'MX' ? 'México' : 'Colombia';

    const platform = (explicitPlatform || task?.platform || historyRun?.platform || (taskName?.toLowerCase().includes('tiktok') ? 'tiktok' : (taskName?.toLowerCase().includes('youtube') ? 'youtube' : 'omnicanal'))).toLowerCase();

    this.activeRunId.set(runId);
    this.resetState(true);
    this.gridNetworkFilter.set(platform === 'omnicanal' ? 'ALL' : platform);
    this.loadedNetwork.set(platform);
    this.apifyService.setMarket(country);
    this.selectedCountry.set(countryName as MarketCountry);
    this.channelEmptyNotice.set(null);
    this.error.set(null);

    // Si ya contamos con items en memoria para este canal y mercado, respondemos sin demora visual
    const inMemoryItems = this.data().filter(item => {
      const c = (item.country || item.__country || item.country_code || '').toString().trim().toUpperCase();
      const matchesCountry = (country === 'MX') ? (c === 'MX') : (c === 'COL');
      const itemNet = (item.__network || item.platform || '').toLowerCase();
      return matchesCountry && (platform === 'omnicanal' || itemNet.includes(platform));
    });

    if (inMemoryItems.length > 0) {
      this.selectedMetric.set('total');
      setTimeout(() => this.triggerGeminiInsights(), 100);
    } else {
      this.isLoading.set(true);
    }

    this.apifyService.getRunItems(runId, task).then(items => {
      if (Array.isArray(items) && items.length > 0) {
        this.processDataset(items, platform, countryName);
      } else if (inMemoryItems.length === 0) {
        this.channelEmptyNotice.set({
          taskName: taskName || 'Tarea de Apify',
          platform: task?.platform ? this.getNetworkLabel(task.platform) : 'Red Social',
          country: countryName
        });
      }
      this.isLoading.set(false);
    }).catch(err => {
      if (inMemoryItems.length === 0) {
        this.error.set(err?.message || 'Error consultando la ejecución en Apify.');
      }
      this.isLoading.set(false);
    });
  }

  onRunCountryChanged(event: { runId: string; newCountry: string }) {
    const marketCode: MarketCountryCode = event.newCountry === 'México' || event.newCountry === 'MX' ? 'MX' : 'COL';
    this.runsList.update(runs => runs.map(r =>
      r.id === event.runId ? ({ ...r, country: marketCode } as ApifyRunRecord) : r
    ));
    this.supabaseService.updateRunMetadata(event.runId, { country: marketCode }).subscribe();
  }

  fetchOmnichannelData() {
    this.activeRunId.set(null);
    this.resetState();
    this.isLoading.set(true);
    const currentMarket = this.selectedMarket();
    const currentCountry = currentMarket === 'MX' ? 'México' : 'Colombia';
    this.selectedCountry.set(currentCountry);

    this.apifyService.getOmnichannelLatestData(currentMarket).subscribe({
      next: (consolidatedData) => {
        if (consolidatedData && consolidatedData.length > 0) {
          this.processDataset(consolidatedData, 'omnicanal', currentCountry);
        } else {
          this.channelEmptyNotice.set({
            taskName: `Tareas oficiales de ${currentCountry}`,
            platform: 'Ecosistema Omnicanal',
            country: currentCountry
          });
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Error al obtener datos de las tareas de Apify.');
        this.isLoading.set(false);
      }
    });
  }

  private processDataset(rawData: any[], network: string, country: string) {
    const cleanData = this.standardizeData(rawData, network);
    this.data.set(cleanData);
    this.loadedNetwork.set(network);
    this.loadedCountry.set(country);

    const hasEngagement = cleanData.some(item =>
      item._kpi.postLikes > 0 || item._kpi.profileLikes > 0 ||
      (item.commentsCount && item.commentsCount > 0)
    );
    this.selectedMetric.set(hasEngagement ? 'total' : 'views');

    // Disparo automático de insights predictivos con Gemini AI
    setTimeout(() => this.triggerGeminiInsights(), 100);
  }

  applyFilter(metric: ChartMetric) {
    this.selectedMetric.set(metric);
  }

  changeKpiSort(metric: KpiSortOption) {
    this.kpiSortMetric.set(metric);
  }

  private resetState(keepNetwork: boolean = false) {
    this.error.set(null);
    this.channelEmptyNotice.set(null);
    this.data.set([]);
    this.filterStartDate.set('');
    this.filterEndDate.set('');
    this.gridBrandFilter.set('ALL');
    if (!keepNetwork) {
      this.gridNetworkFilter.set('ALL');
      this.activeRunId.set(null);
    }
    this.gridContentTypeFilter.set('ALL');
    this.gridSortMetric.set('date_desc');
  }
}
