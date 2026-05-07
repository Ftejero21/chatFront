export type AiEncryptedConversationSummaryChatType = 'INDIVIDUAL' | 'GRUPAL';

export type AiEncryptedConversationSummaryStyle =
  | 'BREVE'
  | 'NORMAL'
  | 'DETALLADO'
  | string;

export interface AiEncryptedConversationSummaryRequestDTO {
  tipoChat: AiEncryptedConversationSummaryChatType;
  chatId?: number | null;
  chatGrupalId?: number | null;
  maxLineas: number;
  maxMensajes?: number;
  estilo: AiEncryptedConversationSummaryStyle;
}
