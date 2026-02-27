import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  ViewChild,
} from '@angular/core';
import { ChatService } from '../../../Service/chat/chat.service';
import { MensajeDTO } from '../../../Interface/MensajeDTO';
import { WebSocketService } from '../../../Service/WebSocket/web-socket.service';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { Client } from '@stomp/stompjs';
import { firstValueFrom } from 'rxjs';
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
  isSystemMessageLike,
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
  E2EDebugContext,
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
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { PerfilUsuarioSavePayload } from '../perfil-usuario/perfil-usuario.component';
import { SessionService } from '../../../Service/session/session.service';
import { ChatListItemDTO } from '../../../Interface/ChatListItemDTO';
import { MensajeReaccionDTO } from '../../../Interface/MensajeReaccionDTO';

// Bootstrap (modales)
declare const bootstrap: any;

type ToastVariant = 'danger' | 'success' | 'warning' | 'info';
interface ToastItem {
  id: number;
  message: string;
  title?: string;
  variant: ToastVariant;
  timeout?: any;
}

type OutgoingGroupPayloadClass =
  | 'PLAIN_TEXT'
  | 'JSON_E2E_GROUP'
  | 'JSON_E2E'
  | 'JSON_OTHER'
  | 'INVALID_JSON';

interface GroupE2EBuildResult {
  content: string;
  forReceptoresKeys: string[];
  expectedRecipientCount: number;
  expectedRecipientIds: number[];
}

interface AudioE2EBasePayload {
  type: 'E2E_AUDIO' | 'E2E_GROUP_AUDIO';
  ivFile: string;
  audioUrl: string;
  audioMime?: string;
  audioDuracionMs?: number;
  forEmisor: string;
  forAdmin: string;
}

interface AudioE2EIndividualPayload extends AudioE2EBasePayload {
  type: 'E2E_AUDIO';
  forReceptor: string;
}

interface AudioE2EGroupPayload extends AudioE2EBasePayload {
  type: 'E2E_GROUP_AUDIO';
  forReceptores: Record<string, string>;
}

type AudioE2EPayload = AudioE2EIndividualPayload | AudioE2EGroupPayload;

interface BuiltOutgoingAudioE2E {
  payload: AudioE2EPayload;
  encryptedBlob: Blob;
  forReceptoresKeys: string[];
  expectedRecipientIds: number[];
}

interface ImageE2EBasePayload {
  type: 'E2E_IMAGE' | 'E2E_GROUP_IMAGE';
  ivFile: string;
  imageUrl: string;
  imageMime?: string;
  imageNombre?: string;
  captionIv?: string;
  captionCiphertext?: string;
  forEmisor: string;
  forAdmin: string;
}

interface ImageE2EIndividualPayload extends ImageE2EBasePayload {
  type: 'E2E_IMAGE';
  forReceptor: string;
}

interface ImageE2EGroupPayload extends ImageE2EBasePayload {
  type: 'E2E_GROUP_IMAGE';
  forReceptores: Record<string, string>;
}

type ImageE2EPayload = ImageE2EIndividualPayload | ImageE2EGroupPayload;

interface BuiltOutgoingImageE2E {
  payload: ImageE2EPayload;
  encryptedBlob: Blob;
  forReceptoresKeys: string[];
  expectedRecipientIds: number[];
}

interface ChatHistoryState {
  messages: MensajeDTO[];
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  initialized: boolean;
}

interface GroupPayloadValidationResult {
  ok: boolean;
  code?: 'E2E_GROUP_PAYLOAD_INVALID' | 'E2E_RECIPIENT_KEYS_MISMATCH';
  reason?: string;
  forReceptoresKeys: string[];
}

interface WsSemanticErrorPayload {
  code?: string;
  message?: string;
  traceId?: string;
  chatId?: number;
  senderId?: number;
  ts?: string;
}

interface PendingGroupTextSendContext {
  chatId: number;
  plainText: string;
  replyToMessageId?: number;
  replySnippet?: string;
  replyAuthorName?: string;
  reenviado: boolean;
  mensajeOriginalId?: number;
  source: 'compose' | 'forward';
  createdAtMs: number;
  retryCount: number;
}

/**
 * Representa los diferentes estados en los que puede estar un usuario.
 */
