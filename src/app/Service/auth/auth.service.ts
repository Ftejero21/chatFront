import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoginRequestDTO } from '../../Interface/LoginRequestDTO ';

import { Observable } from 'rxjs';
import { UsuarioDTO } from '../../Interface/UsuarioDTO';
import { AuthRespuestaDTO } from '../../Interface/AuthRespuestaDTO';
import { environment } from '../../environments';
import { DashboardStatsDTO } from '../../Interface/DashboardStatsDTO';

import { PreKeyBundleDTO, UploadBundleDTO } from '../../Interface/UploadBundleDTO';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private baseUrl = 'http://localhost:8080/api/usuarios'; // Ajusta si tienes prefijo

  constructor(private http: HttpClient) {}

  login(dto: LoginRequestDTO): Observable<AuthRespuestaDTO> {
    return this.http.post<AuthRespuestaDTO>(`${this.baseUrl}/login`, dto);
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

  getUsuariosRecientes(): Observable<UsuarioDTO[]> {
    return this.http.get<UsuarioDTO[]>(`${this.baseUrl}/admin/recientes`);
  }

  banearUsuario(id: number, motivo: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/admin/${id}/ban?motivo=${encodeURIComponent(motivo)}`, {});
  }

  desbanearUsuario(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/${id}/unban`, {});
  }
}
