import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UserComplaintDTO } from '../../../Interface/UserComplaintDTO';
import {
  UserComplaintExpedienteDTO,
  UserModerationHistoryItemDTO,
} from '../../../Interface/UserComplaintExpedienteDTO';

@Component({
  selector: 'app-admin-complaints-section',
  templateUrl: './admin-complaints-section.component.html',
  styleUrls: ['./admin-complaints-section.component.css'],
})
export class AdminComplaintsSectionComponent {
  @Input() active: boolean = false;
  @Input() headerSubtitle: string = '';
  @Input() loadingComplaints: boolean = false;
  @Input() complaintsItems: UserComplaintDTO[] = [];
  @Input() complaintsEmptyText: string = '';
  @Input() complaintsPage: number = 0;
  @Input() complaintsTotalPages: number = 1;
  @Input() complaintsIsLastPage: boolean = true;
  @Input() complaintsTotalElements: number = 0;
  @Input() showUserDetail: boolean = false;
  @Input() userRecordLoading: boolean = false;
  @Input() userRecord: UserComplaintExpedienteDTO | null = null;
  @Input() userRecordFallbackName: string = '';

  @Output() backRequested = new EventEmitter<void>();
  @Output() userDetailBackRequested = new EventEmitter<void>();
  @Output() complaintClicked = new EventEmitter<UserComplaintDTO>();
  @Output() userNameClicked = new EventEmitter<{ userId: number; name: string }>();
  @Output() warningRequested = new EventEmitter<number>();
  @Output() suspendRequested = new EventEmitter<number>();
  @Output() profileRequested = new EventEmitter<number>();
  @Output() prevPageRequested = new EventEmitter<void>();
  @Output() nextPageRequested = new EventEmitter<void>();

  public getComplaintReporterLabel(item: UserComplaintDTO): string {
    const label = String(item?.denuncianteNombre || '').trim();
    if (label) return label;
    const userId = Number(item?.denuncianteId || 0);
    return userId > 0 ? `Usuario #${userId}` : 'Usuario desconocido';
  }

  public getComplaintTargetLabel(item: UserComplaintDTO): string {
    const label = String(item?.denunciadoNombre || '').trim();
    if (label) return label;
    const userId = Number(item?.denunciadoId || 0);
    return userId > 0 ? `Usuario #${userId}` : 'Usuario desconocido';
  }

  public onReporterNameClick(item: UserComplaintDTO, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const userId = Number(item?.denuncianteId || 0);
    if (!Number.isFinite(userId) || userId <= 0) return;
    this.userNameClicked.emit({
      userId,
      name: this.getComplaintReporterLabel(item),
    });
  }

  public onTargetNameClick(item: UserComplaintDTO, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const userId = Number(item?.denunciadoId || 0);
    if (!Number.isFinite(userId) || userId <= 0) return;
    this.userNameClicked.emit({
      userId,
      name: this.getComplaintTargetLabel(item),
    });
  }

  public get resolvedName(): string {
    const name = String(this.userRecord?.nombre || this.userRecordFallbackName || '').trim();
    return name || 'Usuario';
  }

  public get initials(): string {
    const parts = this.resolvedName.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || 'U';
    const second = parts[1]?.charAt(0) || parts[0]?.charAt(1) || 'S';
    return `${first}${second}`.toUpperCase();
  }

  public get userId(): number {
    return Number(this.userRecord?.userId || 0);
  }

  public get totalRecibidas(): number {
    return Math.max(0, Number(this.userRecord?.totalDenunciasRecibidas || 0));
  }

  public get totalRealizadas(): number {
    return Math.max(0, Number(this.userRecord?.totalDenunciasRealizadas || 0));
  }

  public get registrationDateLabel(): string {
    const raw = this.readFirstStringLike([
      (this.userRecord as any)?.fechaRegistro,
      (this.userRecord as any)?.createdAt,
      (this.userRecord as any)?.usuarioDesde,
    ]);
    const date = this.toDateOrNull(raw);
    return date ? this.formatDateOnly(date) : 'Sin datos';
  }

