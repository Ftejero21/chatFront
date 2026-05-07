export interface AiReportContextMessageDTO {
  id?: number;
  autor: string;
  autorId?: number;
  contenido?: string;
  encryptedPayload?: string;
  esUsuarioDenunciado: boolean;
  esUsuarioActual: boolean;
  fecha?: string;
}
