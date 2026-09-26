import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApifyRunRecord } from '../../services/apify.service';

export type SortableRunColumn = 'platform' | 'period' | 'status' | 'startedAt' | 'duration' | 'usageTotalUsd';
export type DrawerTab = 'overview' | 'params' | 'json';

@Component({
  selector: 'app-apify-runs-table',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './apify-runs-table.component.html',
  styleUrl: './apify-runs-table.component.scss',
  host: {
    '(document:keydown.escape)': 'handleEscape()'
  }
})
export class ApifyRunsTableComponent {
  // Datos de entrada reactivos
  private _rawRuns = signal<ApifyRunRecord[]>([]);

  @Input() set runsList(value: ApifyRunRecord[] | null | undefined) {
    this._rawRuns.set(value || []);
    if (this.currentPage() > this.totalPages()) {
      this.currentPage.set(1);
    }
  }
  get runsList(): ApifyRunRecord[] {
    return this._rawRuns();
  }

  // Mantenido por retrocompatibilidad de interfaz
  @Input() isAdmin: boolean = true;

  @Output() runSelected = new EventEmitter<{ runId: string; actorInternalId: string }>();
  @Output() countryChanged = new EventEmitter<{ runId: string; newCountry: string }>();

  // Estados de control y filtrado
  searchQuery = signal<string>('');
  selectedPlatform = signal<string>('ALL');
  statusFilter = signal<string>('ALL');

  // Ordenamiento
  sortColumn = signal<SortableRunColumn>('startedAt');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Paginación
  pageSize = signal<number>(10);
  currentPage = signal<number>(1);
  readonly pageSizeOptions = [10, 25, 50];

  // Drawer lateral deslizable
  activeDrawerRun = signal<ApifyRunRecord | null>(null);
  drawerTab = signal<DrawerTab>('overview');

  // Feedback temporal
  copiedField = signal<string | null>(null);

  handleEscape() {
    if (this.activeDrawerRun()) {
      this.closeDrawer();
    }
  }

  // Contador por red social
  getPlatformCount(platform: string): number {
    const runs = this._rawRuns();
    if (platform === 'ALL') return runs.length;
    return runs.filter(run => {
      const id = (run.actorId || '').toLowerCase();
      if (platform === 'instagram') return id.includes('instagram') || id === 'shu8hvrxbjby3eb9w';
      if (platform === 'facebook') return id.includes('facebook') || id === '4hv5rhchiadk6iwad' || id === 'kojrdxjcttpon81ky';
      if (platform === 'tiktok') return id.includes('tiktok') || id === '0fxvyoxxemdgcv88a' || id === 'gdwckxbtkwoskjdch' || id.includes('clockworks');
      if (platform === 'youtube') return id.includes('youtube') || id === 'h7sdv53cddomktsi5' || id.includes('streamers');
      return false;
    }).length;
  }

  getStatusCount(status: string): number {
    const runs = this._rawRuns();
    if (status === 'ALL') return runs.length;
    return runs.filter(r => (r.status || '').toUpperCase() === status).length;
  }

  // Filtrado reactivo multidimensional
  filteredRuns = computed(() => {
    let runs = this._rawRuns();
    const platform = this.selectedPlatform();
    const status = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();

    // 1. Filtro por Plataforma
    if (platform !== 'ALL') {
      runs = runs.filter(run => {
        const id = (run.actorId || '').toLowerCase();
        if (platform === 'instagram') return id.includes('instagram') || id === 'shu8hvrxbjby3eb9w';
        if (platform === 'facebook') return id.includes('facebook') || id === '4hv5rhchiadk6iwad' || id === 'kojrdxjcttpon81ky';
        if (platform === 'tiktok') return id.includes('tiktok') || id === '0fxvyoxxemdgcv88a' || id === 'gdwckxbtkwoskjdch' || id.includes('clockworks');
        if (platform === 'youtube') return id.includes('youtube') || id === 'h7sdv53cddomktsi5' || id.includes('streamers');
        return true;
      });
    }

    // 2. Filtro por Estado
    if (status !== 'ALL') {
      runs = runs.filter(run => (run.status || '').toUpperCase() === status);
    }

    // 3. Búsqueda en vivo global (ID, plataforma, actor, mercado, estado, fechas)
    if (query) {
      runs = runs.filter(run => {
        const id = (run.id || '').toLowerCase();
        const actor = (run.actorId || '').toLowerCase();
        const readableName = this.getPlatformName(run.actorId).toLowerCase();
        const st = (run.status || '').toLowerCase();
        const start = (run.startedAt || '').toLowerCase();
        const inputStart = (run.inputStartDate || '').toLowerCase();
        const inputEnd = (run.inputEndDate || '').toLowerCase();

        return id.includes(query) ||
               actor.includes(query) ||
               readableName.includes(query) ||
               st.includes(query) ||
               start.includes(query) ||
               inputStart.includes(query) ||
               inputEnd.includes(query) ||
               'colombia'.includes(query);
      });
    }

    return runs;
  });

