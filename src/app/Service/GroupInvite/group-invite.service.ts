import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments';

interface InviteDecisionDTO {
  userId: number;
}

interface CreateInviteDTO {
  groupId: number;
  inviteeId: number;
}

@Injectable({
  providedIn: 'root',
})
export class GroupInviteService {
  private baseUrl = `${environment.backendBaseUrl}/api/group-invites`;

  constructor(private http: HttpClient) {}

  accept(inviteId: number, userId: number): Observable<void> {
    const body: InviteDecisionDTO = { userId };
    return this.http.post<void>(`${this.baseUrl}/${inviteId}/accept`, body);
  }

  decline(inviteId: number, userId: number): Observable<void> {
    const body: InviteDecisionDTO = { userId };
    return this.http.post<void>(`${this.baseUrl}/${inviteId}/decline`, body);
  }

  create(groupId: number, inviteeId: number): Observable<void> {
    const body: CreateInviteDTO = { groupId, inviteeId };
    return this.http.post<void>(`${this.baseUrl}`, body);
  }
}
