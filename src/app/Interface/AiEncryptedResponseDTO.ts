export interface AiEncryptedResponseDTO {
  success: boolean;
  codigo: string;
  mensaje: string;
  encryptedPayload?: string | Record<string, unknown> | null;
}
