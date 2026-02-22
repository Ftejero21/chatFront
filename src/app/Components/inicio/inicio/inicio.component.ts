import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
} from '@angular/core';
import { ChatService } from '../../../Service/chat/chat.service';
import { MensajeDTO } from '../../../Interface/MensajeDTO';
import { WebSocketService } from '../../../Service/WebSocket/web-socket.service';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { Client } from '@stomp/stompjs';
import { AuthService } from '../../../Service/auth/auth.service';
import {
  avatarOrDefault,
  buildPreviewFromMessage,
  buildTypingHeaderText,
  clampPercent,
  colorForUserId,
  computePreviewPatch,
  decryptContenidoE2E,
  decryptPreviewStringE2E,
  formatDuration,
  formatPreviewText,
  getNombrePorId,
  isAudioPreviewText,
  isGroupInviteResponseWS,
  isGroupInviteWS,
  isPreviewDeleted,
  isUnseenCountWS,
  joinMembersLine,
  parseAudioDurationMs,
  parseAudioPreviewText,
  resolveMediaUrl,
  updateChatPreview,
} from '../../../utils/chat-utils';
import { GroupInviteWS } from '../../../Interface/GroupInviteWS';
import { NotificationService } from '../../../Service/Notification/notification.service';
import { GroupInviteService } from '../../../Service/GroupInvite/group-invite.service';
import { GroupInviteResponseWS } from '../../../Interface/GroupInviteResponseWS';
import { NotificationDTO } from '../../../Interface/NotificationDTO';
import {
  ChatGrupalCreateDTO,
  CrearGrupoModalComponent,
} from '../../CrearGrupoModal/crear-grupo-modal/crear-grupo-modal.component';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { environment } from '../../../environments';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { ChatIndividualCreateDTO } from '../../../Interface/ChatIndividualCreateDTO';
import { ChatIndividualDTO } from '../../../Interface/ChatIndividualDTO ';
import { CallInviteWS } from '../../../Interface/CallInviteWS';
import { MessagueSalirGrupoDTO } from '../../../Interface/MessagueSalirGrupoDTO';

// Bootstrap (modales)
declare const bootstrap: any;

/**
 * Representa los diferentes estados en los que puede estar un usuario.
 */
export type EstadoUsuario = 'Conectado' | 'Desconectado' | 'Ausente';

/**
 * Extensión del DTO de usuario que incluye su estado actual.
 */
export type UserWithEstado = UsuarioDTO & { estado?: EstadoUsuario };

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css',
})
export class InicioComponent {
  // ==========
  // PUBLIC FIELDS (visibles para el template)
  // ==========
  public chats: any[] = [];
  public mensajesSeleccionados: MensajeDTO[] = [];
  public chatSeleccionadoId: number | null = null;
  public usuarioActualId!: number;
  public callInfoMessage: string | null = null;

  public callStatusClass:
    | 'is-ringing'
    | 'is-success'
    | 'is-error'
    | 'is-ended'
    | null = null;
  public unseenCount = 0; // ya lo tienes
  public pendingCount = 0; // NUEVO: no resueltas (resolved=false)
  public get badgeCount(): number {
    return Math.max(this.unseenCount, this.pendingCount);
  }

  public recorderSupported =
    typeof (window as any).MediaRecorder !== 'undefined';
  public recording = false;
  public recordElapsedMs = 0;

  @ViewChild('crearGrupoModal')
  public crearGrupoModalRef!: CrearGrupoModalComponent;

  public invitesPendientes: GroupInviteWS[] = []; // tarjetas “te invitaron…”
  public panelNotificacionesAbierto = false;

  public gruposEscribiendo = new Set<number>(); // chatId → hay alguien escribiendo
  public quienEscribeEnGrupo = new Map<number, string>();

  public trackMensaje = (_: number, m: MensajeDTO) => m.id ?? _;
  public trackIndex = (_: number, __: unknown) => _;

  public mensajeNuevo: string = '';
  public recBars = Array.from({ length: 14 });

  public chatActual: any = null;
  public usuariosEscribiendo: Set<number> = new Set();

  @ViewChild('contenedorMensajes') private contenedorMensajes!: ElementRef;

  public usuarioEscribiendo: boolean = false;

  public estadoPropio = 'Conectado';
  public estadoActual: string = 'Conectado';

  public notifItems: Array<
    | (GroupInviteWS & { kind: 'INVITE' })
    | (GroupInviteResponseWS & { kind: 'RESPONSE' })
  > = [];

  public usuarioFotoUrl: string | null = null;

  public escribiendoHeader = '';

  public audioStates = new Map<
    number,
    { playing: boolean; current: number; duration: number }
  >();

  public aiPanelOpen = false;
  /** Texto resaltado para la IA */
  public aiQuote = '';
  /** Pregunta por defecto para la IA */
  public aiQuestion = '¿Es esto verdad?';
  public aiLoading = false;
  public aiError: string | null = null;
  public remoteHasVideo = false;

  public topbarQuery: string = '';
  public topbarOpen: boolean = false;
  public topbarSearching: boolean = false;
  public topbarResults: UserWithEstado[] = [];

  public nuevoGrupo = {
    nombre: '',
    fotoDataUrl: '' as string | null,
    seleccionados: [] as Array<{
      id: number;
      nombre: string;
      apellido: string;
      foto?: string;
    }>,
  };

  public notifInvites: Array<
    (GroupInviteWS & { kind: 'INVITE' }) & {
      status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    }
  > = [];

  // Badge: solo PENDING (no se muestra si 0)
  public get invitePendingCount(): number {
    const handled = this.getHandledInviteIds();
    return this.notifInvites.filter((n) => !handled.has(Number(n.inviteId)))
      .length;
  }

  public busquedaUsuario = '';
  public mostrarMenuOpciones = false;
  public allUsuariosMock: Array<{
    id: number;
    nombre: string;
    apellido: string;
    foto?: string;
  }> = [
    { id: 6, nombre: 'Ana', apellido: 'López', foto: '/assets/usuario.png' },
    { id: 7, nombre: 'Luis', apellido: 'Martín', foto: '/assets/usuario.png' },
    {
      id: 8,
      nombre: 'Sara',
      apellido: 'González',
      foto: '/assets/usuario.png',
    },
    {
      id: 16,
      nombre: 'Carlos',
      apellido: 'Pérez',
      foto: '/assets/usuario.png',
    },
    { id: 17, nombre: 'Julia', apellido: 'Ruiz', foto: '/assets/usuario.png' },
  ];
  public haSalidoDelGrupo = false;
  public candidatosAgregar: Array<{
    id: number;
    nombre: string;
    apellido: string;
    foto?: string | null;
  }> = [];

  public ultimaInvite?: CallInviteWS; // para mostrar el panel entrante
  public currentCallId?: string;

  // ==========
  // PRIVATE FIELDS (solo uso interno)
  // ==========
  private suscritosEstado = new Set<number>();
  private mensajesMarcadosComoLeidosPendientes: number[] = [];
  private escribiendoTimeout: any;
  private callInfoTimer?: any;
  private notifsLoadedOnce = false;
  private aiWaitTicker?: any;
  private aiWaitDots = 0;
  // <- bloquea textarea al salir

  private videoSender?: RTCRtpSender;
  private peer?: RTCPeerConnection;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  public showCallUI = false; // mostrar popup
  public isMuted = false;

  public camOff = false;
  private orEmpty(s?: string | null) {
    return (s || '').trim();
  }
  private inactividadTimer: any;
  private topbarEstadoSuscritos = new Set<number>();
  private enrichedUsers = new Set<number>();
  private HANDLED_INVITES_KEY = 'handledInviteIds';
  private mediaRecorder?: MediaRecorder;
  private micStream?: MediaStream;
  private audioChunks: BlobPart[] = [];
  private recordStartMs = 0;
  private recordTicker?: any;
  private currentPlayingId: number | null = null;
  private videoTransceiver?: RTCRtpTransceiver;
  private currentLocalVideoTrack?: MediaStreamTrack;
  // STOMP (si necesitas desde template, cambia a public)
  private stompClient!: Client;

  private typingSetHeader = new Set<string>();

  public busquedaChat: string = '';

  public bloqueadosIds = new Set<number>();
  public meHanBloqueadoIds = new Set<number>();

  // ==========
  // CONSTRUCTOR
  // ==========
  /**
   * Constructor: inyecta todos los servicios necesarios.
   * Además, configura el cierre de conexión si el usuario cierra la ventana.
   */
  public constructor(
    private chatService: ChatService,
    private wsService: WebSocketService,
    private mensajeriaService: MensajeriaService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private cryptoService: CryptoService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private groupInviteService: GroupInviteService
  ) {
    window.addEventListener('beforeunload', () => {
      this.wsService.enviarEstadoDesconectado();
    });
  }

  // ==========
  // LIFECYCLE (públicos)
  // ==========

