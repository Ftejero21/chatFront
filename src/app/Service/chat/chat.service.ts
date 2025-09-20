import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ChatIndividualDTO } from '../../Interface/ChatIndividualDTO ';
import { ChatIndividualCreateDTO } from '../../Interface/ChatIndividualCreateDTO';
import { ChatGrupalDTO } from '../../Interface/ChatGrupalDTO';
import { Observable } from 'rxjs';
import { MensajeDTO } from '../../Interface/MensajeDTO';
import { MessagueSalirGrupoDTO } from '../../Interface/MessagueSalirGrupoDTO';
import { LeaveGroupRequestDTO } from '../../Interface/LeaveGroupRequestDTO';
import { EsMiembroDTO } from '../../Interface/EsMiembroDTO';

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

  crearChatGrupal(dto: ChatGrupalDTO): Observable<ChatGrupalDTO> {
    return this.http.post<ChatGrupalDTO>(`${this.baseUrl}/grupal`, dto);
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

  listarTodosLosChats(usuarioId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/usuario/${usuarioId}/todos`);
  }

  listarMensajesPorChat(chatId: number): Observable<MensajeDTO[]> {
    return this.http.get<MensajeDTO[]>(`${this.baseUrl}/mensajes/${chatId}`);
  }

  listarMensajesPorChatGrupal(chatId: number) {
    return this.http.get<MensajeDTO[]>(
      `${this.baseUrl}/mensajes/grupo/${chatId}`
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
}
