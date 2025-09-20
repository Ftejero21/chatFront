import { GroupInviteResponseWS } from "./GroupInviteResponseWS";
import { GroupInviteWS } from "./GroupInviteWS";
import { UnseenCountWS } from "./UnseenCountWS";

export type NotificationWS = UnseenCountWS | GroupInviteWS | GroupInviteResponseWS;
