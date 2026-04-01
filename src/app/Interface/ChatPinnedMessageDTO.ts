export interface ChatPinnedMessageDTO {
  chatId: number;
  messageId: number;
  senderId: number;
  senderName?: string | null;
  messageType?: 'TEXT' | 'AUDIO' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'POLL' | string;
  preview?: string | null;
  pinnedAt?: string | null;
  pinnedByUserId?: number | null;
  expiresAt?: string | null;
}

export interface PinMessageRequestDTO {
  messageId: number;
  durationSeconds: number;
}
