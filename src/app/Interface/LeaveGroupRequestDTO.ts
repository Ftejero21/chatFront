export interface LeaveGroupRequestDTO {
  groupId: number;
  userId: number; // siempre llega, no usamos JWT
}
