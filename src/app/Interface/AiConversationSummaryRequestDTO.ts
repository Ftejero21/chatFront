export type AiConversationSummaryChatType = 'INDIVIDUAL' | 'GRUPAL';

export type AiConversationSummaryStyle =
  | 'BREVE'
  | 'NORMAL'
  | 'DETALLADO';

export interface AiConversationMessageDTO {
  id?: number;
  autor: string;
  contenido: string;
  esUsuarioActual: boolean;
  fecha?: string;
}

export interface AiConversationSummaryRequestDTO {
  tipoChat: AiConversationSummaryChatType;
  chatId?: number;
  chatGrupalId?: number;
  mensajes: AiConversationMessageDTO[];
  maxLineas?: number;
  estilo?: AiConversationSummaryStyle;
}
