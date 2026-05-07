export interface AiReportAnalysisRequestDTO {
  chatId?: number | null;
  chatGrupalId?: number | null;
  tipoChat: 'INDIVIDUAL' | 'GRUPAL';
  usuarioDenunciadoId: number;
  maxMensajes: number;
}
