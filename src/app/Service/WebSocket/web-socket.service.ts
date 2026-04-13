import { Injectable } from '@angular/core';
import SockJS from 'sockjs-client/dist/sockjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import { MensajeDTO } from '../../Interface/MensajeDTO';
import { NotificationWS } from '../../Interface/NotificationWS';
import { CallEndWS } from '../../Interface/CallEndWS';
import { CallAnswerWS } from '../../Interface/CallAnswerWS';
import { CallInviteWS } from '../../Interface/CallInviteWS';
import { MensajeReaccionDTO } from '../../Interface/MensajeReaccionDTO';
import { UnbanAppealEventDTO } from '../../Interface/UnbanAppealEventDTO';
import { WsUserErrorDTO } from '../../Interface/WsUserErrorDTO';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { environment } from '../../environments';

type SdpOfferDTO = {
  callId: string;
  fromUserId: number;
  toUserId: number;
  sdp: string;
};
type SdpAnswerDTO = {
  callId: string;
  fromUserId: number;
  toUserId: number;
  sdp: string;
};
type IceDTO = {
  callId: string;
  fromUserId: number;
  toUserId: number;
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
};

type ActiveCallSession = {
  callId: string;
  callerId: number;
  calleeId: number;
  ended: boolean;
  updatedAtMs: number;
};

export type PollVoteWSRequestDTO = {
  chatId: number;
  mensajeId: number;
  optionId: string;
  pollId?: string | number;
  userId?: number;
};

type PendingSubscriptionReceipt = {
  destination: string;
  topicKind:
    | 'chat'
    | 'chat-reaccion'
    | 'estado'
    | 'leido'
    | 'bloqueos'
    | 'group-chat'
    | 'typing'
    | 'audio'
    | 'group-typing'
    | 'group-audio';
  timeoutId: ReturnType<typeof setTimeout>;
};

type GroupTypingEvent = {
  emisorId: number;
  escribiendo: boolean;
  chatId: number;
  emisorNombre?: string;
  emisorApellido?: string;
};

