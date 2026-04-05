export interface MensajePollOptionDTO {
  id: string;
  text: string;
  voteCount: number;
  voterIds?: number[] | null;
  votedByMe?: boolean;
  voters?: MensajePollVoterDTO[] | null;
  votantesDetalle?: MensajePollVoterDTO[] | null;
  voteUsersDetail?: MensajePollVoterDTO[] | null;
}

export interface MensajePollVoterDTO {
  userId?: number | null;
  usuarioId?: number | null;
  idUsuario?: number | null;
  nombre?: string | null;
  apellido?: string | null;
  fullName?: string | null;
  foto?: string | null;
  photoUrl?: string | null;
  avatar?: string | null;
  votedAt?: string | null;
  voteAt?: string | null;
  votedAtIso?: string | null;
  fechaVoto?: string | null;
  createdAt?: string | null;
  fecha?: string | null;
}

export interface MensajePollDTO {
  type?: string;
  pollId?: string | number;
  question: string;
  allowMultiple: boolean;
  options: MensajePollOptionDTO[];
  totalVotes?: number;
  statusText?: string;
  createdAt?: string;
  createdBy?: number;
}

export interface MensajeDTO {
  id?: number;
  mensajeOriginalId?: number;
  replyToMessageId?: number | null;
  replySnippet?: string | null;
  replyAuthorName?: string | null;
  contenido: string;
  contenidoBusqueda?: string | null;
  contenido_busqueda?: string | null;
  fechaEnvio?: string;
  emisorId: number;
  receptorId: number;
  activo?: boolean;
  leido?: boolean;
  editado?: boolean;
  edited?: boolean;
  fechaEdicion?: string | null;
  editedAt?: string | null;
  chatId?: number;
  emisorNombre?: string | undefined;
  emisorApellido?: string | undefined;
  emisorFoto?: string;
  tipo?: 'TEXT' | 'AUDIO' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'POLL';
  systemEvent?: string | null;
  esSistema?: boolean;
  reenviado?: boolean;
  mensajeTemporal?: boolean;
  mensajeTemporalSegundos?: number | null;
  estadoTemporal?: 'ACTIVO' | 'EXPIRADO' | 'NO_TEMPORAL' | string | null;
  motivoEliminacion?: string | null;
  fechaEliminacion?: string | null;
  deletedAt?: string | null;
  deleted_at?: string | null;
  placeholderTexto?: string | null;
  expiraEn?: string | null;
  // Compatibilidad defensiva por si el backend serializa en snake_case
  mensaje_temporal?: boolean;
  mensaje_temporal_segundos?: number | null;
  estado_temporal?: 'ACTIVO' | 'EXPIRADO' | 'NO_TEMPORAL' | string | null;
  motivo_eliminacion?: string | null;
  fecha_eliminacion?: string | null;
  placeholder_texto?: string | null;
  expira_en?: string | null;
  pollType?: 'POLL_V1' | string | null;
  contentKind?: 'POLL' | string | null;
  poll?: MensajePollDTO | null;
  audioDataUrl?: string | null;
  audioUrl?: string | null;
  audioMime?: string | null;
  audioDuracionMs?: number | null;
  imageDataUrl?: string | null;
  imageUrl?: string | null;
  imageMime?: string | null;
  imageNombre?: string | null;
  fileDataUrl?: string | null;
  fileUrl?: string | null;
  fileMime?: string | null;
  fileNombre?: string | null;
  fileSizeBytes?: number | null;
  reaccionEmoji?: string | null;
  reaccionUsuarioId?: number | null;
  reaccionFecha?: string | null;
  reactionEmoji?: string | null;
  reactionUserId?: number | null;
  reactionAt?: string | null;
  __deletedAtMs?: number | null;
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
