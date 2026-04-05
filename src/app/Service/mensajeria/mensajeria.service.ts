import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments';

@Injectable({
  providedIn: 'root',
})
export class MensajeriaService {
  private readonly backendBaseUrl =
    String(environment.backendBaseUrl).replace(/\/+$/, '');

  constructor(private http: HttpClient) {}

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
    const maxRetries = Math.max(0, Math.floor(Number(retries) || 0));

    let attempt = 0;
    // Reintenta solo para errores transitorios (network/5xx/429).
    while (true) {
      try {
        return await firstValueFrom(
          this.http.get(downloadUrl, {
            headers: this.buildAuthHeaders(),
            responseType: 'blob',
          })
        );
      } catch (err: any) {
        const status = Number(err?.status || 0);
        const transient = status === 0 || status === 429 || status >= 500;
        if (!transient || attempt >= maxRetries) {
          throw err;
        }
        attempt += 1;
        await new Promise<void>((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
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
