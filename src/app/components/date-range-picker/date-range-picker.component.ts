import { Component, Input, Output, EventEmitter, signal, computed, ElementRef, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

export interface CalendarDay {
  date: Date;
  dateStr: string; // 'YYYY-MM-DD'
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isStart: boolean;
  isEnd: boolean;
  isInRange: boolean;
  isHovered: boolean;
}

export type PresetKey = 'all' | '7d' | '14d' | '30d' | 'this_month' | 'last_month' | 'custom';

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()'
  }
})
export class DateRangePickerComponent {
  private elementRef = inject(ElementRef);

  @Input() set startDate(val: string) {
    this._startDate.set(val || '');
    this.tempStartDate.set(val || null);
    this.updateActivePresetFromDates();
  }
  @Input() set endDate(val: string) {
    this._endDate.set(val || '');
    this.tempEndDate.set(val || null);
    this.updateActivePresetFromDates();
  }

  @Output() rangeChange = new EventEmitter<{ startDate: string; endDate: string }>();
  @Output() clear = new EventEmitter<void>();

  // Fechas confirmadas
  _startDate = signal<string>('');
  _endDate = signal<string>('');

  // Fechas en borrador mientras el usuario selecciona en el calendario
  tempStartDate = signal<string | null>(null);
  tempEndDate = signal<string | null>(null);
  hoverDate = signal<string | null>(null);

  isOpen = signal<boolean>(false);
  activePreset = signal<PresetKey>('all');

  // Mes de vista (primer mes de los 2 visibles)
  viewMonthDate = signal<Date>(this.getInitialViewMonth());

