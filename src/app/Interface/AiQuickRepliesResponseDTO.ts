export interface AiQuickRepliesResponseDTO {
  success: boolean;
  codigo: string;
  mensaje: string;
  sugerencias: string[];
  encryptedPayload?: string | Record<string, unknown> | null;
}
