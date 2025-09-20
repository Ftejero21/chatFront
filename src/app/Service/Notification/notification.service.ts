import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { NotificationDTO } from '../../Interface/NotificationDTO';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private baseUrl = 'http://localhost:8080/api/notifications';

  constructor(private http: HttpClient) {}

  unseenCount(userId: number): Observable<number> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http
      .get<{ unseenCount: number }>(`${this.baseUrl}/count`, { params })
      .pipe(map((r) => r.unseenCount));
  }

  list(userId: number): Observable<NotificationDTO[]> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.get<NotificationDTO[]>(`${this.baseUrl}`, { params });
  }

  markSeen(userId: number, notificationId: number): Observable<void> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.post<void>(
      `${this.baseUrl}/${notificationId}/seen`,
      null,
      { params }
    );
  }

  listPending(userId: number) {
    return this.http.get<NotificationDTO[]>(
      `${this.baseUrl}/${userId}/pending`
    );
  }

  /** ⬅️ OPCIONAL: marcar una notificación concreta como resuelta (para “OK” de respuestas) */
  resolve(notifId: number, userId: number) {
    return this.http.post<void>(
      `${this.baseUrl}/${notifId}/resolve?userId=${userId}`,
      {}
    );
  }

  markAllSeen(userId: number): Observable<void> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.post<void>(`${this.baseUrl}/seen-all`, null, { params });
  }
}
