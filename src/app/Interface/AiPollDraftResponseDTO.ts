export interface AiPollDraftResponseDTO {
  success: boolean;
  codigo: string;
  mensaje: string;
  pregunta: string;
  opciones: string[];
  multipleRespuestas: boolean;
  encryptedPayload?: string | Record<string, unknown> | null;
}
