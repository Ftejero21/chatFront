export interface NotificationDTO {
  id: number;
  userId: number;
  type: 'GROUP_INVITE' | 'GROUP_INVITE_RESPONSE';
  payloadJson: string; 
  seen: boolean;
  createdAt: string;
  resolved?: boolean;
}
