import { AiTextMode } from './AiTextMode';

export interface AiTextRequestDTO {
  texto?: string;
  encryptedPayload?: string | null;
  modo: AiTextMode | string;
  idiomaDestino?: string;
  messageId?: number;
  tipoMensaje?: 'TEXT' | 'AUDIO' | 'IMAGE' | 'STICKER' | 'FILE' | string;
  audioUrl?: string | null;
  mediaUrl?: string | null;
  audioEncryptedPayload?: string | null;
  mimeType?: string | null;
}
