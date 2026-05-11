export interface AiEncryptedMessageSearchRequest {
  consulta: string;
  requestId?: string;
  maxResultados?: number;
  maxMensajesAnalizar?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  incluirGrupales?: boolean;
  incluirIndividuales?: boolean;
  imagenReporteBase64?: string;
  imagenReporteMimeType?: string;
  imagenReporteNombre?: string;
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
  tipoResultado?: 'MESSAGE' | 'COMPLAINT' | 'COMPLAINT_CREATED' | 'COMPLAINT_RECEIVED' | string | null;
  denunciaId?: number | null;
  tipoDenuncia?: string | null;
  estadoDenuncia?: string | null;
  fechaDenuncia?: string | null;
  motivo?: string | null;
  gravedad?: string | null;
  nombreUsuarioDenunciado?: string | null;
  // APP_REPORT_STATUS fields
  reporteId?: number | null;
  tipoReporte?: string | null;
  estadoReporte?: string | null;
  motivoReporte?: string | null;
  resolucionMotivoReporte?: string | null;
  fechaCreacionReporte?: string | null;
  fechaActualizacionReporte?: string | null;
  resolucionMotivo?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewedByAdminId?: number | null;
  chatCerradoMotivoSnapshot?: string | null;
  mejorResultadoAproximado?: boolean | null;
  historialReporte?: AiEncryptedMessageSearchReportHistoryItem[] | null;
}

export interface AiEncryptedMessageSearchReportHistoryItem {
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  estadoLabel?: string | null;
  motivo?: string | null;
  resolucionMotivo?: string | null;
  fecha?: string | null;
  adminId?: number | null;
  accion?: string | null;
  tieneImagenReporte?: boolean | null;
  imagenReporteMimeType?: string | null;
  imagenReporteNombre?: string | null;
  imagenReporteSize?: number | null;
  imagenReporteUrl?: string | null;
}
