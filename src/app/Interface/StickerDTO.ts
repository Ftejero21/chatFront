export interface StickerDTO {
  id: number;
  nombre?: string | null;
  activo?: boolean | null;
  nombreArchivo?: string | null;
  url?: string | null;
  archivoUrl?: string | null;
  imageUrl?: string | null;
  stickerUrl?: string | null;
  ruta?: string | null;
  mimeType?: string | null;
  tipoMime?: string | null;
  tamano?: number | null;
  fechaCreacion?: string | null;
  createdAt?: string | null;
}
