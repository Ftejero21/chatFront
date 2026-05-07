import { AiTextMode } from './AiTextMode';

export interface AiTextResponseDTO {
  textoOriginal: string;
  textoGenerado: string;
  modo: AiTextMode | string;
  success: boolean;
  codigo: string;
  mensaje: string;
  encryptedPayload?: string | Record<string, unknown> | null;
}
