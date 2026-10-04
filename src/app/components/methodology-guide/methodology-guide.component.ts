// src/app/components/methodology-guide/methodology-guide.component.ts
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DocSection {
  id: string;
  icon: string;
  label: string;
  badge?: string;
}

import { HugeIconComponent } from '../huge-icon/huge-icon.component';

@Component({
  selector: 'app-methodology-guide',
  standalone: true,
  imports: [CommonModule, HugeIconComponent],
  templateUrl: './methodology-guide.component.html',
  styleUrl: './methodology-guide.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()'
  }
})
export class MethodologyGuideComponent {
  isOpen = input<boolean>(false);
  initialTopic = input<string>('overview');

  closeModal = output<void>();

  activeSection = signal<string>('overview');

  sections: DocSection[] = [
    { id: 'overview', icon: 'dashboard', label: '1. Visión General del Sistema' },
    { id: 'data_sources', icon: 'cloud_sync', label: '2. Fuentes e Ingesta de Datos (Apify)', badge: 'API' },
    { id: 'metrics_calc', icon: 'calculate', label: '3. Fórmulas de Interacciones Base' },
    { id: 'engagement', icon: 'trending_up', label: '4. Cálculo del Engagement Rate' },
    { id: 'format_effectiveness', icon: 'view_carousel', label: '5. Efectividad por Formato' },
    { id: 'market_share', icon: 'pie_chart', label: '6. Cuota de Mercado (Share of Voice)' },
    { id: 'viral_content', icon: 'local_fire_department', label: '7. Algoritmo de Contenido Viral' },
    { id: 'api_dictionary', icon: 'code', label: '8. Diccionario Técnico de Campos JSON', badge: 'Técnico' }
  ];

  setTopic(topicId: string): void {
    if (this.sections.some(s => s.id === topicId)) {
      this.activeSection.set(topicId);
    }
  }

  onEscape(): void {
    if (this.isOpen()) {
      this.closeModal.emit();
    }
  }
}
