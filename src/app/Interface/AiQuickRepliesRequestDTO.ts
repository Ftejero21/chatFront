export type AiQuickRepliesChatType = 'INDIVIDUAL' | 'GRUPAL';

export interface AiQuickReplyContextDTO {
  autor: string;
  contenido: string;
  esUsuarioActual: boolean;
}

export interface AiQuickRepliesRequestDTO {
  mensajeRecibido: string;
  tipoChat: AiQuickRepliesChatType;
  contexto?: AiQuickReplyContextDTO[];
  chatId?: number;
  chatGrupalId?: number;
  messageId?: number;
}
