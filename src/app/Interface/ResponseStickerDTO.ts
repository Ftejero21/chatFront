import { StickerDTO } from './StickerDTO';

export interface ResponseStickerDTO {
  mensaje?: string;
  data?: StickerDTO | StickerDTO[] | null;
  sticker?: StickerDTO | null;
  stickers?: StickerDTO[];
}

