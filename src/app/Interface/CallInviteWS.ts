export interface CallInviteWS {
  event: 'CALL_INVITE';
  callId: string;
  callerId: number;
  callerNombre: string;
  callerApellido: string;
  calleeId: number;
  chatId?: number | null;
}
