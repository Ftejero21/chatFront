import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-report-chat-closure-popup',
  templateUrl: './report-chat-closure-popup.component.html',
  styleUrls: ['./report-chat-closure-popup.component.css'],
})
export class ReportChatClosurePopupComponent {
  @Input() open = false;
  @Input() chatName = '';
  @Input() value = '';
  @Input() sending = false;

  @Output() canceled = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<string>();
  @Output() valueChange = new EventEmitter<string>();

  onBackdropClick(): void {
    if (this.sending) return;
    this.canceled.emit();
  }

  onCancel(): void {
    if (this.sending) return;
    this.canceled.emit();
  }

  onSubmit(): void {
    if (this.sending) return;
    this.submitted.emit(String(this.value || '').trim());
  }

  onInput(next: string): void {
    this.valueChange.emit(next);
  }
}

