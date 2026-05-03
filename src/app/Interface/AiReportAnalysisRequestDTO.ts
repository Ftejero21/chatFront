import { AiReportContextMessageDTO } from './AiReportContextMessageDTO';

export interface AiReportAnalysisRequestDTO {
  usuarioDenunciadoId: number;
  nombreUsuarioDenunciado: string;
  motivosDisponibles: string[];
  mensajes: AiReportContextMessageDTO[];
  maxMensajes: number;
}
