import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments';

@Injectable({
  providedIn: 'root',
})
export class MensajeriaService {
  private readonly backendBaseUrl =
    String(environment?.backendBaseUrl || 'http://localhost:8080').replace(
      /\/+$/,
      ''
    );

  constructor(private http: HttpClient) {}

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

  uploadAudio(file: Blob, durMs: number) {
    const normalized = this.normalizeUploadAudioMime(file?.type || '');
    const payload =
      (file?.type || '').split(';')[0].trim().toLowerCase() === normalized.mime
        ? file
        : new Blob([file], { type: normalized.mime });

    const fd = new FormData();
    fd.append('file', payload, `voice-${Date.now()}.${normalized.ext}`);
    if (Number.isFinite(durMs) && durMs > 0) {
      fd.append('durMs', String(Math.round(durMs)));
    }

    return this.http.post<{ url: string; mime: string; durMs: number }>(
      `${this.backendBaseUrl}/api/uploads/audio`,
      fd
    );
  }

  public async uploadFile(
    file: Blob | File,
    preferredName?: string
  ): Promise<{
    url: string;
    mime: string;
    fileName: string;
    sizeBytes: number;
  }> {
    const normalizedFile = this.toFile(file, preferredName);
    const endpoints = [
      `${this.backendBaseUrl}/api/uploads/file`,
      `${this.backendBaseUrl}/api/uploads/media`,
      `${this.backendBaseUrl}/api/uploads/image`,
    ];

    let lastError: any = null;
    for (const endpoint of endpoints) {
      try {
        const fd = new FormData();
        fd.append('file', normalizedFile, normalizedFile.name);
        const response: any = await firstValueFrom(this.http.post(endpoint, fd));
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
        lastError = err;
      }
    }

    throw lastError || new Error('UPLOAD_ENDPOINT_UNAVAILABLE');
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
