import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { NotificationDTO } from '../../Interface/NotificationDTO';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private baseUrl = 'http://localhost:8080/api/notifications';

  constructor(private http: HttpClient) {}

  private decodeJwtPayload(token: string): Record<string, any> | null {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length < 2) return null;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
    try {
      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private resolveAuthenticatedUserId(): number | null {
    const fromSession = Number(
      localStorage.getItem('usuarioId') || sessionStorage.getItem('usuarioId') || 0
    );
    if (Number.isFinite(fromSession) && fromSession > 0) {
      return Math.round(fromSession);
    }

    const token = String(
      localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ).trim();
    if (!token) return null;

    const payload = this.decodeJwtPayload(token);
    const candidates = [
      Number(payload?.['userId']),
      Number(payload?.['id']),
      Number(payload?.['usuarioId']),
      Number(payload?.['sub']),
    ];

    for (const candidate of candidates) {
      if (Number.isFinite(candidate) && candidate > 0) {
        return Math.round(candidate);
      }
    }
    return null;
  }

  unseenCount(_userId?: number): Observable<number> {
    return this.http
      .get<{ unseenCount: number }>(`${this.baseUrl}/count`)
      .pipe(map((r) => r.unseenCount));
  }

  list(_userId?: number): Observable<NotificationDTO[]> {
    return this.http.get<NotificationDTO[]>(`${this.baseUrl}`);
  }

  markSeen(notificationId: number): Observable<void>;
  markSeen(_userId: number, notificationId: number): Observable<void>;
  markSeen(a: number, b?: number): Observable<void> {
    const notificationId = Number(b ?? a);
    return this.http.post<void>(`${this.baseUrl}/${notificationId}/seen`, {});
  }

  listPending(_userId?: number): Observable<NotificationDTO[]> {
    const userId = this.resolveAuthenticatedUserId();
    if (!userId) {
      return throwError(() => new Error('AUTH_USER_ID_UNAVAILABLE'));
    }
    return this.http.get<NotificationDTO[]>(`${this.baseUrl}/${userId}/pending`);
  }

  resolve(notifId: number, _userId?: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${notifId}/resolve`, {});
  }

  markAllSeen(_userId?: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/seen-all`, {});
  }
}
