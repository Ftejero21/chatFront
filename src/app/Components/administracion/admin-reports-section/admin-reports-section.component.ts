import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UnbanAppealDTO } from '../../../Interface/UnbanAppealDTO';

@Component({
  selector: 'app-admin-reports-section',
  templateUrl: './admin-reports-section.component.html',
  styleUrls: ['./admin-reports-section.component.css'],
})
export class AdminReportsSectionComponent {
  @Input() active: boolean = false;
  @Input() headerSubtitle: string = '';
  @Input() appealTotalElements: number = 0;
  @Input() loadingAppeals: boolean = false;
  @Input() appealItems: UnbanAppealDTO[] = [];
  @Input() appealEmptyText: string = '';
  @Input() appealPage: number = 0;
  @Input() appealTotalPages: number = 1;
  @Input() appealIsLastPage: boolean = true;
  @Input() processingAppealId: number | null = null;
  @Input() appealViewFilter: 'ABIERTOS' | 'APROBADA' | 'RECHAZADA' = 'ABIERTOS';

  @Output() backRequested = new EventEmitter<void>();
  @Output() filterChanged = new EventEmitter<'ABIERTOS' | 'APROBADA' | 'RECHAZADA'>();
  @Output() appealClicked = new EventEmitter<UnbanAppealDTO>();
  @Output() prevPageRequested = new EventEmitter<void>();
  @Output() nextPageRequested = new EventEmitter<void>();

  public trackAppeal = (_: number, item: UnbanAppealDTO) => Number(item?.id || 0);

  public isFilterActive(filter: 'ABIERTOS' | 'APROBADA' | 'RECHAZADA'): boolean {
    return this.appealViewFilter === filter;
  }

  public getAppealReporterLabel(item: UnbanAppealDTO): string {
    const full = `${item?.usuarioNombre || ''} ${item?.usuarioApellido || ''}`.trim();
    if (full) return full;
    const email = String(item?.email || '').trim();
    if (email) return email;
    const userId = Number(item?.usuarioId || 0);
    return userId > 0 ? `Usuario #${userId}` : 'Usuario desconocido';
  }

  public getAppealTipoLabel(item: UnbanAppealDTO): string {
    const tipo = String(item?.tipoReporte || '').trim().toUpperCase();
    if (!tipo) return 'Desbaneo';
    if (tipo === 'DESBANEO') return 'Desbaneo';
    if (tipo === 'CHAT_CERRADO') return 'Chat bloqueado';
    // Cualquier otro valor del backend: formatear legible
    return tipo
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  public getAppealTipoClass(item: UnbanAppealDTO): string {
    const tipo = String(item?.tipoReporte || '').trim().toUpperCase();
    if (tipo === 'CHAT_CERRADO') return 'appeal-chip appeal-chip--type-group';
    if (!tipo || tipo === 'DESBANEO') return 'appeal-chip appeal-chip--type-user';
    return 'appeal-chip appeal-chip--type-other';
  }

  public getAppealEstadoClass(item: UnbanAppealDTO): string {
    const estado = String(item?.estado || '').trim().toUpperCase();
    if (estado === 'APROBADA') return 'appeal-chip appeal-chip--ok';
    if (estado === 'RECHAZADA') return 'appeal-chip appeal-chip--danger';
    if (estado === 'EN_REVISION') return 'appeal-chip appeal-chip--review';
    return 'appeal-chip appeal-chip--pending';
  }

  public getAppealCtaLabel(item: UnbanAppealDTO): string {
    if (Number(this.processingAppealId) === Number(item?.id)) return 'Procesando...';
    const tipo = String(item?.tipoReporte || '').trim().toUpperCase();
    if (tipo === 'CHAT_CERRADO') return 'Click para revisar y reabrir chat';
    return 'Click para revisar solicitud';
  }
}
