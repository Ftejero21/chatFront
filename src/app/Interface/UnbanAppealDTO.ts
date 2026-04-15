export type UnbanAppealEstado =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'APROBADA'
  | 'RECHAZADA';

// Backend puede reutilizar la misma tabla/endpoint para 2 tipos de reporte:
// - DESBANEO: solicita reactivar cuenta de usuario baneado
// - CHAT_CERRADO: solicita revisar/reabrir un chat grupal cerrado por admin
export type UnbanAppealTipoReporte = 'DESBANEO' | 'CHAT_CERRADO' | (string & {});

export interface UnbanAppealDTO {
  id: number;
  usuarioId?: number | null;
  email: string;
  motivo?: string | null;
  estado: UnbanAppealEstado;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewedByAdminId?: number | null;
  resolucionMotivo?: string | null;
  usuarioNombre?: string | null;
  usuarioApellido?: string | null;

  tipoReporte?: UnbanAppealTipoReporte | null;
  chatId?: number | null;
  chatNombreSnapshot?: string | null;
  chatCerradoMotivoSnapshot?: string | null;
}

