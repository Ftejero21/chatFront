export interface UploadBundleDTO {
  registrationId: number;
  identityKey: string; // base64
  signedPreKey: { keyId: number; publicKey: string; signature: string };
  preKeys: Array<{ keyId: number; publicKey: string }>;
}

export interface PreKeyBundleDTO {
  registrationId: number;
  identityKey: string; // base64
  signedPreKey: { keyId: number; publicKey: string; signature: string };
  preKey?: { keyId: number; publicKey: string }; // one-time
}
