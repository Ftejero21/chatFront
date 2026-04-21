import { UserComplaintDTO } from './UserComplaintDTO';

export interface UserComplaintExpedienteDTO {
  userId: number;
  nombre: string;
  fechaRegistro?: string | null;
  totalDenunciasRecibidas: number;
  totalDenunciasRealizadas: number;
  conteoPorMotivo: Record<string, number>;
  ultimasCincoDenuncias: UserComplaintDTO[];
  cuentaActiva?: boolean | null;
  estadoCuenta?: string | null;
  historialModeracion?: UserModerationHistoryItemDTO[] | null;
}

export interface UserModerationHistoryItemDTO {
  id?: number | string | null;
  tipo?: string | null;
  motivo?: string | null;
  descripcion?: string | null;
  origen?: string | null;
  adminId?: number | null;
  adminNombre?: string | null;
  createdAt?: string | null;
  fecha?: string | null;
}
