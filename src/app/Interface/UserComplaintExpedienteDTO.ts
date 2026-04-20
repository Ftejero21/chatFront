import { UserComplaintDTO } from './UserComplaintDTO';

export interface UserComplaintExpedienteDTO {
  userId: number;
  nombre: string;
  totalDenunciasRecibidas: number;
  totalDenunciasRealizadas: number;
  conteoPorMotivo: Record<string, number>;
  ultimasCincoDenuncias: UserComplaintDTO[];
}
