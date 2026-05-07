import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, defer, from, switchMap } from 'rxjs';
import { AiReportAnalysisRequestDTO } from '../../Interface/AiReportAnalysisRequestDTO';
import { AiReportAnalysisResponseDTO } from '../../Interface/AiReportAnalysisResponseDTO';
import { AiConversationSummaryRequestDTO } from '../../Interface/AiConversationSummaryRequestDTO';
import { AiConversationSummaryResponseDTO } from '../../Interface/AiConversationSummaryResponseDTO';
import { AiEncryptedConversationSummaryRequestDTO } from '../../Interface/AiEncryptedConversationSummaryRequestDTO';
import { AiPollDraftRequestDTO } from '../../Interface/AiPollDraftRequestDTO';
import { AiPollDraftResponseDTO } from '../../Interface/AiPollDraftResponseDTO';
import { AiQuickRepliesRequestDTO } from '../../Interface/AiQuickRepliesRequestDTO';
import { AiQuickRepliesResponseDTO } from '../../Interface/AiQuickRepliesResponseDTO';
import {
  AiEncryptedMessageSearchRequest,
  AiEncryptedMessageSearchResponse,
} from '../../Interface/AiEncryptedMessageSearchDTO';
import { environment } from '../../environments';
import { CryptoService } from '../crypto/crypto.service';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private readonly backendBaseUrl = String(environment.backendBaseUrl).replace(
    /\/+$/,
    ''
  );
  private auditPublicKeyInitPromise: Promise<void> | null = null;

  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService,
    private authService: AuthService
  ) {}

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
    ).pipe(switchMap((response) => from(this.normalizeQuickRepliesResponse(response))));
  }

  public generarBorradorEncuestaConIa(
    request: AiPollDraftRequestDTO
  ): Observable<AiPollDraftResponseDTO> {
    return defer(() => from(this.buildEncryptedPollDraftRequest(request))).pipe(
      switchMap((encryptedRequest) =>
        this.http.post<AiPollDraftResponseDTO>(
          `${this.backendBaseUrl}/api/ai/generar-borrador-encuesta`,
          encryptedRequest
        )
      ),
      switchMap((response) => from(this.normalizePollDraftResponse(response)))
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

  public buscarMensajesEncrypted(
    request: AiEncryptedMessageSearchRequest
  ): Observable<AiEncryptedMessageSearchResponse> {
    return this.http.post<AiEncryptedMessageSearchResponse>(
      `${this.backendBaseUrl}/api/ai/buscar-mensajes/encrypted`,
      request
    ).pipe(switchMap((response) => from(this.normalizeEncryptedMessageSearchResponse(response))));
  }

  private getCurrentUserId(): number {
    const fromLocal = Number(localStorage.getItem('usuarioId') || 0);
    if (Number.isFinite(fromLocal) && fromLocal > 0) return fromLocal;
    const fromSession = Number(sessionStorage.getItem('usuarioId') || 0);
    if (Number.isFinite(fromSession) && fromSession > 0) return fromSession;
    return 0;
  }

  private extractAuditPublicKeyFromSource(source: any): string | null {
    if (typeof source === 'string') {
      const key = source.trim();
      return key || null;
    }
    if (!source || typeof source !== 'object') return null;
    const candidates = [
      source.publicKey,
      source.auditPublicKey,
      source.publicKeyAdminAudit,
      source.publicKey_admin_audit,
      source.forAdminPublicKey,
      source?.audit?.publicKey,
      source?.keys?.auditPublicKey,
      source?.keys?.forAdminPublicKey,
    ];
    for (const candidate of candidates) {
      const key = String(candidate ?? '').trim();
      if (key) return key;
    }
    return null;
  }

  private persistAuditPublicKeyLocal(key: string): void {
    const normalized = String(key || '').trim();
    if (!normalized) return;
    localStorage.setItem('auditPublicKey', normalized);
    localStorage.setItem('publicKey_admin_audit', normalized);
    localStorage.setItem('forAdminPublicKey', normalized);
  }

  private getStoredAuditPublicKey(): string | null {
    const local =
      localStorage.getItem('auditPublicKey') ||
      localStorage.getItem('publicKey_admin_audit') ||
      localStorage.getItem('forAdminPublicKey') ||
      '';
    const localKey = String(local).trim();
    if (localKey) return localKey;

    const envKey = String((environment as any)?.auditPublicKey ?? '').trim();
    if (envKey) {
      this.persistAuditPublicKeyLocal(envKey);
      return envKey;
    }
    return null;
  }

  private async ensureAuditPublicKeyForE2E(): Promise<void> {
    if (this.getStoredAuditPublicKey()) return;
    if (this.auditPublicKeyInitPromise) {
      await this.auditPublicKeyInitPromise;
      return;
    }
    this.auditPublicKeyInitPromise = new Promise<void>((resolve) => {
      this.authService.getAuditPublicKey().subscribe({
        next: (resp: any) => {
          const key =
            this.extractAuditPublicKeyFromSource(resp) ||
            this.extractAuditPublicKeyFromSource(resp?.data) ||
            this.extractAuditPublicKeyFromSource(resp?.result);
          if (key) this.persistAuditPublicKeyLocal(key);
          resolve();
        },
        error: () => resolve(),
      });
    });
    await this.auditPublicKeyInitPromise;
    this.auditPublicKeyInitPromise = null;
  }

  private async buildEncryptedPollDraftRequest(
    request: AiPollDraftRequestDTO
  ): Promise<AiPollDraftRequestDTO> {
    const chatGrupalId = Number(request?.chatGrupalId || 0);
    if (!Number.isFinite(chatGrupalId) || chatGrupalId <= 0) {
      throw new Error('AI_POLL_DRAFT_CHAT_REQUIRED');
    }
    const maxOpciones = Number(request?.maxOpciones || 0);
    const estilo = String(request?.estilo || 'NORMAL').trim() || 'NORMAL';
    const mensajes = Array.isArray(request?.mensajes)
      ? request.mensajes.filter(
          (item) => !!String(item?.encryptedPayload || '').trim()
        )
      : [];
    if (mensajes.length === 0) {
      throw new Error('AI_POLL_DRAFT_CONTEXT_ENCRYPTED_REQUIRED');
    }

    await this.ensureAuditPublicKeyForE2E();
    const adminPublicBase64 = String(this.getStoredAuditPublicKey() || '').trim();
    if (!adminPublicBase64) throw new Error('AI_POLL_DRAFT_AUDIT_KEY_MISSING');
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPublicBase64);

    const encryptedMessages = await Promise.all(
      mensajes.map(async (msg) => {
        const plain = JSON.stringify({
          id: msg.id,
          autor: msg.autor,
          esUsuarioActual: msg.esUsuarioActual === true,
          fecha: msg.fecha,
          encryptedPayload: String(msg.encryptedPayload || '').trim(),
        });
        const aesKey = await this.cryptoService.generateAESKey();
        const aesRawBase64 = await this.cryptoService.exportAESKey(aesKey);
        const { iv, ciphertext } = await this.cryptoService.encryptAES(plain, aesKey);
        const forAdmin = await this.cryptoService.encryptRSA(aesRawBase64, adminRsaKey);
        return {
          id: msg.id,
          autor: msg.autor,
          esUsuarioActual: msg.esUsuarioActual,
          fecha: msg.fecha,
          encryptedPayload: JSON.stringify({ type: 'E2E', iv, ciphertext, forAdmin }),
        };
      })
    );

    return {
      chatGrupalId: Math.round(chatGrupalId),
      mensajes: encryptedMessages,
      maxOpciones: Number.isFinite(maxOpciones) && maxOpciones > 0 ? Math.round(maxOpciones) : 4,
      estilo,
    };
  }

  private parseAiEncryptedPayload(raw: unknown): any {
    let candidate = String(raw || '').trim();
    if (!candidate) return {};
    for (let i = 0; i < 4; i++) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') return parsed;
        if (typeof parsed === 'string') {
          candidate = parsed.trim();
          continue;
        }
        return {};
      } catch {
        const quoted =
          (candidate.startsWith('"') && candidate.endsWith('"')) ||
          (candidate.startsWith("'") && candidate.endsWith("'"));
        if (quoted) {
          candidate = candidate.slice(1, -1).trim();
          continue;
        }
        if (candidate.includes('\\"')) {
          const unescaped = candidate.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          if (unescaped !== candidate) {
            candidate = unescaped.trim();
            continue;
          }
        }
        return {};
      }
    }
    return {};
  }

  private extractAesBase64FromEnvelope(raw: unknown): string {
    const text = String(raw || '').trim();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return text;
      const candidates = [
        parsed?.aesKey,
        parsed?.aes,
        parsed?.key,
        parsed?.value,
        parsed?.raw,
        parsed?.base64,
        parsed?.secret,
      ];
      for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (value) return value;
      }
      return text;
    } catch {
      return text;
    }
  }

  private async decryptAiPayload(raw: unknown): Promise<string> {
    const payload = this.parseAiEncryptedPayload(raw);
    const iv = String(payload?.iv || '').trim();
    const ciphertext = String(payload?.ciphertext || '').trim();
    if (!iv || !ciphertext) throw new Error('AI_ENCRYPTED_PAYLOAD_MISSING');

    const myId = this.getCurrentUserId();
    if (!myId) throw new Error('AI_USER_ID_MISSING');
    const privKeyBase64 = String(localStorage.getItem(`privateKey_${myId}`) || '').trim();
    if (!privKeyBase64) throw new Error('AI_DECRYPT_PRIVATE_KEY_MISSING');
    const privateKey = await this.cryptoService.importPrivateKey(privKeyBase64);

    const envelopeCandidates: string[] = [];
    const pushIfAny = (value: unknown): void => {
      const text = String(value || '').trim();
      if (!text) return;
      if (!envelopeCandidates.includes(text)) envelopeCandidates.push(text);
    };
    pushIfAny(payload?.forReceptor);
    pushIfAny(payload?.forEmisor);
    pushIfAny(payload?.forAdmin);
    const forReceptores =
      payload?.forReceptores && typeof payload.forReceptores === 'object'
        ? (payload.forReceptores as Record<string, unknown>)
        : null;
    if (forReceptores) {
      pushIfAny(forReceptores[String(myId)]);
      for (const candidate of Object.values(forReceptores)) pushIfAny(candidate);
    }

    let aesRaw = '';
    for (const envelope of envelopeCandidates) {
      try {
        aesRaw = await this.cryptoService.decryptRSA(envelope, privateKey);
        if (aesRaw) break;
      } catch {}
    }
    if (!aesRaw) throw new Error('AI_DECRYPT_ENVELOPE_MISSING');
    const aesBase64 = this.extractAesBase64FromEnvelope(aesRaw);
    const aesKey = await this.cryptoService.importAESKey(aesBase64);
    const plain = await this.cryptoService.decryptAES(ciphertext, iv, aesKey);
    return String(plain || '').trim();
  }

  private async normalizePollDraftResponse(
    response: AiPollDraftResponseDTO | null | undefined
  ): Promise<AiPollDraftResponseDTO> {
    if (!response) {
      return {
        success: false,
        codigo: 'AI_POLL_DRAFT_EMPTY_RESPONSE',
        mensaje: 'Respuesta vacia del backend.',
        pregunta: '',
        opciones: [],
        multipleRespuestas: false,
      };
    }
    if (!response.encryptedPayload) return response;

    const plain = await this.decryptAiPayload(response.encryptedPayload);
    let parsed: any = {};
    try {
      parsed = JSON.parse(plain);
    } catch {
      parsed = {};
    }

    return {
      ...response,
      success: parsed?.success ?? response.success,
      codigo: String(parsed?.codigo || response.codigo || '').trim(),
      mensaje: String(parsed?.mensaje || response.mensaje || '').trim(),
      pregunta: String(parsed?.pregunta || response.pregunta || '').trim(),
      opciones: Array.isArray(parsed?.opciones)
        ? parsed.opciones.map((x: unknown) => String(x || '').trim()).filter((x: string) => !!x)
        : Array.isArray(response.opciones)
        ? response.opciones
        : [],
      multipleRespuestas:
        parsed?.multipleRespuestas ?? response.multipleRespuestas === true,
    };
  }

  private async normalizeQuickRepliesResponse(
    response: AiQuickRepliesResponseDTO | null | undefined
  ): Promise<AiQuickRepliesResponseDTO> {
    if (!response) {
      return {
        success: false,
        codigo: 'AI_QUICK_REPLIES_EMPTY_RESPONSE',
        mensaje: 'Respuesta vacia del backend.',
        sugerencias: [],
      };
    }
    if (!response.encryptedPayload) return response;

    const plain = await this.decryptAiPayload(response.encryptedPayload);
    let parsed: any = {};
    try {
      parsed = JSON.parse(plain);
    } catch {
      parsed = {};
    }

    return {
      ...response,
      success: parsed?.success ?? response.success,
      codigo: String(parsed?.codigo || response.codigo || '').trim(),
      mensaje: String(parsed?.mensaje || response.mensaje || '').trim(),
      sugerencias: Array.isArray(parsed?.sugerencias)
        ? parsed.sugerencias
            .map((x: unknown) => String(x || '').trim())
            .filter((x: string) => !!x)
        : Array.isArray(response.sugerencias)
        ? response.sugerencias
        : [],
    };
  }

  private async normalizeEncryptedMessageSearchResponse(
    response: AiEncryptedMessageSearchResponse | null | undefined
  ): Promise<AiEncryptedMessageSearchResponse> {
    if (!response) {
      return {
        success: false,
        codigo: 'AI_MESSAGE_SEARCH_EMPTY_RESPONSE',
        mensaje: 'Respuesta vacia del backend.',
        resumenBusqueda: null,
        resultados: [],
      };
    }

    const publicResults = Array.isArray(response.resultados) ? response.resultados : [];
    if (!response.encryptedPayload) {
      return {
        ...response,
        resultados: publicResults.map((item) => this.normalizeSearchResultFallback(item)),
      };
    }

    try {
      const plain = await this.decryptAiPayload(response.encryptedPayload);
      let parsed: any = {};
      try {
        parsed = JSON.parse(plain);
      } catch {
        parsed = {};
      }

      const decryptedResults = Array.isArray(parsed?.resultados) ? parsed.resultados : [];
      const byMessageId = new Map<number, any>();
      for (const item of decryptedResults) {
        const messageId = Number(item?.mensajeId || 0);
        if (Number.isFinite(messageId) && messageId > 0) byMessageId.set(messageId, item);
      }

      return {
        ...response,
        resumenBusqueda:
          String(parsed?.resumenBusqueda || response.resumenBusqueda || '').trim() || null,
        resultados: publicResults.map((item) => {
          const messageId = Number(item?.mensajeId || 0);
          const decrypted = byMessageId.get(messageId);
          return this.mergeSearchResultWithDecryptedData(item, decrypted);
        }),
      };
    } catch {
      return {
        ...response,
        resultados: publicResults.map((item) => this.normalizeSearchResultFallback(item)),
      };
    }
  }

  private mergeSearchResultWithDecryptedData(
    publicResult: any,
    decryptedResult: any
  ): any {
    return this.normalizeSearchResultFallback({
      ...publicResult,
      contenidoPayloadOriginal:
        String(publicResult?.contenido || '').trim() || publicResult?.contenido || null,
      contenido:
        String(decryptedResult?.contenido || '').trim() ||
        publicResult?.contenido ||
        null,
      contenidoVisible:
        String(decryptedResult?.contenidoVisible || '').trim() ||
        publicResult?.contenidoVisible ||
        null,
      motivoCoincidencia:
        String(decryptedResult?.motivoCoincidencia || '').trim() ||
        publicResult?.motivoCoincidencia ||
        null,
    });
  }

  private normalizeSearchResultFallback(result: any): any {
    const tipo = String(result?.tipoMensaje || '').trim().toUpperCase();
    const mime = String(result?.mimeType || '').trim().toLowerCase();
    const contentKind = String(result?.contentKind || '').trim().toUpperCase();

    let placeholder = '[Mensaje]';
    if (tipo === 'AUDIO' || mime.startsWith('audio/')) placeholder = '[Audio]';
    else if (tipo === 'IMAGE' || mime.startsWith('image/')) placeholder = '[Imagen]';
    else if (tipo === 'STICKER' || contentKind === 'STICKER') placeholder = '[Sticker]';
    else if (tipo === 'FILE') placeholder = '[Archivo]';
    else if (tipo === 'TEXT' || String(result?.contenido || '').trim() || String(result?.contenidoVisible || '').trim()) {
      placeholder = '[Mensaje de texto]';
    }

    const contenido = String(result?.contenido || '').trim() || null;
    const contenidoVisible = String(result?.contenidoVisible || '').trim() || placeholder;
    const motivoCoincidencia = String(result?.motivoCoincidencia || '').trim() || null;

    return {
      ...result,
      contenidoPayloadOriginal:
        String(result?.contenidoPayloadOriginal || '').trim() ||
        String(result?.contenido || '').trim() ||
        result?.contenidoPayloadOriginal ||
        result?.contenido ||
        null,
      contenido,
      contenidoVisible,
      motivoCoincidencia,
    };
  }
}