  public get groupedMotivoEntries(): Array<{
    key: string;
    label: string;
    count: number;
    percent: number;
  }> {
    const list = Array.isArray(this.userRecord?.ultimasCincoDenuncias)
      ? this.userRecord.ultimasCincoDenuncias
      : [];

    const byReason = new Map<string, number>();
    for (const item of list) {
      const key = String(item?.motivo || '').trim().toLowerCase() || 'n/a';
      byReason.set(key, (byReason.get(key) || 0) + 1);
    }

    const total = Array.from(byReason.values()).reduce((acc, value) => acc + value, 0);
    return Array.from(byReason.entries())
      .map(([key, count]) => ({
        key,
        label: this.formatReasonLabel(key),
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  public get receivedComplaints(): UserComplaintDTO[] {
    return Array.isArray(this.userRecord?.ultimasCincoDenuncias)
      ? this.userRecord!.ultimasCincoDenuncias
      : [];
  }

  public get firstComplaintDateLabel(): string {
    const dated = this.receivedComplaints
      .map((x) => this.toDateOrNull(x?.createdAt))
      .filter((x): x is Date => !!x)
      .sort((a, b) => a.getTime() - b.getTime());
    return dated.length ? this.formatDate(dated[0]) : 'Sin datos';
  }

  public get lastComplaintDateLabel(): string {
    const dated = this.receivedComplaints
      .map((x) => this.toDateOrNull(x?.createdAt))
      .filter((x): x is Date => !!x)
      .sort((a, b) => b.getTime() - a.getTime());
    return dated.length ? this.formatDate(dated[0]) : 'Sin datos';
  }

  public get uniqueReportersCount(): number {
    const keys = new Set<string>();
    for (const item of this.receivedComplaints) {
      const id = Number(item?.denuncianteId || 0);
      if (id > 0) {
        keys.add(`id:${id}`);
        continue;
      }
      const name = String(item?.denuncianteNombre || '').trim().toLowerCase();
      if (name) keys.add(`name:${name}`);
    }
    return keys.size;
  }

  public get accountStatusLabel(): string {
    const statusFromExpediente = String(
      this.userRecord?.estadoCuenta || ''
    ).trim().toUpperCase();
    if (statusFromExpediente) {
      if (['ACTIVE', 'ACTIVA', 'HABILITADA'].includes(statusFromExpediente)) return 'Activa';
      if (['SUSPENDED', 'SUSPENDIDA', 'BANEADA', 'BANEADO', 'INACTIVA'].includes(statusFromExpediente)) return 'Suspendida';
      return statusFromExpediente.charAt(0) + statusFromExpediente.slice(1).toLowerCase();
    }

    if (typeof this.userRecord?.cuentaActiva === 'boolean') {
      return this.userRecord.cuentaActiva ? 'Activa' : 'Suspendida';
    }

    const activeLike = this.readFirstBooleanLike([
      (this.userRecord as any)?.activo,
      (this.userRecord as any)?.enabled,
      (this.userRecord as any)?.cuentaActiva,
    ]);
    if (activeLike === true) return 'Activa';
    if (activeLike === false) return 'Suspendida';

    const status = String(
      (this.userRecord as any)?.estadoCuenta ||
      (this.userRecord as any)?.estado ||
      ''
    ).trim().toUpperCase();
    if (!status) return 'Sin datos';
    if (['ACTIVE', 'ACTIVA', 'HABILITADA'].includes(status)) return 'Activa';
    if (['SUSPENDED', 'SUSPENDIDA', 'BANEADA', 'BANEADO', 'INACTIVA'].includes(status)) return 'Suspendida';
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  public get moderationHistory(): UserModerationHistoryItemDTO[] {
    const raw = Array.isArray(this.userRecord?.historialModeracion)
      ? this.userRecord!.historialModeracion
      : [];
    return raw
      .map((item) => ({
        id: item?.id ?? null,
        tipo: String(item?.tipo || '').trim() || null,
        motivo: String(item?.motivo || '').trim() || null,
        descripcion: String(item?.descripcion || '').trim() || null,
        origen: String(item?.origen || '').trim() || null,
        adminId: Number(item?.adminId || 0) || null,
        adminNombre: String(item?.adminNombre || '').trim() || null,
        createdAt: String(item?.createdAt || '').trim() || null,
        fecha: String(item?.fecha || '').trim() || null,
      }))
      .filter((item) => !!item.tipo || !!item.motivo || !!item.createdAt || !!item.fecha);
  }

  public get hasModerationHistory(): boolean {
    return this.moderationHistory.length > 0;
  }

  public get moderationHistoryPreview(): UserModerationHistoryItemDTO[] {
    return this.moderationHistory;
  }

  public formatModerationType(raw: string | null | undefined): string {
    const text = String(raw || '').trim().toUpperCase();
    if (!text) return 'Acción';
    if (text === 'WARNING' || text === 'ADVERTENCIA') return 'Advertencia';
    if (text === 'SUSPENSION' || text === 'SUSPEND' || text === 'BAN') return 'Suspensión';
    if (text === 'UNBAN' || text === 'DESBANEO' || text === 'UNSUSPEND') return 'Desbaneado';
    return text.charAt(0) + text.slice(1).toLowerCase();
  }

  public moderationTypeClass(raw: string | null | undefined): string {
    const text = String(raw || '').trim().toUpperCase();
    if (text === 'SUSPENSION' || text === 'SUSPEND' || text === 'BAN') return 'is-suspension';
    if (text === 'WARNING' || text === 'ADVERTENCIA') return 'is-warning';
    if (text === 'UNBAN' || text === 'DESBANEO' || text === 'UNSUSPEND') return 'is-unban';
    return 'is-generic';
  }

  public get accountStatusClass(): string {
    const label = this.accountStatusLabel.toLowerCase();
    if (label.includes('suspend')) return 'is-suspended';
    if (label.includes('activ')) return 'is-active';
    return 'is-neutral';
  }

  public get isAccountSuspended(): boolean {
    return this.accountStatusClass === 'is-suspended';
  }

  public getModerationDateLabel(item: UserModerationHistoryItemDTO): string {
    const parsed = this.toDateOrNull(item?.createdAt || item?.fecha);
    return parsed ? this.formatDate(parsed) : 'Sin fecha';
  }

  public get hasPreviousWarnings(): boolean | null {
    const boolLike = this.readFirstBooleanLike([
      (this.userRecord as any)?.tieneAdvertenciasPrevias,
      (this.userRecord as any)?.hasPreviousWarnings,
      (this.userRecord as any)?.advertenciasPreviasEnviadas,
    ]);
    if (boolLike !== null) return boolLike;

    const warnCount = Number(
      (this.userRecord as any)?.totalAdvertenciasPrevias ??
      (this.userRecord as any)?.advertenciasPrevias ??
      (this.userRecord as any)?.warningsCount
    );
    if (Number.isFinite(warnCount)) return warnCount > 0;
    return null;
  }

  public get warningsInfoText(): string {
    if (this.hasModerationHistory) {
      return `Se registran ${this.moderationHistory.length} accion(es) administrativas previas.`;
    }
    if (this.hasPreviousWarnings === true) {
      return 'Este usuario tiene advertencias previas enviadas.';
    }
    if (this.hasPreviousWarnings === false) {
      return 'Este usuario no tiene advertencias previas enviadas.';
    }
    return 'No hay datos de advertencias previas para este usuario.';
  }

  public get warningsInfoClass(): string {
    if (this.hasModerationHistory) return 'is-warning';
    if (this.hasPreviousWarnings === true) return 'is-warning';
    if (this.hasPreviousWarnings === false) return 'is-ok';
    return 'is-neutral';
  }

  public getComplaintCreatedAtLabel(item: UserComplaintDTO): string {
    return item?.createdAt ? new Date(item.createdAt).toISOString() : '';
  }

  private formatReasonLabel(raw: string): string {
    const text = String(raw || '').trim().toLowerCase();
    if (!text) return 'N/A';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private readFirstStringLike(candidates: any[]): string {
    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (text) return text;
    }
    return '';
  }

  private readFirstBooleanLike(candidates: any[]): boolean | null {
    for (const candidate of candidates) {
      if (typeof candidate === 'boolean') return candidate;
      if (typeof candidate === 'number') return candidate !== 0;
      const text = String(candidate || '').trim().toLowerCase();
      if (!text) continue;
      if (['true', '1', 'si', 'yes', 'activo', 'active'].includes(text)) return true;
      if (['false', '0', 'no', 'inactivo', 'suspendido', 'suspended'].includes(text)) return false;
    }
    return null;
  }

  private toDateOrNull(raw: any): Date | null {
    const text = String(raw || '').trim();
    if (!text) return null;
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private formatDate(value: Date): string {
    return value.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDateOnly(value: Date): string {
    return value.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
