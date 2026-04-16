import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

export type AdminSchedulePopupSubmitEvent = {
  scheduledDate: string;
  scheduledTime: string;
  scheduledAtIso: string;
  scheduledAtLocal: string;
};

@Component({
  selector: 'app-admin-schedule-send-popup',
  templateUrl: './admin-schedule-send-popup.component.html',
  styleUrls: ['./admin-schedule-send-popup.component.css'],
})
export class AdminScheduleSendPopupComponent implements OnChanges {
  @Input() open = false;
  @Input() mode: 'message' | 'email' = 'message';

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<AdminSchedulePopupSubmitEvent>();

  scheduledDate = '';
  scheduledTime = '';
  minDate = '';
  errorMessage = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetDefaults();
    }
  }

  onBackdropClick(): void {
    this.closed.emit();
  }

  onClose(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    this.errorMessage = '';
    const date = String(this.scheduledDate || '').trim();
    const time = String(this.scheduledTime || '').trim();
    if (!date || !time) {
      this.errorMessage = 'Indica fecha y hora.';
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.errorMessage = 'La fecha u hora no es valida.';
      return;
    }

    if (scheduledAt.getTime() <= Date.now()) {
      this.errorMessage = 'Debe ser una fecha futura.';
      return;
    }

    this.submitted.emit({
      scheduledDate: date,
      scheduledTime: time,
      scheduledAtIso: scheduledAt.toISOString(),
      scheduledAtLocal: `${date}T${time}:00`,
    });
  }

  get title(): string {
    return 'Programar envio';
  }

  get subtitle(): string {
    return this.mode === 'email'
      ? 'El email se enviará automáticamente a los destinatarios seleccionados en la fecha establecida.'
      : 'El mensaje se enviará automáticamente a los destinatarios seleccionados en la fecha establecida.';
  }

  get submitLabel(): string {
    return this.mode === 'email' ? 'Programar email' : 'Programar mensaje';
  }

  private resetDefaults(): void {
    this.errorMessage = '';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    this.minDate = `${yyyy}-${mm}-${dd}`;
    this.scheduledDate = this.minDate;
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    this.scheduledTime = `${hh}:${min}`;
  }
}