  // Nombres de los días de la semana
  readonly weekDays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  private getInitialViewMonth(): Date {
    const today = new Date();
    // Iniciar con el mes actual o el mes de la fecha de fin
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  // Mes 1 y Mes 2
  firstMonthDate = computed(() => this.viewMonthDate());
  secondMonthDate = computed(() => {
    const d = this.viewMonthDate();
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  });

  // Títulos de meses
  firstMonthTitle = computed(() => {
    return this.getMonthTitle(this.firstMonthDate());
  });

  secondMonthTitle = computed(() => {
    return this.getMonthTitle(this.secondMonthDate());
  });

  // Días generados para el primer mes
  firstMonthDays = computed(() => {
    return this.generateMonthDays(this.firstMonthDate());
  });

  // Días generados para el segundo mes
  secondMonthDays = computed(() => {
    return this.generateMonthDays(this.secondMonthDate());
  });

  // Texto amigable del rango para el botón disparador
  displayRangeLabel = computed(() => {
    const start = this._startDate();
    const end = this._endDate();

    if (!start && !end) {
      return 'Todo el histórico';
    }

    if (start && end) {
      const s = this.formatShortDate(start);
      const e = this.formatShortDate(end);
      return `${s} — ${e}`;
    }

    if (start) {
      return `Desde ${this.formatShortDate(start)}`;
    }

    return `Hasta ${this.formatShortDate(end)}`;
  });

  hasActiveFilter = computed(() => {
    return !!this._startDate() || !!this._endDate();
  });

  // Apertura y Cierre
  toggleDropdown() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.tempStartDate.set(this._startDate() || null);
    this.tempEndDate.set(this._endDate() || null);
    this.hoverDate.set(null);

    // Centrar la vista en el mes seleccionado si existe
    if (this._endDate()) {
      const endD = new Date(this._endDate() + 'T00:00:00');
      if (!isNaN(endD.getTime())) {
        // Ponemos el mes previo al de fin para que ambos meses sean visibles
        this.viewMonthDate.set(new Date(endD.getFullYear(), endD.getMonth() - 1, 1));
      }
    } else {
      const now = new Date();
      this.viewMonthDate.set(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    }

    this.updateActivePresetFromDates();
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.hoverDate.set(null);
  }

  onDocumentClick(event: MouseEvent) {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  onEscape() {
    if (this.isOpen()) {
      this.close();
    }
  }

  // Navegación de meses
  prevMonth() {
    const cur = this.viewMonthDate();
    this.viewMonthDate.set(new Date(cur.getFullYear(), cur.getMonth() - 1, 1));
  }

  nextMonth() {
    const cur = this.viewMonthDate();
    this.viewMonthDate.set(new Date(cur.getFullYear(), cur.getMonth() + 1, 1));
  }

  // Selección de días en el calendario
  onDayClick(day: CalendarDay) {
    const dateStr = day.dateStr;
    const start = this.tempStartDate();
    const end = this.tempEndDate();

    // Si no hay fecha inicial o ya había un rango completo definido, comenzar nuevo rango
    if (!start || (start && end)) {
      this.tempStartDate.set(dateStr);
      this.tempEndDate.set(null);
      this.activePreset.set('custom');
      return;
    }

    // Ya tenemos fecha de inicio: comparar con la fecha seleccionada
    const startMs = new Date(start + 'T00:00:00').getTime();
    const clickedMs = new Date(dateStr + 'T00:00:00').getTime();

    if (clickedMs < startMs) {
      // Si hizo clic antes de la fecha de inicio, la nueva fecha pasa a ser el inicio
      this.tempStartDate.set(dateStr);
      this.tempEndDate.set(start);
    } else {
      this.tempEndDate.set(dateStr);
    }

    this.activePreset.set('custom');
  }

  onDayHover(day: CalendarDay) {
    if (this.tempStartDate() && !this.tempEndDate()) {
      this.hoverDate.set(day.dateStr);
    }
  }

  onGridMouseLeave() {
    this.hoverDate.set(null);
  }

  // Presets Rápidos
  selectPreset(preset: PresetKey) {
    this.activePreset.set(preset);
    const today = new Date();

    switch (preset) {
      case 'all':
        this.tempStartDate.set(null);
        this.tempEndDate.set(null);
        break;

      case '7d': {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        this.tempStartDate.set(this.formatIso(start));
        this.tempEndDate.set(this.formatIso(today));
        this.viewMonthDate.set(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        break;
      }

      case '14d': {
        const start = new Date(today);
        start.setDate(today.getDate() - 13);
        this.tempStartDate.set(this.formatIso(start));
        this.tempEndDate.set(this.formatIso(today));
        this.viewMonthDate.set(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        break;
      }

      case '30d': {
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
        this.tempStartDate.set(this.formatIso(start));
        this.tempEndDate.set(this.formatIso(today));
        this.viewMonthDate.set(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        break;
      }

      case 'this_month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        this.tempStartDate.set(this.formatIso(start));
        this.tempEndDate.set(this.formatIso(today));
        this.viewMonthDate.set(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        break;
      }

      case 'last_month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        this.tempStartDate.set(this.formatIso(start));
        this.tempEndDate.set(this.formatIso(end));
        this.viewMonthDate.set(new Date(start.getFullYear(), start.getMonth() - 1, 1));
        break;
      }
    }
  }

  // Acciones de pie
  apply() {
    const s = this.tempStartDate() || '';
    const e = this.tempEndDate() || this.tempStartDate() || '';

    this._startDate.set(s);
    this._endDate.set(e);
    this.rangeChange.emit({ startDate: s, endDate: e });
    this.close();
  }

  cancel() {
    this.tempStartDate.set(this._startDate() || null);
    this.tempEndDate.set(this._endDate() || null);
    this.close();
  }

  onClearClick(event: MouseEvent) {
    event.stopPropagation();
    this._startDate.set('');
    this._endDate.set('');
    this.tempStartDate.set(null);
    this.tempEndDate.set(null);
    this.activePreset.set('all');
    this.clear.emit();
    this.rangeChange.emit({ startDate: '', endDate: '' });
  }

  // Helpers de generación de días
  private generateMonthDays(monthDate: Date): CalendarDay[] {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Día de inicio de la semana (0 = Domingo, 1 = Lunes, ...)
    let startDayOfWeek = firstDayOfMonth.getDay();
    // Convertir para que Lunes sea 0 y Domingo sea 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days: CalendarDay[] = [];
    const todayStr = this.formatIso(new Date());

    const startStr = this.tempStartDate();
    const endStr = this.tempEndDate();
    const hoverStr = this.hoverDate();

    // Rango efectivo para resaltar (incluyendo previsualización de hover)
    let effectiveStart = startStr;
    let effectiveEnd = endStr;

    if (startStr && !endStr && hoverStr) {
      if (hoverStr >= startStr) {
        effectiveStart = startStr;
        effectiveEnd = hoverStr;
      } else {
        effectiveStart = hoverStr;
        effectiveEnd = startStr;
      }
    }

    // Días de relleno del mes previo
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = this.formatIso(date);
      days.push(this.createDay(date, dateStr, false, todayStr, effectiveStart, effectiveEnd, startStr, endStr));
    }

    // Días del mes corriente
    const totalDays = lastDayOfMonth.getDate();
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dateStr = this.formatIso(date);
      days.push(this.createDay(date, dateStr, true, todayStr, effectiveStart, effectiveEnd, startStr, endStr));
    }

    // Días de relleno del mes siguiente (para completar la cuadrícula de 35 o 42 días)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      const dateStr = this.formatIso(date);
      days.push(this.createDay(date, dateStr, false, todayStr, effectiveStart, effectiveEnd, startStr, endStr));
    }

    return days;
  }

  private createDay(
    date: Date,
    dateStr: string,
    isCurrentMonth: boolean,
    todayStr: string,
    effectiveStart: string | null,
    effectiveEnd: string | null,
    confirmedStart: string | null,
    confirmedEnd: string | null
  ): CalendarDay {
    const isStart = confirmedStart === dateStr;
    const isEnd = confirmedEnd === dateStr || (confirmedStart === dateStr && !confirmedEnd);

    let isInRange = false;
    if (effectiveStart && effectiveEnd && dateStr >= effectiveStart && dateStr <= effectiveEnd) {
      isInRange = true;
    }

    return {
      date,
      dateStr,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday: dateStr === todayStr,
      isStart,
      isEnd,
      isInRange,
      isHovered: !!this.hoverDate() && dateStr === this.hoverDate()
    };
  }

  private updateActivePresetFromDates() {
    const start = this._startDate();
    const end = this._endDate();

    if (!start && !end) {
      this.activePreset.set('all');
      return;
    }

    this.activePreset.set('custom');
  }

  private formatIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatShortDate(iso: string): string {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length < 3) return iso;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const day = parts[2];
    const month = months[parseInt(parts[1], 10) - 1] || parts[1];
    const year = parts[0];
    return `${day} ${month} ${year}`;
  }

  private getMonthTitle(d: Date): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}
