export interface AiEncryptedMessageSearchRequest {
  consulta: string;
  maxResultados?: number;
  maxMensajesAnalizar?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  incluirGrupales?: boolean;
  incluirIndividuales?: boolean;
}

export interface AiEncryptedMessageSearchResponse {
  success: boolean;
  codigo: string;
  mensaje: string;
  resumenBusqueda?: string | null;
  encryptedPayload?: string | Record<string, unknown> | null;
  resultados: AiEncryptedMessageSearchResult[];
}

export interface AiEncryptedMessageSearchResult {
  mensajeId: number;
  chatId: number;
  tipoChat: 'INDIVIDUAL' | 'GRUPAL';
  emisorId: number;
  nombreEmisor: string;
  receptorId?: number | null;
  nombreReceptor?: string | null;
  chatGrupalId?: number | null;
  nombreChatGrupal?: string | null;
  fechaEnvio: string;
  contenido: string | null;
  contenidoPayloadOriginal?: string | null;
  motivoCoincidencia: string | null;
  relevancia: number;
  tipoMensaje?: 'TEXT' | 'AUDIO' | 'IMAGE' | 'STICKER' | 'FILE' | 'UNKNOWN' | null;
  descripcionTipoMensaje?: string | null;
  esMultimedia?: boolean | null;
  contenidoVisible?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  nombreArchivo?: string | null;
  imageUrl?: string | null;
  imageMime?: string | null;
  imageNombre?: string | null;
  stickerId?: number | null;
  contentKind?: 'STICKER' | string | null;
}
