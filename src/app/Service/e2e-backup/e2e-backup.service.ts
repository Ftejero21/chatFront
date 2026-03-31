import { Injectable } from '@angular/core';
import { UserE2EPrivateKeyBackupDTO } from '../../Interface/UserE2EPrivateKeyBackupDTO';
import { UserE2EPrivateKeyBackupUpsertDTO } from '../../Interface/UserE2EPrivateKeyBackupUpsertDTO';

@Injectable({
  providedIn: 'root',
})
export class E2EBackupService {
  private readonly defaultIterations = 310000;
  private readonly defaultKeyLengthBits = 256;
  private readonly ivLengthBytes = 12;
  private readonly saltLengthBytes = 16;

  async buildEncryptedBackup(
    privateKeyBase64: string,
    publicKeyBase64: string,
    password: string
  ): Promise<UserE2EPrivateKeyBackupUpsertDTO> {
    const normalizedPrivateKey = String(privateKeyBase64 || '').trim();
    const normalizedPublicKey = String(publicKeyBase64 || '')
      .trim()
      .replace(/\s+/g, '');
    const normalizedPassword = String(password || '').trim();
    if (!normalizedPrivateKey || !normalizedPublicKey || !normalizedPassword) {
      throw new Error('E2E_BACKUP_INPUT_INVALID');
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(this.ivLengthBytes));
    const salt = window.crypto.getRandomValues(
      new Uint8Array(this.saltLengthBytes)
    );
    const aesKey = await this.deriveAesKey(
      normalizedPassword,
      salt,
      this.defaultIterations,
      this.defaultKeyLengthBits
    );

    const plaintext = new TextEncoder().encode(normalizedPrivateKey);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      plaintext
    );

    return {
      encryptedPrivateKey: this.bufferToBase64(encrypted),
      iv: this.bufferToBase64(iv.buffer),
      salt: this.bufferToBase64(salt.buffer),
      kdf: 'PBKDF2',
      kdfHash: 'SHA-256',
      kdfIterations: this.defaultIterations,
      keyLengthBits: this.defaultKeyLengthBits,
      publicKey: normalizedPublicKey,
      publicKeyFingerprint: await this.fingerprint12(normalizedPublicKey),
    };
  }

  async decryptPrivateKeyFromBackup(
    backup: UserE2EPrivateKeyBackupDTO,
    password: string
  ): Promise<string> {
    const normalizedPassword = String(password || '').trim();
    if (!normalizedPassword) throw new Error('E2E_BACKUP_PASSWORD_REQUIRED');
    if (!backup || typeof backup !== 'object') {
      throw new Error('E2E_BACKUP_INVALID_PAYLOAD');
    }

    const iterations = this.normalizeNumber(backup.kdfIterations, this.defaultIterations);
    const keyLengthBits = this.normalizeNumber(
      backup.keyLengthBits,
      this.defaultKeyLengthBits
    );
    const saltBytes = new Uint8Array(this.base64ToBuffer(backup.salt));
    const ivBytes = new Uint8Array(this.base64ToBuffer(backup.iv));
    const ciphertext = this.base64ToBuffer(backup.encryptedPrivateKey);

    const aesKey = await this.deriveAesKey(
      normalizedPassword,
      saltBytes,
      iterations,
      keyLengthBits
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      aesKey,
      ciphertext
    );
    const raw = new TextDecoder().decode(decrypted).trim();
    if (!raw) throw new Error('E2E_BACKUP_DECRYPT_EMPTY');
    return raw;
  }

  private async deriveAesKey(
    password: string,
    salt: Uint8Array,
    iterations: number,
    keyLengthBits: number
  ): Promise<CryptoKey> {
    const passwordBytes = new TextEncoder().encode(password);
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations,
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: keyLengthBits,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async fingerprint12(rawPublicKey: string): Promise<string> {
    const normalized = String(rawPublicKey || '').replace(/\s+/g, '');
    if (!normalized) return '';
    const data = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.slice(0, 12);
  }

  private normalizeNumber(raw: unknown, fallback: number): number {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const normalized = String(base64 || '')
      .trim()
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/\s+/g, '');
    const padLen = normalized.length % 4;
    const withPadding =
      padLen === 0 ? normalized : normalized + '='.repeat(4 - padLen);
    const binary = window.atob(withPadding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
