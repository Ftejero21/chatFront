export type AiEncryptedConversationSummaryChatType = 'INDIVIDUAL' | 'GRUPAL';

export type AiEncryptedConversationSummaryStyle =
  | 'BREVE'
  | 'NORMAL'
  | 'DETALLADO';

export interface AiEncryptedContextMessageDTO {
  id?: number;
  autorId?: number;
  autor: string;
  fecha?: string;
  esUsuarioActual: boolean;
  encryptedPayload: string;
}

export interface AiEncryptedConversationSummaryRequestDTO {
  tipoChat: AiEncryptedConversationSummaryChatType;
  chatId?: number;
  chatGrupalId?: number;
  mensajes: AiEncryptedContextMessageDTO[];
  maxLineas?: number;
  estilo?: AiEncryptedConversationSummaryStyle;
}