  // Ordenamiento interactivo por columnas
  sortedRuns = computed(() => {
    const runs = [...this.filteredRuns()];
    const col = this.sortColumn();
    const dir = this.sortDirection();
    const multiplier = dir === 'asc' ? 1 : -1;

    runs.sort((a, b) => {
      switch (col) {
        case 'platform': {
          const nameA = this.getPlatformName(a.actorId).toLowerCase();
          const nameB = this.getPlatformName(b.actorId).toLowerCase();
          return nameA.localeCompare(nameB) * multiplier;
        }
        case 'period': {
          const pA = a.inputStartDate ? new Date(a.inputStartDate).getTime() : 0;
          const pB = b.inputStartDate ? new Date(b.inputStartDate).getTime() : 0;
          return (pA - pB) * multiplier;
        }
        case 'status': {
          const sA = (a.status || '').toLowerCase();
          const sB = (b.status || '').toLowerCase();
          return sA.localeCompare(sB) * multiplier;
        }
        case 'startedAt': {
          const tA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const tB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          return (tA - tB) * multiplier;
        }
        case 'duration': {
          const durA = this.getDurationMs(a.startedAt, a.finishedAt);
          const durB = this.getDurationMs(b.startedAt, b.finishedAt);
          return (durA - durB) * multiplier;
        }
        case 'usageTotalUsd': {
          const cA = Number(a.usageTotalUsd) || 0;
          const cB = Number(b.usageTotalUsd) || 0;
          return (cA - cB) * multiplier;
        }
        default:
          return 0;
      }
    });

    return runs;
  });

