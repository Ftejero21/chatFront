import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ChatIndividualDTO } from '../../Interface/ChatIndividualDTO ';
import { ChatIndividualCreateDTO } from '../../Interface/ChatIndividualCreateDTO';
import { ChatGrupalDTO } from '../../Interface/ChatGrupalDTO';
import { Observable } from 'rxjs';
import { MensajeDTO } from '../../Interface/MensajeDTO';
import { MessagueSalirGrupoDTO } from '../../Interface/MessagueSalirGrupoDTO';
import { LeaveGroupRequestDTO } from '../../Interface/LeaveGroupRequestDTO';
import { EsMiembroDTO } from '../../Interface/EsMiembroDTO';
import { GroupDetailDTO } from '../../Interface/GroupDetailDTO';
import {
  GroupMediaListResponseDTO,
  GroupMediaType,
} from '../../Interface/GroupMediaDTO';
import { MessageSearchResponseDTO } from '../../Interface/MessageSearchDTO';
import { ChatListItemDTO } from '../../Interface/ChatListItemDTO';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private baseUrl = 'http://localhost:8080/api/chat'; // Ajusta si usas un proxy o diferente puerto

  constructor(private http: HttpClient) {}

  crearChatIndividual(
    dto: ChatIndividualCreateDTO
  ): Observable<ChatIndividualDTO> {
    return this.http.post<ChatIndividualDTO>(`${this.baseUrl}/individual`, dto);
  }

  listarConversacionesAdmin(usuarioId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/usuario/${usuarioId}/chats`);
  }

  listarMensajesAdminPorChat(chatId: number): Observable<any[]> {
    const token = localStorage.getItem('token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;

    return this.http.get<any[]>(
      `${this.baseUrl}/admin/chat/${chatId}/mensajes`,
      headers ? { headers } : {}
    );
  }

  crearChatGrupal(dto: ChatGrupalDTO): Observable<ChatGrupalDTO> {
    return this.http.post<ChatGrupalDTO>(`${this.baseUrl}/grupal`, dto);
  }

  obtenerDetalleGrupo(groupId: number): Observable<GroupDetailDTO> {
    return this.http.get<GroupDetailDTO>(`${this.baseUrl}/grupal/${groupId}/detalle`);
  }

  actualizarGrupo(
    groupId: number,
    payload: { nombreGrupo?: string; descripcion?: string; fotoGrupo?: string | null }
  ): Observable<GroupDetailDTO> {
    return this.http.put<GroupDetailDTO>(`${this.baseUrl}/grupal/${groupId}`, payload);
  }

  invitarMiembroAGrupo(groupId: number, userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/grupal/${groupId}/invitar`, { userId });
  }

  asignarAdminGrupo(groupId: number, userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/grupal/${groupId}/admins/${userId}`, {});
  }

  quitarAdminGrupo(groupId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/grupal/${groupId}/admins/${userId}`);
  }

  listarGrupalesPorUsuario(usuarioId: number): Observable<ChatGrupalDTO[]> {
    return this.http.get<ChatGrupalDTO[]>(
      `${this.baseUrl}/grupales/${usuarioId}`
    );
  }
  esMiembroDeGrupo(groupId: number, userId: number): Observable<EsMiembroDTO> {
    return this.http.get<EsMiembroDTO>(
      `${this.baseUrl}/grupal/${groupId}/es-miembro/${userId}`
    );
  }

  salirDeChatGrupal(
    dto: LeaveGroupRequestDTO
  ): Observable<MessagueSalirGrupoDTO> {
    return this.http.post<MessagueSalirGrupoDTO>(
      `${this.baseUrl}/grupal/salir`,
      dto
    );
  }

  listarTodosLosChats(usuarioId: number): Observable<ChatListItemDTO[]> {
    return this.http.get<ChatListItemDTO[]>(
      `${this.baseUrl}/usuario/${usuarioId}/todos`
    );
  }

  listarMensajesPorChat(
    chatId: number,
    page?: number,
    size?: number
  ): Observable<MensajeDTO[]> {
    let params = new HttpParams();
    if (Number.isFinite(Number(page))) {
      params = params.set('page', String(page));
    }
    if (Number.isFinite(Number(size))) {
      params = params.set('size', String(size));
    }

    const options = params.keys().length > 0 ? { params } : {};
    return this.http.get<MensajeDTO[]>(`${this.baseUrl}/mensajes/${chatId}`, options);
  }

  listarMensajesPorChatGrupal(
    chatId: number,
    page?: number,
    size?: number
  ): Observable<MensajeDTO[]> {
    let params = new HttpParams();
    if (Number.isFinite(Number(page))) {
      params = params.set('page', String(page));
    }
    if (Number.isFinite(Number(size))) {
      params = params.set('size', String(size));
    }

    const options = params.keys().length > 0 ? { params } : {};
    return this.http.get<MensajeDTO[]>(
      `${this.baseUrl}/mensajes/grupo/${chatId}`,
      options
    );
  }

  buscarMensajesEnChat(
    chatId: number,
    q: string,
    page: number = 0,
    size: number = 20
  ): Observable<MessageSearchResponseDTO> {
    const params = new HttpParams()
      .set('q', String(q || '').trim())
      .set('page', String(Number.isFinite(page) ? page : 0))
      .set('size', String(Number.isFinite(size) ? size : 20));

    return this.http.get<MessageSearchResponseDTO>(
      `${this.baseUrl}/mensajes/${chatId}/buscar`,
      { params }
    );
  }

  obtenerEstadosDeUsuarios(
    usuarioIds: number[]
  ): Observable<{ [key: number]: boolean }> {
    return this.http.post<{ [key: number]: boolean }>(
      'http://localhost:8080/api/estado/usuarios',
      usuarioIds
    );
  }

  listarMediaGrupo(
    groupId: number,
    cursor?: string | null,
    size: number = 30,
    types: GroupMediaType[] = ['IMAGE', 'VIDEO', 'AUDIO', 'FILE']
  ): Observable<GroupMediaListResponseDTO> {
    let params = new HttpParams().set('size', String(size));
    if (cursor) {
      params = params.set('cursor', String(cursor));
    }
    if (Array.isArray(types) && types.length > 0) {
      params = params.set('types', types.join(','));
    }

    return this.http.get<GroupMediaListResponseDTO>(
      `${this.baseUrl}/grupal/${groupId}/media`,
      { params }
    );
  }
}
