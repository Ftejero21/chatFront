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

export interface PollVoteRestRequestDTO {
  optionId: string;
  chatId?: number;
  pollId?: string | number;
  userId?: number;
}

export interface ProgramarMensajeRequestDTO {
  message: string;
  contenido?: string;
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

  invitarMiembroAGrupo(groupId: number, userId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/grupal/${groupId}/invitar`, { userId });
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

  restaurarMensaje(mensajeId: number): Observable<MensajeDTO> {
    return this.http.post<MensajeDTO>(
      `${this.baseUrl}/mensajes/${mensajeId}/restaurar`,
      {}
    );
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