  // Paginación computada
  totalPages = computed(() => {
    const total = this.sortedRuns().length;
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  paginatedRuns = computed(() => {
    const list = this.sortedRuns();
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  paginationStartIndex = computed(() => {
    if (this.sortedRuns().length === 0) return 0;
    return (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize() + 1;
  });

  paginationEndIndex = computed(() => {
    return Math.min(
      Math.min(this.currentPage(), this.totalPages()) * this.pageSize(),
      this.sortedRuns().length
    );
  });

  // Páginas visibles para los botones numéricos
  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = Math.min(this.currentPage(), total);
    const pages: (number | '...')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('...');
    }

    pages.push(total);
    return pages;
  });

  // Controladores de interacción
  toggleSort(column: SortableRunColumn) {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set(column === 'startedAt' || column === 'usageTotalUsd' || column === 'duration' ? 'desc' : 'asc');
    }
  }

  filterPlatform(platform: string) {
    this.selectedPlatform.set(platform);
    this.currentPage.set(1);
  }

  onSearchChange(text: string) {
    this.searchQuery.set(text);
    this.currentPage.set(1);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  onStatusChange(status: string) {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  resetAllFilters() {
    this.searchQuery.set('');
    this.selectedPlatform.set('ALL');
    this.statusFilter.set('ALL');
    this.currentPage.set(1);
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  goToPage(page: number | '...') {
    if (page === '...') return;
    const clamped = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(clamped);
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  // Drawer
  openDrawer(run: ApifyRunRecord, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.activeDrawerRun.set(run);
    this.drawerTab.set('overview');
  }

  closeDrawer() {
    this.activeDrawerRun.set(null);
  }

  setDrawerTab(tab: DrawerTab) {
    this.drawerTab.set(tab);
  }

  loadRunFromDrawer(run: ApifyRunRecord) {
    if (run.status !== 'SUCCEEDED' && !run.id.startsWith('HYBRID')) {
      return;
    }
    this.runSelected.emit({ runId: run.id, actorInternalId: run.actorId });
    this.closeDrawer();
  }

  // Clic en cualquier parte de la fila: carga los datos en el Dashboard
  onSelectRun(run: ApifyRunRecord) {
    if (run.status !== 'SUCCEEDED' && !run.id.startsWith('HYBRID')) {
      // Si la corrida no es exitosa, abrimos el drawer para inspeccionar por qué falló
      this.openDrawer(run);
      return;
    }
    this.runSelected.emit({ runId: run.id, actorInternalId: run.actorId });
  }

  copyToClipboard(text: string, fieldKey: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.copiedField.set(fieldKey);
        setTimeout(() => {
          if (this.copiedField() === fieldKey) {
            this.copiedField.set(null);
          }
        }, 2000);
      }).catch(err => {
        console.error('Error al copiar al portapapeles:', err);
      });
    }
  }

  isHybrid(runId?: string): boolean {
    return !!runId && runId.startsWith('HYBRID|');
  }

  getHybridSubRuns(runId?: string): { postsRunId?: string; pagesRunId?: string } {
    if (!runId || !runId.startsWith('HYBRID|')) return {};
    const parts = runId.split('|');
    return {
      postsRunId: parts[1] && parts[1] !== 'none' ? parts[1] : undefined,
      pagesRunId: parts[2] && parts[2] !== 'none' ? parts[2] : undefined
    };
  }

  formatBytes(bytes?: number): string {
    if (!bytes || isNaN(bytes)) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  // Helpers de visualización y formateo
  getPlatformName(actorId: string): string {
    if (!actorId) return 'Desconocido';
    if (actorId.includes('facebook-posts') || actorId === 'KoJrdxJCTtpon81KY') return 'Facebook (Posts)';
    if (actorId.includes('facebook-pages') || actorId === '4Hv5RhChiaDk6iwad') return 'Facebook (Pages)';
    if (actorId.includes('instagram') || actorId === 'shu8hvrXbJbY3Eb9W') return 'Instagram (Perfiles)';
    if (actorId.includes('tiktok-profile') || actorId === 'clockworks/tiktok-profile-scraper') return 'TikTok (Perfiles)';
    if (actorId.includes('tiktok') || actorId === 'GdWCkxBtKWOsKjdch' || actorId === '0FXVyOXXEmdGcV88a') return 'TikTok';
    if (actorId.includes('youtube') || actorId === 'h7sDV53CddomktSi5') return 'YouTube (Canales)';
    if (actorId === 'Facebook (Consolidado)') return 'Facebook (Consolidado)';
    return actorId;
  }

  getPlatformIcon(actorId: string): string {
    if (!actorId) return '/assets/icons/omnichannel.svg';
    const id = actorId.toLowerCase();
    if (id.includes('youtube') || id === 'h7sdv53cddomktsi5') return '/assets/icons/youtube.svg';
    if (id.includes('tiktok') || id === '0fxvyoxxemdgcv88a' || id === 'gdwckxbtkwoskjdch') return '/assets/icons/tiktok.svg';
    if (id.includes('instagram') || id === 'shu8hvrxbjby3eb9w') return '/assets/icons/instagram.svg';
    if (id.includes('facebook') || id === '4hv5rhchiadk6iwad' || id === 'kojrdxjcttpon81ky') return '/assets/icons/facebook.svg';
    return '/assets/icons/omnichannel.svg';
  }

  getDurationMs(startedAt?: string, finishedAt?: string): number {
    if (!startedAt || !finishedAt) return 0;
    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();
    return isNaN(start) || isNaN(end) ? 0 : Math.max(0, end - start);
  }

  getDuration(startedAt?: string, finishedAt?: string): string {
    if (!startedAt || !finishedAt) return '-';
    const diff = this.getDurationMs(startedAt, finishedAt);
    if (diff === 0) return '0s';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  formatJson(item: any): string {
    try {
      return JSON.stringify(item, null, 2);
    } catch {
      return String(item);
    }
  }
}
