import { GroupInviteResponseWS } from "./GroupInviteResponseWS";
import { GroupInviteWS } from "./GroupInviteWS";

export type NotifItem =
  | (GroupInviteWS & { kind: 'INVITE' })
  | (GroupInviteResponseWS & { kind: 'RESPONSE' });
