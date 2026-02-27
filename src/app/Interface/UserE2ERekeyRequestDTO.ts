export interface UserE2ERekeyRequestDTO {
  newPublicKey: string;
  currentPassword: string;
  expectedOldFingerprint?: string;
  otp?: string;
}
