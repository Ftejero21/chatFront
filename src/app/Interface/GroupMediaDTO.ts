export type GroupMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | string;

export interface GroupMediaItemDTO {
  messageId: number;
  chatId: number;
  emisorId: number;
  emisorNombreCompleto?: string | null;
  tipo: GroupMediaType;
  fechaEnvio?: string | null;
  activo?: boolean;
  reenviado?: boolean;
  mime?: string | null;
  sizeBytes?: number | null;
  durMs?: number | null;
  fileName?: string | null;
  thumbUrl?: string | null;
  contenidoRaw?: string | null;
  contenido?: string | null;
  mediaUrl?: string | null;
  audioUrl?: string | null;
}

export interface GroupMediaListResponseDTO {
  items: GroupMediaItemDTO[];
  nextCursor?: string | null;
  hasMore?: boolean;
}
