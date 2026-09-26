// src/app/components/apify-viewer/apify-viewer.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApifyService, ApifyRunRecord, ApifyResponse, MarketCountry } from '../../services/apify.service';
import { ApifyChartService, ChartMetric } from '../../services/apify-chart.service';

import { ApifyDataGridComponent } from '../apify-data-grid/apify-data-grid.component';
import { ApifyRunsTableComponent } from '../apify-runs-table/apify-runs-table.component';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';
import { ViralHighlightsComponent } from '../viral-highlights/viral-highlights.component';
import { MetricInfoTooltipComponent } from '../metric-info-tooltip/metric-info-tooltip.component';
import { MethodologyGuideComponent } from '../methodology-guide/methodology-guide.component';

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
    MethodologyGuideComponent
  ],
  templateUrl: './apify-viewer.component.html',
  styleUrl: './apify-viewer.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeGridDropdowns()'
  }
})
export class ApifyViewerComponent implements OnInit {
  private apifyService = inject(ApifyService);
  public apifyChartService = inject(ApifyChartService);

  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  data = signal<any[]>([]);
  runsList = signal<ApifyRunRecord[]>([]);

  loadedNetwork = signal<string>('');
  loadedCountry = signal<string>('');

  selectedMetric = signal<ChartMetric>('total');
  kpiSortMetric = signal<KpiSortOption>('followers');

  selectedCountry = signal<MarketCountry>('Colombia');

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
    this.gridNetworkFilter.set(net);
    if (net === 'youtube') {
      this.gridContentTypeFilter.set('ALL');
    }
    this.closeGridDropdowns();
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
    this.loadHistory();
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

  isChannelActive(net: string): boolean {
    if (net === 'omnicanal') {
      return this.loadedNetwork() === 'omnicanal' && this.gridNetworkFilter() === 'ALL';
    }
    if (this.loadedNetwork() === 'omnicanal') {
      return this.gridNetworkFilter() === net;
    }
    return this.loadedNetwork() === net;
  }

  getChannelBadge(net: string): string {
    if (net === 'omnicanal') {
      if (this.loadedNetwork() === 'omnicanal') {
        const count = this.data().length;
        return count > 0 ? `${count} items` : 'Activo';
      }
      return 'Ecosistema';
    }
    if (this.loadedNetwork() === 'omnicanal') {
      const count = this.data().filter(d => (d.__network || '').toLowerCase().includes(net)).length;
      return count > 0 ? `${count}` : 'Live';
    }
    if (this.loadedNetwork() === net) {
      const count = this.data().length;
      return count > 0 ? `${count}` : 'Live';
    }
    return 'Live';
  }

  handleNavSelection(net: string) {
    if (net === 'omnicanal') {
      if (this.loadedNetwork() === 'omnicanal' && this.gridNetworkFilter() !== 'ALL') {
        this.gridNetworkFilter.set('ALL');
      } else {
        this.fetchOmnichannelData();
      }
    } else {
      this.filterOrLoadNetwork(net);
    }
  }

  filterOrLoadNetwork(net: string) {
    if (this.loadedNetwork() === 'omnicanal') {
      const current = this.gridNetworkFilter();
      this.gridNetworkFilter.set(current === net ? 'ALL' : net);
      return;
    }

    const currentCountry = this.selectedCountry();
    const runs = this.runsList();

    let targetRun: ApifyRunRecord | undefined;
    if (net === 'facebook') {
      targetRun = runs.find(r => (!r.country || r.country === currentCountry) && (r.id.startsWith('HYBRID|') || r.actorId.includes('facebook') || r.actorId === 'KoJrdxJCTtpon81KY' || r.actorId === '4Hv5RhChiaDk6iwad'))
        || runs.find(r => r.id.startsWith('HYBRID|') || r.actorId.includes('facebook') || r.actorId === 'KoJrdxJCTtpon81KY');
    } else if (net === 'instagram') {
      targetRun = runs.find(r => (!r.country || r.country === currentCountry) && (r.actorId.includes('instagram') || r.actorId === 'shu8hvrXbJbY3Eb9W'))
        || runs.find(r => r.actorId.includes('instagram') || r.actorId === 'shu8hvrXbJbY3Eb9W');
    } else if (net === 'tiktok') {
      targetRun = runs.find(r => (!r.country || r.country === currentCountry) && (r.actorId.includes('tiktok') || r.actorId === '0FXVyOXXEmdGcV88a' || r.actorId === 'GdWCkxBtKWOsKjdch'))
        || runs.find(r => r.actorId.includes('tiktok'));
    } else if (net === 'youtube') {
      targetRun = runs.find(r => (!r.country || r.country === currentCountry) && (r.actorId.includes('youtube') || r.actorId === 'h7sDV53CddomktSi5' || r.actorId.includes('streamers')))
        || runs.find(r => r.actorId.includes('youtube'));
    }

    if (targetRun) {
      this.loadSpecificRun(targetRun.id, targetRun.actorId);
    } else {
      this.resetState();
      this.isLoading.set(true);
      const fallbackActors: Record<string, string> = {
        'instagram': 'shu8hvrXbJbY3Eb9W',
        'facebook': 'KoJrdxJCTtpon81KY',
        'tiktok': '0FXVyOXXEmdGcV88a',
        'youtube': 'streamers/youtube-scraper'
      };
      const actorId = fallbackActors[net] || net;
      this.apifyService.executeScraper({ action: 'get-latest', actorId, country: currentCountry }).subscribe({
        next: (res) => {
          if (res.success && res.data && res.data.length > 0) {
            this.processDataset(res.data, net, currentCountry);
          } else {
            this.error.set(`No se encontraron datos recientes para ${net} en ${currentCountry}.`);
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || `Error al obtener datos de ${net}.`);
          this.isLoading.set(false);
        }
      });
    }
  }

