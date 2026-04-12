import { Injectable } from '@angular/core';
import SockJS from 'sockjs-client/dist/sockjs';
import { Client, Stomp, StompSubscription } from '@stomp/stompjs';
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
  private activeCallSession: ActiveCallSession | null = null;

  constructor(private rateLimitService: RateLimitService) {
    this.stompClient = new Client({
      brokerURL: undefined,
      webSocketFactory: () => new SockJS(this.socketUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectHeaders: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      // debug logger disabled
    });
  }

  conectar(onConnected: () => void): void {
    // Set connectHeaders dynamically right before connecting to catch the latest token
    this.stompClient.connectHeaders = {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      usuarioId: localStorage.getItem('usuarioId') || ''
    };

    this.stompClient.onConnect = () => {
      this.subsUserErrors = undefined;
      this.ensureUserErrorsSubscription();
      onConnected();
    };

    this.stompClient.onStompError = (frame) => {
      console.error('❌ Error STOMP:', frame);
    };

    this.stompClient.activate();
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

  // --- NUEVO: ENVÍO A CHAT GRUPAL ---
  enviarMensajeGrupal(mensaje: MensajeDTO): void {
    // receptorId = chatId del grupo
    if (this.stompClient?.connected) {
      if (!this.canPublishToRateLimitedDestination('/app/chat.grupal')) return;
      this.stompClient.publish({
        destination: '/app/chat.grupal',
        body: JSON.stringify(mensaje),
      });
    } else {
      console.warn('⚠️ WS no conectado. Mensaje grupal no enviado.');
    }
  }

  // --- NUEVO: SUSCRIPCIÓN A UN GRUPO ---
  suscribirseAChatGrupal(
    chatId: number,
    handler: (m: MensajeDTO) => void
  ): void {
    if (!this.stompClient?.connected) return;
    if (this.subsGrupales.has(chatId)) return;

    const sub = this.stompClient.subscribe(
      `/topic/chat.grupal.${chatId}`,
      (msg) => {
        try {
          const payload: any = JSON.parse(msg.body);
          // 🧩 fallback por si el back no envía chatId
          if (payload.chatId == null) payload.chatId = chatId;
          handler(payload as MensajeDTO);
        } catch (e) {
          console.error('❌ Error parseando mensaje grupal:', e);
        }
      }
    );

    this.subsGrupales.set(chatId, sub);
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
          console.error('❌ Error parseando notificación WS:', e);
        }
      });
    });
  }

  suscribirseABloqueos(
    userId: number,
    handler: (payload: { blockerId: number; type: 'BLOCKED' | 'UNBLOCKED' }) => void
  ): void {
    this.esperarConexion(() => {
      this.stompClient.subscribe(`/topic/user/${userId}/bloqueos`, (msg) => {
        try {
          const payload = JSON.parse(msg.body);
          handler(payload);
        } catch (e) {
          console.error('❌ Error parseando actualización de bloqueo WS:', e);
        }
      });
    });
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
          console.error('❌ Error parseando baneo WS:', e);
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
            console.error('❌ Error en handler de /user/queue/errors:', err);
          }
        }
      } catch (e) {
        console.error('❌ Error parseando /user/queue/errors:', e);
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
    callback: (data: {
      emisorId: number;
      escribiendo: boolean;
      chatId: number;
      emisorNombre?: string;
      emisorApellido?: string;
    }) => void
  ): void {
    if (!this.stompClient?.connected) return;
    if (this.subsTypingGrupales.has(chatId)) return; // evita duplicados

    const sub = this.stompClient.subscribe(
      `/topic/escribiendo.grupo.${chatId}`,
      (message) => {
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
          console.error('❌ Error parseando escribiendo.grupo:', e);
        }
      }
    );

    this.subsTypingGrupales.set(chatId, sub);
  }

  suscribirseAGrabandoAudioGrupo(
    chatId: number,
    callback: (data: {
      emisorId: number;
      grabandoAudio: boolean;
      chatId: number;
      emisorNombre?: string;
      emisorApellido?: string;
    }) => void
  ): void {
    if (!this.stompClient?.connected) return;
    if (this.subsAudioGrupales.has(chatId)) return;

    const sub = this.stompClient.subscribe(
      `/topic/audio.grabando.grupo.${chatId}`,
      (message) => {
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
          console.error('❌ Error parseando audio.grabando.grupo:', e);
        }
      }
    );

    this.subsAudioGrupales.set(chatId, sub);
  }

  enviarEscribiendoGrupo(
    chatId: number,
    escribiendo: boolean
  ): void {
    if (!this.stompClient?.connected) return;
    const emisorId = this.resolveAuthenticatedUserId();
    if (!emisorId) {
      console.warn('WS no conectado a un usuario autenticado. Typing grupal no enviado.');
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
      console.warn('⚠️ WS no conectado. No se pudo iniciar la llamada.');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/call.start')) return;
    const payload = { callerId, calleeId, chatId };
    this.stompClient.publish({
      destination: '/app/call.start',
      body: JSON.stringify(payload),
    });
  }

  /** B → responder (aceptar / rechazar) → A */
  responderLlamada(
    callId: string,
    callerId: number,
    calleeId: number,
    accepted: boolean,
    reason?: string
  ): void {
    if (!this.stompClient?.connected) {
      console.warn('⚠️ WS no conectado. No se pudo responder la llamada.');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/call.answer')) return;
    const payload = { callId, callerId, calleeId, accepted, reason };
    this.stompClient.publish({
      destination: '/app/call.answer',
      body: JSON.stringify(payload),
    });
  }

  /** cualquiera → colgar */
  colgarLlamada(callId: string, byUserId: number): void {
    if (!this.stompClient?.connected) {
      console.warn('⚠️ WS no conectado. No se pudo colgar la llamada.');
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

  /** Suscripción a INVITACIONES entrantes (para el usuario logueado) */
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
          console.error('❌ Error parseando CALL_INVITE', e);
        }
      }
    );
  }

  /** Suscripción a RESPUESTAS de llamadas (para el usuario logueado) */
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
          console.error('❌ Error parseando CALL_ANSWER', e);
        }
      }
    );
  }

  /** Suscripción a FIN de llamada (para el usuario logueado) */
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
          console.error('❌ Error parseando CALL_ENDED', e);
        }
      }
    );
  }

  desuscribirseDeChatGrupal(chatId: number): void {
    const sub = this.subsGrupales.get(chatId);
    if (sub) {
      sub.unsubscribe();
      this.subsGrupales.delete(chatId);
    }
  }

  async desconectar(): Promise<void> {
    if (this.stompClient && this.stompClient.connected) {
      try {
        await this.stompClient.deactivate();
      } catch (e) {
        console.warn('[WS] error al desconectar', e);
      }
    }
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
      console.error('❌ Error enviando voto de encuesta WS:', err);
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
      console.warn(
        '⚠️ No conectado al WebSocket. El mensaje no se ha enviado.'
      );
    }
  }

  public enviarEstado(
    estado: 'Conectado' | 'Ausente' | 'Desconectado'
  ): boolean {
    if (!this.stompClient?.connected) return false;
    const authenticatedUserId = this.resolveAuthenticatedUserId();
    if (!authenticatedUserId) {
      console.warn('WS no conectado a un usuario autenticado. Estado no enviado.');
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
    usuarioId: number,
    callback: (estado: string) => void
  ): StompSubscription | null {
    if (!this.stompClient?.connected) return null;
    return this.stompClient.subscribe(`/topic/estado.${usuarioId}`, (message) => {
      const estado = message.body;
      callback(estado);
    });
  }

  enviarEstadoDesconectado(): void {
    this.enviarEstado('Desconectado');
  }

  async enviarEstadoDesconectadoConFlush(
    timeoutMs = 250
  ): Promise<void> {
    if (!this.stompClient?.connected) return;
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
        console.warn('[WS] error al publicar estado desconectado', e);
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

  /** Suscribirse a OFERTAS entrantes (para mí) */
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
          console.error('❌ SDP Offer parse', e);
        }
      }
    );
  }

  /** Suscribirse a ANSWERS entrantes (para mí) */
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
          console.error('❌ SDP Answer parse', e);
        }
      }
    );
  }

  /** Suscribirse a ICE entrantes (para mí) */
  suscribirseAIce(miUsuarioId: number, handler: (m: IceDTO) => void): void {
    if (!this.stompClient?.connected || this.subsIce) return;
    this.subsIce = this.stompClient.subscribe(
      `/topic/call.ice.${miUsuarioId}`,
      (msg) => {
        try {
          handler(JSON.parse(msg.body) as IceDTO);
        } catch (e) {
          console.error('❌ ICE parse', e);
        }
      }
    );
  }

  public enviarEliminarMensaje(mensaje: MensajeDTO): void {
    if (!this.stompClient?.connected) {
      console.warn('WS no conectado. No se pudo enviar chat.eliminar');
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
      console.warn('WS no conectado. No se pudo enviar chat.editar');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/chat.editar')) return;
    this.stompClient.publish({
      destination: '/app/chat.editar',
      body: JSON.stringify(mensaje),
    });
  }

  public suscribirseAEliminarMensaje(
    usuarioId: number,
    callback: (mensaje: MensajeDTO) => void
  ): void {
    this.stompClient.subscribe(`/topic/chat.${usuarioId}`, (frame) => {
      const mensaje = JSON.parse(frame.body) as MensajeDTO;
      // ✅ SOLO si es realmente un eliminado:
      if (mensaje && mensaje.id && mensaje.activo === false) {
        callback(mensaje);
      }
    });
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
      console.warn('WS no conectado a un usuario autenticado. Typing individual no enviado.');
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

  // Suscribirse a evento "escribiendo"
  suscribirseAEscribiendo(
    receptorId: number,
    callback: (emisorId: number, escribiendo: boolean) => void
  ): void {
    this.stompClient?.subscribe(
      `/topic/escribiendo.${receptorId}`,
      (message) => {
        const data = JSON.parse(message.body);
        const emisorId = data.emisorId;
        const escribiendo = data.escribiendo;

        callback(emisorId, escribiendo);
      }
    );
  }

  suscribirseAGrabandoAudio(
    receptorId: number,
    callback: (
      emisorId: number,
      grabandoAudio: boolean,
      chatId?: number,
      emisorNombre?: string
    ) => void
  ): void {
    this.stompClient?.subscribe(
      `/topic/audio.grabando.${receptorId}`,
      (message) => {
        const data = JSON.parse(message.body);
        const emisorId = Number(data.emisorId);
        const grabandoAudio = !!data.grabandoAudio;
        const chatId = data.chatId != null ? Number(data.chatId) : undefined;
        const emisorNombre =
          typeof data.emisorNombre === 'string' ? data.emisorNombre : undefined;

        callback(emisorId, grabandoAudio, chatId, emisorNombre);
      }
    );
  }

  suscribirseALeidos(
    usuarioId: number,
    callback: (mensajeId: number) => void
  ): void {
    this.stompClient?.subscribe(`/topic/leido.${usuarioId}`, (message) => {
      try {
        const body = JSON.parse(message.body);
        const mensajeId = body.mensajeId;
        callback(mensajeId);
      } catch (e) {
        console.error(
          '❌ Error al parsear body del mensaje leído:',
          message.body,
          e
        );
      }
    });
  }

  public enviarReaccionMensaje(payload: MensajeReaccionDTO): void {
    if (!this.stompClient?.connected) {
      console.warn('WS no conectado. No se pudo enviar chat.reaccion');
      return;
    }
    if (!this.canPublishToRateLimitedDestination('/app/chat.reaccion')) return;
    this.stompClient.publish({
      destination: '/app/chat.reaccion',
      body: JSON.stringify(payload),
    });
  }

  public suscribirseAReacciones(
    usuarioId: number,
    callback: (payload: MensajeReaccionDTO) => void
  ): void {
    if (!this.stompClient?.connected) return;
    this.stompClient.subscribe(`/topic/chat.reaccion.${usuarioId}`, (message) => {
      try {
        callback(JSON.parse(message.body) as MensajeReaccionDTO);
      } catch (e) {
        console.error('❌ Error parseando reacción WS:', e);
      }
    });
  }

  public suscribirseAReportesAdmin(
    callback: (payload: UnbanAppealEventDTO) => void
  ): StompSubscription | null {
    if (!this.stompClient?.connected) return null;
    return this.stompClient.subscribe(`/topic/admin.solicitudes-desbaneo`, (message) => {
      try {
        callback(JSON.parse(message.body) as UnbanAppealEventDTO);
      } catch (e) {
        console.error('❌ Error parseando reporte admin WS:', e);
      }
    });
  }

  suscribirseAChat(
    receptorId: number,
    callback: (mensaje: MensajeDTO) => void
  ): void {
    if (this.stompClient.connected) {
      this.stompClient.subscribe(`/topic/chat.${receptorId}`, (message) => {
        const mensajeRecibido: MensajeDTO = JSON.parse(message.body);
        callback(mensajeRecibido);
      });
    } else {
      console.warn('⚠️ No suscrito: WebSocket no está conectado.');
    }
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


