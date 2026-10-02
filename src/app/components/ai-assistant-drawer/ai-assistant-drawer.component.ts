import { Component, ChangeDetectionStrategy, input, output, signal, ElementRef, ViewChild, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { ChatMessage, DatasetContextPayload } from '../../services/gemini.service';

@Component({
  selector: 'app-ai-assistant-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- OVERLAY OSCURO DE FONDO -->
    @if (isOpen()) {
      <div class="drawer-overlay" (click)="onClose()"></div>
    }

    <!-- CONTENEDOR DEL DRAWER LATERAL -->
    <aside class="ai-drawer" [class.drawer-open]="isOpen()">
      <!-- HEADER DEL DRAWER -->
      <div class="drawer-header">
        <div class="header-main-info">
          <div class="ai-avatar">
            <span>✨</span>
          </div>
          <div>
            <div class="title-with-status">
              <h3 class="drawer-title">Asistente Gemini 3.8 AI</h3>
              <span class="status-dot-active" title="Conectado al dataset activo"></span>
            </div>
            <span class="drawer-subtitle">Marketing Intelligence & Q&A Analítico</span>
          </div>
        </div>

        <div class="header-controls">
          <button
            type="button"
            class="control-btn clear-btn"
            (click)="onClearChat()"
            title="Limpiar conversación">
            <span>🗑️</span>
          </button>
          <button
            type="button"
            class="control-btn close-btn"
            (click)="onClose()"
            title="Cerrar panel">
            <span>✕</span>
          </button>
        </div>
      </div>

      <!-- BANNER DE CONTEXTO ACTIVO -->
      <div class="context-banner">
        <div class="context-tag">
          <span class="tag-icon">📊</span>
          <span>Red: <strong>{{ context()?.platform || 'Omnicanal' }}</strong></span>
        </div>
        <div class="context-tag">
          <span class="tag-icon">📅</span>
          <span>{{ context()?.dateRange?.start || 'Todo' }} — {{ context()?.dateRange?.end || 'Hoy' }}</span>
        </div>
        <div class="context-tag">
          <span class="tag-icon">📈</span>
          <span><strong>{{ context()?.totalPosts || 0 }}</strong> posts</span>
        </div>
      </div>

      <!-- PREGUNTAS RÁPIDAS EN 1 CLIC (CHIPS) -->
      <div class="quick-prompts-section">
        <div class="section-label-row">
          <span class="bolt-icon">⚡</span>
          <span>Consultas Rápidas en 1 Clic:</span>
        </div>
        <div class="quick-chips-grid">
          @for (chip of quickChips; track chip.label) {
            <button
              type="button"
              class="quick-chip-btn"
              [disabled]="isSending()"
              (click)="onQuickPromptClick(chip.prompt)">
              <span>{{ chip.icon }}</span>
              <span>{{ chip.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- HISTORIAL DE MENSAJES -->
      <div class="chat-messages-container" #scrollContainer>
        @for (msg of messages(); track msg.id) {
          <div class="message-wrapper" [class.user-message]="msg.role === 'user'" [class.model-message]="msg.role === 'model'">
            @if (msg.role === 'model') {
              <div class="model-avatar">✨</div>
            }

            <div class="message-bubble">
              <div class="message-text" [innerHTML]="formatMessageText(msg.text)"></div>
              <span class="message-time">{{ msg.timestamp | date:'shortTime' }}</span>
            </div>
          </div>
        }

        <!-- INDICADOR DE PENSANDO / ESCRIBIENDO CON BOTÓN DE DETENER -->
        @if (isSending()) {
          <div class="message-wrapper model-message">
            <div class="model-avatar">✨</div>
            <div class="message-bubble typing-bubble">
              <div class="typing-content-row">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span class="typing-label">Gemini está analizando la data...</span>
              </div>
              <button
                type="button"
                class="inline-stop-btn"
                (click)="onCancel()"
                title="Detener consulta actual">
                <span>⏹ Detener</span>
              </button>
            </div>
          </div>
        }
      </div>

      <!-- CAJA DE ENTRADA Y ENVÍO (CONTENEDOR SEGURO SIN NATIVE FORM RELOAD) -->
      <div class="chat-input-area">
        <div class="input-form">
          <textarea
            class="chat-textarea"
            rows="2"
            placeholder="Escribe una pregunta sobre la data o competidores... (ej. ¿Cuál es el video más visto?)"
            [formControl]="messageControl"
            (keydown)="onKeyDown($event)">
          </textarea>

          @if (isSending()) {
            <button
              type="button"
              class="stop-btn"
              (click)="onCancel()"
              title="Detener consulta en curso">
              <span class="stop-icon">⏹</span>
              <span class="stop-text">Parar</span>
            </button>
          } @else {
            <button
              type="button"
              class="send-btn"
              (click)="onSubmitMessage()"
              [disabled]="!messageValue()?.trim() || isSending()"
              title="Enviar mensaje">
              <span>➤</span>
            </button>
          }
        </div>
        <div class="input-footer-row">
          <span class="input-hint">Presiona <strong>Enter</strong> para enviar, <strong>Shift + Enter</strong> para salto de línea</span>
          @if (isSending()) {
            <button type="button" class="text-stop-link" (click)="onCancel()">⏹ Cancelar consulta</button>
          }
        </div>
      </div>
    </aside>
  `,
  styles: [`
    /* OVERLAY */
    .drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      z-index: 150;
      animation: fadeIn 0.2s ease-out;
    }

    /* DRAWER LATERAL */
    .ai-drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: 480px;
      max-width: 92vw;
      height: 100vh;
      background: #ffffff;
      box-shadow: -10px 0 35px rgba(15, 23, 42, 0.15);
      z-index: 200;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);

      &.drawer-open {
        transform: translateX(0);
      }
    }

    /* HEADER */
    .drawer-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
    }

    .header-main-info {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .ai-avatar {
      width: 40px;
      height: 40px;
      border-radius: 0.65rem;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
    }

    .title-with-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .drawer-title {
      font-size: 1rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }

    .status-dot-active {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }

    .drawer-subtitle {
      font-size: 0.76rem;
      color: #64748b;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .control-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      width: 32px;
      height: 32px;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
    }

    /* CONTEXT BANNER */
    .context-banner {
      background: #f8fafc;
      border-bottom: 1px solid #f1f5f9;
      padding: 0.6rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .context-tag {
      font-size: 0.72rem;
      color: #475569;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      padding: 0.2rem 0.55rem;
      display: flex;
      align-items: center;
      gap: 0.3rem;

      strong {
        color: #1e293b;
      }
    }

    /* QUICK PROMPTS */
    .quick-prompts-section {
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .section-label-row {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      margin-bottom: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .quick-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .quick-chip-btn {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1d4ed8;
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    /* MENSAJES */
    .chat-messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #f8fafc;
    }

    .message-wrapper {
      display: flex;
      gap: 0.65rem;
      max-width: 88%;

      &.user-message {
        align-self: flex-end;
        flex-direction: row-reverse;

        .message-bubble {
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: #ffffff;
          border-radius: 1rem 1rem 0.2rem 1rem;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);

          .message-time {
            color: rgba(255, 255, 255, 0.75);
            text-align: right;
          }
        }
      }

      &.model-message {
        align-self: flex-start;

        .message-bubble {
          background: #ffffff;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          border-radius: 1rem 1rem 1rem 0.2rem;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);

          .message-time {
            color: #94a3b8;
          }
        }
      }
    }

    .model-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .message-bubble {
      padding: 0.85rem 1rem;
      font-size: 0.84rem;
      line-height: 1.55;
    }

    .message-text {
      word-break: break-word;

      strong {
        font-weight: 700;
      }

      ul, ol {
        padding-left: 1.25rem;
        margin: 0.5rem 0;
      }

      li {
        margin-bottom: 0.25rem;
      }
    }

    .message-time {
      display: block;
      font-size: 0.68rem;
      margin-top: 0.4rem;
    }

    /* TYPING INDICATOR WITH STOP BUTTON */
    .typing-bubble {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.75rem 1rem !important;
      background: #ffffff;
      border: 1px solid #dbeafe;
      border-radius: 1rem 1rem 1rem 0.2rem;
    }

    .typing-content-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;

      span {
        width: 6px;
        height: 6px;
        background: #2563eb;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both;

        &:nth-child(1) { animation-delay: -0.32s; }
        &:nth-child(2) { animation-delay: -0.16s; }
      }
    }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    .typing-label {
      font-size: 0.78rem;
      color: #475569;
      font-weight: 500;
    }

    .inline-stop-btn {
      align-self: flex-start;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 0.4rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      transition: all 0.15s ease;

      &:hover {
        background: #fee2e2;
        border-color: #f87171;
        transform: translateY(-1px);
      }
    }

    /* INPUT AREA */
    .chat-input-area {
      padding: 1rem 1.25rem;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .input-form {
      display: flex;
      align-items: flex-end;
      gap: 0.65rem;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 0.75rem;
      padding: 0.5rem 0.75rem;
      transition: border-color 0.2s;

      &:focus-within {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
    }

    .chat-textarea {
      flex: 1;
      border: none;
      background: transparent;
      resize: none;
      outline: none;
      font-size: 0.84rem;
      font-family: inherit;
      color: #0f172a;
      line-height: 1.4;

      &::placeholder {
        color: #94a3b8;
      }
    }

    .send-btn {
      width: 36px;
      height: 36px;
      border-radius: 0.5rem;
      background: #2563eb;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.95rem;
      flex-shrink: 0;
      transition: all 0.15s;

      &:hover:not(:disabled) {
        background: #1d4ed8;
        transform: scale(1.04);
      }

      &:disabled {
        background: #cbd5e1;
        cursor: not-allowed;
      }
    }

    .stop-btn {
      height: 36px;
      padding: 0 0.75rem;
      border-radius: 0.5rem;
      background: #dc2626;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 700;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3);
      animation: pulseAlert 1.5s infinite;
      transition: all 0.15s;

      &:hover {
        background: #b91c1c;
        transform: scale(1.02);
      }
    }

    @keyframes pulseAlert {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.85; }
    }

    .stop-icon {
      font-size: 0.75rem;
    }

    .input-footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.4rem;
      font-size: 0.68rem;
    }

    .input-hint {
      color: #94a3b8;
    }

    .text-stop-link {
      background: transparent;
      border: none;
      color: #dc2626;
      font-weight: 700;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
      font-size: 0.7rem;

      &:hover {
        color: #b91c1c;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class AiAssistantDrawerComponent {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  public isOpen = input<boolean>(false);
  public isSending = input<boolean>(false);
  public messages = input<ChatMessage[]>([]);
  public context = input<DatasetContextPayload | null>(null);

  public closeRequested = output<void>();
  public clearChatRequested = output<void>();
  public sendMessageRequested = output<string>();
  public cancelRequested = output<void>();

  public messageControl = new FormControl('', [Validators.required]);
  public messageValue = toSignal(this.messageControl.valueChanges, { initialValue: '' });

  public quickChips = [
    {
      label: '¿Cuál es el post/video con más visualizaciones?',
      prompt: '¿Cuál es la publicación o video con más visualizaciones en el periodo y por qué tuvo tanto éxito?',
      icon: '🏆'
    },
    {
      label: '¿Qué formato rinde mejor?',
      prompt: 'Compara el rendimiento de Reels, Videos, Carruseles y Fotos. ¿Cuál genera mayor engagement y views?',
      icon: '📊'
    },
    {
      label: '¿Quién lidera el benchmark?',
      prompt: '¿Quién es la marca líder en cuota de visualizaciones e interacciones y qué ventaja tiene frente a sus competidores?',
      icon: '👑'
    },
    {
      label: 'Dame 3 ideas de contenido ganadoras',
      prompt: 'Con base en los posts con mayor engagement de los competidores, dame 3 ideas de contenido accionables para publicar esta semana.',
      icon: '💡'
    }
  ];

  constructor() {
    // Sincronizar estado disabled del control con isSending sin violar las reglas de Reactive Forms
    effect(() => {
      const sending = this.isSending();
      if (sending) {
        this.messageControl.disable({ emitEvent: false });
      } else {
        this.messageControl.enable({ emitEvent: false });
      }
    });

    // Desacoplar el scroll automático del ciclo sincrónico de cambio para evitar errores 'changed after checked'
    effect(() => {
      this.messages();
      this.isSending();
      if (this.isOpen()) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  onClose(): void {
    this.closeRequested.emit();
  }

  onClearChat(): void {
    this.clearChatRequested.emit();
  }

  onCancel(): void {
    this.cancelRequested.emit();
  }

  onQuickPromptClick(prompt: string): void {
    this.sendMessageRequested.emit(prompt);
  }

  onSubmitMessage(): void {
    const val = this.messageControl.value?.trim();
    if (val && !this.isSending()) {
      this.sendMessageRequested.emit(val);
      this.messageControl.reset();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSubmitMessage();
    }
  }

  formatMessageText(text: string): string {
    if (!text) return '';
    // Formatear markdown básico (negritas, saltos de línea, listas)
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n- /g, '<br>• ')
      .replace(/\n/g, '<br>');
    return formatted;
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      try {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      } catch (err) {
        // Ignore scroll errors
      }
    }
  }
}
