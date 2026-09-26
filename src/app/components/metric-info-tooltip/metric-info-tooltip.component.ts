// src/app/components/metric-info-tooltip/metric-info-tooltip.component.ts
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MetricDocInfo {
  title: string;
  definition: string;
  formula: string;
  fieldsUsed: string[];
  topicId: string;
}

@Component({
  selector: 'app-metric-info-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-info-tooltip.component.html',
  styleUrl: './metric-info-tooltip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'isOpen.set(false)'
  }
})
export class MetricInfoTooltipComponent {
  title = input<string>('Información metodológica');
  definition = input<string>('');
  formula = input<string>('');
  fieldsUsed = input<string[]>([]);
  topicId = input<string>('metrics');

  openFullDoc = output<string>();

  isOpen = signal<boolean>(false);

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  onDocClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openFullDoc.emit(this.topicId());
    this.isOpen.set(false);
  }
}
