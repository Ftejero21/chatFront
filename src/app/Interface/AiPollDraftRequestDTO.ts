export interface AiPollDraftContextMessageDTO {
  id?: number;
  autor: string;
  contenido: string;
  esUsuarioActual: boolean;
  fecha?: string;
}

export interface AiPollDraftRequestDTO {
  chatGrupalId: number;
  mensajes: AiPollDraftContextMessageDTO[];
  maxOpciones: number;
  estilo: 'NORMAL' | 'BREVE' | 'DETALLADO' | string;
}
