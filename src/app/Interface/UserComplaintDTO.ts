export type UserComplaintEstado =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'RESUELTA'
  | 'DESCARTADA'
  | (string & {});

export interface ComplaintHistoryDTO {
  id?: number | string | null;
  estadoAnterior?: string | null;
  estadoNuevo: string;
  estadoLabel?: string | null;
  motivo?: string | null;
  detalle?: string | null;
  resolucionMotivo?: string | null;
  fecha?: string | null;
  adminId?: number | null;
  accion?: string | null;
}

export interface UserComplaintDTO {
  id: number;
  denuncianteId?: number | null;
  denunciadoId?: number | null;
  chatId?: number | null;
  motivo: string;
  detalle: string;
  estado?: UserComplaintEstado | null;
  leida?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  leidaAt?: string | null;
  denuncianteNombre?: string | null;
  denunciadoNombre?: string | null;
  chatNombreSnapshot?: string | null;
  resolucionMotivo?: string | null;
  historial?: ComplaintHistoryDTO[] | null;
  historialDenuncia?: ComplaintHistoryDTO[] | null;
}
