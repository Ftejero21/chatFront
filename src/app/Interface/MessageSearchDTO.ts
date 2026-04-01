export interface MessageSearchItemDTO {
  id: number;
  chatId: number;
  emisorId: number;
  emisorNombre?: string | null;
  emisorApellido?: string | null;
  contenido?: string | null;
  snippet?: string | null;
  fechaEnvio?: string | null;
  matchStart?: number | null;
  matchEnd?: number | null;
}

export interface MessageSearchResponseDTO {
  items: MessageSearchItemDTO[];
  page: number;
  size: number;
  total: number;
  hasMore: boolean;
}
