export interface MensajeDTO {
  id?: number;
  mensajeOriginalId?: number;
  replyToMessageId?: number | null;
  replySnippet?: string | null;
  replyAuthorName?: string | null;
  contenido: string;
  fechaEnvio?: string;
  emisorId: number;
  receptorId: number;
  activo?: boolean;
  leido?: boolean;
  chatId?: number;
  emisorNombre?: string | undefined;
  emisorApellido?: string | undefined;
  emisorFoto?: string;
  tipo?: 'TEXT' | 'AUDIO' | 'IMAGE' | 'FILE' | 'SYSTEM';
  systemEvent?: string | null;
  esSistema?: boolean;
  reenviado?: boolean;
  audioDataUrl?: string | null;
  audioUrl?: string | null;
  audioMime?: string | null;
  audioDuracionMs?: number | null;
  imageDataUrl?: string | null;
  imageUrl?: string | null;
  imageMime?: string | null;
  imageNombre?: string | null;
  reaccionEmoji?: string | null;
  reaccionUsuarioId?: number | null;
  reaccionFecha?: string | null;
  reactionEmoji?: string | null;
  reactionUserId?: number | null;
  reactionAt?: string | null;
  reacciones?:
    | Array<{
        userId?: number | null;
        usuarioId?: number | null;
        emoji?: string | null;
        reaction?: string | null;
        fecha?: string | null;
        createdAt?: string | null;
      }>
    | null;
}
