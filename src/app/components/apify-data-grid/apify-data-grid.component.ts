import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApifyChartService } from '../../services/apify-chart.service';

@Component({
  selector: 'app-apify-data-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './apify-data-grid.component.html',
  styleUrl: './apify-data-grid.component.scss'
})
export class ApifyDataGridComponent {
  private apifyChartService = inject(ApifyChartService);

  @Input({ required: true }) data: any[] = [];
  @Input({ required: true }) network: string = 'youtube';

  getBrandInfo(item: any): { name: string; logoUrl: string; color: string } {
    const name = this.apifyChartService.getNormalizedBrandName(item);
    return {
      name,
      logoUrl: this.apifyChartService.getBrandLogo(name),
      color: this.apifyChartService.getBrandColor(name)
    };
  }

  getNetworkIcon(net: string): string {
    const n = (net || '').toLowerCase();
    if (n.includes('instagram')) return '/assets/icons/instagram.svg';
    if (n.includes('facebook')) return '/assets/icons/facebook.svg';
    if (n.includes('tiktok')) return '/assets/icons/tiktok.svg';
    if (n.includes('youtube')) return '/assets/icons/youtube.svg';
    return '/assets/icons/omnichannel.svg';
  }

  // ==========================================
  // HELPER: DETECTOR DE RED DINÁMICO
  // ==========================================
  private getItemNetwork(item: any): string {
    // Si el grid está en modo omnicanal, busca el origen real del post; si no, usa el global
    return this.network === 'omnicanal' ? (item.__network || 'unknown') : this.network;
  }

  getYouTubeId(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  handleImageError(event: any, videoId: string | null, imgEl?: HTMLElement, fallbackEl?: HTMLElement) {
    if (videoId && event?.target?.src && event.target.src.includes('maxresdefault')) {
      event.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return;
    }
    if (imgEl) {
      imgEl.style.display = 'none';
    }
    if (fallbackEl) {
      fallbackEl.style.display = 'flex';
    }
  }

  // ==========================================
  // ADAPTERS DE NORMALIZACIÓN DE DATOS
  // ==========================================

  getAuthorName(item: any): string {
    return item.ownerFullName || item.channelName || item.pageName || item.authorMeta?.name || item.ownerUsername || item.user?.name || 'Competidor';
  }

  getMediaThumbnail(item: any): string | null {
    if (!item) return null;
    const net = this.getItemNetwork(item);
    let rawUrl: string | null = null;

    if (net === 'youtube') {
      if (item.thumbnailUrl) rawUrl = item.thumbnailUrl;
      else {
        const id = this.getYouTubeId(item.url);
        rawUrl = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
      }
    } else if (net === 'facebook') {
      if (item.media && Array.isArray(item.media)) {
        const validMedia = item.media.find((m: any) => m.thumbnail || m.image?.uri || m.photo_image?.uri);
        if (validMedia) {
          rawUrl = validMedia.thumbnail || validMedia.image?.uri || validMedia.photo_image?.uri;
        }
      }
      if (!rawUrl) rawUrl = item.displayUrl || item.thumbnailUrl || item.imageUrl || null;
    } else if (net === 'instagram') {
      rawUrl = item.displayUrl || item.thumbnailUrl || item.imageUrl || (item.images && item.images[0]) || null;
    } else if (net === 'tiktok') {
      rawUrl = item.videoMeta?.coverUrl || item.coverUrl || item.authorMeta?.avatar || item.imageUrl || null;
    } else {
      rawUrl = item.displayUrl || item.thumbnailUrl || item.videoMeta?.coverUrl || item.coverUrl || (item.images && item.images[0]) || null;
    }

    return this.apifyChartService.getProxiedImageUrl(rawUrl);
  }

  getBrandGradient(brandName: string): string {
    return this.apifyChartService.getBrandGradient(brandName);
  }

  getPostExcerpt(item: any, maxLen = 85): string {
    const raw = item.caption || item.text || item.title || item.cleanText || '';
    if (!raw) return 'Publicación visual auditada sin texto descriptivo';
    const clean = raw.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.substring(0, maxLen).trim() + '...';
  }

  getPostTitle(item: any): string {
    const net = this.getItemNetwork(item);

    if (item.caption) return item.caption;
    if (item.title) return item.title;
    if (item.text) return item.text;

    if (net === 'facebook' && item.media && item.media.length > 0) {
      const firstMedia = item.media[0];
      const errorText = firstMedia.title_with_entities?.text || '';
      if (errorText.includes("isn't available") || errorText.includes("no está disponible") || errorText.includes("deleted")) {
        return '🚫 Contenido no disponible (Privado o Eliminado)';
      }
    }

    return 'Contenido visual sin texto descriptivo';
  }

  getPostDate(item: any): Date {
    const rawDate = item.timestamp || item.time || item.date || item.createTimeISO || item.createdAt || item.videoMeta?.createTime;
    if (item.createTime && typeof item.createTime === 'number') {
       return new Date(item.createTime * 1000);
    }
    if (typeof rawDate === 'number' && rawDate < 10000000000) {
      return new Date(rawDate * 1000);
    }
    return rawDate ? new Date(rawDate) : new Date();
  }

  getFormattedDuration(item: any): string | null {
    const net = this.getItemNetwork(item);

    if (net === 'youtube' && item.duration) return item.duration;

    let seconds = 0;
    if (net === 'tiktok' && item.videoMeta?.duration) {
      seconds = item.videoMeta.duration;
    } else if (net === 'instagram' && item.videoDuration) {
      seconds = Math.round(item.videoDuration);
    } else {
      return null;
    }

    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
