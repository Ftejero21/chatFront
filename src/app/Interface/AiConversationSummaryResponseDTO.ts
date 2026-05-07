export interface AiConversationSummaryResponseDTO {
  success: boolean;
  codigo: string;
  mensaje: string;
  resumen: string;
  encryptedPayload?: string | Record<string, unknown> | null;
}