  // ==========================================
  // MOTOR REACTIVO PRINCIPAL
  // ==========================================

  filteredData = computed(() => {
    let currentData = this.data();
    const networkFilter = this.gridNetworkFilter();

    // Sincronización Global: Si estamos en Visión Omnicanal y se filtra una red,
    // se recalcula todo el dashboard (KPIs, gráficas analíticas y tablas) para esa red:
    if (this.loadedNetwork() === 'omnicanal' && networkFilter !== 'ALL') {
      currentData = currentData.filter(item => (item.__network || '').toLowerCase().includes(networkFilter.toLowerCase()));
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
  // MOTOR REACTIVO ESPECÍFICO PARA EL GRID
  // ==========================================

  availableBrands = computed(() => {
    const data = this.filteredData();
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
    let data = [...this.filteredData()];
    const brandFilter = this.gridBrandFilter();
    const networkFilter = this.gridNetworkFilter();
    const contentTypeFilter = this.gridContentTypeFilter();
    const sortOption = this.gridSortMetric();

    if (networkFilter !== 'ALL') {
      data = data.filter(item => item.__network === networkFilter);
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
    const data = this.filteredData();
    const net = this.loadedNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildChartOptions(net, data, this.selectedMetric());
  });

  marketShareChartOptions = computed(() => {
    const data = this.filteredData();
    const net = this.loadedNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildMarketShareChart(net, data, this.selectedMetric());
  });

  performanceChartOptions = computed(() => {
    const data = this.filteredData();
    const net = this.loadedNetwork();
    if (!data.length || !net || net === 'omnicanal') return null;
    return this.apifyChartService.buildPerformanceScatterChart(net, data);
  });

  masterChartOptions = computed(() => {
    const data = this.filteredData();
    const net = this.loadedNetwork();
    if (!data.length || net !== 'omnicanal') return null;
    return this.apifyChartService.buildMasterOmnichannelChart(data, this.selectedMetric());
  });

  engagementChartOptions = computed(() => {
    const data = this.filteredData();
    const net = this.loadedNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildEngagementRateChart(net, data);
  });

  formatPerformanceChartOptions = computed(() => {
    const data = this.filteredData();
    const net = this.loadedNetwork();
    if (!data.length || !net) return null;
    return this.apifyChartService.buildContentTypePerformanceChart(net, data);
  });

  omnichannelStats = computed(() => {
    const currentData = this.data();
    if (this.loadedNetwork() !== 'omnicanal' || !currentData.length) return null;

    const startStr = this.filterStartDate();
    const endStr = this.filterEndDate();
    const startMs = startStr ? new Date(startStr + 'T00:00:00').getTime() : 0;
    const endMs = endStr ? new Date(endStr + 'T23:59:59').getTime() : Infinity;

    let instagram = 0;
    let tiktok = 0;
    let youtube = 0;
    let facebook = 0;

    currentData.forEach(item => {
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

      const net = (item.__network || '').toLowerCase();
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
    if (this.loadedNetwork() !== 'omnicanal' || !data.length) return [];

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
          totalLikes += (stats.profileLikes > 0 ? stats.profileLikes : stats.postLikesSum);
          totalViews += (stats.profileViews > 0 ? stats.profileViews : stats.postViewsSum);
          totalPosts += (stats.profilePosts > 0 ? stats.profilePosts : stats.postCountSum);
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
            ownerFullName: item.ownerFullName || item.ownerUsername || item.owner?.username || 'Desconocido',
            ownerUsername: item.ownerUsername || item.owner?.username || 'Desconocido',
            ownerProfilePicUrl: item.ownerProfilePicUrl || item.owner?.profile_pic_url,
            __network: 'instagram',
            _contentType: uType,
            _duration: this.formatDuration(item.videoDuration || item.duration),
            _kpi: {
              followers: item.followersCount || item.owner?.followersCount || 0,
              profileLikes: 0,
              postLikes: item.likesCount || 0,
              profileViews: 0,
              postViews: item.videoViewCount || item.viewCount || item.playCount || 0,
              profilePosts: 0,
              postCount: 1
            }
          });
        }
      }
      else if (net === 'tiktok') {
        processed.push({
          ...item,
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
             profilePosts: item.authorMeta?.video || item.authorStats?.videoCount || 0, postCount: 1
          }
        });
      }
      else if (net === 'facebook') {
        const isPost = !!item.postId || item.text !== undefined;
        processed.push({
          ...item,
          ownerFullName: isPost ? (item.user?.name || item.pageName) : (item.title || item.pageName),
          ownerUsername: item.pageName,
          ownerProfilePicUrl: isPost ? item.user?.profilePic : item.profilePictureUrl,
          url: isPost ? (item.url || item.topLevelUrl) : (item.pageUrl || item.facebookUrl),
          __network: 'facebook',
          _contentType: uType,
          _duration: this.formatDuration(item.duration || item.video_duration),
          _kpi: {
             followers: isPost ? 0 : (item.followers || item.likes || 0),
             profileLikes: 0, postLikes: isPost ? (item.likes || item.reactionLikeCount || 0) : 0,
             profileViews: 0, postViews: isPost ? (item.viewsCount || item.videoPostViewCount || 0) : 0,
             profilePosts: 0, postCount: isPost ? 1 : 0
          }
        });
      }
      else if (net === 'youtube') {
        const isVideo = item.type === 'video' || item.videoId || item.url?.includes('watch');
        processed.push({
          ...item,
          ownerFullName: item.channelName || item.aboutChannelInfo?.channelName,
          ownerUsername: item.channelUsername || item.aboutChannelInfo?.channelUsername,
          ownerProfilePicUrl: item.channelAvatarUrl || item.aboutChannelInfo?.channelAvatarUrl,
          __network: 'youtube',
          _contentType: uType,
          _duration: this.formatDuration(item.duration),
          _kpi: {
             followers: item.numberOfSubscribers || item.aboutChannelInfo?.numberOfSubscribers || 0,
             profileLikes: 0,
             postLikes: item.likes || 0,
             profileViews: item.channelTotalViews || item.aboutChannelInfo?.channelTotalViews || 0,
             postViews: item.viewCount || 0,
             profilePosts: item.channelTotalVideos || item.aboutChannelInfo?.channelTotalVideos || 0,
             postCount: isVideo ? 1 : 0
          }
        });
      }
      else {
        processed.push({
          ...item, __network: net, _contentType: 'unknown',
          _kpi: { followers: item.followersCount || 0, profileLikes: 0, postLikes: 0, profileViews: 0, postViews: 0, profilePosts: item.postsCount || 0, postCount: 1 }
        });
      }
    });

    return processed;
  }

