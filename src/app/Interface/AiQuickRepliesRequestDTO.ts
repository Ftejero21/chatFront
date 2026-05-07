export type AiQuickRepliesChatType = 'INDIVIDUAL' | 'GRUPAL';

export interface AiQuickRepliesRequestDTO {
  tipoChat: AiQuickRepliesChatType;
  chatId?: number | null;
  chatGrupalId?: number | null;
  maxMensajes?: number;
}