export type EstadoUsuario = 'Conectado' | 'Desconectado' | 'Ausente';
type ChatListFilter = 'TODOS' | 'LEIDOS' | 'NO_LEIDOS' | 'GRUPOS';

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
    const localPending = this.pendingCount + this.invitePendingCount;
    return Math.max(this.unseenCount, localPending);
  }

  public recorderSupported =
    typeof (window as any).MediaRecorder !== 'undefined';
  public recording = false;
  public recordElapsedMs = 0;

  @ViewChild('crearGrupoModal')
  public crearGrupoModalRef!: CrearGrupoModalComponent;
  @ViewChild('notifWrapper') private notifWrapperRef?: ElementRef<HTMLElement>;

  public invitesPendientes: GroupInviteWS[] = []; // tarjetas “te invitaron…”
  public panelNotificacionesAbierto = false;

  public gruposEscribiendo = new Set<number>(); // chatId → hay alguien escribiendo
  public quienEscribeEnGrupo = new Map<number, string>();

  public trackMensaje = (_: number, m: MensajeDTO) => m.id ?? _;
  public trackIndex = (_: number, __: unknown) => _;

  public mensajeNuevo: string = '';
  public readonly incomingReactionChoices = ['👍', '❤️', '😂', '😮', '😢'];
  private readonly incomingReactionChoicesSet = new Set(
    this.incomingReactionChoices
  );
  public recBars = Array.from({ length: 14 });
  public showEmojiPicker = false;
  public showEmojiPickerMounted = false;
  public attachmentUploading = false;
  public pendingAttachmentFile: File | null = null;
  public pendingAttachmentPreviewUrl: string | null = null;
  public pendingAttachmentIsImage = false;

  public chatActual: any = null;
  public usuariosEscribiendo: Set<number> = new Set();

  @ViewChild('contenedorMensajes') private contenedorMensajes!: ElementRef;
  @ViewChild('messageInput')
  private messageInputRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('attachmentInput')
  private attachmentInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('emojiAnchor')
  private emojiAnchorRef?: ElementRef<HTMLElement>;

  public usuarioEscribiendo: boolean = false;

  public estadoPropio = 'Conectado';
  public estadoActual: string = 'Conectado';

  public notifItems: Array<GroupInviteResponseWS & { kind: 'RESPONSE' }> = [];

  public usuarioFotoUrl: string | null = null;
  public perfilUsuario: UsuarioDTO | null = null;
  public showTopbarProfileMenu = false;
  public activeMainView: 'chat' | 'profile' = 'chat';
  public profilePasswordCodeRequested = false;
  public profileSaving = false;
  public profileCodeTimeLeftSec = 0;

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
  public toasts: ToastItem[] = [];

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
  public openMensajeMenuId: number | null = null;
  private incomingQuickReactionsByMessageId = new Map<number, string>();
  public openIncomingReactionPickerMessageId: number | null = null;
  public mensajeRespuestaObjetivo: MensajeDTO | null = null;
  public forwardModalOpen = false;
  public mensajeReenvioOrigen: MensajeDTO | null = null;
  public forwardSelectedChatIds = new Set<number>();
  public forwardingInProgress = false;
  public showGroupInfoPanel = false;
  public showGroupInfoPanelMounted = false;
  private groupInfoCloseTimer: any = null;
  public showMessageSearchPanel = false;
  public showMessageSearchPanelMounted = false;
  private messageSearchCloseTimer: any = null;
  public highlightedMessageId: number | null = null;
  private highlightedMessageTimer: any = null;
  private messageSearchNavigationInFlight = false;
  private emojiPickerCloseTimer: any = null;
  private composeCursorStart = 0;
  private composeCursorEnd = 0;
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
  private banWsBound = false;
  private profileCodeTimer?: any;
  private chatsRefreshTimer: any = null;
  private auditPublicKeyInitPromise: Promise<void> | null = null;
  private groupRecipientSeedByChatId = new Map<number, number[]>();
  private localSystemMessageSeq = 0;
  private readonly HISTORY_PAGE_SIZE = 50;
  private readonly HISTORY_SCROLL_TOP_THRESHOLD = 80;
  private readonly GROUP_HISTORY_UNAVAILABLE_TEXT =
    'Mensajes anteriores a tu ingreso no están disponibles';
  private historyStateByConversation = new Map<string, ChatHistoryState>();
  private groupHistoryHiddenByChatId = new Map<number, boolean>();
  // STOMP (si necesitas desde template, cambia a public)
  private stompClient!: Client;

  private typingSetHeader = new Set<string>();
  private e2eWsErrorsBound = false;
  private pendingGroupTextSendByChatId = new Map<number, PendingGroupTextSendContext>();
  private retryingGroupTextSendByChatId = new Set<number>();
  private groupTextSendInFlightByChatId = new Set<number>();
  private decryptedAudioUrlByCacheKey = new Map<string, string>();
  private decryptingAudioByCacheKey = new Map<string, Promise<string | null>>();
  private decryptedImageUrlByCacheKey = new Map<string, string>();
  private decryptedImageCaptionByCacheKey = new Map<string, string>();
  private decryptingImageByCacheKey = new Map<string, Promise<string | null>>();

  public busquedaChat: string = '';
  public chatListFilter: ChatListFilter = 'TODOS';

  public bloqueadosIds = new Set<number>();
  public meHanBloqueadoIds = new Set<number>();
  public e2eSessionReady = true;

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
    private groupInviteService: GroupInviteService,
    private router: Router,
    private sessionService: SessionService
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
    void this.ensureLocalE2EKeysAndSyncPublicKey(this.usuarioActualId);
    void this.ensureAuditPublicKeyForE2E();

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

    // 🔐 Inicializa claves locales y pública bundle (si no existe)

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
        this.bindBanWsListener();
        this.bindE2EWsErrorListener();
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

        // Llamadas: respuestas (cuando el otro acepta/rechaza lo que yo llame)
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
                // Ambos continuan con WebRTC (A crea offer; B maneja la offer entrante)
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
              // Fui yo quien colgo: ya gestiono el cierre local
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
              } else if (isGroupInviteResponseWS(raw)) {
                const exists = this.notifItems.some(
                  (n) =>
                    n.kind === 'RESPONSE' &&
                    Number((n as any).inviteId) === Number(raw.inviteId)
                );
                if (!exists) {
                  this.notifItems = [
                    { ...raw, kind: 'RESPONSE' as const },
                    ...this.notifItems,
                  ];
                }
                this.pendingCount = this.notifItems.length;
                this.unseenCount = raw.unseenCount;

                if (String(raw.status || '').toUpperCase() === 'ACCEPTED') {
                  // Un miembro aceptó invitación: refresca snapshot de chats/miembros.
                  this.scheduleChatsRefresh();
                }

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
          async (mensajeRaw: any) => {
            if (this.isMessageReactionEvent(mensajeRaw)) {
              this.ngZone.run(() =>
                this.applyIncomingReactionEvent(
                  mensajeRaw,
                  'ws-chat-individual-topic'
                )
              );
              return;
            }
            const mensaje = mensajeRaw as MensajeDTO;
            console.log('[INICIO] mensaje WS recibido (raw)', mensaje);
            // NOTE: decrypting before entering ngZone run to keep it linear
            mensaje.contenido = await this.decryptContenido(
              mensaje.contenido,
              mensaje.emisorId,
              mensaje.receptorId,
              {
                chatId: Number(mensaje?.chatId),
                mensajeId: Number(mensaje?.id),
                source: 'ws-individual',
              }
            );
            await this.hydrateIncomingAudioMessage(mensaje, {
              chatId: Number(mensaje?.chatId),
              mensajeId: Number(mensaje?.id),
              source: 'ws-individual-audio',
            });
            await this.hydrateIncomingImageMessage(mensaje, {
              chatId: Number(mensaje?.chatId),
              mensajeId: Number(mensaje?.id),
              source: 'ws-individual-image',
            });
            console.log('[INICIO] mensaje WS tras decrypt', mensaje);

            this.ngZone.run(async () => {
              const esDelChatActual =
                this.chatActual && mensaje.chatId === this.chatActual.id;
              console.log('[INICIO] routing mensaje', {
                chatActualId: this.chatActual?.id,
                mensajeChatId: mensaje.chatId,
                esDelChatActual,
                usuarioActualId: this.usuarioActualId,
                emisorId: mensaje.emisorId,
                receptorId: mensaje.receptorId,
              });

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

                this.syncActiveHistoryStateMessages();

                this.scrollAlFinal();

                // marcar leído si es para mí
                if (
                  mensaje.receptorId === this.usuarioActualId &&
                  !mensaje.leido &&
                  mensaje.id != null
                ) {
                  console.log('[INICIO] marcar leido inmediato (chat abierto)', {
                    mensajeId: mensaje.id,
                  });
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
                  this.stampChatLastMessageFieldsFromMessage(chat, mensaje);
                  void this.syncChatItemLastPreviewMedia(
                    chat,
                    mensaje,
                    'ws-individual-open-chat'
                  );
                }
                this.seedIncomingReactionsFromMessages([mensaje]);
              } else {
                if (mensaje.receptorId === this.usuarioActualId) {
                  const item = this.chats.find((c) => c.id === mensaje.chatId);
                  if (item) {
                    item.unreadCount = (item.unreadCount || 0) + 1;
                    console.log('[INICIO] unreadCount++ chat existente', {
                      chatId: mensaje.chatId,
                      nuevoUnread: item.unreadCount,
                      mensajeId: mensaje.id,
                    });
                    const { preview, fecha, lastId } = computePreviewPatch(
                      mensaje,
                      item,
                      this.usuarioActualId
                    );
                    item.ultimaMensaje = preview;
                    item.ultimaFecha = fecha;
                    item.lastPreviewId = lastId;
                    this.stampChatLastMessageFieldsFromMessage(item, mensaje);
                    void this.syncChatItemLastPreviewMedia(
                      item,
                      mensaje,
                      'ws-individual-list-existing'
                    );
                  } else {
                    // Mensaje entrante para mi en otro chat (posible chat nuevo)
                    if (mensaje.receptorId === this.usuarioActualId) {
                      let item = this.chats.find(
                        (c) => c.id === mensaje.chatId
                      );

                      if (!item) {
                        // Chat no existe aun: crear entrada minima
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
                          ultimaMensajeId: null,
                          ultimaMensajeTipo: null,
                          ultimaMensajeEmisorId: null,
                          ultimaMensajeRaw: null,
                          ultimaMensajeImageUrl: null,
                          ultimaMensajeImageMime: null,
                          ultimaMensajeImageNombre: null,
                          ultimaMensajeAudioUrl: null,
                          ultimaMensajeAudioMime: null,
                          ultimaMensajeAudioDuracionMs: null,
                          __ultimaMensajeRaw: '',
                          __ultimaTipo: null,
                          __ultimaEsAudio: false,
                          __ultimaAudioSeg: undefined,
                          __ultimaAudioDurMs: null,
                          __ultimaLabel: undefined,
                          __ultimaEsImagen: false,
                          __ultimaImagenUrl: '',
                          __ultimaImagenPayloadKey: '',
                          __ultimaImagenDecryptOk: false,
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

                      // Actualiza preview y contador de no leidos
                      item.unreadCount = (item.unreadCount || 0) + 1;
                      console.log('[INICIO] unreadCount++ chat creado en caliente', {
                        chatId: item.id,
                        nuevoUnread: item.unreadCount,
                        mensajeId: mensaje.id,
                      });

                      const { preview, fecha, lastId } = computePreviewPatch(
                        mensaje,
                        item,
                        this.usuarioActualId
                      );
                      item.ultimaMensaje = preview;
                      item.ultimaFecha = fecha;
                      item.lastPreviewId = lastId;
                      this.stampChatLastMessageFieldsFromMessage(item, mensaje);
                      void this.syncChatItemLastPreviewMedia(
                        item,
                        mensaje,
                        'ws-individual-list-created'
                      );

                      this.cdr.markForCheck();
                    }
                  }
                }
                this.seedIncomingReactionsFromMessages([mensaje]);
              }
            });
          }
        );

        this.wsService.suscribirseAReacciones(
          this.usuarioActualId,
          (payload) => {
            this.ngZone.run(() =>
              this.applyIncomingReactionEvent(payload, 'ws-reaction-topic')
            );
          }
        );

        // Leidos
        this.wsService.suscribirseALeidos(this.usuarioActualId, (mensajeId) => {
          console.log('[INICIO] ack leido recibido', { mensajeId });
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
      next: (chats: ChatListItemDTO[]) => {
        const dedupedChats = this.dedupeChatListItemsById(chats || []);
        this.chats = dedupedChats.map((chat) => {
          const esGrupo = !chat.receptor;
          const groupId = Number(chat?.id);
          const seedIds = this.groupRecipientSeedByChatId.get(groupId) || [];
          const normalizedGroupUsers =
            Array.isArray(chat?.usuarios) && chat.usuarios.length > 0
              ? chat.usuarios
              : Array.isArray(chat?.miembros) && chat.miembros.length > 0
              ? chat.miembros
              : seedIds.map((id) => ({ id }));
          const receptorNombre = String(chat?.receptor?.nombre || '').trim();
          const receptorApellido = String(chat?.receptor?.apellido || '').trim();
          const nombre = esGrupo
            ? chat.nombreGrupo
            : `${receptorNombre} ${receptorApellido}`.trim() || 'Usuario';

          const foto = avatarOrDefault(
            esGrupo ? chat.fotoGrupo || chat.foto : chat.receptor?.foto
          );
          const explicitLastTipo = this.normalizeLastMessageTipo(
            chat?.ultimaMensajeTipo
          );
          const rawFromApi = String(chat?.ultimaMensajeRaw || '').trim();
          const inferredLastTipo = this.inferLastMessageTipoFromRaw(rawFromApi);
          const lastTipo =
            explicitLastTipo && explicitLastTipo !== 'TEXT'
              ? explicitLastTipo
              : inferredLastTipo || explicitLastTipo;
          const parsedAudio = parseAudioPreviewText(chat?.ultimaMensaje || '');
          const explicitAudioDurMs = Number(chat?.ultimaMensajeAudioDuracionMs);
          const explicitAudioSeconds =
            Number.isFinite(explicitAudioDurMs) && explicitAudioDurMs > 0
              ? Math.floor(explicitAudioDurMs / 1000)
              : undefined;
          const audioByType = lastTipo === 'AUDIO';
          const audioByFields =
            !!String(chat?.ultimaMensajeAudioUrl || '').trim() ||
            (Number.isFinite(explicitAudioDurMs) && explicitAudioDurMs > 0);
          const isAudio = audioByType || audioByFields || parsedAudio.isAudio;
          const seconds = explicitAudioSeconds ?? parsedAudio.seconds;
          const senderLabelFromId = this.getAudioPreviewLabelFromSender(chat);
          const label = senderLabelFromId || parsedAudio.label;
          const receptorId = chat.receptor?.id ?? null;
          const rawPreview = String(chat?.ultimaMensaje || '').trim();
          const normalizedPreview = this.normalizeOwnPreviewPrefix(
            rawPreview || 'Sin mensajes aún',
            chat
          );

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
            usuarios: esGrupo ? normalizedGroupUsers : chat?.usuarios,
            esGrupo,
            nombre,
            foto,
            estado: 'Desconectado',
            ultimaMensaje: normalizedPreview,
            ultimaFecha: chat.ultimaFecha || null,
            lastPreviewId: chat.ultimaMensajeId ?? null,
            unreadCount: chat.unreadCount ?? 0,
            ultimaMensajeId: chat.ultimaMensajeId ?? null,
            ultimaMensajeTipo: lastTipo || null,
            ultimaMensajeEmisorId:
              Number.isFinite(Number(chat?.ultimaMensajeEmisorId)) &&
              Number(chat?.ultimaMensajeEmisorId) > 0
                ? Number(chat?.ultimaMensajeEmisorId)
                : null,
            ultimaMensajeRaw: String(chat?.ultimaMensajeRaw || '').trim() || null,
            ultimaMensajeImageUrl:
              String(chat?.ultimaMensajeImageUrl || '').trim() || null,
            ultimaMensajeImageMime:
              String(chat?.ultimaMensajeImageMime || '').trim() || null,
            ultimaMensajeImageNombre:
              String(chat?.ultimaMensajeImageNombre || '').trim() || null,
            ultimaMensajeAudioUrl:
              String(chat?.ultimaMensajeAudioUrl || '').trim() || null,
            ultimaMensajeAudioMime:
              String(chat?.ultimaMensajeAudioMime || '').trim() || null,
            ultimaMensajeAudioDuracionMs:
              Number.isFinite(explicitAudioDurMs) && explicitAudioDurMs > 0
                ? Math.round(explicitAudioDurMs)
                : null,
            __ultimaEsAudio: isAudio,
            __ultimaAudioSeg: seconds,
            __ultimaAudioDurMs:
              Number.isFinite(explicitAudioDurMs) && explicitAudioDurMs > 0
                ? Math.round(explicitAudioDurMs)
                : null,
            __ultimaLabel: label,
            __ultimaTipo: lastTipo || null,
            __ultimaMensajeRaw: String(chat?.ultimaMensajeRaw || '').trim() || '',
            __ultimaEsImagen: false,
            __ultimaImagenUrl: '',
            __ultimaImagenPayloadKey: '',
            __ultimaImagenDecryptOk: false,
          };
        });

        for (const chat of this.chats) {
          void this.syncChatItemLastPreviewMedia(chat, null, 'chat-list-initial');
        }

        // Ajuste defensivo: recalcula no leidos reales en chats individuales
        // por si el backend envia un contador agregado incorrecto.
        this.recalcularNoLeidosDesdeHistorial();

        // Suscribirse a TODOS los grupos (una vez por grupo)
        this.chats
          .filter((c) => c.esGrupo)
          .forEach((g) => {
            this.wsService.suscribirseAChatGrupal(g.id, async (mensajeRaw: any) => {
              if (this.isMessageReactionEvent(mensajeRaw)) {
                this.ngZone.run(() =>
                  this.applyIncomingReactionEvent(
                    mensajeRaw,
                    'ws-chat-group-topic'
                  )
                );
                return;
              }
              const mensaje = mensajeRaw as MensajeDTO;
              if (this.isSystemMessage(mensaje)) {
                const parsedSystem = {
                  ...mensaje,
                  tipo: mensaje?.tipo || 'SYSTEM',
                  contenido: String(mensaje?.contenido ?? '').trim(),
                };
                this.ngZone.run(() => this.handleMensajeGrupal(parsedSystem));
                return;
              }

              const decryptedContenido = await this.decryptContenido(
                mensaje?.contenido,
                mensaje?.emisorId,
                mensaje?.receptorId,
                {
                  chatId: Number(mensaje?.chatId),
                  mensajeId: Number(mensaje?.id),
                  source: 'ws-group',
                }
              );
              const parsed = { ...mensaje, contenido: decryptedContenido };
              await this.hydrateIncomingAudioMessage(parsed, {
                chatId: Number(parsed?.chatId),
                mensajeId: Number(parsed?.id),
                source: 'ws-group-audio',
              });
              await this.hydrateIncomingImageMessage(parsed, {
                chatId: Number(parsed?.chatId),
                mensajeId: Number(parsed?.id),
                source: 'ws-group-image',
              });
              this.ngZone.run(() => {
                this.handleMensajeGrupal(parsed);
                this.seedIncomingReactionsFromMessages([parsed]);
              });
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

        // Descifrar los previews de forma asincrona tras la carga inicial
        for (let chat of this.chats) {
          const rawPreviewSource = chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw;
          if (!rawPreviewSource) continue;
          let payloadPreview: unknown = rawPreviewSource;

          const fallbackPreviewText = String(chat?.ultimaMensaje || '').trim();
          const prf = (fallbackPreviewText.match(/^([^:]+:\s*)/) || [])[1] || '';

          const payloadPreviewText =
            typeof payloadPreview === 'string'
              ? payloadPreview.trim()
              : '';
          const looksLikeE2EString =
            !!payloadPreviewText &&
            payloadPreviewText.includes('E2E') &&
            (payloadPreviewText.startsWith('{') ||
              payloadPreviewText.startsWith('"{') ||
              payloadPreviewText.includes('\\"type\\"'));
          const shouldDecryptObject =
            payloadPreview && typeof payloadPreview === 'object';
          if (!shouldDecryptObject && !looksLikeE2EString) continue;

          this.decryptPreviewString(payloadPreview, {
            chatId: Number(chat?.id),
            mensajeId: Number(chat?.ultimaMensajeId ?? chat?.lastPreviewId),
            source: 'chat-preview',
          }).then((decrypted: string) => {
            const trunc =
              decrypted.length > 60 ? decrypted.substring(0, 59) + '⬦' : decrypted;
            const withPrefix = prf ? `${prf}${trunc}` : trunc;
            chat.ultimaMensaje = this.normalizeOwnPreviewPrefix(withPrefix, chat);
            void this.syncChatItemLastPreviewMedia(
              chat,
              null,
              'chat-list-preview-after-decrypt'
            );
            this.cdr.markForCheck();
          });
        }
      },
      error: (err) => console.error('❌ Error chats:', err),
    });
  }

  private parseChatListRecencyId(item: ChatListItemDTO | null | undefined): number {
    const id = Number(item?.ultimaMensajeId);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private parseChatListRecencyDate(item: ChatListItemDTO | null | undefined): number {
    const ts = Date.parse(String(item?.ultimaFecha || ''));
    return Number.isFinite(ts) ? ts : 0;
  }

  private isIncomingChatItemNewer(
    incoming: ChatListItemDTO,
    existing: ChatListItemDTO
  ): boolean {
    const incomingMsgId = this.parseChatListRecencyId(incoming);
    const existingMsgId = this.parseChatListRecencyId(existing);
    if (incomingMsgId !== existingMsgId) return incomingMsgId > existingMsgId;

    const incomingTs = this.parseChatListRecencyDate(incoming);
    const existingTs = this.parseChatListRecencyDate(existing);
    if (incomingTs !== existingTs) return incomingTs > existingTs;

    return false;
  }

  private firstNonEmptyString(...values: unknown[]): string | null {
    for (const value of values) {
      const t = String(value ?? '').trim();
      if (t) return t;
    }
    return null;
  }

  private mergeChatListItemForDisplay(
    preferred: ChatListItemDTO,
    fallback: ChatListItemDTO
  ): ChatListItemDTO {
    return {
      ...fallback,
      ...preferred,
      receptor: preferred.receptor ?? fallback.receptor,
      usuarios:
        Array.isArray(preferred.usuarios) && preferred.usuarios.length > 0
          ? preferred.usuarios
          : fallback.usuarios,
      miembros:
        Array.isArray(preferred.miembros) && preferred.miembros.length > 0
          ? preferred.miembros
          : fallback.miembros,
      ultimaMensaje: this.firstNonEmptyString(
        preferred.ultimaMensaje,
        fallback.ultimaMensaje
      ),
      ultimaMensajeRaw: this.firstNonEmptyString(
        preferred.ultimaMensajeRaw,
        fallback.ultimaMensajeRaw
      ),
      ultimaMensajeImageUrl: this.firstNonEmptyString(
        preferred.ultimaMensajeImageUrl,
        fallback.ultimaMensajeImageUrl
      ),
      ultimaMensajeImageMime: this.firstNonEmptyString(
        preferred.ultimaMensajeImageMime,
        fallback.ultimaMensajeImageMime
      ),
      ultimaMensajeImageNombre: this.firstNonEmptyString(
        preferred.ultimaMensajeImageNombre,
        fallback.ultimaMensajeImageNombre
      ),
      ultimaMensajeAudioUrl: this.firstNonEmptyString(
        preferred.ultimaMensajeAudioUrl,
        fallback.ultimaMensajeAudioUrl
      ),
      ultimaMensajeAudioMime: this.firstNonEmptyString(
        preferred.ultimaMensajeAudioMime,
        fallback.ultimaMensajeAudioMime
      ),
      ultimaMensajeAudioDuracionMs:
        Number.isFinite(Number(preferred.ultimaMensajeAudioDuracionMs)) &&
        Number(preferred.ultimaMensajeAudioDuracionMs) > 0
          ? Number(preferred.ultimaMensajeAudioDuracionMs)
          : Number.isFinite(Number(fallback.ultimaMensajeAudioDuracionMs)) &&
            Number(fallback.ultimaMensajeAudioDuracionMs) > 0
          ? Number(fallback.ultimaMensajeAudioDuracionMs)
          : null,
      ultimaMensajeTipo:
        this.toLastMessageTipoDTO(preferred.ultimaMensajeTipo) ||
        this.toLastMessageTipoDTO(fallback.ultimaMensajeTipo) ||
        null,
      ultimaMensajeEmisorId:
        Number.isFinite(Number(preferred.ultimaMensajeEmisorId)) &&
        Number(preferred.ultimaMensajeEmisorId) > 0
          ? Number(preferred.ultimaMensajeEmisorId)
          : Number.isFinite(Number(fallback.ultimaMensajeEmisorId)) &&
            Number(fallback.ultimaMensajeEmisorId) > 0
          ? Number(fallback.ultimaMensajeEmisorId)
          : null,
      ultimaMensajeId:
        this.parseChatListRecencyId(preferred) ||
        this.parseChatListRecencyId(fallback) ||
        null,
      ultimaFecha: this.firstNonEmptyString(
        preferred.ultimaFecha,
        fallback.ultimaFecha
      ),
    };
  }

  private dedupeChatListItemsById(items: ChatListItemDTO[]): ChatListItemDTO[] {
    const map = new Map<number, ChatListItemDTO>();
    for (const item of items || []) {
      const id = Number(item?.id);
      if (!Number.isFinite(id) || id <= 0) continue;

      const existing = map.get(id);
      if (!existing) {
        map.set(id, item);
        continue;
      }

      const incomingNewer = this.isIncomingChatItemNewer(item, existing);
      const preferred = incomingNewer ? item : existing;
      const fallback = incomingNewer ? existing : item;
      map.set(id, this.mergeChatListItemForDisplay(preferred, fallback));
    }
    return Array.from(map.values());
  }

  private bindBanWsListener(): void {
    if (this.banWsBound) return;
    this.banWsBound = true;

    console.log('[INICIO] binding ban WS listener', {
      usuarioActualId: this.usuarioActualId,
    });

    this.wsService.suscribirseABaneos(this.usuarioActualId, (payload) => {
      console.warn('[INICIO] baneo WS recibido', payload);

      Swal.fire({
        title: 'Cuenta Inhabilitada',
        text: payload?.motivo || 'Un administrador ha inhabilitado tu cuenta.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        this.sessionService.logout({
          clearE2EKeys: false,
          clearAuditKeys: false,
          broadcast: true,
          reason: 'banned',
        });
      });
    });
  }

  private bindE2EWsErrorListener(): void {
    if (this.e2eWsErrorsBound) return;
    this.e2eWsErrorsBound = true;

    this.wsService.suscribirseAErroresUsuario((rawPayload) => {
      this.ngZone.run(() => {
        this.handleE2EWsSemanticError(rawPayload);
      });
    });
  }

  private normalizePublicKeyBase64(raw?: string | null): string {
    return String(raw || '').replace(/\s+/g, '');
  }

  private async fingerprint12(rawPublicKey?: string | null): Promise<string> {
    const normalized = this.normalizePublicKeyBase64(rawPublicKey);
    if (!normalized) return '';
    try {
      const data = new TextEncoder().encode(normalized);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hex.slice(0, 12);
    } catch {
      return '';
    }
  }

  private async getServerE2EState(
    userId: number
  ): Promise<{ hasServerKey: boolean; serverFingerprint: string }> {
    if (!Number.isFinite(userId) || userId <= 0) {
      return { hasServerKey: false, serverFingerprint: '' };
    }

    try {
      const state = await firstValueFrom(this.authService.getE2EState(userId));
      const stateFp = String((state as any)?.publicKeyFingerprint || '').trim();
      const hasState =
        typeof (state as any)?.hasPublicKey === 'boolean'
          ? !!(state as any).hasPublicKey
          : !!stateFp;
      if (hasState) {
        return { hasServerKey: true, serverFingerprint: stateFp };
      }
    } catch {
      // compat fallback
    }

    try {
      const dto = await firstValueFrom(this.authService.getById(userId));
      const serverPublicKey = this.normalizePublicKeyBase64((dto as any)?.publicKey);
      const hasServerKey =
        typeof (dto as any)?.hasPublicKey === 'boolean'
          ? !!(dto as any).hasPublicKey
          : !!serverPublicKey;
      const serverFingerprint = await this.fingerprint12(serverPublicKey);
      return { hasServerKey, serverFingerprint };
    } catch {
      const fallbackPublicKey = this.normalizePublicKeyBase64(
        (this.perfilUsuario as any)?.publicKey
      );
      const fallbackHas =
        typeof (this.perfilUsuario as any)?.hasPublicKey === 'boolean'
          ? !!(this.perfilUsuario as any).hasPublicKey
          : !!fallbackPublicKey;
      const fallbackFingerprint = await this.fingerprint12(fallbackPublicKey);
      return { hasServerKey: fallbackHas, serverFingerprint: fallbackFingerprint };
    }
  }

  private async ensureLocalE2EKeysAndSyncPublicKey(
    userId: number
  ): Promise<void> {
    if (!Number.isFinite(userId) || userId <= 0) return;
    try {
      let pubBase64 = this.normalizePublicKeyBase64(
        localStorage.getItem(`publicKey_${userId}`)
      );
      let privBase64 = String(
        localStorage.getItem(`privateKey_${userId}`) || ''
      ).trim();
      let generated = false;

      const serverState = await this.getServerE2EState(userId);
      const localFingerprint = await this.fingerprint12(pubBase64);
      if (serverState.hasServerKey) {
        if (!pubBase64 || !privBase64) {
          throw new Error('E2E_LOCAL_PRIVATE_KEY_MISSING');
        }
        if (
          serverState.serverFingerprint &&
          localFingerprint &&
          localFingerprint !== serverState.serverFingerprint
        ) {
          throw new Error('E2E_PUBLIC_KEY_MISMATCH');
        }

        this.e2eSessionReady = true;
        if (this.perfilUsuario) this.perfilUsuario.hasPublicKey = true;
        return;
      }

      if (!pubBase64 || !privBase64) {
        const keys = await this.cryptoService.generateKeyPair();
        privBase64 = await this.cryptoService.exportPrivateKey(keys.privateKey);
        pubBase64 = this.normalizePublicKeyBase64(
          await this.cryptoService.exportPublicKey(keys.publicKey)
        );
        localStorage.setItem(`privateKey_${userId}`, privBase64);
        localStorage.setItem(`publicKey_${userId}`, pubBase64);
        generated = true;
      }

      if (!pubBase64) return;

      await firstValueFrom(this.authService.updatePublicKey(userId, pubBase64));
      console.log('[E2E][key-sync-ok]', {
        userId: Number(userId),
        generated,
      });
      this.e2eSessionReady = true;
      if (this.perfilUsuario) this.perfilUsuario.hasPublicKey = true;
    } catch (err: any) {
      const backendCode = String(err?.error?.code || '');
      const reason =
        Number(err?.status) === 409 || backendCode === 'E2E_REKEY_CONFLICT'
          ? 'E2E_REKEY_CONFLICT'
          : String(err?.message || '');
      console.error('[E2E][key-init-failed]', {
        userId: Number(userId),
        message: reason || String(err),
      });
      this.e2eSessionReady = false;
      if (this.perfilUsuario) this.perfilUsuario.hasPublicKey = false;
      const text =
        reason === 'E2E_LOCAL_PRIVATE_KEY_MISSING'
          ? 'Este navegador no conserva tu clave privada E2E para esta cuenta. Se bloquea la sesión para no sobrescribir tu identidad criptográfica.'
          : reason === 'E2E_PUBLIC_KEY_MISMATCH'
          ? 'La clave pública local no coincide con la registrada en el servidor. Se bloquea la sesión para evitar rotación accidental de claves.'
          : reason === 'E2E_REKEY_CONFLICT'
          ? 'El servidor detecto conflicto de identidad E2E. Debes usar el flujo de rekey para rotar claves de forma controlada.'
          : 'No se pudo sincronizar tu clave pública. Se cerrará la sesión para evitar mensajes cifrados no descifrables.';
      Swal.fire({
        title: 'Error E2E',
        text,
        icon: 'error',
        confirmButtonColor: '#ef4444',
      }).then(() => {
        this.sessionService.logout({
          clearE2EKeys: false,
          clearAuditKeys: false,
          broadcast: true,
          reason:
            reason === 'E2E_LOCAL_PRIVATE_KEY_MISSING'
              ? 'e2e-missing-local-private-key-runtime'
              : reason === 'E2E_PUBLIC_KEY_MISMATCH'
              ? 'e2e-public-key-mismatch-runtime'
              : reason === 'E2E_REKEY_CONFLICT'
              ? 'e2e-rekey-required-runtime'
              : 'key-sync-failed-runtime',
        });
      });
    }
  }

  private normalizeWsSemanticErrorPayload(rawPayload: any): WsSemanticErrorPayload {
    if (!rawPayload || typeof rawPayload !== 'object') return {};
    return {
      code: String(rawPayload?.code || '').trim(),
      message: String(rawPayload?.message || '').trim(),
      traceId: String(rawPayload?.traceId || '').trim(),
      chatId: Number(rawPayload?.chatId),
      senderId: Number(rawPayload?.senderId),
      ts: String(rawPayload?.ts || '').trim(),
    };
  }

  private handleE2EWsSemanticError(rawPayload: any): void {
    const payload = this.normalizeWsSemanticErrorPayload(rawPayload);
    const code = String(payload.code || '').trim().toUpperCase();
    if (!code) return;
    const traceSuffix = payload.traceId ? ` (traceId: ${payload.traceId})` : '';
    const backendMsg = String(payload.message || '').trim();

    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const senderId = Number(payload.senderId);
    if (Number.isFinite(senderId) && senderId > 0 && Number(senderId) !== Number(myId)) {
      return;
    }

    if (code === 'E2E_SENDER_KEY_MISSING') {
      this.e2eSessionReady = false;
      void this.handleE2ESenderKeyMissingError(payload);
      return;
    }

    if (code === 'E2E_RECIPIENT_KEYS_MISMATCH') {
      void this.handleE2ERecipientKeysMismatchError(payload);
      return;
    }

    if (
      code === 'E2E_GROUP_PAYLOAD_INVALID' ||
      code === 'E2E_IMAGE_PAYLOAD_INVALID' ||
      code === 'E2E_GROUP_IMAGE_PAYLOAD_INVALID'
    ) {
      this.showToast(
        `${backendMsg || `Payload inválido (${code})`}${traceSuffix}`,
        'danger',
        'E2E'
      );
      console.warn('[E2E][ws-error-payload-invalid]', payload);
      if (Number.isFinite(Number(payload.chatId)) && Number(payload.chatId) > 0) {
        this.scheduleChatsRefresh(180);
      }
      return;
    }

    if (code.includes('IMAGE') && code.startsWith('E2E_')) {
      this.showToast(
        `${backendMsg || `Error E2E de imagen (${code})`}${traceSuffix}`,
        'danger',
        'Imagen'
      );
      console.warn('[E2E][ws-error-image]', payload);
      if (Number.isFinite(Number(payload.chatId)) && Number(payload.chatId) > 0) {
        this.scheduleChatsRefresh(180);
      }
      return;
    }

    if (backendMsg) {
      this.showToast(`${backendMsg}${traceSuffix}`, 'warning', 'E2E');
      return;
    }

    console.warn('[E2E][ws-error-unknown-code]', payload);
  }

  private async handleE2ESenderKeyMissingError(payload: WsSemanticErrorPayload): Promise<void> {
    const chatId = Number(payload.chatId);
    const synced = await this.forceSyncMyE2EPublicKeyForRetry();
    if (!synced) {
      this.showToast(
        'No se pudo sincronizar tu clave pública E2E. Vuelve a iniciar sesión.',
        'danger',
        'E2E'
      );
      return;
    }

    if (Number.isFinite(chatId) && chatId > 0) {
      await this.retryPendingGroupTextSend(chatId, 'E2E_SENDER_KEY_MISSING');
    } else {
      this.showToast(
        'Clave E2E sincronizada. Reenvía el mensaje grupal.',
        'info',
        'E2E'
      );
    }
  }

  private async handleE2ERecipientKeysMismatchError(payload: WsSemanticErrorPayload): Promise<void> {
    const chatId = Number(payload.chatId);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.showToast(
        'Error E2E de receptores. Reabre el grupo y reintenta.',
        'warning',
        'E2E'
      );
      return;
    }

    await this.forceRefreshGroupDetailForE2E(chatId);
    const pending = this.getPendingGroupTextSend(chatId);
    if (!pending) {
      const traceSuffix = payload.traceId ? ` (traceId: ${payload.traceId})` : '';
      const backendMsg = String(payload.message || '').trim();
      this.showToast(
        `${backendMsg || 'Error E2E de receptores. Reintenta el envío.'}${traceSuffix}`,
        'warning',
        'E2E'
      );
      return;
    }
    await this.retryPendingGroupTextSend(chatId, 'E2E_RECIPIENT_KEYS_MISMATCH');
  }

  private async forceSyncMyE2EPublicKeyForRetry(): Promise<boolean> {
    try {
      const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
      let pubBase64 = this.normalizePublicKeyBase64(
        localStorage.getItem(`publicKey_${myId}`)
      );
      let privBase64 = String(
        localStorage.getItem(`privateKey_${myId}`) || ''
      ).trim();
      const localFingerprint = await this.fingerprint12(pubBase64);

      const serverState = await this.getServerE2EState(myId);
      if (serverState.hasServerKey) {
        if (!pubBase64 || !privBase64) {
          console.warn('[E2E][key-sync-retry-blocked-missing-private]', {
            userId: Number(myId),
          });
          return false;
        }
        if (
          serverState.serverFingerprint &&
          localFingerprint &&
          localFingerprint !== serverState.serverFingerprint
        ) {
          console.warn('[E2E][key-sync-retry-blocked-mismatch]', {
            userId: Number(myId),
          });
          return false;
        }
        this.e2eSessionReady = true;
        if (this.perfilUsuario) this.perfilUsuario.hasPublicKey = true;
        return true;
      }

      if (!pubBase64 || !privBase64) {
        const keys = await this.cryptoService.generateKeyPair();
        privBase64 = await this.cryptoService.exportPrivateKey(keys.privateKey);
        pubBase64 = this.normalizePublicKeyBase64(
          await this.cryptoService.exportPublicKey(keys.publicKey)
        );
        localStorage.setItem(`privateKey_${myId}`, privBase64);
        localStorage.setItem(`publicKey_${myId}`, pubBase64);
      }

      if (!pubBase64) return false;
      await firstValueFrom(this.authService.updatePublicKey(myId, pubBase64));
      this.e2eSessionReady = true;
      if (this.perfilUsuario) this.perfilUsuario.hasPublicKey = true;
      console.log('[E2E][key-sync-retry-ok]', { userId: Number(myId) });
      return true;
    } catch (err: any) {
      this.e2eSessionReady = false;
      if (this.perfilUsuario) this.perfilUsuario.hasPublicKey = false;
      const code = String(err?.error?.code || '');
      console.warn('[E2E][key-sync-retry-failed]', {
        status: err?.status,
        code,
        message: err?.message || err?.error?.mensaje || String(err),
      });
      return false;
    }
  }

  private rememberPendingGroupTextSend(context: PendingGroupTextSendContext): void {
    this.pendingGroupTextSendByChatId.set(Number(context.chatId), context);
  }

  private getPendingGroupTextSend(chatId: number): PendingGroupTextSendContext | null {
    const key = Number(chatId);
    const ctx = this.pendingGroupTextSendByChatId.get(key);
    if (!ctx) return null;
    // Evita reintentar mensajes viejos si el error llega fuera de ventana esperada.
    if (Date.now() - Number(ctx.createdAtMs) > 45000) {
      this.pendingGroupTextSendByChatId.delete(key);
      return null;
    }
    return ctx;
  }

  private async forceRefreshGroupDetailForE2E(chatId: number): Promise<void> {
    try {
      const detail = await firstValueFrom(this.chatService.obtenerDetalleGrupo(chatId));
      const detailMembers = Array.isArray((detail as any)?.miembros)
        ? (detail as any).miembros
        : Array.isArray((detail as any)?.usuarios)
        ? (detail as any).usuarios
        : [];

      if (!Array.isArray(detailMembers) || detailMembers.length === 0) return;

      const normalizedMembers = detailMembers.map((m: any) => ({
        id: Number(m?.id),
        nombre: m?.nombre || '',
        apellido: m?.apellido || '',
        foto: m?.foto || null,
      }));

      const chatItem = (this.chats || []).find(
        (c: any) => Number(c?.id) === Number(chatId) && !!c?.esGrupo
      );
      if (chatItem) chatItem.usuarios = normalizedMembers;
      if (
        this.chatActual &&
        Number(this.chatActual?.id) === Number(chatId) &&
        !!this.chatActual?.esGrupo
      ) {
        this.chatActual.usuarios = normalizedMembers;
      }
    } catch (err) {
      console.warn('[E2E][group-detail-refresh-failed]', {
        chatId: Number(chatId),
        message: (err as any)?.message || String(err),
      });
    }
  }

  private async retryPendingGroupTextSend(
    chatId: number,
    triggerCode: string
  ): Promise<void> {
    const key = Number(chatId);
    if (this.retryingGroupTextSendByChatId.has(key)) return;

    const pending = this.getPendingGroupTextSend(key);
    if (!pending) {
      this.showToast(
        'No hay mensaje pendiente para reintentar en este grupo.',
        'warning',
        'E2E'
      );
      return;
    }

    if (pending.retryCount >= 1) {
      this.showToast(
        'El mensaje ya se reintentó una vez. Revisa claves del grupo y reenvía manualmente.',
        'warning',
        'E2E'
      );
      return;
    }

    const chatItem =
      (this.chats || []).find(
        (c: any) => Number(c?.id) === key && !!c?.esGrupo
      ) ||
      (this.chatActual &&
      Number(this.chatActual?.id) === key &&
      !!this.chatActual?.esGrupo
        ? this.chatActual
        : null);

    if (!chatItem) {
      this.showToast(
        'No se encontró el chat grupal para reintentar.',
        'danger',
        'E2E'
      );
      return;
    }

    this.retryingGroupTextSendByChatId.add(key);
    try {
      const encryptedGroup = await this.buildOutgoingE2EContentForGroup(
        chatItem,
        pending.plainText
      );
      const strictValidation = this.validateOutgoingGroupPayloadStrict(
        encryptedGroup.content,
        encryptedGroup.expectedRecipientIds
      );
      if (!strictValidation.ok) {
        this.showToast(
          `No se pudo reintentar: ${strictValidation.reason || strictValidation.code || 'payload inválido'}`,
          'danger',
          'E2E'
        );
        return;
      }

      const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
      const messagePayload: any = {
        contenido: encryptedGroup.content,
        emisorId: myId,
        receptorId: key,
        chatId: key,
        activo: true,
        tipo: 'TEXT',
        reenviado: pending.reenviado,
        mensajeOriginalId: pending.mensajeOriginalId,
        replyToMessageId: pending.replyToMessageId,
        replySnippet: pending.replySnippet,
        replyAuthorName: pending.replyAuthorName,
      };

      await this.logGroupWsPayloadBeforeSend(
        `retry-${pending.source}-${triggerCode}`.toLowerCase(),
        messagePayload,
        strictValidation.forReceptoresKeys
      );
      pending.retryCount += 1;
      pending.createdAtMs = Date.now();
      this.rememberPendingGroupTextSend(pending);
      this.wsService.enviarMensajeGrupal(messagePayload);
      this.showToast('Reintentando envio cifrado del mensaje grupal...', 'info', 'E2E');
    } catch (err) {
      console.warn('[E2E][group-retry-failed]', {
        chatId: key,
        triggerCode,
        message: (err as any)?.message || String(err),
      });
      this.showToast(
        'Fallo al reintentar el envío cifrado grupal.',
        'danger',
        'E2E'
      );
    } finally {
      this.retryingGroupTextSendByChatId.delete(key);
    }
  }

  private recalcularNoLeidosDesdeHistorial(): void {
    const individuales = (this.chats || []).filter(
      (c) => !c?.esGrupo && Number(c?.id) > 0
    );

    for (const chat of individuales) {
      const chatId = Number(chat.id);
      this.chatService.listarMensajesPorChat(chatId).subscribe({
        next: (mensajes: any[]) => {
          const unread = (mensajes || []).filter(
            (m: any) =>
              Number(m?.receptorId) === Number(this.usuarioActualId) &&
              m?.leido !== true &&
              m?.activo !== false
          ).length;

          const chatItem = this.chats.find((c) => Number(c.id) === chatId);
          if (chatItem) {
            chatItem.unreadCount = unread;
            console.log('[INICIO] recalculo unreadCount desde historial', {
              chatId,
              unread,
              totalMensajes: (mensajes || []).length,
            });
            this.cdr.markForCheck();
          }
        },
        error: () => {
          // Si falla esta verificacion, conservamos el valor existente.
        },
      });
    }
  }

  /**
   * Carga y muestra los mensajes de un chat específico cuando el usuario hace clic en él.
   * @param chat El chat (individual o grupal) seleccionado en la barra lateral.
   */
  public mostrarMensajes(chat: any): void {
    this.activeMainView = 'chat';
    this.showTopbarProfileMenu = false;
    this.cancelarRespuestaMensaje();
    console.log('[INICIO] abrir chat', {
      chatId: chat?.id,
      esGrupo: !!chat?.esGrupo,
      unreadAntes: chat?.unreadCount,
    });
    this.chatSeleccionadoId = chat.id;
    this.chatActual = chat;
    this.showGroupInfoPanel = false;
    this.showGroupInfoPanelMounted = false;
    this.showMessageSearchPanel = false;
    this.showMessageSearchPanelMounted = false;
    this.highlightedMessageId = null;
    this.openIncomingReactionPickerMessageId = null;
    if (this.highlightedMessageTimer) {
      clearTimeout(this.highlightedMessageTimer);
      this.highlightedMessageTimer = null;
    }

    // Reset de flags de edición y estado UI
    this.resetEdicion(); // Asegura que limpia haSalidoDelGrupo/mensajeNuevo/menu

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

    // Helper: carga inicial paginada (page=0,size=50)
    const loadMessages = () => {
      this.loadInitialMessagesPage(chat, leftSet);
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
              // Si el back confirma que sigues siendo miembro, limpia estado local
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

  private async decryptContenido(
    contenido: unknown,
    emisorId: number,
    receptorId: number,
    debugContext?: E2EDebugContext
  ): Promise<string> {
  return decryptContenidoE2E(
    contenido,
    emisorId,
    receptorId,
    this.usuarioActualId,
    this.cryptoService,
    debugContext
  );
}

private async decryptPreviewString(
  contenido: unknown,
  debugContext?: E2EDebugContext
): Promise<string> {
  return decryptPreviewStringE2E(
    contenido,
    this.usuarioActualId,
    this.cryptoService,
    debugContext || { source: 'chat-preview' }
  );
}

  private parseAudioE2EPayload(contenido: unknown): AudioE2EPayload | null {
    let payload: any = null;
    if (typeof contenido === 'string') {
      const trimmed = contenido.trimStart();
      if (!trimmed.startsWith('{')) return null;
      try {
        payload = JSON.parse(trimmed);
      } catch {
        return null;
      }
    } else if (contenido && typeof contenido === 'object') {
      payload = contenido;
    } else {
      return null;
    }

    const payloadType = String(payload?.type || '').trim().toUpperCase();
    if (payloadType !== 'E2E_AUDIO' && payloadType !== 'E2E_GROUP_AUDIO') {
      return null;
    }

    if (typeof payload?.ivFile !== 'string' || !payload.ivFile.trim()) return null;
    if (typeof payload?.forEmisor !== 'string' || !payload.forEmisor.trim()) return null;
    if (typeof payload?.forAdmin !== 'string' || !payload.forAdmin.trim()) return null;

    if (payloadType === 'E2E_AUDIO') {
      if (typeof payload?.forReceptor !== 'string' || !payload.forReceptor.trim()) {
        return null;
      }
      return {
        type: 'E2E_AUDIO',
        ivFile: payload.ivFile,
        audioUrl: String(payload?.audioUrl || ''),
        audioMime: typeof payload?.audioMime === 'string' ? payload.audioMime : undefined,
        audioDuracionMs: Number.isFinite(Number(payload?.audioDuracionMs))
          ? Number(payload.audioDuracionMs)
          : undefined,
        forEmisor: payload.forEmisor,
        forAdmin: payload.forAdmin,
        forReceptor: payload.forReceptor,
      };
    }

    const forReceptores =
      payload?.forReceptores && typeof payload.forReceptores === 'object'
        ? (payload.forReceptores as Record<string, string>)
        : null;
    if (!forReceptores) return null;

    return {
      type: 'E2E_GROUP_AUDIO',
      ivFile: payload.ivFile,
      audioUrl: String(payload?.audioUrl || ''),
      audioMime: typeof payload?.audioMime === 'string' ? payload.audioMime : undefined,
      audioDuracionMs: Number.isFinite(Number(payload?.audioDuracionMs))
        ? Number(payload.audioDuracionMs)
        : undefined,
      forEmisor: payload.forEmisor,
      forAdmin: payload.forAdmin,
      forReceptores,
    };
  }

  private buildAudioE2ECacheKey(payload: AudioE2EPayload): string {
    return [
      payload.type,
      String(this.usuarioActualId),
      String(payload.ivFile || ''),
      String(payload.audioUrl || ''),
      String(payload.audioDuracionMs ?? ''),
    ].join('|');
  }

  private async resolveAudioEnvelopeForCurrentUser(
    payload: AudioE2EPayload,
    emisorId: number,
    myPrivKey: CryptoKey
  ): Promise<string | null> {
    const isSender = Number(emisorId) === Number(this.usuarioActualId);
    if (isSender && payload.forEmisor) return payload.forEmisor;

    if (payload.type === 'E2E_AUDIO') {
      return payload.forReceptor || null;
    }

    const direct =
      payload.forReceptores?.[String(this.usuarioActualId)];
    if (typeof direct === 'string' && direct.trim()) {
      return direct;
    }

    const candidates = Object.values(payload.forReceptores || {});
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      try {
        await this.cryptoService.decryptRSA(candidate, myPrivKey);
        return candidate;
      } catch {
        // seguimos intentando
      }
    }
    return null;
  }

  private async decryptAudioE2EPayloadToObjectUrl(
    payload: AudioE2EPayload,
    emisorId: number,
    debugContext?: E2EDebugContext
  ): Promise<string | null> {
    const cacheKey = this.buildAudioE2ECacheKey(payload);
    const cached = this.decryptedAudioUrlByCacheKey.get(cacheKey);
    if (cached) return cached;

    const inFlight = this.decryptingAudioByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const decryptPromise = (async (): Promise<string | null> => {
      try {
        const privKeyBase64 = String(
          localStorage.getItem(`privateKey_${this.usuarioActualId}`) || ''
        ).trim();
        if (!privKeyBase64) {
          console.warn('[E2E][audio-decrypt-no-private-key]', {
            chatId: Number(debugContext?.chatId),
            mensajeId: Number(debugContext?.mensajeId),
            source: debugContext?.source || 'unknown',
          });
          return null;
        }

        const myPrivKey = await this.cryptoService.importPrivateKey(privKeyBase64);
        const aesEnvelope = await this.resolveAudioEnvelopeForCurrentUser(
          payload,
          emisorId,
          myPrivKey
        );
        if (!aesEnvelope) {
          console.warn('[E2E][audio-decrypt-no-envelope]', {
            chatId: Number(debugContext?.chatId),
            mensajeId: Number(debugContext?.mensajeId),
            source: debugContext?.source || 'unknown',
            payloadType: payload.type,
          });
          return null;
        }

        const aesRawBase64 = await this.cryptoService.decryptRSA(
          aesEnvelope,
          myPrivKey
        );
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);

        const encryptedUrl = resolveMediaUrl(
          payload.audioUrl,
          environment.backendBaseUrl
        );
        if (!encryptedUrl) return null;

        const response = await fetch(encryptedUrl);
        if (!response.ok) {
          console.warn('[E2E][audio-decrypt-fetch-failed]', {
            status: Number(response.status),
            chatId: Number(debugContext?.chatId),
            mensajeId: Number(debugContext?.mensajeId),
            source: debugContext?.source || 'unknown',
          });
          return null;
        }

        const encryptedBytes = await response.arrayBuffer();
        const decryptedBuffer = await this.cryptoService.decryptAESBinary(
          encryptedBytes,
          payload.ivFile,
          aesKey
        );
        const mime = String(payload.audioMime || 'audio/webm').trim() || 'audio/webm';
        const objectUrl = URL.createObjectURL(
          new Blob([decryptedBuffer], { type: mime })
        );
        this.decryptedAudioUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch (err) {
        console.error('[E2E][audio-decrypt-failed]', {
          chatId: Number(debugContext?.chatId),
          mensajeId: Number(debugContext?.mensajeId),
          source: debugContext?.source || 'unknown',
          error: err,
        });
        return null;
      } finally {
        this.decryptingAudioByCacheKey.delete(cacheKey);
      }
    })();

    this.decryptingAudioByCacheKey.set(cacheKey, decryptPromise);
    return decryptPromise;
  }

  private async hydrateIncomingAudioMessage(
    mensaje: MensajeDTO,
    debugContext?: E2EDebugContext
  ): Promise<void> {
    if (String(mensaje?.tipo || 'TEXT').toUpperCase() !== 'AUDIO') return;

    const payload = this.parseAudioE2EPayload(mensaje?.contenido);
    if (!payload) {
      (mensaje as any).__audioE2EEncrypted = false;
      return;
    }

    (mensaje as any).__audioE2EEncrypted = true;
    if (payload.audioMime && !mensaje.audioMime) {
      mensaje.audioMime = payload.audioMime;
    }
    if (
      Number.isFinite(Number(payload.audioDuracionMs)) &&
      !Number.isFinite(Number(mensaje.audioDuracionMs))
    ) {
      mensaje.audioDuracionMs = Number(payload.audioDuracionMs);
    }
    if (payload.audioUrl) {
      mensaje.audioUrl = payload.audioUrl;
    }

    const decryptedUrl = await this.decryptAudioE2EPayloadToObjectUrl(
      payload,
      Number(mensaje?.emisorId),
      debugContext
    );
    if (decryptedUrl) {
      mensaje.audioDataUrl = decryptedUrl;
      (mensaje as any).__audioE2EDecryptOk = true;
      return;
    }

    mensaje.audioDataUrl = null;
    (mensaje as any).__audioE2EDecryptOk = false;
  }

  private async buildOutgoingE2EAudioForIndividual(
    receptorId: number,
    audioBlob: Blob,
    audioMime: string,
    durMs: number
  ): Promise<BuiltOutgoingAudioE2E> {
    const receptorDTO = await firstValueFrom(this.authService.getById(receptorId));
    const receptorPubKeyBase64 = String(receptorDTO?.publicKey || '').trim();
    const emisorPubKeyBase64 = String(
      localStorage.getItem(`publicKey_${this.usuarioActualId}`) || ''
    ).trim();

    if (!receptorPubKeyBase64 || !emisorPubKeyBase64) {
      throw new Error('E2E_AUDIO_KEYS_MISSING');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const audioRaw = await audioBlob.arrayBuffer();
    const encryptedFile = await this.cryptoService.encryptAESBinary(audioRaw, aesKey);
    const encryptedBlob = new Blob([encryptedFile.ciphertext], {
      type: audioMime || 'audio/webm',
    });

    const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);
    const receptorRsaKey = await this.cryptoService.importPublicKey(
      receptorPubKeyBase64
    );
    const emisorRsaKey = await this.cryptoService.importPublicKey(emisorPubKeyBase64);

    await this.ensureAuditPublicKeyForE2E();
    const adminPubKeyBase64 = this.getStoredAuditPublicKey();
    if (!adminPubKeyBase64) {
      throw new Error('E2E_AUDIO_ADMIN_KEY_MISSING');
    }
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPubKeyBase64);

    const payload: AudioE2EIndividualPayload = {
      type: 'E2E_AUDIO',
      ivFile: encryptedFile.iv,
      audioUrl: '',
      audioMime,
      audioDuracionMs: Number(durMs) || 0,
      forEmisor: await this.cryptoService.encryptRSA(aesKeyRawBase64, emisorRsaKey),
      forAdmin: await this.cryptoService.encryptRSA(aesKeyRawBase64, adminRsaKey),
      forReceptor: await this.cryptoService.encryptRSA(
        aesKeyRawBase64,
        receptorRsaKey
      ),
    };

    return {
      payload,
      encryptedBlob,
      forReceptoresKeys: [],
      expectedRecipientIds: [Number(receptorId)].filter(
        (id) => Number.isFinite(id) && id > 0
      ),
    };
  }

  private async buildOutgoingE2EAudioForGroup(
    chatItem: any,
    audioBlob: Blob,
    audioMime: string,
    durMs: number
  ): Promise<BuiltOutgoingAudioE2E> {
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const emisorPubKeyBase64 = String(
      localStorage.getItem(`publicKey_${myId}`) || ''
    ).trim();
    if (!emisorPubKeyBase64) {
      throw new Error('E2E_AUDIO_SENDER_KEY_MISSING');
    }

    const memberIds = await this.resolveGroupMemberIdsForEncryption(chatItem, myId);
    if (memberIds.length === 0) {
      throw new Error('E2E_AUDIO_GROUP_NO_RECIPIENTS');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const audioRaw = await audioBlob.arrayBuffer();
    const encryptedFile = await this.cryptoService.encryptAESBinary(audioRaw, aesKey);
    const encryptedBlob = new Blob([encryptedFile.ciphertext], {
      type: audioMime || 'audio/webm',
    });
    const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);

    const emisorRsaKey = await this.cryptoService.importPublicKey(emisorPubKeyBase64);
    const forReceptores: Record<string, string> = {};
    await Promise.all(
      memberIds.map(async (uid) => {
        const dto = await firstValueFrom(this.authService.getById(uid));
        const pub = String(dto?.publicKey || '').trim();
        if (!pub) {
          throw new Error(`E2E_AUDIO_GROUP_MEMBER_KEY_MISSING:${uid}`);
        }
        const rsa = await this.cryptoService.importPublicKey(pub);
        forReceptores[String(uid)] = await this.cryptoService.encryptRSA(
          aesKeyRawBase64,
          rsa
        );
      })
    );

    await this.ensureAuditPublicKeyForE2E();
    const adminPubKeyBase64 = this.getStoredAuditPublicKey();
    if (!adminPubKeyBase64) {
      throw new Error('E2E_AUDIO_ADMIN_KEY_MISSING');
    }
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPubKeyBase64);

    const payload: AudioE2EGroupPayload = {
      type: 'E2E_GROUP_AUDIO',
      ivFile: encryptedFile.iv,
      audioUrl: '',
      audioMime,
      audioDuracionMs: Number(durMs) || 0,
      forEmisor: await this.cryptoService.encryptRSA(aesKeyRawBase64, emisorRsaKey),
      forAdmin: await this.cryptoService.encryptRSA(aesKeyRawBase64, adminRsaKey),
      forReceptores,
    };

    return {
      payload,
      encryptedBlob,
      forReceptoresKeys: Object.keys(forReceptores),
      expectedRecipientIds: [...memberIds].sort((a, b) => a - b),
    };
  }

  private parseImageE2EPayload(contenido: unknown): ImageE2EPayload | null {
    let payload: any = null;
    if (typeof contenido === 'string') {
      const trimmed = contenido.trimStart();
      if (!trimmed.startsWith('{')) return null;
      try {
        payload = JSON.parse(trimmed);
      } catch {
        return null;
      }
    } else if (contenido && typeof contenido === 'object') {
      payload = contenido;
    } else {
      return null;
    }

    const payloadType = String(payload?.type || '').trim().toUpperCase();
    if (payloadType !== 'E2E_IMAGE' && payloadType !== 'E2E_GROUP_IMAGE') {
      return null;
    }
    if (typeof payload?.ivFile !== 'string' || !payload.ivFile.trim()) return null;
    if (typeof payload?.forEmisor !== 'string' || !payload.forEmisor.trim()) return null;
    if (typeof payload?.forAdmin !== 'string' || !payload.forAdmin.trim()) return null;

    if (payloadType === 'E2E_IMAGE') {
      if (typeof payload?.forReceptor !== 'string' || !payload.forReceptor.trim()) {
        return null;
      }
      return {
        type: 'E2E_IMAGE',
        ivFile: payload.ivFile,
        imageUrl: String(payload?.imageUrl || ''),
        imageMime: typeof payload?.imageMime === 'string' ? payload.imageMime : undefined,
        imageNombre: typeof payload?.imageNombre === 'string' ? payload.imageNombre : undefined,
        captionIv: typeof payload?.captionIv === 'string' ? payload.captionIv : undefined,
        captionCiphertext:
          typeof payload?.captionCiphertext === 'string'
            ? payload.captionCiphertext
            : undefined,
        forEmisor: payload.forEmisor,
        forAdmin: payload.forAdmin,
        forReceptor: payload.forReceptor,
      };
    }

    const forReceptores =
      payload?.forReceptores && typeof payload.forReceptores === 'object'
        ? (payload.forReceptores as Record<string, string>)
        : null;
    if (!forReceptores) return null;

    return {
      type: 'E2E_GROUP_IMAGE',
      ivFile: payload.ivFile,
      imageUrl: String(payload?.imageUrl || ''),
      imageMime: typeof payload?.imageMime === 'string' ? payload.imageMime : undefined,
      imageNombre: typeof payload?.imageNombre === 'string' ? payload.imageNombre : undefined,
      captionIv: typeof payload?.captionIv === 'string' ? payload.captionIv : undefined,
      captionCiphertext:
        typeof payload?.captionCiphertext === 'string'
          ? payload.captionCiphertext
          : undefined,
      forEmisor: payload.forEmisor,
      forAdmin: payload.forAdmin,
      forReceptores,
    };
  }

  private buildImageE2ECacheKey(payload: ImageE2EPayload): string {
    return [
      payload.type,
      String(this.usuarioActualId),
      String(payload.ivFile || ''),
      String(payload.imageUrl || ''),
      String(payload.imageNombre || ''),
      String(payload.captionIv || ''),
    ].join('|');
  }

  private async resolveImageEnvelopeForCurrentUser(
    payload: ImageE2EPayload,
    emisorId: number,
    myPrivKey: CryptoKey
  ): Promise<string | null> {
    const isSender = Number(emisorId) === Number(this.usuarioActualId);
    const orderedCandidates: string[] = [];

    const pushIfAny = (candidate: unknown) => {
      if (typeof candidate !== 'string') return;
      const clean = candidate.trim();
      if (!clean) return;
      if (orderedCandidates.includes(clean)) return;
      orderedCandidates.push(clean);
    };

    if (isSender) {
      pushIfAny(payload.forEmisor);
    }

    if (payload.type === 'E2E_IMAGE') {
      if (!isSender) pushIfAny(payload.forReceptor);
      pushIfAny(payload.forEmisor);
      pushIfAny(payload.forReceptor);
    } else {
      const direct = payload.forReceptores?.[String(this.usuarioActualId)];
      pushIfAny(direct);
      if (!isSender) {
        for (const candidate of Object.values(payload.forReceptores || {})) {
          pushIfAny(candidate);
        }
      }
      pushIfAny(payload.forEmisor);
      for (const candidate of Object.values(payload.forReceptores || {})) {
        pushIfAny(candidate);
      }
    }

    for (const candidate of orderedCandidates) {
      try {
        await this.cryptoService.decryptRSA(candidate, myPrivKey);
        return candidate;
      } catch {
        // seguimos intentando hasta encontrar una llave válida
      }
    }

    return null;
  }

  private async decryptImageE2EPayloadToObjectUrl(
    payload: ImageE2EPayload,
    emisorId: number,
    debugContext?: E2EDebugContext
  ): Promise<{ objectUrl: string | null; caption: string }> {
    const cacheKey = this.buildImageE2ECacheKey(payload);
    const cachedUrl = this.decryptedImageUrlByCacheKey.get(cacheKey) || null;
    const cachedCaption = this.decryptedImageCaptionByCacheKey.get(cacheKey) || '';
    if (cachedUrl) {
      return { objectUrl: cachedUrl, caption: cachedCaption };
    }

    const inFlight = this.decryptingImageByCacheKey.get(cacheKey);
    if (inFlight) {
      const objectUrl = await inFlight;
      return { objectUrl, caption: this.decryptedImageCaptionByCacheKey.get(cacheKey) || '' };
    }

    const decryptPromise = (async (): Promise<string | null> => {
      try {
        const privKeyBase64 = String(
          localStorage.getItem(`privateKey_${this.usuarioActualId}`) || ''
        ).trim();
        if (!privKeyBase64) return null;

        const myPrivKey = await this.cryptoService.importPrivateKey(privKeyBase64);
        const aesEnvelope = await this.resolveImageEnvelopeForCurrentUser(
          payload,
          emisorId,
          myPrivKey
        );
        if (!aesEnvelope) return null;

        const aesRawBase64 = await this.cryptoService.decryptRSA(
          aesEnvelope,
          myPrivKey
        );
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);

        if (payload.captionCiphertext && payload.captionIv) {
          try {
            const caption = await this.cryptoService.decryptAES(
              payload.captionCiphertext,
              payload.captionIv,
              aesKey
            );
            this.decryptedImageCaptionByCacheKey.set(
              cacheKey,
              String(caption || '').trim()
            );
          } catch {
            this.decryptedImageCaptionByCacheKey.set(cacheKey, '');
          }
        } else {
          this.decryptedImageCaptionByCacheKey.set(cacheKey, '');
        }

        const encryptedUrl = resolveMediaUrl(
          payload.imageUrl,
          environment.backendBaseUrl
        );
        if (!encryptedUrl) return null;

        const response = await fetch(encryptedUrl);
        if (!response.ok) {
          console.warn('[E2E][image-decrypt-fetch-failed]', {
            status: Number(response.status),
            chatId: Number(debugContext?.chatId),
            mensajeId: Number(debugContext?.mensajeId),
            source: debugContext?.source || 'unknown',
          });
          return null;
        }

        const encryptedBytes = await response.arrayBuffer();
        const decryptedBuffer = await this.cryptoService.decryptAESBinary(
          encryptedBytes,
          payload.ivFile,
          aesKey
        );
        const mime = String(payload.imageMime || 'image/jpeg').trim() || 'image/jpeg';
        const objectUrl = URL.createObjectURL(
          new Blob([decryptedBuffer], { type: mime })
        );
        this.decryptedImageUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch (err) {
        console.error('[E2E][image-decrypt-failed]', {
          chatId: Number(debugContext?.chatId),
          mensajeId: Number(debugContext?.mensajeId),
          source: debugContext?.source || 'unknown',
          error: err,
        });
        return null;
      } finally {
        this.decryptingImageByCacheKey.delete(cacheKey);
      }
    })();

    this.decryptingImageByCacheKey.set(cacheKey, decryptPromise);
    const objectUrl = await decryptPromise;
    return {
      objectUrl,
      caption: this.decryptedImageCaptionByCacheKey.get(cacheKey) || '',
    };
  }

  private async hydrateIncomingImageMessage(
    mensaje: MensajeDTO,
    debugContext?: E2EDebugContext
  ): Promise<void> {
    if (String(mensaje?.tipo || 'TEXT').toUpperCase() !== 'IMAGE') return;

    const payload = this.parseImageE2EPayload(mensaje?.contenido);
    if (!payload) {
      (mensaje as any).__imageE2EEncrypted = false;
      return;
    }

    (mensaje as any).__imageE2EEncrypted = true;
    if (payload.imageMime && !mensaje.imageMime) {
      mensaje.imageMime = payload.imageMime;
    }
    if (payload.imageNombre && !mensaje.imageNombre) {
      mensaje.imageNombre = payload.imageNombre;
    }
    if (payload.imageUrl) {
      mensaje.imageUrl = payload.imageUrl;
    }

    const decrypted = await this.decryptImageE2EPayloadToObjectUrl(
      payload,
      Number(mensaje?.emisorId),
      debugContext
    );
    if (decrypted.caption) {
      mensaje.contenido = decrypted.caption;
    } else {
      mensaje.contenido = '';
    }
    if (decrypted.objectUrl) {
      mensaje.imageDataUrl = decrypted.objectUrl;
      (mensaje as any).__imageE2EDecryptOk = true;
      return;
    }
    mensaje.imageDataUrl = null;
    (mensaje as any).__imageE2EDecryptOk = false;
  }

  private async buildOutgoingE2EImageForIndividual(
    receptorId: number,
    imageFile: File,
    caption: string
  ): Promise<BuiltOutgoingImageE2E> {
    const originalImageMime = String(imageFile.type || '').trim() || 'image/jpeg';
    const receptorDTO = await firstValueFrom(this.authService.getById(receptorId));
    const receptorPubKeyBase64 = String(receptorDTO?.publicKey || '').trim();
    const emisorPubKeyBase64 = String(
      localStorage.getItem(`publicKey_${this.usuarioActualId}`) || ''
    ).trim();

    if (!receptorPubKeyBase64 || !emisorPubKeyBase64) {
      throw new Error('E2E_IMAGE_KEYS_MISSING');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const imageRaw = await imageFile.arrayBuffer();
    const encryptedFile = await this.cryptoService.encryptAESBinary(imageRaw, aesKey);
    const encryptedBlob = new Blob([encryptedFile.ciphertext], {
      type: 'application/octet-stream',
    });

    const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);
    const receptorRsaKey = await this.cryptoService.importPublicKey(
      receptorPubKeyBase64
    );
    const emisorRsaKey = await this.cryptoService.importPublicKey(emisorPubKeyBase64);

    await this.ensureAuditPublicKeyForE2E();
    const adminPubKeyBase64 = this.getStoredAuditPublicKey();
    if (!adminPubKeyBase64) {
      throw new Error('E2E_IMAGE_ADMIN_KEY_MISSING');
    }
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPubKeyBase64);

    const normalizedCaption = String(caption || '').trim();
    let captionIv: string | undefined;
    let captionCiphertext: string | undefined;
    if (normalizedCaption) {
      const encryptedCaption = await this.cryptoService.encryptAES(
        normalizedCaption,
        aesKey
      );
      captionIv = encryptedCaption.iv;
      captionCiphertext = encryptedCaption.ciphertext;
    }

    const payload: ImageE2EIndividualPayload = {
      type: 'E2E_IMAGE',
      ivFile: encryptedFile.iv,
      imageUrl: '',
      imageMime: originalImageMime,
      imageNombre: imageFile.name,
      captionIv,
      captionCiphertext,
      forEmisor: await this.cryptoService.encryptRSA(aesKeyRawBase64, emisorRsaKey),
      forAdmin: await this.cryptoService.encryptRSA(aesKeyRawBase64, adminRsaKey),
      forReceptor: await this.cryptoService.encryptRSA(
        aesKeyRawBase64,
        receptorRsaKey
      ),
    };

    return {
      payload,
      encryptedBlob,
      forReceptoresKeys: [],
      expectedRecipientIds: [Number(receptorId)].filter(
        (id) => Number.isFinite(id) && id > 0
      ),
    };
  }

  private async buildOutgoingE2EImageForGroup(
    chatItem: any,
    imageFile: File,
    caption: string
  ): Promise<BuiltOutgoingImageE2E> {
    const originalImageMime = String(imageFile.type || '').trim() || 'image/jpeg';
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const emisorPubKeyBase64 = String(
      localStorage.getItem(`publicKey_${myId}`) || ''
    ).trim();
    if (!emisorPubKeyBase64) {
      throw new Error('E2E_IMAGE_SENDER_KEY_MISSING');
    }

    const memberIds = await this.resolveGroupMemberIdsForEncryption(chatItem, myId);
    if (memberIds.length === 0) {
      throw new Error('E2E_IMAGE_GROUP_NO_RECIPIENTS');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const imageRaw = await imageFile.arrayBuffer();
    const encryptedFile = await this.cryptoService.encryptAESBinary(imageRaw, aesKey);
    const encryptedBlob = new Blob([encryptedFile.ciphertext], {
      type: 'application/octet-stream',
    });
    const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);

    const emisorRsaKey = await this.cryptoService.importPublicKey(emisorPubKeyBase64);
    const forReceptores: Record<string, string> = {};
    await Promise.all(
      memberIds.map(async (uid) => {
        const dto = await firstValueFrom(this.authService.getById(uid));
        const pub = String(dto?.publicKey || '').trim();
        if (!pub) {
          throw new Error(`E2E_IMAGE_GROUP_MEMBER_KEY_MISSING:${uid}`);
        }
        const rsa = await this.cryptoService.importPublicKey(pub);
        forReceptores[String(uid)] = await this.cryptoService.encryptRSA(
          aesKeyRawBase64,
          rsa
        );
      })
    );

    await this.ensureAuditPublicKeyForE2E();
    const adminPubKeyBase64 = this.getStoredAuditPublicKey();
    if (!adminPubKeyBase64) {
      throw new Error('E2E_IMAGE_ADMIN_KEY_MISSING');
    }
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPubKeyBase64);

    const normalizedCaption = String(caption || '').trim();
    let captionIv: string | undefined;
    let captionCiphertext: string | undefined;
    if (normalizedCaption) {
      const encryptedCaption = await this.cryptoService.encryptAES(
        normalizedCaption,
        aesKey
      );
      captionIv = encryptedCaption.iv;
      captionCiphertext = encryptedCaption.ciphertext;
    }

    const payload: ImageE2EGroupPayload = {
      type: 'E2E_GROUP_IMAGE',
      ivFile: encryptedFile.iv,
      imageUrl: '',
      imageMime: originalImageMime,
      imageNombre: imageFile.name,
      captionIv,
      captionCiphertext,
      forEmisor: await this.cryptoService.encryptRSA(aesKeyRawBase64, emisorRsaKey),
      forAdmin: await this.cryptoService.encryptRSA(aesKeyRawBase64, adminRsaKey),
      forReceptores,
    };

    return {
      payload,
      encryptedBlob,
      forReceptoresKeys: Object.keys(forReceptores),
      expectedRecipientIds: [...memberIds].sort((a, b) => a - b),
    };
  }

  public isSystemMessage(mensaje: any): boolean {
    return isSystemMessageLike(mensaje);
  }

  private resolveGroupMemberDisplayName(groupId: number, userId: number): string {
    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) return 'Usuario';

    const groupChat =
      Number(this.chatActual?.id) === Number(groupId) && this.chatActual?.esGrupo
        ? this.chatActual
        : (this.chats || []).find(
            (c: any) => Number(c?.id) === Number(groupId) && !!c?.esGrupo
          );

    const groupUsers = Array.isArray(groupChat?.usuarios) ? groupChat.usuarios : [];
    const user = groupUsers.find((u: any) => Number(u?.id) === targetUserId);
    const byGroup = `${user?.nombre || ''} ${user?.apellido || ''}`.trim();
    if (byGroup) return byGroup;

    if (targetUserId === Number(this.usuarioActualId)) {
      const me = `${this.perfilUsuario?.nombre || ''} ${this.perfilUsuario?.apellido || ''}`.trim();
      if (me) return me;
      return 'Tú';
    }

    return this.obtenerNombrePorId(targetUserId) || `Usuario ${targetUserId}`;
  }

  private buildLocalGroupLeaveSystemMessage(
    groupId: number,
    userId: number,
    backendRawMessage?: string
  ): MensajeDTO {
    const nombre = this.resolveGroupMemberDisplayName(groupId, userId);
    const fallbackText = `${nombre} ha salido del grupo`;
    const contenido = fallbackText;
    void backendRawMessage;

    this.localSystemMessageSeq += 1;
    const syntheticId = -(Date.now() + this.localSystemMessageSeq);

    return {
      id: syntheticId,
      chatId: Number(groupId),
      emisorId: Number(userId),
      receptorId: Number(groupId),
      contenido,
      fechaEnvio: new Date().toISOString(),
      activo: true,
      leido: true,
      tipo: 'SYSTEM',
      reenviado: false,
      esSistema: true,
      systemEvent: 'GROUP_MEMBER_LEFT',
      emisorNombre: nombre.split(' ')[0] || undefined,
      emisorApellido: nombre.split(' ').slice(1).join(' ') || undefined,
    };
  }

  private buildConversationHistoryKey(chatId: number, esGrupo: boolean): string {
    return `${esGrupo ? 'G' : 'I'}:${Number(chatId)}`;
  }

  private createInitialHistoryState(): ChatHistoryState {
    return {
      messages: [],
      page: 0,
      hasMore: true,
      loadingMore: false,
      initialized: false,
    };
  }

  private resetHistoryStateForConversation(
    chatId: number,
    esGrupo: boolean
  ): ChatHistoryState {
    const key = this.buildConversationHistoryKey(chatId, esGrupo);
    const state = this.createInitialHistoryState();
    this.historyStateByConversation.set(key, state);
    return state;
  }

  private getHistoryStateForConversation(
    chatId: number,
    esGrupo: boolean
  ): ChatHistoryState | null {
    const key = this.buildConversationHistoryKey(chatId, esGrupo);
    return this.historyStateByConversation.get(key) || null;
  }

  private getHistorySource$(
    chatId: number,
    esGrupo: boolean,
    page: number,
    size: number
  ) {
    return esGrupo
      ? this.chatService.listarMensajesPorChatGrupal(chatId, page, size)
      : this.chatService.listarMensajesPorChat(chatId, page, size);
  }

  private async decryptHistoryPageMessages(
    mensajes: any[],
    chatId: number,
    esGrupo: boolean,
    source: string
  ): Promise<MensajeDTO[]> {
    const lista = Array.isArray(mensajes) ? [...mensajes] : [];
    for (const m of lista) {
      if (this.isSystemMessage(m)) {
        m.contenido = String(m?.contenido ?? '').trim();
        continue;
      }
      m.contenido = await this.decryptContenido(
        m?.contenido,
        Number(m?.emisorId),
        Number(m?.receptorId),
        {
          chatId,
          mensajeId: Number(m?.id),
          source,
        }
      );
      await this.hydrateIncomingAudioMessage(m as MensajeDTO, {
        chatId,
        mensajeId: Number(m?.id),
        source: `${source}-audio`,
      });
      await this.hydrateIncomingImageMessage(m as MensajeDTO, {
        chatId,
        mensajeId: Number(m?.id),
        source: `${source}-image`,
      });
    }
    const result = lista as MensajeDTO[];
    if (!esGrupo) return result;
    const filtered = result.filter(
      (m) => this.isSystemMessage(m) || !this.isEncryptedHiddenPlaceholder(m?.contenido)
    );
    if (filtered.length < result.length) {
      this.groupHistoryHiddenByChatId.set(chatId, true);
    }
    return filtered;
  }

  private mergeMessagesById(
    existing: MensajeDTO[],
    incoming: MensajeDTO[],
    mode: 'replace' | 'append' | 'prepend'
  ): MensajeDTO[] {
    const base =
      mode === 'replace'
        ? [...incoming]
        : mode === 'prepend'
        ? [...incoming, ...existing]
        : [...existing, ...incoming];

    const merged: MensajeDTO[] = [];
    const indexById = new Map<number, number>();

    for (const message of base) {
      const id = Number(message?.id);
      if (Number.isFinite(id) && id > 0) {
        const idx = indexById.get(id);
        if (idx != null) {
          merged[idx] = { ...merged[idx], ...message };
          continue;
        }
        indexById.set(id, merged.length);
      }
      merged.push(message);
    }
    return merged;
  }

  private syncActiveHistoryStateMessages(): void {
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const esGrupo = !!this.chatActual?.esGrupo;
    const state = this.getHistoryStateForConversation(chatId, esGrupo);
    if (!state) return;
    state.messages = [...this.mensajesSeleccionados];
  }

  private retainScrollPositionAfterPrepend(previousHeight: number): void {
    try {
      setTimeout(() => {
        const el = this.contenedorMensajes?.nativeElement;
        if (!el) return;
        el.scrollTop = Math.max(0, el.scrollHeight - previousHeight);
      }, 0);
    } catch (err) {
      console.warn('[INICIO] no se pudo ajustar scroll al prepend:', err);
    }
  }

  private loadInitialMessagesPage(chat: any, leftSet: Set<number>): void {
    const chatId = Number(chat?.id);
    const esGrupo = !!chat?.esGrupo;
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    const state = this.resetHistoryStateForConversation(chatId, esGrupo);

    this.getHistorySource$(chatId, esGrupo, 0, this.HISTORY_PAGE_SIZE).subscribe({
      next: async (mensajes: any[]) => {
        const fetchedCount = Array.isArray(mensajes) ? mensajes.length : 0;
        const lista = await this.decryptHistoryPageMessages(
          mensajes || [],
          chatId,
          esGrupo,
          esGrupo ? 'history-group' : 'history-individual'
        );

        if (
          !this.chatActual ||
          Number(this.chatActual.id) !== chatId ||
          !!this.chatActual.esGrupo !== esGrupo
        ) {
          return;
        }

        const merged = this.mergeMessagesById([], lista, 'replace');
        this.mensajesSeleccionados = merged;
        this.seedIncomingReactionsFromMessages(merged);
        state.messages = [...merged];
        state.page = 0;
        state.hasMore = fetchedCount === this.HISTORY_PAGE_SIZE;
        state.loadingMore = false;
        state.initialized = true;

        if (!esGrupo) {
          const noLeidos = this.mensajesSeleccionados
            .filter(
              (m) =>
                !m.leido &&
                m.receptorId === this.usuarioActualId &&
                m.id != null
            )
            .map((m) => m.id as number);
          if (noLeidos.length > 0) {
            console.log('[INICIO] marcar leidos al abrir chat', {
              chatId,
              noLeidos,
            });
            this.wsService.marcarMensajesComoLeidos(noLeidos);
          }
        }

        const item = this.chats.find((c) => c.id === chatId);
        if (item) {
          item.unreadCount = 0;
          console.log('[INICIO] unreadCount reset por abrir chat', {
            chatId,
          });
        }

        if (esGrupo) {
          this.wsService.suscribirseAEscribiendoGrupo(chatId, (data: any) => {
            if (!this.chatActual || this.chatActual.id !== data.chatId) return;
            if (Number(data.emisorId) === this.usuarioActualId) return;

            const nombre =
              (
                data.emisorNombre ||
                getNombrePorId(this.chats, data.emisorId) ||
                'Alguien'
              ).trim() + (data.emisorApellido ? ` ${data.emisorApellido}` : '');

            if (data.escribiendo) this.typingSetHeader.add(nombre);
            else this.typingSetHeader.delete(nombre);

            this.escribiendoHeader = buildTypingHeaderText(
              Array.from(this.typingSetHeader)
            );
            this.cdr.markForCheck();
          });
        }

        this.scrollAlFinal();
        this.cdr.markForCheck();
      },
      error: (err) => {
        state.loadingMore = false;
        state.initialized = false;
        console.error('[INICIO] error al obtener mensajes:', err);
        if (esGrupo && (err.status === 403 || err.status === 404)) {
          this.haSalidoDelGrupo = true;
          this.mensajeNuevo = 'Has salido del grupo';
          leftSet.add(chatId);
          localStorage.setItem('leftGroupIds', JSON.stringify(Array.from(leftSet)));
        }
      },
    });
  }

  private loadOlderMessagesPageForActiveChat(): void {
    const chat = this.chatActual;
    const chatId = Number(chat?.id);
    const esGrupo = !!chat?.esGrupo;
    if (!chat || !Number.isFinite(chatId) || chatId <= 0) return;

    const state = this.getHistoryStateForConversation(chatId, esGrupo);
    if (!state || !state.initialized || state.loadingMore || !state.hasMore) {
      return;
    }

    state.loadingMore = true;
    const nextPage = state.page + 1;
    const previousHeight = this.contenedorMensajes?.nativeElement?.scrollHeight || 0;

    this.getHistorySource$(chatId, esGrupo, nextPage, this.HISTORY_PAGE_SIZE).subscribe({
      next: async (mensajes: any[]) => {
        const fetchedCount = Array.isArray(mensajes) ? mensajes.length : 0;
        const pageMessages = await this.decryptHistoryPageMessages(
          mensajes || [],
          chatId,
          esGrupo,
          esGrupo
            ? `history-group-page-${nextPage}`
            : `history-individual-page-${nextPage}`
        );

        if (
          !this.chatActual ||
          Number(this.chatActual.id) !== chatId ||
          !!this.chatActual.esGrupo !== esGrupo
        ) {
          state.loadingMore = false;
          return;
        }

        const merged = this.mergeMessagesById(
          this.mensajesSeleccionados || [],
          pageMessages,
          'prepend'
        );
        this.mensajesSeleccionados = merged;
        this.seedIncomingReactionsFromMessages(merged);
        state.messages = [...merged];
        state.page = nextPage;
        state.hasMore = fetchedCount === this.HISTORY_PAGE_SIZE;
        state.loadingMore = false;
        state.initialized = true;

        this.cdr.markForCheck();
        this.retainScrollPositionAfterPrepend(previousHeight);
      },
      error: (err) => {
        state.loadingMore = false;
        console.error('[INICIO] error cargando más historial', {
          chatId,
          nextPage,
          status: err?.status,
          message: err?.message || err?.error?.mensaje || String(err),
        });
      },
    });
  }

  public onMessagesScroll(): void {
    const el = this.contenedorMensajes?.nativeElement;
    if (!el || !this.chatActual) return;
    if (el.scrollTop >= this.HISTORY_SCROLL_TOP_THRESHOLD) return;
    this.loadOlderMessagesPageForActiveChat();
  }

  private hasLoadedMessageById(messageId: number): boolean {
    return (this.mensajesSeleccionados || []).some(
      (m) => Number(m?.id) === Number(messageId)
    );
  }

  private async ensureMessageLoadedForSearchNavigation(
    messageId: number
  ): Promise<boolean> {
    if (this.hasLoadedMessageById(messageId)) return true;

    const maxFetches = 60;
    for (let attempt = 0; attempt < maxFetches; attempt++) {
      const loadedOnePage = await this.loadOlderMessagesPageForActiveChatAsync();
      if (!loadedOnePage) break;
      if (this.hasLoadedMessageById(messageId)) return true;
    }
    return this.hasLoadedMessageById(messageId);
  }

  private async loadOlderMessagesPageForActiveChatAsync(): Promise<boolean> {
    const chat = this.chatActual;
    const chatId = Number(chat?.id);
    const esGrupo = !!chat?.esGrupo;
    if (!chat || !Number.isFinite(chatId) || chatId <= 0) return false;

    const state = this.getHistoryStateForConversation(chatId, esGrupo);
    if (!state || !state.initialized || !state.hasMore) return false;

    if (state.loadingMore) {
      return this.waitForCondition(() => !state.loadingMore, 12000);
    }

    const previousPage = Number(state.page) || 0;
    const previousLength = this.mensajesSeleccionados.length;
    this.loadOlderMessagesPageForActiveChat();

    if (!state.loadingMore) return false;
    const finished = await this.waitForCondition(() => !state.loadingMore, 12000);
    if (!finished) return false;

    return (
      (Number(state.page) || 0) > previousPage ||
      this.mensajesSeleccionados.length > previousLength
    );
  }

  private async focusMessageInViewport(messageId: number): Promise<boolean> {
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.scrollMessageElementIntoView(messageId)) {
        this.flashSearchTarget(messageId);
        return true;
      }
      await this.delay(120);
    }
    return false;
  }

  private scrollMessageElementIntoView(messageId: number): boolean {
    const container = this.contenedorMensajes?.nativeElement as
      | HTMLElement
      | undefined;
    if (!container) return false;

    const target = container.querySelector(
      `[data-message-id=\"${messageId}\"]`
    ) as HTMLElement | null;
    if (!target) return false;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  private flashSearchTarget(messageId: number): void {
    if (this.highlightedMessageTimer) {
      clearTimeout(this.highlightedMessageTimer);
    }
    this.highlightedMessageId = messageId;
    this.highlightedMessageTimer = setTimeout(() => {
      if (this.highlightedMessageId === messageId) {
        this.highlightedMessageId = null;
      }
      this.highlightedMessageTimer = null;
    }, 3400);
  }

  private async waitForCondition(
    predicate: () => boolean,
    timeoutMs: number,
    pollMs: number = 60
  ): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (predicate()) return true;
      await this.delay(pollMs);
    }
    return predicate();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    const initPromise = new Promise<void>((resolve) => {
      this.authService.getAuditPublicKey().subscribe({
        next: (resp: any) => {
          const key =
            this.extractAuditPublicKeyFromSource(resp) ||
            this.extractAuditPublicKeyFromSource(resp?.data) ||
            this.extractAuditPublicKeyFromSource(resp?.result);
          if (key) {
            this.persistAuditPublicKeyLocal(key);
            console.log('[E2E][audit-key-load-ok]', {
              keyLength: key.length,
            });
          } else {
            console.warn('[E2E][audit-key-load-empty-response]');
          }
          resolve();
        },
        error: (err) => {
          console.warn('[E2E][audit-key-load-failed]', {
            status: err?.status,
            message: err?.message || err?.error?.mensaje || String(err),
          });
          resolve();
        },
      });
    });

    this.auditPublicKeyInitPromise = initPromise;
    try {
      await initPromise;
    } finally {
      if (this.auditPublicKeyInitPromise === initPromise) {
        this.auditPublicKeyInitPromise = null;
      }
    }
  }

  private classifyOutgoingGroupPayload(
    contenido: unknown
  ): { payloadClass: OutgoingGroupPayloadClass; forReceptoresKeys: string[] } {
    const raw = typeof contenido === 'string' ? contenido : String(contenido ?? '');
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('{')) {
      return { payloadClass: 'PLAIN_TEXT', forReceptoresKeys: [] };
    }

    try {
      const payload = JSON.parse(trimmed);
      const forReceptoresKeys =
        payload &&
        payload.type === 'E2E_GROUP' &&
        payload.forReceptores &&
        typeof payload.forReceptores === 'object'
          ? Object.keys(payload.forReceptores)
          : [];
      if (payload?.type === 'E2E_GROUP') {
        return { payloadClass: 'JSON_E2E_GROUP', forReceptoresKeys };
      }
      if (payload?.type === 'E2E') {
        return { payloadClass: 'JSON_E2E', forReceptoresKeys: [] };
      }
      return { payloadClass: 'JSON_OTHER', forReceptoresKeys: [] };
    } catch {
      return { payloadClass: 'INVALID_JSON', forReceptoresKeys: [] };
    }
  }

  private validateOutgoingGroupPayloadStrict(
    contenido: unknown,
    expectedRecipientIds: number[]
  ): GroupPayloadValidationResult {
    const parsed = this.classifyOutgoingGroupPayload(contenido);
    if (parsed.payloadClass !== 'JSON_E2E_GROUP') {
      return {
        ok: false,
        code: 'E2E_GROUP_PAYLOAD_INVALID',
        reason: `payloadClass=${parsed.payloadClass}`,
        forReceptoresKeys: parsed.forReceptoresKeys,
      };
    }

    const raw =
      typeof contenido === 'string' ? contenido : String(contenido ?? '');
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        code: 'E2E_GROUP_PAYLOAD_INVALID',
        reason: 'invalid-json',
        forReceptoresKeys: [],
      };
    }

    const requiredStringFields = ['iv', 'ciphertext', 'forEmisor', 'forAdmin'];
    const missingStringFields = requiredStringFields.filter(
      (field) =>
        typeof payload?.[field] !== 'string' || !String(payload[field]).trim()
    );
    if (missingStringFields.length > 0) {
      return {
        ok: false,
        code: 'E2E_GROUP_PAYLOAD_INVALID',
        reason: `missing-fields:${missingStringFields.join(',')}`,
        forReceptoresKeys: parsed.forReceptoresKeys,
      };
    }

    const forReceptores = payload?.forReceptores;
    if (
      !forReceptores ||
      typeof forReceptores !== 'object' ||
      Array.isArray(forReceptores)
    ) {
      return {
        ok: false,
        code: 'E2E_GROUP_PAYLOAD_INVALID',
        reason: 'forReceptores-invalid',
        forReceptoresKeys: [],
      };
    }

    const forReceptoresKeys = Object.keys(forReceptores);
    const invalidEnvelopeKeys = forReceptoresKeys.filter((k) => {
      const v = (forReceptores as Record<string, unknown>)[k];
      return typeof v !== 'string' || !String(v).trim();
    });
    if (invalidEnvelopeKeys.length > 0) {
      return {
        ok: false,
        code: 'E2E_GROUP_PAYLOAD_INVALID',
        reason: `forReceptores-empty-envelopes:${invalidEnvelopeKeys.join(',')}`,
        forReceptoresKeys,
      };
    }

    const expected = Array.from(
      new Set(
        (expectedRecipientIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    ).sort((a, b) => a - b);

    const payloadIds = Array.from(
      new Set(
        forReceptoresKeys
          .map((k) => Number(k))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    ).sort((a, b) => a - b);

    const missingRecipientIds = expected.filter((id) => !payloadIds.includes(id));
    const extraRecipientIds = payloadIds.filter((id) => !expected.includes(id));

    if (missingRecipientIds.length > 0 || extraRecipientIds.length > 0) {
      return {
        ok: false,
        code: 'E2E_RECIPIENT_KEYS_MISMATCH',
        reason: `missing=[${missingRecipientIds.join(',')}],extra=[${extraRecipientIds.join(',')}]`,
        forReceptoresKeys,
      };
    }

    return {
      ok: true,
      forReceptoresKeys,
    };
  }

  private async hash12ForContent(contenido: unknown): Promise<string> {
    try {
      const raw = typeof contenido === 'string' ? contenido : JSON.stringify(contenido ?? '');
      const data = new TextEncoder().encode(raw);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hex.slice(0, 12);
    } catch {
      return 'hash_error';
    }
  }

  private async logGroupWsPayloadBeforeSend(
    source: string,
    mensaje: Partial<MensajeDTO> & { contenido?: unknown },
    overrideForReceptoresKeys?: string[]
  ): Promise<void> {
    const contenido = typeof mensaje?.contenido === 'string' ? mensaje.contenido : '';
    const parsed = this.classifyOutgoingGroupPayload(contenido);
    const forReceptoresKeys = overrideForReceptoresKeys ?? parsed.forReceptoresKeys;
    const hash12 = await this.hash12ForContent(contenido);

    console.log('[E2E][ws-group-before-send]', {
      source,
      chatId: Number(mensaje?.chatId),
      emisorId: Number(mensaje?.emisorId),
      tipo: String(mensaje?.tipo || ''),
      payloadClass: parsed.payloadClass,
      len: contenido.length,
      hash12,
      forReceptoresKeys,
      forReceptoresCount: forReceptoresKeys.length,
    });
  }

  private async buildOutgoingE2EContent(
    receptorId: number,
    plainText: string
  ): Promise<string> {
    let finalContenido = plainText;

    try {
      const receptorDTO = await this.authService.getById(receptorId).toPromise();
      const receptorPubKeyBase64 = receptorDTO?.publicKey;
      const emisorPrivKeyBase64 = localStorage.getItem(
        `privateKey_${this.usuarioActualId}`
      );
      const emisorPubKeyBase64 = localStorage.getItem(
        `publicKey_${this.usuarioActualId}`
      );

      if (receptorPubKeyBase64 && emisorPrivKeyBase64 && emisorPubKeyBase64) {
        const aesKey = await this.cryptoService.generateAESKey();
        const { iv, ciphertext } = await this.cryptoService.encryptAES(
          plainText,
          aesKey
        );
        const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);

        const receptorRsaKey = await this.cryptoService.importPublicKey(
          receptorPubKeyBase64
        );
        const aesReceptorEncrypted = await this.cryptoService.encryptRSA(
          aesKeyRawBase64,
          receptorRsaKey
        );

        const emisorRsaKey = await this.cryptoService.importPublicKey(
          emisorPubKeyBase64
        );
        const aesEmisorEncrypted = await this.cryptoService.encryptRSA(
          aesKeyRawBase64,
          emisorRsaKey
        );

        await this.ensureAuditPublicKeyForE2E();
        const adminPubKeyBase64 = this.getStoredAuditPublicKey();

        if (!adminPubKeyBase64) {
          throw new Error(
            'Falta la clave pública de admin para construir forAdmin.'
          );
        }

        const adminRsaKey = await this.cryptoService.importPublicKey(
          adminPubKeyBase64
        );
        const adminEnvelopeEncrypted = await this.cryptoService.encryptRSA(
          plainText,
          adminRsaKey
        );

        const e2ePayload = {
          type: 'E2E',
          iv: iv,
          ciphertext: ciphertext,
          forEmisor: aesEmisorEncrypted,
          forReceptor: aesReceptorEncrypted,
          forAdmin: adminEnvelopeEncrypted,
        };

        finalContenido = JSON.stringify(e2ePayload);
      } else {
        console.warn(
          'No se pudo cifrar E2E por falta de claves (Se enviará en texto plano).'
        );
      }
    } catch (err) {
      console.error('Error cifrando mensaje E2E', err);
    }

    return finalContenido;
  }

  private async buildOutgoingE2EContentForGroup(
    chatItem: any,
    plainText: string
  ): Promise<GroupE2EBuildResult> {
    try {
      const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
      const emisorPubKeyBase64 = localStorage.getItem(`publicKey_${myId}`);
      if (!emisorPubKeyBase64) {
        throw new Error('Falta la clave pública del emisor.');
      }

      const memberIds = await this.resolveGroupMemberIdsForEncryption(
        chatItem,
        myId
      );
      if (memberIds.length === 0) {
        console.warn('[E2E][encrypt-group-no-recipient-members]', {
          groupId: Number(chatItem?.id),
          senderId: Number(myId),
        });
        throw new Error(
          'No hay miembros receptores válidos para cifrar E2E_GROUP.'
        );
      }
      console.log('[E2E][encrypt-group-members]', {
        groupId: Number(chatItem?.id),
        senderId: Number(myId),
        memberIds,
        memberCount: memberIds.length,
      });

      const aesKey = await this.cryptoService.generateAESKey();
      const { iv, ciphertext } = await this.cryptoService.encryptAES(
        plainText,
        aesKey
      );
      const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);

      const emisorRsaKey = await this.cryptoService.importPublicKey(
        emisorPubKeyBase64
      );
      const aesEmisorEncrypted = await this.cryptoService.encryptRSA(
        aesKeyRawBase64,
        emisorRsaKey
      );

      const forReceptores: Record<string, string> = {};
      await Promise.all(
        memberIds.map(async (uid) => {
          const dto = await this.authService.getById(uid).toPromise();
          const pub = dto?.publicKey;
          if (!pub) {
            console.warn('[E2E][encrypt-group-missing-public-key]', {
              groupId: Number(chatItem?.id),
              userId: Number(uid),
            });
            throw new Error(`Falta publicKey para usuario ${uid}`);
          }
          const rsa = await this.cryptoService.importPublicKey(pub);
          forReceptores[String(uid)] = await this.cryptoService.encryptRSA(
            aesKeyRawBase64,
            rsa
          );
        })
      );
      console.log('[E2E][encrypt-group-envelopes-built]', {
        groupId: Number(chatItem?.id),
        expected: memberIds.length,
        generated: Object.keys(forReceptores).length,
        envelopeUserIds: Object.keys(forReceptores),
      });

      if (
        memberIds.length > 0 &&
        Object.keys(forReceptores).length !== memberIds.length
      ) {
        throw new Error(
          'No se pudo cifrar la clave para todos los miembros del grupo.'
        );
      }

      await this.ensureAuditPublicKeyForE2E();
      const adminPubKeyBase64 = this.getStoredAuditPublicKey();
      if (!adminPubKeyBase64) {
        throw new Error(
          'Falta la clave pública de admin para construir forAdmin.'
        );
      }
      const adminRsaKey = await this.cryptoService.importPublicKey(
        adminPubKeyBase64
      );
      const adminEnvelopeEncrypted = await this.cryptoService.encryptRSA(
        plainText,
        adminRsaKey
      );

      const e2ePayload = {
        type: 'E2E_GROUP',
        iv,
        ciphertext,
        forEmisor: aesEmisorEncrypted,
        forReceptores,
        forAdmin: adminEnvelopeEncrypted,
      };
      return {
        content: JSON.stringify(e2ePayload),
        forReceptoresKeys: Object.keys(forReceptores),
        expectedRecipientCount: memberIds.length,
        expectedRecipientIds: [...memberIds].sort((a, b) => a - b),
      };
    } catch (err) {
      console.error('Error cifrando mensaje grupal E2E', err, {
        groupId: Number(chatItem?.id),
        senderId: Number(
          this.getMyUserId ? this.getMyUserId() : this.usuarioActualId
        ),
      });
      throw err;
    }
  }

  private normalizeMemberIds(rawMembers: any[], myId: number): number[] {
    return Array.from(
      new Set(
        (rawMembers as Array<{ id?: number }>)
          .map((u) => Number(u?.id))
          .filter((id) => Number.isFinite(id) && id > 0 && id !== myId)
      )
    );
  }

  private extractMemberIdsFromLocalChat(chatItem: any, myId: number): number[] {
    const localMembersRaw = Array.isArray(chatItem?.usuarios)
      ? chatItem.usuarios
      : Array.isArray(chatItem?.miembros)
      ? chatItem.miembros
      : Array.isArray(chatItem?.members)
      ? chatItem.members
      : [];
    return this.normalizeMemberIds(localMembersRaw, myId);
  }

  private async resolveGroupMemberIdsForEncryption(
    chatItem: any,
    myId: number
  ): Promise<number[]> {
    const localMemberIds = this.extractMemberIdsFromLocalChat(chatItem, myId);
    const groupId = Number(chatItem?.id);
    const seededMemberIds = Number.isFinite(groupId) && groupId > 0
      ? (this.groupRecipientSeedByChatId.get(groupId) || []).filter(
          (id) => Number.isFinite(id) && id > 0 && id !== myId
        )
      : [];
    const localPlusSeed = Array.from(new Set([...localMemberIds, ...seededMemberIds]));

    if (!Number.isFinite(groupId) || groupId <= 0) {
      console.warn('[E2E][members-resolve-invalid-group-id]', {
        groupId: chatItem?.id,
        localMemberIds: localPlusSeed,
      });
      return localPlusSeed;
    }

    const fetchDetailMemberIds = async () => {
      const detail = await this.chatService.obtenerDetalleGrupo(groupId).toPromise();
      const detailMembers = Array.isArray((detail as any)?.miembros)
        ? (detail as any).miembros
        : Array.isArray((detail as any)?.usuarios)
        ? (detail as any).usuarios
        : Array.isArray((detail as any)?.members)
        ? (detail as any).members
        : [];
      const freshMemberIds = this.normalizeMemberIds(detailMembers, myId);
      return { detailMembers, freshMemberIds };
    };

    try {
      let { detailMembers, freshMemberIds } = await fetchDetailMemberIds();
      console.log('[E2E][members-resolve]', {
        groupId,
        senderId: Number(myId),
        localMemberIds: localPlusSeed,
        freshMemberIds,
        localCount: localPlusSeed.length,
        freshCount: freshMemberIds.length,
      });

      if (freshMemberIds.length === 0 && localPlusSeed.length === 0) {
        // Primeros instantes tras crear grupo: el detalle puede tardar en reflejar miembros.
        await new Promise((resolve) => setTimeout(resolve, 350));
        const retry = await fetchDetailMemberIds();
        detailMembers = retry.detailMembers;
        freshMemberIds = retry.freshMemberIds;
        console.log('[E2E][members-resolve-retry]', {
          groupId,
          senderId: Number(myId),
          freshMemberIds,
          freshCount: freshMemberIds.length,
        });
      }

      if (freshMemberIds.length === 0) return localPlusSeed;

      const mergedMemberIds = Array.from(
        new Set([...freshMemberIds, ...localPlusSeed])
      );
      if (mergedMemberIds.length !== freshMemberIds.length) {
        console.warn('[E2E][members-resolve-merge]', {
          groupId,
          senderId: Number(myId),
          freshMemberIds,
          localPlusSeed,
          mergedMemberIds,
          freshCount: freshMemberIds.length,
          mergedCount: mergedMemberIds.length,
        });
      }

      // Sincroniza snapshot local para minimizar cifrados con miembros desfasados.
      if (detailMembers.length > 0 && chatItem) {
        chatItem.usuarios = detailMembers.map((m: any) => ({
          id: Number(m?.id),
          nombre: m?.nombre || '',
          apellido: m?.apellido || '',
          foto: m?.foto || null,
        }));
      }

      this.groupRecipientSeedByChatId.delete(groupId);
      return mergedMemberIds;
    } catch (err) {
      console.warn(
        'No se pudo refrescar el detalle del grupo para cifrado E2E. Se usarán miembros locales.',
        err,
        { groupId, localMemberIds: localPlusSeed }
      );
      return localPlusSeed;
    }
  }


  /**
   * Toma el texto escrito en el input, lo cifra si es un chat individual,
   * y lo envía al backend mediante WebSockets.
   */
  public async enviarMensaje(): Promise<void> {
    if (!this.mensajeNuevo?.trim() || !this.chatActual) return;
    if (this.haSalidoDelGrupo) return; // Bloquea si estas fuera

    const contenido = this.mensajeNuevo.trim();
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const replyToMessageId = this.mensajeRespuestaObjetivo?.id
      ? Number(this.mensajeRespuestaObjetivo.id)
      : undefined;
    const replySnippet = this.getComposeReplySnippet();
    const replyAuthorName = this.getComposeReplyAuthorName();

    // === GRUPO (cifrado E2E obligatorio para texto) ===
    if (this.chatActual.esGrupo) {
      if (this.noGroupRecipientsForSend) {
        this.showToast(
          'Todavia no ha aceptado nadie.',
          'warning',
          'Grupo'
        );
        return;
      }
      const chatId = Number(this.chatActual.id);
      if (this.groupTextSendInFlightByChatId.has(chatId)) {
        return;
      }
      this.groupTextSendInFlightByChatId.add(chatId);
      try {
      if (!this.e2eSessionReady) {
        const synced = await this.forceSyncMyE2EPublicKeyForRetry();
        if (!synced) {
          this.showToast(
            'No se pudo sincronizar tu clave E2E. Revisa tu sesión antes de enviar al grupo.',
            'danger',
            'E2E'
          );
          return;
        }
      }
      let encryptedGroup: GroupE2EBuildResult;
      try {
        encryptedGroup = await this.buildOutgoingE2EContentForGroup(
          this.chatActual,
          contenido
        );
      } catch (err: any) {
        console.warn('[E2E][group-send-blocked]', {
          chatId,
          emisorId: Number(myId),
          reason: err?.message || String(err),
        });
        this.showToast(
          'No se pudo cifrar el mensaje grupal. Revisa las claves E2E del grupo.',
          'danger',
          'E2E'
        );
        return;
      }

      const mensaje: any = {
        contenido: encryptedGroup.content,
        emisorId: myId,
        receptorId: chatId, // en grupos, receptorId = chatId
        activo: true,
        chatId,
        tipo: 'TEXT',
        reenviado: false,
        replyToMessageId,
        replySnippet,
        replyAuthorName,
      };

      const strictValidation = this.validateOutgoingGroupPayloadStrict(
        mensaje.contenido,
        encryptedGroup.expectedRecipientIds
      );
      if (!strictValidation.ok) {
        console.warn('[E2E][group-send-blocked-strict-validation]', {
          chatId,
          emisorId: Number(myId),
          code: strictValidation.code,
          reason: strictValidation.reason,
          expectedRecipientIds: encryptedGroup.expectedRecipientIds,
          payloadForReceptoresKeys: strictValidation.forReceptoresKeys,
        });
        this.showToast(
          `No se pudo enviar: ${strictValidation.reason || strictValidation.code || 'payload E2E_GROUP inválido'}.`,
          'danger',
          'E2E'
        );
        return;
      }

      const chatItem = (this.chats || []).find(
        (c: any) => Number(c.id) === chatId
      );
      const pseudo = { ...mensaje, emisorNombre: 'Tú', contenido };

      const preview = buildPreviewFromMessage(pseudo, chatItem, myId);
      this.chats = updateChatPreview(this.chats || [], chatId, preview);
      if (chatItem) chatItem.unreadCount = 0;

      const optimisticMessage: MensajeDTO = {
        id: -(Date.now() + Math.floor(Math.random() * 1000)),
        chatId,
        emisorId: myId,
        receptorId: chatId,
        contenido,
        fechaEnvio: new Date().toISOString(),
        activo: true,
        tipo: 'TEXT',
        reenviado: false,
        leido: true,
        replyToMessageId,
        replySnippet,
        replyAuthorName,
      };
      if (this.chatActual && Number(this.chatActual.id) === chatId) {
        this.mensajesSeleccionados = [...this.mensajesSeleccionados, optimisticMessage];
        this.syncActiveHistoryStateMessages();
        this.scrollAlFinal();
      }

      this.rememberPendingGroupTextSend({
        chatId,
        plainText: contenido,
        replyToMessageId,
        replySnippet,
        replyAuthorName,
        reenviado: false,
        mensajeOriginalId: undefined,
        source: 'compose',
        createdAtMs: Date.now(),
        retryCount: 0,
      });

      await this.logGroupWsPayloadBeforeSend(
        'send-message-group-text',
        mensaje,
        strictValidation.forReceptoresKeys
      );
      this.wsService.enviarMensajeGrupal(mensaje);
      this.mensajeNuevo = '';
      this.cancelarRespuestaMensaje();
      return;
      } finally {
        this.groupTextSendInFlightByChatId.delete(chatId);
      }
    }

    // === INDIVIDUAL (sin cifrado) ===
    const receptorId = this.chatActual?.receptor?.id;
    if (!receptorId) return;

    const sendToExisting = async (chatId: number) => {
      const finalContenido = await this.buildOutgoingE2EContent(
        receptorId,
        contenido
      );

      const mensaje: any = {
        contenido: finalContenido,
        emisorId: myId,
        receptorId,
        activo: true,
        chatId,
        tipo: 'TEXT',
        reenviado: false,
        replyToMessageId,
        replySnippet,
        replyAuthorName,
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
      this.cancelarRespuestaMensaje();
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
        // Si tu API devuelve 409 "ya existe", aqui podrias buscar ese chat y llamar a sendToExisting(foundId)
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
    if (!mensaje.id || mensaje.activo === false) return;
    console.log('[INICIO] eliminarMensaje click', {
      mensajeId: mensaje.id,
      chatId: mensaje.chatId,
      emisorId: mensaje.emisorId,
      receptorId: mensaje.receptorId,
      activo: mensaje.activo,
    });

    const i = this.mensajesSeleccionados.findIndex((m) => m.id === mensaje.id);
    if (i !== -1) {
      this.mensajesSeleccionados = [
        ...this.mensajesSeleccionados.slice(0, i),
        { ...this.mensajesSeleccionados[i], activo: false },
        ...this.mensajesSeleccionados.slice(i + 1),
      ];
    }

    const payloadEliminar: MensajeDTO = {
      id: mensaje.id,
      emisorId: mensaje.emisorId ?? this.usuarioActualId,
      receptorId: mensaje.receptorId ?? this.chatActual?.receptor?.id,
      chatId: mensaje.chatId ?? this.chatActual?.id,
      activo: false,
      tipo: mensaje.tipo ?? 'TEXT',
      // Evitamos reenviar contenido ya transformado en front (p.ej. texto de error de descifrado).
      contenido: '',
    };

    this.wsService.enviarEliminarMensaje(payloadEliminar);
    this.incomingQuickReactionsByMessageId.delete(Number(mensaje.id));
    if (this.openIncomingReactionPickerMessageId === Number(mensaje.id)) {
      this.openIncomingReactionPickerMessageId = null;
    }
    console.log('[INICIO] eliminarMensaje payload enviado', payloadEliminar);
    this.openMensajeMenuId = null;
  }

  public responderMensaje(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!mensaje?.id) return;
    this.mensajeRespuestaObjetivo = mensaje;
    this.openMensajeMenuId = null;
    this.forwardModalOpen = false;
  }

  public cancelarRespuestaMensaje(): void {
    this.mensajeRespuestaObjetivo = null;
  }

  public getReplySnippet(m: MensajeDTO): string {
    const explicit = m?.replySnippet;
    if (explicit) return String(explicit);

    const refId = Number(m?.replyToMessageId || 0);
    if (!refId) return '';
    const ref = this.mensajesSeleccionados.find((x) => Number(x.id) === refId);
    if (!ref) return 'Mensaje respondido';
    if ((ref.tipo || 'TEXT') === 'AUDIO') {
      return 'Mensaje de voz';
    }
    const txt = String(ref.contenido || '').trim();
    return txt.length > 90 ? `${txt.slice(0, 90)}...` : txt;
  }

  public getReplyAuthorLabel(m: MensajeDTO): string {
    if (m?.replyAuthorName) return String(m.replyAuthorName);
    const refId = Number(m?.replyToMessageId || 0);
    if (!refId) return '';
    const ref = this.mensajesSeleccionados.find((x) => Number(x.id) === refId);
    if (!ref) return 'Mensaje original';
    if (Number(ref.emisorId) === Number(this.usuarioActualId)) return 'Tú';
    const nombre =
      `${ref.emisorNombre || ''} ${ref.emisorApellido || ''}`.trim() ||
      this.obtenerNombrePorId(ref.emisorId) ||
      'Usuario';
    return nombre;
  }

  private getComposeReplySnippet(): string | undefined {
    if (!this.mensajeRespuestaObjetivo) return undefined;
    if ((this.mensajeRespuestaObjetivo.tipo || 'TEXT') === 'AUDIO') {
      return 'Mensaje de voz';
    }
    const txt = String(this.mensajeRespuestaObjetivo.contenido || '').trim();
    if (!txt) return 'Mensaje';
    return txt.length > 120 ? `${txt.slice(0, 120)}...` : txt;
  }

  private getComposeReplyAuthorName(): string | undefined {
    const ref = this.mensajeRespuestaObjetivo;
    if (!ref) return undefined;
    if (Number(ref.emisorId) === Number(this.usuarioActualId)) return 'Tú';
    const nombre =
      `${ref.emisorNombre || ''} ${ref.emisorApellido || ''}`.trim() ||
      this.obtenerNombrePorId(ref.emisorId) ||
      'Usuario';
    return nombre;
  }

  public abrirModalReenvio(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.stopPropagation();
    this.openMensajeMenuId = null;
    this.mensajeReenvioOrigen = mensaje;
    this.forwardSelectedChatIds = new Set<number>();
    this.forwardModalOpen = true;
    this.activeMainView = 'chat';
  }

  public cerrarModalReenvio(): void {
    if (this.forwardingInProgress) return;
    this.forwardModalOpen = false;
    this.mensajeReenvioOrigen = null;
    this.forwardSelectedChatIds = new Set<number>();
  }

  public toggleForwardChat(chatId: number, event?: Event): void {
    event?.stopPropagation();
    const id = Number(chatId);
    if (!id) return;
    if (this.forwardSelectedChatIds.has(id)) {
      this.forwardSelectedChatIds.delete(id);
    } else {
      this.forwardSelectedChatIds.add(id);
    }
    this.forwardSelectedChatIds = new Set(this.forwardSelectedChatIds);
  }

  public onChatItemClick(chat: any): void {
    if (this.forwardModalOpen) {
      this.toggleForwardChat(Number(chat?.id));
      return;
    }
    this.mostrarMensajes(chat);
  }

  public isForwardChatSelected(chatId: number): boolean {
    return this.forwardSelectedChatIds.has(Number(chatId));
  }

  public async confirmarReenvioMensaje(): Promise<void> {
    if (!this.mensajeReenvioOrigen || this.forwardingInProgress) return;
    const originalId = Number(this.mensajeReenvioOrigen?.id);
    if (!Number.isFinite(originalId) || originalId <= 0) {
      this.showToast(
        'El mensaje original no tiene id válido para reenviar.',
        'danger',
        'Error'
      );
      return;
    }

    const originalTipo = this.mensajeReenvioOrigen?.tipo || 'TEXT';
    const originalContenido = String(
      this.mensajeReenvioOrigen?.contenido || ''
    ).trim();
    if (
      originalTipo === 'TEXT' &&
      (!originalContenido || this.isNonForwardableTextPlaceholder(originalContenido))
    ) {
      this.showToast(
        'No se puede reenviar: el mensaje original no se pudo descifrar en este dispositivo.',
        'warning',
        'Reenvio no disponible'
      );
      return;
    }

    const ids = Array.from(this.forwardSelectedChatIds.values());
    if (ids.length === 0) {
      this.showToast('Elige al menos un chat destino.', 'warning', 'Aviso');
      return;
    }

    const destinos = this.chats.filter((c) => ids.includes(Number(c?.id)));
    if (!destinos.length) return;

    this.forwardingInProgress = true;
    try {
      let fallos = 0;
      for (const chat of destinos) {
        try {
          await this.enviarMensajeReenviadoAChat(chat, this.mensajeReenvioOrigen);
        } catch (e) {
          fallos += 1;
          console.error('[FORWARD] fallo reenviando a chat', chat, e);
        }
      }

      this.forwardingInProgress = false;
      if (fallos > 0) {
        this.showToast(
          `No se pudo reenviar en ${fallos} ${fallos === 1 ? 'chat' : 'chats'}.`,
          'danger',
          'Error'
        );
        return;
      }
      this.cerrarModalReenvio();
    } finally {
      this.forwardingInProgress = false;
    }
  }

  private buildForwardPreviewText(original: MensajeDTO): string {
    const tipo = original?.tipo || 'TEXT';
    if (tipo === 'AUDIO') {
      const dur = this.formatDur(original?.audioDuracionMs || 0);
      return dur ? `Mensaje de voz (${dur})` : 'Mensaje de voz';
    }
    const txt = String(original?.contenido || '').trim();
    return `Reenviado: ${txt}`.trim();
  }

  private isNonForwardableTextPlaceholder(text: string): boolean {
    const normalized = String(text || '').trim();
    if (!normalized) return true;
    return (
      normalized === '[Mensaje Cifrado]' ||
      normalized.startsWith('[Mensaje Cifrado -') ||
      normalized === '[Error de descifrado E2E]' ||
      normalized === '[Mensaje legado no auditable]' ||
      normalized === 'NO_AUDITABLE'
    );
  }

  private isEncryptedHiddenPlaceholder(text: string): boolean {
    const normalized = String(text || '').trim();
    if (!normalized) return false;
    return (
      normalized === '[Mensaje Cifrado]' ||
      normalized.startsWith('[Mensaje Cifrado -') ||
      normalized === '[Error de descifrado E2E]'
    );
  }

  private containsEncryptedHiddenPlaceholder(text: string): boolean {
    const normalized = String(text || '').trim();
    if (!normalized) return false;
    if (this.isEncryptedHiddenPlaceholder(normalized)) return true;
    const withoutPrefix = normalized.replace(/^[^:]{1,80}:\s*/, '').trim();
    return this.isEncryptedHiddenPlaceholder(withoutPrefix);
  }

  private async enviarMensajeReenviadoAChat(
    chatDestino: any,
    original: MensajeDTO
  ): Promise<void> {
    const chatId = Number(chatDestino?.id);
    if (!chatId) throw new Error('CHAT_DESTINO_INVALIDO');

    const tipo = original?.tipo || 'TEXT';
    const contenidoPlano = String(original?.contenido || '').trim();
    if (
      tipo === 'TEXT' &&
      (!contenidoPlano || this.isNonForwardableTextPlaceholder(contenidoPlano))
    ) {
      throw new Error('FORWARD_SOURCE_NOT_DECRYPTED');
    }
    const emisorId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const previewTexto = this.buildForwardPreviewText(original);
    this.chats = updateChatPreview(this.chats || [], chatId, previewTexto);
    const item = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
    if (item) item.unreadCount = 0;

    if (chatDestino?.esGrupo) {
      let encryptedGroupContent = '';
      let encryptedGroupExpectedRecipientCount = 0;
      let encryptedGroupExpectedRecipientIds: number[] = [];
      if (tipo === 'TEXT') {
        try {
          const built = await this.buildOutgoingE2EContentForGroup(
            chatDestino,
            contenidoPlano
          );
          encryptedGroupContent = built.content;
          encryptedGroupExpectedRecipientCount = built.expectedRecipientCount;
          encryptedGroupExpectedRecipientIds = built.expectedRecipientIds;
        } catch (err: any) {
          console.warn('[E2E][group-forward-blocked]', {
            chatId,
            emisorId: Number(emisorId),
            reason: err?.message || String(err),
          });
          throw new Error('GROUP_E2E_ENCRYPT_FAILED');
        }
      }
      const payloadGrupal: MensajeDTO = {
        contenido: tipo === 'TEXT' ? encryptedGroupContent : '',
        emisorId,
        receptorId: chatId,
        chatId,
        activo: true,
        tipo,
        reenviado: true,
        mensajeOriginalId: Number(original?.id),
        audioUrl: original?.audioUrl || null,
        audioMime: original?.audioMime || null,
        audioDuracionMs: original?.audioDuracionMs ?? null,
      };
      if (tipo === 'TEXT') {
        const strictValidation = this.validateOutgoingGroupPayloadStrict(
          payloadGrupal.contenido,
          encryptedGroupExpectedRecipientIds
        );
        if (!strictValidation.ok) {
          console.warn('[E2E][group-forward-blocked-strict-validation]', {
            chatId,
            emisorId: Number(emisorId),
            code: strictValidation.code,
            reason: strictValidation.reason,
            expectedRecipientCount: encryptedGroupExpectedRecipientCount,
            expectedRecipientIds: encryptedGroupExpectedRecipientIds,
            payloadForReceptoresKeys: strictValidation.forReceptoresKeys,
          });
          throw new Error('GROUP_E2E_STRICT_VALIDATION_FAILED');
        }
        this.rememberPendingGroupTextSend({
          chatId,
          plainText: contenidoPlano,
          reenviado: true,
          mensajeOriginalId: Number(original?.id),
          source: 'forward',
          createdAtMs: Date.now(),
          retryCount: 0,
        });
        await this.logGroupWsPayloadBeforeSend(
          'forward-group-text',
          payloadGrupal,
          strictValidation.forReceptoresKeys
        );
      }
      this.wsService.enviarMensajeGrupal(payloadGrupal);
      return;
    }

    const receptorId = Number(chatDestino?.receptor?.id);
    if (!receptorId) throw new Error('RECEPTOR_INVALIDO');

    const contenidoFinal =
      tipo === 'TEXT'
        ? await this.buildOutgoingE2EContent(receptorId, contenidoPlano)
        : '';

    const payloadIndividual: MensajeDTO = {
      contenido: contenidoFinal,
      emisorId,
      receptorId,
      chatId,
      activo: true,
      tipo,
      reenviado: true,
      mensajeOriginalId: Number(original?.id),
      audioUrl: original?.audioUrl || null,
      audioMime: original?.audioMime || null,
      audioDuracionMs: original?.audioDuracionMs ?? null,
    };
    this.wsService.enviarMensajeIndividual(payloadIndividual);
  }

  private showToast(
    message: string,
    variant: ToastVariant = 'info',
    title?: string,
    ms = 3500
  ): void {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: ToastItem = { id, message, title, variant };
    this.toasts = [...this.toasts, toast];
    toast.timeout = setTimeout(() => this.dismissToast(id), ms);
  }

  public dismissToast(id: number): void {
    const t = this.toasts.find((x) => x.id === id);
    if (t?.timeout) clearTimeout(t.timeout);
    this.toasts = this.toasts.filter((x) => x.id !== id);
  }

  public toggleMensajeMenu(mensaje: MensajeDTO, event: MouseEvent): void {
    event.stopPropagation();
    const id = Number(mensaje.id);
    if (!id) return;
    this.openMensajeMenuId = this.openMensajeMenuId === id ? null : id;
  }

  public canToggleIncomingQuickReaction(mensaje: MensajeDTO): boolean {
    if (!mensaje || mensaje.activo === false) return false;
    if (Number(mensaje.emisorId) === Number(this.usuarioActualId)) return false;
    const id = Number(mensaje.id);
    return Number.isFinite(id) && id > 0;
  }

  public toggleIncomingReactionPicker(
    mensaje: MensajeDTO,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canToggleIncomingQuickReaction(mensaje)) return;

    const id = Number(mensaje.id);
    this.openIncomingReactionPickerMessageId =
      this.openIncomingReactionPickerMessageId === id ? null : id;
    this.cdr.markForCheck();
  }

  public isIncomingReactionPickerOpen(mensaje: MensajeDTO): boolean {
    const id = Number(mensaje?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    return this.openIncomingReactionPickerMessageId === id;
  }

  public applyIncomingQuickReaction(
    mensaje: MensajeDTO,
    emoji: string,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canToggleIncomingQuickReaction(mensaje)) return;

    const selected = String(emoji || '').trim();
    if (!selected || !this.incomingReactionChoicesSet.has(selected)) return;

    const id = Number(mensaje.id);
    const prev = String(this.incomingQuickReactionsByMessageId.get(id) || '');
    const next = prev === selected ? '' : selected;

    this.setIncomingQuickReactionByMessageId(id, next || null);
    this.emitOutgoingReactionEvent(mensaje, next || null);
    this.openIncomingReactionPickerMessageId = null;
    this.cdr.markForCheck();
  }

  public incomingQuickReaction(mensaje: MensajeDTO): string {
    const id = Number(mensaje.id);
    if (!Number.isFinite(id) || id <= 0) return '';
    return String(this.incomingQuickReactionsByMessageId.get(id) || '');
  }

  private setIncomingQuickReactionByMessageId(
    messageId: number,
    emoji: string | null
  ): void {
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) return;
    const clean = String(emoji || '').trim();
    if (!clean) {
      this.incomingQuickReactionsByMessageId.delete(id);
      return;
    }
    this.incomingQuickReactionsByMessageId.set(id, clean);
  }

  private emitOutgoingReactionEvent(
    mensaje: MensajeDTO,
    emoji: string | null
  ): void {
    if (!mensaje) return;
    const messageId = Number(mensaje.id);
    const chatId = Number(mensaje.chatId ?? this.chatActual?.id);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    const esGrupo = !!this.chatActual?.esGrupo;
    const targetUserId = esGrupo ? null : Number(mensaje.emisorId || 0);
    const payload: MensajeReaccionDTO = {
      event: 'MESSAGE_REACTION',
      messageId,
      chatId,
      esGrupo,
      reactorUserId: Number(this.usuarioActualId),
      targetUserId:
        targetUserId !== null && Number.isFinite(targetUserId) && targetUserId > 0
          ? targetUserId
          : null,
      emoji: String(emoji || '').trim() || null,
      action: String(emoji || '').trim() ? 'SET' : 'REMOVE',
      createdAt: new Date().toISOString(),
    };

    this.wsService.enviarReaccionMensaje(payload);
  }

  private isMessageReactionEvent(payload: any): payload is MensajeReaccionDTO {
    return !!this.normalizeMessageReactionEvent(payload);
  }

  private normalizeMessageReactionEvent(payload: any): MensajeReaccionDTO | null {
    if (!payload || typeof payload !== 'object') return null;

    const eventRaw = String(payload?.event || payload?.type || '').trim().toUpperCase();
    const isReactionEvent =
      eventRaw === 'MESSAGE_REACTION' || eventRaw === 'REACTION';
    if (!isReactionEvent) return null;

    const messageId = Number(payload?.messageId ?? payload?.mensajeId);
    const chatId = Number(payload?.chatId ?? payload?.conversationId);
    const reactorUserId = Number(payload?.reactorUserId ?? payload?.userId ?? payload?.emisorId);
    if (!Number.isFinite(messageId) || messageId <= 0) return null;
    if (!Number.isFinite(chatId) || chatId <= 0) return null;
    if (!Number.isFinite(reactorUserId) || reactorUserId <= 0) return null;

    const emoji = String(payload?.emoji ?? payload?.reaction ?? '').trim();
    const actionRaw = String(payload?.action || '').trim().toUpperCase();
    const action: 'SET' | 'REMOVE' =
      actionRaw === 'REMOVE' || !emoji ? 'REMOVE' : 'SET';

    return {
      event: 'MESSAGE_REACTION',
      messageId,
      chatId,
      esGrupo:
        payload?.esGrupo === true ||
        String(payload?.esGrupo || '').toLowerCase() === 'true' ||
        !!payload?.isGroup,
      reactorUserId,
      targetUserId: Number(payload?.targetUserId ?? payload?.receptorId ?? 0) || null,
      emoji: action === 'SET' ? emoji : null,
      action,
      createdAt: String(payload?.createdAt ?? payload?.fecha ?? '').trim() || undefined,
    };
  }

  private applyIncomingReactionEvent(raw: any, source: string): void {
    const event = this.normalizeMessageReactionEvent(raw);
    if (!event) return;

    if (event.action === 'REMOVE') {
      this.setIncomingQuickReactionByMessageId(event.messageId, null);
    } else {
      const emoji = String(event.emoji || '').trim();
      if (!emoji) return;
      this.setIncomingQuickReactionByMessageId(event.messageId, emoji);
    }

    if (this.openIncomingReactionPickerMessageId === Number(event.messageId)) {
      this.openIncomingReactionPickerMessageId = null;
    }

    console.log('[REACTION] event aplicado', {
      source,
      messageId: event.messageId,
      chatId: event.chatId,
      emoji: event.emoji,
      action: event.action,
      reactorUserId: event.reactorUserId,
    });
    this.cdr.markForCheck();
  }

  private seedIncomingReactionsFromMessages(messages: MensajeDTO[]): void {
    if (!Array.isArray(messages) || messages.length === 0) return;
    for (const m of messages) {
      const id = Number(m?.id);
      if (!Number.isFinite(id) || id <= 0) continue;

      const directEmoji = String(
        m?.reaccionEmoji ??
          m?.reactionEmoji ??
          ''
      ).trim();
      if (directEmoji) {
        this.setIncomingQuickReactionByMessageId(id, directEmoji);
        continue;
      }

      const reactions = Array.isArray(m?.reacciones) ? m.reacciones : [];
      if (!reactions.length) continue;
      const last = reactions[reactions.length - 1] || {};
      const emoji = String(last?.emoji ?? last?.reaction ?? '').trim();
      if (emoji) {
        this.setIncomingQuickReactionByMessageId(id, emoji);
      }
    }
  }

  @HostListener('document:click', ['$event'])
  public closeMensajeMenuOnOutsideClick(event: MouseEvent): void {
    this.openMensajeMenuId = null;
    this.showTopbarProfileMenu = false;
    const target = event?.target as Node | null;
    const targetEl = target instanceof Element ? target : null;

    if (this.openIncomingReactionPickerMessageId !== null) {
      const insideReactionUi = !!targetEl?.closest('.msg-reaction-box');
      if (!insideReactionUi) {
        this.openIncomingReactionPickerMessageId = null;
      }
    }

    if (this.showEmojiPicker) {
      const emojiAnchor = this.emojiAnchorRef?.nativeElement;
      if (!target || !emojiAnchor || !emojiAnchor.contains(target)) {
        this.closeEmojiPicker();
      }
    }

    if (!this.panelNotificacionesAbierto) return;
    const notifWrapper = this.notifWrapperRef?.nativeElement;
    if (!target || !notifWrapper) {
      this.panelNotificacionesAbierto = false;
      return;
    }
    if (!notifWrapper.contains(target)) {
      this.panelNotificacionesAbierto = false;
    }
  }

  public toggleTopbarProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showTopbarProfileMenu = !this.showTopbarProfileMenu;
  }

  public openProfileView(event?: MouseEvent): void {
    event?.stopPropagation();
    this.showTopbarProfileMenu = false;
    this.activeMainView = 'profile';
  }

  public closeProfileView(): void {
    this.showTopbarProfileMenu = false;
    this.activeMainView = 'chat';
  }

  public get usuarioIniciales(): string {
    const nombre = (this.perfilUsuario?.nombre || '').trim();
    const apellido = (this.perfilUsuario?.apellido || '').trim();
    if (!nombre && !apellido) return 'US';
    if (!apellido) return nombre.slice(0, 2).toUpperCase();
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  }

  public onPerfilSave(payload: PerfilUsuarioSavePayload): void {
    const hasPasswordAttempt =
      !!payload.passwordActual ||
      !!payload.nuevaPassword ||
      !!payload.repetirNuevaPassword;
    const hasProfileChanges = this.hasProfileDataChanges(payload);

    if (hasPasswordAttempt && !hasProfileChanges) {
      if (
        !payload.passwordActual ||
        !payload.nuevaPassword ||
        !payload.repetirNuevaPassword
      ) {
        Swal.fire(
          'Campos incompletos',
          'Para cambiar contraseña debes rellenar los 3 campos.',
          'warning'
        );
        return;
      }
      if (payload.nuevaPassword !== payload.repetirNuevaPassword) {
        Swal.fire(
          'Error',
          'La nueva contraseña y su repetición no coinciden.',
          'error'
        );
        return;
      }

      if (this.profilePasswordCodeRequested && this.profileCodeTimeLeftSec > 0) {
        Swal.fire(
          'Código ya enviado',
          `Debes esperar ${this.formatCodeTime(this.profileCodeTimeLeftSec)} para reenviar otro código.`,
          'info'
        );
        return;
      }

      this.profileSaving = true;
      this.authService.solicitarCodigoCambioPasswordPerfil().subscribe({
        next: (res) => {
          this.profileSaving = false;
          this.profilePasswordCodeRequested = true;
          this.startProfileCodeCountdown(300);
          Swal.fire(
            'Código enviado',
            res?.mensaje ||
              'Te hemos enviado un código de verificación por email (expira en 5 minutos).',
            'success'
          );
        },
        error: (err) => {
          this.profileSaving = false;
          Swal.fire(
            'Error',
            err?.error?.mensaje ||
              'No se pudo enviar el código de verificación.',
            'error'
          );
        },
      });
      return;
    }

    const updatePayload = {
      nombre: payload.nombre,
      apellido: payload.apellido,
      foto: payload.foto || '',
    };
    const emailActual = (this.perfilUsuario?.email || '').trim();
    const emailNuevo = (payload.email || '').trim();
    if (emailNuevo && emailNuevo !== emailActual) {
      Swal.fire(
        'Aviso',
        'El endpoint actual de perfil no permite actualizar el email. Se guardarán nombre, apellidos y foto.',
        'info'
      );
    }

    this.profileSaving = true;
    this.authService.actualizarPerfil(updatePayload).subscribe({
      next: (updated) => {
        this.profileSaving = false;
        this.perfilUsuario = {
          ...(this.perfilUsuario || {}),
          ...(updated || {}),
          nombre: updated?.nombre ?? updatePayload.nombre,
          apellido: updated?.apellido ?? updatePayload.apellido,
          foto: updated?.foto ?? updatePayload.foto,
        } as UsuarioDTO;

        const fotoActualizada = resolveMediaUrl(
          this.perfilUsuario?.foto || updatePayload.foto,
          environment.backendBaseUrl
        );
        this.usuarioFotoUrl = this.normalizeOwnProfilePhoto(fotoActualizada);
        if (this.perfilUsuario?.foto)
          localStorage.setItem('usuarioFoto', this.perfilUsuario.foto);
        else localStorage.removeItem('usuarioFoto');

        Swal.fire(
          'Perfil actualizado',
          'Tus datos de perfil se han actualizado correctamente.',
          'success'
        );
      },
      error: (err) => {
        this.profileSaving = false;
        Swal.fire(
          'Error',
          err?.error?.mensaje || 'No se pudo actualizar el perfil.',
          'error'
        );
      },
    });
  }

  public onPerfilConfirmPassword(payload: PerfilUsuarioSavePayload): void {
    if (
      !payload.verificationCode ||
      !payload.nuevaPassword ||
      !payload.repetirNuevaPassword
    ) {
      Swal.fire(
        'Faltan datos',
        'Introduce código y nueva contraseña para continuar.',
        'warning'
      );
      return;
    }
    if (payload.nuevaPassword !== payload.repetirNuevaPassword) {
      Swal.fire(
        'Error',
        'La nueva contraseña y su repetición no coinciden.',
        'error'
      );
      return;
    }

    this.profileSaving = true;
    this.authService
      .cambiarPasswordPerfil(payload.verificationCode, payload.nuevaPassword)
      .subscribe({
        next: (res) => {
          this.profileSaving = false;
          this.profilePasswordCodeRequested = false;
          this.stopProfileCodeCountdown();
          Swal.fire(
            'Contraseña actualizada',
            res?.mensaje || 'Contraseña actualizada correctamente.',
            'success'
          );
        },
        error: (err) => {
          this.profileSaving = false;
          Swal.fire(
            'Error',
            err?.error?.mensaje || 'No se pudo actualizar la contraseña.',
            'error'
          );
        },
      });
  }

  private hasProfileDataChanges(payload: PerfilUsuarioSavePayload): boolean {
    const nombreActual = (this.perfilUsuario?.nombre || '').trim();
    const apellidoActual = (this.perfilUsuario?.apellido || '').trim();
    const fotoActual = (this.usuarioFotoUrl || this.perfilUsuario?.foto || '').trim();

    return (
      (payload.nombre || '').trim() !== nombreActual ||
      (payload.apellido || '').trim() !== apellidoActual ||
      (payload.foto || '').trim() !== fotoActual
    );
  }

  private startProfileCodeCountdown(seconds: number): void {
    this.stopProfileCodeCountdown();
    this.profileCodeTimeLeftSec = Math.max(0, Number(seconds || 0));
    this.profileCodeTimer = setInterval(() => {
      this.profileCodeTimeLeftSec = Math.max(0, this.profileCodeTimeLeftSec - 1);
      if (this.profileCodeTimeLeftSec <= 0) {
        this.stopProfileCodeCountdown();
      }
      this.cdr.markForCheck();
    }, 1000);
    this.cdr.markForCheck();
  }

  private stopProfileCodeCountdown(): void {
    if (this.profileCodeTimer) {
      clearInterval(this.profileCodeTimer);
      this.profileCodeTimer = undefined;
    }
    this.profileCodeTimeLeftSec = 0;
    this.cdr.markForCheck();
  }

  private formatCodeTime(seconds: number): string {
    const total = Math.max(0, Number(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  public logoutFromTopbar(event?: MouseEvent): void {
    event?.stopPropagation();
    this.showTopbarProfileMenu = false;
    this.sessionService.logout({
      clearE2EKeys: false,
      clearAuditKeys: false,
      broadcast: true,
      reason: 'topbar',
    });
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
    const inviteId = this.getNormalizedInviteId(inv);
    if (!Number.isFinite(inviteId) || inviteId <= 0) {
      console.error('Error aceptar invitación: inviteId inválido', inv);
      return;
    }

    this.groupInviteService
      .accept(inviteId, this.usuarioActualId)
      .subscribe({
        next: () => {
          this.addHandledInviteId(inviteId); // ⬅️ marca tratada
          this.notifInvites = this.notifInvites.filter(
            (n) => this.getNormalizedInviteId(n) !== inviteId
          );
          this.panelNotificacionesAbierto = false;
          this.listarTodosLosChats();
          this.cdr.markForCheck();
        },
        error: (e) => {
          const status = Number(e?.status || 0);
          if (status === 403) {
            this.showToast(
              'No tienes permiso para aceptar esta invitacion.',
              'warning',
              'Invitacion'
            );
            return;
          }
          // Si el backend ya la tenia procesada, la ocultamos igualmente.
          if (status === 400 || status === 404 || status === 409) {
            this.addHandledInviteId(inviteId);
            this.notifInvites = this.notifInvites.filter(
              (n) => this.getNormalizedInviteId(n) !== inviteId
            );
            this.panelNotificacionesAbierto = false;
            this.showToast(
              'La invitacion ya no esta disponible.',
              'info',
              'Invitacion'
            );
            this.cdr.markForCheck();
            return;
          }
          console.error('Error aceptar invitación:', e);
          this.showToast(
            'No se pudo aceptar la invitacion. Intentalo de nuevo.',
            'danger',
            'Invitacion'
          );
        },
      });
  }

  /**
   * Rechaza una invitación a un grupo.
   */
  public rechazarInvitacion(inv: GroupInviteWS): void {
    const inviteId = this.getNormalizedInviteId(inv);
    if (!Number.isFinite(inviteId) || inviteId <= 0) {
      console.error('Error rechazar invitación: inviteId inválido', inv);
      return;
    }

    this.groupInviteService
      .decline(inviteId, this.usuarioActualId)
      .subscribe({
        next: () => {
          this.addHandledInviteId(inviteId); // ⬅️ marca tratada
          this.notifInvites = this.notifInvites.filter(
            (n) => this.getNormalizedInviteId(n) !== inviteId
          );
          this.panelNotificacionesAbierto = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          const status = Number(e?.status || 0);
          if (status === 403) {
            this.showToast(
              'No tienes permiso para rechazar esta invitacion.',
              'warning',
              'Invitacion'
            );
            return;
          }
          if (status === 400 || status === 404 || status === 409) {
            this.addHandledInviteId(inviteId);
            this.notifInvites = this.notifInvites.filter(
              (n) => this.getNormalizedInviteId(n) !== inviteId
            );
            this.panelNotificacionesAbierto = false;
            this.showToast(
              'La invitacion ya no esta disponible.',
              'info',
              'Invitacion'
            );
            this.cdr.markForCheck();
            return;
          }
          console.error('Error rechazar invitación:', e);
          this.showToast(
            'No se pudo rechazar la invitacion. Intentalo de nuevo.',
            'danger',
            'Invitacion'
          );
        },
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
    if (chat?.esGrupo && this.containsEncryptedHiddenPlaceholder(chat?.ultimaMensaje)) {
      return this.GROUP_HISTORY_UNAVAILABLE_TEXT;
    }
    const normalized = this.normalizeOwnPreviewPrefix(
      chat?.ultimaMensaje || '',
      chat
    );
    return formatPreviewText(normalized);
  }

  private normalizeLastMessageTipo(raw: unknown): string {
    const tipo = String(raw || '').trim().toUpperCase();
    return tipo;
  }

  private toLastMessageTipoDTO(raw: unknown): ChatListItemDTO['ultimaMensajeTipo'] {
    const tipo = this.normalizeLastMessageTipo(raw);
    if (
      tipo === 'TEXT' ||
      tipo === 'AUDIO' ||
      tipo === 'IMAGE' ||
      tipo === 'VIDEO' ||
      tipo === 'FILE' ||
      tipo === 'SYSTEM'
    ) {
      return tipo;
    }
    return null;
  }

  private inferLastMessageTipoFromRaw(raw: unknown): string {
    const text = String(raw || '').trim();
    if (!text) return '';
    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch {
      return '';
    }
    const payloadType = String(payload?.type || '').trim().toUpperCase();
    if (payloadType === 'E2E_IMAGE' || payloadType === 'E2E_GROUP_IMAGE') {
      return 'IMAGE';
    }
    if (payloadType === 'E2E_AUDIO' || payloadType === 'E2E_GROUP_AUDIO') {
      return 'AUDIO';
    }
    if (payloadType === 'E2E' || payloadType === 'E2E_GROUP') {
      return 'TEXT';
    }
    return '';
  }

  private getAudioPreviewLabelFromSender(chat: any): string {
    const senderId = this.getChatLastPreviewSenderId(chat);
    if (senderId && senderId === Number(this.usuarioActualId)) return 'Tú';
    return '';
  }

  private stampChatLastMessageFieldsFromMessage(chat: any, mensaje: any): void {
    if (!chat || !mensaje) return;

    const tipo = this.normalizeLastMessageTipo(mensaje?.tipo);
    const mensajeId = Number(mensaje?.id);
    if (Number.isFinite(mensajeId) && mensajeId > 0) {
      chat.ultimaMensajeId = mensajeId;
      chat.lastPreviewId = mensajeId;
    }

    if (tipo) {
      chat.ultimaMensajeTipo = tipo;
      chat.__ultimaTipo = tipo;
    }

    const emisorId = Number(mensaje?.emisorId);
    if (Number.isFinite(emisorId) && emisorId > 0) {
      chat.ultimaMensajeEmisorId = emisorId;
    }

    if (typeof mensaje?.contenido === 'string') {
      chat.ultimaMensajeRaw = mensaje.contenido;
      chat.__ultimaMensajeRaw = mensaje.contenido;
    } else if (mensaje?.contenido && typeof mensaje.contenido === 'object') {
      const rawObj = JSON.stringify(mensaje.contenido);
      chat.ultimaMensajeRaw = rawObj;
      chat.__ultimaMensajeRaw = rawObj;
    }

    if (tipo === 'IMAGE') {
      chat.ultimaMensajeImageUrl = String(mensaje?.imageUrl || '').trim() || null;
      chat.ultimaMensajeImageMime = String(mensaje?.imageMime || '').trim() || null;
      chat.ultimaMensajeImageNombre =
        String(mensaje?.imageNombre || '').trim() || null;
      chat.ultimaMensajeAudioUrl = null;
      chat.ultimaMensajeAudioMime = null;
      chat.ultimaMensajeAudioDuracionMs = null;
      return;
    }

    if (tipo === 'AUDIO') {
      chat.ultimaMensajeAudioUrl = String(mensaje?.audioUrl || '').trim() || null;
      chat.ultimaMensajeAudioMime = String(mensaje?.audioMime || '').trim() || null;
      const dur = Number(mensaje?.audioDuracionMs);
      chat.ultimaMensajeAudioDuracionMs =
        Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null;
      chat.ultimaMensajeImageUrl = null;
      chat.ultimaMensajeImageMime = null;
      chat.ultimaMensajeImageNombre = null;
      return;
    }

    chat.ultimaMensajeImageUrl = null;
    chat.ultimaMensajeImageMime = null;
    chat.ultimaMensajeImageNombre = null;
    chat.ultimaMensajeAudioUrl = null;
    chat.ultimaMensajeAudioMime = null;
    chat.ultimaMensajeAudioDuracionMs = null;
  }

  public formatearPreviewImagen(chat: any): string {
    const normalized = this.normalizeOwnPreviewPrefix(
      chat?.ultimaMensaje || '',
      chat
    );
    const formatted = formatPreviewText(normalized).trim();
    if (!formatted) return 'Imagen';

    const withPrefix = formatted.match(/^([^:]{1,80}:\s*)([\s\S]*)$/);
    const prefix = withPrefix?.[1] || '';
    const body = (withPrefix?.[2] || formatted).trim();
    if (this.looksLikeE2EImagePayloadFragment(body)) {
      return `${prefix}Imagen`.trim();
    }
    const bodyWithoutImageLabel = body.replace(/^imagen:\s*/i, '').trim();

    if (bodyWithoutImageLabel) {
      return `${prefix}${bodyWithoutImageLabel}`.trim();
    }
    return `${prefix}Imagen`.trim();
  }

  public imagePreviewSenderLabel(chat: any): string {
    const senderId = this.getChatLastPreviewSenderId(chat);
    if (senderId && senderId === Number(this.usuarioActualId)) return 'Tú';

    const normalized = this.normalizeOwnPreviewPrefix(
      String(chat?.ultimaMensaje || ''),
      chat
    );
    const formatted = formatPreviewText(normalized).trim();
    const pref = /^([^:]{1,80}):\s*/.exec(formatted);
    const label = String(pref?.[1] || '').trim();
    if (label) {
      if (/^(yo|t[uú])$/i.test(label)) return 'Tú';
      return label;
    }

    if (!chat?.esGrupo) {
      const otherName = String(chat?.receptor?.nombre || chat?.nombre || '').trim();
      if (otherName) return otherName;
    }
    return '';
  }

  public imagePreviewCaption(chat: any): string {
    const normalized = this.normalizeOwnPreviewPrefix(
      String(chat?.ultimaMensaje || ''),
      chat
    );
    const formatted = formatPreviewText(normalized).trim();
    if (!formatted) return '';

    const body = formatted.replace(/^[^:]{1,80}:\s*/, '').trim();
    if (!body) return '';
    if (this.looksLikeE2EImagePayloadFragment(body)) return '';
    if (/^imagen$/i.test(body)) return '';

    const withoutImageLabel = body.replace(/^imagen\s*:\s*/i, '').trim();
    if (!withoutImageLabel || /^imagen$/i.test(withoutImageLabel)) return '';
    return withoutImageLabel;
  }

  private normalizeOwnPreviewPrefix(preview: string, chat: any): string {
    if (!preview) return preview;
    if (chat?.esGrupo) {
      return this.normalizeOwnGroupPreviewPrefix(preview, chat);
    }
    return this.normalizeOwnIndividualPreviewPrefix(preview, chat);
  }

  private normalizeOwnIndividualPreviewPrefix(preview: string, chat: any): string {
    if (!preview || chat?.esGrupo) return preview;
    const senderId = this.getChatLastPreviewSenderId(chat);
    if (!senderId || senderId !== Number(this.usuarioActualId)) return preview;

    let txt = String(preview);
    if (/^(t[uú]|yo)\s*:/i.test(txt)) {
      return txt.replace(/^(t[uú]|yo)\s*:\s*/i, 'Tú: ');
    }
    if (/^[^:]{1,50}:\s*/.test(txt)) {
      return txt.replace(/^[^:]{1,50}:\s*/, 'Tú: ');
    }
    return `Tú: ${txt}`;
  }

  private normalizeOwnGroupPreviewPrefix(preview: string, chat: any): string {
    if (!chat?.esGrupo || !preview) return preview;
    const senderId = Number(
      chat?.ultimaMensajeEmisorId ??
        chat?.ultimoMensajeEmisorId ??
        chat?.lastMessageSenderId ??
        chat?.lastSenderId
    );
    if (Number.isFinite(senderId) && senderId === Number(this.usuarioActualId)) {
      return String(preview).replace(/^[^:]{1,50}:\s*/, 'yo: ');
    }

    const myName = (this.perfilUsuario?.nombre || '').trim();
    const myLast = (this.perfilUsuario?.apellido || '').trim();
    if (!myName) return preview;

    const escapedMyName = myName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedMyLast = myLast.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fullNameRegex = myLast
      ? new RegExp(`^${escapedMyName}\\s+${escapedMyLast}:\\s*`, 'i')
      : null;
    const firstNameRegex = new RegExp(`^${escapedMyName}:\\s*`, 'i');

    let txt = String(preview);
    if (fullNameRegex && fullNameRegex.test(txt)) {
      return txt.replace(fullNameRegex, 'yo: ');
    }
    if (firstNameRegex.test(txt)) {
      return txt.replace(firstNameRegex, 'yo: ');
    }
    return txt;
  }

  public toggleGroupInfoPanel(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.haSalidoDelGrupo) return;
    if (this.showGroupInfoPanel) {
      this.closeGroupInfoPanel();
      return;
    }
    this.closeMessageSearchPanel();

    if (this.groupInfoCloseTimer) {
      clearTimeout(this.groupInfoCloseTimer);
      this.groupInfoCloseTimer = null;
    }
    this.showGroupInfoPanelMounted = true;
    setTimeout(() => {
      this.showGroupInfoPanel = true;
    }, 10);
  }

  public closeGroupInfoPanel(): void {
    this.showGroupInfoPanel = false;
    if (this.groupInfoCloseTimer) clearTimeout(this.groupInfoCloseTimer);
    this.groupInfoCloseTimer = setTimeout(() => {
      if (!this.showGroupInfoPanel) {
        this.showGroupInfoPanelMounted = false;
      }
      this.groupInfoCloseTimer = null;
    }, 230);
  }

  public toggleMessageSearchPanel(event?: MouseEvent): void {
    event?.stopPropagation();
    this.mostrarMenuOpciones = false;
    if (!this.chatActual) return;
    if (this.showMessageSearchPanel) {
      this.closeMessageSearchPanel();
      return;
    }

    this.closeGroupInfoPanel();
    if (this.messageSearchCloseTimer) {
      clearTimeout(this.messageSearchCloseTimer);
      this.messageSearchCloseTimer = null;
    }
    this.showMessageSearchPanelMounted = true;
    setTimeout(() => {
      this.showMessageSearchPanel = true;
    }, 10);
  }

  public closeMessageSearchPanel(): void {
    this.showMessageSearchPanel = false;
    if (this.messageSearchCloseTimer) {
      clearTimeout(this.messageSearchCloseTimer);
    }
    this.messageSearchCloseTimer = setTimeout(() => {
      if (!this.showMessageSearchPanel) {
        this.showMessageSearchPanelMounted = false;
      }
      this.messageSearchCloseTimer = null;
    }, 230);
  }

  public async onMessageSearchResultSelect(messageId: number): Promise<void> {
    const targetId = Number(messageId);
    if (!Number.isFinite(targetId) || targetId <= 0) return;
    if (!this.chatActual || this.messageSearchNavigationInFlight) return;

    this.messageSearchNavigationInFlight = true;
    try {
      const loaded = await this.ensureMessageLoadedForSearchNavigation(targetId);
      if (!loaded) {
        this.showToast(
          'No se encontro el mensaje dentro del historial disponible.',
          'warning',
          'Buscar'
        );
        return;
      }

      this.closeMessageSearchPanel();
      const focused = await this.focusMessageInViewport(targetId);
      if (!focused) {
        this.showToast(
          'El mensaje fue encontrado pero no se pudo centrar en pantalla.',
          'warning',
          'Buscar'
        );
      }
    } finally {
      this.messageSearchNavigationInFlight = false;
    }
  }

  public onLeaveGroupFromInfoPanel(): void {
    this.closeGroupInfoPanel();
    this.salirDelGrupo();
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
    const list = Array.isArray(this.chatActual.usuarios)
      ? this.chatActual.usuarios
      : [];
    const exists = list.some((x: any) => Number(x?.id) === Number(u.id));
    if (!exists) {
      this.chatActual.usuarios = [
        ...list,
        { id: u.id, nombre: u.nombre, apellido: u.apellido, foto: null },
      ];
    }
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
    const seedIds = Array.from(
      new Set(
        (dto.usuarios || [])
          .map((u) => Number((u as any)?.id))
          .filter(
            (id) =>
              Number.isFinite(id) &&
              id > 0 &&
              id !== Number(this.usuarioActualId)
          )
      )
    );

    this.chatService.crearChatGrupal(dto as any).subscribe({
      next: (created: any) => {
        const createdGroupId = Number(
          created?.id ?? created?.groupId ?? created?.chatId
        );
        if (Number.isFinite(createdGroupId) && createdGroupId > 0) {
          this.groupRecipientSeedByChatId.set(createdGroupId, seedIds);
          console.log('[E2E][group-create-seed-set]', {
            source: 'crearGrupo',
            createdGroupId,
            seedIds,
          });
        } else {
          console.warn('[E2E][group-create-seed-missing-group-id]', {
            source: 'crearGrupo',
            createdPayload: created,
            seedIds,
          });
        }
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
    const seedIds = Array.from(
      new Set(
        (dto?.usuarios || [])
          .map((u) => Number((u as any)?.id))
          .filter(
            (id) =>
              Number.isFinite(id) &&
              id > 0 &&
              id !== Number(this.usuarioActualId)
          )
      )
    );
    this.chatService.crearChatGrupal(dto as any).subscribe({
      next: (created: any) => {
        const createdGroupId = Number(
          created?.id ?? created?.groupId ?? created?.chatId
        );
        if (Number.isFinite(createdGroupId) && createdGroupId > 0) {
          this.groupRecipientSeedByChatId.set(createdGroupId, seedIds);
          console.log('[E2E][group-create-seed-set]', {
            source: 'onCrearGrupo',
            createdGroupId,
            seedIds,
          });
        } else {
          console.warn('[E2E][group-create-seed-missing-group-id]', {
            source: 'onCrearGrupo',
            createdPayload: created,
            seedIds,
          });
        }
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

  private getMensajeFecha(m: MensajeDTO): Date | null {
    const raw =
      (m as any)?.fechaEnvio || (m as any)?.fecha || (m as any)?.createdAt;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private getDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return this.getDayKey(a) === this.getDayKey(b);
  }

  public shouldShowDateSeparator(index: number): boolean {
    const current = this.getMensajeFecha(this.mensajesSeleccionados[index]);
    if (!current) return false;

    if (index === 0) return true;
    const previous = this.getMensajeFecha(this.mensajesSeleccionados[index - 1]);
    if (!previous) return true;

    return !this.isSameDay(current, previous);
  }

  public getDateSeparatorLabel(m: MensajeDTO): string {
    const current = this.getMensajeFecha(m);
    if (!current) return '';

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(current, now)) return 'Hoy';
    if (this.isSameDay(current, yesterday)) return 'Ayer';
    if (current.getFullYear() === now.getFullYear()) {
      return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
      }).format(current);
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(current);
  }

  public formatMensajeHora(m: MensajeDTO): string {
    const d = this.getMensajeFecha(m);
    if (!d || Number.isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Construye la URL correcta y accesible para que el navegador reproduzca un audio del servidor.
   */
  public getAudioSrc(m: MensajeDTO): string {
    const decrypted = String(m?.audioDataUrl || '').trim();
    if (decrypted) return decrypted;
    if ((m as any)?.__audioE2EEncrypted) return '';
    const rawUrl = String(m?.audioUrl || '').trim();
    return resolveMediaUrl(rawUrl, environment.backendBaseUrl);
  }

  private resolveImageMetaForRender(m: MensajeDTO): {
    imageUrl: string;
    imageMime: string;
    imageNombre: string;
    isE2EFromContenido: boolean;
  } {
    const dtoImageUrl = String(m?.imageUrl || '').trim();
    const dtoImageMime = String(m?.imageMime || '').trim();
    const dtoImageNombre = String(m?.imageNombre || '').trim();
    if (dtoImageUrl || dtoImageMime || dtoImageNombre) {
      return {
        imageUrl: dtoImageUrl,
        imageMime: dtoImageMime,
        imageNombre: dtoImageNombre,
        isE2EFromContenido: false,
      };
    }

    const payload = this.parseImageE2EPayload(m?.contenido);
    if (!payload) {
      return {
        imageUrl: '',
        imageMime: '',
        imageNombre: '',
        isE2EFromContenido: false,
      };
    }

    return {
      imageUrl: String(payload.imageUrl || '').trim(),
      imageMime: String(payload.imageMime || '').trim(),
      imageNombre: String(payload.imageNombre || '').trim(),
      isE2EFromContenido: true,
    };
  }

  public getImageSrc(m: MensajeDTO): string {
    const decrypted = String(m?.imageDataUrl || '').trim();
    if (decrypted) return decrypted;
    const meta = this.resolveImageMetaForRender(m);
    const isEncrypted =
      !!(m as any)?.__imageE2EEncrypted || meta.isE2EFromContenido;
    if (isEncrypted) return '';
    return resolveMediaUrl(meta.imageUrl, environment.backendBaseUrl);
  }

  public getImageAlt(m: MensajeDTO): string {
    const dtoName = String(m?.imageNombre || '').trim();
    if (dtoName) return dtoName;
    const meta = this.resolveImageMetaForRender(m);
    return meta.imageNombre || 'Imagen';
  }

  private extractPayloadCandidateFromPreview(rawPreview: unknown): unknown {
    if (rawPreview && typeof rawPreview === 'object') return rawPreview;
    const text = String(rawPreview || '').trim();
    if (!text) return null;
    if (text.startsWith('{')) return text;
    const withPrefixMatch = text.match(/^[^:]{1,80}:\s*(\{[\s\S]*\})\s*$/);
    if (withPrefixMatch?.[1]) return withPrefixMatch[1];
    return null;
  }

  private getChatLastPreviewSenderId(chat: any): number {
    const senderId = Number(
      chat?.ultimaMensajeEmisorId ??
      chat?.ultimoMensajeEmisorId ??
      chat?.lastMessageSenderId ??
      chat?.lastSenderId ??
      0
    );
    return Number.isFinite(senderId) && senderId > 0 ? senderId : 0;
  }

  private clearChatImagePreview(chat: any): void {
    if (!chat) return;
    chat.__ultimaEsImagen = false;
    chat.__ultimaImagenUrl = '';
    chat.__ultimaImagenPayloadKey = '';
    chat.__ultimaImagenDecryptOk = false;
  }

  private looksLikeE2EImagePayloadFragment(raw: unknown): boolean {
    const text = String(raw || '').trim();
    if (!text) return false;
    const hasTypeToken =
      /E2E_(GROUP_)?IMAGE/i.test(text) ||
      /"type"\s*:\s*"E2E_(GROUP_)?IMAGE"/i.test(text) ||
      /\\"type\\"\s*:\s*\\"E2E_(GROUP_)?IMAGE\\"/i.test(text);
    const hasJsonShape =
      text.startsWith('{') ||
      text.startsWith('"{') ||
      text.includes('{\\"') ||
      text.includes('"iv') ||
      text.includes('\\"iv');
    return hasTypeToken && hasJsonShape;
  }

  private isImagePreviewText(rawPreview: unknown, chat?: any): boolean {
    const normalized = this.normalizeOwnPreviewPrefix(
      String(rawPreview || ''),
      chat
    );
    const cleaned = formatPreviewText(normalized)
      .replace(/^[^:]{1,80}:\s*/, '')
      .trim()
      .toLowerCase();
    return (
      cleaned === 'imagen' ||
      cleaned.startsWith('imagen:') ||
      this.looksLikeE2EImagePayloadFragment(cleaned)
    );
  }

  private async syncChatItemLastPreviewMedia(
    chat: any,
    lastMessage?: Partial<MensajeDTO> | null,
    source = 'chat-preview'
  ): Promise<void> {
    if (!chat) return;

    const msg = lastMessage || null;
    const isImageTipo = String(msg?.tipo || '').trim().toUpperCase() === 'IMAGE';
    const chatLastTipo =
      this.normalizeLastMessageTipo(chat?.ultimaMensajeTipo ?? chat?.__ultimaTipo) ||
      this.inferLastMessageTipoFromRaw(
        chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw
      );
    const isImageByChatTipo = chatLastTipo === 'IMAGE';
    const msgEncryptedImage = !!(msg as any)?.__imageE2EEncrypted;
    const decryptedUrl = String(msg?.imageDataUrl || '').trim();
    const directMessageUrl = String(msg?.imageUrl || '').trim();

    const payloadFromMessage = this.parseImageE2EPayload(msg?.contenido);
    const payloadFromRaw = !msg
      ? this.parseImageE2EPayload(
          this.extractPayloadCandidateFromPreview(
            chat?.__ultimaMensajeRaw ??
              chat?.ultimaMensajeRaw ??
              ''
          )
        )
      : null;
    const payloadFromPreviewText = !msg && !payloadFromRaw
      ? this.parseImageE2EPayload(
          this.extractPayloadCandidateFromPreview(chat?.ultimaMensaje ?? '')
        )
      : null;
    const payload = payloadFromMessage || payloadFromRaw || payloadFromPreviewText;

    const fallbackChatUrl = String(
      chat?.ultimaMensajeImageUrl ||
        chat?.ultimaImagenUrl ||
        chat?.lastMessageImageUrl ||
        chat?.lastImageUrl ||
        chat?.previewImageUrl ||
        ''
    ).trim();

    const previewLooksImage = this.isImagePreviewText(chat?.ultimaMensaje, chat);
    const safeDirectMessageUrl =
      msgEncryptedImage && !decryptedUrl ? '' : directMessageUrl;

    const isImage =
      isImageTipo ||
      isImageByChatTipo ||
      !!decryptedUrl ||
      !!safeDirectMessageUrl ||
      !!fallbackChatUrl ||
      !!payload ||
      previewLooksImage;

    if (!isImage) {
      this.clearChatImagePreview(chat);
      return;
    }

    chat.__ultimaEsImagen = true;

    if (decryptedUrl) {
      chat.__ultimaImagenUrl = decryptedUrl;
      chat.__ultimaImagenDecryptOk = true;
      return;
    }

    if (payload) {
      const payloadKey = this.buildImageE2ECacheKey(payload);
      if (
        chat.__ultimaImagenPayloadKey === payloadKey &&
        String(chat.__ultimaImagenUrl || '').trim()
      ) {
        chat.__ultimaImagenDecryptOk = true;
        return;
      }

      const senderIdCandidate = Number(msg?.emisorId);
      const senderId =
        Number.isFinite(senderIdCandidate) && senderIdCandidate > 0
          ? senderIdCandidate
          : this.getChatLastPreviewSenderId(chat);
      const decrypted = await this.decryptImageE2EPayloadToObjectUrl(
        payload,
        senderId,
        {
          chatId: Number(chat?.id),
          mensajeId: Number(chat?.lastPreviewId ?? msg?.id),
          source,
        }
      );

      chat.__ultimaImagenPayloadKey = payloadKey;
      chat.__ultimaImagenUrl = String(decrypted.objectUrl || '').trim();
      chat.__ultimaImagenDecryptOk = !!chat.__ultimaImagenUrl;
      return;
    }

    const plainUrl = safeDirectMessageUrl || fallbackChatUrl;
    chat.__ultimaImagenUrl = resolveMediaUrl(plainUrl, environment.backendBaseUrl);
    chat.__ultimaImagenDecryptOk = !!chat.__ultimaImagenUrl;
  }

  public isImagePreviewChat(chat: any): boolean {
    const lastTipo =
      this.normalizeLastMessageTipo(chat?.ultimaMensajeTipo ?? chat?.__ultimaTipo) ||
      this.inferLastMessageTipoFromRaw(
        chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw
      );
    if (lastTipo === 'IMAGE') return true;
    return this.isImagePreviewText(chat?.ultimaMensaje, chat);
  }

  public chatImagePreviewSrc(chat: any): string {
    return String(chat?.__ultimaImagenUrl || '').trim();
  }

  public chatImagePreviewAlt(chat: any): string {
    const name = String(
      chat?.ultimaMensajeImageNombre ||
        chat?.ultimaMensajeImageName ||
        chat?.ultimaImagenNombre ||
        chat?.lastMessageImageName ||
        ''
    ).trim();
    return name || 'Imagen';
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
    const src = this.getAudioSrc(m);
    if (!src) {
      this.showToast(
        'No se pudo descifrar el audio en este dispositivo.',
        'warning',
        'Audio'
      );
      return;
    }
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
    const lastTipo =
      this.normalizeLastMessageTipo(chat?.ultimaMensajeTipo ?? chat?.__ultimaTipo) ||
      this.inferLastMessageTipoFromRaw(
        chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw
      );
    if (lastTipo === 'AUDIO') return true;
    if (chat?.__ultimaEsAudio === true) return true;
    return isAudioPreviewText(chat?.ultimaMensaje);
  }

  /**
   * Obtiene la duración en texto `mm:ss` del preview (vista previa) del audio del último mensaje.
   */
  public audioPreviewTime(chat: any): string {
    const explicitDurMs = Number(
      chat?.ultimaMensajeAudioDuracionMs ?? chat?.__ultimaAudioDurMs
    );
    if (Number.isFinite(explicitDurMs) && explicitDurMs > 0) {
      return formatDuration(explicitDurMs);
    }
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
    chat?.__ultimaLabel ||
    this.getAudioPreviewLabelFromSender(chat) ||
    parseAudioPreviewText(chat?.ultimaMensaje).label;

  /**
   * Se ejecuta al escribir en el buscador lateral para filtrar chats por nombre.
   */
  public onSearchChange(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value || '';
    this.busquedaChat = value.trim();
  }

  public setChatListFilter(filter: ChatListFilter): void {
    this.chatListFilter = filter;
  }

  public isChatListFilterActive(filter: ChatListFilter): boolean {
    return this.chatListFilter === filter;
  }

  // ✅ lista derivada para el *ngFor*
  //  - Coincidencias arriba (empieza por > contiene)
  //  - Luego el resto (sin coincidencia), conservando orden original
  //  - Empates: más no leídos primero y, luego, más reciente
  /**
   * Devuelve la lista ordenada localmente de los chats según su coincidencia de búsqueda, mensajes sin leer y fecha.
   */
  public get chatsFiltrados(): any[] {
    const base = (this.chats || []).filter((chat) =>
      this.matchesChatListFilter(chat)
    );
    const q = this._norm(this.busquedaChat);
    if (!q) return base;

    return base
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

  private matchesChatListFilter(chat: any): boolean {
    switch (this.chatListFilter) {
      case 'LEIDOS':
        return Number(chat?.unreadCount || 0) === 0;
      case 'NO_LEIDOS':
        return Number(chat?.unreadCount || 0) > 0;
      case 'GRUPOS':
        return !!chat?.esGrupo;
      case 'TODOS':
      default:
        return true;
    }
  }

  /**
   * Ordena y decide qué fecha es más reciente entre dos valores de tiempo. (A versus B).
   */
  private _compareFechaDesc(a: any, b: any): number {
    const ta = a ? new Date(a).getTime() : 0;
    const tb = b ? new Date(b).getTime() : 0;
    return tb - ta;
  }

  private normalizeOwnProfilePhoto(url?: string | null): string | null {
    const resolved = resolveMediaUrl(url || '', environment.backendBaseUrl);
    if (!resolved) return null;
    const low = resolved.toLowerCase();
    if (
      low.endsWith('/assets/usuario.png') ||
      low.endsWith('/assets/perfil.png') ||
      low.endsWith('assets/usuario.png') ||
      low.endsWith('assets/perfil.png')
    ) {
      return null;
    }
    return resolved;
  }

  /**
   * Obtiene la foto de perfil real del usuario utilizando el endpoint backend con su ID guardado en localStorage.
   */
  private cargarPerfil(): void {
    const idStr = localStorage.getItem('usuarioId');
    if (!idStr) return;
    const id = Number(idStr);
    const cachedFoto = localStorage.getItem('usuarioFoto') || '';

    if (cachedFoto) {
      this.usuarioFotoUrl = this.normalizeOwnProfilePhoto(cachedFoto);
      this.cdr.markForCheck();
    }

    this.authService.getById(id).subscribe({
      next: (u) => {
        this.perfilUsuario = { ...u };
        if (typeof (u as any)?.hasPublicKey === 'boolean') {
          this.e2eSessionReady = !!(u as any).hasPublicKey;
        } else {
          const localPub = localStorage.getItem(`publicKey_${id}`) || '';
          this.e2eSessionReady = !!localPub.trim();
        }
        const foto = u.foto || cachedFoto || '';
        this.usuarioFotoUrl = this.normalizeOwnProfilePhoto(foto);
        if (u.foto) localStorage.setItem('usuarioFoto', u.foto);
        else localStorage.removeItem('usuarioFoto');
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('❌ Error cargando perfil:', err);
        this.usuarioFotoUrl = this.normalizeOwnProfilePhoto(cachedFoto);
        this.cdr.markForCheck();
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

    // ? Medios OK ? ahora s? aceptamos
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
      // Renegociacion
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
    this.showRemoteStatus(`Llamando a ${nombreCallee}⬦`, 'is-ringing');

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

    // Por si venias de "Llamando..."
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

    // ? Arrancamos SOLO con audio ? c?mara apagada por defecto
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
    // Arrancamos sin camara: sender sin track (OK). Mas tarde haremos replaceTrack().

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

    // Si el chat NO esta abierto: refrescar desde servidor
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
        const updatedChat = this.chats.find((c) => Number(c.id) === Number(chatId));
        if (updatedChat) {
          this.stampChatLastMessageFieldsFromMessage(updatedChat, lastActivo || null);
          void this.syncChatItemLastPreviewMedia(
            updatedChat,
            lastActivo || null,
            'chat-preview-refresh-from-server'
          );
        }
      },
      error: (err) => console.error('❌ Error refrescando preview:', err),
    });
  }

  /**
   * Comprueba si el receptor en internet al otro lado del cable, tiene la cámara encendida, enviando video, y sin mutear.
   */
  public get hasRemoteVideoActive(): boolean {
    const vs = this.remoteStream?.getVideoTracks() ?? [];
    // Video "vivo": no terminado y no muted
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
          .filter(
            (r) =>
              r.type === 'GROUP_INVITE' &&
              r.resolved !== true
          )
          .map((r) => {
            const p = JSON.parse(r.payloadJson || '{}');
            const inviteId = this.getNormalizedInviteId(p, r.id);
            return {
              ...p,
              inviteId,
              kind: 'INVITE' as const,
            } as GroupInviteWS & {
              kind: 'INVITE';
            };
          })
          // 2) Excluye localmente las ya tratadas
          .filter((p) => {
            const inviteId = this.getNormalizedInviteId(p);
            return (
              Number.isFinite(inviteId) &&
              inviteId > 0 &&
              !handled.has(inviteId)
            );
          });

        const responses = (rows || [])
          .filter((r) => r.type === 'GROUP_INVITE_RESPONSE')
          .map((r) => {
            const p = JSON.parse(r.payloadJson || '{}');
            return { ...p, kind: 'RESPONSE' as const } as GroupInviteResponseWS & {
              kind: 'RESPONSE';
            };
          });

        // 3) Evita duplicados por inviteId
        const seenInvites = new Set<number>();
        this.notifInvites = [];
        for (const inv of invites) {
          const id = this.getNormalizedInviteId(inv);
          if (!seenInvites.has(id)) {
            this.notifInvites.push(inv);
            seenInvites.add(id);
          }
        }

        const seenResponses = new Set<number>();
        this.notifItems = [];
        for (const resp of responses) {
          const id = Number(resp.inviteId);
          if (!seenResponses.has(id)) {
            this.notifItems.push(resp);
            seenResponses.add(id);
          }
        }
        this.pendingCount = this.notifItems.length;

        if (
          responses.some(
            (r) => String(r?.status || '').toUpperCase() === 'ACCEPTED'
          )
        ) {
          this.scheduleChatsRefresh(150);
        }

        this.cdr.markForCheck();
      },
      error: (e) => console.error('❌ list notifications:', e),
    });
  }

  private scheduleChatsRefresh(delayMs = 250): void {
    if (this.chatsRefreshTimer) {
      clearTimeout(this.chatsRefreshTimer);
    }
    this.chatsRefreshTimer = setTimeout(() => {
      this.chatsRefreshTimer = null;
      this.listarTodosLosChats();
    }, delayMs);
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
    const isSystem = this.isSystemMessage(mensaje);
    if (!isSystem && this.isEncryptedHiddenPlaceholder(mensaje?.contenido)) {
      return;
    }

    // Si no estoy en ese grupo → solo preview/contadores
    if (!this.chatActual || this.chatActual.id !== mensaje.chatId) {
      const chatItem = this.chats.find((c) => c.id === mensaje.chatId);
      if (chatItem) {
        if (!isSystem && mensaje.emisorId !== this.usuarioActualId) {
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
        this.stampChatLastMessageFieldsFromMessage(chatItem, mensaje);
        void this.syncChatItemLastPreviewMedia(
          chatItem,
          mensaje,
          'ws-group-list'
        );
        this.cdr.markForCheck();
      }
      return;
    }

    // Estoy en el grupo: anadir al hilo
    let i = this.mensajesSeleccionados.findIndex(
      (m) => Number(m.id) === Number(mensaje.id)
    );
    if (i === -1 && Number(mensaje?.emisorId) === Number(this.usuarioActualId)) {
      const incomingTipo = String(mensaje?.tipo || 'TEXT');
      const incomingContenido = String(mensaje?.contenido ?? '');
      i = this.mensajesSeleccionados.findIndex(
        (m) =>
          Number(m.id) < 0 &&
          Number(m.emisorId) === Number(mensaje.emisorId) &&
          String(m.tipo || 'TEXT') === incomingTipo &&
          String(m.contenido ?? '') === incomingContenido
      );
    }
    if (i !== -1) {
      this.mensajesSeleccionados = [
        ...this.mensajesSeleccionados.slice(0, i),
        { ...this.mensajesSeleccionados[i], ...mensaje },
        ...this.mensajesSeleccionados.slice(i + 1),
      ];
    } else {
      this.mensajesSeleccionados = [...this.mensajesSeleccionados, mensaje];
    }

    this.syncActiveHistoryStateMessages();

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
      this.stampChatLastMessageFieldsFromMessage(chat, mensaje);
      void this.syncChatItemLastPreviewMedia(chat, mensaje, 'ws-group-open-chat');
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
      'audio/webm',
      'audio/ogg',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
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
      console.error('No se pudo acceder al microfono:', e);
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
    if (!blob || blob.size <= 0) {
      this.showToast('No se pudo grabar audio. Inténtalo de nuevo.', 'warning', 'Audio');
      this.recordElapsedMs = 0;
      this.cdr.markForCheck();
      return;
    }

    try {
      await this.enviarMensajeVozSeguro(blob, mime, durMs);
      this.recordElapsedMs = 0;
      this.cdr.markForCheck();
    } catch (e: any) {
      console.error('[AUDIO] send error:', e, {
        blobType: blob.type,
        blobSize: blob.size,
        durMs,
      });
      const backendMsg = e?.error?.mensaje || e?.error?.message || e?.message || '';
      const msg =
        Number(e?.status) === 400
          ? `No se pudo subir el audio (${backendMsg || 'revisa formato y duracion'}).`
          : 'No se pudo enviar el audio.';
      this.showToast(msg, 'danger', 'Audio');
    }
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
   * Cifra (si aplica), sube y envía un mensaje de audio.
   * - Grupal: cifrado E2E obligatorio.
   * - Individual: intenta cifrar E2E y, si no puede, mantiene fallback en claro.
   */
  private async enviarMensajeVozSeguro(
    audioBlob: Blob,
    audioMime: string,
    durMs: number
  ): Promise<void> {
    if (!this.chatActual) return;

    const esGrupo = !!this.chatActual.esGrupo;
    const chatId = Number(this.chatActual.id);
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const receptorId = esGrupo ? chatId : Number(this.chatActual?.receptor?.id);
    if (!Number.isFinite(receptorId) || receptorId <= 0) return;

    if (esGrupo && this.noGroupRecipientsForSend) {
      this.showToast('Todavia no ha aceptado nadie.', 'warning', 'Grupo');
      return;
    }

    let contenido = '';
    let blobToUpload = audioBlob;

    if (esGrupo) {
      if (!this.e2eSessionReady) {
        const synced = await this.forceSyncMyE2EPublicKeyForRetry();
        if (!synced) {
          this.showToast(
            'No se pudo sincronizar tu clave E2E. Revisa tu sesión antes de enviar al grupo.',
            'danger',
            'E2E'
          );
          return;
        }
      }

      let builtGroupAudio: BuiltOutgoingAudioE2E;
      try {
        builtGroupAudio = await this.buildOutgoingE2EAudioForGroup(
          this.chatActual,
          audioBlob,
          audioMime,
          durMs
        );
      } catch (err: any) {
        console.warn('[E2E][group-audio-send-blocked]', {
          chatId,
          emisorId: Number(myId),
          reason: err?.message || String(err),
        });
        this.showToast(
          'No se pudo cifrar el audio grupal. Revisa las claves E2E del grupo.',
          'danger',
          'E2E'
        );
        return;
      }

      blobToUpload = builtGroupAudio.encryptedBlob;
      const upload = await firstValueFrom(
        this.mensajeriaService.uploadAudio(blobToUpload, durMs)
      );
      builtGroupAudio.payload.audioUrl = upload?.url || '';
      builtGroupAudio.payload.audioMime = upload?.mime || audioMime;
      builtGroupAudio.payload.audioDuracionMs = Number(upload?.durMs ?? durMs) || 0;
      contenido = JSON.stringify(builtGroupAudio.payload);

      await this.logGroupWsPayloadBeforeSend(
        'send-message-group-audio',
        {
          contenido,
          emisorId: myId,
          receptorId: chatId,
          chatId,
          tipo: 'AUDIO',
        },
        builtGroupAudio.forReceptoresKeys
      );

      const mensaje: MensajeDTO = {
        tipo: 'AUDIO',
        audioUrl: upload?.url || '',
        audioMime: upload?.mime || audioMime,
        audioDuracionMs: Number(upload?.durMs ?? durMs) || 0,
        contenido,
        emisorId: myId,
        receptorId: chatId,
        activo: true,
        chatId,
        reenviado: false,
        replyToMessageId: this.mensajeRespuestaObjetivo?.id
          ? Number(this.mensajeRespuestaObjetivo.id)
          : undefined,
        replySnippet: this.getComposeReplySnippet(),
        replyAuthorName: this.getComposeReplyAuthorName(),
      };

      const textoPreview = `🎤 Mensaje de voz (${this.formatDur(mensaje.audioDuracionMs)})`;
      this.chats = updateChatPreview(this.chats, chatId, textoPreview);
      const chatItem = this.chats.find((c) => Number(c.id) === chatId);
      if (chatItem) chatItem.unreadCount = 0;

      this.wsService.enviarMensajeGrupal(mensaje);
      this.cancelarRespuestaMensaje();
      return;
    }

    // Individual: intento de E2E con fallback en claro.
    let uploadedUrl = '';
    let uploadedMime = audioMime;
    let uploadedDurMs = Number(durMs) || 0;
    try {
      const builtIndividualAudio = await this.buildOutgoingE2EAudioForIndividual(
        receptorId,
        audioBlob,
        audioMime,
        durMs
      );
      blobToUpload = builtIndividualAudio.encryptedBlob;
      const upload = await firstValueFrom(
        this.mensajeriaService.uploadAudio(blobToUpload, durMs)
      );
      builtIndividualAudio.payload.audioUrl = upload?.url || '';
      builtIndividualAudio.payload.audioMime = upload?.mime || audioMime;
      builtIndividualAudio.payload.audioDuracionMs = Number(upload?.durMs ?? durMs) || 0;
      contenido = JSON.stringify(builtIndividualAudio.payload);
      uploadedUrl = upload?.url || '';
      uploadedMime = upload?.mime || audioMime;
      uploadedDurMs = Number(upload?.durMs ?? durMs) || 0;
    } catch (err: any) {
      console.warn('[E2E][individual-audio-fallback-plain]', {
        chatId,
        emisorId: Number(myId),
        receptorId: Number(receptorId),
        reason: err?.message || String(err),
      });
      const upload = await firstValueFrom(
        this.mensajeriaService.uploadAudio(audioBlob, durMs)
      );
      contenido = '';
      uploadedUrl = upload?.url || '';
      uploadedMime = upload?.mime || audioMime;
      uploadedDurMs = Number(upload?.durMs ?? durMs) || 0;
    }

    const mensaje: MensajeDTO = {
      tipo: 'AUDIO',
      audioUrl: uploadedUrl,
      audioMime: uploadedMime,
      audioDuracionMs: uploadedDurMs,
      contenido,
      emisorId: myId,
      receptorId,
      activo: true,
      chatId,
      reenviado: false,
      replyToMessageId: this.mensajeRespuestaObjetivo?.id
        ? Number(this.mensajeRespuestaObjetivo.id)
        : undefined,
      replySnippet: this.getComposeReplySnippet(),
      replyAuthorName: this.getComposeReplyAuthorName(),
    };

    const textoPreview = `🎤 Mensaje de voz (${this.formatDur(uploadedDurMs)})`;
    this.chats = updateChatPreview(this.chats, chatId, textoPreview);
    const chatItem = this.chats.find((c) => Number(c.id) === chatId);
    if (chatItem) chatItem.unreadCount = 0;

    this.wsService.enviarMensajeIndividual(mensaje);
    this.cancelarRespuestaMensaje();
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
          const backendMsg = String(resp?.mensaje || '');
          const groupDeleted =
            !!resp?.groupDeleted ||
            (/eliminad/i.test(backendMsg) && /vaci/i.test(backendMsg));

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

          void backendMsg;

          // Cierra menú si lo tienes
          if (typeof this.cerrarMenuOpciones === 'function')
            this.cerrarMenuOpciones();

          // Si el grupo queda eliminado, retira chat lateral y limpia la zona de mensajes
          if (groupDeleted) {
            this.chats = (this.chats || []).filter(
              (c: any) => Number(c?.id) !== groupId
            );
            if (Number(this.chatSeleccionadoId) === groupId) {
              this.chatSeleccionadoId = null;
              this.mensajesSeleccionados = [];
              this.chatActual = null;
              this.haSalidoDelGrupo = false;
              this.mensajeNuevo = '';
              this.closeGroupInfoPanel();
            } else if (this.chatActual && Number(this.chatActual.id) === groupId) {
              this.chatActual = null;
            }
          }
          this.cdr.markForCheck();
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
  private getHandledInviteStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.HANDLED_INVITES_KEY}:${userId}`
      : this.HANDLED_INVITES_KEY;
  }

  private getNormalizedInviteId(
    source: any,
    fallbackId?: number
  ): number {
    const candidate =
      source?.inviteId ??
      source?.id ??
      fallbackId;
    const inviteId = Number(candidate);
    return Number.isFinite(inviteId) ? inviteId : NaN;
  }

  private getHandledInviteIds(): Set<number> {
    const primaryKey = this.getHandledInviteStorageKey();
    const rawPrimary = localStorage.getItem(primaryKey);
    const rawLegacy = localStorage.getItem(this.HANDLED_INVITES_KEY);
    const raw = rawPrimary ?? rawLegacy;
    if (!raw) return new Set<number>();
    try {
      const parsed = JSON.parse(raw) as any[];
      const normalized = (parsed || [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0);
      return new Set<number>(normalized);
    } catch {
      return new Set<number>();
    }
  }
  /**
   * Memoriza persistemente un ID de invitación procesada de usuario al rechazar / Aceptar
   */
  private addHandledInviteId(id: number): void {
    if (!Number.isFinite(Number(id)) || Number(id) <= 0) return;
    const set = this.getHandledInviteIds();
    set.add(Number(id));
    localStorage.setItem(
      this.getHandledInviteStorageKey(),
      JSON.stringify(Array.from(set))
    );
  }

  public toggleEmojiPicker(event: MouseEvent): void {
    event.stopPropagation();
    if (this.haSalidoDelGrupo || this.chatEstaBloqueado) return;
    this.onMessageInputSelectionChange();
    if (this.showEmojiPicker) {
      this.closeEmojiPicker();
      return;
    }
    this.openEmojiPicker();
  }

  public onEmojiSelected(emoji: string): void {
    if (!emoji || this.haSalidoDelGrupo || this.chatEstaBloqueado) return;
    this.insertEmojiAtCursor(emoji);
    this.closeEmojiPicker();
  }

  public openAttachmentPicker(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.shouldDisableAttachmentAction()) return;
    this.closeEmojiPicker();
    this.attachmentInputRef?.nativeElement?.click();
  }

  public async onAttachmentSelected(event: Event): Promise<void> {
    const input = event?.target as HTMLInputElement | null;
    const file = input?.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) return;
    if (this.shouldDisableAttachmentAction()) {
      if (input) input.value = '';
      return;
    }

    const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.showToast('El archivo supera 25MB.', 'warning', 'Adjunto');
      if (input) input.value = '';
      return;
    }

    this.clearPendingAttachment(false);
    this.pendingAttachmentFile = file;
    this.pendingAttachmentIsImage = /^image\//i.test(file.type || '');
    this.pendingAttachmentPreviewUrl = this.pendingAttachmentIsImage
      ? URL.createObjectURL(file)
      : null;
    if (input) input.value = '';
    this.showToast(
      'Archivo listo para enviar.',
      'info',
      'Adjunto',
      1600
    );
  }

  public clearPendingAttachment(resetInput = true): void {
    if (this.pendingAttachmentPreviewUrl) {
      try {
        URL.revokeObjectURL(this.pendingAttachmentPreviewUrl);
      } catch {}
    }
    this.pendingAttachmentPreviewUrl = null;
    this.pendingAttachmentFile = null;
    this.pendingAttachmentIsImage = false;
    if (resetInput) {
      const input = this.attachmentInputRef?.nativeElement;
      if (input) input.value = '';
    }
  }

  public formatAttachmentSize(bytes: number): string {
    const size = Number(bytes || 0);
    if (size <= 0) return '0 B';
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  public async enviarMensajeDesdeComposer(): Promise<void> {
    if (this.haSalidoDelGrupo || this.noGroupRecipientsForSend) return;
    if (this.attachmentUploading) return;

    if (this.pendingAttachmentFile) {
      if (this.pendingAttachmentIsImage) {
        await this.enviarImagenSeguro(this.pendingAttachmentFile, this.mensajeNuevo);
        return;
      }
      const uploaded = await this.uploadPendingAttachmentIntoMessage();
      if (!uploaded) return;
    }
    await this.enviarMensaje();
  }

  public onMessageInputSelectionChange(): void {
    const input = this.getMessageInputElement();
    if (!input) return;
    this.composeCursorStart = Number.isFinite(input.selectionStart)
      ? Number(input.selectionStart)
      : (this.mensajeNuevo || '').length;
    this.composeCursorEnd = Number.isFinite(input.selectionEnd)
      ? Number(input.selectionEnd)
      : this.composeCursorStart;
  }

  private openEmojiPicker(): void {
    if (this.emojiPickerCloseTimer) {
      clearTimeout(this.emojiPickerCloseTimer);
      this.emojiPickerCloseTimer = null;
    }
    if (!this.showEmojiPickerMounted) {
      this.showEmojiPickerMounted = true;
      setTimeout(() => {
        this.showEmojiPicker = true;
      }, 0);
      return;
    }
    this.showEmojiPicker = true;
  }

  private closeEmojiPicker(immediate = false): void {
    if (this.emojiPickerCloseTimer) {
      clearTimeout(this.emojiPickerCloseTimer);
      this.emojiPickerCloseTimer = null;
    }
    this.showEmojiPicker = false;
    if (immediate) {
      this.showEmojiPickerMounted = false;
      return;
    }
    this.emojiPickerCloseTimer = setTimeout(() => {
      this.showEmojiPickerMounted = false;
      this.emojiPickerCloseTimer = null;
    }, 180);
  }

  private insertEmojiAtCursor(emoji: string): void {
    this.insertTextAtCursor(emoji);
  }

  private insertTextAtCursor(text: string): void {
    if (!text) return;
    const input = this.getMessageInputElement();
    const currentText = this.mensajeNuevo || '';
    let start = this.composeCursorStart;
    let end = this.composeCursorEnd;

    if (input) {
      start = Number.isFinite(input.selectionStart)
        ? Number(input.selectionStart)
        : start;
      end = Number.isFinite(input.selectionEnd) ? Number(input.selectionEnd) : end;
    }

    const safeStart = Math.max(0, Math.min(start, currentText.length));
    const safeEnd = Math.max(safeStart, Math.min(end, currentText.length));
    const nextText =
      currentText.slice(0, safeStart) + text + currentText.slice(safeEnd);
    const nextCaretPosition = safeStart + text.length;

    this.mensajeNuevo = nextText;
    this.composeCursorStart = nextCaretPosition;
    this.composeCursorEnd = nextCaretPosition;
    this.notificarEscribiendo();
    this.cdr.detectChanges();
    this.focusMessageInput(nextCaretPosition);
  }

  private shouldDisableAttachmentAction(): boolean {
    return (
      this.attachmentUploading ||
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.noGroupRecipientsForSend
    );
  }

  private async uploadPendingAttachmentIntoMessage(): Promise<boolean> {
    if (!this.pendingAttachmentFile) return true;
    this.attachmentUploading = true;
    try {
      const uploaded = await this.mensajeriaService.uploadFile(
        this.pendingAttachmentFile
      );
      const icon = this.pendingAttachmentIsImage ? '🖼️' : '📎';
      const attachmentText = `${icon} ${uploaded.fileName}\n${uploaded.url}`;
      const base = String(this.mensajeNuevo || '').trimEnd();
      this.mensajeNuevo = base ? `${base}\n${attachmentText}` : attachmentText;
      this.composeCursorStart = this.mensajeNuevo.length;
      this.composeCursorEnd = this.mensajeNuevo.length;
      this.clearPendingAttachment();
      return true;
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const backendMsg = String(
        err?.error?.mensaje || err?.error?.message || ''
      ).trim();
      if (status === 404) {
        this.showToast(
          'El backend no tiene endpoint de subida de archivos.',
          'warning',
          'Adjunto'
        );
      } else {
        this.showToast(
          backendMsg
            ? `No se pudo subir el archivo: ${backendMsg}`
            : 'No se pudo subir el archivo.',
          'danger',
          'Adjunto'
        );
      }
      return false;
    } finally {
      this.attachmentUploading = false;
    }
  }

  private async enviarImagenSeguro(
    imageFile: File,
    captionRaw: string
  ): Promise<void> {
    if (!this.chatActual) return;
    const caption = String(captionRaw || '').trim();
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const chatId = Number(this.chatActual.id);
    const isGroup = !!this.chatActual.esGrupo;
    const receptorId = isGroup ? chatId : Number(this.chatActual?.receptor?.id);
    if (!Number.isFinite(receptorId) || receptorId <= 0) return;

    if (isGroup && this.noGroupRecipientsForSend) {
      this.showToast('Todavia no ha aceptado nadie.', 'warning', 'Grupo');
      return;
    }

    this.attachmentUploading = true;
    try {
      if (isGroup) {
        if (!this.e2eSessionReady) {
          const synced = await this.forceSyncMyE2EPublicKeyForRetry();
          if (!synced) {
            this.showToast(
              'No se pudo sincronizar tu clave E2E. Revisa tu sesión antes de enviar al grupo.',
              'danger',
              'E2E'
            );
            return;
          }
        }

        const built = await this.buildOutgoingE2EImageForGroup(
          this.chatActual,
          imageFile,
          caption
        );
        const upload = await this.mensajeriaService.uploadFile(
          built.encryptedBlob,
          `img-${Date.now()}.bin`
        );
        built.payload.imageUrl = upload.url;
        built.payload.imageMime = imageFile.type || built.payload.imageMime || 'image/jpeg';
        built.payload.imageNombre = imageFile.name || built.payload.imageNombre || undefined;

        const payloadContenido = JSON.stringify(built.payload);
        const outgoing: MensajeDTO = {
          tipo: 'IMAGE',
          contenido: payloadContenido,
          emisorId: myId,
          receptorId: chatId,
          activo: true,
          chatId,
          reenviado: false,
          imageUrl: upload.url,
          imageMime: imageFile.type || built.payload.imageMime || 'image/jpeg',
          imageNombre: imageFile.name || built.payload.imageNombre || null,
          replyToMessageId: this.mensajeRespuestaObjetivo?.id
            ? Number(this.mensajeRespuestaObjetivo.id)
            : undefined,
          replySnippet: this.getComposeReplySnippet(),
          replyAuthorName: this.getComposeReplyAuthorName(),
        };

        this.chats = updateChatPreview(
          this.chats || [],
          chatId,
          caption ? `Imagen: ${caption}` : 'Imagen'
        );
        const chatItem = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
        if (chatItem) chatItem.unreadCount = 0;

        await this.logGroupWsPayloadBeforeSend(
          'send-message-group-image',
          outgoing,
          built.forReceptoresKeys
        );
        this.wsService.enviarMensajeGrupal(outgoing);
      } else {
        const built = await this.buildOutgoingE2EImageForIndividual(
          receptorId,
          imageFile,
          caption
        );
        const upload = await this.mensajeriaService.uploadFile(
          built.encryptedBlob,
          `img-${Date.now()}.bin`
        );
        built.payload.imageUrl = upload.url;
        built.payload.imageMime = imageFile.type || built.payload.imageMime || 'image/jpeg';
        built.payload.imageNombre = imageFile.name || built.payload.imageNombre || undefined;

        const payloadContenido = JSON.stringify(built.payload);
        const outgoing: MensajeDTO = {
          tipo: 'IMAGE',
          contenido: payloadContenido,
          emisorId: myId,
          receptorId,
          activo: true,
          chatId,
          reenviado: false,
          imageUrl: upload.url,
          imageMime: imageFile.type || built.payload.imageMime || 'image/jpeg',
          imageNombre: imageFile.name || built.payload.imageNombre || null,
          replyToMessageId: this.mensajeRespuestaObjetivo?.id
            ? Number(this.mensajeRespuestaObjetivo.id)
            : undefined,
          replySnippet: this.getComposeReplySnippet(),
          replyAuthorName: this.getComposeReplyAuthorName(),
        };
        this.chats = updateChatPreview(
          this.chats || [],
          chatId,
          caption ? `Imagen: ${caption}` : 'Imagen'
        );
        const chatItem = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
        if (chatItem) chatItem.unreadCount = 0;
        this.wsService.enviarMensajeIndividual(outgoing);
      }

      this.clearPendingAttachment();
      this.mensajeNuevo = '';
      this.cancelarRespuestaMensaje();
      this.cdr.markForCheck();
    } catch (err: any) {
      const backendCode = String(err?.error?.code || '').trim();
      const backendTrace = String(err?.error?.traceId || '').trim();
      const backendMsg = String(
        err?.error?.mensaje || err?.error?.message || err?.message || ''
      ).trim();
      const traceSuffix = backendTrace ? ` (traceId: ${backendTrace})` : '';
      const detail = backendMsg || backendCode;
      this.showToast(
        detail
          ? `No se pudo enviar la imagen: ${detail}${traceSuffix}`
          : 'No se pudo enviar la imagen.',
        'danger',
        backendCode.startsWith('E2E_') ? 'E2E' : 'Imagen'
      );
      console.warn('[E2E][image-send-error]', {
        code: backendCode,
        traceId: backendTrace,
        message: backendMsg,
        status: Number(err?.status || 0),
      });
    } finally {
      this.attachmentUploading = false;
    }
  }

  private focusMessageInput(position?: number): void {
    setTimeout(() => {
      const input = this.getMessageInputElement();
      if (!input) return;
      input.focus();
      const nextPosition =
        typeof position === 'number'
          ? position
          : Number.isFinite(this.composeCursorStart)
            ? this.composeCursorStart
            : (this.mensajeNuevo || '').length;
      try {
        input.setSelectionRange(nextPosition, nextPosition);
      } catch {}
    }, 0);
  }

  private getMessageInputElement(): HTMLTextAreaElement | null {
    return this.messageInputRef?.nativeElement || null;
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
    if (this.haSalidoDelGrupo || this.noGroupRecipientsForSend) {
      evt.preventDefault();
      return;
    }
    void this.enviarMensajeDesdeComposer();
    evt.preventDefault();
  }

  /**
   * Reestablece/limpia todo input temporal falso, notificaciones locales a vacías en cabios globales de vistas
   */
  public resetEdicion(): void {
    this.haSalidoDelGrupo = false;
    this.mensajeNuevo = '';
    this.mostrarMenuOpciones = false;
    this.openIncomingReactionPickerMessageId = null;
    this.clearPendingAttachment();
    this.closeEmojiPicker(true);
    this.closeMessageSearchPanel();
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

  public get noGroupRecipientsForSend(): boolean {
    if (!this.chatActual?.esGrupo) return false;
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const memberIds = this.extractMemberIdsFromLocalChat(this.chatActual, myId);
    return memberIds.length === 0;
  }

  public get showGroupHistoryUnavailableNotice(): boolean {
    if (!this.chatActual?.esGrupo) return false;
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return false;
    if (!this.groupHistoryHiddenByChatId.get(chatId)) return false;
    const hasVisibleTextMessages = (this.mensajesSeleccionados || []).some(
      (m) => !this.isSystemMessage(m)
    );
    return !hasVisibleTextMessages;
  }

  public get groupHistoryUnavailableText(): string {
    return this.GROUP_HISTORY_UNAVAILABLE_TEXT;
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

  public ngOnDestroy(): void {
    this.stopProfileCodeCountdown();
    this.clearPendingAttachment();
    if (this.chatsRefreshTimer) clearTimeout(this.chatsRefreshTimer);
    if (this.groupInfoCloseTimer) clearTimeout(this.groupInfoCloseTimer);
    if (this.messageSearchCloseTimer) clearTimeout(this.messageSearchCloseTimer);
    if (this.highlightedMessageTimer) clearTimeout(this.highlightedMessageTimer);
    if (this.emojiPickerCloseTimer) clearTimeout(this.emojiPickerCloseTimer);
    for (const url of this.decryptedAudioUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.decryptedAudioUrlByCacheKey.clear();
    this.decryptingAudioByCacheKey.clear();
    for (const url of this.decryptedImageUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.decryptedImageUrlByCacheKey.clear();
    this.decryptedImageCaptionByCacheKey.clear();
    this.decryptingImageByCacheKey.clear();
    this.incomingQuickReactionsByMessageId.clear();
    this.openIncomingReactionPickerMessageId = null;
  }
}



