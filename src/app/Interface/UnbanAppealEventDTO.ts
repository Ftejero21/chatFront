import { UnbanAppealEstado } from './UnbanAppealDTO';

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
}