  /**
   * Método de ciclo de vida de Angular que se ejecuta al iniciar el componente.
   * Se encarga de cargar el perfil, inicializar WebSockets y obtener datos iniciales.
   */
  public ngOnInit(): void {
    const id = localStorage.getItem('usuarioId');
    this.resetEdicion();
    this.cargarPerfil();
    this.inicializarDeteccionInactividad();

    if (!id) {
      console.warn('⚠️ No hay usuario logueado');
      return;
    }

    this.usuarioActualId = parseInt(id, 10);

    // Recuperar bloqueados cacheados
    const cachedBloqueados = localStorage.getItem('bloqueadosIds');
    if (cachedBloqueados) {
      try {
        this.bloqueadosIds = new Set(JSON.parse(cachedBloqueados) as number[]);
      } catch (e) {}
    }

    // Recuperar quién nos bloqueó
    const cachedMeHanBloqueado = localStorage.getItem('meHanBloqueadoIds');
    if (cachedMeHanBloqueado) {
      try {
        this.meHanBloqueadoIds = new Set(JSON.parse(cachedMeHanBloqueado) as number[]);
      } catch (e) {}
    }

    // 🔐 Inicializa claves locales y publica bundle (si no existe)

    // Contador unseen inicial
    this.notificationService.unseenCount(this.usuarioActualId).subscribe({
      next: (n) => {
        this.unseenCount = n;
        this.cdr.markForCheck();
      },
      error: (e) => console.error('❌ unseenCount:', e),
    });

    // Sincroniza lista de tarjetas (por si te perdiste WS)
    this.syncNotifsFromServer();

    // 1) Conectar WS
    this.wsService.conectar(() => {
      // 2) Esperar a conexión para inicializar resto
      this.wsService.esperarConexion(() => {
        // console.log('✅ WebSocket conectado, inicializando funciones');
        this.wsService.enviarEstadoConectado();
        this.prepararSuscripcionesWebRTC();
        // 📞 Llamadas: invitaciones entrantes (cuando me llaman)
        this.wsService.suscribirseALlamadasEntrantes(
          this.usuarioActualId,
          (invite) => {
            this.ngZone.run(() => {
              this.ultimaInvite = invite; // muestra el panel entrante
              this.currentCallId = invite.callId; // guarda el id
              this.cdr.markForCheck();
            });
          }
        );

        // 📞 Llamadas: respuestas (cuando el otro acepta/rechaza lo que YO llamé)
        this.wsService.suscribirseARespuestasLlamada(
          this.usuarioActualId,
          (answer) => {
            this.ngZone.run(async () => {
              if (answer?.reason === 'RINGING') {
                const soyCaller =
                  Number(answer.toUserId) === Number(this.usuarioActualId);
                if (soyCaller) {
                  this.currentCallId = answer.callId;
                  this.cdr.markForCheck();
                }
                return; // no sigas procesando
              }

              const soyCaller =
                Number(answer.toUserId) === Number(this.usuarioActualId);
              const soyCallee =
                Number(answer.fromUserId) === Number(this.usuarioActualId);

              if (answer.accepted) {
                // ✅ Ambos continúan con WebRTC (A crea offer; B ya lo manejas con la offer entrante)
                this.currentCallId = answer.callId;
                if (soyCaller) {
                  await this.onAnswerAccepted(answer.callId, answer.fromUserId);
                  // quita “Llamando…”
                  this.callInfoMessage = null;
                }
              } else {
                // ⛔ Rechazada
                if (soyCaller) {
                  // SOLO el caller ve el mensaje
                  const nombre =
                    (this.chatActual?.receptor?.nombre || '') +
                    ' ' +
                    (this.chatActual?.receptor?.apellido || '');
                  const motivo =
                    answer.reason === 'NO_MEDIA'
                      ? 'no pudo usar cámara/micrófono'
                      : 'ha rechazado la llamada';

                  this.showCallUI = true; // asegúrate de que el popup está abierto
                  this.callInfoMessage = `${(
                    nombre || 'La otra persona'
                  ).trim()} ${motivo}`;
                  this.cdr.markForCheck();

                  if (this.callInfoTimer) clearTimeout(this.callInfoTimer);
                  this.callInfoTimer = setTimeout(
                    () => this.cerrarLlamadaLocal(),
                    2000
                  );
                } else if (soyCallee) {
                  // El callee NO debe ver mensaje de rechazo: solo limpiar banner/estado
                  this.ultimaInvite = undefined;
                  this.showCallUI = false;
                  this.callInfoMessage = null;
                  this.currentCallId = undefined;
                  this.cdr.markForCheck();
                }
              }
            });
          }
        );

        // 📞 Llamadas: fin (colgar)
        this.wsService.suscribirseAFinLlamada(this.usuarioActualId, (end) => {
          this.ngZone.run(() => {
            if (this.ultimaInvite && end.callId === this.ultimaInvite.callId) {
              this.ultimaInvite = undefined; // ⬅️ quita el banner
              this.currentCallId = undefined;
              this.callInfoMessage = null;
              this.callStatusClass = null;
              this.cdr.markForCheck();
              return;
            }

            // 2) Si no corresponde a mi llamada activa, ignoro
            if (!this.currentCallId || end.callId !== this.currentCallId)
              return;

            const yo = this.usuarioActualId;
            const colgoElOtro = Number(end.byUserId) !== Number(yo);

            if (colgoElOtro) {
              // 🧍 nombre del peer (si lo tienes en el chat actual)
              const peer = this.chatActual?.receptor;
              const peerNombre =
                ((peer?.nombre || '') + ' ' + (peer?.apellido || '')).trim() ||
                'La otra persona';

              // corta remoto por si existía
              try {
                this.remoteStream?.getTracks().forEach((t) => t.stop());
              } catch {}
              this.remoteStream = null;

              // Si estaba la UI de llamada abierta, muestro “ha colgado” y cierro
              if (this.showCallUI) {
                this.callInfoMessage = `${peerNombre} ha colgado`;
                this.callStatusClass = 'is-ended';
                this.cdr.markForCheck();
                setTimeout(() => this.cerrarLlamadaLocal(), 1000);
              } else {
                // si no hay UI (raro), simplemente limpio
                this.cerrarLlamadaLocal();
              }
            } else {
              // Fui yo quien colgó → ya gestiono el cierre local
              this.cerrarLlamadaLocal();
            }
          });
        });

        // 🔔 Notificaciones (unseen / invites / responses)
        this.wsService.suscribirseANotificaciones(
          this.usuarioActualId,
          (raw: unknown) => {
            this.ngZone.run(() => {
              if (isUnseenCountWS(raw)) {
                const uid = (raw as any).userId;
                if (
                  uid != null &&
                  Number(uid) !== Number(this.usuarioActualId)
                ) {
                  return; // contador de otro usuario → ignorar
                }
                this.unseenCount = raw.unseenCount;
              } else if (isGroupInviteWS(raw)) {
                const handled = this.getHandledInviteIds();
                if (!handled.has(Number(raw.inviteId))) {
                  const exists = this.notifInvites.some(
                    (n) => n.inviteId === raw.inviteId
                  );
                  if (!exists) {
                    this.notifInvites = [
                      { ...raw, kind: 'INVITE' as const },
                      ...this.notifInvites,
                    ];
                  }
                }
                // unseenCount puede seguir actualizándose para tu otro badge si lo usas
                this.unseenCount = raw.unseenCount;
                this.cdr.markForCheck();
              }
            });
          }
        );

        // 🔔 Reconfirmar unseen
        this.notificationService.unseenCount(this.usuarioActualId).subscribe({
          next: (n) => {
            this.unseenCount = n;
            this.cdr.markForCheck();
          },
          error: (e) => console.error('❌ unseenCount:', e),
        });

        // 📨 Mensajes nuevos (individual)
        this.wsService.suscribirseAChat(
          this.usuarioActualId,
          async (mensaje) => {
            // NOTE: decrypting before entering ngZone run to keep it linear
            mensaje.contenido = await this.decryptContenido(mensaje.contenido, mensaje.emisorId, mensaje.receptorId);

            this.ngZone.run(async () => {
              const esDelChatActual =
                this.chatActual && mensaje.chatId === this.chatActual.id;

              if (mensaje.activo === false) return;

              if (esDelChatActual) {
                const i = this.mensajesSeleccionados.findIndex(
                  (m) => Number(m.id) === Number(mensaje.id)
                );
                if (i !== -1) {
                  this.mensajesSeleccionados = [
                    ...this.mensajesSeleccionados.slice(0, i),
                    { ...this.mensajesSeleccionados[i], ...mensaje },
                    ...this.mensajesSeleccionados.slice(i + 1),
                  ];
                } else {
                  this.mensajesSeleccionados = [
                    ...this.mensajesSeleccionados,
                    mensaje,
                  ];
                }

                this.scrollAlFinal();

                // marcar leído si es para mí
                if (
                  mensaje.receptorId === this.usuarioActualId &&
                  !mensaje.leido &&
                  mensaje.id != null
                ) {
                  this.wsService.marcarMensajesComoLeidos([mensaje.id]);
                }

                // este chat no acumula no leídos
                const item = this.chats.find((c) => c.id === mensaje.chatId);
                if (item) item.unreadCount = 0;

                // preview in-place
                const chat = this.chats.find((c) => c.id === mensaje.chatId);
                if (chat) {
                  const { preview, fecha, lastId } = computePreviewPatch(
                    mensaje,
                    chat,
                    this.usuarioActualId
                  );
                  chat.ultimaMensaje = preview;
                  chat.ultimaFecha = fecha;
                  chat.lastPreviewId = lastId;
                }
              } else {
                if (mensaje.receptorId === this.usuarioActualId) {
                  const item = this.chats.find((c) => c.id === mensaje.chatId);
                  if (item) {
                    item.unreadCount = (item.unreadCount || 0) + 1;
                    const { preview, fecha, lastId } = computePreviewPatch(
                      mensaje,
                      item,
                      this.usuarioActualId
                    );
                    item.ultimaMensaje = preview;
                    item.ultimaFecha = fecha;
                    item.lastPreviewId = lastId;
                  } else {
                    // 📨 Mensaje entrante para mí en otro chat (posible chat nuevo)
                    if (mensaje.receptorId === this.usuarioActualId) {
                      let item = this.chats.find(
                        (c) => c.id === mensaje.chatId
                      );

                      if (!item) {
                        // ⛳️ Chat no existe aún → crear entrada mínima
                        const peerId = Number(mensaje.emisorId);
                        const peerNombre = (mensaje.emisorNombre || '').trim();
                        const peerApellido = (
                          mensaje.emisorApellido || ''
                        ).trim();
                        const nombre =
                          `${peerNombre} ${peerApellido}`.trim() || 'Usuario';

                        const foto = avatarOrDefault(
                          (mensaje as any).emisorFoto
                        );

                        item = {
                          id: Number(mensaje.chatId),
                          esGrupo: false,
                          nombre,
                          foto,
                          receptor: {
                            id: peerId,
                            nombre: peerNombre,
                            apellido: peerApellido,
                            foto,
                          },
                          estado: 'Desconectado',
                          ultimaMensaje: 'Sin mensajes aún',
                          ultimaFecha: null,
                          lastPreviewId: null,
                          unreadCount: 0,
                        };

                        // Inserta el chat arriba
                        this.chats = [item, ...this.chats];

                        // (Opcional) enriquecer desde backend para foto/apellidos correctos
                        this.enrichPeerFromServer?.(
                          peerId,
                          Number(mensaje.chatId)
                        );

                        // Suscribir estado del peer (string → normalizado)
                        if (
                          peerId &&
                          peerId !== this.usuarioActualId &&
                          !this.suscritosEstado.has(peerId)
                        ) {
                          this.suscritosEstado.add(peerId);
                          this.wsService.suscribirseAEstado(
                            peerId,
                            (estadoStr: string) => {
                              const estado = this.toEstado(estadoStr);
                              const c = this.chats.find(
                                (x) => x.receptor?.id === peerId
                              );
                              if (c) c.estado = estado;
                              if (this.chatActual?.receptor?.id === peerId) {
                                this.chatActual.estado = estado;
                              }
                              this.cdr.markForCheck();
                            }
                          );
                        }
                      }

                      // 📌 Actualiza preview y contador de no leídos
                      item.unreadCount = (item.unreadCount || 0) + 1;

                      const { preview, fecha, lastId } = computePreviewPatch(
                        mensaje,
                        item,
                        this.usuarioActualId
                      );
                      item.ultimaMensaje = preview;
                      item.ultimaFecha = fecha;
                      item.lastPreviewId = lastId;

                      this.cdr.markForCheck();
                    }
                  }
                }
              }
            });
          }
        );

        // 👁 Leídos
        this.wsService.suscribirseALeidos(this.usuarioActualId, (mensajeId) => {
          const mensaje = this.mensajesSeleccionados.find(
            (m) => m.id === mensajeId
          );
          if (mensaje) mensaje.leido = true;
        });

        // 📝 Escribiendo... (individual + grupo)
        this.wsService.suscribirseAEscribiendo(
          this.usuarioActualId,
          (a: any, b?: any, c?: any) => {
            // firma 1: (emisorId, escribiendo, chatId?)
            // firma 2: ({ emisorId, escribiendo, chatId, emisorNombre })
            let emisorId: number;
            let escribiendo: boolean;
            let chatId: number | undefined;
            let emisorNombre: string | undefined;

            if (typeof a === 'object') {
              emisorId = Number(a.emisorId);
              escribiendo = !!a.escribiendo;
              chatId = a.chatId != null ? Number(a.chatId) : undefined;
              emisorNombre = a.emisorNombre;
            } else {
              emisorId = Number(a);
              escribiendo = !!b;
              chatId = c != null ? Number(c) : undefined;
            }

            this.ngZone.run(() => {
              // Grupo
              if (chatId) {
                if (escribiendo) {
                  this.gruposEscribiendo.add(chatId);
                  if (emisorNombre)
                    this.quienEscribeEnGrupo.set(chatId, emisorNombre);
                } else {
                  this.gruposEscribiendo.delete(chatId);
                  this.quienEscribeEnGrupo.delete(chatId);
                }
                if (this.chatActual?.id === chatId)
                  this.usuarioEscribiendo = escribiendo;
                this.cdr.markForCheck();
                return;
              }

              // Individual
              if (this.chatActual?.receptor?.id === emisorId) {
                this.usuarioEscribiendo = escribiendo;
              }
              if (
                !this.chatActual ||
                this.chatActual.receptor?.id !== emisorId
              ) {
                if (escribiendo) this.usuariosEscribiendo.add(emisorId);
                else this.usuariosEscribiendo.delete(emisorId);
              }
              this.cdr.markForCheck();
            });
          }
        );

        // 🚫 Bloqueos
        this.wsService.suscribirseABloqueos(this.usuarioActualId, (payload) => {
          this.ngZone.run(() => {
            if (payload.type === 'BLOCKED') {
              this.meHanBloqueadoIds.add(payload.blockerId);
            } else if (payload.type === 'UNBLOCKED') {
              this.meHanBloqueadoIds.delete(payload.blockerId);
            }
            this.updateCachedMeHanBloqueado();
            this.cdr.markForCheck();
          });
        });

        // Grupos: mensajes entrantes
        // (me suscribo por cada grupo tras cargar los chats)
        this.listarTodosLosChats();

        // WS de eliminar
        this.wsService.suscribirseAEliminarMensaje(
          this.usuarioActualId,
          (mensaje) => {
            if (mensaje.activo !== false) return;
            this.ngZone.run(() => this.aplicarEliminacionEnUI(mensaje));
          }
        );
      });
    });
  }

  // ==========
  // PUBLIC METHODS (usados desde template o públicamente)
  // ==========

  /**
   * Obtiene la lista de todos los chats (individuales y grupales) del usuario actual desde el backend.
   * También se suscribe a los estados de conexión de los otros usuarios y a los mensajes de los grupos.
   */
  public listarTodosLosChats(): void {
    const usuarioId = this.usuarioActualId;

    this.chatService.listarTodosLosChats(usuarioId).subscribe({
      next: (chats: any[]) => {
        this.chats = chats.map((chat) => {
          const esGrupo = !chat.receptor;
          const nombre = esGrupo
            ? chat.nombreGrupo
            : `${chat.receptor.nombre} ${chat.receptor.apellido}`;

          const foto = avatarOrDefault(
            esGrupo ? chat.fotoGrupo || chat.foto : chat.receptor?.foto
          );
          const { isAudio, seconds, label } = parseAudioPreviewText(
            chat.ultimaMensaje
          );
          const receptorId = chat.receptor?.id ?? null;

          // Estado (solo individuales)
          if (
            receptorId &&
            receptorId !== this.usuarioActualId &&
            !this.suscritosEstado.has(receptorId)
          ) {
            this.suscritosEstado.add(receptorId);
            this.wsService.suscribirseAEstado(receptorId, (estado) => {
              const c = this.chats.find((x) => x.receptor?.id === receptorId);
              if (c) c.estado = estado;
            });
          }

          return {
            ...chat,
            esGrupo,
            nombre,
            foto,
            estado: 'Desconectado',
            ultimaMensaje: chat.ultimaMensaje || 'Sin mensajes aún',
            ultimaFecha: chat.ultimaFecha || null,
            lastPreviewId: chat.ultimaMensajeId ?? null,
            unreadCount: chat.unreadCount ?? 0,
            __ultimaEsAudio: isAudio,
            __ultimaAudioSeg: seconds,
            __ultimaLabel: label,
          };
        });

        // Suscribirse a TODOS los grupos (una vez por grupo)
        this.chats
          .filter((c) => c.esGrupo)
          .forEach((g) => {
            this.wsService.suscribirseAChatGrupal(g.id, (mensaje) => {
              this.ngZone.run(() => this.handleMensajeGrupal(mensaje));
            });
          });

        // Estados iniciales (REST) para individuales
        const idsReceptores = this.chats
          .map((c) => c.receptor?.id)
          .filter((id) => id && id !== this.usuarioActualId);

        if (idsReceptores.length > 0) {
          this.chatService.obtenerEstadosDeUsuarios(idsReceptores).subscribe({
            next: (estados) => {
              this.chats.forEach((chat) => {
                const receptorId = chat.receptor?.id;
                if (receptorId && estados[receptorId] !== undefined) {
                  chat.estado = estados[receptorId]
                    ? 'Conectado'
                    : 'Desconectado';
                }
              });
            },
            error: (err) => console.error('❌ Error estados:', err),
          });
        }

        // 🔐 Descifrar los previews de manera asíncrona tras la carga inicial
        for (let chat of this.chats) {
          if (chat.ultimaMensaje) {
            let msgStr = chat.ultimaMensaje;
            let prf = '';
            let jsonStr = msgStr;
            const match = msgStr.match(/^([^:]+:\s)(.*)/);
            if (match) {
              prf = match[1];
              jsonStr = match[2];
            }
            if (jsonStr.startsWith('{') && jsonStr.includes('"type":"E2E"')) {
              this.decryptPreviewString(jsonStr).then((decrypted: string) => {
                let trunc = decrypted.length > 60 ? decrypted.substring(0, 59) + '…' : decrypted;
                chat.ultimaMensaje = prf + trunc;
                this.cdr.markForCheck();
              });
            }
          }
        }
      },
      error: (err) => console.error('❌ Error chats:', err),
    });
  }

