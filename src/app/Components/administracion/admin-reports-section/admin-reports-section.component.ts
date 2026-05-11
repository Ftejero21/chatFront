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
  @Input() appealViewFilter: 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' = 'PENDIENTE';

  @Output() backRequested = new EventEmitter<void>();
  @Output() filterChanged = new EventEmitter<'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA'>();
  @Output() appealClicked = new EventEmitter<UnbanAppealDTO>();
  @Output() prevPageRequested = new EventEmitter<void>();
  @Output() nextPageRequested = new EventEmitter<void>();

  public trackAppeal = (_: number, item: UnbanAppealDTO) => Number(item?.id || 0);

  public isFilterActive(filter: 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA'): boolean {
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

  public getReportType(item: UnbanAppealDTO): string {
    const tipo = String(item?.tipoReporte || '').trim().toUpperCase();
    if (tipo) return tipo;
    // Fallback compatibilidad con registros antiguos sin tipoReporte
    const chatId = Number(item?.chatId || 0);
    return Number.isFinite(chatId) && chatId > 0 ? 'CHAT_CERRADO' : 'DESBANEO';
  }

  public getAppealTipoLabel(item: UnbanAppealDTO): string {
    switch (this.getReportType(item)) {
      case 'DESBANEO':     return 'Desbaneo';
      case 'CHAT_CERRADO': return 'Chat bloqueado';
      case 'INCIDENCIA':   return 'Incidencia';
      case 'ERROR_APP':    return 'Error app';
      case 'QUEJA':        return 'Queja';
      case 'MEJORA':       return 'Mejora';
      case 'SUGERENCIA':   return 'Sugerencia';
      case 'OTRO':         return 'Otro reporte';
      default: {
        const t = this.getReportType(item);
        return t.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
  }

  public getAppealTipoClass(item: UnbanAppealDTO): string {
    const tipo = this.getReportType(item);
    if (tipo === 'CHAT_CERRADO') return 'appeal-chip appeal-chip--type-group';
    if (tipo === 'DESBANEO')     return 'appeal-chip appeal-chip--type-user';
    return 'appeal-chip appeal-chip--type-other';
  }

  public getAppealEstadoClass(item: UnbanAppealDTO): string {
    const estado = String(item?.estado || '').trim().toUpperCase();
    if (estado === 'APROBADA')    return 'appeal-chip appeal-chip--ok';
    if (estado === 'RECHAZADA')   return 'appeal-chip appeal-chip--danger';
    if (estado === 'EN_REVISION') return 'appeal-chip appeal-chip--review';
    return 'appeal-chip appeal-chip--pending';
  }

  public getAppealCtaLabel(item: UnbanAppealDTO): string {
    if (Number(this.processingAppealId) === Number(item?.id)) return 'Procesando...';
    const estado = String(item?.estado || '').trim().toUpperCase();
    if (estado === 'APROBADA' || estado === 'RECHAZADA') return 'Ver resolución';
    if (estado === 'PENDIENTE') return 'Ver detalle y pasar a revisión';
    // EN_REVISION — acción final por tipo
    switch (this.getReportType(item)) {
      case 'DESBANEO':     return 'Click para revisar y aprobar desbaneo';
      case 'CHAT_CERRADO': return 'Click para revisar y reabrir chat';
      case 'INCIDENCIA':
      case 'ERROR_APP':    return 'Click para revisar incidencia';
      case 'QUEJA':        return 'Click para revisar queja';
      case 'MEJORA':
      case 'SUGERENCIA':   return 'Click para revisar sugerencia';
      default:             return 'Click para revisar reporte';
    }
  }

  public hasReportImage(item: UnbanAppealDTO): boolean {
    return item?.tieneImagenReporte === true;
  }
}
