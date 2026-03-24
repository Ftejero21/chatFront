import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoginRequestDTO } from '../../Interface/LoginRequestDTO ';

import { Observable, catchError, throwError } from 'rxjs';
import { UsuarioDTO } from '../../Interface/UsuarioDTO';
import { AuthRespuestaDTO } from '../../Interface/AuthRespuestaDTO';
import { environment } from '../../environments';
import { DashboardStatsDTO } from '../../Interface/DashboardStatsDTO';
import { PageResponse } from '../../Interface/PageResponse';
import { UserE2EStateDTO } from '../../Interface/UserE2EStateDTO';
import { UserE2ERekeyRequestDTO } from '../../Interface/UserE2ERekeyRequestDTO';
import { UnbanAppealDTO, UnbanAppealEstado } from '../../Interface/UnbanAppealDTO';

import { PreKeyBundleDTO, UploadBundleDTO } from '../../Interface/UploadBundleDTO';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private baseUrl = `${environment.backendBaseUrl}/api/usuarios`;

  constructor(private http: HttpClient) {}

  login(dto: LoginRequestDTO): Observable<AuthRespuestaDTO> {
    return this.http.post<AuthRespuestaDTO>(`${this.baseUrl}/login`, dto);
  }

  loginConGoogle(
    googleCredential: string,
    mode: 'login' | 'register' = 'login'
  ): Observable<AuthRespuestaDTO> {
    const token = String(googleCredential || '').trim();
    const payload = {
      provider: 'GOOGLE',
      mode,
      credential: token,
      idToken: token,
    };

    const endpoints = [
      `${this.baseUrl}/google`,
      `${this.baseUrl}/google/auth`,
      `${this.baseUrl}/${mode}/google`,
    ];

    return this.postGoogleAuthToFirstAvailableEndpoint(endpoints, payload);
  }

  searchUsuarios(q: string): Observable<UsuarioDTO[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<UsuarioDTO[]>(`${this.baseUrl}/buscar`, { params });
  }

  getById(id: number): Observable<UsuarioDTO> {
    const headers = new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return this.http.get<UsuarioDTO>(`${this.baseUrl}/${id}`, { headers });
  }

  listarActivos(): Observable<UsuarioDTO[]> {
    return this.http.get<UsuarioDTO[]>(`${this.baseUrl}/activos`);
  }

  registro(fd: FormData): Observable<AuthRespuestaDTO>;
  registro(dto: UsuarioDTO): Observable<AuthRespuestaDTO>;
  registro(payload: FormData | UsuarioDTO): Observable<AuthRespuestaDTO> {
    // Importante: NO pongas Content-Type manualmente.
    // Angular lo pone solo: application/json para objetos, multipart/form-data para FormData.
    return this.http.post<AuthRespuestaDTO>(`${this.baseUrl}/registro`, payload);
  }

  updatePublicKey(id: number, publicKey: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/public-key`, { publicKey });
  }

  getE2EState(userId: number): Observable<UserE2EStateDTO> {
    return this.http.get<UserE2EStateDTO>(`${this.baseUrl}/${userId}/e2e/state`);
  }

  rekeyE2E(userId: number, dto: UserE2ERekeyRequestDTO): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/e2e/rekey`, dto);
  }

  uploadPreKeyBundle(
    userId: number,
    bundle: UploadBundleDTO
  ): Observable<void> {
    return this.http.post<void>(
      `${environment.backendBaseUrl}/api/keys/${userId}/bundle`,
      bundle
    );
  }

  getPreKeyBundle(userId: number): Observable<PreKeyBundleDTO> {
    return this.http.get<PreKeyBundleDTO>(
      `${environment.backendBaseUrl}/api/keys/${userId}/bundle`
    );
  }

  getAuditPublicKey(): Observable<any> {
    return this.http.get<any>(`${environment.backendBaseUrl}/api/keys/audit-public`);
  }

  bloquearUsuario(bloqueadoId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${bloqueadoId}/bloquear`, {});
  }

  desbloquearUsuario(bloqueadoId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${bloqueadoId}/desbloquear`, {});
  }

  solicitarPasswordReset(email: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.baseUrl}/recuperar-password/solicitar`, { email });
  }

  verificarYCambiarPassword(email: string, code: string, newPassword: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.baseUrl}/recuperar-password/verificar-y-cambiar`, { email, code, newPassword });
  }

  getDashboardStats(): Observable<DashboardStatsDTO> {
    return this.http.get<DashboardStatsDTO>(`${this.baseUrl}/admin/dashboard-stats`);
  }

  getUsuariosRecientes(page: number = 0, size: number = 10): Observable<PageResponse<UsuarioDTO>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));
    return this.http.get<PageResponse<UsuarioDTO>>(`${this.baseUrl}/admin/recientes`, { params });
  }

  banearUsuario(id: number, motivo: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/admin/${id}/ban?motivo=${encodeURIComponent(motivo)}`, {});
  }

  desbanearUsuario(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/${id}/unban`, {});
  }

  solicitarDesbaneo(payload: {
    email: string;
    motivo: string;
  }): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.baseUrl}/solicitudes-desbaneo`,
      payload
    );
  }

  listarSolicitudesDesbaneoAdmin(
    page: number = 0,
    size: number = 20,
    estado?: UnbanAppealEstado | '' | UnbanAppealEstado[],
    sort: string = 'createdAt,desc'
  ): Observable<PageResponse<UnbanAppealDTO>> {
    let params = new HttpParams()
      .set('page', String(Number.isFinite(page) ? page : 0))
      .set('size', String(Number.isFinite(size) ? size : 20));

    const normalizedSort = String(sort || '').trim();
    if (normalizedSort) {
      params = params.set('sort', normalizedSort);
    }

    if (Array.isArray(estado)) {
      const estados = estado
        .map((x) => String(x || '').trim().toUpperCase())
        .filter(Boolean);
      if (estados.length > 0) {
        params = params.set('estados', estados.join(','));
      }
    } else {
      const normalizedEstado = String(estado || '').trim().toUpperCase();
      if (normalizedEstado) {
        params = params.set('estado', normalizedEstado);
      }
    }

    return this.http.get<PageResponse<UnbanAppealDTO>>(
      `${this.baseUrl}/admin/solicitudes-desbaneo`,
      { params }
    );
  }

  getSolicitudesDesbaneoStatsAdmin(tz?: string): Observable<{
    pendientes: number;
    enRevision: number;
    aprobadas: number;
    rechazadas: number;
    abiertas: number;
    hoyReportantesUnicos?: number;
    fechaReferencia?: string;
    timezone?: string;
  }> {
    let params = new HttpParams();
    const normalizedTz = String(tz || '').trim();
    if (normalizedTz) {
      params = params.set('tz', normalizedTz);
    }
    return this.http.get<{
      pendientes: number;
      enRevision: number;
      aprobadas: number;
      rechazadas: number;
      abiertas: number;
      hoyReportantesUnicos?: number;
      fechaReferencia?: string;
      timezone?: string;
    }>(`${this.baseUrl}/admin/solicitudes-desbaneo/stats`, { params });
  }

  actualizarEstadoSolicitudDesbaneoAdmin(
    id: number,
    payload: { estado: UnbanAppealEstado; resolucionMotivo?: string | null }
  ): Observable<UnbanAppealDTO> {
    return this.http.patch<UnbanAppealDTO>(
      `${this.baseUrl}/admin/solicitudes-desbaneo/${id}/estado`,
      payload
    );
  }

  solicitarCodigoCambioPasswordPerfil(): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.baseUrl}/perfil/password/solicitar-codigo`, {});
  }

  cambiarPasswordPerfil(code: string, newPassword: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.baseUrl}/perfil/password/cambiar`, { code, newPassword });
  }

  actualizarPerfil(payload: { nombre: string; apellido: string; foto: string }): Observable<UsuarioDTO> {
    return this.http.put<UsuarioDTO>(`${this.baseUrl}/perfil`, payload);
  }

  private postGoogleAuthToFirstAvailableEndpoint(
    endpoints: string[],
    payload: Record<string, unknown>
  ): Observable<AuthRespuestaDTO> {
    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      return throwError(() => new Error('No Google auth endpoint configured.'));
    }

    const [current, ...rest] = endpoints;
    return this.http.post<AuthRespuestaDTO>(current, payload).pipe(
      catchError((err) => {
        const status = Number(err?.status || 0);
        const canFallback =
          (status === 404 || status === 405 || status === 501) &&
          rest.length > 0;
        return canFallback
          ? this.postGoogleAuthToFirstAvailableEndpoint(rest, payload)
          : throwError(() => err);
      })
    );
  }
}