  /**
   * Carga y muestra los mensajes de un chat específico cuando el usuario hace clic en él.
   * @param chat El chat (individual o grupal) seleccionado en la barra lateral.
   */
  public mostrarMensajes(chat: any): void {
    this.chatSeleccionadoId = chat.id;
    this.chatActual = chat;

    // Reset de flags de edición y estado UI
    this.resetEdicion(); // ← asegura que limpia haSalidoDelGrupo/mensajeNuevo/menú

    // Estado de mensajes / typing
    this.mensajesSeleccionados = [];
    this.usuarioEscribiendo = false;
    this.typingSetHeader.clear();
    this.escribiendoHeader = '';

    // === Persistencia local: grupos abandonados ===
    const raw = localStorage.getItem('leftGroupIds');
    const leftSet = new Set<number>(raw ? JSON.parse(raw) : []);

    // Fallback inmediato UX: si ya sabemos que lo dejaste, marcamos estado
    if (chat.esGrupo && leftSet.has(Number(chat.id))) {
      this.haSalidoDelGrupo = true;
      this.mensajeNuevo = 'Has salido del grupo';
    }

    // Helper: cargar mensajes (con manejo de errores)
    const loadMessages = () => {
      const fuente$ = chat.esGrupo
        ? this.chatService.listarMensajesPorChatGrupal(chat.id)
        : this.chatService.listarMensajesPorChat(chat.id);

      fuente$.subscribe({
        next: async (mensajes: any[]) => {
          let lista = mensajes || [];
          if (!chat.esGrupo) {
            for (let m of lista) {
              m.contenido = await this.decryptContenido(m.contenido, m.emisorId, m.receptorId);
            }
          }
          this.mensajesSeleccionados = lista;

          // Marcar como leídos (solo individuales)
          if (!chat.esGrupo) {
            const noLeidos = this.mensajesSeleccionados
              .filter(
                (m) =>
                  !m.leido &&
                  m.receptorId === this.usuarioActualId &&
                  m.id != null
              )
              .map((m) => m.id as number);
            if (noLeidos.length > 0) {
              this.wsService.marcarMensajesComoLeidos(noLeidos);
            }
          }

          // Poner en 0 los unread del item abierto
          const item = this.chats.find((c) => c.id === chat.id);
          if (item) item.unreadCount = 0;

          // Typing grupo (solo header del chat abierto)
          if (chat.esGrupo) {
            this.wsService.suscribirseAEscribiendoGrupo(
              chat.id,
              (data: any) => {
                if (!this.chatActual || this.chatActual.id !== data.chatId)
                  return;
                if (Number(data.emisorId) === this.usuarioActualId) return;

                const nombre =
                  (
                    data.emisorNombre ||
                    getNombrePorId(this.chats, data.emisorId) ||
                    'Alguien'
                  ).trim() +
                  (data.emisorApellido ? ` ${data.emisorApellido}` : '');

                if (data.escribiendo) this.typingSetHeader.add(nombre);
                else this.typingSetHeader.delete(nombre);

                this.escribiendoHeader = buildTypingHeaderText(
                  Array.from(this.typingSetHeader)
                );
                this.cdr.markForCheck();
              }
            );
          }

          this.scrollAlFinal();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('❌ Error al obtener mensajes:', err);
          // Si el back devuelve 403/404 por no miembro, re-afirmamos estado
          if (chat.esGrupo && (err.status === 403 || err.status === 404)) {
            this.haSalidoDelGrupo = true;
            this.mensajeNuevo = 'Has salido del grupo';
            leftSet.add(Number(chat.id));
            localStorage.setItem(
              'leftGroupIds',
              JSON.stringify(Array.from(leftSet))
            );
          }
        },
      });
    };

    // === Confirmación robusta con backend (solo grupos) ===
    if (chat.esGrupo) {
      this.chatService
        .esMiembroDeGrupo(Number(chat.id), this.usuarioActualId)
        .subscribe({
          next: (res) => {
            if (!res?.esMiembro || res?.groupDeleted) {
              this.haSalidoDelGrupo = true;
              this.mensajeNuevo = 'Has salido del grupo';
              leftSet.add(Number(chat.id));
              localStorage.setItem(
                'leftGroupIds',
                JSON.stringify(Array.from(leftSet))
              );
            } else {
              // Si el back dice que SÍ eres miembro, pero local decía que no → limpia
              if (leftSet.has(Number(chat.id))) {
                leftSet.delete(Number(chat.id));
                localStorage.setItem(
                  'leftGroupIds',
                  JSON.stringify(Array.from(leftSet))
                );
              }
            }
            loadMessages(); // Carga mensajes (si quieres bloquear lectura cuando no eres miembro, quita esto)
          },
          error: (err) => {
            console.error('❌ esMiembroDeGrupo:', err);
            // En errores críticos, mantenemos el fallback local y aún así intentamos cargar
            loadMessages();
          },
        });
    } else {
      // Individual: sin check de membresía
      loadMessages();
    }
  }

  private async decryptContenido(contenido: string, emisorId: number, receptorId: number): Promise<string> {
  return decryptContenidoE2E(
    contenido,
    emisorId,
    receptorId,
    this.usuarioActualId,
    this.cryptoService
  );
}

private async decryptPreviewString(contenido: string): Promise<string> {
  return decryptPreviewStringE2E(
    contenido,
    this.usuarioActualId,
    this.cryptoService
  );
}


  /**
   * Toma el texto escrito en el input, lo cifra si es un chat individual,
   * y lo envía al backend mediante WebSockets.
   */
  public async enviarMensaje(): Promise<void> {
    if (!this.mensajeNuevo?.trim() || !this.chatActual) return;
    if (this.haSalidoDelGrupo) return; // ← bloquea si estás fuera

    const contenido = this.mensajeNuevo.trim();
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;

    // === GRUPO (sin cifrado) ===
    if (this.chatActual.esGrupo) {
      const chatId = Number(this.chatActual.id);
      const mensaje: any = {
        contenido,
        emisorId: myId,
        receptorId: chatId, // en grupos, receptorId = chatId
        activo: true,
        chatId,
        tipo: 'TEXT',
      };

      const chatItem = (this.chats || []).find(
        (c: any) => Number(c.id) === chatId
      );
      const pseudo = { ...mensaje, emisorNombre: 'Tú' };

      const preview = buildPreviewFromMessage(pseudo, chatItem, myId);
      this.chats = updateChatPreview(this.chats || [], chatId, preview);
      if (chatItem) chatItem.unreadCount = 0;

      this.wsService.enviarMensajeGrupal(mensaje);
      this.mensajeNuevo = '';
      return;
    }

    // === INDIVIDUAL (sin cifrado) ===
    const receptorId = this.chatActual?.receptor?.id;
    if (!receptorId) return;

    const sendToExisting = async (chatId: number) => {
      let finalContenido = contenido;

      try {
        // Encriptación Híbrida E2E
        const receptorDTO = await this.authService.getById(receptorId).toPromise();

        const receptorPubKeyBase64 = receptorDTO?.publicKey;
        const emisorPrivKeyBase64 = localStorage.getItem(`privateKey_${this.usuarioActualId}`);
        const emisorPubKeyBase64 = localStorage.getItem(`publicKey_${this.usuarioActualId}`);

        if (receptorPubKeyBase64 && emisorPrivKeyBase64 && emisorPubKeyBase64) {
          // Generar llave AES aleatoria
          const aesKey = await this.cryptoService.generateAESKey();

          // Cifrar el mensaje con AES
          const { iv, ciphertext } = await this.cryptoService.encryptAES(contenido, aesKey);

          // Exportar la llave AES para cifrarla asimétricamente
          const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);

          // Cifrar la AES para el receptor
          const receptorRsaKey = await this.cryptoService.importPublicKey(receptorPubKeyBase64);
          const aesReceptorEncrypted = await this.cryptoService.encryptRSA(aesKeyRawBase64, receptorRsaKey);

          // Cifrar la AES para el emisor (para poder leer nuestro propio historial)
          const emisorRsaKey = await this.cryptoService.importPublicKey(emisorPubKeyBase64);
          const aesEmisorEncrypted = await this.cryptoService.encryptRSA(aesKeyRawBase64, emisorRsaKey);

          const adminPubKeyBase64 =
            localStorage.getItem('auditPublicKey') ||
            localStorage.getItem('publicKey_admin_audit') ||
            localStorage.getItem('forAdminPublicKey');

          let aesAdminEncrypted: string | undefined;

          if (adminPubKeyBase64) {
            try {
              const adminRsaKey = await this.cryptoService.importPublicKey(adminPubKeyBase64);
              aesAdminEncrypted = await this.cryptoService.encryptRSA(aesKeyRawBase64, adminRsaKey);
            } catch (error) {
              console.warn('No se pudo cifrar la llave AES para auditoría admin.', error);
            }
          }

          const e2ePayload: any = {
            type: "E2E",
            iv: iv,
            ciphertext: ciphertext,
            forEmisor: aesEmisorEncrypted,
            forReceptor: aesReceptorEncrypted
          };

          if (aesAdminEncrypted) {
            e2ePayload.forAdmin = aesAdminEncrypted;
          } else {
            e2ePayload.auditStatus = 'NO_AUDITABLE';
          }

          finalContenido = JSON.stringify(e2ePayload);
          // console.log("Mensaje cifrado a enviar:", e2ePayload);
        } else {
          console.warn("No se pudo cifrar E2E por falta de claves (Se enviará en texto plano).");
        }
      } catch (err) {
        console.error("Error cifrando mensaje E2E", err);
      }

      const mensaje: any = {
        contenido: finalContenido,
        emisorId: myId,
        receptorId,
        activo: true,
        chatId,
        tipo: 'TEXT',
      };

      const chatItem =
        (this.chats || []).find((c: any) => Number(c.id) === chatId) ||
        this.chatActual;

      // En la vista local mostramos el mensaje en texto plano para el preview
      const pseudo = { ...mensaje, contenido: contenido };
      const preview = buildPreviewFromMessage(pseudo, chatItem as any, myId);
      this.chats = updateChatPreview(this.chats || [], chatId, preview);

      const item = (this.chats || []).find((c: any) => c.id === chatId);
      if (item) item.unreadCount = 0;

      this.wsService.enviarMensajeIndividual(mensaje);
      this.mensajeNuevo = '';
    };

    // Ya existe el chat → enviar directamente
    if (this.chatActual.id) {
      await sendToExisting(Number(this.chatActual.id));
      return;
    }

    // Primer mensaje: crear chat y luego enviar
    const dto: any = {
      usuario1Id: myId,
      usuario2Id: receptorId,
    };

