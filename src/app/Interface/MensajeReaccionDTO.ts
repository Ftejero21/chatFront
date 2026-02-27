export interface MensajeReaccionDTO {
  event: 'MESSAGE_REACTION';
  messageId: number;
  chatId: number;
  esGrupo: boolean;
  reactorUserId: number;
  targetUserId?: number | null;
  emoji: string | null;
  action: 'SET' | 'REMOVE';
  createdAt?: string;
}

