import { CallAnswerWS } from "./CallAnswerWS";
import { CallInviteWS } from "./CallInviteWS";

export interface CallEndWS {
  event: 'CALL_ENDED';
  callId: string;
  byUserId: number;     // quién cuelga
  notifyUserId: number; // a quién se notifica
}

export const isCallInviteWS = (x: any): x is CallInviteWS => x?.event === 'CALL_INVITE';
export const isCallAnswerWS = (x: any): x is CallAnswerWS => x?.event === 'CALL_ANSWER';
export const isCallEndWS    = (x: any): x is CallEndWS    => x?.event === 'CALL_ENDED';
