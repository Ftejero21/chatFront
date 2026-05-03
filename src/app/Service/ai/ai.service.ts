import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AiReportAnalysisRequestDTO } from '../../Interface/AiReportAnalysisRequestDTO';
import { AiReportAnalysisResponseDTO } from '../../Interface/AiReportAnalysisResponseDTO';
import { AiConversationSummaryRequestDTO } from '../../Interface/AiConversationSummaryRequestDTO';
import { AiConversationSummaryResponseDTO } from '../../Interface/AiConversationSummaryResponseDTO';
import { AiEncryptedConversationSummaryRequestDTO } from '../../Interface/AiEncryptedConversationSummaryRequestDTO';
import { AiPollDraftRequestDTO } from '../../Interface/AiPollDraftRequestDTO';
import { AiPollDraftResponseDTO } from '../../Interface/AiPollDraftResponseDTO';
import { AiQuickRepliesRequestDTO } from '../../Interface/AiQuickRepliesRequestDTO';
import { AiQuickRepliesResponseDTO } from '../../Interface/AiQuickRepliesResponseDTO';
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

  public resumirConversacionEncrypted(
    request: AiEncryptedConversationSummaryRequestDTO
  ): Observable<AiConversationSummaryResponseDTO> {
    return this.http.post<AiConversationSummaryResponseDTO>(
      `${this.backendBaseUrl}/api/ai/resumir-conversacion/encrypted`,
      request
    );
  }

  public generarRespuestasRapidas(
    request: AiQuickRepliesRequestDTO
  ): Observable<AiQuickRepliesResponseDTO> {
    return this.http.post<AiQuickRepliesResponseDTO>(
      `${this.backendBaseUrl}/api/ai/respuestas-rapidas`,
      request
    );
  }

  public generarBorradorEncuestaConIa(
    request: AiPollDraftRequestDTO
  ): Observable<AiPollDraftResponseDTO> {
    return this.http.post<AiPollDraftResponseDTO>(
      `${this.backendBaseUrl}/api/ai/generar-borrador-encuesta`,
      request
    );
  }

  public analizarDenunciaConIa(
    request: AiReportAnalysisRequestDTO
  ): Observable<AiReportAnalysisResponseDTO> {
    return this.http.post<AiReportAnalysisResponseDTO>(
      `${this.backendBaseUrl}/api/ai/analizar-denuncia`,
      request
    );
  }
}
