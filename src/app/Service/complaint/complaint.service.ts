import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments';
import { PageResponse } from '../../Interface/PageResponse';
import { UserComplaintDTO } from '../../Interface/UserComplaintDTO';
import { UserComplaintEventDTO } from '../../Interface/UserComplaintEventDTO';
import { UserComplaintExpedienteDTO } from '../../Interface/UserComplaintExpedienteDTO';

type CreateUserComplaintPayload = {
  denunciadoId: number;
  chatId?: number | null;
  motivo: string;
  detalle: string;
  denunciadoNombre?: string | null;
  chatNombreSnapshot?: string | null;
};

type ComplaintStatsDTO = {
  total: number;
  unread: number;
  pendientes?: number;
};

@Injectable({
  providedIn: 'root',
})
export class ComplaintService {
  private readonly baseUrl = `${environment.backendBaseUrl}/api/usuarios`;
  private readonly events$ = new Subject<UserComplaintEventDTO>();

  constructor(private http: HttpClient) {}

  public createComplaint(
    payload: CreateUserComplaintPayload
  ): Observable<UserComplaintDTO> {
    const body = {
      denunciadoId: Number(payload?.denunciadoId),
      chatId: payload?.chatId ?? null,
      motivo: String(payload?.motivo || '').trim(),
      detalle: String(payload?.detalle || '').trim(),
      denunciadoNombre: String(payload?.denunciadoNombre || '').trim() || null,
      chatNombreSnapshot: String(payload?.chatNombreSnapshot || '').trim() || null,
    };

    return this.http
      .post<UserComplaintDTO>(`${this.baseUrl}/denuncias`, body)
      .pipe(tap((item) => this.emitEvent('USER_COMPLAINT_CREATED', item)));
  }

  public listAdminComplaints(
    page: number = 0,
    size: number = 10
  ): Observable<PageResponse<UserComplaintDTO>> {
    const params = new HttpParams()
      .set('page', String(Number.isFinite(page) ? page : 0))
      .set('size', String(Number.isFinite(size) ? size : 10));

    return this.http.get<PageResponse<UserComplaintDTO>>(
      `${this.baseUrl}/admin/denuncias`,
      { params }
    );
  }

  public getAdminComplaintStats(): Observable<ComplaintStatsDTO> {
    return this.http.get<ComplaintStatsDTO>(`${this.baseUrl}/admin/denuncias/stats`);
  }

  public markComplaintAsRead(id: number): Observable<UserComplaintDTO> {
    const complaintId = Number(id);
    return this.http
      .patch<UserComplaintDTO>(
        `${this.baseUrl}/admin/denuncias/${complaintId}/read`,
        {}
      )
      .pipe(tap((item) => this.emitEvent('USER_COMPLAINT_UPDATED', item)));
  }

  public getAdminComplaintUserExpediente(
    userId: number
  ): Observable<UserComplaintExpedienteDTO> {
    const normalizedUserId = Number(userId);
    return this.http.get<UserComplaintExpedienteDTO>(
      `${this.baseUrl}/admin/denuncias/usuario/${normalizedUserId}/expediente`
    );
  }

  public complaintEvents(): Observable<UserComplaintEventDTO> {
    return this.events$.asObservable();
  }

  private emitEvent(
    event: UserComplaintEventDTO['event'],
    item: UserComplaintDTO | null | undefined
  ): void {
    const complaint = item ? { ...item } : null;
    if (!complaint?.id) return;
    this.events$.next({
      event,
      ...complaint,
    });
  }
}
