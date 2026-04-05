import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ChatIndividualDTO } from '../../Interface/ChatIndividualDTO ';
import { ChatIndividualCreateDTO } from '../../Interface/ChatIndividualCreateDTO';
import { ChatGrupalDTO } from '../../Interface/ChatGrupalDTO';
import { Observable, catchError, firstValueFrom, throwError } from 'rxjs';
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
import {
  StarredMessageDTO,
  StarredMessagesPageDTO,
} from '../../Interface/StarredMessageDTO';
import {
  ChatPinnedMessageDTO,
  PinMessageRequestDTO,
} from '../../Interface/ChatPinnedMessageDTO';
import { environment } from '../../environments';

export interface PollVoteRestRequestDTO {
  optionId: string;
  chatId?: number;
  pollId?: string | number;
  userId?: number;
}

export interface ProgramarMensajeRequestDTO {
  message: string;
  contenido?: string;
  contenidoBusqueda?: string;
  contenido_busqueda?: string;
  chatIds: number[];
  chatId?: number;
  scheduledAt: string;
  scheduledAtLocal?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  timezone?: string;
  fechaProgramada?: string;
  createdBy?: number;
  userId?: number;
}

export interface ProgramarMensajeItemDTO {
  chatId: number;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELED' | string;
  estado?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELED' | string;
  scheduledMessageId?: number | string | null;
  id?: number | string | null;
  error?: string | null;
  mensaje?: string | null;
}

export interface ProgramarMensajeResponseDTO {
  ok?: boolean;
  scheduledBatchId?: number | string | null;
  items?: ProgramarMensajeItemDTO[] | null;
  message?: string | null;
  mensaje?: string | null;
}

export interface MensajeProgramadoDTO {
  id?: number;
  chatId?: number;
  createdBy?: number;
  message?: string;
  scheduledAt?: string;
  status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELED' | string;
  attempts?: number;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sentAt?: string | null;
}

export interface ChatClearResponseDTO {
  ok: boolean;
  chatId: number;
  userId: number;
  clearedBeforeMessageId?: number | null;
  clearedAt?: string | null;
}

export interface ChatMuteRequestDTO {
  durationSeconds?: number | null;
  mutedForever?: boolean;
}

export interface ChatMuteStateDTO {
  ok?: boolean;
  chatId: number;
  userId: number;
  muted: boolean;
  mutedForever?: boolean;
  mutedUntil?: string | null;
}

export interface AddUsersToGroupRequestDTO {
  userIds: number[];
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private baseUrl = `${environment.backendBaseUrl}/api/chat`;
  private starredMessagesBaseUrl = `${environment.backendBaseUrl}/api/mensajes`;

  constructor(private http: HttpClient) {}

  private mapUserChatListError(err: any): Observable<never> {
    const status = Number(err?.status || 0);
    if (status === 403) {
      return throwError(() => ({
        ...err,
        code: 'CHAT_LIST_FORBIDDEN',
        userMessage:
          'No tienes permisos para consultar chats de este usuario.',
      }));
    }
    return throwError(() => err);
  }

