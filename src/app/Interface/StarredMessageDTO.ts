export interface StarredMessageDTO {
  messageId?: number | string | null;
  mensajeId?: number | string | null;
  chatId?: number | string | null;
  chatNombre?: string | null;
  nombreChat?: string | null;
  emisorId?: number | string | null;
  senderId?: number | string | null;
  emisorNombre?: string | null;
  nombreEmisor?: string | null;
  nombreEmisorCompleto?: string | null;
  senderName?: string | null;
  tipo?: string | null;
  tipoMensaje?: string | null;
  preview?: string | null;
  contenido?: string | null;
  fechaEnvio?: string | null;
  fechaMensaje?: string | null;
  destacadoEn?: string | null;
  starredAt?: string | null;
  createdAt?: string | null;
}

export interface StarredMessagesPageDTO {
  content?: StarredMessageDTO[] | null;
  page?: number | null;
  size?: number | null;
  totalElements?: number | null;
  totalPages?: number | null;
  hasNext?: boolean | null;
  hasPrevious?: boolean | null;
  number?: number | null;
  first?: boolean | null;
  last?: boolean | null;
}

export interface StarredMessageItem {
  messageId: number;
  chatId: number | null;
  chatNombre: string;
  emisorId: number;
  emisorNombre: string;
  tipo: string;
  preview: string;
  fechaEnvio: string | null;
  starredAt: string;
  audioSrc?: string | null;
  audioDurationLabel?: string | null;
  imageSrc?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
  fileSrc?: string | null;
  fileName?: string | null;
  fileSizeLabel?: string | null;
  fileTypeLabel?: string | null;
  fileIconClass?: string | null;
  fileCaption?: string | null;
}