type GroupAudioEvent = {
  emisorId: number;
  grabandoAudio: boolean;
  chatId: number;
  emisorNombre?: string;
  emisorApellido?: string;
};

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  public stompClient: Client;
  private socketUrl = `${environment.backendBaseUrl}/ws-chat`;
  private subsGrupales = new Map<number, StompSubscription>();
  private subsTypingGrupales = new Map<number, StompSubscription>();
  private subsAudioGrupales = new Map<number, StompSubscription>();
  private subsCallInvite?: StompSubscription;
  private subsCallAnswer?: StompSubscription;
  private subsUserErrors?: StompSubscription;
  private subsOffer?: StompSubscription;
  private subsAnswer?: StompSubscription;
  private subsIce?: StompSubscription;
  private subsCallEnd?: StompSubscription;
  private userErrorsHandlers = new Set<(payload: WsUserErrorDTO) => void>();
  private connectCallbacksQueue: Array<() => void> = [];
  private pendingSubscriptionReceipts = new Map<string, PendingSubscriptionReceipt>();
  private subChatPersonal?: StompSubscription;
  private subEstadoPersonal?: StompSubscription;
  private subLeidosPersonal?: StompSubscription;
  private subBloqueosPersonal?: StompSubscription;
  private subReaccionesPersonal?: StompSubscription;
  private subTypingPersonal?: StompSubscription;
  private subAudioPersonal?: StompSubscription;
  private chatHandlers = new Set<(mensaje: MensajeDTO) => void>();
  private chatDeleteHandlers = new Set<(mensaje: MensajeDTO) => void>();
  private estadoHandlersByTargetUserId = new Map<number, Set<(estado: string) => void>>();
  private leidosHandlers = new Set<(mensajeId: number) => void>();
  private bloqueosHandlers = new Set<
    (payload: { blockerId: number; type: 'BLOCKED' | 'UNBLOCKED' }) => void
  >();
  private reaccionesHandlers = new Set<(payload: MensajeReaccionDTO) => void>();
  private allowedGroupChatIds = new Set<number>();
  private groupChatHandlers = new Map<number, (m: MensajeDTO) => void>();
  private groupTypingHandlers = new Map<number, (data: GroupTypingEvent) => void>();
  private groupAudioHandlers = new Map<number, (data: GroupAudioEvent) => void>();
  private typingHandlers = new Set<(emisorId: number, escribiendo: boolean) => void>();
  private audioHandlers = new Set<
    (
      emisorId: number,
      grabandoAudio: boolean,
      chatId?: number,
      emisorNombre?: string
    ) => void
  >();
  private readonly subscribeReceiptTimeoutMs = 4500;
  private activeCallSession: ActiveCallSession | null = null;

  constructor(private rateLimitService: RateLimitService) {
    this.stompClient = new Client({
      brokerURL: undefined,
      webSocketFactory: () => new SockJS(this.socketUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectHeaders: this.buildConnectHeaders(),
      // debug logger disabled
    });
    this.configureClientLifecycleHandlers();
  }

  conectar(onConnected: () => void): void {
    this.connectCallbacksQueue.push(onConnected);
    this.stompClient.connectHeaders = this.buildConnectHeaders();

    if (this.stompClient?.connected) {
      this.flushConnectCallbacksQueue();
      return;
    }

    const isActive = (this.stompClient as any)?.active === true;
    if (isActive) return;

    this.stompClient.activate();
  }

  private configureClientLifecycleHandlers(): void {
    this.stompClient.onConnect = (_frame) => {
      const token = this.readAuthToken();
      this.logInfo(`[WS][ESTADO] connect token=${token ? 'present' : 'missing'}`);
      this.subsUserErrors = undefined;
      this.ensureUserErrorsSubscription();
      this.ensureChatPersonalSubscription();
      this.ensureEstadoPersonalSubscription();
      this.ensureLeidosPersonalSubscription();
      this.ensureBloqueosPersonalSubscription();
      this.ensureReaccionesPersonalSubscription();
      this.ensureTypingPersonalSubscription();
      this.ensureAudioPersonalSubscription();
      this.restoreDesiredGroupSubscriptions();
      this.flushConnectCallbacksQueue();
    };

    this.stompClient.onStompError = (frame) => {
      const receiptId = String(frame?.headers?.['receipt-id'] || '').trim();
      const message = String(frame?.headers?.['message'] || '').trim();
      const body = String(frame?.body || '').trim();
      const pending = receiptId
        ? this.pendingSubscriptionReceipts.get(receiptId)
        : undefined;
      if (pending) {
        this.clearPendingReceipt(receiptId);
        const pendingChatId = this.extractGroupChatIdFromDestination(pending.destination);
        if (this.shouldEmitEstadoLog(pending.topicKind, pending.destination)) {
          this.logWarn(
            `[WS][ESTADO] SUBSCRIBE rechazado destino=${pending.destination} chatId=${pendingChatId ?? 'n/a'} topic=${pending.topicKind} receipt=${receiptId}`
          );
        }
      }

      const destination =
        pending?.destination || this.extractTopicDestinationFromText(`${message} ${body}`);
      const groupChatId = destination
        ? this.extractGroupChatIdFromDestination(destination)
        : null;
      const destinationUserId = destination
        ? this.extractPersonalUserIdFromDestination(destination)
        : null;
      const resolvedAuthUserId = this.resolveAuthenticatedUserId();
      if (
        destination &&
        this.isProtectedSubscribeDestination(destination) &&
        this.shouldEmitEstadoLog(undefined, destination)
      ) {
        this.logWarn(
          `[WS][ESTADO] rechazo de suscripcion destino=${destination} chatId=${groupChatId ?? 'n/a'} destinationUserId=${destinationUserId ?? 'n/a'} authUserId=${resolvedAuthUserId ?? 'n/a'}`
        );
      }

      if (
        destination &&
        this.isGroupSubscriptionDestination(destination) &&
        groupChatId &&
        /(NOT_GROUP_MEMBER|CHAT_NOT_FOUND|CHAT_INACTIVO|DESTINATION_INVALID|AccessDenied)/i.test(
          `${message} ${body}`
        )
      ) {
        this.desuscribirseDeGrupo(groupChatId, 'subscribe-rejected');
      }

      if (this.shouldEmitEstadoLog(undefined, destination || pending?.destination)) {
        this.logError('[WS][ESTADO] onStompError', {
          message,
          receiptId,
          destination,
          destinationUserId,
          authUserId: resolvedAuthUserId,
          body,
        });
      }
    };

    this.stompClient.onWebSocketClose = (event) => {
      this.resetManagedSubscriptionHandlesAfterSocketClose();
    };

    this.stompClient.onWebSocketError = (event) => {
      void event;
    };
  }

  private flushConnectCallbacksQueue(): void {
    if (this.connectCallbacksQueue.length === 0) return;
    const callbacks = [...this.connectCallbacksQueue];
    this.connectCallbacksQueue = [];
    for (const callback of callbacks) {
      try {
        callback();
      } catch (err) {
        void err;
      }
    }
  }

  private readAuthToken(): string {
    return String(
      localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ).trim();
  }

  private buildConnectHeaders(): Record<string, string> {
    const token = this.readAuthToken();
    return {
      Authorization: `Bearer ${token}`,
      usuarioId: String(
        localStorage.getItem('usuarioId') || sessionStorage.getItem('usuarioId') || ''
      ).trim(),
    };
  }

  private isProtectedSubscribeDestination(destination: string): boolean {
    const candidate = String(destination || '').trim();
    return (
      /^\/topic\/chat\.\d+(\.errors)?$/.test(candidate) ||
      /^\/topic\/chat\.reaccion\.\d+$/.test(candidate) ||
      /^\/topic\/estado\.\d+$/.test(candidate) ||
      /^\/topic\/leido\.\d+$/.test(candidate) ||
      /^\/topic\/user\/\d+\/bloqueos$/.test(candidate) ||
      /^\/topic\/chat\.grupal\.\d+$/.test(candidate) ||
      candidate.startsWith('/topic/escribiendo.') ||
      candidate.startsWith('/topic/audio.grabando.')
    );
  }

  private extractTopicDestinationFromText(text: string): string | null {
    const match = String(text || '').match(/\/topic\/[a-zA-Z0-9._-]+/);
    return match?.[0] || null;
  }

  private extractGroupChatIdFromDestination(destination: string): number | null {
    const candidate = String(destination || '').trim();
    const match = candidate.match(
      /^\/topic\/(?:chat\.grupal|escribiendo\.grupo|audio\.grabando\.grupo)\.(\d+)$/
    );
    if (!match?.[1]) return null;
    const chatId = Number(match[1]);
    if (!Number.isFinite(chatId) || chatId <= 0) return null;
    return Math.round(chatId);
  }

  private isGroupSubscriptionDestination(destination: string): boolean {
    return this.extractGroupChatIdFromDestination(destination) != null;
  }

  private shouldEmitEstadoLog(
    topicKind?: PendingSubscriptionReceipt['topicKind'],
    destination?: string
  ): boolean {
    if (topicKind === 'estado') return true;
    const candidate = String(destination || '').trim();
    return /^\/topic\/estado\.\d+$/.test(candidate);
  }

  private shouldEmitEstadoConsoleLog(args: unknown[]): boolean {
    return args.some(
      (arg) => typeof arg === 'string' && String(arg).includes('[WS][ESTADO]')
    );
  }

  private logInfo(...args: unknown[]): void {
    if (!this.shouldEmitEstadoConsoleLog(args)) return;
    console.info(...args);
  }

  private logWarn(...args: unknown[]): void {
    if (!this.shouldEmitEstadoConsoleLog(args)) return;
    console.warn(...args);
  }

  private logError(...args: unknown[]): void {
    if (!this.shouldEmitEstadoConsoleLog(args)) return;
    console.error(...args);
  }

  private extractPersonalUserIdFromDestination(destination: string): number | null {
    const candidate = String(destination || '').trim();
    const patterns = [
      /^\/topic\/chat\.(\d+)(?:\.errors)?$/,
      /^\/topic\/chat\.reaccion\.(\d+)$/,
      /^\/topic\/estado\.(\d+)$/,
      /^\/topic\/leido\.(\d+)$/,
      /^\/topic\/user\/(\d+)\/bloqueos$/,
      /^\/topic\/escribiendo\.(\d+)$/,
      /^\/topic\/audio\.grabando\.(\d+)$/,
    ];
    for (const pattern of patterns) {
      const match = candidate.match(pattern);
      if (!match?.[1]) continue;
      const userId = Number(match[1]);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      return Math.round(userId);
    }
    return null;
  }

  private isAllowedGroupChatId(chatId: number): boolean {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return false;
    if (this.allowedGroupChatIds.size === 0) return false;
    return this.allowedGroupChatIds.has(Math.round(normalizedChatId));
  }

  private clearPendingReceipt(receiptId: string): void {
    const pending = this.pendingSubscriptionReceipts.get(receiptId);
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingSubscriptionReceipts.delete(receiptId);
  }

  private summarizePayloadForLog(raw: unknown, maxLen = 220): string {
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '(empty)';
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
  }

  private resetManagedSubscriptionHandlesAfterSocketClose(): void {
    for (const receiptId of Array.from(this.pendingSubscriptionReceipts.keys())) {
      this.clearPendingReceipt(receiptId);
    }
    this.subsUserErrors = undefined;
    this.subChatPersonal = undefined;
    this.subEstadoPersonal = undefined;
    this.subLeidosPersonal = undefined;
    this.subBloqueosPersonal = undefined;
    this.subReaccionesPersonal = undefined;
    this.subTypingPersonal = undefined;
    this.subAudioPersonal = undefined;
    this.subsGrupales.clear();
    this.subsTypingGrupales.clear();
    this.subsAudioGrupales.clear();
  }

  private restoreDesiredGroupSubscriptions(): void {
    for (const chatId of this.groupChatHandlers.keys()) {
      this.ensureGroupChatSubscription(chatId);
    }
    for (const chatId of this.groupTypingHandlers.keys()) {
      this.ensureGroupTypingSubscription(chatId);
    }
    for (const chatId of this.groupAudioHandlers.keys()) {
      this.ensureGroupAudioSubscription(chatId);
    }
  }

  private subscribeWithReceiptLog(
    destination: string,
    topicKind: PendingSubscriptionReceipt['topicKind'],
    onMessage: (message: any) => void
  ): StompSubscription | null {
    if (!this.stompClient?.connected) {
      if (this.shouldEmitEstadoLog(topicKind, destination)) {
        this.logWarn(`[WS][ESTADO] no conectado, no se puede suscribir a ${destination}`);
      }
      return null;
    }

    const receiptId = `sub-${topicKind}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const groupChatId = this.extractGroupChatIdFromDestination(destination);
    const destinationUserId = this.extractPersonalUserIdFromDestination(destination);
    const authUserId = this.resolveAuthenticatedUserId();

    if (this.shouldEmitEstadoLog(topicKind, destination)) {
      this.logInfo(
        `[WS][ESTADO] subscribing ${topicKind} => ${destination} chatId=${groupChatId ?? 'n/a'} destinationUserId=${destinationUserId ?? 'n/a'} authUserId=${authUserId ?? 'n/a'}`
      );
    }

    const sub = this.stompClient.subscribe(destination, onMessage, {
      receipt: receiptId,
    });

    const timeoutId = setTimeout(() => {
      if (!this.pendingSubscriptionReceipts.has(receiptId)) return;
      this.pendingSubscriptionReceipts.delete(receiptId);
      if (this.shouldEmitEstadoLog(topicKind, destination)) {
        this.logWarn(
          `[WS][ESTADO] sin receipt en ${this.subscribeReceiptTimeoutMs}ms destino=${destination} chatId=${groupChatId ?? 'n/a'} destinationUserId=${destinationUserId ?? 'n/a'} authUserId=${authUserId ?? 'n/a'}`
        );
      }
    }, this.subscribeReceiptTimeoutMs);

    this.pendingSubscriptionReceipts.set(receiptId, {
      destination,
      topicKind,
      timeoutId,
    });

    this.stompClient.watchForReceipt(receiptId, () => {
      this.clearPendingReceipt(receiptId);
      if (this.shouldEmitEstadoLog(topicKind, destination)) {
        this.logInfo(
          `[WS][ESTADO] receipt OK destino=${destination} chatId=${groupChatId ?? 'n/a'} destinationUserId=${destinationUserId ?? 'n/a'} authUserId=${authUserId ?? 'n/a'}`
        );
      }
    });

    return sub;
  }
  esperarConexion(callback: () => void): void {
    const check = () => {
      if (this.stompClient?.connected) {
        callback();
      } else {
        setTimeout(check, 100); // vuelve a intentar en 100ms
      }
    };
    check();
  }

  // --- NUEVO: ENVO A CHAT GRUPAL ---
  enviarMensajeGrupal(mensaje: MensajeDTO): void {
    // receptorId = chatId del grupo
    if (this.stompClient?.connected) {
      if (!this.canPublishToRateLimitedDestination('/app/chat.grupal')) return;
      this.stompClient.publish({
        destination: '/app/chat.grupal',
        body: JSON.stringify(mensaje),
      });
    } else {
      this.logWarn(' WS no conectado. Mensaje grupal no enviado.');
    }
  }

  // --- NUEVO: SUSCRIPCIN A UN GRUPO ---
  suscribirseAChatGrupal(
    chatId: number,
    handler: (m: MensajeDTO) => void
  ): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;
    if (!this.isAllowedGroupChatId(normalizedChatId)) return;
    this.groupChatHandlers.set(normalizedChatId, handler);
    if (this.stompClient?.connected) {
      this.ensureGroupChatSubscription(normalizedChatId);
      return;
    }
    this.esperarConexion(() => this.ensureGroupChatSubscription(normalizedChatId));
  }

  private ensureGroupChatSubscription(chatId: number): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;
    if (!this.isAllowedGroupChatId(normalizedChatId)) {
      this.desuscribirseDeGrupo(normalizedChatId, 'membership-not-allowed');
      return;
    }
    if (!this.stompClient?.connected) return;
    if (this.subsGrupales.has(normalizedChatId)) return;

    const handler = this.groupChatHandlers.get(normalizedChatId);
    if (!handler) return;

    const destination = `/topic/chat.grupal.${normalizedChatId}`;
    const sub = this.subscribeWithReceiptLog(destination, 'group-chat', (msg) => {
      try {
        const payload: any = JSON.parse(msg.body);
        if (payload.chatId == null) payload.chatId = normalizedChatId;
        handler(payload as MensajeDTO);
      } catch (e) {
        this.logError(' Error parseando mensaje grupal:', e);
      }
    });
    if (sub) this.subsGrupales.set(normalizedChatId, sub);
  }

  public sincronizarSuscripcionesChatGrupalPermitidas(
    allowedChatIds: number[],
    reason = 'sync-group-membership'
  ): void {
    const allowed = new Set<number>(
      (Array.isArray(allowedChatIds) ? allowedChatIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
        .map((id) => Math.round(id))
    );
    this.allowedGroupChatIds = allowed;

    const allKnownIds = new Set<number>([
      ...Array.from(this.groupChatHandlers.keys()),
      ...Array.from(this.subsGrupales.keys()),
      ...Array.from(this.groupTypingHandlers.keys()),
      ...Array.from(this.subsTypingGrupales.keys()),
      ...Array.from(this.groupAudioHandlers.keys()),
      ...Array.from(this.subsAudioGrupales.keys()),
    ]);

    for (const chatId of allKnownIds) {
      if (allowed.has(chatId)) continue;
      this.desuscribirseDeGrupo(chatId, reason);
    }

    if (!this.stompClient?.connected) return;
    for (const chatId of allowed) {
      if (this.groupChatHandlers.has(chatId)) this.ensureGroupChatSubscription(chatId);
      if (this.groupTypingHandlers.has(chatId)) this.ensureGroupTypingSubscription(chatId);
      if (this.groupAudioHandlers.has(chatId)) this.ensureGroupAudioSubscription(chatId);
    }
  }

  suscribirseANotificaciones(
    userId: number,
    handler: (payload: NotificationWS) => void
  ): void {
    this.esperarConexion(() => {
      this.stompClient.subscribe(`/topic/notifications.${userId}`, (msg) => {
        try {
          const payload = JSON.parse(msg.body);
          handler(payload as NotificationWS);
        } catch (e) {
          this.logError(' Error parseando notificacin WS:', e);
        }
      });
    });
  }

  suscribirseABloqueos(
    topicUserId: number,
    handler: (payload: { blockerId: number; type: 'BLOCKED' | 'UNBLOCKED' }) => void
  ): void {
    this.bloqueosHandlers.add(handler);
    if (this.stompClient?.connected) {
      this.ensureBloqueosPersonalSubscription(topicUserId);
      return;
    }
    this.esperarConexion(() => this.ensureBloqueosPersonalSubscription(topicUserId));
  }

  private ensureBloqueosPersonalSubscription(requestedTopicUserId?: number): void {
    if (!this.stompClient?.connected) return;
    if (this.bloqueosHandlers.size === 0) return;

    const authUserId = this.resolveAuthenticatedUserId();
    if (!authUserId) return;

    void requestedTopicUserId;

    const destination = `/topic/user/${authUserId}/bloqueos`;
    if (this.subBloqueosPersonal) return;

    const sub = this.subscribeWithReceiptLog(destination, 'bloqueos', (msg) => {
      try {
        const payload = JSON.parse(msg.body) as {
          blockerId: number;
          type: 'BLOCKED' | 'UNBLOCKED';
        };
        for (const cb of this.bloqueosHandlers) {
          try {
            cb(payload);
          } catch (err) {
            void err;
          }
        }
      } catch (e) {
        this.logError(' Error parseando actualizacin de bloqueo WS:', e);
      }
    });

    if (sub) this.subBloqueosPersonal = sub;
  }

  suscribirseABaneos(
    userId: number,
    handler: (payload: any) => void
  ): void {
    this.esperarConexion(() => {
      this.stompClient.subscribe(`/user/queue/baneos`, (msg) => {
        try {
          const payload = JSON.parse(msg.body);
          handler(payload);
        } catch (e) {
          this.logError(' Error parseando baneo WS:', e);
        }
      });
    });
  }

  suscribirseAErroresUsuario(handler: (payload: WsUserErrorDTO) => void): void {
    this.userErrorsHandlers.clear();
    this.userErrorsHandlers.add(handler);
    this.esperarConexion(() => this.ensureUserErrorsSubscription());
  }

  private ensureUserErrorsSubscription(): void {
    if (!this.stompClient?.connected) return;
    if (this.subsUserErrors) return;

    this.subsUserErrors = this.stompClient.subscribe(`/user/queue/errors`, (msg) => {
      try {
        const payload = JSON.parse(msg.body) as WsUserErrorDTO;
        this.rateLimitService.registerWsRateLimit(payload);
        for (const handler of this.userErrorsHandlers) {
          try {
            handler(payload);
          } catch (err) {
            this.logError(' Error en handler de /user/queue/errors:', err);
          }
        }
      } catch (e) {
        this.logError(' Error parseando /user/queue/errors:', e);
      }
    });
  }

  private canPublishToRateLimitedDestination(destination: string): boolean {
    if (!this.stompClient?.connected) return false;
    const remaining = this.rateLimitService.getWsDestinationRemainingSeconds(destination);
    if (remaining <= 0) return true;
    this.rateLimitService.announceWsActionBlocked(destination, remaining);
    return false;
  }

  suscribirseAEscribiendoGrupo(
    chatId: number,
    callback: (data: GroupTypingEvent) => void
  ): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;
    if (!this.isAllowedGroupChatId(normalizedChatId)) return;
    this.groupTypingHandlers.set(normalizedChatId, callback);
    if (this.stompClient?.connected) {
      this.ensureGroupTypingSubscription(normalizedChatId);
      return;
    }
    this.esperarConexion(() => this.ensureGroupTypingSubscription(normalizedChatId));
  }

  private ensureGroupTypingSubscription(chatId: number): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;
    if (!this.isAllowedGroupChatId(normalizedChatId)) {
      this.desuscribirseDeGrupo(normalizedChatId, 'membership-not-allowed');
      return;
    }
    if (!this.stompClient?.connected) return;
    if (this.subsTypingGrupales.has(normalizedChatId)) return;

    const callback = this.groupTypingHandlers.get(normalizedChatId);
    if (!callback) return;

    const destination = `/topic/escribiendo.grupo.${normalizedChatId}`;
    const sub = this.subscribeWithReceiptLog(destination, 'group-typing', (message) => {
      try {
        const data = JSON.parse(message.body);
        callback({
          emisorId: Number(data.emisorId),
          escribiendo: !!data.escribiendo,
          chatId: Number(data.chatId),
          emisorNombre: data.emisorNombre,
          emisorApellido: data.emisorApellido,
        });
      } catch (e) {
        this.logError(' Error parseando escribiendo.grupo:', e);
      }
    });

    if (sub) this.subsTypingGrupales.set(normalizedChatId, sub);
  }

  suscribirseAGrabandoAudioGrupo(
    chatId: number,
    callback: (data: GroupAudioEvent) => void
  ): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;
    if (!this.isAllowedGroupChatId(normalizedChatId)) return;
    this.groupAudioHandlers.set(normalizedChatId, callback);
    if (this.stompClient?.connected) {
      this.ensureGroupAudioSubscription(normalizedChatId);
      return;
    }
    this.esperarConexion(() => this.ensureGroupAudioSubscription(normalizedChatId));
  }

  private ensureGroupAudioSubscription(chatId: number): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;
    if (!this.isAllowedGroupChatId(normalizedChatId)) {
      this.desuscribirseDeGrupo(normalizedChatId, 'membership-not-allowed');
      return;
    }
    if (!this.stompClient?.connected) return;
    if (this.subsAudioGrupales.has(normalizedChatId)) return;

    const callback = this.groupAudioHandlers.get(normalizedChatId);
    if (!callback) return;

    const destination = `/topic/audio.grabando.grupo.${normalizedChatId}`;
    const sub = this.subscribeWithReceiptLog(destination, 'group-audio', (message) => {
      try {
        const data = JSON.parse(message.body);
        callback({
          emisorId: Number(data.emisorId),
          grabandoAudio: !!data.grabandoAudio,
          chatId: Number(data.chatId),
          emisorNombre: data.emisorNombre,
          emisorApellido: data.emisorApellido,
        });
      } catch (e) {
        this.logError(' Error parseando audio.grabando.grupo:', e);
      }
    });

    if (sub) this.subsAudioGrupales.set(normalizedChatId, sub);
  }

  enviarEscribiendoGrupo(
    chatId: number,
    escribiendo: boolean
  ): void {
    if (!this.stompClient?.connected) return;
    const emisorId = this.resolveAuthenticatedUserId();
    if (!emisorId) {
      this.logWarn('WS no conectado a un usuario autenticado. Typing grupal no enviado.');
      return;
    }
    const dto = { emisorId, chatId, escribiendo };
    this.stompClient.publish({
      destination: '/app/escribiendo.grupo',
      body: JSON.stringify(dto),
    });
  }

  enviarGrabandoAudioGrupo(
    emisorId: number,
    chatId: number,
    grabandoAudio: boolean
  ): void {
    if (!this.stompClient?.connected) return;
    const dto = { emisorId, chatId, grabandoAudio };
    this.stompClient.publish({
      destination: '/app/audio.grabando.grupo',
      body: JSON.stringify(dto),
    });
  }

  iniciarLlamada(callerId: number, calleeId: number, chatId?: number): void {
    if (!this.stompClient?.connected) {
      this.logWarn(' WS no conectado. No se pudo iniciar la llamada.');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/call.start')) return;
    const payload = { callerId, calleeId, chatId };
    this.stompClient.publish({
      destination: '/app/call.start',
      body: JSON.stringify(payload),
    });
  }

  /** B  responder (aceptar / rechazar)  A */
  responderLlamada(
    callId: string,
    callerId: number,
    calleeId: number,
    accepted: boolean,
    reason?: string
  ): void {
    if (!this.stompClient?.connected) {
      this.logWarn(' WS no conectado. No se pudo responder la llamada.');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/call.answer')) return;
    const payload = { callId, callerId, calleeId, accepted, reason };
    this.stompClient.publish({
      destination: '/app/call.answer',
      body: JSON.stringify(payload),
    });
  }

  /** cualquiera  colgar */
  colgarLlamada(callId: string, byUserId: number): void {
    if (!this.stompClient?.connected) {
      this.logWarn(' WS no conectado. No se pudo colgar la llamada.');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/call.end')) return;
    this.markCallEnded(callId);
    const payload = { callId, byUserId };
    this.stompClient.publish({
      destination: '/app/call.end',
      body: JSON.stringify(payload),
    });
  }

  /** Suscripcin a INVITACIONES entrantes (para el usuario logueado) */
  suscribirseALlamadasEntrantes(
    miUsuarioId: number,
    handler: (m: CallInviteWS) => void
  ): void {
    if (!this.stompClient?.connected) return;
    if (this.subsCallInvite) return;

    this.subsCallInvite = this.stompClient.subscribe(
      `/topic/call.invite.${miUsuarioId}`,
      (msg) => {
        try {
          const payload: any = JSON.parse(msg.body);
          if (payload?.event === 'CALL_INVITE') {
            handler(payload as CallInviteWS);
          }
        } catch (e) {
          this.logError(' Error parseando CALL_INVITE', e);
        }
      }
    );
  }

  /** Suscripcin a RESPUESTAS de llamadas (para el usuario logueado) */
  suscribirseARespuestasLlamada(
    miUsuarioId: number,
    handler: (m: CallAnswerWS) => void
  ): void {
    if (!this.stompClient?.connected) return;
    if (this.subsCallAnswer) return;

    this.subsCallAnswer = this.stompClient.subscribe(
      `/topic/call.answer.${miUsuarioId}`,
      (msg) => {
        try {
          const payload: any = JSON.parse(msg.body);
          if (payload?.event === 'CALL_ANSWER') {
            handler(payload as CallAnswerWS);
          }
        } catch (e) {
          this.logError(' Error parseando CALL_ANSWER', e);
        }
      }
    );
  }

  /** Suscripcin a FIN de llamada (para el usuario logueado) */
  suscribirseAFinLlamada(
    miUsuarioId: number,
    handler: (m: CallEndWS) => void
  ): void {
    if (!this.stompClient?.connected) return;
    if (this.subsCallEnd) return;

    this.subsCallEnd = this.stompClient.subscribe(
      `/topic/call.end.${miUsuarioId}`,
      (msg) => {
        try {
          const payload: any = JSON.parse(msg.body);
          if (payload?.event === 'CALL_ENDED') {
            handler(payload as CallEndWS);
          }
        } catch (e) {
          this.logError(' Error parseando CALL_ENDED', e);
        }
      }
    );
  }

  desuscribirseDeChatGrupal(chatId: number, reason = 'manual'): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;
    const sub = this.subsGrupales.get(normalizedChatId);
    if (sub) {
      try {
        sub.unsubscribe();
      } catch {}
      void reason;
      this.subsGrupales.delete(normalizedChatId);
    }
    this.groupChatHandlers.delete(normalizedChatId);
  }

  public desuscribirseIndicadoresGrupo(chatId: number, reason = 'manual'): void {
    const normalizedChatId = Number(chatId);
    if (!Number.isFinite(normalizedChatId) || normalizedChatId <= 0) return;

    const typingSub = this.subsTypingGrupales.get(normalizedChatId);
    if (typingSub) {
      try {
        typingSub.unsubscribe();
      } catch {}
      void reason;
      this.subsTypingGrupales.delete(normalizedChatId);
    }
    this.groupTypingHandlers.delete(normalizedChatId);

    const audioSub = this.subsAudioGrupales.get(normalizedChatId);
    if (audioSub) {
      try {
        audioSub.unsubscribe();
      } catch {}
      void reason;
      this.subsAudioGrupales.delete(normalizedChatId);
    }
    this.groupAudioHandlers.delete(normalizedChatId);
  }

  public desuscribirseDeGrupo(chatId: number, reason = 'manual'): void {
    this.desuscribirseDeChatGrupal(chatId, reason);
    this.desuscribirseIndicadoresGrupo(chatId, reason);
  }

  async desconectar(): Promise<void> {
    if (this.stompClient && this.stompClient.connected) {
      try {
        await this.stompClient.deactivate();
      } catch (e) {
        void e;
      }
    }
    for (const receiptId of Array.from(this.pendingSubscriptionReceipts.keys())) {
      this.clearPendingReceipt(receiptId);
    }
    this.connectCallbacksQueue = [];
    this.limpiarSuscripcionesChatUI();
    this.activeCallSession = null;
  }

  enviarVotoEncuesta(
    payload: PollVoteWSRequestDTO
  ): 'sent' | 'not_connected' | 'rate_limited' | 'error' {
    if (!this.stompClient?.connected) return 'not_connected';
    if (!this.canPublishToRateLimitedDestination('/app/chat.poll.vote')) {
      return 'rate_limited';
    }
    try {
      this.stompClient.publish({
        destination: '/app/chat.poll.vote',
        body: JSON.stringify(payload),
      });
      return 'sent';
    } catch (err) {
      this.logError(' Error enviando voto de encuesta WS:', err);
      return 'error';
    }
  }

  enviarMensajeIndividual(mensaje: MensajeDTO): void {
    if (this.stompClient.connected) {
      if (!this.canPublishToRateLimitedDestination('/app/chat.individual')) return;
      this.stompClient.publish({
        destination: '/app/chat.individual',
        body: JSON.stringify(mensaje),
      });
    } else {
      this.logWarn(
        ' No conectado al WebSocket. El mensaje no se ha enviado.'
      );
    }
  }

  public enviarEstado(
    estado: 'Conectado' | 'Ausente' | 'Desconectado'
  ): boolean {
    if (!this.stompClient?.connected) return false;
    if (!this.hasValidPresenceAuthContext()) {
      this.logWarn('[WS][ESTADO] send omitido: auth context missing para /app/estado');
      return false;
    }
    const authenticatedUserId = this.resolveAuthenticatedUserId();
    if (!authenticatedUserId) {
      this.logWarn('WS no conectado a un usuario autenticado. Estado no enviado.');
      return false;
    }
    const dto = { estado };
    this.stompClient.publish({
      destination: '/app/estado',
      body: JSON.stringify(dto),
    });
    return true;
  }

  enviarEstadoConectado(): void {
    this.enviarEstado('Conectado');
  }

  suscribirseAEstado(
    targetUserId: number,
    callback: (estado: string) => void
  ): StompSubscription | null {
    const normalizedTargetUserId = Number(targetUserId);
    if (!Number.isFinite(normalizedTargetUserId) || normalizedTargetUserId <= 0) {
      return null;
    }

    let handlers = this.estadoHandlersByTargetUserId.get(normalizedTargetUserId);
    if (!handlers) {
      handlers = new Set<(estado: string) => void>();
      this.estadoHandlersByTargetUserId.set(normalizedTargetUserId, handlers);
    }
    handlers.add(callback);

    if (this.stompClient?.connected) {
      this.ensureEstadoPersonalSubscription();
    } else {
      this.esperarConexion(() => this.ensureEstadoPersonalSubscription());
    }

    const localId = `local-estado-${normalizedTargetUserId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const localSub: StompSubscription = {
      id: localId,
      unsubscribe: () => {
        const setRef = this.estadoHandlersByTargetUserId.get(normalizedTargetUserId);
        if (setRef) {
          setRef.delete(callback);
          if (setRef.size === 0) {
            this.estadoHandlersByTargetUserId.delete(normalizedTargetUserId);
          }
        }
        if (this.estadoHandlersByTargetUserId.size === 0 && this.subEstadoPersonal) {
          try {
            this.subEstadoPersonal.unsubscribe();
          } catch {}
          const authUserId = this.resolveAuthenticatedUserId();
          const destination = authUserId
            ? `/topic/estado.${authUserId}`
            : '/topic/estado.{authUserId}';
          this.logInfo(
            `[WS][ESTADO] unsubscribe destino=${destination} reason=estado-no-handlers`
          );
          this.subEstadoPersonal = undefined;
        }
      },
    };

    return localSub;
  }

  private hasValidPresenceAuthContext(): boolean {
    const token = this.readAuthToken();
    if (!token) return false;
    const authUserId = this.resolveAuthenticatedUserId();
    return Number.isFinite(authUserId) && Number(authUserId) > 0;
  }

  private normalizeCanonicalEstado(
    raw: unknown
  ): { estado: 'Conectado' | 'Ausente' | 'Desconectado'; normalized: boolean } | null {
    const value = String(raw ?? '').trim();
    if (!value) return null;
    if (value === 'Conectado' || value === 'Ausente' || value === 'Desconectado') {
      return { estado: value, normalized: false };
    }

    const lowered = value.toLowerCase();
    if (['conectado', 'online', 'activo', 'true', '1'].includes(lowered)) {
      return { estado: 'Conectado', normalized: true };
    }
    if (['ausente', 'away'].includes(lowered)) {
      return { estado: 'Ausente', normalized: true };
    }
    if (['desconectado', 'offline', 'inactivo', 'false', '0'].includes(lowered)) {
      return { estado: 'Desconectado', normalized: true };
    }
    return null;
  }

  private parsePresencePayload(
    rawBody: unknown,
    destination: string
  ): { userId: number; estado: 'Conectado' | 'Ausente' | 'Desconectado' } | null {
    const body = String(rawBody ?? '').trim();
    if (!body) {
      this.logWarn(`[WS][ESTADO] rx ignorado: payload vacio destino=${destination}`);
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      this.logWarn(
        `[WS][ESTADO] rx ignorado: payload no es JSON valido destino=${destination} payload=${this.summarizePayloadForLog(
          body
        )}`
      );
      return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.logWarn(
        `[WS][ESTADO] rx ignorado: payload debe ser objeto con userId+estado destino=${destination}`
      );
      return null;
    }

    const userId = Number(parsed?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      this.logWarn(
        `[WS][ESTADO] rx ignorado: userId invalido destino=${destination} payload=${this.summarizePayloadForLog(
          body
        )}`
      );
      return null;
    }

    const normalized = this.normalizeCanonicalEstado(parsed?.estado);
    if (!normalized) {
      this.logWarn(
        `[WS][ESTADO] rx ignorado: estado invalido destino=${destination} userId=${Math.round(
          userId
        )} rawEstado=${String(parsed?.estado ?? '')}`
      );
      return null;
    }

    if (normalized.normalized) {
      this.logWarn(
        `[WS][ESTADO] rx estado normalizado destino=${destination} userId=${Math.round(
          userId
        )} rawEstado=${String(parsed?.estado ?? '')} normalizedEstado=${normalized.estado}`
      );
    }

    return {
      userId: Math.round(userId),
      estado: normalized.estado,
    };
  }

  private dispatchPresenceEvent(
    userId: number,
    estado: 'Conectado' | 'Ausente' | 'Desconectado',
    destination: string
  ): void {
    const handlers = this.estadoHandlersByTargetUserId.get(userId);
    const totalHandlers = handlers?.size || 0;
    if (!handlers || totalHandlers === 0) {
      this.logInfo(
        `[WS][ESTADO] apply skipped destino=${destination} userId=${userId} reason=no-handlers`
      );
      return;
    }
    this.logInfo(
      `[WS][ESTADO] apply destino=${destination} userId=${userId} estado=${estado} handlers=${totalHandlers}`
    );
    for (const handler of handlers) {
      try {
        handler(estado);
      } catch (err) {
        this.logError('[WS][ESTADO] error en handler de estado', err);
      }
    }
  }

  private ensureEstadoPersonalSubscription(): void {
    if (!this.stompClient?.connected) return;
    if (this.estadoHandlersByTargetUserId.size === 0) return;

    const authUserId = this.resolveAuthenticatedUserId();
    if (!authUserId) {
      this.logWarn(
        '[WS][ESTADO] subscribe omitido: no hay authUserId o token valido para construir el topic personal.'
      );
      return;
    }

    const destination = `/topic/estado.${authUserId}`;
    if (this.subEstadoPersonal) return;

    const sub = this.subscribeWithReceiptLog(destination, 'estado', (message) => {
      const payloadSummary = this.summarizePayloadForLog(message?.body);
      this.logInfo(`[WS][ESTADO] evento destino=${destination} payload=${payloadSummary}`);
      const parsed = this.parsePresencePayload(message?.body, destination);
      if (!parsed) return;
      this.logInfo(
        `[WS][ESTADO] rx destino=${destination} userId=${parsed.userId} estado=${parsed.estado}`
      );
      this.dispatchPresenceEvent(parsed.userId, parsed.estado, destination);
    });

    if (sub) this.subEstadoPersonal = sub;
  }

  enviarEstadoDesconectado(): void {
    this.enviarEstado('Desconectado');
  }

  async enviarEstadoDesconectadoConFlush(
    timeoutMs = 250
  ): Promise<void> {
    if (!this.stompClient?.connected) return;
    if (!this.hasValidPresenceAuthContext()) {
      this.logWarn(
        '[WS][ESTADO] send desconectado omitido: auth context missing para /app/estado'
      );
      return;
    }
    const authenticatedUserId = this.resolveAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const dto = {
      estado: 'Desconectado',
    };
    const receiptId = `estado-disconnect-${Date.now()}`;

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      try {
        this.stompClient.watchForReceipt(receiptId, done);
        this.stompClient.publish({
          destination: '/app/estado',
          body: JSON.stringify(dto),
          headers: { receipt: receiptId },
        });
        setTimeout(done, Math.max(50, timeoutMs));
      } catch (e) {
        this.logWarn('[WS][ESTADO] error al publicar estado desconectado', e);
        done();
      }
    });
  }

  private decodeJwtPayload(token: string): Record<string, any> | null {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length < 2) return null;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded =
      payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
    try {
      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private resolveAuthenticatedUserId(): number | null {
    const token = String(
      localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ).trim();
    if (token) {
      const payload = this.decodeJwtPayload(token);
      const candidates = [
        Number(payload?.['usuarioId']),
        Number(payload?.['userId']),
        Number(payload?.['id']),
        Number(payload?.['sub']),
      ];
      for (const candidate of candidates) {
        if (Number.isFinite(candidate) && candidate > 0) {
          return Math.round(candidate);
        }
      }
    }

    const fromSession = Number(
      localStorage.getItem('usuarioId') || sessionStorage.getItem('usuarioId') || 0
    );
    if (Number.isFinite(fromSession) && fromSession > 0) {
      return Math.round(fromSession);
    }

    return null;
  }

  /** Enviar OFERTA SDP (caller -> callee) */
  enviarSdpOffer(payload: SdpOfferDTO): boolean {
    if (!this.stompClient?.connected) return false;
    const route = this.resolveSecureSignalingRoute(payload?.callId, payload?.toUserId);
    const sdp = String(payload?.sdp || '').trim();
    if (!route || !sdp) return false;
    this.stompClient.publish({
      destination: '/app/call.sdp.offer',
      body: JSON.stringify({
        callId: route.callId,
        fromUserId: route.fromUserId,
        toUserId: route.toUserId,
        sdp,
      }),
    });
    return true;
  }

  /** Enviar ANSWER SDP (callee -> caller) */
  enviarSdpAnswer(payload: SdpAnswerDTO): boolean {
    if (!this.stompClient?.connected) return false;
    const route = this.resolveSecureSignalingRoute(payload?.callId, payload?.toUserId);
    const sdp = String(payload?.sdp || '').trim();
    if (!route || !sdp) return false;
    this.stompClient.publish({
      destination: '/app/call.sdp.answer',
      body: JSON.stringify({
        callId: route.callId,
        fromUserId: route.fromUserId,
        toUserId: route.toUserId,
        sdp,
      }),
    });
    return true;
  }

  /** Enviar ICE candidate (ambos sentidos) */
  enviarIce(payload: IceDTO): boolean {
    if (!this.stompClient?.connected) return false;
    const route = this.resolveSecureSignalingRoute(payload?.callId, payload?.toUserId);
    const candidate = String(payload?.candidate || '').trim();
    if (!route || !candidate) return false;
    this.stompClient.publish({
      destination: '/app/call.ice',
      body: JSON.stringify({
        callId: route.callId,
        fromUserId: route.fromUserId,
        toUserId: route.toUserId,
        candidate,
        sdpMid: payload?.sdpMid,
        sdpMLineIndex: payload?.sdpMLineIndex,
      }),
    });
    return true;
  }

  /** Suscribirse a OFERTAS entrantes (para m) */
  suscribirseASdpOffer(
    miUsuarioId: number,
    handler: (m: SdpOfferDTO) => void
  ): void {
    if (!this.stompClient?.connected || this.subsOffer) return;
    this.subsOffer = this.stompClient.subscribe(
      `/topic/call.sdp.offer.${miUsuarioId}`,
      (msg) => {
        try {
          handler(JSON.parse(msg.body) as SdpOfferDTO);
        } catch (e) {
          this.logError(' SDP Offer parse', e);
        }
      }
    );
  }

  /** Suscribirse a ANSWERS entrantes (para m) */
  suscribirseASdpAnswer(
    miUsuarioId: number,
    handler: (m: SdpAnswerDTO) => void
  ): void {
    if (!this.stompClient?.connected || this.subsAnswer) return;
    this.subsAnswer = this.stompClient.subscribe(
      `/topic/call.sdp.answer.${miUsuarioId}`,
      (msg) => {
        try {
          handler(JSON.parse(msg.body) as SdpAnswerDTO);
        } catch (e) {
          this.logError(' SDP Answer parse', e);
        }
      }
    );
  }

  /** Suscribirse a ICE entrantes (para m) */
  suscribirseAIce(miUsuarioId: number, handler: (m: IceDTO) => void): void {
    if (!this.stompClient?.connected || this.subsIce) return;
    this.subsIce = this.stompClient.subscribe(
      `/topic/call.ice.${miUsuarioId}`,
      (msg) => {
        try {
          handler(JSON.parse(msg.body) as IceDTO);
        } catch (e) {
          this.logError(' ICE parse', e);
        }
      }
    );
  }

  public enviarEliminarMensaje(mensaje: MensajeDTO): void {
    if (!this.stompClient?.connected) {
      this.logWarn('WS no conectado. No se pudo enviar chat.eliminar');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/chat.eliminar')) return;
    this.stompClient.publish({
      destination: '/app/chat.eliminar',
      body: JSON.stringify(mensaje),
    });
  }

  public enviarEditarMensaje(mensaje: MensajeDTO): void {
    if (!this.stompClient?.connected) {
      this.logWarn('WS no conectado. No se pudo enviar chat.editar');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/chat.editar')) return;
    this.stompClient.publish({
      destination: '/app/chat.editar',
      body: JSON.stringify(mensaje),
    });
  }

  public suscribirseAEliminarMensaje(
    topicUserId: number,
    callback: (mensaje: MensajeDTO) => void
  ): void {
    this.chatDeleteHandlers.add(callback);
    if (this.stompClient?.connected) {
      this.ensureChatPersonalSubscription(topicUserId);
      return;
    }
    this.esperarConexion(() => this.ensureChatPersonalSubscription(topicUserId));
  }

  marcarMensajesComoLeidos(ids: number[]): void {
    if (!this.stompClient?.connected) return;
    if (!this.canPublishToRateLimitedDestination('/app/mensajes.marcarLeidos')) return;
    this.stompClient.publish({
      destination: '/app/mensajes.marcarLeidos',
      body: JSON.stringify(ids),
    });
  }

  public enviarEscribiendo(
    receptorId: number,
    escribiendo: boolean
  ): void {
    const emisorId = this.resolveAuthenticatedUserId();
    if (!emisorId) {
      this.logWarn('WS no conectado a un usuario autenticado. Typing individual no enviado.');
      return;
    }
    const dto = { emisorId, receptorId, escribiendo };

    this.stompClient?.publish({
      destination: '/app/escribiendo',
      body: JSON.stringify(dto),
    });
  }

  public enviarGrabandoAudio(
    emisorId: number,
    receptorId: number,
    grabandoAudio: boolean
  ): void {
    const dto = { emisorId, receptorId, grabandoAudio };

    this.stompClient?.publish({
      destination: '/app/audio.grabando',
      body: JSON.stringify(dto),
    });
  }

  private ensureChatPersonalSubscription(requestedTopicUserId?: number): void {
    if (!this.stompClient?.connected) return;
    if (this.chatHandlers.size === 0 && this.chatDeleteHandlers.size === 0) return;

    const authUserId = this.resolveAuthenticatedUserId();
    if (!authUserId) return;
    void requestedTopicUserId;

    const destination = `/topic/chat.${authUserId}`;
    if (this.subChatPersonal) return;

    const sub = this.subscribeWithReceiptLog(destination, 'chat', (message) => {
      try {
        const payload = JSON.parse(message.body) as MensajeDTO;
        for (const handler of this.chatHandlers) {
          try {
            handler(payload);
          } catch (err) {
            void err;
          }
        }

        if (payload && payload.id && payload.activo === false) {
          for (const deleteHandler of this.chatDeleteHandlers) {
            try {
              deleteHandler(payload);
            } catch (err) {
              void err;
            }
          }
        }
      } catch (e) {
        void e;
      }
    });

    if (sub) this.subChatPersonal = sub;
  }

  private ensureTypingPersonalSubscription(requestedTopicUserId?: number): void {
    if (!this.stompClient?.connected) return;
    if (this.typingHandlers.size === 0) return;

    const authUserId = this.resolveAuthenticatedUserId();
    if (!authUserId) return;
    void requestedTopicUserId;

    const destination = `/topic/escribiendo.${authUserId}`;
    if (this.subTypingPersonal) return;

    const sub = this.subscribeWithReceiptLog(destination, 'typing', (message) => {
      try {
        const data = JSON.parse(message.body);
        const emisorId = Number(data?.emisorId);
        const escribiendo = !!data?.escribiendo;
        for (const handler of this.typingHandlers) {
          try {
            handler(emisorId, escribiendo);
          } catch (err) {
            void err;
          }
        }
      } catch (e) {
        void e;
      }
    });
    if (sub) this.subTypingPersonal = sub;
  }

  private ensureAudioPersonalSubscription(requestedTopicUserId?: number): void {
    if (!this.stompClient?.connected) return;
    if (this.audioHandlers.size === 0) return;

    const authUserId = this.resolveAuthenticatedUserId();
    if (!authUserId) return;
    void requestedTopicUserId;

    const destination = `/topic/audio.grabando.${authUserId}`;
    if (this.subAudioPersonal) return;

    const sub = this.subscribeWithReceiptLog(destination, 'audio', (message) => {
      try {
        const data = JSON.parse(message.body);
        const emisorId = Number(data?.emisorId);
        const grabandoAudio = !!data?.grabandoAudio;
        const chatId = data?.chatId != null ? Number(data.chatId) : undefined;
        const emisorNombre =
          typeof data?.emisorNombre === 'string' ? data.emisorNombre : undefined;

        for (const handler of this.audioHandlers) {
          try {
            handler(emisorId, grabandoAudio, chatId, emisorNombre);
          } catch (err) {
            void err;
          }
        }
      } catch (e) {
        void e;
      }
    });
    if (sub) this.subAudioPersonal = sub;
  }

  suscribirseAEscribiendo(
    topicUserId: number,
    callback: (emisorId: number, escribiendo: boolean) => void
  ): void {
    this.typingHandlers.add(callback);
    if (this.stompClient?.connected) {
      this.ensureTypingPersonalSubscription(topicUserId);
      return;
    }
    this.esperarConexion(() => this.ensureTypingPersonalSubscription(topicUserId));
  }

  suscribirseAGrabandoAudio(
    topicUserId: number,
    callback: (
      emisorId: number,
      grabandoAudio: boolean,
      chatId?: number,
      emisorNombre?: string
    ) => void
  ): void {
    this.audioHandlers.add(callback);
    if (this.stompClient?.connected) {
      this.ensureAudioPersonalSubscription(topicUserId);
      return;
    }
    this.esperarConexion(() => this.ensureAudioPersonalSubscription(topicUserId));
  }

  public limpiarSuscripcionesTypingAudioPersonales(): void {
    if (this.subTypingPersonal) {
      try {
        this.subTypingPersonal.unsubscribe();
      } catch {}
      this.subTypingPersonal = undefined;
    }
    if (this.subAudioPersonal) {
      try {
        this.subAudioPersonal.unsubscribe();
      } catch {}
      this.subAudioPersonal = undefined;
    }
    this.typingHandlers.clear();
    this.audioHandlers.clear();
  }

  public limpiarSuscripcionChatPersonal(): void {
    if (this.subChatPersonal) {
      try {
        this.subChatPersonal.unsubscribe();
      } catch {}
      this.subChatPersonal = undefined;
    }
    this.chatHandlers.clear();
    this.chatDeleteHandlers.clear();
  }

  public limpiarSuscripcionesChatUI(): void {
    this.limpiarSuscripcionChatPersonal();
    this.limpiarSuscripcionesTypingAudioPersonales();
    this.limpiarSuscripcionesPersonalesProtegidas();
    const allGroupIds = new Set<number>([
      ...Array.from(this.subsGrupales.keys()),
      ...Array.from(this.subsTypingGrupales.keys()),
      ...Array.from(this.subsAudioGrupales.keys()),
      ...Array.from(this.groupChatHandlers.keys()),
      ...Array.from(this.groupTypingHandlers.keys()),
      ...Array.from(this.groupAudioHandlers.keys()),
    ]);
    for (const chatId of allGroupIds) {
      this.desuscribirseDeGrupo(chatId, 'cleanup-ui');
    }
    this.allowedGroupChatIds.clear();
  }

  private limpiarSuscripcionesPersonalesProtegidas(): void {
    const authUserId = this.resolveAuthenticatedUserId();

    if (this.subEstadoPersonal) {
      try {
        this.subEstadoPersonal.unsubscribe();
      } catch {}
      const destination = authUserId
        ? `/topic/estado.${authUserId}`
        : '/topic/estado.{authUserId}';
      this.logInfo(`[WS][ESTADO] unsubscribe destino=${destination} reason=cleanup-personal`);
      this.subEstadoPersonal = undefined;
    }
    if (this.subLeidosPersonal) {
      try {
        this.subLeidosPersonal.unsubscribe();
      } catch {}
      this.subLeidosPersonal = undefined;
    }
    if (this.subBloqueosPersonal) {
      try {
        this.subBloqueosPersonal.unsubscribe();
      } catch {}
      this.subBloqueosPersonal = undefined;
    }
    if (this.subReaccionesPersonal) {
      try {
        this.subReaccionesPersonal.unsubscribe();
      } catch {}
      this.subReaccionesPersonal = undefined;
    }

    this.estadoHandlersByTargetUserId.clear();
    this.leidosHandlers.clear();
    this.bloqueosHandlers.clear();
    this.reaccionesHandlers.clear();
  }

  private ensureLeidosPersonalSubscription(requestedTopicUserId?: number): void {
    if (!this.stompClient?.connected) return;
    if (this.leidosHandlers.size === 0) return;

    const authUserId = this.resolveAuthenticatedUserId();
    if (!authUserId) return;
    void requestedTopicUserId;

    const destination = `/topic/leido.${authUserId}`;
    if (this.subLeidosPersonal) return;

    const sub = this.subscribeWithReceiptLog(destination, 'leido', (message) => {
      try {
        const body = JSON.parse(message.body);
        const mensajeId = Number(body?.mensajeId);
        if (!Number.isFinite(mensajeId) || mensajeId <= 0) return;
        for (const handler of this.leidosHandlers) {
          try {
            handler(Math.round(mensajeId));
          } catch (err) {
            void err;
          }
        }
      } catch (e) {
        this.logError(' Error al parsear body del mensaje ledo:', message.body, e);
      }
    });

    if (sub) this.subLeidosPersonal = sub;
  }

  private ensureReaccionesPersonalSubscription(requestedTopicUserId?: number): void {
    if (!this.stompClient?.connected) return;
    if (this.reaccionesHandlers.size === 0) return;

    const authUserId = this.resolveAuthenticatedUserId();
    if (!authUserId) return;
    void requestedTopicUserId;

    const destination = `/topic/chat.reaccion.${authUserId}`;
    if (this.subReaccionesPersonal) return;

    const sub = this.subscribeWithReceiptLog(destination, 'chat-reaccion', (message) => {
      try {
        const payload = JSON.parse(message.body) as MensajeReaccionDTO;
        for (const handler of this.reaccionesHandlers) {
          try {
            handler(payload);
          } catch (err) {
            void err;
          }
        }
      } catch (e) {
        this.logError(' Error parseando reaccin WS:', e);
      }
    });

    if (sub) this.subReaccionesPersonal = sub;
  }

  suscribirseALeidos(
    topicUserId: number,
    callback: (mensajeId: number) => void
  ): void {
    this.leidosHandlers.add(callback);
    if (this.stompClient?.connected) {
      this.ensureLeidosPersonalSubscription(topicUserId);
      return;
    }
    this.esperarConexion(() => this.ensureLeidosPersonalSubscription(topicUserId));
  }

  public enviarReaccionMensaje(payload: MensajeReaccionDTO): void {
    if (!this.stompClient?.connected) {
      this.logWarn('WS no conectado. No se pudo enviar chat.reaccion');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/chat.reaccion')) return;
    this.stompClient.publish({
      destination: '/app/chat.reaccion',
      body: JSON.stringify(payload),
    });
  }

  public suscribirseAReacciones(
    topicUserId: number,
    callback: (payload: MensajeReaccionDTO) => void
  ): void {
    this.reaccionesHandlers.add(callback);
    if (this.stompClient?.connected) {
      this.ensureReaccionesPersonalSubscription(topicUserId);
      return;
    }
    this.esperarConexion(() => this.ensureReaccionesPersonalSubscription(topicUserId));
  }

  public suscribirseAReportesAdmin(
    callback: (payload: UnbanAppealEventDTO) => void
  ): StompSubscription | null {
    if (!this.stompClient?.connected) return null;
    return this.stompClient.subscribe(`/topic/admin.solicitudes-desbaneo`, (message) => {
      try {
        callback(JSON.parse(message.body) as UnbanAppealEventDTO);
      } catch (e) {
        this.logError(' Error parseando reporte admin WS:', e);
      }
    });
  }

  suscribirseAChat(
    topicUserId: number,
    callback: (mensaje: MensajeDTO) => void
  ): void {
    this.chatHandlers.add(callback);
    if (this.stompClient?.connected) {
      this.ensureChatPersonalSubscription(topicUserId);
      return;
    }
    this.esperarConexion(() => this.ensureChatPersonalSubscription(topicUserId));
  }

  public setActiveCallSession(
    callIdRaw: string,
    callerIdRaw: number,
    calleeIdRaw: number
  ): boolean {
    const callId = String(callIdRaw || '').trim();
    const callerId = Number(callerIdRaw);
    const calleeId = Number(calleeIdRaw);
    if (!callId) return false;
    if (!Number.isFinite(callerId) || callerId <= 0) return false;
    if (!Number.isFinite(calleeId) || calleeId <= 0) return false;
    this.activeCallSession = {
      callId,
      callerId,
      calleeId,
      ended: false,
      updatedAtMs: Date.now(),
    };
    return true;
  }

  public markCallEnded(callIdRaw?: string): void {
    const callId = String(callIdRaw || '').trim();
    if (!callId) return;
    if (this.activeCallSession?.callId !== callId) return;
    this.activeCallSession = {
      ...this.activeCallSession,
      ended: true,
      updatedAtMs: Date.now(),
    };
  }

  public clearActiveCallSession(callIdRaw?: string): void {
    const callId = String(callIdRaw || '').trim();
    if (!this.activeCallSession) return;
    if (callId && this.activeCallSession.callId !== callId) return;
    this.activeCallSession = null;
  }

  private resolveSecureSignalingRoute(
    callIdRaw: string,
    requestedToUserIdRaw?: number
  ): { callId: string; fromUserId: number; toUserId: number } | null {
    const callId = String(callIdRaw || '').trim();
    if (!callId) return null;

    const authenticatedUserId = this.resolveAuthenticatedUserId();
    if (!authenticatedUserId) return null;

    const session = this.activeCallSession;
    if (!session) return null;
    if (session.callId !== callId) return null;
    if (session.ended) return null;

    const isCaller = Number(session.callerId) === Number(authenticatedUserId);
    const isCallee = Number(session.calleeId) === Number(authenticatedUserId);
    if (!isCaller && !isCallee) return null;

    const toUserId = isCaller ? Number(session.calleeId) : Number(session.callerId);
    const requestedToUserId = Number(requestedToUserIdRaw);
    if (
      Number.isFinite(requestedToUserId) &&
      requestedToUserId > 0 &&
      requestedToUserId !== toUserId
    ) {
      return null;
    }

    return {
      callId,
      fromUserId: Number(authenticatedUserId),
      toUserId,
    };
  }
}


