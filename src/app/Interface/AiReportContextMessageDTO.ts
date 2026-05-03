export interface AiReportContextMessageDTO {
  id?: number;
  autor: string;
  autorId?: number;
  contenido: string;
  esUsuarioDenunciado: boolean;
  esUsuarioActual: boolean;
  fecha?: string;
}
