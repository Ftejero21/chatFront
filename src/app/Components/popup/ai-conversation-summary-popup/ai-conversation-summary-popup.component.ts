import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ai-conversation-summary-popup',
  templateUrl: './ai-conversation-summary-popup.component.html',
  styleUrls: ['./ai-conversation-summary-popup.component.css'],
})
export class AiConversationSummaryPopupComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() summary = '';
  @Input() error = '';

  @Output() closed = new EventEmitter<void>();

  public get resolvedSummary(): string {
    return String(this.summary || '').trim() || 'No hay resumen disponible.';
  }

  public get resolvedError(): string {
    return String(this.error || '').trim();
  }

  public onBackdropClick(): void {
    if (this.loading) return;
    this.closed.emit();
  }

  public onClose(): void {
    if (this.loading) return;
    this.closed.emit();
  }
}
