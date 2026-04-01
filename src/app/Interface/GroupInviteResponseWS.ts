import { InviteStatus } from "./InviteStatus";

export interface GroupInviteResponseWS {
  inviteId: number;
  groupId: number;
  groupName: string;
  inviteeId: number;
  inviteeNombre: string;
  status: InviteStatus;
  unseenCount: number;
}
