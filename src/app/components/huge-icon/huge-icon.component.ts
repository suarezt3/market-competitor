import { Component, input, computed } from '@angular/core';

export type HugeIconName =
  | 'calendar-01'
  | 'calendar-03'
  | 'clock-01'
  | 'arrow-left-01'
  | 'arrow-right-01'
  | 'arrow-down-01'
  | 'cancel-01'
  | 'analytics-01'
  | 'view'
  | 'favourite'
  | 'bubble-chat'
  | 'refresh'
  | 'filter'
  | 'crown'
  | 'sparkles'
  | 'check';

@Component({
  selector: 'app-huge-icon',
  imports: [],
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [attr.stroke-width]="strokeWidth()"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      [class]="extraClass()"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('calendar-01') {
          <path d="M18 2V4M6 2V4" />
          <path d="M11.9955 13H12.0045M11.9955 17H12.0045M15.991 13H16M8 13H8.00897M8 17H8.00897" stroke-width="2.5" />
          <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
          <path d="M3.5 9.5H20.5" />
        }
        @case ('calendar-03') {
          <path d="M18 2V4M6 2V4" />
          <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
          <path d="M3.5 9.5H20.5" />
          <path d="M9 14.5L11 16.5L15 12.5" />
        }
        @case ('clock-01') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7V12L15.5 14" />
        }
        @case ('arrow-left-01') {
          <path d="M15 19L8 12L15 5" />
        }
        @case ('arrow-right-01') {
          <path d="M9 5L16 12L9 19" />
        }
        @case ('arrow-down-01') {
          <path d="M19 9L12 16L5 9" />
        }
        @case ('cancel-01') {
          <path d="M18 6L6 18M6 6L18 18" />
        }
        @case ('analytics-01') {
          <path d="M4 19.5H20M4 14.5L8.5 10L13.5 14L20 7.5M20 7.5H16M20 7.5V11.5" />
        }
        @case ('view') {
          <path d="M2.5 12C4.5 7.5 8 5 12 5C16 5 19.5 7.5 21.5 12C19.5 16.5 16 19 12 19C8 19 4.5 16.5 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        }
        @case ('favourite') {
          <path d="M12 20.25C12 20.25 2.5 15 2.5 8.75C2.5 5.5 5 3.5 8 3.5C10 3.5 11.25 4.5 12 5.5C12.75 4.5 14 3.5 16 3.5C19 3.5 21.5 5.5 21.5 8.75C21.5 15 12 20.25 12 20.25Z" />
        }
        @case ('bubble-chat') {
          <path d="M12 20.5C6.75 20.5 3 17 3 12.5C3 8 7 4.5 12 4.5C17 4.5 21 8 21 12.5C21 15 19.5 17.5 17 18.5V21L13.5 19.5C13 19.7 12.5 20.5 12 20.5Z" />
        }
        @case ('refresh') {
          <path d="M21 12C21 16.97 16.97 21 12 21C7.6 21 3.93 17.84 3.15 13.67M3 12C3 7.03 7.03 3 12 3C16.4 3 20.07 6.16 20.85 10.33" />
          <path d="M21 3V8H16M3 21V16H8" />
        }
        @case ('filter') {
          <path d="M3 5H21M5.5 10H18.5M8.5 15H15.5M11 19H13" />
        }
        @case ('crown') {
          <path d="M3 18L4.5 8.5L8.5 13.5L12 6L15.5 13.5L19.5 8.5L21 18H3Z" />
          <path d="M3 18H21" />
        }
        @case ('sparkles') {
          <path d="M12 2L13.5 7.5L19 9L13.5 10.5L12 16L10.5 10.5L5 9L10.5 7.5L12 2Z" />
          <path d="M19 16L19.7 18.3L22 19L19.7 19.7L19 22L18.3 19.7L16 19L18.3 18.3L19 16Z" />
        }
        @case ('check') {
          <path d="M5 12.5L9.5 17L19 7.5" />
        }
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
  `]
})
export class HugeIconComponent {
  name = input.required<HugeIconName>();
  size = input<number>(18);
  strokeWidth = input<number>(1.8);
  extraClass = input<string>('');
}
