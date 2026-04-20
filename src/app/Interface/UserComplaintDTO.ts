export type UserComplaintEstado = 'PENDIENTE' | 'EN_REVISION' | 'RESUELTA' | (string & {});

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
}
