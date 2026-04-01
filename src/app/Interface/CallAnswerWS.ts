export interface CallAnswerWS {
  event: 'CALL_ANSWER';
  callId: string;
  accepted: boolean;
  fromUserId: number; // quien responde (callee)
  toUserId: number;   // a quien se notifica (caller)
  reason?: string;    // RINGING | REJECTED | BUSY | ...
}
