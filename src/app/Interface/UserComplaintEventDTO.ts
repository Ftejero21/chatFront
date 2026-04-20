import { UserComplaintDTO } from './UserComplaintDTO';

export interface UserComplaintEventDTO extends UserComplaintDTO {
  event: 'USER_COMPLAINT_CREATED' | 'USER_COMPLAINT_UPDATED';
}
