import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoginRequestDTO } from '../../Interface/LoginRequestDTO ';

import { Observable } from 'rxjs';
import { UsuarioDTO } from '../../Interface/UsuarioDTO';
import { environment } from '../../environments';

import { PreKeyBundleDTO, UploadBundleDTO } from '../../Interface/UploadBundleDTO';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private baseUrl = 'http://localhost:8080/api/usuarios'; // Ajusta si tienes prefijo

  constructor(private http: HttpClient) {}

  login(dto: LoginRequestDTO): Observable<UsuarioDTO> {
    return this.http.post<UsuarioDTO>(`${this.baseUrl}/login`, dto);
  }

  searchUsuarios(q: string): Observable<UsuarioDTO[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<UsuarioDTO[]>(`${this.baseUrl}/buscar`, { params });
  }

  getById(id: number): Observable<UsuarioDTO> {
    return this.http.get<UsuarioDTO>(`${this.baseUrl}/${id}`);
  }

  listarActivos(): Observable<UsuarioDTO[]> {
    return this.http.get<UsuarioDTO[]>(`${this.baseUrl}/activos`);
  }

  registro(fd: FormData): Observable<UsuarioDTO>;
  registro(dto: UsuarioDTO): Observable<UsuarioDTO>;
  registro(payload: FormData | UsuarioDTO): Observable<UsuarioDTO> {
    // Importante: NO pongas Content-Type manualmente.
    // Angular lo pone solo: application/json para objetos, multipart/form-data para FormData.
    return this.http.post<UsuarioDTO>(`${this.baseUrl}/registro`, payload);
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
}
