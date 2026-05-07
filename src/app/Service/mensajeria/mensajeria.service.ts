import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, defer, firstValueFrom, from, map, switchMap } from 'rxjs';
import { environment } from '../../environments';
import { AiTextRequestDTO } from '../../Interface/AiTextRequestDTO';
import { AiTextResponseDTO } from '../../Interface/AiTextResponseDTO';
import { CryptoService } from '../crypto/crypto.service';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class MensajeriaService {
  private readonly backendBaseUrl =
    String(environment.backendBaseUrl).replace(/\/+$/, '');
  private auditPublicKeyInitPromise: Promise<void> | null = null;

  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService,
    private authService: AuthService
  ) {}

  private buildAuthHeaders(): HttpHeaders | undefined {
    const token = String(
      localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ).trim();
    if (!token) return undefined;
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private isUploadSizeExceededError(err: any): boolean {
    const status = Number(err?.status || 0);
    if (status === 413) return true;
    const message = String(
      err?.error?.mensaje || err?.error?.message || err?.message || ''
    ).toLowerCase();
    return (
      message.includes('maximum upload size exceeded') ||
      message.includes('maxuploadsizeexceededexception') ||
      message.includes('payload too large')
    );
  }

  private normalizeUploadAudioMime(rawMime: string): { mime: string; ext: string } {
    const base = String(rawMime || '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    switch (base) {
      case 'audio/mp3':
      case 'audio/mpeg':
        return { mime: 'audio/mpeg', ext: 'mp3' };
      case 'audio/ogg':
        return { mime: 'audio/ogg', ext: 'ogg' };
      case 'audio/wav':
        return { mime: 'audio/wav', ext: 'wav' };
      case 'audio/webm':
        return { mime: 'audio/webm', ext: 'webm' };
      case 'audio/mp4':
      case 'audio/m4a':
        return { mime: 'audio/m4a', ext: 'm4a' };
      default:
        return { mime: 'audio/webm', ext: 'webm' };
    }
  }

  marcarMensajesComoLeidos(ids: number[]): Observable<void> {
    return this.http.post<void>(
      `${this.backendBaseUrl}/api/mensajeria/mensajes/marcar-leidos`,
      ids
    );
  }

  uploadAudio(file: Blob, durMs: number, chatId: number) {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) {
      throw new Error('CHAT_ID_REQUIRED_FOR_AUDIO_UPLOAD');
    }

    const normalized = this.normalizeUploadAudioMime(file?.type || '');
    const payload =
      (file?.type || '').split(';')[0].trim().toLowerCase() === normalized.mime
        ? file
        : new Blob([file], { type: normalized.mime });

    const fd = new FormData();
    fd.append('file', payload, `voice-${Date.now()}.${normalized.ext}`);
    fd.append('chatId', String(Math.round(normalizedChatId)));
    if (Number.isFinite(durMs) && durMs > 0) {
      fd.append('durMs', String(Math.round(durMs)));
    }

    return this.http.post<{ url: string; mime: string; durMs: number }>(
      `${this.backendBaseUrl}/api/uploads/audio`,
      fd,
      {
        headers: this.buildAuthHeaders(),
      }
    );
  }

  public async uploadFile(
    file: Blob | File,
    chatId: number,
    preferredName?: string
  ): Promise<{
    url: string;
    mime: string;
    fileName: string;
    sizeBytes: number;
  }> {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) {
      throw new Error('CHAT_ID_REQUIRED_FOR_FILE_UPLOAD');
    }

    const normalizedFile = this.toFile(file, preferredName);
    const endpoints = [
      `${this.backendBaseUrl}/api/uploads/media`,
      `${this.backendBaseUrl}/api/uploads/file`,
      `${this.backendBaseUrl}/api/uploads/image`,
    ];

    let lastError: any = null;
    for (const endpoint of endpoints) {
      try {
        const fd = new FormData();
        fd.append('file', normalizedFile, normalizedFile.name);
        fd.append('chatId', String(Math.round(normalizedChatId)));
        const response: any = await firstValueFrom(
          this.http.post(endpoint, fd, {
            headers: this.buildAuthHeaders(),
          })
        );
        const url = this.readUploadUrl(response);
        if (!url) continue;
        return {
          url,
          mime: String(
            response?.mime || normalizedFile.type || 'application/octet-stream'
          ),
          fileName: String(response?.fileName || normalizedFile.name || 'archivo'),
          sizeBytes: Number(response?.sizeBytes ?? normalizedFile.size ?? 0) || 0,
        };
      } catch (err) {
        if (this.isUploadSizeExceededError(err)) {
          throw err;
        }
        lastError = err;
      }
    }

    throw lastError || new Error('UPLOAD_ENDPOINT_UNAVAILABLE');
  }

  public buildChatAttachmentDownloadUrl(
    rawUrl: string,
    chatId: number,
    messageId: number
  ): string {
    const url = String(rawUrl || '').trim();
    const normalizedChatId = Number(chatId);
    const normalizedMessageId = Number(messageId);
    if (!url) throw new Error('DOWNLOAD_URL_REQUIRED');
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) {
      throw new Error('DOWNLOAD_CHAT_ID_REQUIRED');
    }
    if (!Number.isFinite(normalizedMessageId) || normalizedMessageId <= 0) {
      throw new Error('DOWNLOAD_MESSAGE_ID_REQUIRED');
    }

    const params = new URLSearchParams();
    params.set('url', url);
    params.set('chatId', String(Math.round(normalizedChatId)));
    params.set('messageId', String(Math.round(normalizedMessageId)));
    return `${this.backendBaseUrl}/api/uploads/file/download?${params.toString()}`;
  }

  public async downloadChatAttachmentBlob(
    rawUrl: string,
    chatId: number,
    messageId: number,
    retries: number = 1
  ): Promise<Blob> {
    const downloadUrl = this.buildChatAttachmentDownloadUrl(rawUrl, chatId, messageId);
    console.log('[mensajeria][download-attachment][start]', {
      rawUrl,
      chatId,
      messageId,
      downloadUrl,
      retries,
    });
    const maxRetries = Math.max(0, Math.floor(Number(retries) || 0));

    let attempt = 0;
    // Reintenta solo para errores transitorios (network/5xx/429).
    while (true) {
      try {
        const blob = await firstValueFrom(
          this.http.get(downloadUrl, {
            headers: this.buildAuthHeaders(),
            responseType: 'blob',
          })
        );
        console.log('[mensajeria][download-attachment][success]', {
          rawUrl,
          chatId,
          messageId,
          downloadUrl,
          blobType: blob.type,
          blobSize: blob.size,
          attempt,
        });
        return blob;
      } catch (err: any) {
        const status = Number(err?.status || 0);
        console.error('[mensajeria][download-attachment][error]', {
          rawUrl,
          chatId,
          messageId,
          downloadUrl,
          status,
          message: String(err?.message || err?.error?.message || ''),
          attempt,
          error: err,
        });
        const transient = status === 0 || status === 429 || status >= 500;
        if (!transient || attempt >= maxRetries) {
          throw err;
        }
        attempt += 1;
        await new Promise<void>((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  public procesarTextoConIa(
    request: AiTextRequestDTO
  ): Observable<AiTextResponseDTO> {
    return defer(() => {
      const modo = String(request?.modo || '').trim();
      const idiomaDestino = String(request?.idiomaDestino || '').trim();
      const texto = String(request?.texto || '').trim();
      const tipoMensaje = String(request?.tipoMensaje || '').trim().toUpperCase();
      const isAudioRequest = tipoMensaje === 'AUDIO';
      if (!modo || (!texto && !isAudioRequest)) {
        throw new Error('AI_TEXT_PAYLOAD_INVALID');
      }

      if (isAudioRequest) {
        return this.http.post<AiTextResponseDTO>(
          `${this.backendBaseUrl}/api/ai/texto`,
          {
            modo,
            messageId: Number(request?.messageId || 0) || undefined,
            tipoMensaje: 'AUDIO',
            audioUrl: String(request?.audioUrl || '').trim() || null,
            mediaUrl: String(request?.mediaUrl || '').trim() || null,
            audioEncryptedPayload:
              String(request?.audioEncryptedPayload || '').trim() || null,
            mimeType: String(request?.mimeType || '').trim() || null,
            encryptedPayload: request?.encryptedPayload ?? null,
            ...(idiomaDestino ? { idiomaDestino } : {}),
          },
          {
            headers: this.buildAuthHeaders(),
          }
        ).pipe(
          switchMap((response) =>
            from(this.normalizeAiTextResponse(response, '', modo))
          )
        );
      }

      return from(this.buildAiTextEncryptedPayload(texto)).pipe(
        switchMap((encryptedPayload) =>
          this.http.post<AiTextResponseDTO>(
            `${this.backendBaseUrl}/api/ai/texto`,
            {
              encryptedPayload,
              modo,
              ...(idiomaDestino ? { idiomaDestino } : {}),
            },
            {
              headers: this.buildAuthHeaders(),
            }
          )
        ),
        switchMap((response) =>
          from(this.normalizeAiTextResponse(response, texto, modo))
        )
      );
    });
  }

  private getCurrentUserId(): number {
    const fromLocal = Number(localStorage.getItem('usuarioId') || 0);
    if (Number.isFinite(fromLocal) && fromLocal > 0) return fromLocal;
    const fromSession = Number(sessionStorage.getItem('usuarioId') || 0);
    if (Number.isFinite(fromSession) && fromSession > 0) return fromSession;
    return 0;
  }

  private extractAuditPublicKeyFromSource(source: any): string | null {
    if (typeof source === 'string') {
      const key = source.trim();
      return key || null;
    }
    if (!source || typeof source !== 'object') return null;
    const candidates = [
      source.publicKey,
      source.auditPublicKey,
      source.publicKeyAdminAudit,
      source.publicKey_admin_audit,
      source.forAdminPublicKey,
      source?.audit?.publicKey,
      source?.keys?.auditPublicKey,
      source?.keys?.forAdminPublicKey,
    ];
    for (const candidate of candidates) {
      const key = String(candidate ?? '').trim();
      if (key) return key;
    }
    return null;
  }

  private persistAuditPublicKeyLocal(key: string): void {
    const normalized = String(key || '').trim();
    if (!normalized) return;
    localStorage.setItem('auditPublicKey', normalized);
    localStorage.setItem('publicKey_admin_audit', normalized);
    localStorage.setItem('forAdminPublicKey', normalized);
  }

  private getStoredAuditPublicKey(): string | null {
    const local =
      localStorage.getItem('auditPublicKey') ||
      localStorage.getItem('publicKey_admin_audit') ||
      localStorage.getItem('forAdminPublicKey') ||
      '';
    const localKey = String(local).trim();
    if (localKey) return localKey;

    const envKey = String((environment as any)?.auditPublicKey ?? '').trim();
    if (envKey) {
      this.persistAuditPublicKeyLocal(envKey);
      return envKey;
    }
    return null;
  }

  private async ensureAuditPublicKeyForE2E(): Promise<void> {
    if (this.getStoredAuditPublicKey()) return;
    if (this.auditPublicKeyInitPromise) {
      await this.auditPublicKeyInitPromise;
      return;
    }
    this.auditPublicKeyInitPromise = new Promise<void>((resolve) => {
      this.authService.getAuditPublicKey().subscribe({
        next: (resp: any) => {
          const key =
            this.extractAuditPublicKeyFromSource(resp) ||
            this.extractAuditPublicKeyFromSource(resp?.data) ||
            this.extractAuditPublicKeyFromSource(resp?.result);
          if (key) this.persistAuditPublicKeyLocal(key);
          resolve();
        },
        error: () => resolve(),
      });
    });
    await this.auditPublicKeyInitPromise;
    this.auditPublicKeyInitPromise = null;
  }

  private async buildAiTextEncryptedPayload(texto: string): Promise<string> {
    await this.ensureAuditPublicKeyForE2E();
    const adminPublicBase64 = String(this.getStoredAuditPublicKey() || '').trim();
    if (!adminPublicBase64) throw new Error('AI_TEXT_AUDIT_KEY_MISSING');
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPublicBase64);

    const aesKey = await this.cryptoService.generateAESKey();
    const aesRawBase64 = await this.cryptoService.exportAESKey(aesKey);
    const { iv, ciphertext } = await this.cryptoService.encryptAES(texto, aesKey);
    const forAdmin = await this.cryptoService.encryptRSA(aesRawBase64, adminRsaKey);

    return JSON.stringify({
      type: 'E2E',
      iv,
      ciphertext,
      forAdmin,
    });
  }

  private parseAiEncryptedPayload(raw: unknown): any {
    let candidate = String(raw || '').trim();
    if (!candidate) return {};
    for (let i = 0; i < 4; i++) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') return parsed;
        if (typeof parsed === 'string') {
          candidate = parsed.trim();
          continue;
        }
        return {};
      } catch {
        const quoted =
          (candidate.startsWith('"') && candidate.endsWith('"')) ||
          (candidate.startsWith("'") && candidate.endsWith("'"));
        if (quoted) {
          candidate = candidate.slice(1, -1).trim();
          continue;
        }
        if (candidate.includes('\\"')) {
          const unescaped = candidate.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          if (unescaped !== candidate) {
            candidate = unescaped.trim();
            continue;
          }
        }
        return {};
      }
    }
    return {};
  }

  private extractAesBase64FromEnvelope(raw: unknown): string {
    const text = String(raw || '').trim();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return text;
      const candidates = [
        parsed?.aesKey,
        parsed?.aes,
        parsed?.key,
        parsed?.value,
        parsed?.raw,
        parsed?.base64,
        parsed?.secret,
      ];
      for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (value) return value;
      }
      return text;
    } catch {
      return text;
    }
  }

  private async decryptAiTextPayload(raw: unknown): Promise<string> {
    const payload = this.parseAiEncryptedPayload(raw);
    const iv = String(payload?.iv || '').trim();
    const ciphertext = String(payload?.ciphertext || '').trim();
    if (!iv || !ciphertext) throw new Error('AI_TEXT_ENCRYPTED_PAYLOAD_MISSING');

    const myId = this.getCurrentUserId();
    if (!myId) throw new Error('AI_TEXT_USER_ID_MISSING');

    const privKeyBase64 = String(localStorage.getItem(`privateKey_${myId}`) || '').trim();
    if (!privKeyBase64) throw new Error('AI_TEXT_DECRYPT_PRIVATE_KEY_MISSING');
    const privateKey = await this.cryptoService.importPrivateKey(privKeyBase64);

    const envelopeCandidates: string[] = [];
    const pushIfAny = (value: unknown): void => {
      const text = String(value || '').trim();
      if (!text) return;
      if (!envelopeCandidates.includes(text)) envelopeCandidates.push(text);
    };
    pushIfAny(payload?.forReceptor);
    pushIfAny(payload?.forEmisor);
    pushIfAny(payload?.forAdmin);
    const forReceptores =
      payload?.forReceptores && typeof payload.forReceptores === 'object'
        ? (payload.forReceptores as Record<string, unknown>)
        : null;
    if (forReceptores) {
      pushIfAny(forReceptores[String(myId)]);
      for (const candidate of Object.values(forReceptores)) pushIfAny(candidate);
    }

    let aesRaw = '';
    for (const envelope of envelopeCandidates) {
      try {
        aesRaw = await this.cryptoService.decryptRSA(envelope, privateKey);
        if (aesRaw) break;
      } catch {
        // try next envelope
      }
    }
    if (!aesRaw) throw new Error('AI_TEXT_DECRYPT_ENVELOPE_MISSING');

    const aesBase64 = this.extractAesBase64FromEnvelope(aesRaw);
    const aesKey = await this.cryptoService.importAESKey(aesBase64);
    const plain = await this.cryptoService.decryptAES(ciphertext, iv, aesKey);
    const resolved = String(plain || '').trim();
    if (!resolved) throw new Error('AI_TEXT_DECRYPT_FAILED');
    return resolved;
  }

  private async normalizeAiTextResponse(
    response: AiTextResponseDTO | null | undefined,
    fallbackOriginal: string,
    fallbackMode: string
  ): Promise<AiTextResponseDTO> {
    if (!response) {
      return {
        success: false,
        codigo: 'AI_TEXT_EMPTY_RESPONSE',
        mensaje: 'Respuesta vacia del backend.',
        modo: fallbackMode,
        textoOriginal: fallbackOriginal,
        textoGenerado: '',
      };
    }
    if (!response.encryptedPayload) {
      return {
        ...response,
        textoOriginal: String(response.textoOriginal || fallbackOriginal || '').trim(),
        textoGenerado: String(response.textoGenerado || '').trim(),
        modo: String(response.modo || fallbackMode || '').trim(),
      };
    }

    const plain = await this.decryptAiTextPayload(response.encryptedPayload);
    let parsed: any = {};
    try {
      parsed = JSON.parse(plain);
    } catch {
      parsed = { textoGenerado: plain };
    }

    return {
      ...response,
      textoOriginal: String(
        parsed?.textoOriginal || response?.textoOriginal || fallbackOriginal || ''
      ).trim(),
      textoGenerado: String(
        parsed?.textoGenerado || response?.textoGenerado || ''
      ).trim(),
      modo: String(parsed?.modo || response?.modo || fallbackMode || '').trim(),
      success: parsed?.success ?? response.success,
      codigo: String(parsed?.codigo || response.codigo || '').trim(),
      mensaje: String(parsed?.mensaje || response.mensaje || '').trim(),
    };
  }

  private toFile(input: Blob | File, preferredName?: string): File {
    if (input instanceof File) return input;
    const ext = this.extensionFromMime(input.type);
    const filename = (preferredName || `upload-${Date.now()}.${ext}`).trim();
    return new File([input], filename, {
      type: input.type || 'application/octet-stream',
    });
  }

  private extensionFromMime(mime?: string): string {
    const clean = String(mime || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!clean) return 'bin';
    if (clean === 'image/jpeg') return 'jpg';
    if (clean === 'image/png') return 'png';
    if (clean === 'image/webp') return 'webp';
    if (clean === 'image/gif') return 'gif';
    if (clean === 'application/pdf') return 'pdf';
    const [, subtype] = clean.split('/');
    return subtype || 'bin';
  }

  private readUploadUrl(response: any): string {
    return String(
      response?.url ||
        response?.mediaUrl ||
        response?.fileUrl ||
        response?.path ||
        ''
    ).trim();
  }
}
