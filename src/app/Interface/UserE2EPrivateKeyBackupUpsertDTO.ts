export interface UserE2EPrivateKeyBackupUpsertDTO {
  encryptedPrivateKey: string;
  iv: string;
  salt: string;
  kdf: 'PBKDF2';
  kdfHash: 'SHA-256';
  kdfIterations: number;
  keyLengthBits: number;
  publicKey: string;
  publicKeyFingerprint: string;
}
