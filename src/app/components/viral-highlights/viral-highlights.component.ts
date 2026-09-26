// src/app/components/viral-highlights/viral-highlights.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ApifyChartService } from '../../services/apify-chart.service';

export interface ViralPostItem {
  id: string;
  rank: number;
  brand: string;
  brandColor: string;
  brandLogo: string | null;
  brandAvatar: string | null;
  network: string;
  postUrl: string | null;
  thumbnail: string | null;
  caption: string;
  format: string;
  dateStr: string;
  views: number;
  likes: number;
  comments: number;
  totalInteractions: number;
  metricValue: number;
  metricFormatted: string;
}

export interface CompetitorViralTab {
  brand: string;
  color: string;
  logo: string | null;
  avatar: string | null;
  postsCount: number;
  totalInteractions: number;
}

import { MetricInfoTooltipComponent } from '../metric-info-tooltip/metric-info-tooltip.component';

@Component({
  selector: 'app-viral-highlights',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MetricInfoTooltipComponent],
  templateUrl: './viral-highlights.component.html',
  styleUrl: './viral-highlights.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViralHighlightsComponent {
  private apifyChartService = inject(ApifyChartService);

  // Inputs reactivos
  data = input<any[]>([]);
  activeMetric = input<string>('total');
  loadedNetwork = input<string>('omnicanal');

  // Output para abrir guía metodológica
  openMethodology = output<string>();

  // Competidor seleccionado manualmente en las pestañas
  selectedBrand = signal<string>('');

  // Post activo para vista previa modal in-app
  previewModalPost = signal<ViralPostItem | null>(null);

  // Agrupación y lista de competidores disponibles
  competitorTabs = computed<CompetitorViralTab[]>(() => {
    const rawList = this.data();
    if (!rawList || rawList.length === 0) return [];

    const map: Record<string, { brand: string; color: string; logo: string | null; avatar: string | null; postsCount: number; totalInteractions: number }> = {};

    rawList.forEach(item => {
      const brand = this.apifyChartService.getNormalizedBrandName(item);
      if (brand === 'Embajadores / Creadores' || brand === 'Medios y Eventos B2B') return;

      const net = (this.loadedNetwork() === 'omnicanal' ? item.__network : this.loadedNetwork()) || item.__network || 'unknown';
      const inter = this.apifyChartService.getMetricValue(item, net, 'total');
      const avatar = item.ownerProfilePicUrl || item.channelAvatarUrl || item.authorMeta?.avatar || item.user?.profilePic || item.profilePicUrl || item.pageProfilePic || null;

      if (!map[brand]) {
        map[brand] = {
          brand,
          color: this.apifyChartService.getBrandColor(brand),
          logo: this.apifyChartService.getBrandLogo(brand),
          avatar,
          postsCount: 0,
          totalInteractions: 0
        };
      }

      map[brand].postsCount += 1;
      map[brand].totalInteractions += inter;
      if (!map[brand].avatar && avatar) {
        map[brand].avatar = avatar;
      }
    });

    return Object.values(map).sort((a, b) => b.totalInteractions - a.totalInteractions);
  });

  // Marca actualmente enfocada (con fallback inteligente a la primera marca de mayor impacto)
  activeBrand = computed<string>(() => {
    const tabs = this.competitorTabs();
    if (tabs.length === 0) return '';
    const current = this.selectedBrand();
    if (current && tabs.some(t => t.brand === current)) {
      return current;
    }
    return tabs[0].brand;
  });

  // Top 5 publicaciones virales para la marca activa
  topPosts = computed<ViralPostItem[]>(() => {
    const targetBrand = this.activeBrand();
    if (!targetBrand) return [];

    const rawList = this.data();
    const metric = this.activeMetric();
    const netContext = this.loadedNetwork();

    // Filtrar publicaciones de la marca seleccionada
    const brandPosts = rawList.filter(item => {
      const brand = this.apifyChartService.getNormalizedBrandName(item);
      return brand === targetBrand;
    });

    if (brandPosts.length === 0) return [];

    // Mapear con métricas y ordenar por activeMetric
    const mapped = brandPosts.map(item => {
      const net = (netContext === 'omnicanal' ? item.__network : netContext) || item.__network || 'unknown';
      const views = this.apifyChartService.getMetricValue(item, net, 'views');
      const likes = this.apifyChartService.getMetricValue(item, net, 'likes');
      const comments = this.apifyChartService.getMetricValue(item, net, 'comments');
      const totalInteractions = this.apifyChartService.getMetricValue(item, net, 'total');

      let metricVal = totalInteractions;
      if (metric === 'views') metricVal = views;
      else if (metric === 'likes') metricVal = likes;
      else if (metric === 'comments') metricVal = comments;

      const dateStr = this.extractFormattedDate(item);
      const thumbnail = this.extractThumbnail(item);
      const postUrl = this.extractPostUrl(item);
      const caption = this.extractCaption(item);
      const format = this.extractFormat(item, net);

      return {
        id: item.id || item.postId || item.shortCode || Math.random().toString(36).substring(7),
        rank: 0,
        brand: targetBrand,
        brandColor: this.apifyChartService.getBrandColor(targetBrand),
        brandLogo: this.apifyChartService.getBrandLogo(targetBrand),
        brandAvatar: item.ownerProfilePicUrl || item.channelAvatarUrl || item.authorMeta?.avatar || null,
        network: net,
        postUrl,
        thumbnail,
        caption,
        format,
        dateStr,
        views,
        likes,
        comments,
        totalInteractions,
        metricValue: metricVal,
        metricFormatted: this.formatCompact(metricVal)
      };
    });

    // Ordenar de mayor a menor y tomar los primeros 5
    mapped.sort((a, b) => b.metricValue - a.metricValue);

    return mapped.slice(0, 5).map((post, idx) => ({
      ...post,
      rank: idx + 1
    }));
  });

  // Métricas totales del Top 5 de la marca activa
  top5Summary = computed(() => {
    const posts = this.topPosts();
    if (posts.length === 0) return null;
    const totalViews = posts.reduce((acc, p) => acc + p.views, 0);
    const totalLikes = posts.reduce((acc, p) => acc + p.likes, 0);
    const totalComments = posts.reduce((acc, p) => acc + p.comments, 0);
    const totalInteractions = posts.reduce((acc, p) => acc + p.totalInteractions, 0);
    return {
      totalViews,
      totalLikes,
      totalComments,
      totalInteractions,
      viewsCompact: this.formatCompact(totalViews),
      likesCompact: this.formatCompact(totalLikes),
      commentsCompact: this.formatCompact(totalComments),
      interactionsCompact: this.formatCompact(totalInteractions)
    };
  });

  selectBrand(brandName: string): void {
    this.selectedBrand.set(brandName);
  }

  openPreviewModal(post: ViralPostItem): void {
    this.previewModalPost.set(post);
  }

  closePreviewModal(): void {
    this.previewModalPost.set(null);
  }

  getMetricLabel(metricKey: string): string {
    switch (metricKey) {
      case 'views': return 'Vistas';
      case 'likes': return 'Likes';
      case 'comments': return 'Comentarios';
      default: return 'Interacciones Totales';
    }
  }

  getNetworkIcon(net: string): string {
    const n = (net || '').toLowerCase();
    if (n.includes('instagram')) return '/assets/icons/instagram.svg';
    if (n.includes('tiktok')) return '/assets/icons/tiktok.svg';
    if (n.includes('youtube')) return '/assets/icons/youtube.svg';
    if (n.includes('facebook')) return '/assets/icons/facebook.svg';
    return '/assets/icons/omnichannel.svg';
  }

  private extractFormattedDate(item: any): string {
    const rawDate = item.time || item.timestamp || item.date || item.createTimeISO || item.createdAt || item.videoMeta?.createTime || item.createTime;
    if (!rawDate) return 'Fecha no disp.';

    let d: Date;
    if (typeof rawDate === 'number') {
      const ms = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
      d = new Date(ms);
    } else {
      d = new Date(rawDate);
    }

    if (isNaN(d.getTime())) return 'Fecha no disp.';

    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  }

  private extractThumbnail(item: any): string | null {
    return (
      item.displayUrl ||
      item.thumbnailUrl ||
      item.videoThumbnail ||
      item.coverImageUrl ||
      item.image ||
      item.imageUrl ||
      item.videoMeta?.coverUrl ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.high?.url ||
      item.images?.[0] ||
      null
    );
  }

  private extractPostUrl(item: any): string | null {
    if (item.url) return item.url;
    if (item.postUrl) return item.postUrl;
    if (item.webVideoUrl) return item.webVideoUrl;
    if (item.canonicalUrl) return item.canonicalUrl;
    if (item.link) return item.link;
    if (item.shortCode) return `https://www.instagram.com/p/${item.shortCode}/`;
    return null;
  }

  private extractCaption(item: any): string {
    const txt = item.caption || item.text || item.title || item.description || item.message || '';
    if (!txt) return 'Publicación sin texto descriptivo';
    return txt.trim();
  }

  private extractFormat(item: any, net: string): string {
    if (item.type) return item.type.toUpperCase();
    if (item.productType) return item.productType.toUpperCase();
    if (item.videoMeta || item.videoUrl || item.isVideo) return 'VIDEO / REEL';
    if (net === 'tiktok' || net === 'youtube') return 'VIDEO';
    if (item.images && item.images.length > 1) return 'CARRUSEL';
    return 'POST';
  }

  private formatCompact(val: number): string {
    if (!val || val === 0) return '0';
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(val);
  }
}
