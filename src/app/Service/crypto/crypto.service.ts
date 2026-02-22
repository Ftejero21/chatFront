import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  constructor() { }

  /**
   * Genera un par de claves RSA para cifrado asimétrico E2E
   */
  async generateKeyPair(): Promise<{ publicKey: CryptoKey, privateKey: CryptoKey }> {
    return await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Exporta la clave pública a formato Base64 para enviarla al backend
   */
  async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return this.bufferToBase64(exported);
  }

  /**
   * Exporta la clave privada a formato Base64 para guardarla en localStorage
   */
  async exportPrivateKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("pkcs8", key);
    return this.bufferToBase64(exported);
  }

  /**
   * Importa la clave pública desde Base64
   */
  async importPublicKey(base64: string): Promise<CryptoKey> {
    const binaryDer = this.base64ToBuffer(base64);
    return await window.crypto.subtle.importKey(
      "spki",
      binaryDer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  }

  /**
   * Importa la clave privada desde Base64
   */
  async importPrivateKey(base64: string): Promise<CryptoKey> {
    const binaryDer = this.base64ToBuffer(base64);
    return await window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );
  }

  /**
   * Encripta texto usando RSA
   */
  async encryptRSA(text: string, publicKey: CryptoKey): Promise<string> {
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      encoded
    );
    return this.bufferToBase64(ciphertext);
  }

  /**
   * Desencripta texto usando RSA
   */
  async decryptRSA(base64Ciphertext: string, privateKey: CryptoKey): Promise<string> {
    const ciphertext = this.base64ToBuffer(base64Ciphertext);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  // --- HÍBRIDO AES --- Para mensajes largos

  async generateAESKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async exportAESKey(key: CryptoKey): Promise<string> {
    const raw = await window.crypto.subtle.exportKey("raw", key);
    return this.bufferToBase64(raw);
  }

  async importAESKey(base64: string): Promise<CryptoKey> {
    const raw = this.base64ToBuffer(base64);
    return await window.crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async encryptAES(text: string, key: CryptoKey): Promise<{ iv: string, ciphertext: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );
    return {
      iv: this.bufferToBase64(iv.buffer),
      ciphertext: this.bufferToBase64(ciphertext)
    };
  }

  async decryptAES(base64Ciphertext: string, base64Iv: string, key: CryptoKey): Promise<string> {
    const ciphertext = this.base64ToBuffer(base64Ciphertext);
    const ivBuffer = this.base64ToBuffer(base64Iv);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  // --- UTILS ---

  private bufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
