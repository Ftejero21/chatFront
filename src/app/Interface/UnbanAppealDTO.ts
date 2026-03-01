export type UnbanAppealEstado =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'APROBADA'
  | 'RECHAZADA';

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
}

