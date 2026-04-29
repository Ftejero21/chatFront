import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AiConversationSummaryRequestDTO } from '../../Interface/AiConversationSummaryRequestDTO';
import { AiConversationSummaryResponseDTO } from '../../Interface/AiConversationSummaryResponseDTO';
import { environment } from '../../environments';

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private readonly backendBaseUrl = String(environment.backendBaseUrl).replace(
    /\/+$/,
    ''
  );

  constructor(private http: HttpClient) {}

  public resumirConversacion(
    request: AiConversationSummaryRequestDTO
  ): Observable<AiConversationSummaryResponseDTO> {
    return this.http.post<AiConversationSummaryResponseDTO>(
      `${this.backendBaseUrl}/api/ai/resumir-conversacion`,
      request
    );
  }
}