    this.chatService.crearChatIndividual(dto).subscribe({
      next: (created: any) => {
        const u1 = created?.usuario1;
        const u2 = created?.usuario2;

        const peer =
          u1 && u2
            ? u1.id === myId
              ? u2
              : u1
            : (this.chatActual?.receptor as any) || { id: receptorId };

        const nuevoItem = {
          id: created?.id ?? undefined,
          esGrupo: false,
          nombre: `${peer?.nombre ?? ''} ${peer?.apellido ?? ''}`.trim(),
          foto:
            peer?.foto && peer.foto.startsWith('data:')
              ? peer.foto
              : peer?.foto || 'assets/usuario.png',
          receptor: {
            id: peer?.id,
            nombre: peer?.nombre,
            apellido: peer?.apellido,
            foto: peer?.foto,
          },
          estado: 'Desconectado',
          ultimaMensaje: 'Sin mensajes aún',
          ultimaFecha: null,
          lastPreviewId: null,
          unreadCount: 0,
        };

        if (
          nuevoItem.id &&
          !(this.chats || []).some(
            (c: any) => Number(c.id) === Number(nuevoItem.id)
          )
        ) {
          this.chats = [nuevoItem, ...(this.chats || [])];
        }

        this.chatActual = nuevoItem as any;
        this.chatSeleccionadoId = created?.id ?? 0;
        this.mensajesSeleccionados = [];

        if (created?.id) {
          sendToExisting(created.id);
        } else {
          console.warn(
            'El back no devolvió id del chat; no puedo enviar el mensaje aún.'
          );
        }
      },
      error: (e) => {
        console.error('❌ crearChatIndividual:', e);
        // Si tu API devuelve 409 “ya existe”, aquí podrías buscar ese chat y llamar a sendToExisting(foundId)
      },
    });
  }

  /**
   * Captura el texto seleccionado con el ratón por el usuario sobre un mensaje.
   * Se usa para pre-llenar la consulta de la Inteligencia Artificial (IA).
   */
  public onMessageMouseUp(mensaje: MensajeDTO, _host?: HTMLElement): void {
    const sel = window.getSelection?.();
    const text = sel && sel.rangeCount > 0 ? sel.toString().trim() : '';
    if (text) {
      this.aiQuote = text;
    } else if ((mensaje.tipo || 'TEXT') === 'TEXT') {
      // si no hay selección, usa el contenido completo del mensaje de texto
      this.aiQuote = mensaje.contenido || '';
    } else {
      this.aiQuote = '';
    }
  }

  /**
   * Abre el panel auxiliar de la Inteligencia Artificial al hacer clic en las opciones del mensaje.
   */
  public openAiPanelFromMessage(mensaje: MensajeDTO): void {
    if (!this.orEmpty(this.aiQuote) && (mensaje.tipo || 'TEXT') === 'TEXT') {
      this.aiQuote = mensaje.contenido || '';
    }
    this.aiQuestion = this.aiQuestion || '¿Es esto verdad?';
    this.aiError = null;
    this.aiPanelOpen = true;
  }

  /**
   * Cierra el panel de consulta de la Inteligencia Artificial.
   */
  public cancelAiPanel(): void {
    this.aiPanelOpen = false;
    this.aiError = null;
    // si quieres resetear, descomenta:
    // this.aiQuote = '';
    // this.aiQuestion = '¿Es esto verdad?';
  }

  /**
   * Se ejecuta cuando el usuario escribe en la barra de búsqueda superior.
   * Llama a la API para buscar usuarios por nombre o correo.
   */
  public onTopbarSearch(ev: Event): void {
    const value = (ev.target as HTMLInputElement)?.value ?? '';
    this.topbarQuery = value.trim();

    if (!this.topbarQuery) {
      this.topbarResults = [];
      this.topbarOpen = false;
      return;
    }

    this.topbarSearching = true;
    this.authService.searchUsuarios(this.topbarQuery).subscribe({
      next: (rows) => {
        this.topbarResults = (rows || []) as UserWithEstado[];
        this.topbarOpen = true;
        this.fetchEstadosForTopbarResults(); // ⬅️ pide estados + WS live
      },
      error: (e) => {
        console.error('🔎 searchUsuarios error:', e);
        this.topbarResults = [];
        this.topbarOpen = true;
      },
      complete: () => (this.topbarSearching = false),
    });
  }

  /**
   * Oculta los resultados de la búsqueda superior.
   */
  public closeTopbarResults(): void {
    this.topbarOpen = false;
  }

  /**
   * Retorna la foto de perfil del usuario o una imagen por defecto genérica.
   */
  public avatarOrDefaultUser(u?: { foto?: string | null }): string {
    return u?.foto || 'assets/usuario.png';
  }

  /**
   * Concatena el nombre y apellido del usuario, eliminando espacios vacíos.
   */
  public nombreCompleto(u: UsuarioDTO): string {
    const nombre = u?.nombre?.trim() ?? '';
    const apellido = (u as any)?.apellido?.trim?.() ?? ''; // por si tu DTO trae apellido
    return (nombre + ' ' + apellido).trim();
  }

  /**
   * Inicia el flujo de chat cuando se selecciona un usuario en el buscador superior.
   * Si ya hay chat, lo abre. Si no, crea una visualización temporal antes del primer mensaje.
   */
  public onTopbarResultClick(u: UsuarioDTO): void {
    // 1) Cierra el panel y limpia estado del buscador
    this.topbarOpen = false;
    this.topbarResults = [];
    this.topbarQuery = '';

    const myId = this.getMyUserId();

    // 2) ¿Ya existe un chat individual con ese usuario?
    const existente = this.chats.find(
      (c) => !c.esGrupo && c.receptor?.id === u.id
    );
    if (existente) {
      this.mostrarMensajes(existente);
      return;
    }

    // 3) Prepara un "chat temporal" (sin id) para mostrar el header y el placeholder
    const nombre = `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim();
    this.chatActual = {
      id: undefined,
      esGrupo: false,
      nombre,
      foto: u.foto || 'assets/usuario.png',
      receptor: {
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        foto: u.foto,
      },
      estado: 'Desconectado',
      ultimaMensaje: 'Sin mensajes aún',
      ultimaFecha: null,
      lastPreviewId: null,
      unreadCount: 0,
    };

    this.chatSeleccionadoId = 0; // sentinel
    this.mensajesSeleccionados = [];
    this.usuarioEscribiendo = false;
    this.escribiendoHeader = '';
    this.typingSetHeader?.clear?.();

    // Suscribir estado del receptor (WS string → normalizado)
    if (u.id && u.id !== myId && !this.suscritosEstado.has(u.id)) {
      this.suscritosEstado.add(u.id);
      this.wsService.suscribirseAEstado(u.id, (estadoStr: string) => {
        const estado = this.toEstado(estadoStr);
        if (this.chatActual?.receptor?.id === u.id) {
          this.chatActual.estado = estado;
          this.cdr.markForCheck();
        }
        const c = this.chats.find((x) => x.receptor?.id === u.id);
        if (c) c.estado = estado;
      });
    }
  }

  /**
   * Notifica por WebSockets que el usuario actual está "Escribiendo...".
   */
  public notificarEscribiendo(): void {
    if (!this.chatActual) return;
    if (this.haSalidoDelGrupo) return;
    clearTimeout(this.escribiendoTimeout);

    if (this.chatActual.esGrupo) {
      this.wsService.enviarEscribiendoGrupo(
        this.usuarioActualId,
        this.chatActual.id,
        true
      );
      this.escribiendoTimeout = setTimeout(() => {
        this.wsService.enviarEscribiendoGrupo(
          this.usuarioActualId,
          this.chatActual.id,
          false
        );
      }, 1000);
    } else {
      const receptorId = this.chatActual.receptor?.id;
      if (!receptorId) return;
      this.wsService.enviarEscribiendo(this.usuarioActualId, receptorId, true);
      this.escribiendoTimeout = setTimeout(() => {
        this.wsService.enviarEscribiendo(
          this.usuarioActualId,
          receptorId,
          false
        );
      }, 1000);
    }
  }

  /**
   * Cambia el estatus global del usuario (Conectado, Ausente, Desconectado) y notifica a la red.
   */
  public cambiarEstado(
    nuevoEstado: 'Conectado' | 'Ausente' | 'Desconectado'
  ): void {
    if (nuevoEstado === this.estadoActual) return;

    const usuarioId = Number(localStorage.getItem('usuarioId'));
    if (this.wsService.stompClient?.connected && usuarioId) {
      const dto = { usuarioId, estado: nuevoEstado };
      this.wsService.stompClient.publish({
        destination: '/app/estado',
        body: JSON.stringify(dto),
      });

      this.estadoActual = nuevoEstado;
      // console.log(`🔁 Estado cambiado a: ${nuevoEstado}`);
    }
  }

  /**
   * Realiza un borrado lógico (invisible) de un mensaje del chat para todos.
   */
  public eliminarMensaje(mensaje: MensajeDTO): void {
    if (!mensaje.id) return;

    const i = this.mensajesSeleccionados.findIndex((m) => m.id === mensaje.id);
    if (i !== -1) {
      this.mensajesSeleccionados = [
        ...this.mensajesSeleccionados.slice(0, i),
        { ...this.mensajesSeleccionados[i], activo: false },
        ...this.mensajesSeleccionados.slice(i + 1),
      ];
    }

    this.wsService.enviarEliminarMensaje(mensaje);
  }

  /**
   * Muestra/Oculta el desplegable superior lateral de notificaciones e invitaciones y las marca como vistas.
   */
  public togglePanelNotificaciones(): void {
    this.panelNotificacionesAbierto = !this.panelNotificacionesAbierto;

    // marcar todas como vistas al abrir
    if (this.panelNotificacionesAbierto) {
      this.notificationService.markAllSeen(this.usuarioActualId).subscribe({
        next: () => {
          this.unseenCount = 0;
        },
        error: (e) => console.error('❌ markAllSeen:', e),
      });
    }
  }

  /**
   * Se une a un grupo al que el usuario fue invitado.
   */
  public aceptarInvitacion(inv: GroupInviteWS): void {
    this.groupInviteService
      .accept(inv.inviteId, this.usuarioActualId)
      .subscribe({
        next: () => {
          this.addHandledInviteId(Number(inv.inviteId)); // ⬅️ marca tratada
          this.notifInvites = this.notifInvites.filter(
            (n) => n.inviteId !== inv.inviteId
          );
          this.listarTodosLosChats();
          this.cdr.markForCheck();
        },
        error: (e) => console.error('❌ aceptar invitación:', e),
      });
  }

  /**
   * Rechaza una invitación a un grupo.
   */
  public rechazarInvitacion(inv: GroupInviteWS): void {
    this.groupInviteService
      .decline(inv.inviteId, this.usuarioActualId)
      .subscribe({
        next: () => {
          this.addHandledInviteId(Number(inv.inviteId)); // ⬅️ marca tratada
          this.notifInvites = this.notifInvites.filter(
            (n) => n.inviteId !== inv.inviteId
          );
          this.cdr.markForCheck();
        },
        error: (e) => console.error('❌ rechazar invitación:', e),
      });
  }

  /**
   * Limpia y esconde notificaciones marcándolas como procesadas.
   */
  public descartarRespuesta(resp: GroupInviteResponseWS): void {
    const before = this.notifItems.length;
    this.notifItems = this.notifItems.filter(
      (n) => !(n.kind === 'RESPONSE' && n.inviteId === resp.inviteId)
    );
    if (this.notifItems.length < before)
      this.pendingCount = Math.max(0, this.pendingCount - 1);
    this.cdr.markForCheck();
  }

  // Type guards (útiles en *ngIf)
  public isInvite(x: any): x is GroupInviteWS & { kind: 'INVITE' } {
    return x?.kind === 'INVITE';
  }

  public isResponse(x: any): x is GroupInviteResponseWS & { kind: 'RESPONSE' } {
    return x?.kind === 'RESPONSE';
  }

  // Wrappers para vista (delegan en utils)
  public esPreviewEliminado(chat: any): boolean {
    return isPreviewDeleted(chat?.ultimaMensaje);
  }

  public formatearPreview(chat: any): string {
    return formatPreviewText(chat?.ultimaMensaje);
  }

  /**
   * Une los nombres de los miembros de un grupo en una sola línea de texto.
   */
  public getMiembrosLinea(
    usuarios: Array<{ nombre: string; apellido?: string }> = []
  ): string {
    return joinMembersLine(usuarios);
  }

  /**
   * Asigna un color aleatorio (basado en el ID) para el avatar o nombre del usuario.
   */
  public getNameColor(userId: number): string {
    return colorForUserId(userId);
  }

  /**
   * Busca el nombre completo de un usuario en la lista de chats usando su ID.
   */
  public obtenerNombrePorId(userId: number): string | undefined {
    return getNombrePorId(this.chats, userId);
  }

  /**
   * Devuelve la imagen de perfil genérica en caso de que el usuario no tenga foto.
   */
  public getAvatarFallback(_userId: number): string {
    return 'assets/usuario.png';
  }

  /**
   * Intenta agregar a un nuevo usuario a un grupo existente (Falta integrar API).
   */
  public agregarUsuarioAlGrupo(u: {
    id: number;
    nombre: string;
    apellido: string;
  }): void {
    if (!this.chatActual?.esGrupo) return;
    // TODO: usar servicio real cuando esté listo
    // console.log('➕ Añadir al grupo', this.chatActual.id, '→ usuario', u.id);
  }

  // === Selección/creación de grupos (UI) ===

  /**
   * Filtra los usuarios disponibles para agregar a un grupo según la búsqueda y excluye los ya seleccionados.
   */
  public get usuariosFiltrados() {
    const q = (this.busquedaUsuario || '').toLowerCase().trim();
    const selIds = new Set(this.nuevoGrupo.seleccionados.map((s) => s.id));
    return this.allUsuariosMock
      .filter((u) => !selIds.has(u.id))
      .filter(
        (u) => !q || (u.nombre + ' ' + u.apellido).toLowerCase().includes(q)
      );
  }

  /**
   * Comprueba si un usuario ya está en la lista de invitados para el nuevo grupo.
   */
  public isSeleccionado(u: { id: number }): boolean {
    return this.nuevoGrupo.seleccionados.some((s) => s.id === u.id);
  }

  /**
   * Agrega o quita a un usuario de la lista de seleccionados al crear un nuevo grupo.
   */
  public toggleUsuario(u: {
    id: number;
    nombre: string;
    apellido: string;
    foto?: string;
  }): void {
    if (this.isSeleccionado(u)) {
      this.nuevoGrupo.seleccionados = this.nuevoGrupo.seleccionados.filter(
        (s) => s.id !== u.id
      );
    } else {
      this.nuevoGrupo.seleccionados = [u, ...this.nuevoGrupo.seleccionados];
    }
  }

  /**
   * Quita a un usuario específico de la lista de seleccionados para el nuevo grupo.
   */
  public removeSeleccionado(u: { id: number }): void {
    this.nuevoGrupo.seleccionados = this.nuevoGrupo.seleccionados.filter(
      (s) => s.id !== u.id
    );
  }

  /**
   * Previsualiza la foto que el usuario ha elegido como imagen para el nuevo grupo.
   */
  public onGroupImageSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.nuevoGrupo.fotoDataUrl = String(reader.result);
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  /**
   * Recoge los datos del formulario local y crea el chat grupal desde la interfaz antigua (usado por modal propio).
   */
  public crearGrupo(): void {
    const dto = {
      nombreGrupo: this.nuevoGrupo.nombre,
      usuarios: this.nuevoGrupo.seleccionados.map((u) => ({ id: u.id })),
      idCreador: this.usuarioActualId,
      fotoGrupo: this.nuevoGrupo.fotoDataUrl || undefined,
    };

    this.chatService.crearChatGrupal(dto as any).subscribe({
      next: () => {
        this.listarTodosLosChats();
        this.cerrarYResetModal();
      },
      error: (e) => console.error('❌ crear grupo:', e),
    });
  }

  /**
   * Delega la creación de un nuevo grupo al backend usando los datos del componente Modal.
   */
  public onCrearGrupo(dto: ChatGrupalCreateDTO): void {
    this.chatService.crearChatGrupal(dto as any).subscribe({
      next: () => {
        this.listarTodosLosChats();
        this.crearGrupoModalRef.close();
      },
      error: (e) => console.error('❌ crear grupo:', e),
    });
  }

  // === Audio: handlers públicos para el template ===

  /**
   * Inicia o detiene (y envía) la grabación del mensaje de voz.
   */
  public toggleRecording(): void {
    if (this.recording) {
      this.stopRecordingAndSend();
    } else {
      this.startRecording();
    }
  }

  /**
   * Envia inmediatamente el audio actual que se está grabando al hacer clic derecho o usar atajos.
   */
  public onSendAudioClick(ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.stopRecordingAndSend();
  }

  /**
   * Convierte milisegundos en formato mm:ss (minutos y segundos) usando la función externa.
   */
  public formatDur(ms?: number | null): string {
    return formatDuration(ms);
  }

  /**
   * Construye la URL correcta y accesible para que el navegador reproduzca un audio del servidor.
   */
  public getAudioSrc(m: MensajeDTO): string {
    const url = m.audioUrl || m.audioDataUrl || '';
    return resolveMediaUrl(url, environment.backendBaseUrl);
  }

  /**
   * Calcula el porcentaje (0 a 100) de progreso para la barra visual del audio reproducido.
   */
  public progressPercent(m: MensajeDTO): number {
    const id = Number(m.id);
    const st = this.audioStates.get(id);
    return clampPercent(st?.current ?? 0, st?.duration ?? 0);
  }

  /**
   * Evento que se dispara cuando el audio se carga en el navegador para saber su duración total.
   */
  public onAudioLoadedMetadata(m: MensajeDTO, audio: HTMLAudioElement): void {
    const id = Number(m.id);
    const d = isFinite(audio.duration)
      ? Math.max(0, Math.floor(audio.duration))
      : m.audioDuracionMs
      ? Math.floor(m.audioDuracionMs / 1000)
      : 0;
    const prev = this.audioStates.get(id);
    this.audioStates.set(id, {
      playing: prev?.playing ?? false,
      current: 0,
      duration: d,
    });
  }

  /**
   * Evento que se dispara cada segundo mientras el audio se reproduce para actualizar la barra de progreso.
   */
  public onAudioTimeUpdate(m: MensajeDTO, audio: HTMLAudioElement): void {
    const id = Number(m.id);
    const st =
      this.audioStates.get(id) ||
      ({ playing: false, current: 0, duration: 0 } as const);
    this.audioStates.set(id, { ...st, current: Math.floor(audio.currentTime) });
  }

  /**
   * Detiene visualmente la reproducción cuando el audio termina por completo.
   */
  public onAudioEnded(m: MensajeDTO): void {
    const id = Number(m.id);
    const st =
      this.audioStates.get(id) ||
      ({ playing: false, current: 0, duration: 0 } as const);
    this.audioStates.set(id, { ...st, playing: false, current: st.duration });
    if (this.currentPlayingId === id) this.currentPlayingId = null;
  }

  /**
   * Intercambia el estado Play/Pausa al hacer clic en un mensaje de voz y pausa cualquier otro audio sonando.
   */
  public togglePlay(m: MensajeDTO, audio: HTMLAudioElement): void {
    if (!m.id) return;
    const id = Number(m.id);
    const st = this.audioStates.get(id) || {
      playing: false,
      current: 0,
      duration: 0,
    };

    if (st.playing) {
      audio.pause();
      this.audioStates.set(id, { ...st, playing: false });
      this.currentPlayingId = null;
    } else {
      this.pauseAllAudios();
      if (isNaN(audio.duration) || !isFinite(audio.duration)) {
        try {
          audio.load();
        } catch {}
      }
      audio
        .play()
        .then(() => {
          const duration = isFinite(audio.duration)
            ? Math.max(0, Math.floor(audio.duration))
            : st.duration;
          this.audioStates.set(id, {
            playing: true,
            current: Math.floor(audio.currentTime || 0),
            duration,
          });
          this.currentPlayingId = id;
        })
        .catch((err) => console.error('No se pudo reproducir el audio:', err));
    }
  }

  /**
   * Analiza si el resumen del último mensaje es verdaderamente un mensaje de voz o texto escrito.
   */
  public isAudioPreviewChat(chat: any): boolean {
    return isAudioPreviewText(chat?.ultimaMensaje);
  }

  /**
   * Obtiene la duración en texto `mm:ss` del preview (vista previa) del audio del último mensaje.
   */
  public audioPreviewTime(chat: any): string {
    const durMs =
      chat?.ultimaAudioDurMs ?? parseAudioDurationMs(chat?.ultimaMensaje);
    return formatDuration(durMs);
  }

  /**
   * Obtiene la cantidad bruta de segundos de duración del preview del audio del chat.
   */
  public audioPreviewSeconds(chat: any): number {
    const t = String(this.audioPreviewTime(chat) || '');
    const m = /(\d{1,2}):(\d{2})/.exec(t);
    if (!m) return 4;
    const min = Number(m[1]) || 0;
    const sec = Number(m[2]) || 0;
    return Math.max(0, min * 60 + sec);
  }

  /**
   * Retorna el título descriptivo para el mensaje de audio en la barra lateral.
   */
  public audioPreviewLabel = (chat: any) =>
    chat?.__ultimaLabel ?? parseAudioPreviewText(chat?.ultimaMensaje).label;

  /**
   * Se ejecuta al escribir en el buscador lateral para filtrar chats por nombre.
   */
  public onSearchChange(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value || '';
    this.busquedaChat = value.trim();
  }

  // ✅ lista derivada para el *ngFor*
  //  - Coincidencias arriba (empieza por > contiene)
  //  - Luego el resto (sin coincidencia), conservando orden original
  //  - Empates: más no leídos primero y, luego, más reciente
  /**
   * Devuelve la lista ordenada localmente de los chats según su coincidencia de búsqueda, mensajes sin leer y fecha.
   */
  public get chatsFiltrados(): any[] {
    const q = this._norm(this.busquedaChat);
    if (!q) return this.chats;

    return this.chats
      .map((c, idx) => {
        const nombre = this._norm(c?.nombre || '');
        let score = 0;
        if (nombre.startsWith(q)) score = 2; // mejor match
        else if (nombre.includes(q)) score = 1; // match normal
        // score 0 = no coincide, se queda abajo
        return { c, idx, score };
      })
      .sort((a, b) => {
        // 1) por score (desc)
        if (b.score !== a.score) return b.score - a.score;

        // 2) entre coincidencias, más no leídos arriba
        const unreadDiff = (b.c.unreadCount || 0) - (a.c.unreadCount || 0);
        if (unreadDiff !== 0) return unreadDiff;

        // 3) por fecha (más reciente arriba)
        const fd = this._compareFechaDesc(a.c.ultimaFecha, b.c.ultimaFecha);
        if (fd !== 0) return fd;

        // 4) estable: índice original
        return a.idx - b.idx;
      })
      .map((x) => x.c);
  }

  // ==========
  // PRIVATE METHODS (helpers internos)
  // ==========

  /**
   * Limpia strings eliminando acentos, espacios o mayúsculas para facilitar búsquedas sin errores.
   */
  private _norm(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // quita diacríticos
  }

  /**
   * Ordena y decide qué fecha es más reciente entre dos valores de tiempo. (A versus B).
   */
  private _compareFechaDesc(a: any, b: any): number {
    const ta = a ? new Date(a).getTime() : 0;
    const tb = b ? new Date(b).getTime() : 0;
    return tb - ta;
  }

  /**
   * Obtiene la foto de perfil real del usuario utilizando el endpoint backend con su ID guardado en localStorage.
   */
  private cargarPerfil(): void {
    const idStr = localStorage.getItem('usuarioId');
    if (!idStr) return;
    const id = Number(idStr);

    this.authService.getById(id).subscribe({
      next: (u) => {
        this.usuarioFotoUrl = u.foto || 'assets/perfil.png';
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error cargando perfil:', err);
        this.usuarioFotoUrl = 'assets/perfil.png';
      },
    });
  }

  /**
   * Programa un reloj para cambiar de "Conectado" a "Ausente" si la persona no mueve el ratón en 20 minutos.
   */
  private inicializarDeteccionInactividad(): void {
    const eventos = ['mousemove', 'keydown', 'click', 'scroll'];

    const resetTimer = () => {
      if (this.estadoActual === 'Ausente') {
        this.cambiarEstado('Conectado');
      }
      clearTimeout(this.inactividadTimer);
      this.inactividadTimer = setTimeout(() => {
        this.cambiarEstado('Ausente');
      }, 20 * 60 * 1000); // 20 min
    };

    eventos.forEach((evento) => {
      window.addEventListener(evento, resetTimer);
    });

    resetTimer();
  }

  /**
   * Muestra texto parpadeante simulando que la Inteligencia Artificial "está pensando" y procesando respuesta.
   */
  private startAiWaitingAnimation(): void {
    this.aiWaitDots = 0;
    this.mensajeNuevo = 'Esperando a IA';
    this.stopAiWaitingAnimation(); // por si hubiera un ticker previo
    this.aiWaitTicker = setInterval(() => {
      this.aiWaitDots = (this.aiWaitDots + 1) % 4; // 0..3
      const dots = '.'.repeat(this.aiWaitDots);
      this.mensajeNuevo = `Esperando a IA${dots}`;
      this.cdr.markForCheck(); // si usas OnPush
    }, 400);
  }

  /**
   * Detiene el texto parpadeante de procesamiento de la Inteligencia Artificial.
   */
  private stopAiWaitingAnimation(): void {
    if (this.aiWaitTicker) {
      clearInterval(this.aiWaitTicker);
      this.aiWaitTicker = undefined;
    }
  }

  /**
   * Fuerza la barra de desplazamiento a ubicarse en el mensaje más reciente hasta abajo.
   */
  private scrollAlFinal(): void {
    try {
      setTimeout(() => {
        this.contenedorMensajes.nativeElement.scrollTop =
          this.contenedorMensajes.nativeElement.scrollHeight;
      }, 50);
    } catch (err) {
      console.warn('⚠️ No se pudo hacer scroll:', err);
    }
  }

  /**
   * El usuario cliquea "Contestar" al popup verde de llamada, validando permisos de micrófono/cámara y conectándolo.
   */
  public async aceptarLlamada(): Promise<void> {
    if (!this.ultimaInvite) return;

    // 👇 Primero probamos acceder a cam/mic. Si falla, rechazamos con motivo.
    try {
      await this.prepararMediosLocales();
    } catch (e: any) {
      // Rechazo automático por falta de medios
      this.wsService.responderLlamada(
        this.ultimaInvite.callId,
        this.ultimaInvite.callerId,
        this.ultimaInvite.calleeId,
        false,
        'NO_MEDIA'
      );
      // quitar el banner
      this.ultimaInvite = undefined;
      this.currentCallId = undefined;
      this.callInfoMessage = null;
      this.cdr.markForCheck();
      return;
    }

    // ✅ Medios OK → ahora sí aceptamos
    this.wsService.responderLlamada(
      this.ultimaInvite.callId,
      this.ultimaInvite.callerId,
      this.ultimaInvite.calleeId,
      true
    );
  }

  /**
   * El usuario rechaza la llamada entrante actual. Notifica al emisor que colgamos o cancelamos.
   */
  public rechazarLlamada(): void {
    if (!this.ultimaInvite) return;
    this.wsService.responderLlamada(
      this.ultimaInvite.callId,
      this.ultimaInvite.callerId,
      this.ultimaInvite.calleeId,
      false,
      'REJECTED'
    );
    this.ultimaInvite = undefined;
    this.currentCallId = undefined;
  }

  /**
   * Termina la videollamada actual, cortando la conexión tanto si fuiste el creador como si fuiste el invitado.
   */
  public colgar(): void {
    const callId = this.currentCallId ?? this.ultimaInvite?.callId;
    if (callId) {
      this.wsService.colgarLlamada(callId, this.usuarioActualId);
    }
    this.cerrarLlamadaLocal();
  }

  /**
   * Limpia y apaga recursos locales de una llamada finalizada (cierra la cámara, micrófono y conexión remota).
   */
  private cerrarLlamadaLocal(): void {
    try {
      this.localStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      this.remoteStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      this.peer?.close();
    } catch {}

    this.peer = undefined;
    this.localStream = null;
    this.remoteStream = null;

    // 🔹 Limpia el overlay de estado
    this.callInfoMessage = null;
    this.callStatusClass = null;
    this.remoteHasVideo = false;
    this.showCallUI = false;
    this.ultimaInvite = undefined;
    this.currentCallId = undefined;
    this.isMuted = false;
    this.camOff = false;
    this.cdr.markForCheck();
  }

  // Config STUN (puedes cambiar por tu TURN propio si quieres atravesar CG-NAT)
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  /**
   * Devuelve el nombre visible de la otra persona en la videollamada.
   */
  public get remoteDisplayName(): string {
    const n = (this.chatActual?.receptor?.nombre || '').trim();
    const a = (this.chatActual?.receptor?.apellido || '').trim();
    const full = `${n} ${a}`.trim();
    return full || 'La otra persona';
  }
  /**
   * Devuelve la foto de la otra persona en la videollamada para mostrar su recuadro.
   */
  public get remoteAvatarUrl(): string | null {
    const url = this.chatActual?.receptor?.foto?.trim();
    return url && url.length > 0 ? url : null;
  }

  /**
   * Comprueba si el usuario local tiene su cámara encendida actualmente enviando señal de vídeo.
   */
  public get hasLocalVideo(): boolean {
    return !!this.localStream?.getVideoTracks()?.length;
  }

  /**
   * Pide permiso al usuario para encender la cámara web y comienza a transmitir el vídeo al otro contacto.
   */
  private async enableLocalCamera(): Promise<void> {
    try {
      // solo vídeo (dejamos el audio actual intacto)
      const vStream: MediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const vTrack = vStream.getVideoTracks()[0];
      if (!vTrack) return;

      // 1) añade al localStream (para previsualizar)
      if (!this.localStream) {
        this.localStream = new MediaStream();
      }
      this.localStream.addTrack(vTrack);

      // 2) si ya hay peer, envíalo
      if (this.peer) {
        this.videoSender = this.peer.addTrack(vTrack, this.localStream);
      }

      this.camOff = false;
      this.cdr.markForCheck();
    } catch (e) {
      console.error('No se pudo encender la cámara', e);
      // feedback opcional al usuario
    }
  }

  /**
   * Detiene la cámara web local y deja de enviar señal de vídeo, pero mantiene el audio activo.
   */
  private disableLocalCamera(): void {
    try {
      // 1) corta envío WebRTC
      if (this.peer && this.videoSender) {
        try {
          this.peer.removeTrack(this.videoSender);
        } catch {}
        this.videoSender = undefined;
      }
      // 2) detén y quita tracks del stream local
      const vids = this.localStream?.getVideoTracks() || [];
      vids.forEach((t) => {
        try {
          t.stop();
        } catch {}
        this.localStream?.removeTrack(t);
      });
    } finally {
      this.camOff = true;
      this.cdr.markForCheck();
    }
  }

  /**
   * Verifica contínuamente si la otra persona está enviando vídeo y actualiza la ventana visual del chat.
   */
  private updateRemoteVideoPresence(): void {
    const has = !!this.remoteStream
      ?.getVideoTracks()
      ?.some((t) => t.readyState === 'live');
    this.remoteHasVideo = has;
    this.cdr.markForCheck();
  }

  /**
   * Prepara los eventos de red necesarios para poder recibir o realizar llamadas (WebRTC).
   */
  private prepararSuscripcionesWebRTC(): void {
    // OFERTA entrante (inicial o de renegociación)
    this.wsService.suscribirseASdpOffer(this.usuarioActualId, async (offer) => {
      if (!offer?.sdp) return;
      await this._handleRemoteOffer(offer);
    });

    // ANSWER entrante (yo soy A)
    this.wsService.suscribirseASdpAnswer(this.usuarioActualId, async (ans) => {
      if (!ans?.sdp || !this.peer) return;
      await this.peer.setRemoteDescription({ type: 'answer', sdp: ans.sdp });
    });

    // ICE entrante (ambos)
    this.wsService.suscribirseAIce(this.usuarioActualId, async (ice) => {
      if (!this.peer || !ice?.candidate) return;
      try {
        await this.peer.addIceCandidate({
          candidate: ice.candidate,
          sdpMid: ice.sdpMid ?? undefined,
          sdpMLineIndex: ice.sdpMLineIndex ?? undefined,
        });
      } catch (e) {
        console.error('addIceCandidate error', e);
      }
    });
  }

  /**
   * Procesa internamente una invitación oculta de sistema cuando otro usuario te está llamando, negociando red.
   */
  private async _handleRemoteOffer(offer: {
    callId: string;
    fromUserId: number;
    toUserId: number;
    sdp: string;
  }): Promise<void> {
    if (this.peer) {
      // 🔁 renegociación
      await this.peer.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer);
      this.wsService.enviarSdpAnswer({
        callId: offer.callId,
        fromUserId: this.usuarioActualId,
        toUserId: offer.fromUserId,
        sdp: answer.sdp as string,
      });
      return;
    }
    // primera vez (callee)
    await this.iniciarPeerComoCallee(offer);
  }

  /**
   * Comienza a llamar a otro usuario del chat pulsando el botón de videollamada.
   */
  public async iniciarVideollamada(chatId?: number): Promise<void> {
    if (!this.chatActual || this.chatActual.esGrupo) return;

    const callerId = this.usuarioActualId;
    const calleeId = Number(this.chatActual?.receptor?.id);
    if (!calleeId) return;

    // Prepara cámara/mic local (opcional mostrarte mientras suena)
    try {
      await this.prepararMediosLocales();
    } catch {}

    this.remoteStream = null; // <- asegura que NO hay remoto aún
    this.showCallUI = true;

    const nombreCallee =
      `${this.chatActual?.receptor?.nombre || ''} ${
        this.chatActual?.receptor?.apellido || ''
      }`.trim() || 'la otra persona';
    this.showRemoteStatus(`Llamando a ${nombreCallee}…`, 'is-ringing');

    // Envía invitación
    this.wsService.iniciarLlamada(callerId, calleeId, chatId);
  }

  /**
   * Interno: Una vez el otro acepta, crea la conexión definitiva desde tu lado para enviar audio y esperar vídeo.
   */
  private async iniciarPeerComoCaller(
    callId: string,
    toUserId: number
  ): Promise<void> {
    await this.prepararMediosLocales(); // solo audio
    this.crearPeerHandlers(callId, this.usuarioActualId, toUserId); // crea transceiver vídeo

    const offer = await this.peer!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peer!.setLocalDescription(offer);

    this.wsService.enviarSdpOffer({
      callId,
      fromUserId: this.usuarioActualId,
      toUserId,
      sdp: offer.sdp as string,
    });

    this.showCallUI = true;
    this.cdr.markForCheck();
  }

  /**
   * Interno: Te unes a una videollamada como invitado contestando con tu configuración de audio.
   */
  private async iniciarPeerComoCallee(offer: {
    callId: string;
    fromUserId: number;
    toUserId: number;
    sdp: string;
  }): Promise<void> {
    // ✅ ocultar banner de llamada entrante
    this.ultimaInvite = undefined;

    this.showCallUI = true;
    await this.prepararMediosLocales();
    this.crearPeerHandlers(
      offer.callId,
      this.usuarioActualId,
      offer.fromUserId
    );

    await this.peer!.setRemoteDescription({ type: 'offer', sdp: offer.sdp });

    const answer = await this.peer!.createAnswer();
    await this.peer!.setLocalDescription(answer);

    this.wsService.enviarSdpAnswer({
      callId: offer.callId,
      fromUserId: this.usuarioActualId,
      toUserId: offer.fromUserId,
      sdp: answer.sdp as string,
    });

    // Por si venías de “Llamando…”
    this.callInfoMessage = null;
    this.cdr.markForCheck();
  }

  /**
   * Verifica que estás en una página segura (HTTPS) y pide permisos básicos de micrófono al navegador.
   */
  private async prepararMediosLocales(): Promise<void> {
    // HTTPS requisito (salvo localhost)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      throw new Error('INSECURE_CONTEXT');
    }

    // si ya existe, no la recrees
    if (this.localStream) return;

    // ✅ Arrancamos SOLO con audio → cámara apagada por defecto
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch (e) {
      console.error('No se pudo acceder al micrófono', e);
      throw e; // NO_MEDIA
    }

    this.camOff = true;

    // si ya hay peer creado, añade el audio al peer
    if (this.peer && this.localStream) {
      for (const t of this.localStream.getAudioTracks()) {
        this.peer.addTrack(t, this.localStream);
      }
    }

    this.cdr.markForCheck();
  }

  /**
   * Recupera el nombre completo seguro (sin nulos) del compañero de chat.
   */
  public get peerDisplayName(): string {
    const n = this.chatActual?.receptor?.nombre || '';
    const a = this.chatActual?.receptor?.apellido || '';
    const full = `${n} ${a}`.trim();
    return full || 'La otra persona';
  }

  /** Devuelve la URL real de foto si existe; si no hay foto → null (para mostrar icono). */
  public get peerAvatarUrl(): string | null {
    const f = this.chatActual?.receptor?.foto?.trim();
    return f && !f.toLowerCase().includes('assets/usuario.png') ? f : null;
  }

  /**
   * Configura las reglas iniciales y los receptores de conexión WebRTC para conectar el video de otra persona directamente.
   */
  private crearPeerHandlers(
    callId: string,
    fromUserId: number,
    toUserId: number
  ): void {
    this.peer = new RTCPeerConnection(this.rtcConfig);

    // 1) AUDIO local
    const ls = this.localStream;
    if (ls) {
      ls.getAudioTracks().forEach((t) => this.peer!.addTrack(t, ls));
    }

    // 2) Reserva un transceiver de VÍDEO (m-line siempre presente)
    this.videoTransceiver = this.peer.addTransceiver('video', {
      direction: 'sendrecv',
    });
    // Arrancamos sin cámara → sender sin track (OK). Más tarde haremos replaceTrack().

    // 3) Remoto: añade pistas y reacciona a mute/unmute/ended de vídeo
    this.peer.ontrack = (ev) => {
      if (!this.remoteStream) this.remoteStream = new MediaStream();

      if (ev.streams && ev.streams[0]) {
        const s = ev.streams[0];
        s.getTracks().forEach((tr) => {
          if (!this.remoteStream!.getTracks().includes(tr)) {
            this.remoteStream!.addTrack(tr);
            if (tr.kind === 'video') this._wireRemoteVideoTrack(tr);
          }
        });
      } else if (ev.track) {
        const tr = ev.track;
        if (!this.remoteStream!.getTracks().includes(tr)) {
          this.remoteStream!.addTrack(tr);
        }
        if (tr.kind === 'video') this._wireRemoteVideoTrack(tr);
      }

      // si entra media remota, oculta overlays
      if (this.hasRemoteVideoActive) {
        this.callInfoMessage = null;
        this.callStatusClass = null;
      }
      this.cdr.markForCheck();
    };

    // 4) ICE saliente
    this.peer.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.wsService.enviarIce({
          callId,
          fromUserId,
          toUserId,
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid || undefined,
          sdpMLineIndex: ev.candidate.sdpMLineIndex ?? undefined,
        });
      }
    };

    // 5) Re-negociación cuando haga falta (p.ej. al encender cámara)
    this.peer.onnegotiationneeded = async () => {
      try {
        const offer = await this.peer!.createOffer();
        await this.peer!.setLocalDescription(offer);
        this.wsService.enviarSdpOffer({
          callId,
          fromUserId,
          toUserId,
          sdp: offer.sdp as string,
        });
      } catch (e) {
        console.error('[RTC] renegotiation error', e);
      }
    };

    // 6) Estados de conexión
    this.peer.oniceconnectionstatechange = () => {
      const st = this.peer?.iceConnectionState;
      if (st === 'disconnected' || st === 'failed') {
        this._teardownRemoteVideo('La otra persona ha colgado');
      }
    };
    this.peer.onconnectionstatechange = () => {
      const st = this.peer?.connectionState;
      if (st === 'failed' || st === 'closed') {
        this.cerrarLlamadaLocal();
      }
    };
  }

  /**
   * Adjunta funciones extra a la pista de vídeo de la otra persona para manejar cuando se apaga cámara o falla la app.
   */
  private _wireRemoteVideoTrack(track: MediaStreamTrack) {
    track.onended = () => {
      this._purgeDeadRemoteVideoTracks();
      this.cdr.markForCheck();
    };
    track.onmute = () => {
      // cuando el otro apaga su cámara
      this.cdr.markForCheck();
    };
    track.onunmute = () => {
      // cuando el otro enciende su cámara
      this.cdr.markForCheck();
    };
  }

  /**
   * Limpia y desecha internamente las pistas de vídeo ajenas que ya estén inservibles ("ended").
   */
  private _purgeDeadRemoteVideoTracks() {
    if (!this.remoteStream) return;
    this.remoteStream.getVideoTracks().forEach((t) => {
      if (t.readyState === 'ended') {
        try {
          this.remoteStream!.removeTrack(t);
        } catch {}
      }
    });
  }

  /**
   * Cortocircuita los permisos si la red a red falla y nos vemos obligados a "colgar" o limpiar el estado.
   */
  private _teardownRemoteVideo(msg: string) {
    try {
      this.remoteStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.remoteStream = null;
    this.callInfoMessage = msg;
    this.callStatusClass = 'is-ended';
    this.cdr.markForCheck();
    setTimeout(() => this.cerrarLlamadaLocal(), 1500);
  }

  /**
   * Helper que muestra un estado dinámico superpuesto en el chat y posiblemente cierra la llamada automáticamente en X tiempo.
   */
  private showRemoteStatus(
    message: string,
    cls: 'is-ringing' | 'is-ended' | 'is-error',
    autoCloseMs?: number
  ): void {
    this.callInfoMessage = message;
    this.callStatusClass = cls;
    this.cdr.markForCheck();
    if (autoCloseMs) {
      setTimeout(() => this.cerrarLlamadaLocal(), autoCloseMs);
    }
  }

  /**
   * Actuar automáticamente con nuestra señal interna WebRTC en el momento en el que el segundo usuario clica en aceptar.
   */
  private async onAnswerAccepted(
    callId: string,
    calleeId: number
  ): Promise<void> {
    await this.iniciarPeerComoCaller(callId, calleeId);
  }

  /**
   * Silencia o desactiva interactivamente el micrófono local para que la otra parte no te escuche.
   */
  public toggleMute(): void {
    if (!this.localStream) return;
    this.isMuted = !this.isMuted;
    this.localStream
      .getAudioTracks()
      .forEach((t) => (t.enabled = !this.isMuted));
  }

  /**
   * Interrumpe en tiempo real las transmisiones que captan imagen de tu webcam o pide permisos para enviarlo de nuevo.
   */
  public async toggleCam(): Promise<void> {
    // Encender
    if (this.camOff) {
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = v.getVideoTracks()[0];
        await this.replaceLocalVideoTrack(newTrack);
        this.camOff = false;
      } catch (e) {
        console.error('No se pudo encender la cámara', e);
        // feedback opcional
      }
    } else {
      // Apagar
      await this.replaceLocalVideoTrack(null); // deja de enviar vídeo
      this.camOff = true;
    }

    this.cdr.markForCheck();
  }

  /**
   * Substituye activamente la pista de grabación de tu cámara en la conexión global sin tirar la llamada en curso.
   */
  private async replaceLocalVideoTrack(
    track: MediaStreamTrack | null
  ): Promise<void> {
    if (!this.localStream) this.localStream = new MediaStream();

    // 1) quita la pista de vídeo local anterior del stream local
    this.localStream.getVideoTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
      try {
        this.localStream!.removeTrack(t);
      } catch {}
    });

    // 2) añade la nueva al stream local (para vernos en el "local-video")
    if (track) {
      this.localStream.addTrack(track);
    }

    // 3) asegura transceiver de vídeo y reemplaza el track que enviamos
    if (!this.videoTransceiver && this.peer) {
      this.videoTransceiver = this.peer.addTransceiver('video', {
        direction: 'sendrecv',
      });
    }
    if (this.videoTransceiver) {
      try {
        await this.videoTransceiver.sender.replaceTrack(track);
      } catch (e) {
        console.warn('replaceTrack falló, intentando addTrack', e);
        if (track && this.peer) this.peer.addTrack(track, this.localStream);
      }
    } else if (track && this.peer) {
      // fallback si todavía no hay transceiver (muy raro si seguiste arriba)
      this.peer.addTrack(track, this.localStream);
    }
  }

  /**
   * Actualiza tu interfaz individual quitando el mensaje "x" (pasando a activo: false) sin recargar toda la página desde 0.
   */
  private aplicarEliminacionEnUI(mensaje: MensajeDTO): void {
    const deletedId = Number(mensaje.id);
    const chatId = (mensaje as any).chatId;

    // 1) Marca en hilo abierto
    const idxMsg = this.mensajesSeleccionados.findIndex(
      (m) => Number(m.id) === deletedId
    );
    if (idxMsg !== -1) {
      this.mensajesSeleccionados = [
        ...this.mensajesSeleccionados.slice(0, idxMsg),
        { ...this.mensajesSeleccionados[idxMsg], activo: false },
        ...this.mensajesSeleccionados.slice(idxMsg + 1),
      ];
    }

    // 2) Preview si afectaba al último mostrado
    const chatIdx = this.chats.findIndex(
      (c) => Number(c.id) === Number(chatId)
    );
    if (chatIdx === -1) {
      this.cdr.markForCheck();
      return;
    }

    const chatItem = this.chats[chatIdx];
    const lastShownId = Number(chatItem.lastPreviewId);

    if (!lastShownId || lastShownId !== deletedId) {
      this.cdr.markForCheck();
      return;
    }

    // Si el chat está abierto: busca nuevo último activo
    if (
      this.chatActual?.id === chatId &&
      this.mensajesSeleccionados.length > 0
    ) {
      const copia = [...this.mensajesSeleccionados];
      const newLast = [...copia].reverse().find((m) => m.activo !== false);

      if (newLast) {
        const preview = buildPreviewFromMessage(
          { ...newLast, chatId },
          chatItem,
          this.usuarioActualId
        );
        this.chats = updateChatPreview(
          this.chats,
          Number(chatId),
          preview,
          Number(newLast.id)
        );
      } else {
        this.chats = updateChatPreview(
          this.chats,
          Number(chatId),
          'Sin mensajes aún',
          null
        );
      }

      this.cdr.markForCheck();
      return;
    }

    // Si el chat NO está abierto → refrescar del servidor
    this.refrescarPreviewDesdeServidor(Number(chatId));
  }

  /**
   * Habla con los servidores de mensajería backend para refrescar y actualizar el resumen de "Último mensaje de chat"
   */
  private refrescarPreviewDesdeServidor(chatId: number): void {
    this.chatService.listarMensajesPorChat(chatId).subscribe({
      next: (mensajes) => {
        const lastActivo = [...mensajes]
          .reverse()
          .find((m: any) => m.activo !== false);

        const chatItem = this.chats.find(
          (c) => Number(c.id) === Number(chatId)
        );
        let preview = 'Sin mensajes aún';
        let lastId: number | null = null;

        if (lastActivo) {
          preview = buildPreviewFromMessage(
            { ...lastActivo, chatId },
            chatItem,
            this.usuarioActualId
          );
          lastId = Number(lastActivo.id);
        }

        this.chats = updateChatPreview(this.chats, chatId, preview, lastId);
      },
      error: (err) => console.error('❌ Error refrescando preview:', err),
    });
  }

  /**
   * Comprueba si el receptor en internet al otro lado del cable, tiene la cámara encendida, enviando video, y sin mutear.
   */
  public get hasRemoteVideoActive(): boolean {
    const vs = this.remoteStream?.getVideoTracks() ?? [];
    // vídeo “vivo”: no terminado y no muted
    return vs.some((t) => t.readyState === 'live' && !t.muted);
  }

  /**
   * Carga de manera retroactiva con el backend si hay invitaciones que han llegado mientras estábamos desconectados.
   */
  private syncNotifsFromServer(): void {
    this.notificationService.list(this.usuarioActualId).subscribe({
      next: (rows) => {
        const handled = this.getHandledInviteIds();

        // 1) Solo GROUP_INVITE
        const invites = (rows || [])
          .filter((r) => r.type === 'GROUP_INVITE')
          .map((r) => {
            const p = JSON.parse(r.payloadJson || '{}');
            return { ...p, kind: 'INVITE' as const } as GroupInviteWS & {
              kind: 'INVITE';
            };
          })
          // 2) Excluye localmente las ya tratadas
          .filter((p) => !handled.has(Number(p.inviteId)));

        // 3) Evita duplicados por inviteId
        const seen = new Set<number>();
        this.notifInvites = [];
        for (const inv of invites) {
          const id = Number(inv.inviteId);
          if (!seen.has(id)) {
            this.notifInvites.push(inv);
            seen.add(id);
          }
        }

        this.cdr.markForCheck();
      },
      error: (e) => console.error('❌ list notifications:', e),
    });
  }

  /**
   * Complementa y "embellece" localmente listados de un chat para obtener nombres/fotos reales desde la base de datos backend.
   */
  private enrichPeerFromServer(peerId: number, chatId: number): void {
    if (!peerId || this.enrichedUsers.has(peerId)) return;
    this.enrichedUsers.add(peerId);

    this.authService.getById(peerId).subscribe({
      next: (u) => {
        // 1) actualiza en la lista lateral
        const item = this.chats.find((c) => Number(c.id) === Number(chatId));
        if (item) {
          const nombre =
            `${u?.nombre ?? ''} ${u?.apellido ?? ''}`.trim() ||
            (u?.nombre ?? 'Usuario');
          const foto = u?.foto || 'assets/usuario.png';

          item.nombre = nombre;
          item.foto = foto;
          item.receptor = {
            id: u.id,
            nombre: u.nombre,
            apellido: u.apellido,
            foto: u.foto,
          };
        }

        // 2) si justo ese chat está abierto, refresca header también
        if (this.chatActual && Number(this.chatActual.id) === Number(chatId)) {
          this.chatActual.nombre =
            `${u?.nombre ?? ''} ${u?.apellido ?? ''}`.trim() ||
            (u?.nombre ?? 'Usuario');
          this.chatActual.foto = u?.foto || 'assets/usuario.png';
          this.chatActual.receptor = {
            id: u.id,
            nombre: u.nombre,
            apellido: u.apellido,
            foto: u.foto,
          };
        }

        this.cdr.markForCheck();
      },
      error: (e) => {
        console.warn(
          '[enrichPeerFromServer] no se pudo obtener perfil',
          peerId,
          e
        );
      },
    });
  }

  /**
   * Reacciona cuando ocurre un evento con mensajes grupales por socket. Sincroniza interfaz o incrementa contador si es pasivo.
   */
  private handleMensajeGrupal(mensaje: any): void {
    // Si no estoy en ese grupo → solo preview/contadores
    if (!this.chatActual || this.chatActual.id !== mensaje.chatId) {
      const chatItem = this.chats.find((c) => c.id === mensaje.chatId);
      if (chatItem) {
        if (mensaje.emisorId !== this.usuarioActualId) {
          chatItem.unreadCount = (chatItem.unreadCount || 0) + 1;
        }
        const { preview, fecha, lastId } = computePreviewPatch(
          mensaje,
          chatItem,
          this.usuarioActualId
        );
        chatItem.ultimaMensaje = preview;
        chatItem.ultimaFecha = fecha;
        chatItem.lastPreviewId = lastId;
        this.cdr.markForCheck();
      }
      return;
    }

    // Estoy en el grupo → añadir al hilo
    const i = this.mensajesSeleccionados.findIndex(
      (m) => Number(m.id) === Number(mensaje.id)
    );
    if (i !== -1) {
      this.mensajesSeleccionados = [
        ...this.mensajesSeleccionados.slice(0, i),
        { ...this.mensajesSeleccionados[i], ...mensaje },
        ...this.mensajesSeleccionados.slice(i + 1),
      ];
    } else {
      this.mensajesSeleccionados = [...this.mensajesSeleccionados, mensaje];
    }

    // Preview y scroll
    const chat = this.chats.find((c) => c.id === mensaje.chatId);
    if (chat) {
      const { preview, fecha, lastId } = computePreviewPatch(
        mensaje,
        chat,
        this.usuarioActualId
      );
      chat.ultimaMensaje = preview;
      chat.ultimaFecha = fecha;
      chat.lastPreviewId = lastId;
    }

    this.scrollAlFinal();
    this.cdr.markForCheck();
  }

  /**
   * Actualiza repetitivamente los colorines verdes y grises del listado superior (barra de estado/búsqueda).
   */
  private fetchEstadosForTopbarResults(): void {
    // Asegura que siempre sea number
    const myId: number = Number.isFinite(this.usuarioActualId)
      ? this.usuarioActualId
      : this.getMyUserId();

    // ✅ ids estrictamente number[]
    const ids: number[] = this.topbarResults
      .map((u) => u?.id)
      .filter(
        (id): id is number =>
          typeof id === 'number' && !Number.isNaN(id) && id !== myId
      );

    if (ids.length === 0) return;

    // a) REST: estado inicial (Conectado/Desconectado)
    this.chatService.obtenerEstadosDeUsuarios(ids).subscribe({
      next: (mapa: Record<number, boolean>) => {
        this.topbarResults = this.topbarResults.map((u) => {
          // si este usuario estaba en ids, aplicamos el estado
          const conectado = u.id != null && !!mapa?.[u.id];
          return { ...u, estado: conectado ? 'Conectado' : 'Desconectado' };
        });
        this.cdr.markForCheck();
      },
      error: (e) => console.warn('⚠️ estados REST (topbar):', e),
    });

    // b) WS: actualizaciones en vivo (string → normalizamos con toEstado)
    for (const id of ids) {
      if (this.topbarEstadoSuscritos.has(id)) continue;
      this.topbarEstadoSuscritos.add(id);

      this.wsService.suscribirseAEstado(id, (estadoStr: string) => {
        const estado = this.toEstado(estadoStr); // 'Conectado' | 'Desconectado' | 'Ausente'
        const i = this.topbarResults.findIndex((u) => u.id === id);
        if (i !== -1) {
          this.topbarResults[i] = { ...this.topbarResults[i], estado };
          this.cdr.markForCheck();
        }
      });
    }
  }

  /**
   * Pregunta a tu buscador (Chrome/Firefox/Edge) el mejor formato web compatible para codificar notas de audio. (webm/ogg).
   */
  private pickSupportedMime(): string | undefined {
    const MediaRec: any = (window as any).MediaRecorder;
    if (!MediaRec) return undefined;
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    return candidates.find((t) => MediaRec.isTypeSupported?.(t));
  }

  /**
   * Activa el micrófono en directo tras un permiso del usuario, y comienza cronómetro de grabación de la nota de voz.
   */
  public async startRecording(): Promise<void> {
    if (!this.recorderSupported) {
      alert('Tu navegador no soporta grabación de audio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;

      const mimeType = this.pickSupportedMime();
      this.audioChunks = [];
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.mediaRecorder = mr;

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) this.audioChunks.push(ev.data);
      };
      mr.onstop = () => {
        /* noop */
      };

      mr.start();
      this.recording = true;
      this.recordStartMs = Date.now();

      // Iniciar cronómetro
      this.clearRecordTicker();
      this.recordElapsedMs = 0;
      this.recordTicker = setInterval(() => {
        this.recordElapsedMs = Date.now() - this.recordStartMs;
        this.cdr.markForCheck();
      }, 200);
    } catch (e) {
      console.error('🎤 No se pudo acceder al micrófono:', e);
      alert('No se pudo acceder al micrófono.');
    }
  }

  /**
   * Homogeniza un estado ajeno de string en un Enum estándar interno de tipos válidos para que TypeScript no se queje.
   */
  private toEstado(s: string): EstadoUsuario {
    if (s === 'Conectado' || s === 'Ausente') return s;
    return 'Desconectado';
  }

  /**
   * Pausa/detiene en seco la grabación web y envía al servidor en forma de Blob todo lo guardado de la nota de voz.
   */
  public async stopRecordingAndSend(): Promise<void> {
    if (!this.mediaRecorder) return;
    const mr = this.mediaRecorder;

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      if (mr.state !== 'inactive') mr.stop();
    });

    this.clearRecordTicker();

    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = undefined;
    this.mediaRecorder = undefined;
    this.recording = false;

    const mime = (this.pickSupportedMime() ??
      (this.audioChunks[0] as any)?.type ??
      'audio/webm') as string;

    const blob = new Blob(this.audioChunks, { type: mime });
    const durMs = Date.now() - this.recordStartMs;
    this.audioChunks = [];

    this.mensajeriaService.uploadAudio(blob, durMs).subscribe({
      next: ({ url, mime: srvMime, durMs: srvDur }) => {
        this.enviarMensajeVozUrl(url, srvMime || mime, srvDur ?? durMs);
        this.recordElapsedMs = 0;
        this.cdr.markForCheck();
      },
      error: (e) => console.error('[AUDIO] upload error:', e),
    });
  }

  /**
   * Anula o tira a la basura la nota de audio de voz que estás grabando sin enviarla en ningún caso a los chats.
   */
  public async cancelRecording(): Promise<void> {
    if (this.mediaRecorder) {
      await new Promise<void>((resolve) => {
        this.mediaRecorder!.onstop = () => resolve();
        if (this.mediaRecorder!.state !== 'inactive')
          this.mediaRecorder!.stop();
      });
    }
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = undefined;
    this.mediaRecorder = undefined;

    this.clearRecordTicker();
    this.recording = false;
    this.audioChunks = [];
    this.recordElapsedMs = 0;
  }

  /**
   * Rescata localmente quién demonios eres (cargado de Memoria y Backend). En caso de no existir o caducar explota hacia Log-in.
   */
  private getMyUserId(): number {
    if (Number.isFinite(this.usuarioActualId)) return this.usuarioActualId;
    const raw = localStorage.getItem('usuarioId');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed)) {
      console.error('No hay usuarioId en localStorage.');
      throw new Error('No hay sesión iniciada');
    }
    this.usuarioActualId = parsed;

    // Recupera la lista de bloqueados inicial desde la sesión si existe
    const cachedBloqueados = localStorage.getItem('bloqueadosIds');
    if (cachedBloqueados) {
      try {
        const arr = JSON.parse(cachedBloqueados) as number[];
        this.bloqueadosIds = new Set(arr);
      } catch (e) {
        // failed to parse
      }
    }

    const cachedMeHanBloqueado = localStorage.getItem('meHanBloqueadoIds');
    if (cachedMeHanBloqueado) {
      try {
        const arr = JSON.parse(cachedMeHanBloqueado) as number[];
        this.meHanBloqueadoIds = new Set(arr);
      } catch (e) {
        // failed to parse
      }
    }

    return this.usuarioActualId;
  }

  /**
   * Detiene el reloj con forma visual ascendente (timer) que aparece localmente sobre el boton al iniciar audios de micrófono.
   */
  private clearRecordTicker(): void {
    if (this.recordTicker) {
      clearInterval(this.recordTicker);
      this.recordTicker = undefined;
    }
  }

  /**
   * Envía físicamente (post a sockets) la info codificada del audio subido con existo como mensaje de base de datos.
   */
  private enviarMensajeVozUrl(
    audioUrl: string,
    audioMime: string,
    durMs: number
  ): void {
    if (!this.chatActual) return;

    const esGrupo = !!this.chatActual.esGrupo;
    const chatId = Number(this.chatActual.id);
    const receptorId = esGrupo ? chatId : this.chatActual.receptor?.id;

    const mensaje: MensajeDTO = {
      tipo: 'AUDIO',
      audioUrl,
      audioMime,
      audioDuracionMs: durMs,
      contenido: '',
      emisorId: this.usuarioActualId,
      receptorId: receptorId,
      activo: true,
      chatId,
    };

    // Preview optimista
    const textoPreview = `🎤 Mensaje de voz (${this.formatDur(durMs)})`;
    this.chats = updateChatPreview(this.chats, chatId, textoPreview);
    const chatItem = this.chats.find((c) => Number(c.id) === chatId);
    if (chatItem) chatItem.unreadCount = 0;

    // WS
    esGrupo
      ? this.wsService.enviarMensajeGrupal(mensaje)
      : this.wsService.enviarMensajeIndividual(mensaje);
  }

  /**
   * Forzador imperativo de navegador (Vanilla): Localiza todo elemento web "<audio>" y lo detiene drásticamente.
   */
  private pauseAllAudios(): void {
    const audios = document.querySelectorAll<HTMLAudioElement>('audio');
    audios.forEach((a) => {
      try {
        a.pause();
      } catch {}
    });
    if (this.currentPlayingId != null) {
      const st = this.audioStates.get(this.currentPlayingId);
      if (st)
        this.audioStates.set(this.currentPlayingId, { ...st, playing: false });
    }
    this.currentPlayingId = null;
  }

  /**
   * Oculta el popup modal global de UI Bootstrap (El que usas en Crear grupo), limpiando a la vez datos temporales.
   */
  private cerrarYResetModal(): void {
    const el = document.getElementById('crearGrupoModal');
    if (el && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
      modal.hide();
    }

    this.nuevoGrupo = { nombre: '', fotoDataUrl: null, seleccionados: [] };
    this.busquedaUsuario = '';
  }

  /**
   * Despliega la cabecera visual de "Mute", "Vaciar chat", y etc para el contacto / chat actual.
   */
  public toggleMenuOpciones(): void {
    this.mostrarMenuOpciones = !this.mostrarMenuOpciones;
  }

  /**
   * Encoge/Ocullta el overlay menú.
   */
  public cerrarMenuOpciones(): void {
    this.mostrarMenuOpciones = false;
  }

  /**
   * Ejecutada por confirmación manual. Envía salida técnica, borra grupo y oculta todo referennce localizando IDs obsoletass.
   */
  public salirDelGrupo(): void {
    if (
      !this.chatActual ||
      !('esGrupo' in this.chatActual) ||
      !this.chatActual.esGrupo
    )
      return;

    const groupId = Number(this.chatActual.id);
    const userId = this.usuarioActualId;

    this.chatService.salirDeChatGrupal({ groupId, userId }).subscribe({
      next: (resp) => {
        if (resp?.ok) {
          // Estado UI "fuera"
          this.haSalidoDelGrupo = true;
          this.mensajeNuevo = 'Has salido del grupo';

          // Persistencia local para recordar que saliste de este grupo
          const raw = localStorage.getItem('leftGroupIds');
          const leftSet = new Set<number>(raw ? JSON.parse(raw) : []);
          leftSet.add(groupId);
          localStorage.setItem(
            'leftGroupIds',
            JSON.stringify(Array.from(leftSet))
          );

          // Cierra menú si lo tienes
          if (typeof this.cerrarMenuOpciones === 'function')
            this.cerrarMenuOpciones();

          // Si el grupo queda eliminado, puedes retirarlo de la lista
          if (resp.groupDeleted) {
            this.chats = (this.chats || []).filter(
              (c: any) => Number(c?.id) !== groupId
            );
            if (this.chatActual && Number(this.chatActual.id) === groupId) {
              this.chatActual = null;
            }
          }
        } else {
          alert(resp?.mensaje || 'No ha sido posible salir del grupo.');
        }
      },
      error: (err) => {
        console.error('❌ salirDeChatGrupal:', err);
        alert('Ha ocurrido un error al salir del grupo.');
      },
    });
  }

  /**
   * Rescata los IDs marcados permanentemente de localstorage de las invitaciones ya pasadas con botones declinar o aceptar.
   */
  private getHandledInviteIds(): Set<number> {
    const raw = localStorage.getItem(this.HANDLED_INVITES_KEY);
    return new Set<number>(raw ? JSON.parse(raw) : []);
  }
  /**
   * Memoriza persistemente un ID de invitación procesada de usuario al rechazar / Aceptar
   */
  private addHandledInviteId(id: number): void {
    const set = this.getHandledInviteIds();
    set.add(Number(id));
    localStorage.setItem(
      this.HANDLED_INVITES_KEY,
      JSON.stringify(Array.from(set))
    );
  }

  /**
   * Evento nativo de escritura dentro del campo `textarea`. Envía a webSockets avisos de que un individuo teclea.
   */
  public onKeydown(evt: any): void {
    if (this.haSalidoDelGrupo) {
      evt.preventDefault();
      return;
    }
    // Si no ha salido, notificar "escribiendo..."
    this.notificarEscribiendo();
  }

  /**
   * Evento enter sin shift, hace override global sobre envio visual de un salto y simula clicks del enviar forma.
   */
  public onEnter(evt: any): void {
    if (this.haSalidoDelGrupo) {
      evt.preventDefault();
      return;
    }
    this.enviarMensaje();
    evt.preventDefault();
  }

  /**
   * Reestablece/limpia todo input temporal falso, notificaciones locales a vacías en cabios globales de vistas
   */
  public resetEdicion(): void {
    this.haSalidoDelGrupo = false;
    this.mensajeNuevo = '';
    this.mostrarMenuOpciones = false;
  }

  /**
   * Detecta y protege con deshabilitado nativo general inputs UI si los IDS del individuo remoto encajan con los locales de bloqueo.
   */
  public get chatEstaBloqueado(): boolean {
    if (!this.chatActual || this.chatActual.esGrupo) return false;
    const peerId = this.chatActual.receptor?.id;
    if (!peerId) return false;
    return this.bloqueadosIds.has(peerId) || this.meHanBloqueadoIds.has(peerId);
  }

  /**
   * Informa a la interface sobre quién disparó unilateralmente el estado del bloqueo activo. (Retornando TRUE).
   */
  public get yoLoBloquee(): boolean {
    if (!this.chatActual || this.chatActual.esGrupo) return false;
    const peerId = this.chatActual.receptor?.id;
    if (!peerId) return false;

    // Devolvemos true si el servidor o localStorage confirma que el ID está bloqueado por nosotros
    return this.bloqueadosIds.has(peerId);
  }

  /**
   * Invierte asimétricamente al individuo activo según su estado cacheado (Si es target bloquéndolo/ o a la inversa desbloquearlo).
   */
  public toggleBloquearUsuario(): void {
    console.log("toggleBloquearUsuario() accionado.");
    if (!this.chatActual || this.chatActual.esGrupo) {
       console.log("Bloqueo abortado: No hay chat actual o es un grupo.");
       return;
    }
    const peerId = this.chatActual.receptor?.id;
    if (!peerId) {
       console.log("Bloqueo abortado: No hay ID de receptor.");
       return;
    }

    console.log("Intentando accionar contra peerId:", peerId);

    if (this.bloqueadosIds.has(peerId)) {
      console.log("Usuario ya está en nuestra lista bloqueadosIds. Procediendo a Desbloquear...");
      this.authService.desbloquearUsuario(peerId).subscribe({
        next: () => {
          console.log("Desbloqueo exitoso en backend.");
          this.bloqueadosIds.delete(peerId);
          this.updateCachedBloqueados();
          this.cdr.markForCheck();
        },
        error: (err) => alert("Error al desbloquear usuario")
      });
    } else {
      console.log("Usuario NO está en bloqueadosIds. Procediendo a Bloquear...");
      this.authService.bloquearUsuario(peerId).subscribe({
        next: () => {
          console.log("Bloqueo exitoso en backend.");
          this.bloqueadosIds.add(peerId);
          this.updateCachedBloqueados();
          this.cdr.markForCheck();
        },
        error: (err) => alert("Error al bloquear usuario")
      });
    }
    // Cierra el menú al accionar
    this.cerrarMenuOpciones();
  }

  /**
   * Guarda de manera imperativa en caché física (localstorage) cada modificador y estado local en Array bloqueos
   */
  private updateCachedBloqueados(): void {
    localStorage.setItem('bloqueadosIds', JSON.stringify(Array.from(this.bloqueadosIds)));
  }

  /**
   * Guarda de manera perenne cada aviso que hemos pillado del websocket entrante cuando A NOSOTROS nos bloquean.
   */
  private updateCachedMeHanBloqueado(): void {
    localStorage.setItem('meHanBloqueadoIds', JSON.stringify(Array.from(this.meHanBloqueadoIds)));
  }
}