  // ==========================================
  // CARGA DE DATOS Y EVENTOS
  // ==========================================

  loadHistory() {
    this.resetState();
    this.isLoading.set(true);

    this.apifyService.executeScraper({ action: 'list-runs' }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const allRuns = response.data as ApifyRunRecord[];

          const fbPosts = allRuns.filter(r => r.actorId === 'KoJrdxJCTtpon81KY' || r.actorId === 'apify/facebook-posts-scraper');
          const fbPages = allRuns.filter(r => r.actorId === '4Hv5RhChiaDk6iwad' || r.actorId === 'apify/facebook-pages-scraper');

          const otherRuns = allRuns.filter(r =>
            r.actorId !== 'KoJrdxJCTtpon81KY' && r.actorId !== 'apify/facebook-posts-scraper' &&
            r.actorId !== '4Hv5RhChiaDk6iwad' && r.actorId !== 'apify/facebook-pages-scraper'
          );

          const finalRuns = [...otherRuns];

          if (fbPosts.length > 0 || fbPages.length > 0) {
            const latestPost = fbPosts[0] || null;
            const latestPage = fbPages[0] || null;

            finalRuns.push({
              id: `HYBRID|${latestPost?.id || 'none'}|${latestPage?.id || 'none'}`,
              actorId: 'Facebook (Consolidado)',
              status: (latestPost?.status === 'SUCCEEDED' || latestPage?.status === 'SUCCEEDED') ? 'SUCCEEDED' : 'FAILED',
              startedAt: latestPost?.startedAt || latestPage?.startedAt || new Date().toISOString(),
              finishedAt: latestPost?.finishedAt || latestPage?.finishedAt || new Date().toISOString(),
              usageTotalUsd: (latestPost?.usageTotalUsd || 0) + (latestPage?.usageTotalUsd || 0),
              country: latestPost?.country || latestPage?.country || 'Colombia',
              inputStartDate: latestPost?.inputStartDate,
              inputEndDate: latestPost?.inputEndDate
            });
          }

          finalRuns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
          this.runsList.set(finalRuns);
        } else {
          this.error.set('No se pudo recuperar el historial de ejecuciones.');
        }
        this.isLoading.set(false);
      },
      error: (err) => { this.error.set(err.message); this.isLoading.set(false); }
    });
  }

  loadSpecificRun(runId: string, actorInternalId: string) {
    this.resetState();
    this.isLoading.set(true);

    const historyRun = this.runsList().find(r => r.id === runId);
    const runCountry = historyRun?.country || 'Colombia';
    this.selectedCountry.set(runCountry as MarketCountry);

    if (runId.startsWith('HYBRID|')) {
      const parts = runId.split('|');
      const postsRunId = parts[1];
      const pagesRunId = parts[2];
      const reqs = [];

      if (postsRunId && postsRunId !== 'none') {
        reqs.push(this.apifyService.executeScraper({ action: 'get-run-data', actorId: 'KoJrdxJCTtpon81KY', runId: postsRunId })
          .pipe(catchError(() => of({ success: true, data: [] } as ApifyResponse))));
      }
      if (pagesRunId && pagesRunId !== 'none') {
        reqs.push(this.apifyService.executeScraper({ action: 'get-run-data', actorId: '4Hv5RhChiaDk6iwad', runId: pagesRunId })
          .pipe(catchError(() => of({ success: true, data: [] } as ApifyResponse))));
      }

      if (reqs.length === 0) {
        this.error.set('No hay IDs de ejecución válidos para Facebook.');
        this.isLoading.set(false);
        return;
      }

      forkJoin(reqs).subscribe(results => {
        const combined = results.map(r => r.data || []).flat();
        if (combined.length > 0) {
          this.processDataset(combined, 'facebook', runCountry);
        } else {
          this.error.set('No se pudo recuperar el dataset híbrido.');
        }
        this.isLoading.set(false);
      });
      return;
    }

    let targetActorId = actorInternalId;
    let network = 'instagram';

    const reverseActorMap: Record<string, string> = {
      'KoJrdxJCTtpon81KY': 'apify/facebook-posts-scraper',
      '4Hv5RhChiaDk6iwad': 'apify/facebook-pages-scraper',
      'shu8hvrXbJbY3Eb9W': 'apify/instagram-scraper',
      'GdWCkxBtKWOsKjdch': 'clockworks/tiktok-scraper',
      '0FXVyOXXEmdGcV88a': 'clockworks/tiktok-scraper',
      'h7sDV53CddomktSi5': 'streamers/youtube-scraper',
      'nFJndFXA5zjCTuudP': 'apify/google-search-scraper'
    };

    if (reverseActorMap[actorInternalId]) targetActorId = reverseActorMap[actorInternalId];
    if (targetActorId.includes('facebook')) network = 'facebook';
    if (targetActorId.includes('tiktok')) network = 'tiktok';
    if (targetActorId.includes('youtube')) network = 'youtube';

    this.apifyService.executeScraper({ action: 'get-run-data', actorId: targetActorId, runId }).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.length > 0) {
          const sample = response.data[0];
          if (sample.facebookUrl || sample.pageUrl) network = 'facebook';
          if (sample.channelName && sample.channelTotalVideos) network = 'youtube';

          this.processDataset(response.data, network, runCountry);
        } else {
          this.error.set('No se pudo recuperar el dataset.');
        }
        this.isLoading.set(false);
      },
      error: (err) => { this.error.set(err.message); this.isLoading.set(false); }
    });
  }

  // FIX: Type Assertion aplicado para evitar errores de tipado estricto
  onRunCountryChanged(event: {runId: string, newCountry: string}) {
    // 1. Optimistic UI Update: Actualizamos la tabla visualmente al instante
    this.runsList.update(runs => runs.map(r =>
      r.id === event.runId ? ({ ...r, country: event.newCountry as MarketCountry } as ApifyRunRecord) : r
    ));

    // 2. Persistencia en Supabase
    if ((this.apifyService as any).updateRunCountry) {
      (this.apifyService as any).updateRunCountry(event.runId, event.newCountry).subscribe({
        error: () => {
          this.error.set('No se pudo guardar el mercado en Supabase. Se revertirá al recargar.');
        }
      });
    } else {
      console.warn('Backend Reminder: Falta implementar el método updateRunCountry en apify.service.ts para guardar en Supabase.');
    }
  }

  fetchOmnichannelData() {
    this.resetState();
    this.isLoading.set(true);
    const currentCountry = this.selectedCountry();

    // 1. Buscamos en la lista de ejecuciones existentes las que corresponden al mercado seleccionado
    const currentRuns = this.runsList();
    const specificRuns: { net: string; runId: string }[] = [];

    // Facebook (híbrido o posts + páginas)
    const fbHybrid = currentRuns.find(r => r.country === currentCountry && r.id.startsWith('HYBRID|'));
    if (fbHybrid) {
      const parts = fbHybrid.id.split('|');
      if (parts[1] && parts[1] !== 'none') specificRuns.push({ net: 'facebook', runId: parts[1] });
      if (parts[2] && parts[2] !== 'none') specificRuns.push({ net: 'facebook', runId: parts[2] });
    } else {
      const fbPosts = currentRuns.find(r => r.country === currentCountry && (r.actorId === 'KoJrdxJCTtpon81KY' || r.actorId.includes('facebook-posts')));
      const fbPages = currentRuns.find(r => r.country === currentCountry && (r.actorId === '4Hv5RhChiaDk6iwad' || r.actorId.includes('facebook-pages')));
      if (fbPosts) specificRuns.push({ net: 'facebook', runId: fbPosts.id });
      if (fbPages) specificRuns.push({ net: 'facebook', runId: fbPages.id });
    }

    // Instagram
    const igRun = currentRuns.find(r => r.country === currentCountry && (r.actorId === 'shu8hvrXbJbY3Eb9W' || r.actorId.includes('instagram')));
    if (igRun) specificRuns.push({ net: 'instagram', runId: igRun.id });

    // TikTok
    const ttRun = currentRuns.find(r => r.country === currentCountry && (r.actorId === '0FXVyOXXEmdGcV88a' || r.actorId === 'GdWCkxBtKWOsKjdch' || r.actorId.includes('tiktok')));
    if (ttRun) specificRuns.push({ net: 'tiktok', runId: ttRun.id });

    // YouTube
    const ytRun = currentRuns.find(r => r.country === currentCountry && (r.actorId === 'h7sDV53CddomktSi5' || r.actorId.includes('youtube')));
    if (ytRun) specificRuns.push({ net: 'youtube', runId: ytRun.id });

    this.apifyService.getOmnichannelLatestData(currentCountry, specificRuns.length > 0 ? specificRuns : undefined).subscribe({
      next: (consolidatedData) => {
        if (consolidatedData && consolidatedData.length > 0) {
          this.processDataset(consolidatedData, 'omnicanal', currentCountry);
        } else {
          this.error.set(`No se pudieron consolidar datos para el mercado ${currentCountry}.`);
        }
        this.isLoading.set(false);
      },
      error: (err) => { this.error.set(err.message); this.isLoading.set(false); }
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
  }

  applyFilter(metric: ChartMetric) {
    this.selectedMetric.set(metric);
  }

  changeKpiSort(metric: KpiSortOption) {
    this.kpiSortMetric.set(metric);
  }

  private resetState() {
    this.error.set(null);
    this.data.set([]);
    this.filterStartDate.set('');
    this.filterEndDate.set('');
    this.gridBrandFilter.set('ALL');
    this.gridNetworkFilter.set('ALL');
    this.gridContentTypeFilter.set('ALL');
    this.gridSortMetric.set('date_desc');
  }
}