  private buildAuthHeaders(): HttpHeaders | undefined {
    const token = String(
      localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ).trim();
    if (!token) return undefined;
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

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

  crearChatIndividual(
    dto: ChatIndividualCreateDTO
  ): Observable<ChatIndividualDTO> {
    return this.http.post<ChatIndividualDTO>(`${this.baseUrl}/individual`, dto);
  }

  listarConversacionesAdmin(
    usuarioId: number,
    includeExpired: boolean = true
  ): Observable<any[]> {
    const params = new HttpParams().set(
      'includeExpired',
      String(!!includeExpired)
    );
    return this.http.get<any[]>(
      `${this.baseUrl}/admin/usuario/${usuarioId}/chats`,
      { params }
    );
  }

  listarMensajesAdminPorChat(
    chatId: number,
    includeExpired: boolean = true
  ): Observable<any[]> {
    const token = localStorage.getItem('token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;
    const params = new HttpParams().set(
      'includeExpired',
      String(!!includeExpired)
    );

    return this.http.get<any[]>(
      `${this.baseUrl}/admin/chat/${chatId}/mensajes`,
      headers ? { headers, params } : { params }
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
    payload: { nombreGrupo?: string; descripcion?: string; fotoGrupo?: string }
  ): Observable<GroupDetailDTO> {
    return this.http.patch<GroupDetailDTO>(`${this.baseUrl}/grupal/${groupId}`, payload);
  }

  agregarUsuariosAGrupo(
    groupId: number,
    payload: AddUsersToGroupRequestDTO
  ): Observable<any> {
    const normalizedUserIds = Array.from(
      new Set(
        (payload?.userIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
    return this.http.post(`${this.baseUrl}/${groupId}/usuarios`, {
      userIds: normalizedUserIds,
    });
  }

  invitarMiembroAGrupo(groupId: number, userId: number): Observable<any> {
    return this.agregarUsuariosAGrupo(groupId, { userIds: [userId] });
  }

  asignarAdminGrupo(groupId: number, userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/grupal/${groupId}/admins/${userId}`, {});
  }

  quitarAdminGrupo(groupId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/grupal/${groupId}/admins/${userId}`);
  }

  expulsarMiembroDeGrupo(groupId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/grupal/${groupId}/miembros/${userId}`);
  }

  listarGrupalesPorUsuario(): Observable<ChatGrupalDTO[]> {
    const usuarioId = this.resolveAuthenticatedUserId();
    if (!usuarioId) {
      return throwError(() => new Error('AUTH_USER_ID_UNAVAILABLE'));
    }
    return this.http.get<ChatGrupalDTO[]>(
      `${this.baseUrl}/grupal/usuario/${usuarioId}`
    ).pipe(catchError((err) => this.mapUserChatListError(err)));
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

  listarTodosLosChats(): Observable<ChatListItemDTO[]> {
    const usuarioId = this.resolveAuthenticatedUserId();
    if (!usuarioId) {
      return throwError(() => new Error('AUTH_USER_ID_UNAVAILABLE'));
    }
    return this.http.get<ChatListItemDTO[]>(
      `${this.baseUrl}/usuario/${usuarioId}/todos`
    ).pipe(catchError((err) => this.mapUserChatListError(err)));
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

  restaurarMensaje(mensajeId: number): Observable<MensajeDTO> {
    return this.http.post<MensajeDTO>(
      `${this.baseUrl}/mensajes/${mensajeId}/restaurar`,
      {}
    );
  }

  listarDestacados(
    page: number = 0,
    size: number = 10,
    sort?: string
  ): Observable<StarredMessagesPageDTO | StarredMessageDTO[]> {
    let params = new HttpParams()
      .set('page', String(Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0))
      .set('size', String(Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 10));

    const normalizedSort = String(sort || '').trim();
    if (normalizedSort) {
      params = params.set('sort', normalizedSort);
    }

    const headers = this.buildAuthHeaders();
    return this.http.get<StarredMessagesPageDTO | StarredMessageDTO[]>(
      `${this.starredMessagesBaseUrl}/destacados`,
      headers ? { params, headers } : { params }
    );
  }

  destacarMensaje(mensajeId: number): Observable<unknown> {
    const headers = this.buildAuthHeaders();
    return this.http.post(
      `${this.starredMessagesBaseUrl}/${mensajeId}/destacar`,
      {},
      headers ? { headers } : {}
    );
  }

  quitarDestacado(mensajeId: number): Observable<unknown> {
    const headers = this.buildAuthHeaders();
    return this.http.delete(`${this.starredMessagesBaseUrl}/${mensajeId}/destacar`, headers ? { headers } : {});
  }

  obtenerMensajeFijado(chatId: number): Observable<ChatPinnedMessageDTO> {
    return this.http.get<ChatPinnedMessageDTO>(
      `${this.baseUrl}/${chatId}/pinned-message`
    );
  }

  fijarMensaje(
    chatId: number,
    payload: PinMessageRequestDTO
  ): Observable<ChatPinnedMessageDTO> {
    return this.http.post<ChatPinnedMessageDTO>(
      `${this.baseUrl}/${chatId}/pinned-message`,
      payload
    );
  }

  desfijarMensaje(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${chatId}/pinned-message`);
  }

  clearChat(chatId: number): Observable<ChatClearResponseDTO> {
    return this.http.post<ChatClearResponseDTO>(
      `${this.baseUrl}/${chatId}/clear`,
      null
    );
  }

  async hideChatForMe(chatId: number): Promise<void> {
    await firstValueFrom(
      this.http.patch<void>(`${this.baseUrl}/${chatId}/hide-for-me`, null)
    );
  }

  // Preparado para backend de "silenciar notificaciones por chat".
  muteChat(
    chatId: number,
    payload: ChatMuteRequestDTO
  ): Observable<ChatMuteStateDTO> {
    return this.http.post<ChatMuteStateDTO>(
      `${this.baseUrl}/${chatId}/mute`,
      payload
    );
  }

  // Preparado para backend de "activar notificaciones".
  unmuteChat(chatId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${chatId}/mute`);
  }

  listMutedChats(): Observable<ChatMuteStateDTO[]> {
    return this.http.get<ChatMuteStateDTO[]>(`${this.baseUrl}/muted`);
  }

  // Alias temporal para no romper llamadas existentes durante la migracion.
  listarMensajesDestacados(
    page: number = 0,
    size: number = 10,
    sort?: string
  ): Observable<StarredMessagesPageDTO | StarredMessageDTO[]> {
    return this.listarDestacados(page, size, sort);
  }

  // Alias temporal para no romper llamadas existentes durante la migracion.
  quitarDestacadoMensaje(mensajeId: number): Observable<unknown> {
    return this.quitarDestacado(mensajeId);
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
      `${environment.backendBaseUrl}/api/estado/usuarios`,
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

  votarEncuesta(
    mensajeId: number,
    payload: PollVoteRestRequestDTO
  ): Observable<MensajeDTO> {
    return this.http.post<MensajeDTO>(
      `${this.baseUrl}/poll/${mensajeId}/vote`,
      payload
    );
  }

  programarMensajes(
    payload: ProgramarMensajeRequestDTO
  ): Observable<ProgramarMensajeResponseDTO> {
    return this.http.post<ProgramarMensajeResponseDTO>(
      `${this.baseUrl}/scheduled`,
      payload
    );
  }

  listarMensajesProgramados(
    status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELED' | string
  ): Observable<MensajeProgramadoDTO[]> {
    let params = new HttpParams();
    const normalizedStatus = String(status || '').trim();
    if (normalizedStatus) {
      params = params.set('status', normalizedStatus);
    }
    const options = params.keys().length > 0 ? { params } : {};
    return this.http.get<MensajeProgramadoDTO[]>(
      `${this.baseUrl}/scheduled`,
      options
    );
  }

  cancelarMensajeProgramado(id: number): Observable<MensajeProgramadoDTO> {
    return this.http.post<MensajeProgramadoDTO>(
      `${this.baseUrl}/scheduled/${id}/cancel`,
      {}
    );
  }
}
