import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UserComplaintExpedienteDTO } from '../../../Interface/UserComplaintExpedienteDTO';

@Component({
  selector: 'app-admin-complaint-user-record-popup',
  templateUrl: './admin-complaint-user-record-popup.component.html',
  styleUrls: ['./admin-complaint-user-record-popup.component.css'],
})
export class AdminComplaintUserRecordPopupComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() expediente: UserComplaintExpedienteDTO | null = null;
  @Input() fallbackName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() warningRequested = new EventEmitter<number>();
  @Output() suspendRequested = new EventEmitter<number>();
  @Output() profileRequested = new EventEmitter<number>();

  public onBackdropClick(): void {
    this.closed.emit();
  }

  public onClose(): void {
    this.closed.emit();
  }

  public get resolvedName(): string {
    const name = String(this.expediente?.nombre || this.fallbackName || '').trim();
    return name || 'Usuario';
  }

  public get initials(): string {
    const parts = this.resolvedName.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || 'U';
    const second = parts[1]?.charAt(0) || parts[0]?.charAt(1) || 'S';
    return `${first}${second}`.toUpperCase();
  }

  public get userId(): number {
    return Number(this.expediente?.userId || 0);
  }

  public get totalRecibidas(): number {
    return Math.max(0, Number(this.expediente?.totalDenunciasRecibidas || 0));
  }

  public get totalRealizadas(): number {
    return Math.max(0, Number(this.expediente?.totalDenunciasRealizadas || 0));
  }

  public get dominantReasonLabel(): string {
    const entries = this.groupedMotivoEntries;
    if (!entries.length) return 'N/A';
    return entries[0].label.toUpperCase();
  }

  public get dominantReasonPercent(): number {
    const entries = this.groupedMotivoEntries;
    if (!entries.length) return 0;
    return entries[0].percent;
  }

  public get groupedMotivoEntries(): Array<{
    key: string;
    label: string;
    count: number;
    percent: number;
  }> {
    const list = Array.isArray(this.expediente?.ultimasCincoDenuncias)
      ? this.expediente?.ultimasCincoDenuncias
      : [];

    const byReason = new Map<string, number>();
    for (const item of list || []) {
      const key = String(item?.motivo || '').trim().toLowerCase() || 'n/a';
      byReason.set(key, (byReason.get(key) || 0) + 1);
    }

    const total = Array.from(byReason.values()).reduce((acc, value) => acc + value, 0);
    const entries = Array.from(byReason.entries())
      .map(([key, count]) => ({
        key,
        label: this.formatReasonLabel(key),
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return entries;
  }

  private formatReasonLabel(raw: string): string {
    const text = String(raw || '').trim().toLowerCase();
    if (!text) return 'N/A';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
