import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { StickerDTO } from '../../Interface/StickerDTO';
import { ResponseStickerDTO } from '../../Interface/ResponseStickerDTO';
import { environment } from '../../environments';

@Injectable({
  providedIn: 'root',
})
export class StickerService {
  private readonly baseUrl = `${String(environment.backendBaseUrl).replace(/\/+$/, '')}/api/stickers`;

  constructor(private readonly http: HttpClient) {}

  private buildAuthHeaders(): HttpHeaders | undefined {
    const token = String(
      localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ).trim();
    if (!token) return undefined;
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  public getMyStickers(): Observable<StickerDTO[]> {
    return this.http
      .get<StickerDTO[] | ResponseStickerDTO>(`${this.baseUrl}/mis-stickers`, {
        headers: this.buildAuthHeaders(),
      })
      .pipe(map((res) => this.extractStickerList(res)));
  }

  public createSticker(file: File, nombre?: string): Observable<StickerDTO> {
    const formData = new FormData();
    formData.append('archivo', file, file.name);
    const safeNombre = String(nombre || '').trim();
    if (safeNombre) {
      formData.append('nombre', safeNombre);
    }
    return this.http
      .post<StickerDTO | ResponseStickerDTO>(`${this.baseUrl}`, formData, {
        headers: this.buildAuthHeaders(),
      })
      .pipe(map((res) => this.extractSingleSticker(res)));
  }

  public isOwnedByMe(stickerId: number): Observable<boolean> {
    const safeId = Math.round(Number(stickerId || 0));
    return this.http
      .get<{ owned?: boolean } | boolean>(
        `${this.baseUrl}/${safeId}/owned-by-me`,
        {
          headers: this.buildAuthHeaders(),
        }
      )
      .pipe(
        map((res) => {
          if (typeof res === 'boolean') return res;
          return res?.owned === true;
        })
      );
  }

  public deleteSticker(stickerId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${Math.round(stickerId)}`, {
      headers: this.buildAuthHeaders(),
    });
  }

  public getStickerArchivoBlob(
    stickerId: number,
    archivoUrl?: string | null
  ): Observable<Blob> {
    const raw = String(archivoUrl || '').trim();
    const resolved = raw
      ? raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `${String(environment.backendBaseUrl).replace(/\/+$/, '')}${raw.startsWith('/') ? '' : '/'}${raw}`
      : `${this.baseUrl}/${Math.round(stickerId)}/archivo`;

    return this.http.get(resolved, {
      headers: this.buildAuthHeaders(),
      responseType: 'blob',
    });
  }

  private extractStickerList(response: StickerDTO[] | ResponseStickerDTO): StickerDTO[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.stickers)) return response.stickers;
    if (Array.isArray(response?.data)) return response.data;
    if (response?.sticker && typeof response.sticker === 'object') {
      return [response.sticker];
    }
    if (response?.data && !Array.isArray(response.data)) return [response.data];
    return [];
  }

  private extractSingleSticker(response: StickerDTO | ResponseStickerDTO): StickerDTO {
    if (response && !('data' in (response as any)) && !('sticker' in (response as any))) {
      return response as StickerDTO;
    }
    const wrapped = response as ResponseStickerDTO;
    if (wrapped.sticker && typeof wrapped.sticker === 'object') return wrapped.sticker;
    if (wrapped.data && !Array.isArray(wrapped.data)) return wrapped.data;
    if (Array.isArray(wrapped.stickers) && wrapped.stickers.length > 0) return wrapped.stickers[0];
    if (Array.isArray(wrapped.data) && wrapped.data.length > 0) return wrapped.data[0];
    return { id: 0 };
  }
}
