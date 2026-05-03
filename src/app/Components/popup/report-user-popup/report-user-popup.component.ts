import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ReportUserReasonOption = {
  value: string;
  label: string;
};

export type ReportUserSubmitPayload = {
  motivo: string;
  detalle: string;
};

@Component({
  selector: 'app-report-user-popup',
  templateUrl: './report-user-popup.component.html',
  styleUrls: ['./report-user-popup.component.css'],
})
export class ReportUserPopupComponent {
  @Input() open = false;
  @Input() targetName = '';
  @Input() motivo = '';
  @Input() detalle = '';
  @Input() aiLoading = false;
  @Input() aiMessage = '';
  @Input() sending = false;
  @Input() success = false;
  @Input() reasonOptions: ReportUserReasonOption[] = [];

  @Output() canceled = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<ReportUserSubmitPayload>();
  @Output() motivoChange = new EventEmitter<string>();
  @Output() detalleChange = new EventEmitter<string>();

  public get canSubmit(): boolean {
    if (this.aiLoading) return false;
    return !!String(this.motivo || '').trim() && !!String(this.detalle || '').trim();
  }

  public onBackdropClick(): void {
    if (this.sending) return;
    this.canceled.emit();
  }

  public onCancel(): void {
    if (this.sending) return;
    this.canceled.emit();
  }

  public onSubmit(): void {
    if (this.aiLoading || this.sending || !this.canSubmit) return;
    this.submitted.emit({
      motivo: String(this.motivo || '').trim(),
      detalle: String(this.detalle || '').trim(),
    });
  }

  public onMotivoChange(next: string): void {
    this.motivoChange.emit(String(next || ''));
  }

  public onDetalleChange(next: string): void {
    this.detalleChange.emit(String(next || ''));
  }
}
