import { Injectable } from '@angular/core';
import SockJS from 'sockjs-client/dist/sockjs';
import { Client, Stomp, StompSubscription } from '@stomp/stompjs';
import { MensajeDTO } from '../../Interface/MensajeDTO';
import { NotificationWS } from '../../Interface/NotificationWS';
import { CallEndWS } from '../../Interface/CallEndWS';
import { CallAnswerWS } from '../../Interface/CallAnswerWS';
import { CallInviteWS } from '../../Interface/CallInviteWS';
import { MensajeReaccionDTO } from '../../Interface/MensajeReaccionDTO';

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

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  public stompClient: Client;
  private socketUrl = 'http://localhost:8080/ws-chat';
  private subsGrupales = new Map<number, StompSubscription>();
  private subsTypingGrupales = new Map<number, StompSubscription>();
  private subsCallInvite?: StompSubscription;
  private subsCallAnswer?: StompSubscription;
  private subsUserErrors?: StompSubscription;
  private subsOffer?: StompSubscription;
  private subsAnswer?: StompSubscription;
  private subsIce?: StompSubscription;
  private subsCallEnd?: StompSubscription;
  constructor() {
    this.stompClient = new Client({
      brokerURL: undefined,
      webSocketFactory: () => new SockJS(this.socketUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectHeaders: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      // debug: (msg) => console.log('📡 WebSocket:', msg),
    });
  }

  conectar(onConnected: () => void): void {
    // Set connectHeaders dynamically right before connecting to catch the latest token
    this.stompClient.connectHeaders = {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      usuarioId: localStorage.getItem('usuarioId') || ''
    };

    this.stompClient.onConnect = () => {
      console.log('[WS] connected', {
        socketUrl: this.socketUrl,
        usuarioId: localStorage.getItem('usuarioId'),
        hasToken: !!localStorage.getItem('token'),
      });
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

  suscribirseAErroresUsuario(handler: (payload: any) => void): void {
    this.esperarConexion(() => {
      if (this.subsUserErrors) {
        try {
          this.subsUserErrors.unsubscribe();
        } catch {}
        this.subsUserErrors = undefined;
      }
      this.subsUserErrors = this.stompClient.subscribe(`/user/queue/errors`, (msg) => {
        try {
          const payload = JSON.parse(msg.body);
          handler(payload);
        } catch (e) {
          console.error('❌ Error parseando /user/queue/errors:', e);
        }
      });
    });
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

  enviarEscribiendoGrupo(
    emisorId: number,
    chatId: number,
    escribiendo: boolean
  ): void {
    if (!this.stompClient?.connected) return;
    const dto = { emisorId, chatId, escribiendo };
    this.stompClient.publish({
      destination: '/app/escribiendo.grupo',
      body: JSON.stringify(dto),
    });
  }

  iniciarLlamada(callerId: number, calleeId: number, chatId?: number): void {
    if (!this.stompClient?.connected) {
      console.warn('⚠️ WS no conectado. No se pudo iniciar la llamada.');
      return;
    }
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
  }

  enviarMensajeIndividual(mensaje: MensajeDTO): void {
    if (this.stompClient.connected) {
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

  enviarEstadoConectado(): void {
    const usuarioId = localStorage.getItem('usuarioId');
    if (usuarioId && this.stompClient.connected) {
      const dto = {
        usuarioId: Number(usuarioId),
        estado: 'Conectado',
      };
      this.stompClient.publish({
        destination: '/app/estado',
        body: JSON.stringify(dto),
      });
    }
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

  enviarEstadoDesconectado(usuarioIdParam?: number): void {
    const usuarioId = this.resolveUsuarioId(usuarioIdParam);
    if (this.stompClient?.connected && usuarioId) {
      const dto = {
        usuarioId: usuarioId,
        estado: 'Desconectado',
      };
      this.stompClient.publish({
        destination: '/app/estado',
        body: JSON.stringify(dto),
      });
    }
  }

  async enviarEstadoDesconectadoConFlush(
    usuarioIdParam?: number,
    timeoutMs = 250
  ): Promise<void> {
    const usuarioId = this.resolveUsuarioId(usuarioIdParam);
    if (!this.stompClient?.connected || !usuarioId) return;

    const dto = {
      usuarioId,
      estado: 'Desconectado',
    };
    const receiptId = `estado-disconnect-${usuarioId}-${Date.now()}`;

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

  private resolveUsuarioId(usuarioIdParam?: number): number {
    const fromParam = Number(usuarioIdParam);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const fromStorage = Number(localStorage.getItem('usuarioId'));
    if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
    return 0;
  }

  /** Enviar OFERTA SDP (caller -> callee) */
  enviarSdpOffer(payload: SdpOfferDTO): void {
    if (!this.stompClient?.connected) return;
    this.stompClient.publish({
      destination: '/app/call.sdp.offer',
      body: JSON.stringify(payload),
    });
  }

  /** Enviar ANSWER SDP (callee -> caller) */
  enviarSdpAnswer(payload: SdpAnswerDTO): void {
    if (!this.stompClient?.connected) return;
    this.stompClient.publish({
      destination: '/app/call.sdp.answer',
      body: JSON.stringify(payload),
    });
  }

  /** Enviar ICE candidate (ambos sentidos) */
  enviarIce(payload: IceDTO): void {
    if (!this.stompClient?.connected) return;
    this.stompClient.publish({
      destination: '/app/call.ice',
      body: JSON.stringify(payload),
    });
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

    console.log('[WS] publish /app/chat.eliminar', mensaje);
    this.stompClient.publish({
      destination: '/app/chat.eliminar',
      body: JSON.stringify(mensaje),
    });
  }

  public suscribirseAEliminarMensaje(
    usuarioId: number,
    callback: (mensaje: MensajeDTO) => void
  ): void {
    console.log('[WS] subscribe', `/topic/chat.${usuarioId}`, '(eliminar)');
    this.stompClient.subscribe(`/topic/chat.${usuarioId}`, (frame) => {
      const mensaje = JSON.parse(frame.body) as MensajeDTO;
      console.log('[WS] recv /topic/chat.* (eliminar check)', mensaje);

      // ✅ SOLO si es realmente un eliminado:
      if (mensaje && mensaje.id && mensaje.activo === false) {
        callback(mensaje);
      }
    });
  }

  marcarMensajesComoLeidos(ids: number[]): void {
    console.log('[WS] publish /app/mensajes.marcarLeidos', ids);
    this.stompClient?.publish({
      destination: '/app/mensajes.marcarLeidos',
      body: JSON.stringify(ids),
    });
  }

  public enviarEscribiendo(
    emisorId: number,
    receptorId: number,
    escribiendo: boolean
  ): void {
    const dto = { emisorId, receptorId, escribiendo };

    this.stompClient?.publish({
      destination: '/app/escribiendo',
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

  suscribirseALeidos(
    usuarioId: number,
    callback: (mensajeId: number) => void
  ): void {
    console.log('[WS] subscribe', `/topic/leido.${usuarioId}`);
    this.stompClient?.subscribe(`/topic/leido.${usuarioId}`, (message) => {
      try {
        const body = JSON.parse(message.body);
        const mensajeId = body.mensajeId;
        console.log('[WS] recv /topic/leido.*', body);
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

  suscribirseAChat(
    receptorId: number,
    callback: (mensaje: MensajeDTO) => void
  ): void {
    if (this.stompClient.connected) {
      console.log('[WS] subscribe', `/topic/chat.${receptorId}`, '(mensajes)');
      this.stompClient.subscribe(`/topic/chat.${receptorId}`, (message) => {
        const mensajeRecibido: MensajeDTO = JSON.parse(message.body);
        console.log('[WS] recv /topic/chat.* (mensaje)', mensajeRecibido);
        callback(mensajeRecibido);
      });
    } else {
      console.warn('⚠️ No suscrito: WebSocket no está conectado.');
    }
  }
}
