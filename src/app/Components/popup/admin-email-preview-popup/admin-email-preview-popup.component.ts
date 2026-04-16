import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-email-preview-popup',
  templateUrl: './admin-email-preview-popup.component.html',
  styleUrls: ['./admin-email-preview-popup.component.css'],
})
export class AdminEmailPreviewPopupComponent {
  @Input() open = false;
  @Input() subject = '';
  @Input() body = '';
  @Input() attachmentCount = 0;
  @Input() attachmentNames: string[] = [];

  @Output() closed = new EventEmitter<void>();

  onBackdropClick(): void {
    this.closed.emit();
  }

  onClose(): void {
    this.closed.emit();
  }

  get resolvedSubject(): string {
    return String(this.subject || '').trim() || 'Sin asunto';
  }

  get resolvedBody(): string {
    return String(this.body || '').trim() || 'Sin contenido.';
  }

  get resolvedAttachmentNames(): string[] {
    return (this.attachmentNames || [])
      .map((name) => String(name || '').trim())
      .filter(Boolean);
  }
}
