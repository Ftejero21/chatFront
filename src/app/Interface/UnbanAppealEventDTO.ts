import { UnbanAppealEstado, UnbanAppealTipoReporte } from './UnbanAppealDTO';

export interface UnbanAppealEventDTO {
  event: 'UNBAN_APPEAL_CREATED' | 'UNBAN_APPEAL_UPDATED';
  id: number;
  usuarioId?: number | null;
  email: string;
  motivo?: string | null;
  estado: UnbanAppealEstado;
  createdAt?: string | null;
  updatedAt?: string | null;
  usuarioNombre?: string | null;
  usuarioApellido?: string | null;

  // Nuevos campos opcionales para reportes de cierre de chat grupal
  tipoReporte?: UnbanAppealTipoReporte | null;
  chatId?: number | null;
  chatNombreSnapshot?: string | null;
  chatCerradoMotivoSnapshot?: string | null;
}
