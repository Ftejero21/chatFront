import { AiTextMode } from './AiTextMode';

export interface AiTextRequestDTO {
  texto: string;
  modo: AiTextMode | string;
}
