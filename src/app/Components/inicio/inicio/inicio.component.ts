import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  ViewChild,
} from '@angular/core';
import {
  ChatService,
  ProgramarMensajeRequestDTO,
  ProgramarMensajeResponseDTO,
  PollVoteRestRequestDTO,
} from '../../../Service/chat/chat.service';
import { MensajeDTO } from '../../../Interface/MensajeDTO';
import {
  PollVoteWSRequestDTO,
  WebSocketService,
} from '../../../Service/WebSocket/web-socket.service';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { Client } from '@stomp/stompjs';
import { Subscription, finalize, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../Service/auth/auth.service';
import {
  avatarOrDefault,
  buildGroupExpulsionPreview,
  buildConversationHistoryKey,
  buildPreviewFromMessage,
  buildTypingHeaderText,
  clampPercent,
  compareFechaDesc,
  colorForUserId,
  createInitialHistoryState,
  computePreviewPatch,
  dedupeChatListItemsById,
  decryptContenidoE2E,
  decryptPreviewStringE2E,
  formatAttachmentSize as formatAttachmentSizeUtil,
  formatDuration,
  formatMensajeHoraFromMessage,
  formatPreviewText,
  getDateSeparatorLabelForMessage,
  getNombrePorId,
  isSystemMessageLike,
  isAudioPreviewText,
  isGroupInviteResponseWS,
  isGroupInviteWS,
  mergeMessagesById,
  normalizeSearchText,
  isPreviewDeleted,
  parsePollPayload,
  isUnseenCountWS,
  isPollMessageLike,
  PollOptionPayload,
  PollOptionVoterPayload,
  PollPayloadV1,
  joinMembersLine,
  parseAudioDurationMs,
  parseAudioPreviewText,
  resolveMediaUrl,
  resolveTemporalExpiredPlaceholderText,
  isTemporalExpiredMessageLike,
  shouldShowDateSeparatorForMessages,
  updateChatPreview,
  E2EDebugContext,
} from '../../../utils/chat-utils';
import { GroupInviteWS } from '../../../Interface/GroupInviteWS';
import { NotificationService } from '../../../Service/Notification/notification.service';
import {
  BrowserNewMessageNotificationPayload,
  BrowserNotificationService,
} from '../../../Service/Notification/browser-notification.service';
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
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import JSZip from 'jszip';
import { PerfilUsuarioSavePayload } from '../perfil-usuario/perfil-usuario.component';
import { PollDraftPayload } from '../poll-composer/poll-composer.component';
import { ScheduleMessageDraftPayload } from '../schedule-message-composer/schedule-message-composer.component';
import { AiPollDraftContextMessageDTO } from '../../../Interface/AiPollDraftRequestDTO';
import { SessionService } from '../../../Service/session/session.service';
import { ComplaintService } from '../../../Service/complaint/complaint.service';
import { ChatListItemDTO } from '../../../Interface/ChatListItemDTO';
import { MensajeReaccionDTO } from '../../../Interface/MensajeReaccionDTO';
import {
  ChatPinnedMessageDTO,
  PinMessageRequestDTO,
} from '../../../Interface/ChatPinnedMessageDTO';
import {
  StarredMessageDTO,
  StarredMessagesPageDTO,
  StarredMessageItem,
} from '../../../Interface/StarredMessageDTO';
import {
  PollVotesPanelData,
  PollVotesPanelOption,
  PollVotesPanelVoter,
} from '../../../Interface/PollVotesPanel';
import { AiAskQuickAction } from '../../popup/ai-ask-popup/ai-ask-popup.component';
import { AiReportAnalysisRequestDTO } from '../../../Interface/AiReportAnalysisRequestDTO';
import { AiReportAnalysisResponseDTO } from '../../../Interface/AiReportAnalysisResponseDTO';
import { AiTextMode } from '../../../Interface/AiTextMode';
import { AiTextRequestDTO } from '../../../Interface/AiTextRequestDTO';
import {
  AiEncryptedConversationSummaryRequestDTO,
} from '../../../Interface/AiEncryptedConversationSummaryRequestDTO';
import { AiConversationSummaryResponseDTO } from '../../../Interface/AiConversationSummaryResponseDTO';
import { AiConversationSummaryRequestDTO } from '../../../Interface/AiConversationSummaryRequestDTO';
import {
  AiQuickRepliesChatType,
  AiQuickRepliesRequestDTO,
} from '../../../Interface/AiQuickRepliesRequestDTO';
import { AiQuickRepliesResponseDTO } from '../../../Interface/AiQuickRepliesResponseDTO';
import {
  AiEncryptedMessageSearchRequest,
  AiEncryptedMessageSearchResult,
} from '../../../Interface/AiEncryptedMessageSearchDTO';
import { AiService } from '../../../Service/ai/ai.service';
import { StickerService } from '../../../Service/sticker/sticker.service';
import { StickerDTO } from '../../../Interface/StickerDTO';
import { StickerEditorSaveEvent } from '../sticker-editor-panel/sticker-editor-panel.component';

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

interface AdminDirectChatCacheEntry {
  chatId: number;
  updatedAtMs: number;
  chat: any;
}

interface AdminDirectMessagesCacheEntry {
  chatId: number;
  updatedAtMs: number;
  messages: MensajeDTO[];
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

interface AiSummaryEncryptedPayload {
  type?: string;
  iv?: string;
  ciphertext?: string;
  forReceptor?: string;
  forEmisor?: string;
  forAdmin?: string;
  forReceptores?: Record<string, unknown>;
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

interface FileE2EBasePayload {
  type: 'E2E_FILE' | 'E2E_GROUP_FILE';
  ivFile: string;
  fileUrl: string;
  fileMime?: string;
  fileNombre?: string;
  fileSizeBytes?: number;
  captionIv?: string;
  captionCiphertext?: string;
  forEmisor: string;
  forAdmin: string;
}

interface FileE2EIndividualPayload extends FileE2EBasePayload {
  type: 'E2E_FILE';
  forReceptor: string;
}

interface FileE2EGroupPayload extends FileE2EBasePayload {
  type: 'E2E_GROUP_FILE';
  forReceptores: Record<string, string>;
}

type FileE2EPayload = FileE2EIndividualPayload | FileE2EGroupPayload;

interface BuiltOutgoingFileE2E {
  payload: FileE2EPayload;
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
  callId?: string;
  senderId?: number;
  destination?: string;
  retryAfterSeconds?: number;
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

interface SecureAttachmentLoadResult {
  objectUrl: string | null;
  status: number;
}

interface MessageReactionStateItem {
  userId: number;
  emoji: string;
  createdAt?: string | null;
}

interface MessageReactionViewItem {
  userId: number;
  emoji: string;
  createdAt?: string | null;
  name: string;
  photoUrl: string | null;
  initials: string;
}

interface TemporaryMessageOption {
  label: string;
  seconds: number | null;
  badge: string;
}

interface PinDurationOption {
  label: string;
  seconds: number;
  helper: string;
}

interface MuteDurationOption {
  label: string;
  durationMs: number | null;
  helper: string;
}

type ComposerActionType = 'archivo' | 'encuesta';
type ComposerAiActionType = 'SPELLCHECK' | 'TONE' | 'FORMAT' | 'TRANSLATE';
interface ComposeAiLanguageOption {
  nombre: string;
  codigo: string;
  idiomaDestino: string;
  destacado?: boolean;
}

const COMPOSE_AI_PRIMARY_TRANSLATION_LANGUAGES: ComposeAiLanguageOption[] = [
  { nombre: 'Ingles', codigo: 'en', idiomaDestino: 'Ingles', destacado: true },
  { nombre: 'Frances', codigo: 'fr', idiomaDestino: 'Frances', destacado: true },
  { nombre: 'Aleman', codigo: 'de', idiomaDestino: 'Aleman', destacado: true },
  { nombre: 'Italiano', codigo: 'it', idiomaDestino: 'Italiano', destacado: true },
  { nombre: 'Portugues', codigo: 'pt', idiomaDestino: 'Portugues', destacado: true },
  { nombre: 'Arabe', codigo: 'ar', idiomaDestino: 'Arabe', destacado: true },
  { nombre: 'Chino simplificado', codigo: 'zh-CN', idiomaDestino: 'Chino simplificado', destacado: true },
  { nombre: 'Japones', codigo: 'ja', idiomaDestino: 'Japones', destacado: true },
  { nombre: 'Coreano', codigo: 'ko', idiomaDestino: 'Coreano', destacado: true },
];

const COMPOSE_AI_OTHER_TRANSLATION_LANGUAGES: ComposeAiLanguageOption[] = [
  { nombre: 'Afrikaans', codigo: 'af', idiomaDestino: 'Afrikaans' },
  { nombre: 'Albanes', codigo: 'sq', idiomaDestino: 'Albanes' },
  { nombre: 'Amarico', codigo: 'am', idiomaDestino: 'Amarico' },
  { nombre: 'Armenio', codigo: 'hy', idiomaDestino: 'Armenio' },
  { nombre: 'Asames', codigo: 'as', idiomaDestino: 'Asames' },
  { nombre: 'Azeri', codigo: 'az', idiomaDestino: 'Azeri' },
  { nombre: 'Bambara', codigo: 'bm', idiomaDestino: 'Bambara' },
  { nombre: 'Bengali', codigo: 'bn', idiomaDestino: 'Bengali' },
  { nombre: 'Bielorruso', codigo: 'be', idiomaDestino: 'Bielorruso' },
  { nombre: 'Birmano', codigo: 'my', idiomaDestino: 'Birmano' },
  { nombre: 'Bosnio', codigo: 'bs', idiomaDestino: 'Bosnio' },
  { nombre: 'Bulgaro', codigo: 'bg', idiomaDestino: 'Bulgaro' },
  { nombre: 'Camboyano', codigo: 'km', idiomaDestino: 'Camboyano' },
  { nombre: 'Catalan', codigo: 'ca', idiomaDestino: 'Catalan' },
  { nombre: 'Cebuano', codigo: 'ceb', idiomaDestino: 'Cebuano' },
  { nombre: 'Checo', codigo: 'cs', idiomaDestino: 'Checo' },
  { nombre: 'Chichewa', codigo: 'ny', idiomaDestino: 'Chichewa' },
  { nombre: 'Chino tradicional', codigo: 'zh-TW', idiomaDestino: 'Chino tradicional' },
  { nombre: 'Cingales', codigo: 'si', idiomaDestino: 'Cingales' },
  { nombre: 'Croata', codigo: 'hr', idiomaDestino: 'Croata' },
  { nombre: 'Danes', codigo: 'da', idiomaDestino: 'Danes' },
  { nombre: 'Divehi', codigo: 'dv', idiomaDestino: 'Divehi' },
  { nombre: 'Eslovaco', codigo: 'sk', idiomaDestino: 'Eslovaco' },
  { nombre: 'Esloveno', codigo: 'sl', idiomaDestino: 'Esloveno' },
  { nombre: 'Estonio', codigo: 'et', idiomaDestino: 'Estonio' },
  { nombre: 'Euskera', codigo: 'eu', idiomaDestino: 'Euskera' },
  { nombre: 'Feroes', codigo: 'fo', idiomaDestino: 'Feroes' },
  { nombre: 'Filipino', codigo: 'fil', idiomaDestino: 'Filipino' },
  { nombre: 'Finlandes', codigo: 'fi', idiomaDestino: 'Finlandes' },
  { nombre: 'Frison', codigo: 'fy', idiomaDestino: 'Frison' },
  { nombre: 'Gallego', codigo: 'gl', idiomaDestino: 'Gallego' },
  { nombre: 'Georgiano', codigo: 'ka', idiomaDestino: 'Georgiano' },
  { nombre: 'Griego', codigo: 'el', idiomaDestino: 'Griego' },
  { nombre: 'Gujarati', codigo: 'gu', idiomaDestino: 'Gujarati' },
  { nombre: 'Haiti criollo', codigo: 'ht', idiomaDestino: 'Haiti criollo' },
  { nombre: 'Hausa', codigo: 'ha', idiomaDestino: 'Hausa' },
  { nombre: 'Hebreo', codigo: 'he', idiomaDestino: 'Hebreo' },
  { nombre: 'Hindi', codigo: 'hi', idiomaDestino: 'Hindi' },
  { nombre: 'Hmong', codigo: 'hmn', idiomaDestino: 'Hmong' },
  { nombre: 'Holandes', codigo: 'nl', idiomaDestino: 'Holandes' },
  { nombre: 'Hungaro', codigo: 'hu', idiomaDestino: 'Hungaro' },
  { nombre: 'Igbo', codigo: 'ig', idiomaDestino: 'Igbo' },
  { nombre: 'Indonesio', codigo: 'id', idiomaDestino: 'Indonesio' },
  { nombre: 'Irlandes', codigo: 'ga', idiomaDestino: 'Irlandes' },
  { nombre: 'Islandes', codigo: 'is', idiomaDestino: 'Islandes' },
  { nombre: 'Javanes', codigo: 'jv', idiomaDestino: 'Javanes' },
  { nombre: 'Kannada', codigo: 'kn', idiomaDestino: 'Kannada' },
  { nombre: 'Kazajo', codigo: 'kk', idiomaDestino: 'Kazajo' },
  { nombre: 'Kinyarwanda', codigo: 'rw', idiomaDestino: 'Kinyarwanda' },
  { nombre: 'Kirgui', codigo: 'ky', idiomaDestino: 'Kirgui' },
  { nombre: 'Kurdo', codigo: 'ku', idiomaDestino: 'Kurdo' },
  { nombre: 'Lao', codigo: 'lo', idiomaDestino: 'Lao' },
  { nombre: 'Latin', codigo: 'la', idiomaDestino: 'Latin' },
  { nombre: 'Leton', codigo: 'lv', idiomaDestino: 'Leton' },
  { nombre: 'Lituano', codigo: 'lt', idiomaDestino: 'Lituano' },
  { nombre: 'Luxemburgues', codigo: 'lb', idiomaDestino: 'Luxemburgues' },
  { nombre: 'Macedonio', codigo: 'mk', idiomaDestino: 'Macedonio' },
  { nombre: 'Malagasy', codigo: 'mg', idiomaDestino: 'Malagasy' },
  { nombre: 'Malayo', codigo: 'ms', idiomaDestino: 'Malayo' },
  { nombre: 'Malayalam', codigo: 'ml', idiomaDestino: 'Malayalam' },
  { nombre: 'Maltes', codigo: 'mt', idiomaDestino: 'Maltes' },
  { nombre: 'Maori', codigo: 'mi', idiomaDestino: 'Maori' },
  { nombre: 'Marati', codigo: 'mr', idiomaDestino: 'Marati' },
  { nombre: 'Mongol', codigo: 'mn', idiomaDestino: 'Mongol' },
  { nombre: 'Nepali', codigo: 'ne', idiomaDestino: 'Nepali' },
  { nombre: 'Noruego', codigo: 'no', idiomaDestino: 'Noruego' },
  { nombre: 'Odia', codigo: 'or', idiomaDestino: 'Odia' },
  { nombre: 'Pasto', codigo: 'ps', idiomaDestino: 'Pasto' },
  { nombre: 'Persa', codigo: 'fa', idiomaDestino: 'Persa' },
  { nombre: 'Polaco', codigo: 'pl', idiomaDestino: 'Polaco' },
  { nombre: 'Punjabi', codigo: 'pa', idiomaDestino: 'Punjabi' },
  { nombre: 'Rumano', codigo: 'ro', idiomaDestino: 'Rumano' },
  { nombre: 'Ruso', codigo: 'ru', idiomaDestino: 'Ruso' },
  { nombre: 'Samoano', codigo: 'sm', idiomaDestino: 'Samoano' },
  { nombre: 'Serbio', codigo: 'sr', idiomaDestino: 'Serbio' },
  { nombre: 'Sesoto', codigo: 'st', idiomaDestino: 'Sesoto' },
  { nombre: 'Shona', codigo: 'sn', idiomaDestino: 'Shona' },
  { nombre: 'Sindhi', codigo: 'sd', idiomaDestino: 'Sindhi' },
  { nombre: 'Somali', codigo: 'so', idiomaDestino: 'Somali' },
  { nombre: 'Suajili', codigo: 'sw', idiomaDestino: 'Suajili' },
  { nombre: 'Sueco', codigo: 'sv', idiomaDestino: 'Sueco' },
  { nombre: 'Sundanes', codigo: 'su', idiomaDestino: 'Sundanes' },
  { nombre: 'Tailandes', codigo: 'th', idiomaDestino: 'Tailandes' },
  { nombre: 'Tamil', codigo: 'ta', idiomaDestino: 'Tamil' },
  { nombre: 'Tartaro', codigo: 'tt', idiomaDestino: 'Tartaro' },
  { nombre: 'Tayiko', codigo: 'tg', idiomaDestino: 'Tayiko' },
  { nombre: 'Telugu', codigo: 'te', idiomaDestino: 'Telugu' },
  { nombre: 'Tigriya', codigo: 'ti', idiomaDestino: 'Tigriya' },
  { nombre: 'Turco', codigo: 'tr', idiomaDestino: 'Turco' },
  { nombre: 'Turcomano', codigo: 'tk', idiomaDestino: 'Turcomano' },
  { nombre: 'Ucraniano', codigo: 'uk', idiomaDestino: 'Ucraniano' },
  { nombre: 'Urdu', codigo: 'ur', idiomaDestino: 'Urdu' },
  { nombre: 'Uigur', codigo: 'ug', idiomaDestino: 'Uigur' },
  { nombre: 'Uzbeko', codigo: 'uz', idiomaDestino: 'Uzbeko' },
  { nombre: 'Valenciano', codigo: 'ca-ES-valencia', idiomaDestino: 'Valenciano' },
  { nombre: 'Vietnamita', codigo: 'vi', idiomaDestino: 'Vietnamita' },
  { nombre: 'Xhosa', codigo: 'xh', idiomaDestino: 'Xhosa' },
  { nombre: 'Yoruba', codigo: 'yo', idiomaDestino: 'Yoruba' },
  { nombre: 'Zulu', codigo: 'zu', idiomaDestino: 'Zulu' },
];

const COMPOSE_AI_TRANSLATION_LANGUAGES: ComposeAiLanguageOption[] = [
  ...COMPOSE_AI_PRIMARY_TRANSLATION_LANGUAGES,
  ...COMPOSE_AI_OTHER_TRANSLATION_LANGUAGES,
];

interface ChatPollVoterView {
  userId: number;
  photoUrl: string | null;
  initials: string;
  votedAt?: string | null;
}

interface ChatPollOptionView {
  id: string;
  text: string;
  count: number;
  percent: number;
  selected: boolean;
  isLeading: boolean;
  voters: ChatPollVoterView[];
}

interface PollVoteEntryView {
  userId: number;
  label: string;
  fullName: string;
  photoUrl: string | null;
  initials: string;
  votedAt: string | null;
  votedAtLabel: string;
  isCurrentUser: boolean;
}

/**
 * Representa los diferentes estados en los que puede estar un usuario.
 */
export type EstadoUsuario = 'Conectado' | 'Desconectado' | 'Ausente';
type ChatListFilter = 'TODOS' | 'NO_LEIDOS' | 'FAVORITOS' | 'GRUPOS';
type SidebarSection = 'CHATS' | 'STARRED' | 'PUBLIC';

interface PublicChatListItem {
  id: number;
  nombre: string;
  descripcion: string;
  miembros: number;
  badge: 'Publico';
  initials: string;
  gradient: string;
  badgeColor: string;
}

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
  private readonly chatAvatarPalette: readonly string[] = [
    '#f97316',
    '#22c55e',
    '#ca8a04',
    '#06b6d4',
    '#ef4444',
    '#8b5cf6',
    '#3b82f6',
    '#ec4899',
    '#65a30d',
    '#14b8a6',
  ];
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

  public gruposEscribiendo = new Set<number>(); // chatId ? hay alguien escribiendo
  public quienEscribeEnGrupo = new Map<number, string>();
  public gruposGrabandoAudio = new Set<number>(); // chatId ? hay alguien grabando audio
  public quienGrabaAudioEnGrupo = new Map<number, string>();

  public trackMensaje = (_: number, m: MensajeDTO) => m.id ?? _;
  public trackIndex = (_: number, __: unknown) => _;
  public trackQuickReply = (_: number, reply: string) => reply;

  public mensajeNuevo: string = '';
  public readonly adminDirectReplyDisabledPlaceholder =
    'No se puede contestar a este mensaje ya que se trata de un Administrador.';
  public readonly incomingReactionChoices = ['??', '??', '??', '??', '??'];
  private readonly incomingReactionChoicesSet = new Set(
    this.incomingReactionChoices
  );
  public recBars = Array.from({ length: 14 });
  public showEmojiPicker = false;
  public myStickers: StickerDTO[] = [];
  public stickersLoading = false;
  public stickerSaving = false;
  public stickerEditorVisible = false;
  public stickerDraftFile: File | null = null;
  public stickerDraftPreviewUrl: string | null = null;
  public stickerDraftName = '';
  public showIncomingStickerSavePopup = false;
  public incomingStickerPreviewSrc = '';
  public incomingStickerSuggestedName = '';
  public incomingStickerSaving = false;
  public incomingStickerOwnedChecking = false;
  public incomingStickerAlreadyOwned = false;
  public incomingStickerSourceId: number | null = null;
  public incomingStickerOwnedLocalId: number | null = null;
  private stickerPreviewObjectUrls: string[] = [];
  public showComposeActionsPopup = false;
  public showComposeAiPopup = false;
  public mostrarMenuIdiomasIa = false;
  public composerAiError: string | null = null;
  public idiomaSeleccionadoIa: string | null = null;
  public filtroIdiomasIa = '';
  public showTemporaryMessagePopup = false;
  public showReportChatClosurePopup = false;
  public reportChatClosureSending = false;
  public reportChatClosureText = '';
  public reportChatClosureTarget: any | null = null;
  public showReportUserPopup = false;
  public reportUserAiLoading = false;
  public reportUserAiMessage = '';
  public reportUserSending = false;
  public reportUserSuccess = false;
  public reportUserReason = '';
  public reportUserDetail = '';
  public reportUserTarget: any | null = null;
  public showGroupPollComposer = false;
  public pollComposerIaChatGrupalId: number | null = null;
  public pollComposerIaMensajesContexto: AiPollDraftContextMessageDTO[] = [];
  public pollComposerAutogenerarIa = false;
  public showScheduleMessageComposer = false;
  public showChatListHeaderMenu = false;
  public showGlobalMessageSearchPopup = false;
  public globalMessageSearchConsulta = '';
  public globalMessageSearchLoading = false;
  public globalMessageSearchError: string | null = null;
  public globalMessageSearchResumenBusqueda: string | null = null;
  public globalMessageSearchResultados: AiEncryptedMessageSearchResult[] = [];
  public showMuteDurationPicker = false;
  public muteDurationTargetChat: any | null = null;
  public muteRequestInFlight = false;
  public deleteChatRequestInFlight = false;
  public openChatPinMenuChatId: number | null = null;
  public readonly temporaryMessageOptions: TemporaryMessageOption[] = [
    { label: 'Desactivar', seconds: null, badge: '' },
    { label: '24 horas', seconds: 24 * 60 * 60, badge: '24h' },
    { label: '7 horas', seconds: 7 * 60 * 60, badge: '7h' },
    { label: '2 minutos', seconds: 2 * 60, badge: '2m' },
  ];
  public readonly muteDurationOptions: MuteDurationOption[] = [
    {
      label: '8 horas',
      durationMs: 8 * 60 * 60 * 1000,
      helper: 'Silencia por el resto del día',
    },
    {
      label: '1 semana',
      durationMs: 7 * 24 * 60 * 60 * 1000,
      helper: 'Ideal para pausas largas',
    },
    {
      label: 'Siempre',
      durationMs: null,
      helper: 'Hasta que vuelvas a activarlo',
    },
  ];
  public readonly reportUserReasonOptions = [
    { value: 'Spam o contenido no deseado', label: 'Spam o contenido no deseado' },
    { value: 'Acoso o comportamiento abusivo', label: 'Acoso o comportamiento abusivo' },
    { value: 'Discurso de odio', label: 'Discurso de odio' },
    { value: 'Amenazas o intimidacion', label: 'Amenazas o intimidacion' },
    { value: 'Suplantacion de identidad', label: 'Suplantacion de identidad' },
    { value: 'Estafa o fraude', label: 'Estafa o fraude' },
    { value: 'Contenido sexual no solicitado', label: 'Contenido sexual no solicitado' },
    { value: 'Difusion de datos personales', label: 'Difusion de datos personales' },
    { value: 'Contenido violento o autolesivo', label: 'Contenido violento o autolesivo' },
    { value: 'Incitacion a actividades ilegales', label: 'Incitacion a actividades ilegales' },
    { value: 'Otro motivo', label: 'Otro motivo' },
  ];
  private reportUserAiAnalysisSeq = 0;
  public attachmentUploading = false;
  public pendingAttachmentFile: File | null = null;
  public pendingAttachmentPreviewUrl: string | null = null;
  public pendingAttachmentIsImage = false;
  public messageAreaDragActive = false;
  public showFilePreview = false;
  public filePreviewSrc = '';
  public filePreviewName = '';
  public filePreviewSize = '';
  public filePreviewType = '';
  public filePreviewMime = '';

  public chatActual: any = null;
  public usuariosEscribiendo: Set<number> = new Set();
  public usuariosGrabandoAudio: Set<number> = new Set();

  @ViewChild('contenedorMensajes') private contenedorMensajes!: ElementRef;
  @ViewChild('messageInput')
  private messageInputRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('attachmentInput')
  private attachmentInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('stickerFileInput')
  private stickerFileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('composeActionsAnchor')
  private composeActionsAnchorRef?: ElementRef<HTMLElement>;
  @ViewChild('composeAiAnchor')
  private composeAiAnchorRef?: ElementRef<HTMLElement>;
  @ViewChild('emojiAnchor')
  private emojiAnchorRef?: ElementRef<HTMLElement>;
  @ViewChild('temporaryMessageAnchor')
  private temporaryMessageAnchorRef?: ElementRef<HTMLElement>;

  public usuarioEscribiendo: boolean = false;
  public usuarioGrabandoAudio: boolean = false;

  public estadoPropio = 'Conectado';
  public estadoActual: string = 'Conectado';

  public notifItems: Array<GroupInviteResponseWS & { kind: 'RESPONSE' }> = [];

  public usuarioFotoUrl: string | null = null;
  public perfilUsuario: UsuarioDTO | null = null;
  public showTopbarProfileMenu = false;
  public activeMainView: 'chat' | 'profile' = 'chat';
  public sidebarSection: SidebarSection = 'CHATS';
  public publicChatsSearch = '';
  public publicChats: PublicChatListItem[] = [];
  public publicChatsLoading = false;
  public mensajesDestacados: StarredMessageItem[] = [];
  public starredPage = 0;
  public starredPageSize = 10;
  public starredTotalPages = 1;
  public starredTotalElements = 0;
  public starredHasNext = false;
  public starredHasPrevious = false;
  public profilePasswordCodeRequested = false;
  public profileSaving = false;
  public profileCodeTimeLeftSec = 0;

  public escribiendoHeader = '';
  public audioGrabandoHeader = '';

  public audioStates = new Map<
    number,
    { playing: boolean; current: number; duration: number }
  >();

  public aiPanelOpen = false;
  public readonly aiTextMode = AiTextMode;
  public aiQuote = '';
  public aiLoading = false;
  public cargandoIaInput = false;
  public cargandoIaMensaje = false;
  public cargandoResumenIa = false;
  public quickReplies: string[] = [];
  public quickRepliesMessageId: number | null = null;
  public cargandoQuickReplies = false;
  public errorQuickReplies: string | null = null;
  public quickRepliesChatKey: string | null = null;
  public enviandoQuickReply = false;
  public mensajeSeleccionadoParaIa: MensajeDTO | null = null;
  public preguntaIaMensaje = '';
  public respuestaIaMensaje = '';
  public resumenIa = '';
  public errorIa: string | null = null;
  public errorResumenIa = '';
  public mostrarModalPreguntaIa = false;
  public mostrarPopupResumenIa = false;
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

  public get isStarredView(): boolean {
    return this.sidebarSection === 'STARRED';
  }

  public get isPublicChatsView(): boolean {
    return this.sidebarSection === 'PUBLIC';
  }

  public get filteredPublicChats(): PublicChatListItem[] {
    const query = normalizeSearchText(this.publicChatsSearch || '');
    if (!query) return this.publicChats;
    return this.publicChats.filter((chat) =>
      normalizeSearchText(
        `${chat.nombre} ${chat.descripcion} ${chat.badge} ${chat.miembros}`
      ).includes(query)
    );
  }

  public get isStarredLoading(): boolean {
    return this.loadingStarredMessages;
  }

  public get mensajesDestacadosOrdenados(): StarredMessageItem[] {
    const loadedById = this.buildLoadedMessageIndexForStarred();
    return [...(this.mensajesDestacados || [])]
      .map((item) =>
        this.enrichStarredItemWithLoadedMessage(item, loadedById)
      )
      .sort((a, b) => {
      const left = Date.parse(String(a?.starredAt || a?.fechaEnvio || '')) || 0;
      const right = Date.parse(String(b?.starredAt || b?.fechaEnvio || '')) || 0;
      return right - left;
      });
  }

  private buildLoadedMessageIndexForStarred(): Map<number, MensajeDTO> {
    const byId = new Map<number, MensajeDTO>();
    const append = (list: MensajeDTO[] | null | undefined): void => {
      if (!Array.isArray(list) || list.length === 0) return;
      for (const message of list) {
        const messageId = Number(message?.id);
        if (!Number.isFinite(messageId) || messageId <= 0) continue;
        if (byId.has(messageId)) continue;
        byId.set(messageId, message);
      }
    };

    append(this.mensajesSeleccionados);
    for (const state of this.historyStateByConversation.values()) {
      append(state?.messages);
    }
    append(Array.from(this.starredHydratedMessagesById.values()));
    return byId;
  }

  private enrichStarredItemWithLoadedMessage(
    item: StarredMessageItem,
    loadedById: Map<number, MensajeDTO>
  ): StarredMessageItem {
    const messageId = Number(item?.messageId);
    if (!Number.isFinite(messageId) || messageId <= 0) return item;

    const loaded = loadedById.get(messageId);
    if (!loaded) return item;

    const loadedTipo =
      String(loaded?.tipo || item?.tipo || 'TEXT').trim().toUpperCase() || 'TEXT';
    const loadedPreview = this.buildStarredMessagePreview(loaded);
    const loadedFecha =
      String(loaded?.fechaEnvio || item?.fechaEnvio || '').trim() || null;
    const loadedChatIdRaw = Number(loaded?.chatId ?? item?.chatId);
    const loadedChatId =
      Number.isFinite(loadedChatIdRaw) && loadedChatIdRaw > 0
        ? Math.round(loadedChatIdRaw)
        : item.chatId;
    const loadedEmisorIdRaw = Number(loaded?.emisorId ?? item?.emisorId);
    const loadedEmisorId =
      Number.isFinite(loadedEmisorIdRaw) && loadedEmisorIdRaw > 0
        ? Math.round(loadedEmisorIdRaw)
        : item.emisorId;
    const loadedEmisorNombre =
      `${loaded?.emisorNombre || ''} ${loaded?.emisorApellido || ''}`.trim() ||
      this.resolveGroupMemberDisplayName(Number(loadedChatId || 0), loadedEmisorId) ||
      item.emisorNombre;

    if (
      loadedTipo === item.tipo &&
      loadedPreview === item.preview &&
      loadedFecha === item.fechaEnvio &&
      loadedChatId === item.chatId &&
      loadedEmisorId === item.emisorId &&
      loadedEmisorNombre === item.emisorNombre
    ) {
      const mediaPatch = this.buildStarredMediaPatchFromMessage(loaded);
      if (
        (mediaPatch.audioSrc ?? null) === (item.audioSrc ?? null) &&
        (mediaPatch.audioDurationLabel ?? null) === (item.audioDurationLabel ?? null) &&
        (mediaPatch.imageSrc ?? null) === (item.imageSrc ?? null) &&
        (mediaPatch.imageAlt ?? null) === (item.imageAlt ?? null) &&
        (mediaPatch.imageCaption ?? null) === (item.imageCaption ?? null) &&
        (mediaPatch.fileSrc ?? null) === (item.fileSrc ?? null) &&
        (mediaPatch.fileName ?? null) === (item.fileName ?? null) &&
        (mediaPatch.fileSizeLabel ?? null) === (item.fileSizeLabel ?? null) &&
        (mediaPatch.fileTypeLabel ?? null) === (item.fileTypeLabel ?? null) &&
        (mediaPatch.fileIconClass ?? null) === (item.fileIconClass ?? null) &&
        (mediaPatch.fileCaption ?? null) === (item.fileCaption ?? null)
      ) {
        return item;
      }

      return {
        ...item,
        ...mediaPatch,
      };
    }

    return {
      ...item,
      tipo: loadedTipo,
      preview: loadedPreview,
      fechaEnvio: loadedFecha,
      chatId: loadedChatId,
      emisorId: loadedEmisorId,
      emisorNombre: loadedEmisorNombre,
      ...this.buildStarredMediaPatchFromMessage(loaded),
    };
  }

  public get blockedMeIdsArray(): number[] {
    return Array.from(this.meHanBloqueadoIds || []);
  }

  public get leftGroupIdsArray(): number[] {
    return Array.from(this.getLeftGroupIdsSet());
  }

  public busquedaUsuario = '';
  public mostrarMenuOpciones = false;
  public openMensajeMenuId: number | null = null;
  public pinnedMessage: ChatPinnedMessageDTO | null = null;
  public showPinnedActionsMenu = false;
  public showPinDurationPicker = false;
  public pinTargetMessage: MensajeDTO | null = null;
  public pinRequestInFlight = false;
  public unpinRequestInFlight = false;
  public readonly pinDurationOptions: PinDurationOption[] = [
    { label: '24 horas', seconds: 24 * 60 * 60, helper: 'Ideal para avisos rapidos' },
    { label: '7 dias', seconds: 7 * 24 * 60 * 60, helper: 'Recomendado para temas activos' },
    { label: '30 dias', seconds: 30 * 24 * 60 * 60, helper: 'Para referencias largas' },
  ];
  private messageReactionsByMessageId = new Map<number, MessageReactionStateItem[]>();
  private pollLocalSelectionByMessageId = new Map<number, Set<string>>();
  public openIncomingReactionPickerMessageId: number | null = null;
  public openReactionDetailsMessageId: number | null = null;
  public mensajeRespuestaObjetivo: MensajeDTO | null = null;
  public mensajeEdicionObjetivo: MensajeDTO | null = null;
  public forwardModalOpen = false;
  public mensajeReenvioOrigen: MensajeDTO | null = null;
  public forwardSelectedChatIds = new Set<number>();
  public forwardingInProgress = false;
  public showGroupInfoPanel = false;
  public showGroupInfoPanelMounted = false;
  private groupInfoCloseTimer: any = null;
  public showUserInfoPanel = false;
  public showUserInfoPanelMounted = false;
  private userInfoCloseTimer: any = null;
  public showMessageSearchPanel = false;
  public showMessageSearchPanelMounted = false;
  private messageSearchCloseTimer: any = null;
  public showPollVotesPanel = false;
  public showPollVotesPanelMounted = false;
  public pollVotesPanelMessageId: number | null = null;
  private pollVotesCloseTimer: any = null;
  private scheduleCreateInFlight = false;
  private scheduledDeliveryProbeTimers = new Set<ReturnType<typeof setTimeout>>();
  public highlightedMessageId: number | null = null;
  private highlightedMessageTimer: any = null;
  private messageSearchNavigationInFlight = false;
  private messageScrollAnimationFrame: number | null = null;
  private pendingOpenFromStarredNavigation: {
    chatId: number;
    messageId: number;
  } | null = null;
  private pendingOpenFromBrowserNotificationChatId: number | null = null;
  private browserNotificationRouteSub?: Subscription;
  private composeCursorStart = 0;
  private composeCursorEnd = 0;
  private messageAreaDragDepth = 0;
  private readonly MAX_ATTACHMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
  private readonly DELETED_MESSAGE_RETENTION_HOURS = 3;
  private readonly DELETED_MESSAGE_RETENTION_MS =
    this.DELETED_MESSAGE_RETENTION_HOURS * 60 * 60 * 1000;
  private restoringDeletedMessageIds = new Set<number>();
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
  private readonly MESSAGE_EDIT_WINDOW_MS = 30 * 60 * 1000;
  private suscritosEstado = new Set<number>();
  private mensajesMarcadosComoLeidosPendientes: number[] = [];
  private escribiendoTimeout: any;
  private grabandoAudioTimeout: any;
  private callInfoTimer?: any;
  private outgoingRingbackCtx?: AudioContext;
  private outgoingRingbackOsc?: OscillatorNode;
  private outgoingRingbackGain?: GainNode;
  private outgoingRingbackTimer?: any;
  private outgoingRingbackActive = false;
  private incomingRingtoneCtx?: AudioContext;
  private incomingRingtoneOsc?: OscillatorNode;
  private incomingRingtoneGain?: GainNode;
  private incomingRingtoneTimer?: any;
  private incomingRingtoneActive = false;
  private readonly MESSAGE_NOTIFICATION_TONE_COOLDOWN_MS = 1200;
  private lastMessageNotificationToneAt = 0;
  private readonly composerTextareaMinHeightPx = 40;
  private readonly composerTextareaMaxHeightPx = 260;
  private lastComposerTextareaValue = '';
  private composerResizeQueued = false;
  private outgoingCallPendingAcceptance = false;
  private signalingBlockedCallIds = new Set<string>();
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
  private tabOcultaTimer: any;
  private readonly presenciaActividadEventos = ['mousemove', 'keydown', 'click', 'scroll'];
  private presenciaOnActividad?: () => void;
  private presenciaOnVisibilidadChange?: () => void;
  private topbarEstadoSuscritos = new Set<number>();
  private enrichedUsers = new Set<number>();
  private HANDLED_INVITES_KEY = 'handledInviteIds';
  private readonly LEFT_GROUP_IDS_KEY = 'leftGroupIds';
  private readonly LEFT_GROUP_NOTICE_KEY = 'leftGroupNoticeByChat';
  private readonly CHAT_DRAFTS_KEY = 'chatDraftsByChat';
  private readonly TEMPORARY_CHAT_SETTINGS_KEY = 'chatTemporarySecondsByChat';
  private readonly PINNED_CHAT_ID_KEY = 'pinnedChatId';
  private readonly FAVORITE_CHAT_ID_KEY = 'favoriteChatId';
  private readonly ADMIN_DIRECT_CHAT_CACHE_KEY = 'adminDirectChatCacheByChat';
  private readonly ADMIN_DIRECT_MESSAGES_CACHE_KEY = 'adminDirectMessagesByChat';
  private readonly OPEN_PROFILE_AFTER_REGISTER_KEY = 'openProfileAfterRegister';
  private readonly OPEN_CHAT_QUERY_PARAM = 'openChatId';
  private readonly resumenIaEstiloDefault: AiConversationSummaryRequestDTO['estilo'] =
    'BREVE';
  private readonly resumenIaMaxLineasDefault = 6;
  private readonly resumenIaMaxMensajes = 50;
  private readonly QUICK_REPLIES_MAX_VISIBLE = 3;
  private readonly QUICK_REPLIES_DEBOUNCE_MS = 1500;
  private readonly QUICK_REPLIES_COOLDOWN_MS = 2 * 60 * 1000;
  private readonly QUICK_REPLIES_MIN_MESSAGE_CHARS = 8;
  private readonly QUICK_REPLIES_MAX_MESSAGE_CHARS = 120;
  private readonly POLL_IA_MAX_CONTEXT_MESSAGES = 100;
  private readonly POLL_IA_MAX_MESSAGE_CHARS = 200;
  private resumenIaRequestSeq = 0;
  private quickRepliesRequestSeq = 0;
  private quickRepliesDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private quickRepliesCache = new Map<string, string[]>();
  private quickRepliesLastGeneratedByChat = new Map<string, number>();
  private quickRepliesRequestSub?: Subscription;
  private draftByChatId = new Map<number, string>();
  private temporarySecondsByChatId = new Map<number, number>();
  private mutedChatUntilByChatId = new Map<number, number | null>();
  private closedGroupReasonByChatId = new Map<number, string>();
  private adminDirectReadOnlyChatIds = new Set<number>();
  private adminDirectChatCacheById = new Map<number, AdminDirectChatCacheEntry>();
  private adminDirectMessagesCacheByChatId = new Map<number, AdminDirectMessagesCacheEntry>();
  private readonly DEFAULT_GROUP_CHAT_CLOSED_REASON =
    'Este chat ha sido cerrado por administracion.';
  private readonly starredMessageIds = new Set<number>();
  private readonly starredHydratedMessagesById = new Map<number, MensajeDTO>();
  private starredHydrationRequestSeq = 0;
  private readonly starringMessageIds = new Set<number>();
  private pinnedMessageRequestSeq = 0;
  private loadingStarredMessages = false;
  private composerDraftPrefixVisible = false;
  private mediaRecorder?: MediaRecorder;
  private micStream?: MediaStream;
  private audioChunks: BlobPart[] = [];
  private recordStartMs = 0;
  private recordTicker?: any;
  private currentPlayingId: number | null = null;
  private videoTransceiver?: RTCRtpTransceiver;
  private currentLocalVideoTrack?: MediaStreamTrack;
  private banWsBound = false;
  private closedChatWsBound = false;
  private profileCodeTimer?: any;
  private chatsRefreshTimer: any = null;
  private chatListAccessForbidden = false;
  private chatListForbiddenToastShown = false;
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
  private audioSetHeader = new Set<string>();
  private lastAudioPingMs = 0;
  private e2eWsErrorsBound = false;
  private pendingGroupTextSendByChatId = new Map<number, PendingGroupTextSendContext>();
  private retryingGroupTextSendByChatId = new Set<number>();
  private groupTextSendInFlightByChatId = new Set<number>();
  private decryptedAudioUrlByCacheKey = new Map<string, string>();
  private decryptingAudioByCacheKey = new Map<string, Promise<string | null>>();
  private decryptedImageUrlByCacheKey = new Map<string, string>();
  private decryptedImageCaptionByCacheKey = new Map<string, string>();
  private decryptingImageByCacheKey = new Map<string, Promise<string | null>>();
  private decryptedFileUrlByCacheKey = new Map<string, string>();
  private decryptedFileCaptionByCacheKey = new Map<string, string>();
  private decryptingFileByCacheKey = new Map<string, Promise<string | null>>();
  private secureAttachmentUrlByCacheKey = new Map<string, string>();
  private secureAttachmentLoadingByCacheKey = new Map<
    string,
    Promise<SecureAttachmentLoadResult>
  >();

  public busquedaChat: string = '';
  public chatListFilter: ChatListFilter = 'TODOS';
  public pinnedChatId: number | null = null;
  public favoriteChatId: number | null = null;
  public chatListLoading = true;
  private messagesInitialLoadingConversationKey: string | null = null;

  public bloqueadosIds = new Set<number>();
  public bloqueadosPorDenunciaIds = new Set<number>();
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
    private aiService: AiService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private cryptoService: CryptoService,
    private authService: AuthService,
    private complaintService: ComplaintService,
    private notificationService: NotificationService,
    private browserNotificationService: BrowserNotificationService,
    private groupInviteService: GroupInviteService,
    private stickerService: StickerService,
    private route: ActivatedRoute,
    private router: Router,
    private sessionService: SessionService
  ) {
    window.addEventListener('beforeunload', () => {
      this.persistActiveChatDraft();
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
    const openProfileAfterRegister =
      sessionStorage.getItem(this.OPEN_PROFILE_AFTER_REGISTER_KEY) === 'true';
    this.resetEdicion();
    this.cargarPerfil();
    this.inicializarDeteccionInactividad();

    if (!id) {
      console.warn('?? No hay usuario logueado');
      return;
    }

    this.usuarioActualId = parseInt(id, 10);
    this.browserNotificationService.requestPermissionIfNeeded();
    this.bindBrowserNotificationRoute();
    if (openProfileAfterRegister) {
      sessionStorage.removeItem(this.OPEN_PROFILE_AFTER_REGISTER_KEY);
      this.openProfileView();
    }
    this.loadAdminDirectChatCacheFromStorage();
    this.loadAdminDirectMessagesCacheFromStorage();
    this.loadChatDraftsFromStorage();
    this.loadTemporarySettingsFromStorage();
    this.loadPinnedChatFromStorage();
    this.loadFavoriteChatFromStorage();
    this.loadFavoriteChatFromBackend();
    this.loadMutedChatsFromBackend();
    this.loadStarredMessagesFromBackend();
    void this.ensureLocalE2EKeysAndSyncPublicKey(this.usuarioActualId);
    void this.ensureAuditPublicKeyForE2E();

    // Recuperar bloqueados cacheados
    const cachedBloqueados = localStorage.getItem('bloqueadosIds');
    if (cachedBloqueados) {
      try {
        this.bloqueadosIds = new Set(JSON.parse(cachedBloqueados) as number[]);
      } catch (e) {}
    }
    const cachedBloqueadosPorDenuncia = localStorage.getItem('bloqueadosPorDenunciaIds');
    if (cachedBloqueadosPorDenuncia) {
      try {
        this.bloqueadosPorDenunciaIds = new Set(
          JSON.parse(cachedBloqueadosPorDenuncia) as number[]
        );
      } catch (e) {}
    }

    // Recuperar quién nos bloqueó
    const cachedMeHanBloqueado = localStorage.getItem('meHanBloqueadoIds');
    if (cachedMeHanBloqueado) {
      try {
        this.meHanBloqueadoIds = new Set(JSON.parse(cachedMeHanBloqueado) as number[]);
      } catch (e) {}
    }

    // ?? Inicializa claves locales y pública bundle (si no existe)

    // Contador unseen inicial
    this.notificationService.unseenCount().subscribe({
      next: (n) => {
        this.unseenCount = n;
        this.cdr.markForCheck();
      },
      error: (e) => console.error('? unseenCount:', e),
    });

    // Sincroniza lista de tarjetas (por si te perdiste WS)
    this.syncNotifsFromServer();

    // 1) Conectar WS
    this.wsService.conectar(() => {
      // 2) Esperar a conexión para inicializar resto
      this.wsService.esperarConexion(() => {
        this.bindBanWsListener();
        this.bindClosedChatWsListener();
        this.bindE2EWsErrorListener();
        this.wsService.enviarEstadoConectado();
        this.prepararSuscripcionesWebRTC();
        // ?? Llamadas: invitaciones entrantes (cuando me llaman)
        this.wsService.suscribirseALlamadasEntrantes(
          this.usuarioActualId,
          (invite) => {
            this.ngZone.run(() => {
              this.ultimaInvite = invite; // muestra el panel entrante
              this.currentCallId = invite.callId; // guarda el id
              this.wsService.setActiveCallSession(
                invite.callId,
                Number(invite.callerId),
                Number(invite.calleeId)
              );
              this.signalingBlockedCallIds.delete(String(invite.callId || '').trim());
              this.startIncomingRingtone();
              this.cdr.markForCheck();
            });
          }
        );

        // Llamadas: respuestas (cuando el otro acepta/rechaza lo que yo llame)
        this.wsService.suscribirseARespuestasLlamada(
          this.usuarioActualId,
          (answer) => {
            this.ngZone.run(async () => {
              const answerCallId = String(answer?.callId || '').trim();
              if (answerCallId) {
                this.wsService.setActiveCallSession(
                  answerCallId,
                  Number(answer.toUserId),
                  Number(answer.fromUserId)
                );
                this.signalingBlockedCallIds.delete(answerCallId);
              }
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
                  this.stopOutgoingRingback();
                  this.outgoingCallPendingAcceptance = false;
                  this.isMuted = false;
                  this.setLocalAudioEnabled(true);
                  await this.onAnswerAccepted(answer.callId, answer.fromUserId);
                  // quita “Llamando…”
                  this.callInfoMessage = null;
                } else if (soyCallee) {
                  this.stopIncomingRingtone();
                }
              } else {
                // ? Rechazada
                if (soyCaller) {
                  this.stopOutgoingRingback();
                  this.outgoingCallPendingAcceptance = false;
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
                  this.stopIncomingRingtone();
                  this.ultimaInvite = undefined;
                  this.showCallUI = false;
                  this.callInfoMessage = null;
                  this.currentCallId = undefined;
                  if (answerCallId) this.wsService.clearActiveCallSession(answerCallId);
                  this.cdr.markForCheck();
                }
              }
            });
          }
        );

        // ?? Llamadas: fin (colgar)
        this.wsService.suscribirseAFinLlamada(this.usuarioActualId, (end) => {
          this.ngZone.run(() => {
            const endedCallId = String(end?.callId || '').trim();
            if (endedCallId) {
              this.signalingBlockedCallIds.add(endedCallId);
              this.wsService.markCallEnded(endedCallId);
            }
            this.stopOutgoingRingback();
            this.stopIncomingRingtone();
            this.outgoingCallPendingAcceptance = false;
            if (this.ultimaInvite && end.callId === this.ultimaInvite.callId) {
              this.ultimaInvite = undefined; // ?? quita el banner
              this.currentCallId = undefined;
              if (endedCallId) this.wsService.clearActiveCallSession(endedCallId);
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
              this.playHangupTone();
              // ?? nombre del peer (si lo tienes en el chat actual)
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

        // ?? Notificaciones (unseen / invites / responses)
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
                  return; // contador de otro usuario ? ignorar
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

        // ?? Reconfirmar unseen
        this.notificationService.unseenCount().subscribe({
          next: (n) => {
            this.unseenCount = n;
            this.cdr.markForCheck();
          },
          error: (e) => console.error('? unseenCount:', e),
        });

        // ?? Mensajes nuevos (individual)
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
            if (this.isAdminDirectChatExpiredEvent(mensajeRaw)) {
              this.debugAdminWarningFlow('ws-admin-expired-event-raw', {
                payload: this.extractAdminWarningDebugMeta(mensajeRaw),
              });
              this.ngZone.run(() => {
                this.handleAdminDirectChatExpiredEvent(mensajeRaw);
              });
              return;
            }
            if (this.isAdminDirectChatListUpdatedEvent(mensajeRaw)) {
              this.debugAdminWarningFlow('ws-admin-list-updated-event-raw', {
                chatId: Number((mensajeRaw as any)?.chatId || 0) || null,
                ultimoMensajeId:
                  Number((mensajeRaw as any)?.ultimoMensajeId || 0) || null,
              });
              this.ngZone.run(() => {
                this.handleAdminDirectChatListUpdatedEvent(mensajeRaw);
              });
              return;
            }
            if (this.isAdminDirectChatRemovedEvent(mensajeRaw)) {
              this.debugAdminWarningFlow('ws-admin-removed-event-raw', {
                chatId: Number((mensajeRaw as any)?.chatId || 0) || null,
              });
              this.ngZone.run(() => {
                this.handleAdminDirectChatRemovedEvent(mensajeRaw);
              });
              return;
            }
            let mensaje = mensajeRaw as MensajeDTO;
            if (this.looksLikeAdminWarningMessage(mensajeRaw)) {
              this.debugAdminWarningFlow('ws-message-before-decrypt', {
                payload: this.extractAdminWarningDebugMeta(mensajeRaw),
              });
            }
            const wsEmisorId = Number(
              (mensaje as any)?.emisorId ?? (mensaje as any)?.emisor?.id ?? 0
            );
            const wsReceptorId = Number(
              (mensaje as any)?.receptorId ?? (mensaje as any)?.receptor?.id ?? 0
            );
            const decryptInput = this.resolveDecryptInputFromMessageLike(mensaje);
            this.preserveEncryptedPayloadForIaSummary(mensaje, decryptInput);
            this.applySenderProfilePhotoFromDecryptInput(mensaje, decryptInput);
            // NOTE: decrypting before entering ngZone run to keep it linear
            mensaje.contenido = await this.decryptContenido(
              decryptInput,
              wsEmisorId,
              wsReceptorId,
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
            await this.hydrateIncomingFileMessage(mensaje, {
              chatId: Number(mensaje?.chatId),
              mensajeId: Number(mensaje?.id),
              source: 'ws-individual-file',
            });
            if (this.looksLikeAdminWarningMessage(mensaje)) {
              this.debugAdminWarningFlow('ws-message-after-decrypt', {
                payload: this.extractAdminWarningDebugMeta(mensaje),
              });
            }
            mensaje = this.normalizeMensajeEditadoFlag(mensaje);
            this.maybeShowBrowserNotificationForIncomingMessage(mensaje);
            this.ngZone.run(async () => {
              this.applyAdminDirectReadOnlyFromMessage(mensaje);
              const isSystemIncoming = this.isSystemMessage(mensaje);
              const isOwnGroupExpulsion =
                this.maybeApplyGroupExpulsionStateFromMessage(mensaje);
              if (isOwnGroupExpulsion) {
                this.cdr.markForCheck();
                return;
              }
              if (isSystemIncoming && this.isPrivateExpulsionNoticeSystemMessage(mensaje)) {
                const chatId = Number(mensaje?.chatId || 0);
                const receptorId = Number(mensaje?.receptorId || 0);
                if (
                  Number.isFinite(chatId) &&
                  chatId > 0 &&
                  receptorId === Number(this.usuarioActualId)
                ) {
                  const notice =
                    String(mensaje?.contenido || '').trim() ||
                    'Has sido expulsado del grupo';
                  this.markCurrentUserOutOfGroup(
                    chatId,
                    notice,
                    mensaje,
                    false
                  );
                }
                this.cdr.markForCheck();
                return;
              }
              const esDelChatActual =
                this.chatActual && mensaje.chatId === this.chatActual.id;
              if (
                mensaje.activo === false &&
                !this.isTemporalExpiredMessage(mensaje)
              ) {
                return;
              }

              if (esDelChatActual) {
                const i = this.mensajesSeleccionados.findIndex(
                  (m) => Number(m.id) === Number(mensaje.id)
                );
                const replacedExisting = i !== -1;
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
                if (mensaje.id != null) {
                  const idsParaLeer = this.collectReadableMessageIds([mensaje]);
                  if (idsParaLeer.length > 0) {
                    this.wsService.marcarMensajesComoLeidos(idsParaLeer);
                  }
                }

                // este chat no acumula no leídos
                const item = this.chats.find((c) => c.id === mensaje.chatId);
                if (item) item.unreadCount = 0;
                if (
                  item &&
                  !replacedExisting &&
                  !isSystemIncoming &&
                  !this.isMensajeEditado(mensaje) &&
                  Number(mensaje.emisorId) !== Number(this.usuarioActualId) &&
                  Number(mensaje.receptorId) === Number(this.usuarioActualId) &&
                  this.isAppTabInBackground()
                ) {
                  this.playUnreadMessageTone(item);
                }
                if (
                  !isSystemIncoming &&
                  !this.isMensajeEditado(mensaje) &&
                  Number(mensaje.emisorId) !== Number(this.usuarioActualId) &&
                  Number(mensaje.receptorId) === Number(this.usuarioActualId)
                ) {
                  this.promoteChatToTop(mensaje.chatId);
                }

                // preview in-place
                const chat = this.chats.find((c) => c.id === mensaje.chatId);
                if (chat && this.shouldRefreshPreviewWithIncomingMessage(chat, mensaje)) {
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
                    if (!this.isMensajeEditado(mensaje) && !isSystemIncoming) {
                      item.unreadCount = (item.unreadCount || 0) + 1;
                      this.playUnreadMessageTone(item);
                      this.promoteChatToTop(mensaje.chatId);
                    }
                    if (this.shouldRefreshPreviewWithIncomingMessage(item, mensaje)) {
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
                    }
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
                          ultimaMensajeFileUrl: null,
                          ultimaMensajeFileMime: null,
                          ultimaMensajeFileNombre: null,
                          ultimaMensajeFileSizeBytes: null,
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
                          __ultimaEsArchivo: false,
                          __ultimaArchivoUrl: '',
                          __ultimaArchivoPayloadKey: '',
                          __ultimaArchivoDecryptOk: false,
                          __ultimaArchivoNombre: '',
                          __ultimaArchivoMime: '',
                          __ultimaArchivoCaption: '',
                        };

                        // Inserta el chat arriba
                        this.chats = [item, ...this.chats];

                        // (Opcional) enriquecer desde backend para foto/apellidos correctos
                        this.enrichPeerFromServer?.(
                          peerId,
                          Number(mensaje.chatId)
                        );

                        // Suscribir estado del peer (string ? normalizado)
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
                      if (!this.isMensajeEditado(mensaje) && !isSystemIncoming) {
                        item.unreadCount = (item.unreadCount || 0) + 1;
                        this.playUnreadMessageTone(item);
                        this.promoteChatToTop(mensaje.chatId);
                      }

                      if (this.shouldRefreshPreviewWithIncomingMessage(item, mensaje)) {
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
                      }
                      if (this.adminDirectReadOnlyChatIds.has(Number(item?.id))) {
                        (item as any).__adminDirectReadOnly = true;
                        this.rememberAdminDirectChatCacheFromChat(item);
                      }

                      this.cdr.markForCheck();
                    }
                  }
                } else if (mensaje.emisorId === this.usuarioActualId) {
                  const item = this.chats.find((c) => c.id === mensaje.chatId);
                  if (item && this.shouldRefreshPreviewWithIncomingMessage(item, mensaje)) {
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
                      'ws-individual-own-outgoing-list'
                    );
                    this.cdr.markForCheck();
                  } else if (!item) {
                    this.scheduleChatsRefresh(80);
                  }
                }
                this.seedIncomingReactionsFromMessages([mensaje]);
                this.evaluarRespuestasRapidas();
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
          const mensaje = this.mensajesSeleccionados.find(
            (m) => m.id === mensajeId
          );
          if (mensaje) mensaje.leido = true;
        });

        // ?? Escribiendo... (individual + grupo)
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

        // ??? Grabando audio... (individual + grupo)
        this.wsService.suscribirseAGrabandoAudio(
          this.usuarioActualId,
          (emisorId, grabandoAudio, chatId, emisorNombre) => {
            this.ngZone.run(() => {
              if (chatId) {
                if (grabandoAudio) {
                  this.gruposGrabandoAudio.add(chatId);
                  if (emisorNombre)
                    this.quienGrabaAudioEnGrupo.set(chatId, emisorNombre);
                } else {
                  this.gruposGrabandoAudio.delete(chatId);
                  this.quienGrabaAudioEnGrupo.delete(chatId);
                }
                if (this.chatActual?.id === chatId)
                  this.usuarioGrabandoAudio = grabandoAudio;
                this.cdr.markForCheck();
                return;
              }

              if (this.chatActual?.receptor?.id === emisorId) {
                this.usuarioGrabandoAudio = grabandoAudio;
              }
              if (
                !this.chatActual ||
                this.chatActual.receptor?.id !== emisorId
              ) {
                if (grabandoAudio) this.usuariosGrabandoAudio.add(emisorId);
                else this.usuariosGrabandoAudio.delete(emisorId);
              }
              this.cdr.markForCheck();
            });
          }
        );

        // ?? Bloqueos
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
            if (this.looksLikeAdminWarningMessage(mensaje)) {
              this.debugAdminWarningFlow('ws-delete-event', {
                payload: this.extractAdminWarningDebugMeta(mensaje),
              });
            }
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
    if (this.chatListAccessForbidden) return;

    this.chatListLoading = true;
    const existingChatsById = new Map<number, any>(
      (this.chats || [])
        .map((chat: any) => [Number(chat?.id), chat] as const)
        .filter(([chatId]) => Number.isFinite(chatId) && chatId > 0)
    );
    this.chatService
      .listarTodosLosChats()
      .pipe(
        finalize(() => {
          this.chatListLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
      next: (chats: ChatListItemDTO[]) => {
        const dedupedChats = dedupeChatListItemsById(chats || []);
        const mappedChats = dedupedChats
          .map((chat) => {
          const chatId = Number(chat?.id || 0);
          const existingChat = existingChatsById.get(chatId);
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
              this.ngZone.run(() => {
                const c = this.chats.find((x) => x.receptor?.id === receptorId);
                if (c) c.estado = this.toEstado(estado);
                if (this.chatActual?.receptor?.id === receptorId) {
                  this.chatActual.estado = this.toEstado(estado);
                }
                this.cdr.markForCheck();
              });
            });
          }

          if (esGrupo) {
            this.applyClosedStateFromChatListItem(chat);
          }
          const closedReason = esGrupo
            ? this.closedGroupReasonByChatId.get(groupId) || ''
            : '';
          const lastMsgSnapshot =
            (chat as any)?.ultimoMensajeDto ??
            (chat as any)?.ultimoMensajeData ??
            (chat as any)?.ultimoMensajePayload ??
            null;
          const adminDirectReadOnlySnapshot = this.isAdminDirectReadOnlySnapshot(
            chat,
            lastMsgSnapshot
          );
          if (!esGrupo && adminDirectReadOnlySnapshot) {
            this.markAdminDirectChatReadOnly(chat?.id);
          }
          const adminDirectReadOnly =
            !esGrupo &&
            (adminDirectReadOnlySnapshot ||
              this.adminDirectReadOnlyChatIds.has(Number(chat?.id)));

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
            unreadCount: this.resolveInitialUnreadCount(chat, existingChat),
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
            ultimaMensajeFileUrl:
              String((chat as any)?.ultimaMensajeFileUrl || '').trim() || null,
            ultimaMensajeFileMime:
              String((chat as any)?.ultimaMensajeFileMime || '').trim() || null,
            ultimaMensajeFileNombre:
              String((chat as any)?.ultimaMensajeFileNombre || '').trim() || null,
            ultimaMensajeFileSizeBytes:
              Number.isFinite(Number((chat as any)?.ultimaMensajeFileSizeBytes)) &&
              Number((chat as any)?.ultimaMensajeFileSizeBytes) >= 0
                ? Math.round(Number((chat as any)?.ultimaMensajeFileSizeBytes))
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
            __ultimaEsArchivo: false,
            __ultimaArchivoUrl: '',
            __ultimaArchivoPayloadKey: '',
            __ultimaArchivoDecryptOk: false,
            __ultimaArchivoNombre: '',
            __ultimaArchivoMime: '',
            __ultimaArchivoCaption: '',
            __ultimoAdminMessage:
              lastMsgSnapshot?.adminMessage ??
              (chat as any)?.ultimoMensajeAdminMessage ??
              (chat as any)?.ultimaMensajeAdminMessage ??
              (chat as any)?.adminMessage ??
              false,
            __ultimoTemporalEnabled:
              lastMsgSnapshot?.mensajeTemporal ??
              (chat as any)?.ultimoMensajeTemporal ??
              (chat as any)?.ultimaMensajeTemporal ??
              (chat as any)?.mensajeTemporal ??
              false,
            __ultimoTemporalStatus:
              lastMsgSnapshot?.estadoTemporal ??
              (chat as any)?.ultimoMensajeEstadoTemporal ??
              (chat as any)?.ultimaMensajeEstadoTemporal ??
              (chat as any)?.estadoTemporal ??
              null,
            __ultimoTemporalExpired:
              lastMsgSnapshot?.expiredByPolicy ??
              (chat as any)?.ultimoMensajeExpiredByPolicy ??
              (chat as any)?.expiredByPolicy ??
              false,
            __ultimoTemporalExpiresAt:
              lastMsgSnapshot?.expiraEn ??
              lastMsgSnapshot?.expiresAt ??
              (chat as any)?.ultimoMensajeExpiraEn ??
              (chat as any)?.ultimaMensajeExpiraEn ??
              null,
            __ultimoEmisorNombre:
              lastMsgSnapshot?.emisorNombre ??
              (chat as any)?.ultimoMensajeEmisorNombre ??
              (chat as any)?.ultimaMensajeEmisorNombre ??
              null,
            __adminDirectReadOnly: adminDirectReadOnly,
            chatCerrado: esGrupo ? this.closedGroupReasonByChatId.has(groupId) : false,
            chatCerradoMotivo: closedReason || null,
            };
          });
        this.chats = this.mergeAdminDirectCachedChatsIntoList(mappedChats);
        this.syncAdminDirectChatCacheFromCurrentList();

        const activeChatId = Number(this.chatSeleccionadoId ?? this.chatActual?.id ?? 0);
        if (
          Number.isFinite(activeChatId) &&
          activeChatId > 0 &&
          !(this.chats || []).some((c: any) => Number(c?.id) === activeChatId)
        ) {
          this.handleChatNoLongerVisible(activeChatId, false);
        }

        const pinnedId = Number(this.pinnedChatId || 0);
        if (
          Number.isFinite(pinnedId) &&
          pinnedId > 0 &&
          !(this.chats || []).some((c: any) => Number(c?.id) === pinnedId)
        ) {
          this.pinnedChatId = null;
          this.persistPinnedChatToStorage();
        }

        this.applyDraftsToChatList();
        this.tryOpenPendingBrowserNotificationChat();
        this.syncStarredMessagesWithChatSnapshots();
        this.prefetchHydratedStarredMessages();

        for (const chat of this.chats) {
          void this.syncChatItemLastPreviewMedia(chat, null, 'chat-list-initial');
        }

        // Evita side-effects al iniciar sesión:
        // GET /api/chat/mensajes/{chatId} puede marcar mensajes como leídos en backend.
        // Si un admin direct es temporal (expires-after-read), ese fetch de recálculo
        // puede expirar/ocultar el mensaje antes de que el usuario abra el chat.
        // Mantenemos unreadCount del snapshot de /usuario/{id}/todos.

        // Suscribirse a TODOS los grupos (una vez por grupo)
        const groupChatIds = this.chats
          .filter((c) => c.esGrupo)
          .map((c) => Number(c?.id))
          .filter((id) => Number.isFinite(id) && id > 0);
        this.wsService.sincronizarSuscripcionesChatGrupalPermitidas(
          groupChatIds,
          'chat-list-refresh'
        );

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

              const decryptInput = this.resolveDecryptInputFromMessageLike(mensaje);
              this.preserveEncryptedPayloadForIaSummary(mensaje, decryptInput);
              const decryptedContenido = await this.decryptContenido(
                decryptInput,
                Number(
                  (mensaje as any)?.emisorId ?? (mensaje as any)?.emisor?.id ?? 0
                ),
                Number(
                  (mensaje as any)?.receptorId ?? (mensaje as any)?.receptor?.id ?? 0
                ),
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
              await this.hydrateIncomingFileMessage(parsed, {
                chatId: Number(parsed?.chatId),
                mensajeId: Number(parsed?.id),
                source: 'ws-group-file',
              });
              const parsedNormalized = this.normalizeMensajeEditadoFlag(parsed);
              this.maybeShowBrowserNotificationForIncomingMessage(parsedNormalized);
              this.ngZone.run(() => {
                this.handleMensajeGrupal(parsedNormalized);
                this.seedIncomingReactionsFromMessages([parsedNormalized]);
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
            error: (err) => console.error('? Error estados:', err),
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
          const looksLikeEncryptedEnvelope =
            !!payloadPreviewText &&
            (payloadPreviewText.includes('"ciphertext"') ||
              payloadPreviewText.includes('\\"ciphertext\\"')) &&
            (payloadPreviewText.includes('"iv"') ||
              payloadPreviewText.includes('\\"iv\\"')) &&
            (payloadPreviewText.includes('"for') ||
              payloadPreviewText.includes('\\"for'));
          const shouldDecryptObject =
            payloadPreview && typeof payloadPreview === 'object';
          if (
            !shouldDecryptObject &&
            !looksLikeE2EString &&
            !looksLikeEncryptedEnvelope
          ) {
            continue;
          }

          this.decryptPreviewString(payloadPreview, {
            chatId: Number(chat?.id),
            mensajeId: Number(chat?.ultimaMensajeId ?? chat?.lastPreviewId),
            source: 'chat-preview',
          }).then((decrypted: string) => {
            const trunc =
              decrypted.length > 60 ? decrypted.substring(0, 59) + '?' : decrypted;
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
      error: (err) => {
        const status = Number(err?.status || 0);
        const code = String(err?.code || '')
          .trim()
          .toUpperCase();
        if (status === 403 || code === 'CHAT_LIST_FORBIDDEN') {
          this.chatListAccessForbidden = true;
          this.chats = [];
          this.chatActual = null;
          this.chatSeleccionadoId = null;
          if (this.chatsRefreshTimer) {
            clearTimeout(this.chatsRefreshTimer);
            this.chatsRefreshTimer = null;
          }
          if (!this.chatListForbiddenToastShown) {
            const message =
              String(err?.userMessage || err?.error?.mensaje || '').trim() ||
              'No tienes permisos para consultar tus chats con esta sesion.';
            this.showToast(message, 'warning', 'Permisos');
            this.chatListForbiddenToastShown = true;
          }
          this.cdr.markForCheck();
          return;
        }
        console.error('? Error chats:', err);
      },
    });
  }

  private resolveInitialUnreadCount(chat: any, existingChat?: any): number {
    const chatId = Number(chat?.id || 0);
    const activeChatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
    if (Number.isFinite(chatId) && chatId > 0 && chatId === activeChatId) {
      return 0;
    }

    const backendUnread = this.extractBackendUnreadCount(chat);
    const localUnread =
      this.normalizeUnreadCount(existingChat?.unreadCount, 0) ?? 0;

    if (backendUnread !== null) {
      return Math.max(backendUnread, localUnread);
    }

    if (localUnread > 0) {
      return localUnread;
    }

    return this.inferUnreadCountFromLastMessageSnapshot(chat);
  }

  private extractBackendUnreadCount(chat: any): number | null {
    const candidates = [
      chat?.unreadCount,
      chat?.unread_count,
      chat?.mensajesNoLeidos,
      chat?.mensajesSinLeer,
      chat?.noLeidos,
      chat?.no_leidos,
      chat?.totalNoLeidos,
      chat?.totalUnread,
      chat?.unreadMessages,
      chat?.unreadMessagesCount,
      chat?.pendingUnreadCount,
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeUnreadCount(candidate, null);
      if (normalized !== null) return normalized;
    }

    return null;
  }

  private inferUnreadCountFromLastMessageSnapshot(chat: any): number {
    const lastMessage =
      (chat as any)?.ultimoMensajeDto ??
      (chat as any)?.ultimoMensajeData ??
      (chat as any)?.ultimoMensajePayload ??
      null;
    if (!lastMessage) return 0;

    const receptorId = Number(
      lastMessage?.receptorId ??
        lastMessage?.receptor?.id ??
        chat?.receptor?.id ??
        0
    );
    if (receptorId !== Number(this.usuarioActualId)) return 0;
    if (lastMessage?.leido === true) return 0;
    if (lastMessage?.activo === false) return 0;

    return 1;
  }

  private normalizeUnreadCount(
    value: unknown,
    fallback: number | null = 0
  ): number | null {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    return Math.round(parsed);
  }

  private bindBrowserNotificationRoute(): void {
    if (this.browserNotificationRouteSub) return;
    this.browserNotificationRouteSub = this.route.queryParamMap.subscribe(
      (params) => {
        const chatId = Number(params.get(this.OPEN_CHAT_QUERY_PARAM) || 0);
        if (!Number.isFinite(chatId) || chatId <= 0) return;
        this.pendingOpenFromBrowserNotificationChatId = Math.round(chatId);
        this.tryOpenPendingBrowserNotificationChat();
      }
    );
  }

  private tryOpenPendingBrowserNotificationChat(): void {
    const chatId = Number(this.pendingOpenFromBrowserNotificationChatId || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    const targetChat = (this.chats || []).find(
      (c: any) => Number(c?.id) === Math.round(chatId)
    );
    if (!targetChat) return;

    this.openChatsSidebarView();
    this.activeMainView = 'chat';
    if (Number(this.chatActual?.id) !== Math.round(chatId)) {
      this.mostrarMensajes(targetChat);
    }

    this.pendingOpenFromBrowserNotificationChatId = null;
    this.clearBrowserNotificationRouteParam();
  }

  private clearBrowserNotificationRouteParam(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [this.OPEN_CHAT_QUERY_PARAM]: null,
        ts: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private maybeShowBrowserNotificationForIncomingMessage(
    mensajeRaw: any
  ): void {
    const mensaje = this.normalizeMensajeEditadoFlag(mensajeRaw);
    if (!mensaje) return;
    if (this.isSystemMessage(mensaje)) return;
    if (this.isMensajeEditado(mensaje)) return;
    if (mensaje.activo === false && !this.isTemporalExpiredMessage(mensaje)) return;

    const senderId = Number(
      (mensaje as any)?.emisorId ?? (mensaje as any)?.emisor?.id ?? 0
    );
    if (!Number.isFinite(senderId) || senderId <= 0) return;
    if (senderId === Number(this.usuarioActualId)) return;

    const chatId = Number((mensaje as any)?.chatId ?? 0);
    const payload: BrowserNewMessageNotificationPayload = {
      messageId: Number((mensaje as any)?.id ?? 0) || null,
      chatId: Number.isFinite(chatId) && chatId > 0 ? Math.round(chatId) : null,
      senderId: Math.round(senderId),
      currentUserId: Number(this.usuarioActualId || 0) || null,
      senderName: this.buildIncomingNotificationSenderName(mensaje),
      previewText: (() => {
        const preview = String((mensaje as any)?.contenido || '').trim();
        if (!preview) return null;
        if (this.containsEncryptedHiddenPlaceholder(preview)) return null;
        return preview;
      })(),
    };

    this.browserNotificationService.showNewMessageNotification(payload);
  }

  private buildIncomingNotificationSenderName(mensaje: any): string | null {
    const fromFlat = `${String(mensaje?.emisorNombre || '').trim()} ${String(
      mensaje?.emisorApellido || ''
    ).trim()}`.trim();
    if (fromFlat) return fromFlat;

    const nested = mensaje?.emisor;
    const fromNested = `${String(nested?.nombre || '').trim()} ${String(
      nested?.apellido || ''
    ).trim()}`.trim();
    return fromNested || null;
  }

  private bindBanWsListener(): void {
    if (this.banWsBound) return;
    this.banWsBound = true;
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
        this.persistActiveChatDraft();
        this.sessionService.logout({
          clearE2EKeys: false,
          clearAuditKeys: false,
          broadcast: true,
          reason: 'banned',
        });
      });
    });
  }

  private bindClosedChatWsListener(): void {
    if (this.closedChatWsBound) return;
    this.closedChatWsBound = true;
    this.wsService.suscribirseACierresChatUsuario((payload) => {
      this.ngZone.run(() => this.handleClosedChatWsPayload(payload));
    });
  }

  private handleClosedChatWsPayload(payload: any): void {
    const chatId = this.resolveClosedChatId(payload);
    if (!chatId) return;

    const closed = this.resolveClosedChatFlag(payload, true);
    const reason = this.resolveClosedChatReason(payload, true);
    this.setGroupChatClosedState(chatId, closed, reason);

    if (
      closed &&
      !!this.chatActual?.esGrupo &&
      Number(this.chatActual?.id) === Number(chatId)
    ) {
      this.mensajeNuevo = '';
      this.closeComposeActionsPopup();
      this.closeEmojiPicker(true);
      this.closeTemporaryMessagePopup();
      this.showToast(reason, 'warning', 'Grupo', 2600);
    }

    this.cdr.markForCheck();
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
        this.persistActiveChatDraft();
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
      callId: String(rawPayload?.callId || '').trim(),
      senderId: Number(rawPayload?.senderId),
      destination: String(rawPayload?.destination || '').trim(),
      retryAfterSeconds: Number(rawPayload?.retryAfterSeconds),
      ts: String(rawPayload?.ts || '').trim(),
    };
  }

  private handleE2EWsSemanticError(rawPayload: any): void {
    const payload = this.normalizeWsSemanticErrorPayload(rawPayload);
    const code = String(payload.code || '').trim().toUpperCase();
    if (!code) return;
    if (code === 'RATE_LIMIT_EXCEEDED') return;
    const traceSuffix = payload.traceId ? ` (traceId: ${payload.traceId})` : '';
    const backendMsg = String(payload.message || '').trim();

    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const senderId = Number(payload.senderId);
    if (Number.isFinite(senderId) && senderId > 0 && Number(senderId) !== Number(myId)) {
      return;
    }

    if (this.handleSignalingWsSemanticError(payload, code)) {
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

  private handleSignalingWsSemanticError(
    payload: WsSemanticErrorPayload,
    codeUpper: string
  ): boolean {
    const isSecurityCode =
      codeUpper === 'NO_AUTORIZADO' || codeUpper === 'RESPUESTA_INVALIDA';
    if (!isSecurityCode) return false;

    const destination = String(payload.destination || '').trim();
    const isSignalingDestination =
      destination === '/app/call.sdp.offer' ||
      destination === '/app/call.sdp.answer' ||
      destination === '/app/call.ice';
    if (!isSignalingDestination) return false;

    const callId = String(payload.callId || this.currentCallId || '').trim();
    if (callId) {
      this.signalingBlockedCallIds.add(callId);
      this.wsService.markCallEnded(callId);
    }

    const traceSuffix = payload.traceId ? ` (traceId: ${payload.traceId})` : '';
    const backendMsg = String(payload.message || '').trim();
    const msg =
      backendMsg ||
      'El servidor rechazó la señalización de la llamada por seguridad.';
    try {
      this.peer?.close();
    } catch {}
    this.peer = undefined;
    try {
      this.localStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      this.remoteStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.localStream = null;
    this.remoteStream = null;
    this.outgoingCallPendingAcceptance = false;
    this.showCallUI = true;
    this.showRemoteStatus(`${msg}${traceSuffix}`, 'is-error', 1800);
    this.showToast(msg, 'warning', 'Llamada');
    return true;
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
      this.attachTemporaryMetadata(messagePayload);
      this.attachContenidoBusqueda(messagePayload, pending.plainText);

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
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          if (Number(err?.status || 0) === 404) {
            this.handleChatNoLongerVisible(chatId, false);
            return;
          }
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
    this.persistActiveChatDraft();
    const previousChatId = Number(this.chatActual?.id || 0);
    const previousWasGroup = !!this.chatActual?.esGrupo;
    const nextChatId = Number(chat?.id || 0);
    if (
      !previousWasGroup &&
      Number.isFinite(previousChatId) &&
      previousChatId > 0 &&
      previousChatId !== nextChatId &&
      (this.adminDirectReadOnlyChatIds.has(previousChatId) ||
        this.isAdminDirectReadOnlySnapshot(this.chatActual))
    ) {
      this.rememberAdminDirectMessagesCache(previousChatId, this.mensajesSeleccionados || []);
      this.rememberAdminDirectChatCacheById(previousChatId);
    }
    this.debugAdminWarningFlow('open-chat', {
      previousChatId: previousChatId > 0 ? previousChatId : null,
      previousWasGroup,
      nextChatId: nextChatId > 0 ? nextChatId : null,
      nextIsGroup: !!chat?.esGrupo,
      nextReceptorId: Number(chat?.receptor?.id || 0) || null,
      nextChatReadOnly: this.isTruthyFlag(chat?.__adminDirectReadOnly),
    });
    if (
      previousWasGroup &&
      Number.isFinite(previousChatId) &&
      previousChatId > 0 &&
      previousChatId !== nextChatId
    ) {
      this.wsService.desuscribirseIndicadoresGrupo(previousChatId, 'chat-switch');
    }
    this.activeMainView = 'chat';
    this.showTopbarProfileMenu = false;
    this.cancelarRespuestaMensaje();
    this.resumenIaRequestSeq += 1;
    this.mostrarPopupResumenIa = false;
    this.cargandoResumenIa = false;
    this.resumenIa = '';
    this.errorResumenIa = '';
    this.chatSeleccionadoId = chat.id;
    this.chatActual = chat;
    this.beginInitialMessagesLoading(Number(chat?.id), !!chat?.esGrupo);
    this.mensajesSeleccionados = [];
    this.showGroupInfoPanel = false;
    this.showGroupInfoPanelMounted = false;
    this.showUserInfoPanel = false;
    this.showUserInfoPanelMounted = false;
    this.showMessageSearchPanel = false;
    this.showMessageSearchPanelMounted = false;
    this.showPollVotesPanel = false;
    this.showPollVotesPanelMounted = false;
    this.pollVotesPanelMessageId = null;
    this.showScheduleMessageComposer = false;
    this.showChatListHeaderMenu = false;
    this.highlightedMessageId = null;
    this.showPinnedActionsMenu = false;
    this.showPinDurationPicker = false;
    this.showMuteDurationPicker = false;
    this.muteDurationTargetChat = null;
    this.pinTargetMessage = null;
    this.pinnedMessage = null;
    this.pinnedMessageRequestSeq += 1;
    this.openIncomingReactionPickerMessageId = null;
    this.openReactionDetailsMessageId = null;
    if (this.highlightedMessageTimer) {
      clearTimeout(this.highlightedMessageTimer);
      this.highlightedMessageTimer = null;
    }

    // Reset de flags de edición y estado UI
    this.resetEdicion(); // Asegura que limpia haSalidoDelGrupo/mensajeNuevo/menu

    // Estado de mensajes / typing
    this.usuarioEscribiendo = false;
    this.usuarioGrabandoAudio = false;
    this.typingSetHeader.clear();
    this.audioSetHeader.clear();
    this.escribiendoHeader = '';
    this.audioGrabandoHeader = '';

    // === Persistencia local: grupos abandonados ===
    const leftSet = this.getLeftGroupIdsSet();

    // Fallback inmediato UX: si ya sabemos que lo dejaste, marcamos estado
    if (chat.esGrupo && leftSet.has(Number(chat.id))) {
      this.haSalidoDelGrupo = true;
      this.mensajeNuevo = this.getGroupExitNoticeForChat(Number(chat.id));
    } else if (chat.esGrupo && this.isGroupChatClosed(chat)) {
      this.mensajeNuevo = '';
    } else {
      this.restoreDraftForChat(chat);
    }

    // Helper: carga inicial paginada (page=0,size=50)
    const loadMessages = () => {
      this.debugAdminWarningFlow('open-chat-load-history', {
        chatId: nextChatId > 0 ? nextChatId : null,
        esGrupo: !!chat?.esGrupo,
      });
      this.loadInitialMessagesPage(chat, leftSet);
    };

    // === Confirmación robusta con backend (solo grupos) ===
    if (chat.esGrupo) {
      this.chatService
        .esMiembroDeGrupo(Number(chat.id), this.usuarioActualId)
        .subscribe({
          next: (res) => {
            if (!res?.esMiembro || res?.groupDeleted) {
              this.markCurrentUserOutOfGroup(
                Number(chat.id),
                this.getGroupExitNoticeForChat(Number(chat.id))
              );
            } else {
              // Si el back confirma que sigues siendo miembro, limpia estado local
              this.clearCurrentUserOutOfGroup(Number(chat.id));
            }
            loadMessages(); // Carga mensajes (si quieres bloquear lectura cuando no eres miembro, quita esto)
          },
          error: (err) => {
            console.error('? esMiembroDeGrupo:', err);
            // En errores críticos, mantenemos el fallback local y aún así intentamos cargar
            loadMessages();
          },
        });
    } else {
      // Individual: sin check de membresía
      loadMessages();
    }

    void this.loadPinnedMessageForActiveChat();
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

private async extraerResumenPlanoIa(
  response: AiConversationSummaryResponseDTO | null | undefined
): Promise<string> {
  if (!response?.success) return '';

  const resumen = String(response?.resumen || '').trim();
  if (resumen) return resumen;

  const encryptedSummary = await this.tryDecryptEncryptedResumenIa(response);
  if (encryptedSummary) return encryptedSummary;

  return String(response?.mensaje || '').trim();
}

  private async tryDecryptEncryptedResumenIa(
  response: AiConversationSummaryResponseDTO | null | undefined
): Promise<string> {
  const encryptedRaw = (response as any)?.encryptedPayload;
  if (!encryptedRaw) return '';

  const payload = this.parseAiSummaryEncryptedPayload(encryptedRaw);
  const iv = String(payload?.iv || '').trim();
  const ciphertext = String(payload?.ciphertext || '').trim();
  if (!iv || !ciphertext) {
    throw new Error('AI_SUMMARY_ENCRYPTED_PAYLOAD_MISSING');
  }

  const myId = Number(this.getMyUserId ? this.getMyUserId() : this.usuarioActualId);
  const privKeyBase64 = String(localStorage.getItem(`privateKey_${myId}`) || '').trim();
  if (!privKeyBase64) {
    throw new Error('AI_SUMMARY_DECRYPT_FAILED');
  }

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
    for (const candidate of Object.values(forReceptores)) {
      pushIfAny(candidate);
    }
  }

  let aesRaw = '';
  for (const envelope of envelopeCandidates) {
    try {
      aesRaw = await this.cryptoService.decryptRSA(envelope, privateKey);
      if (aesRaw) break;
    } catch {
      // probar siguiente envelope
    }
  }

  if (!aesRaw) {
    throw new Error('AI_SUMMARY_DECRYPT_FAILED');
  }

  const aesBase64 = this.extractAesBase64FromAiSummaryEnvelope(aesRaw);
  const aesKey = await this.cryptoService.importAESKey(aesBase64);
  const plain = await this.cryptoService.decryptAES(ciphertext, iv, aesKey);
  const resolved = String(plain || '').trim();
  if (!resolved) throw new Error('AI_SUMMARY_DECRYPT_FAILED');
  return resolved;
}

private async tryDecryptAiEncryptedPayload(raw: unknown): Promise<string> {
  if (!raw) return '';
  const payload = this.parseAiSummaryEncryptedPayload(raw);
  const iv = String(payload?.iv || '').trim();
  const ciphertext = String(payload?.ciphertext || '').trim();
  if (!iv || !ciphertext) {
    throw new Error('AI_ENCRYPTED_PAYLOAD_MISSING');
  }

  const myId = Number(this.getMyUserId ? this.getMyUserId() : this.usuarioActualId);
  const privKeyBase64 = String(localStorage.getItem(`privateKey_${myId}`) || '').trim();
  if (!privKeyBase64) {
    throw new Error('AI_DECRYPT_FAILED');
  }

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
    for (const candidate of Object.values(forReceptores)) {
      pushIfAny(candidate);
    }
  }

  let aesRaw = '';
  for (const envelope of envelopeCandidates) {
    try {
      aesRaw = await this.cryptoService.decryptRSA(envelope, privateKey);
      if (aesRaw) break;
    } catch {
      // probar siguiente envelope
    }
  }

  if (!aesRaw) {
    throw new Error('AI_DECRYPT_FAILED');
  }

  const aesBase64 = this.extractAesBase64FromAiSummaryEnvelope(aesRaw);
  const aesKey = await this.cryptoService.importAESKey(aesBase64);
  const plain = await this.cryptoService.decryptAES(ciphertext, iv, aesKey);
  const resolved = String(plain || '').trim();
  if (!resolved) throw new Error('AI_DECRYPT_FAILED');
  return resolved;
}

private parseAiSummaryEncryptedPayload(raw: unknown): AiSummaryEncryptedPayload {
  let candidate = String(raw || '').trim();
  if (!candidate) return {};

  for (let i = 0; i < 4; i++) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed as AiSummaryEncryptedPayload;
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

private extractAesBase64FromAiSummaryEnvelope(raw: unknown): string {
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

private preserveEncryptedPayloadForIaSummary(
  mensaje: MensajeDTO | Record<string, any> | null | undefined,
  decryptInput: unknown
): void {
  if (!mensaje || !decryptInput) return;

  const payloadText =
    typeof decryptInput === 'string'
      ? decryptInput.trim()
      : decryptInput && typeof decryptInput === 'object'
      ? JSON.stringify(decryptInput)
      : '';
  if (!payloadText) return;

  try {
    const parsed = JSON.parse(payloadText);
    const payloadType = String(parsed?.type || '').trim().toUpperCase();
    const looksEncrypted =
      payloadType.startsWith('E2E') ||
      (
        typeof parsed?.ciphertext === 'string' &&
        typeof parsed?.iv === 'string' &&
        (
          typeof parsed?.forEmisor === 'string' ||
          typeof parsed?.forReceptor === 'string' ||
          typeof parsed?.forAdmin === 'string' ||
          (parsed?.forReceptores &&
            typeof parsed.forReceptores === 'object' &&
            Object.keys(parsed.forReceptores).length > 0)
        )
      );

    if (looksEncrypted) {
      (mensaje as any).__encryptedPayloadForIaSummary = payloadText;
    }
  } catch {
    // no-op
  }
}

private resolveDecryptInputFromMessageLike(messageLike: any): unknown {
  if (!messageLike || typeof messageLike !== 'object') {
    return messageLike?.contenido ?? messageLike ?? '';
  }

  const direct = messageLike?.contenido;
  if (direct !== undefined && direct !== null) return direct;

  const nestedCandidates: unknown[] = [
    messageLike?.payload?.contenido,
    messageLike?.payload?.content,
    messageLike?.payload?.data,
    messageLike?.payload?.body,
    messageLike?.content?.contenido,
    messageLike?.content,
    messageLike?.data?.contenido,
    messageLike?.data,
    messageLike?.body?.contenido,
    messageLike?.body,
    messageLike?.mensaje?.contenido,
    messageLike?.mensaje,
  ];
  for (const candidate of nestedCandidates) {
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate !== 'string') return candidate;
    if (candidate.trim()) return candidate;
  }

  const payloadType = String(
    messageLike?.type ?? messageLike?.payloadType ?? messageLike?.e2eType ?? ''
  )
    .trim()
    .toUpperCase();
  if (payloadType.startsWith('E2E')) return messageLike;

  const hasCiphertext =
    typeof messageLike?.ciphertext === 'string' && !!messageLike.ciphertext.trim();
  const hasIv = typeof messageLike?.iv === 'string' && !!messageLike.iv.trim();
  const hasEnvelope =
    (typeof messageLike?.forEmisor === 'string' && !!messageLike.forEmisor.trim()) ||
    (typeof messageLike?.forReceptor === 'string' && !!messageLike.forReceptor.trim()) ||
    (typeof messageLike?.forAdmin === 'string' && !!messageLike.forAdmin.trim()) ||
    (messageLike?.forReceptores &&
      typeof messageLike.forReceptores === 'object' &&
      Object.keys(messageLike.forReceptores).length > 0);

  return hasCiphertext && hasIv && hasEnvelope ? messageLike : '';
}

private extractSenderProfileImageFromDecryptInput(
  decryptInput: unknown
): string | null {
  let payload: any = null;
  if (decryptInput && typeof decryptInput === 'object') {
    payload = decryptInput;
  } else if (typeof decryptInput === 'string') {
    const text = decryptInput.trim();
    if (!text) return null;
    try {
      payload = JSON.parse(text);
    } catch {
      return null;
    }
  } else {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [
    payload?.senderProfileImageUrl,
    payload?.senderPhotoUrl,
    payload?.senderAvatarUrl,
    payload?.senderImageUrl,
    payload?.emisorFoto,
  ];
  for (const candidate of candidates) {
    const resolved = resolveMediaUrl(
      String(candidate || '').trim(),
      environment.backendBaseUrl
    );
    if (resolved) return resolved;
  }
  return null;
}

private applySenderProfilePhotoFromDecryptInput(
  mensaje: any,
  decryptInput: unknown
): void {
  if (!mensaje) return;
  const photoUrl = this.extractSenderProfileImageFromDecryptInput(decryptInput);
  if (!photoUrl) return;

  const currentSenderPhoto = resolveMediaUrl(
    String(mensaje?.emisorFoto || '').trim(),
    environment.backendBaseUrl
  );
  if (!currentSenderPhoto) {
    (mensaje as any).emisorFoto = photoUrl;
  }

  const chatId = Number(mensaje?.chatId || 0);
  const emisorId = Number(
    mensaje?.emisorId ?? mensaje?.emisor?.id ?? 0
  );
  if (!Number.isFinite(chatId) || chatId <= 0) return;
  if (!Number.isFinite(emisorId) || emisorId <= 0) return;

  const patchChatPhoto = (chatRef: any): void => {
    if (!chatRef || !!chatRef?.esGrupo) return;
    if (Number(chatRef?.receptor?.id || 0) !== emisorId) return;
    const chatPhoto = resolveMediaUrl(
      String(chatRef?.foto || '').trim(),
      environment.backendBaseUrl
    );
    if (!chatPhoto) {
      chatRef.foto = photoUrl;
    }
    if (chatRef?.receptor) {
      const receptorPhoto = resolveMediaUrl(
        String(chatRef?.receptor?.foto || '').trim(),
        environment.backendBaseUrl
      );
      if (!receptorPhoto) {
        chatRef.receptor.foto = photoUrl;
      }
    }
  };

  const listChat = (this.chats || []).find((c: any) => Number(c?.id) === chatId);
  if (listChat) patchChatPhoto(listChat);
  if (Number(this.chatActual?.id || 0) === chatId) {
    patchChatPhoto(this.chatActual);
  }
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

  private resolveAttachmentDownloadContext(
    rawUrl: unknown,
    message?: Partial<MensajeDTO> | null,
    debugContext?: E2EDebugContext
  ): { url: string; chatId: number; messageId: number } | null {
    const url = String(rawUrl || '').trim();
    if (!url) return null;

    const chatId = Number(
      message?.chatId ??
        debugContext?.chatId ??
        this.chatSeleccionadoId ??
        this.chatActual?.id ??
        0
    );
    const messageId = Number(message?.id ?? debugContext?.mensajeId ?? 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return null;
    if (!Number.isFinite(messageId) || messageId <= 0) return null;

    return {
      url,
      chatId: Math.round(chatId),
      messageId: Math.round(messageId),
    };
  }

  private buildSecureAttachmentCacheKey(
    scope: 'audio' | 'image' | 'file',
    ctx: { url: string; chatId: number; messageId: number }
  ): string {
    return [scope, ctx.chatId, ctx.messageId, ctx.url].join('|');
  }

  private buildSecureAttachmentErrorMessage(
    mediaLabel: 'audio' | 'imagen' | 'archivo',
    status: number
  ): string {
    if (!Number.isFinite(status) || status <= 0) return '';
    if (status === 403) return `No tienes permisos para descargar este ${mediaLabel}.`;
    if (status === 400)
      return `No se pudo descargar este ${mediaLabel} porque la solicitud es inválida.`;
    if (status === 404) return `Este ${mediaLabel} ya no está disponible.`;
    return `No se pudo descargar este ${mediaLabel}.`;
  }

  private collectReadableMessageIds(messages: MensajeDTO[]): number[] {
    const unique = new Set<number>();
    for (const message of messages || []) {
      const id = Number(message?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (Number(message?.receptorId) !== Number(this.usuarioActualId)) continue;
      if (message?.leido === true) continue;
      unique.add(Math.round(id));
    }
    return Array.from(unique);
  }

  private async resolveSecureAttachmentObjectUrl(
    scope: 'audio' | 'image' | 'file',
    rawUrl: unknown,
    mimeHint: string | null | undefined,
    message?: Partial<MensajeDTO> | null,
    debugContext?: E2EDebugContext
  ): Promise<SecureAttachmentLoadResult> {
    const ctx = this.resolveAttachmentDownloadContext(rawUrl, message, debugContext);
    if (!ctx) return { objectUrl: null, status: 0 };

    const cacheKey = this.buildSecureAttachmentCacheKey(scope, ctx);
    const cached = this.secureAttachmentUrlByCacheKey.get(cacheKey);
    if (cached) return { objectUrl: cached, status: 200 };

    const inFlight = this.secureAttachmentLoadingByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const task = (async (): Promise<SecureAttachmentLoadResult> => {
      try {
        const downloaded = await this.mensajeriaService.downloadChatAttachmentBlob(
          ctx.url,
          ctx.chatId,
          ctx.messageId,
          1
        );

        const normalizedMime = String(mimeHint || '').trim();
        const blob =
          !downloaded.type && normalizedMime
            ? downloaded.slice(0, downloaded.size, normalizedMime)
            : downloaded;
        const objectUrl = URL.createObjectURL(blob);
        this.secureAttachmentUrlByCacheKey.set(cacheKey, objectUrl);
        return { objectUrl, status: 200 };
      } catch (err: any) {
        return { objectUrl: null, status: Number(err?.status || 0) };
      } finally {
        this.secureAttachmentLoadingByCacheKey.delete(cacheKey);
      }
    })();

    this.secureAttachmentLoadingByCacheKey.set(cacheKey, task);
    return task;
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

        const downloaded = await this.resolveSecureAttachmentObjectUrl(
          'audio',
          payload.audioUrl,
          payload.audioMime || 'audio/webm',
          null,
          debugContext
        );
        if (!downloaded.objectUrl) {
          console.warn('[E2E][audio-decrypt-fetch-failed]', {
            status: Number(downloaded.status),
            chatId: Number(debugContext?.chatId),
            mensajeId: Number(debugContext?.mensajeId),
            source: debugContext?.source || 'unknown',
          });
          return null;
        }

        const encryptedBytes = await (await fetch(downloaded.objectUrl)).arrayBuffer();
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
      const plain = await this.resolveSecureAttachmentObjectUrl(
        'audio',
        mensaje?.audioUrl,
        mensaje?.audioMime || 'audio/webm',
        mensaje,
        debugContext
      );
      mensaje.audioDataUrl = plain.objectUrl;
      (mensaje as any).__audioE2EDecryptOk = !!plain.objectUrl;
      (mensaje as any).__attachmentLoadError = plain.objectUrl
        ? ''
        : this.buildSecureAttachmentErrorMessage('audio', plain.status);
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
      (mensaje as any).__attachmentLoadError = '';
      return;
    }

    // Alineado con texto E2E: si no hay sobre/clave para este usuario, se oculta del timeline.
    mensaje.contenido = '[Mensaje Cifrado - Llave no disponible para este usuario]';
    mensaje.audioDataUrl = null;
    (mensaje as any).__audioE2EDecryptOk = false;
    (mensaje as any).__attachmentLoadError =
      this.buildSecureAttachmentErrorMessage('audio', 0);
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

        const downloaded = await this.resolveSecureAttachmentObjectUrl(
          'image',
          payload.imageUrl,
          payload.imageMime || 'image/jpeg',
          null,
          debugContext
        );
        if (!downloaded.objectUrl) {
          console.warn('[E2E][image-decrypt-fetch-failed]', {
            status: Number(downloaded.status),
            chatId: Number(debugContext?.chatId),
            mensajeId: Number(debugContext?.mensajeId),
            source: debugContext?.source || 'unknown',
          });
          return null;
        }

        const encryptedBytes = await (await fetch(downloaded.objectUrl)).arrayBuffer();
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
    const tipo = String(mensaje?.tipo || 'TEXT').toUpperCase();
    if (tipo !== 'IMAGE' && tipo !== 'STICKER') return;

    const payload = this.parseImageE2EPayload(mensaje?.contenido);
    if (!payload) {
      (mensaje as any).__imageE2EEncrypted = false;
      const plain = await this.resolveSecureAttachmentObjectUrl(
        'image',
        mensaje?.imageUrl,
        mensaje?.imageMime || 'image/jpeg',
        mensaje,
        debugContext
      );
      mensaje.imageDataUrl = plain.objectUrl;
      (mensaje as any).__imageE2EDecryptOk = !!plain.objectUrl;
      (mensaje as any).__attachmentLoadError = plain.objectUrl
        ? ''
        : this.buildSecureAttachmentErrorMessage('imagen', plain.status);
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
      (mensaje as any).__attachmentLoadError = '';
      return;
    }
    // Alineado con texto E2E: si no hay sobre/clave para este usuario, se oculta del timeline.
    mensaje.contenido = '[Mensaje Cifrado - Llave no disponible para este usuario]';
    mensaje.imageDataUrl = null;
    (mensaje as any).__imageE2EDecryptOk = false;
    (mensaje as any).__attachmentLoadError =
      this.buildSecureAttachmentErrorMessage('imagen', 0);
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

  private parseFileE2EPayload(contenido: unknown): FileE2EPayload | null {
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
    if (payloadType !== 'E2E_FILE' && payloadType !== 'E2E_GROUP_FILE') {
      return null;
    }
    if (typeof payload?.ivFile !== 'string' || !payload.ivFile.trim()) return null;
    if (typeof payload?.forEmisor !== 'string' || !payload.forEmisor.trim()) return null;
    if (typeof payload?.forAdmin !== 'string' || !payload.forAdmin.trim()) return null;

    if (payloadType === 'E2E_FILE') {
      if (typeof payload?.forReceptor !== 'string' || !payload.forReceptor.trim()) {
        return null;
      }
      return {
        type: 'E2E_FILE',
        ivFile: payload.ivFile,
        fileUrl: String(payload?.fileUrl || ''),
        fileMime: typeof payload?.fileMime === 'string' ? payload.fileMime : undefined,
        fileNombre:
          typeof payload?.fileNombre === 'string' ? payload.fileNombre : undefined,
        fileSizeBytes: Number.isFinite(Number(payload?.fileSizeBytes))
          ? Number(payload.fileSizeBytes)
          : undefined,
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
      type: 'E2E_GROUP_FILE',
      ivFile: payload.ivFile,
      fileUrl: String(payload?.fileUrl || ''),
      fileMime: typeof payload?.fileMime === 'string' ? payload.fileMime : undefined,
      fileNombre:
        typeof payload?.fileNombre === 'string' ? payload.fileNombre : undefined,
      fileSizeBytes: Number.isFinite(Number(payload?.fileSizeBytes))
        ? Number(payload.fileSizeBytes)
        : undefined,
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

  private buildFileE2ECacheKey(payload: FileE2EPayload): string {
    return [
      payload.type,
      String(this.usuarioActualId),
      String(payload.ivFile || ''),
      String(payload.fileUrl || ''),
      String(payload.fileNombre || ''),
      String(payload.captionIv || ''),
      String(payload.fileSizeBytes ?? ''),
    ].join('|');
  }

  private async resolveFileEnvelopeForCurrentUser(
    payload: FileE2EPayload,
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

    if (payload.type === 'E2E_FILE') {
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

  private async decryptFileE2EPayloadToObjectUrl(
    payload: FileE2EPayload,
    emisorId: number,
    debugContext?: E2EDebugContext
  ): Promise<{ objectUrl: string | null; caption: string }> {
    const cacheKey = this.buildFileE2ECacheKey(payload);
    const cachedUrl = this.decryptedFileUrlByCacheKey.get(cacheKey) || null;
    const cachedCaption = this.decryptedFileCaptionByCacheKey.get(cacheKey) || '';
    if (cachedUrl) {
      return { objectUrl: cachedUrl, caption: cachedCaption };
    }

    const inFlight = this.decryptingFileByCacheKey.get(cacheKey);
    if (inFlight) {
      const objectUrl = await inFlight;
      return {
        objectUrl,
        caption: this.decryptedFileCaptionByCacheKey.get(cacheKey) || '',
      };
    }

    const decryptPromise = (async (): Promise<string | null> => {
      try {
        const privKeyBase64 = String(
          localStorage.getItem(`privateKey_${this.usuarioActualId}`) || ''
        ).trim();
        if (!privKeyBase64) return null;

        const myPrivKey = await this.cryptoService.importPrivateKey(privKeyBase64);
        const aesEnvelope = await this.resolveFileEnvelopeForCurrentUser(
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
            this.decryptedFileCaptionByCacheKey.set(
              cacheKey,
              String(caption || '').trim()
            );
          } catch {
            this.decryptedFileCaptionByCacheKey.set(cacheKey, '');
          }
        } else {
          this.decryptedFileCaptionByCacheKey.set(cacheKey, '');
        }

        const downloaded = await this.resolveSecureAttachmentObjectUrl(
          'file',
          payload.fileUrl,
          payload.fileMime || 'application/octet-stream',
          null,
          debugContext
        );
        if (!downloaded.objectUrl) {
          console.warn('[E2E][file-decrypt-fetch-failed]', {
            status: Number(downloaded.status),
            chatId: Number(debugContext?.chatId),
            mensajeId: Number(debugContext?.mensajeId),
            source: debugContext?.source || 'unknown',
          });
          return null;
        }

        const encryptedBytes = await (await fetch(downloaded.objectUrl)).arrayBuffer();
        const decryptedBuffer = await this.cryptoService.decryptAESBinary(
          encryptedBytes,
          payload.ivFile,
          aesKey
        );
        const mime =
          String(payload.fileMime || 'application/octet-stream').trim() ||
          'application/octet-stream';
        const objectUrl = URL.createObjectURL(
          new Blob([decryptedBuffer], { type: mime })
        );
        this.decryptedFileUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch (err) {
        console.error('[E2E][file-decrypt-failed]', {
          chatId: Number(debugContext?.chatId),
          mensajeId: Number(debugContext?.mensajeId),
          source: debugContext?.source || 'unknown',
          error: err,
        });
        return null;
      } finally {
        this.decryptingFileByCacheKey.delete(cacheKey);
      }
    })();

    this.decryptingFileByCacheKey.set(cacheKey, decryptPromise);
    const objectUrl = await decryptPromise;
    return {
      objectUrl,
      caption: this.decryptedFileCaptionByCacheKey.get(cacheKey) || '',
    };
  }

  private async hydrateIncomingFileMessage(
    mensaje: MensajeDTO,
    debugContext?: E2EDebugContext
  ): Promise<void> {
    if (String(mensaje?.tipo || 'TEXT').toUpperCase() !== 'FILE') return;

    const payload = this.parseFileE2EPayload(mensaje?.contenido);
    if (!payload) {
      (mensaje as any).__fileE2EEncrypted = false;
      const plain = await this.resolveSecureAttachmentObjectUrl(
        'file',
        mensaje?.fileUrl,
        mensaje?.fileMime || 'application/octet-stream',
        mensaje,
        debugContext
      );
      mensaje.fileDataUrl = plain.objectUrl;
      (mensaje as any).__fileE2EDecryptOk = !!plain.objectUrl;
      (mensaje as any).__attachmentLoadError = plain.objectUrl
        ? ''
        : this.buildSecureAttachmentErrorMessage('archivo', plain.status);
      return;
    }

    (mensaje as any).__fileE2EEncrypted = true;
    if (payload.fileMime && !mensaje.fileMime) {
      mensaje.fileMime = payload.fileMime;
    }
    if (payload.fileNombre && !mensaje.fileNombre) {
      mensaje.fileNombre = payload.fileNombre;
    }
    if (
      Number.isFinite(Number(payload.fileSizeBytes)) &&
      !Number.isFinite(Number(mensaje.fileSizeBytes))
    ) {
      mensaje.fileSizeBytes = Number(payload.fileSizeBytes);
    }
    if (payload.fileUrl) {
      mensaje.fileUrl = payload.fileUrl;
    }

    const decrypted = await this.decryptFileE2EPayloadToObjectUrl(
      payload,
      Number(mensaje?.emisorId),
      debugContext
    );
    mensaje.contenido = decrypted.caption || '';
    if (decrypted.objectUrl) {
      mensaje.fileDataUrl = decrypted.objectUrl;
      (mensaje as any).__fileE2EDecryptOk = true;
      (mensaje as any).__attachmentLoadError = '';
      return;
    }
    // Alineado con texto E2E: si no hay sobre/clave para este usuario, se oculta del timeline.
    mensaje.contenido = '[Mensaje Cifrado - Llave no disponible para este usuario]';
    mensaje.fileDataUrl = null;
    (mensaje as any).__fileE2EDecryptOk = false;
    (mensaje as any).__attachmentLoadError =
      this.buildSecureAttachmentErrorMessage('archivo', 0);
  }

  private async buildOutgoingE2EFileForIndividual(
    receptorId: number,
    file: File,
    caption: string
  ): Promise<BuiltOutgoingFileE2E> {
    const originalFileMime =
      String(file.type || '').trim() || 'application/octet-stream';
    const receptorDTO = await firstValueFrom(this.authService.getById(receptorId));
    const receptorPubKeyBase64 = String(receptorDTO?.publicKey || '').trim();
    const emisorPubKeyBase64 = String(
      localStorage.getItem(`publicKey_${this.usuarioActualId}`) || ''
    ).trim();

    if (!receptorPubKeyBase64 || !emisorPubKeyBase64) {
      throw new Error('E2E_FILE_KEYS_MISSING');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const fileRaw = await file.arrayBuffer();
    const encryptedFile = await this.cryptoService.encryptAESBinary(fileRaw, aesKey);
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
      throw new Error('E2E_FILE_ADMIN_KEY_MISSING');
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

    const payload: FileE2EIndividualPayload = {
      type: 'E2E_FILE',
      ivFile: encryptedFile.iv,
      fileUrl: '',
      fileMime: originalFileMime,
      fileNombre: file.name,
      fileSizeBytes: Number(file.size || 0) || 0,
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

  private async buildOutgoingE2EFileForGroup(
    chatItem: any,
    file: File,
    caption: string
  ): Promise<BuiltOutgoingFileE2E> {
    const originalFileMime =
      String(file.type || '').trim() || 'application/octet-stream';
    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const emisorPubKeyBase64 = String(
      localStorage.getItem(`publicKey_${myId}`) || ''
    ).trim();
    if (!emisorPubKeyBase64) {
      throw new Error('E2E_FILE_SENDER_KEY_MISSING');
    }

    const memberIds = await this.resolveGroupMemberIdsForEncryption(chatItem, myId);
    if (memberIds.length === 0) {
      throw new Error('E2E_FILE_GROUP_NO_RECIPIENTS');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const fileRaw = await file.arrayBuffer();
    const encryptedFile = await this.cryptoService.encryptAESBinary(fileRaw, aesKey);
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
          throw new Error(`E2E_FILE_GROUP_MEMBER_KEY_MISSING:${uid}`);
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
      throw new Error('E2E_FILE_ADMIN_KEY_MISSING');
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

    const payload: FileE2EGroupPayload = {
      type: 'E2E_GROUP_FILE',
      ivFile: encryptedFile.iv,
      fileUrl: '',
      fileMime: originalFileMime,
      fileNombre: file.name,
      fileSizeBytes: Number(file.size || 0) || 0,
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

  private looksLikeAdminWarningMessage(mensaje: any): boolean {
    if (!mensaje) return false;
    const eventCode = String(mensaje?.systemEvent ?? mensaje?.evento ?? '')
      .trim()
      .toUpperCase();
    const senderName = String(
      mensaje?.emisorNombre ?? mensaje?.senderName ?? ''
    )
      .trim()
      .toLowerCase();
    const adminFlag = [
      mensaje?.adminMessage,
      mensaje?.admin_message,
      mensaje?.fromAdmin,
      mensaje?.from_admin,
    ].some((value) => this.isTruthyFlag(value));
    const temporalFlag = [
      mensaje?.mensajeTemporal,
      mensaje?.mensaje_temporal,
      mensaje?.temporal,
      mensaje?.isTemporal,
    ].some((value) => this.isTruthyFlag(value));
    return (
      adminFlag ||
      temporalFlag ||
      senderName === 'admin' ||
      eventCode.startsWith('ADMIN_DIRECT_CHAT_')
    );
  }

  private extractAdminWarningDebugMeta(mensaje: any): Record<string, unknown> {
    const rawContent = mensaje?.contenido;
    const contentType = rawContent === null ? 'null' : typeof rawContent;
    const contentLen =
      typeof rawContent === 'string' ? rawContent.length : undefined;
    const expiresAtRaw =
      mensaje?.expiraEn ??
      mensaje?.expira_en ??
      mensaje?.expiresAt ??
      mensaje?.expires_at ??
      mensaje?.expireAt ??
      mensaje?.expire_at ??
      null;
    const expiresAtMs = this.parseTimestampToMs(expiresAtRaw);

    return {
      id: Number(mensaje?.id || 0) || null,
      chatId: Number(mensaje?.chatId || 0) || null,
      emisorId: Number(mensaje?.emisorId || mensaje?.emisor?.id || 0) || null,
      receptorId:
        Number(mensaje?.receptorId || mensaje?.receptor?.id || 0) || null,
      activo: mensaje?.activo,
      leido: mensaje?.leido,
      adminMessage:
        mensaje?.adminMessage ?? mensaje?.admin_message ?? mensaje?.fromAdmin,
      mensajeTemporal:
        mensaje?.mensajeTemporal ??
        mensaje?.mensaje_temporal ??
        mensaje?.temporal ??
        mensaje?.isTemporal,
      estadoTemporal: mensaje?.estadoTemporal ?? mensaje?.estado_temporal ?? null,
      motivoEliminacion:
        mensaje?.motivoEliminacion ?? mensaje?.motivo_eliminacion ?? null,
      expiredByPolicy:
        mensaje?.expiredByPolicy ??
        mensaje?.expired_by_policy ??
        mensaje?.__ultimoTemporalExpired ??
        null,
      expiraEn: expiresAtRaw,
      expiraEnMs: Number.isFinite(expiresAtMs) ? Number(expiresAtMs) : null,
      systemEvent: mensaje?.systemEvent ?? mensaje?.evento ?? null,
      senderName: mensaje?.emisorNombre ?? mensaje?.senderName ?? null,
      tipo: mensaje?.tipo ?? null,
      contenidoTipo: contentType,
      contenidoLen: contentLen,
    };
  }

  private debugAdminWarningFlow(
    stage: string,
    details?: Record<string, unknown>
  ): void {
    const activeChatId = Number(this.chatActual?.id || 0) || null;
    const selectedChatId = Number(this.chatSeleccionadoId || 0) || null;
    console.log(`[ADMIN-WARNING][${stage}]`, {
      ts: new Date().toISOString(),
      userId: Number(this.usuarioActualId || 0) || null,
      activeChatId,
      selectedChatId,
      ...(details || {}),
    });
  }

  private isAdminDirectChatExpiredEvent(payload: any): boolean {
    const eventCode = String(payload?.systemEvent || payload?.evento || '')
      .trim()
      .toUpperCase();
    return eventCode === 'ADMIN_DIRECT_CHAT_EXPIRED';
  }

  private isAdminDirectChatListUpdatedEvent(payload: any): boolean {
    const eventCode = String(payload?.systemEvent || payload?.evento || '')
      .trim()
      .toUpperCase();
    return eventCode === 'ADMIN_DIRECT_CHAT_LIST_UPDATED';
  }

  private isAdminDirectChatRemovedEvent(payload: any): boolean {
    const eventCode = String(payload?.systemEvent || payload?.evento || '')
      .trim()
      .toUpperCase();
    return eventCode === 'ADMIN_DIRECT_CHAT_REMOVED';
  }

  private handleAdminDirectChatExpiredEvent(payload: any): void {
    const chatId = Number(payload?.chatId || 0);
    const expiredIds = Array.isArray(payload?.expiredMessageIds)
      ? payload.expiredMessageIds
      : payload?.id != null
        ? [payload.id]
        : [];
    this.debugAdminWarningFlow('ws-admin-expired-handle-start', {
      chatId: Number.isFinite(chatId) && chatId > 0 ? chatId : null,
      expiredIds,
      payload: this.extractAdminWarningDebugMeta(payload),
    });
    for (const rawId of expiredIds) {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) continue;
      const expirationCandidate = this.mergeDeletionPayloadWithLocalContext({
        ...(payload || {}),
        id,
        chatId,
        adminMessage: true,
        mensajeTemporal: true,
      } as MensajeDTO);
      if (!this.isExpiredAdminBroadcastMessage(expirationCandidate)) {
        this.debugAdminWarningFlow('ws-admin-expired-skip-not-expired', {
          chatId,
          messageId: id,
          candidate: this.extractAdminWarningDebugMeta(expirationCandidate),
        });
        continue;
      }
      this.debugAdminWarningFlow('ws-admin-expired-apply', {
        chatId,
        messageId: id,
        candidate: this.extractAdminWarningDebugMeta(expirationCandidate),
      });
      this.aplicarEliminacionEnUI({
        ...(payload || {}),
        id,
        chatId,
        activo: false,
        adminMessage: true,
        mensajeTemporal: true,
        estadoTemporal: 'EXPIRADO',
        motivoEliminacion:
          String(payload?.motivoEliminacion || '').trim() || 'TEMPORAL_EXPIRADO',
        expiredByPolicy:
          payload?.expiredByPolicy === true || payload?.expiredByPolicy === 'true',
        systemEvent:
          String(payload?.systemEvent || '').trim() || 'ADMIN_DIRECT_CHAT_EXPIRED',
      } as MensajeDTO);
    }
    if (Number.isFinite(chatId) && chatId > 0) {
      const activeChatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
      if (activeChatId === chatId && this.mensajesSeleccionados.length === 0) {
        this.chatActual = null;
        this.chatSeleccionadoId = null;
      }
    }
    this.debugAdminWarningFlow('ws-admin-expired-handle-end', {
      chatId: Number.isFinite(chatId) && chatId > 0 ? chatId : null,
      remainingVisibleMessages: this.mensajesSeleccionados.length,
    });
    this.cdr.markForCheck();
  }

  private handleAdminDirectChatListUpdatedEvent(payload: any): void {
    const chatId = Number(payload?.chatId || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const item = this.chats.find((c) => Number(c?.id) === chatId);
    if (!item) {
      this.scheduleChatsRefresh(0);
      return;
    }

    const preview = String(payload?.ultimoMensaje ?? '').trim() || 'Sin mensajes aún';
    item.ultimaMensaje = this.normalizeOwnPreviewPrefix(preview, item);
    item.ultimaFecha = String(payload?.ultimaFecha ?? '').trim() || item.ultimaFecha || null;

    const lastVisibleMessageId = Number(payload?.lastVisibleMessageId ?? payload?.ultimoMensajeId);
    if (Number.isFinite(lastVisibleMessageId) && lastVisibleMessageId > 0) {
      item.lastPreviewId = lastVisibleMessageId;
      item.ultimaMensajeId = lastVisibleMessageId;
    } else {
      item.lastPreviewId = null;
      item.ultimaMensajeId = null;
    }

    const lastTipo = this.toLastMessageTipoDTO(payload?.ultimoMensajeTipo);
    item.ultimaMensajeTipo = lastTipo;
    item.__ultimaTipo = lastTipo;
    item.ultimaMensajeEmisorId = Number(payload?.ultimoMensajeEmisorId || 0) || null;
    item.ultimaMensajeRaw = String(payload?.ultimoMensaje ?? '').trim() || null;
    item.__ultimaMensajeRaw = String(payload?.ultimoMensaje ?? '').trim() || '';
    item.__ultimoAdminMessage = false;
    item.__ultimoTemporalEnabled = false;
    item.__ultimoTemporalStatus = null;
    item.__ultimoTemporalExpired = false;
    item.__ultimoTemporalExpiresAt = null;
    item.__adminDirectReadOnly =
      this.adminDirectReadOnlyChatIds.has(chatId) ||
      this.isTruthyFlag(item?.__adminDirectReadOnly);

    this.chats = updateChatPreview(
      this.chats,
      chatId,
      item.ultimaMensaje,
      item.lastPreviewId
    );
    this.rememberAdminDirectChatCacheById(chatId);
    this.cdr.markForCheck();
  }

  private handleAdminDirectChatRemovedEvent(payload: any): void {
    const chatId = Number(payload?.chatId || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    this.removeChatFromLocalState(chatId);
    this.cdr.markForCheck();
  }

  public isTemporalExpiredMessage(mensaje: any): boolean {
    return isTemporalExpiredMessageLike(mensaje);
  }

  public temporalExpiredPlaceholderText(mensaje: any): string {
    return resolveTemporalExpiredPlaceholderText(mensaje);
  }

  private isTruthyFlag(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  private isExplicitInactiveFlag(value: unknown): boolean {
    return value === false || value === 0 || value === '0' || value === 'false';
  }

  private resolveTemporalExpiresAtMs(mensaje: any): number | null {
    if (!mensaje) return null;
    const candidates = [
      mensaje?.expiraEn,
      mensaje?.expira_en,
      mensaje?.expiresAt,
      mensaje?.expires_at,
      mensaje?.expireAt,
      mensaje?.expire_at,
      mensaje?.__ultimoTemporalExpiresAt,
      mensaje?.ultimoMensajeExpiraEn,
      mensaje?.ultimaMensajeExpiraEn,
      mensaje?.chatUltimoMensajeExpiraEn,
    ];
    for (const candidate of candidates) {
      const parsed = this.parseTimestampToMs(candidate);
      if (Number.isFinite(parsed) && Number(parsed) > 0) {
        return Number(parsed);
      }
    }
    return null;
  }

  private isExpiredAdminBroadcastMessage(mensaje: any): boolean {
    if (!mensaje) return false;
    const temporalExpiredLike = this.isTemporalExpiredMessage(mensaje);
    if (!temporalExpiredLike) {
      if (this.looksLikeAdminWarningMessage(mensaje)) {
        this.debugAdminWarningFlow('expired-eval-not-temporal-expired-like', {
          payload: this.extractAdminWarningDebugMeta(mensaje),
        });
      }
      return false;
    }

    const adminFlag = [
      mensaje?.adminMessage,
      mensaje?.admin_message,
      mensaje?.fromAdmin,
      mensaje?.from_admin,
    ].some((value) => this.isTruthyFlag(value));

    const temporalFlag = [
      mensaje?.mensajeTemporal,
      mensaje?.mensaje_temporal,
      mensaje?.temporal,
      mensaje?.isTemporal,
    ].some((value) => this.isTruthyFlag(value));

    const senderName = String(
      mensaje?.emisorNombre ?? mensaje?.senderName ?? ''
    )
      .trim()
      .toLowerCase();

    if (!(adminFlag || senderName === 'admin') || !temporalFlag) {
      this.debugAdminWarningFlow('expired-eval-not-admin-temporal', {
        adminFlag,
        temporalFlag,
        senderName,
        payload: this.extractAdminWarningDebugMeta(mensaje),
      });
      return false;
    }

    const inactiveFlag = this.isExplicitInactiveFlag(mensaje?.activo);
    const expiredByPolicy = this.isTruthyFlag(
      mensaje?.expiredByPolicy ??
        mensaje?.expired_by_policy ??
        mensaje?.__ultimoTemporalExpired
    );
    const expiresAtMs = this.resolveTemporalExpiresAtMs(mensaje);
    const expiredByTime =
      Number.isFinite(expiresAtMs) && Number(expiresAtMs) > 0
        ? Date.now() >= Number(expiresAtMs)
        : false;

    const result = inactiveFlag || expiredByPolicy || expiredByTime;
    this.debugAdminWarningFlow('expired-eval-final', {
      inactiveFlag,
      expiredByPolicy,
      expiredByTime,
      expiresAtMs: Number.isFinite(expiresAtMs) ? Number(expiresAtMs) : null,
      payload: this.extractAdminWarningDebugMeta(mensaje),
      result,
    });
    return result;
  }

  private shouldHideMessageFromTimeline(mensaje: any): boolean {
    if (!mensaje) return false;
    return this.shouldPurgeDeletedMessageFromTimeline(mensaje);
  }

  private canMessageBeUsedAsChatPreview(mensaje: any): boolean {
    if (!mensaje) return false;
    return mensaje.activo !== false || this.isTemporalExpiredMessage(mensaje);
  }

  private mergeDeletionPayloadWithLocalContext(mensaje: MensajeDTO): MensajeDTO {
    const chatId = Number((mensaje as any)?.chatId);
    const messageId = Number(mensaje?.id);
    const loadedMessage =
      Number.isFinite(messageId) && messageId > 0
        ? this.findLoadedMessageById(messageId)
        : null;
    const chatItem =
      Number.isFinite(chatId) && chatId > 0
        ? this.chats.find((c) => Number(c?.id) === chatId) || null
        : null;
    const chatLastMatchesMessage =
      !!chatItem &&
      Number.isFinite(messageId) &&
      messageId > 0 &&
      Number(chatItem?.lastPreviewId ?? chatItem?.ultimaMensajeId ?? 0) === messageId;

    const chatSnapshotContext = chatLastMatchesMessage
      ? {
          adminMessage:
            chatItem?.__ultimoAdminMessage ?? chatItem?.ultimoMensajeAdminMessage,
          mensajeTemporal:
            chatItem?.__ultimoTemporalEnabled ?? chatItem?.ultimoMensajeTemporal,
          estadoTemporal:
            chatItem?.__ultimoTemporalStatus ?? chatItem?.ultimoMensajeEstadoTemporal,
          expiredByPolicy:
            chatItem?.__ultimoTemporalExpired ?? chatItem?.expiredByPolicy,
          emisorNombre:
            chatItem?.__ultimoEmisorNombre ?? chatItem?.ultimoMensajeEmisorNombre,
          expiraEn:
            chatItem?.__ultimoTemporalExpiresAt ?? chatItem?.ultimoMensajeExpiraEn,
        }
      : null;

    return {
      ...(chatSnapshotContext || {}),
      ...(loadedMessage || {}),
      ...(mensaje || {}),
    } as MensajeDTO;
  }

  private parseTimestampToMs(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return Math.round(raw);
    }
    const text = String(raw || '').trim();
    if (!text) return null;
    if (/^\d{10,13}$/.test(text)) {
      const n = Number(text);
      if (Number.isFinite(n) && n > 0) {
        return text.length <= 10 ? n * 1000 : n;
      }
    }
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : null;
  }

  private resolveDeletedMessageAtMs(mensaje: any): number | null {
    if (!mensaje) return null;
    const candidates = [
      (mensaje as any)?.__deletedAtMs,
      (mensaje as any)?.deletedAt,
      (mensaje as any)?.deleted_at,
      (mensaje as any)?.fechaEliminacion,
      (mensaje as any)?.fecha_eliminacion,
      (mensaje as any)?.fechaBorrado,
      (mensaje as any)?.fecha_borrado,
      (mensaje as any)?.updatedAt,
      (mensaje as any)?.fechaEdicion,
      (mensaje as any)?.editedAt,
    ];
    for (const candidate of candidates) {
      const parsed = this.parseTimestampToMs(candidate);
      if (Number.isFinite(parsed) && Number(parsed) > 0) return Number(parsed);
    }
    return null;
  }

  private normalizeDeletedMessageForRetention(
    mensaje: MensajeDTO,
    fallbackDeletedAtMs?: number
  ): MensajeDTO {
    if (!mensaje || mensaje.activo !== false || this.isTemporalExpiredMessage(mensaje)) {
      return mensaje;
    }
    const resolvedDeletedAtMs = this.resolveDeletedMessageAtMs(mensaje);
    if (Number.isFinite(resolvedDeletedAtMs) && Number(resolvedDeletedAtMs) > 0) {
      return {
        ...(mensaje || {}),
        __deletedAtMs: Math.round(Number(resolvedDeletedAtMs)),
      } as MensajeDTO;
    }
    const createdAtMs = this.getMensajeCreatedAtMs(mensaje);
    const fallback =
      Number.isFinite(Number(fallbackDeletedAtMs)) && Number(fallbackDeletedAtMs) > 0
        ? Number(fallbackDeletedAtMs)
        : Number.isFinite(Number(createdAtMs)) && Number(createdAtMs) > 0
          ? Number(createdAtMs)
          : Date.now();
    return {
      ...(mensaje || {}),
      __deletedAtMs: Math.round(fallback),
    } as MensajeDTO;
  }

  private shouldPurgeDeletedMessageFromTimeline(mensaje: any): boolean {
    if (!mensaje || mensaje.activo !== false || this.isTemporalExpiredMessage(mensaje)) {
      return false;
    }
    const deletedAtMs = this.resolveDeletedMessageAtMs(mensaje);
    if (!Number.isFinite(deletedAtMs) || Number(deletedAtMs) <= 0) {
      return false;
    }
    return Date.now() - Number(deletedAtMs) >= this.DELETED_MESSAGE_RETENTION_MS;
  }

  public canUndoDeletedMessage(mensaje: MensajeDTO): boolean {
    if (!mensaje || mensaje.activo !== false) return false;
    if (this.isTemporalExpiredMessage(mensaje)) return false;
    if (Number(mensaje.emisorId) !== Number(this.usuarioActualId)) return false;
    const id = Number(mensaje.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    const normalized = this.normalizeDeletedMessageForRetention(
      { ...(mensaje || {}) } as MensajeDTO
    );
    return !this.shouldPurgeDeletedMessageFromTimeline(normalized);
  }

  public isUndoDeletedMessageInFlight(mensaje: MensajeDTO): boolean {
    const id = Number(mensaje?.id);
    return Number.isFinite(id) && id > 0 && this.restoringDeletedMessageIds.has(id);
  }

  private aplicarRestauracionEnUI(mensaje: MensajeDTO): void {
    const restoredId = Number(mensaje?.id);
    if (!Number.isFinite(restoredId) || restoredId <= 0) return;

    const mergedPayload = this.normalizeMensajeEditadoFlag({
      ...(mensaje || {}),
      activo: true,
      __deletedAtMs: null,
      deletedAt: null,
      deleted_at: null,
      fechaEliminacion: null,
      fecha_eliminacion: null,
    } as MensajeDTO);

    const idxMsg = this.mensajesSeleccionados.findIndex(
      (m) => Number(m.id) === restoredId
    );
    if (idxMsg !== -1) {
      this.mensajesSeleccionados = [
        ...this.mensajesSeleccionados.slice(0, idxMsg),
        { ...this.mensajesSeleccionados[idxMsg], ...mergedPayload },
        ...this.mensajesSeleccionados.slice(idxMsg + 1),
      ];
      this.syncActiveHistoryStateMessages();
    }

    const chatId = Number(mergedPayload.chatId ?? this.chatActual?.id ?? 0);
    if (Number.isFinite(chatId) && chatId > 0) {
      const chat = this.chats.find((c) => Number(c.id) === chatId);
      if (chat && this.shouldRefreshPreviewWithIncomingMessage(chat, mergedPayload)) {
        const { preview, fecha, lastId } = computePreviewPatch(
          mergedPayload,
          chat,
          this.usuarioActualId
        );
        chat.ultimaMensaje = preview;
        chat.ultimaFecha = fecha;
        chat.lastPreviewId = lastId;
        this.stampChatLastMessageFieldsFromMessage(chat, mergedPayload);
        void this.syncChatItemLastPreviewMedia(
          chat,
          mergedPayload,
          'undo-delete-message'
        );
      }
    }

    this.cdr.markForCheck();
  }

  public deshacerEliminarMensaje(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.canUndoDeletedMessage(mensaje)) return;

    const messageId = Number(mensaje.id);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    if (this.restoringDeletedMessageIds.has(messageId)) return;

    this.restoringDeletedMessageIds.add(messageId);
    this.cdr.markForCheck();

    this.chatService
      .restaurarMensaje(messageId)
      .pipe(
        finalize(() => {
          this.restoringDeletedMessageIds.delete(messageId);
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: async (restored) => {
          if (restored && restored.activo === false) {
            this.showToast(
              'No se pudo restaurar el mensaje porque ya venció la ventana de 3 horas.',
              'warning',
              'Mensajes'
            );
            return;
          }

          const merged: MensajeDTO = {
            ...(mensaje || {}),
            ...(restored || {}),
            id: messageId,
            chatId:
              (restored as any)?.chatId ??
              mensaje.chatId ??
              this.chatActual?.id,
            emisorId:
              (restored as any)?.emisorId ??
              mensaje.emisorId ??
              this.usuarioActualId,
            activo: true,
          } as MensajeDTO;

          const restoredChatId = Number((merged as any)?.chatId ?? 0);
          const restoredEmisorId = Number(
            (merged as any)?.emisorId ?? (merged as any)?.emisor?.id ?? 0
          );
          const restoredReceptorId = Number(
            (merged as any)?.receptorId ?? (merged as any)?.receptor?.id ?? 0
          );

          try {
            const decryptInput = this.resolveDecryptInputFromMessageLike(merged);
            merged.contenido = await this.decryptContenido(
              decryptInput,
              restoredEmisorId,
              restoredReceptorId,
              {
                chatId: restoredChatId,
                mensajeId: messageId,
                source: 'undo-delete-rest',
              }
            );
            await this.hydrateIncomingAudioMessage(merged, {
              chatId: restoredChatId,
              mensajeId: messageId,
              source: 'undo-delete-rest-audio',
            });
            await this.hydrateIncomingImageMessage(merged, {
              chatId: restoredChatId,
              mensajeId: messageId,
              source: 'undo-delete-rest-image',
            });
            await this.hydrateIncomingFileMessage(merged, {
              chatId: restoredChatId,
              mensajeId: messageId,
              source: 'undo-delete-rest-file',
            });
          } catch (e) {
            console.warn('[undo-delete] no se pudo descifrar/restaurar media', {
              messageId,
              chatId: restoredChatId,
              error: e,
            });
          }

          this.aplicarRestauracionEnUI(merged);

          const targetChatId = Number(merged.chatId ?? 0);
          if (Number.isFinite(targetChatId) && targetChatId > 0) {
            this.refrescarPreviewDesdeServidor(targetChatId);
          }

          this.showToast('Mensaje restaurado.', 'success', 'Mensajes', 1800);
        },
        error: (err) => {
          const backendMsg = String(
            err?.error?.mensaje || err?.error?.message || err?.message || ''
          ).trim();
          this.showToast(
            backendMsg || 'No se pudo restaurar el mensaje.',
            'warning',
            'Mensajes'
          );
        },
      });
  }

  public isMensajeEditado(mensaje: any): boolean {
    if (!mensaje || mensaje.activo === false) return false;
    const rawFlags = [
      mensaje?.editado,
      mensaje?.edited,
      mensaje?.esEditado,
      mensaje?.modificado,
    ];
    for (const flag of rawFlags) {
      if (flag === true) return true;
      if (String(flag || '').toLowerCase() === 'true') return true;
    }
    const editedAt = String(
      mensaje?.fechaEdicion ??
        mensaje?.editedAt ??
        mensaje?.fechaEditado ??
        mensaje?.updatedAt ??
        ''
    ).trim();
    return !!editedAt;
  }

  private normalizeMensajeEditadoFlag(mensaje: any): MensajeDTO {
    const base = (mensaje || {}) as MensajeDTO;
    const isEdited = this.isMensajeEditado(base);
    const editedAt = String(
      (base as any)?.fechaEdicion ??
        (base as any)?.editedAt ??
        (base as any)?.fechaEditado ??
        (base as any)?.updatedAt ??
        ''
    ).trim();
    return {
      ...base,
      editado: isEdited,
      edited: isEdited,
      fechaEdicion: editedAt || null,
      editedAt: editedAt || null,
    };
  }

  private shouldRefreshPreviewWithIncomingMessage(
    chatItem: any,
    mensaje: MensajeDTO
  ): boolean {
    const incomingId = Number(mensaje?.id);
    if (!Number.isFinite(incomingId) || incomingId <= 0) {
      return !this.isMensajeEditado(mensaje);
    }
    const currentLastId = Number(
      chatItem?.lastPreviewId ?? chatItem?.ultimaMensajeId ?? 0
    );
    const hasCurrentLastId = Number.isFinite(currentLastId) && currentLastId > 0;
    if (!hasCurrentLastId) return true;
    if (this.isMensajeEditado(mensaje)) return currentLastId === incomingId;
    return incomingId >= currentLastId;
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

  private getChatDraftStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.CHAT_DRAFTS_KEY}:${userId}`
      : this.CHAT_DRAFTS_KEY;
  }

  private getPinnedChatStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.PINNED_CHAT_ID_KEY}:${userId}`
      : this.PINNED_CHAT_ID_KEY;
  }

  private getFavoriteChatStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.FAVORITE_CHAT_ID_KEY}:${userId}`
      : this.FAVORITE_CHAT_ID_KEY;
  }

  private getAdminDirectChatCacheStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.ADMIN_DIRECT_CHAT_CACHE_KEY}:${userId}`
      : this.ADMIN_DIRECT_CHAT_CACHE_KEY;
  }

  private getAdminDirectMessagesCacheStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.ADMIN_DIRECT_MESSAGES_CACHE_KEY}:${userId}`
      : this.ADMIN_DIRECT_MESSAGES_CACHE_KEY;
  }

  private buildAdminDirectChatCacheSnapshot(chat: any): any {
    const chatId = this.normalizeValidChatId(chat?.id);
    if (!chatId) return null;
    if (chat?.esGrupo === true) return null;

    const receptorId = Number(chat?.receptor?.id || 0);
    const receptorNombre = String(chat?.receptor?.nombre || '').trim();
    const receptorApellido = String(chat?.receptor?.apellido || '').trim();
    const receptorFoto = chat?.receptor?.foto ?? null;

    const fallbackNombre = `${receptorNombre} ${receptorApellido}`.trim();
    const nombre = String(chat?.nombre || fallbackNombre || 'Usuario').trim() || 'Usuario';

    const explicitAudioDurMs = Number(chat?.ultimaMensajeAudioDuracionMs);
    const normalizedAudioDurMs =
      Number.isFinite(explicitAudioDurMs) && explicitAudioDurMs > 0
        ? Math.round(explicitAudioDurMs)
        : null;
    const normalizedLastPreviewId = Number(chat?.lastPreviewId ?? chat?.ultimaMensajeId ?? 0);

    return {
      id: chatId,
      esGrupo: false,
      nombre,
      foto: avatarOrDefault(chat?.foto ?? receptorFoto),
      receptor: {
        id: Number.isFinite(receptorId) && receptorId > 0 ? receptorId : null,
        nombre: receptorNombre,
        apellido: receptorApellido,
        foto: receptorFoto,
      },
      estado: String(chat?.estado || 'Desconectado').trim() || 'Desconectado',
      ultimaMensaje: String(chat?.ultimaMensaje || '').trim() || 'Sin mensajes aún',
      ultimaFecha: String(chat?.ultimaFecha || '').trim() || null,
      unreadCount: Number(chat?.unreadCount || 0) || 0,
      lastPreviewId:
        Number.isFinite(normalizedLastPreviewId) && normalizedLastPreviewId > 0
          ? Math.round(normalizedLastPreviewId)
          : null,
      ultimaMensajeId:
        Number.isFinite(Number(chat?.ultimaMensajeId)) && Number(chat?.ultimaMensajeId) > 0
          ? Math.round(Number(chat?.ultimaMensajeId))
          : null,
      ultimaMensajeTipo: this.normalizeLastMessageTipo(chat?.ultimaMensajeTipo),
      ultimaMensajeEmisorId:
        Number.isFinite(Number(chat?.ultimaMensajeEmisorId)) &&
        Number(chat?.ultimaMensajeEmisorId) > 0
          ? Math.round(Number(chat?.ultimaMensajeEmisorId))
          : null,
      ultimaMensajeRaw: String(chat?.ultimaMensajeRaw || '').trim() || null,
      ultimaMensajeImageUrl: String(chat?.ultimaMensajeImageUrl || '').trim() || null,
      ultimaMensajeImageMime: String(chat?.ultimaMensajeImageMime || '').trim() || null,
      ultimaMensajeImageNombre: String(chat?.ultimaMensajeImageNombre || '').trim() || null,
      ultimaMensajeAudioUrl: String(chat?.ultimaMensajeAudioUrl || '').trim() || null,
      ultimaMensajeAudioMime: String(chat?.ultimaMensajeAudioMime || '').trim() || null,
      ultimaMensajeAudioDuracionMs: normalizedAudioDurMs,
      ultimaMensajeFileUrl: String(chat?.ultimaMensajeFileUrl || '').trim() || null,
      ultimaMensajeFileMime: String(chat?.ultimaMensajeFileMime || '').trim() || null,
      ultimaMensajeFileNombre: String(chat?.ultimaMensajeFileNombre || '').trim() || null,
      ultimaMensajeFileSizeBytes:
        Number.isFinite(Number(chat?.ultimaMensajeFileSizeBytes)) &&
        Number(chat?.ultimaMensajeFileSizeBytes) >= 0
          ? Math.round(Number(chat?.ultimaMensajeFileSizeBytes))
          : null,
      __adminDirectReadOnly: true,
      __ultimoAdminMessage: true,
      __ultimoTemporalEnabled: this.isTruthyFlag(
        chat?.__ultimoTemporalEnabled ?? chat?.ultimoMensajeTemporal ?? chat?.mensajeTemporal
      ),
      __ultimoTemporalStatus:
        String(chat?.__ultimoTemporalStatus ?? chat?.ultimoMensajeEstadoTemporal ?? '').trim() ||
        null,
      __ultimoTemporalExpired: this.isTruthyFlag(
        chat?.__ultimoTemporalExpired ?? chat?.expiredByPolicy
      ),
      __ultimoTemporalExpiresAt:
        String(chat?.__ultimoTemporalExpiresAt ?? chat?.ultimoMensajeExpiraEn ?? '').trim() ||
        null,
      __ultimoEmisorNombre:
        String(chat?.__ultimoEmisorNombre ?? chat?.ultimoMensajeEmisorNombre ?? '').trim() ||
        null,
      chatCerrado: false,
      chatCerradoMotivo: null,
    };
  }

  private normalizeAdminDirectChatCacheEntry(raw: any): AdminDirectChatCacheEntry | null {
    const chat = raw?.chat ?? raw;
    const chatId = this.normalizeValidChatId(raw?.chatId ?? chat?.id);
    if (!chatId) return null;
    if (chat?.esGrupo === true) return null;

    const snapshot = this.buildAdminDirectChatCacheSnapshot({
      ...(chat || {}),
      id: chatId,
      esGrupo: false,
    });
    if (!snapshot) return null;

    const updatedAtRaw = Number(raw?.updatedAtMs ?? raw?.updatedAt ?? Date.now());
    const updatedAtMs =
      Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
        ? Math.round(updatedAtRaw)
        : Date.now();

    return { chatId, updatedAtMs, chat: snapshot };
  }

  private normalizeAdminDirectMessagesCacheEntry(
    raw: any
  ): AdminDirectMessagesCacheEntry | null {
    const chatId = this.normalizeValidChatId(raw?.chatId ?? raw?.id);
    if (!chatId) return null;
    const rows = Array.isArray(raw?.messages) ? raw.messages : [];
    if (rows.length === 0) return null;
    const normalized: MensajeDTO[] = rows
      .map((row: any) => {
        const content = typeof row?.contenido === 'string'
          ? row.contenido
          : String(row?.contenido ?? '');
        return {
          ...(row || {}),
          chatId,
          contenido: content,
        } as MensajeDTO;
      })
      .filter((m: MensajeDTO) => {
        const id = Number(m?.id || 0);
        return (Number.isFinite(id) && id > 0) || !!String(m?.contenido || '').trim();
      });
    if (normalized.length === 0) return null;

    const updatedAtRaw = Number(raw?.updatedAtMs ?? raw?.updatedAt ?? Date.now());
    const updatedAtMs =
      Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
        ? Math.round(updatedAtRaw)
        : Date.now();

    return {
      chatId,
      updatedAtMs,
      messages: normalized.slice(-this.HISTORY_PAGE_SIZE),
    };
  }

  private loadAdminDirectChatCacheFromStorage(): void {
    this.adminDirectChatCacheById.clear();
    try {
      const raw = localStorage.getItem(this.getAdminDirectChatCacheStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.values(parsed)
          : [];
      for (const row of rows) {
        const entry = this.normalizeAdminDirectChatCacheEntry(row);
        if (!entry) continue;
        this.adminDirectChatCacheById.set(entry.chatId, entry);
        this.adminDirectReadOnlyChatIds.add(entry.chatId);
      }
    } catch {}
  }

  private loadAdminDirectMessagesCacheFromStorage(): void {
    this.adminDirectMessagesCacheByChatId.clear();
    try {
      const raw = localStorage.getItem(this.getAdminDirectMessagesCacheStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.values(parsed)
          : [];
      for (const row of rows) {
        const entry = this.normalizeAdminDirectMessagesCacheEntry(row);
        if (!entry) continue;
        this.adminDirectMessagesCacheByChatId.set(entry.chatId, entry);
        this.adminDirectReadOnlyChatIds.add(entry.chatId);
      }
    } catch {}
  }

  private persistAdminDirectChatCacheToStorage(): void {
    const key = this.getAdminDirectChatCacheStorageKey();
    if ((this.adminDirectChatCacheById?.size || 0) === 0) {
      localStorage.removeItem(key);
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const [chatId, entry] of this.adminDirectChatCacheById.entries()) {
      payload[String(chatId)] = {
        chatId: entry.chatId,
        updatedAtMs: entry.updatedAtMs,
        chat: entry.chat,
      };
    }
    localStorage.setItem(key, JSON.stringify(payload));
  }

  private persistAdminDirectMessagesCacheToStorage(): void {
    const key = this.getAdminDirectMessagesCacheStorageKey();
    if ((this.adminDirectMessagesCacheByChatId?.size || 0) === 0) {
      localStorage.removeItem(key);
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const [chatId, entry] of this.adminDirectMessagesCacheByChatId.entries()) {
      payload[String(chatId)] = {
        chatId: entry.chatId,
        updatedAtMs: entry.updatedAtMs,
        messages: entry.messages.slice(-this.HISTORY_PAGE_SIZE),
      };
    }
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // fallback por cuota: conservar menos mensajes
      const reducedPayload: Record<string, unknown> = {};
      for (const [chatId, entry] of this.adminDirectMessagesCacheByChatId.entries()) {
        reducedPayload[String(chatId)] = {
          chatId: entry.chatId,
          updatedAtMs: entry.updatedAtMs,
          messages: entry.messages.slice(-20),
        };
      }
      try {
        localStorage.setItem(key, JSON.stringify(reducedPayload));
      } catch {}
    }
  }

  private rememberAdminDirectChatCacheFromChat(chat: any): void {
    const entry = this.normalizeAdminDirectChatCacheEntry({
      chatId: chat?.id,
      chat,
      updatedAtMs: Date.now(),
    });
    if (!entry) return;
    this.adminDirectChatCacheById.set(entry.chatId, entry);
    this.adminDirectReadOnlyChatIds.add(entry.chatId);
    this.persistAdminDirectChatCacheToStorage();
  }

  private rememberAdminDirectMessagesCache(
    chatIdRaw: unknown,
    messagesRaw: any[]
  ): void {
    const chatId = this.normalizeValidChatId(chatIdRaw);
    if (!chatId) return;
    const rows = Array.isArray(messagesRaw) ? messagesRaw : [];
    const normalized: MensajeDTO[] = rows
      .map((row: any) => {
        const normalizedRow = {
          ...(row || {}),
          chatId,
          contenido:
            typeof row?.contenido === 'string'
              ? row.contenido
              : String(row?.contenido ?? ''),
        } as MensajeDTO & { __hideFromTimeline?: boolean };
        delete normalizedRow.__hideFromTimeline;
        return normalizedRow as MensajeDTO;
      })
      .filter((m) => {
        const id = Number(m?.id || 0);
        return (Number.isFinite(id) && id > 0) || !!String(m?.contenido || '').trim();
      })
      .slice(-this.HISTORY_PAGE_SIZE);

    if (normalized.length === 0) return;

    this.adminDirectMessagesCacheByChatId.set(chatId, {
      chatId,
      updatedAtMs: Date.now(),
      messages: normalized,
    });
    this.adminDirectReadOnlyChatIds.add(chatId);
    this.persistAdminDirectMessagesCacheToStorage();
  }

  private getAdminDirectMessagesCache(chatIdRaw: unknown): MensajeDTO[] {
    const chatId = this.normalizeValidChatId(chatIdRaw);
    if (!chatId) return [];
    const entry = this.adminDirectMessagesCacheByChatId.get(chatId);
    if (!entry || !Array.isArray(entry.messages)) return [];
    return entry.messages.map((m) => ({ ...(m || {}), chatId } as MensajeDTO));
  }

  private rememberAdminDirectChatCacheById(chatIdRaw: unknown): void {
    const chatId = this.normalizeValidChatId(chatIdRaw);
    if (!chatId) return;
    const chatItem =
      (this.chats || []).find((c: any) => Number(c?.id) === chatId && !c?.esGrupo) ||
      (Number(this.chatActual?.id) === chatId && !this.chatActual?.esGrupo
        ? this.chatActual
        : null);
    if (!chatItem) return;
    this.rememberAdminDirectChatCacheFromChat(chatItem);
  }

  private mergeAdminDirectCachedChatsIntoList(chats: any[]): any[] {
    const base = Array.isArray(chats) ? [...chats] : [];
    if ((this.adminDirectChatCacheById?.size || 0) === 0) return base;

    const existingIds = new Set<number>(
      base
        .map((chat) => Number(chat?.id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    const cachedEntries = Array.from(this.adminDirectChatCacheById.values()).sort(
      (a, b) => b.updatedAtMs - a.updatedAtMs
    );

    let restoredCount = 0;
    for (const entry of cachedEntries) {
      if (existingIds.has(entry.chatId)) continue;
      base.push({
        ...(entry.chat || {}),
        id: entry.chatId,
        esGrupo: false,
        __adminDirectReadOnly: true,
        estado: String(entry?.chat?.estado || 'Desconectado').trim() || 'Desconectado',
      });
      this.adminDirectReadOnlyChatIds.add(entry.chatId);
      restoredCount += 1;
    }

    if (restoredCount > 0) {
      this.debugAdminWarningFlow('chat-list-merge-admin-cache', {
        restoredCount,
        totalAfterMerge: base.length,
      });
    }

    return base;
  }

  private syncAdminDirectChatCacheFromCurrentList(): void {
    let changed = false;
    for (const chat of this.chats || []) {
      const chatId = this.normalizeValidChatId(chat?.id);
      if (!chatId || !!chat?.esGrupo) continue;
      if (
        !this.adminDirectReadOnlyChatIds.has(chatId) &&
        !this.isAdminDirectReadOnlySnapshot(chat)
      ) {
        continue;
      }
      const entry = this.normalizeAdminDirectChatCacheEntry({
        chatId,
        chat,
        updatedAtMs: Date.now(),
      });
      if (!entry) continue;
      this.adminDirectChatCacheById.set(chatId, entry);
      changed = true;
    }
    if (changed) {
      this.persistAdminDirectChatCacheToStorage();
    }
  }

  private forgetAdminDirectChatCache(chatIdRaw: unknown): void {
    const chatId = this.normalizeValidChatId(chatIdRaw);
    if (!chatId) return;
    if (this.adminDirectChatCacheById.delete(chatId)) {
      this.persistAdminDirectChatCacheToStorage();
    }
  }

  private forgetAdminDirectMessagesCache(chatIdRaw: unknown): void {
    const chatId = this.normalizeValidChatId(chatIdRaw);
    if (!chatId) return;
    if (this.adminDirectMessagesCacheByChatId.delete(chatId)) {
      this.persistAdminDirectMessagesCacheToStorage();
    }
  }

  private loadPinnedChatFromStorage(): void {
    this.pinnedChatId = null;
    try {
      const raw = localStorage.getItem(this.getPinnedChatStorageKey());
      const chatId = Number(raw);
      if (!Number.isFinite(chatId) || chatId <= 0) return;
      this.pinnedChatId = Math.round(chatId);
    } catch {}
  }

  private persistPinnedChatToStorage(): void {
    const key = this.getPinnedChatStorageKey();
    const chatId = Number(this.pinnedChatId);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(Math.round(chatId)));
  }

  private loadFavoriteChatFromStorage(): void {
    this.favoriteChatId = null;
    try {
      const raw = localStorage.getItem(this.getFavoriteChatStorageKey());
      const chatId = Number(raw);
      if (!Number.isFinite(chatId) || chatId <= 0) return;
      this.favoriteChatId = Math.round(chatId);
    } catch {}
  }

  private persistFavoriteChatToStorage(): void {
    const key = this.getFavoriteChatStorageKey();
    const chatId = Number(this.favoriteChatId);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(Math.round(chatId)));
  }

  private loadMutedChatsFromBackend(): void {
    this.chatService.listMutedChats().subscribe({
      next: (items) => {
        this.mutedChatUntilByChatId.clear();
        for (const item of items || []) {
          const chatId = Number(item?.chatId);
          if (!Number.isFinite(chatId) || chatId <= 0) continue;
          const normalizedChatId = Math.round(chatId);
          const muted = item?.muted !== false;
          if (!muted) continue;
          const mutedForever = item?.mutedForever === true;
          if (mutedForever) {
            this.mutedChatUntilByChatId.set(normalizedChatId, null);
            continue;
          }
          const untilMs = this.toMuteUntilMs(item?.mutedUntil);
          if (untilMs && untilMs > Date.now()) {
            this.mutedChatUntilByChatId.set(normalizedChatId, untilMs);
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.warn('[mute] no se pudo cargar estado de chats silenciados', err);
      },
    });
  }

  private loadFavoriteChatFromBackend(): void {
    this.chatService.getFavoriteChat().subscribe({
      next: (state) => {
        const chatId = Number(state?.chatId || 0);
        if (!Number.isFinite(chatId) || chatId <= 0) {
          this.favoriteChatId = null;
          this.persistFavoriteChatToStorage();
          this.cdr.markForCheck();
          return;
        }
        this.favoriteChatId = Math.round(chatId);
        this.persistFavoriteChatToStorage();
        this.cdr.markForCheck();
      },
      error: (err) => {
        const status = Number(err?.status || 0);
        if (status === 404 || status === 405 || status === 501) return;
        console.warn('[favorite] no se pudo cargar chat favorito desde backend', err);
      },
    });
  }

  private syncFavoriteChatToBackend(
    chatId: number | null,
    previousFavoriteChatId: number | null
  ): void {
    const currentFavorite = Number(this.favoriteChatId || 0);
    if (Number.isFinite(currentFavorite) && currentFavorite > 0) {
      this.chatService.setFavoriteChat(currentFavorite).subscribe({
        next: () => {},
        error: (err) => {
          const status = Number(err?.status || 0);
          if (status === 404 || status === 405 || status === 501) return;
          this.favoriteChatId = previousFavoriteChatId;
          this.persistFavoriteChatToStorage();
          this.cdr.markForCheck();
          this.showToast('No se pudo guardar favorito en servidor.', 'warning', 'Chats', 2200);
        },
      });
      return;
    }

    const targetChatId = Number(chatId || 0);
    if (!Number.isFinite(targetChatId) || targetChatId <= 0) return;
    this.chatService.clearFavoriteChat(targetChatId).subscribe({
      next: () => {},
      error: (err) => {
        const status = Number(err?.status || 0);
        if (status === 404 || status === 405 || status === 501) return;
        this.favoriteChatId = previousFavoriteChatId;
        this.persistFavoriteChatToStorage();
        this.cdr.markForCheck();
        this.showToast('No se pudo quitar favorito en servidor.', 'warning', 'Chats', 2200);
      },
    });
  }

  private toMuteUntilMs(raw: unknown): number | null {
    if (raw == null) return null;
    if (raw instanceof Date) {
      const time = raw.getTime();
      return Number.isFinite(time) && time > 0 ? Math.round(time) : null;
    }
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.round(asNumber);
    const text = String(raw || '').trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  }

  private setMutedChatState(chatIdRaw: unknown, untilMs: number | null | undefined): void {
    const chatId = Number(chatIdRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const normalizedChatId = Math.round(chatId);
    if (untilMs === undefined) {
      this.mutedChatUntilByChatId.delete(normalizedChatId);
      return;
    }
    if (untilMs === null) {
      this.mutedChatUntilByChatId.set(normalizedChatId, null);
      return;
    }
    const normalizedUntil = Number(untilMs);
    if (!Number.isFinite(normalizedUntil) || normalizedUntil <= Date.now()) {
      this.mutedChatUntilByChatId.delete(normalizedChatId);
      return;
    }
    this.mutedChatUntilByChatId.set(normalizedChatId, Math.round(normalizedUntil));
  }

  private getChatMuteUntilMs(chat: any): number | null | undefined {
    const chatId = Number(chat?.id ?? chat);
    if (!Number.isFinite(chatId) || chatId <= 0) return undefined;
    const value = this.mutedChatUntilByChatId.get(Math.round(chatId));
    if (value === undefined) return undefined;
    if (value === null) return null;
    const untilMs = Number(value);
    if (!Number.isFinite(untilMs) || untilMs <= 0) return undefined;
    return Math.round(untilMs);
  }

  public isChatMuted(chat: any): boolean {
    const untilMs = this.getChatMuteUntilMs(chat);
    if (untilMs === undefined) return false;
    if (untilMs === null) return true;
    return untilMs > Date.now();
  }

  public chatMutedIndicatorTitle(chat: any): string {
    const untilMs = this.getChatMuteUntilMs(chat);
    if (untilMs === null) return 'Notificaciones silenciadas (siempre)';
    if (typeof untilMs === 'number' && untilMs > Date.now()) {
      const formatted = new Date(untilMs).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `Notificaciones silenciadas hasta ${formatted}`;
    }
    return 'Notificaciones silenciadas';
  }

  private applyMuteStateFromBackend(state: any, fallbackChatId?: number): void {
    const chatIdRaw = Number(state?.chatId ?? fallbackChatId ?? 0);
    if (!Number.isFinite(chatIdRaw) || chatIdRaw <= 0) return;
    const chatId = Math.round(chatIdRaw);

    const muted = state?.muted !== false;
    if (!muted) {
      this.setMutedChatState(chatId, undefined);
      return;
    }

    if (state?.mutedForever === true) {
      this.setMutedChatState(chatId, null);
      return;
    }

    const untilMs = this.toMuteUntilMs(state?.mutedUntil);
    this.setMutedChatState(chatId, untilMs ?? undefined);
  }

  private resolveClosedChatId(source: any): number | null {
    const candidates = [
      source?.chatId,
      source?.id,
      source?.groupId,
      source?.grupoId,
      source?.targetChatId,
    ];
    for (const candidate of candidates) {
      const chatId = Number(candidate);
      if (Number.isFinite(chatId) && chatId > 0) return Math.round(chatId);
    }
    return null;
  }

  private resolveClosedChatFlag(source: any, defaultValue = false): boolean {
    const candidates = [
      source?.closed,
      source?.cerrado,
      source?.chatClosed,
      source?.chatCerrado,
      source?.activo == null ? undefined : !source?.activo,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'boolean') return candidate;
      if (typeof candidate === 'number') return candidate !== 0;
      const text = String(candidate || '').trim().toLowerCase();
      if (!text) continue;
      if (['true', '1', 'yes', 'si', 'cerrado', 'closed'].includes(text)) {
        return true;
      }
      if (['false', '0', 'no', 'abierto', 'open', 'activo'].includes(text)) {
        return false;
      }
    }
    return defaultValue;
  }

  private resolveClosedChatReason(source: any, fallbackToDefault = false): string {
    const candidates = [
      source?.reason,
      source?.motivo,
      source?.mensaje,
      source?.message,
      source?.chatClosedReason,
      source?.chatCerradoMotivo,
      source?.closureReason,
      source?.cierreMotivo,
      source?.closedMessage,
      source?.closedReason,
    ];

    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (text) return text;
    }

    return fallbackToDefault ? this.DEFAULT_GROUP_CHAT_CLOSED_REASON : '';
  }

  private setGroupChatClosedState(
    chatIdRaw: unknown,
    closed: boolean,
    reason?: string | null
  ): void {
    const chatId = Number(chatIdRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const normalizedChatId = Math.round(chatId);
    const normalizedReason =
      String(reason || '').trim() || this.DEFAULT_GROUP_CHAT_CLOSED_REASON;

    if (closed) {
      this.closedGroupReasonByChatId.set(normalizedChatId, normalizedReason);
    } else {
      this.closedGroupReasonByChatId.delete(normalizedChatId);
    }

    const chatItem = (this.chats || []).find(
      (c: any) => Number(c?.id) === normalizedChatId
    );
    if (chatItem) {
      (chatItem as any).chatCerrado = closed;
      (chatItem as any).chatCerradoMotivo = closed ? normalizedReason : null;
    }

    if (Number(this.chatActual?.id) === normalizedChatId) {
      (this.chatActual as any).chatCerrado = closed;
      (this.chatActual as any).chatCerradoMotivo = closed ? normalizedReason : null;
    }
  }

  private applyClosedStateFromChatListItem(chat: any): void {
    if (!chat) return;
    const chatId = this.resolveClosedChatId(chat);
    if (!chatId) return;
    const esGrupo = !!chat?.esGrupo || !chat?.receptor;
    if (!esGrupo) return;
    const closed = this.resolveClosedChatFlag(chat);
    const reason = this.resolveClosedChatReason(chat, closed);
    this.setGroupChatClosedState(chatId, closed, reason);
  }

  public isGroupChatClosed(chat: any): boolean {
    if (!chat || !chat?.esGrupo) return false;
    const chatId = Number(chat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return false;
    return this.closedGroupReasonByChatId.has(Math.round(chatId));
  }

  public get chatGrupalCerradoPorAdmin(): boolean {
    return this.isGroupChatClosed(this.chatActual);
  }

  public get chatGrupalCerradoMotivo(): string {
    if (!this.chatGrupalCerradoPorAdmin) return '';
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      return this.DEFAULT_GROUP_CHAT_CLOSED_REASON;
    }
    return (
      this.closedGroupReasonByChatId.get(Math.round(chatId)) ||
      this.DEFAULT_GROUP_CHAT_CLOSED_REASON
    );
  }

  public isChatPinned(chat: any): boolean {
    const pinnedId = Number(this.pinnedChatId);
    const chatId = Number(chat?.id);
    if (!Number.isFinite(pinnedId) || pinnedId <= 0) return false;
    if (!Number.isFinite(chatId) || chatId <= 0) return false;
    return pinnedId === chatId;
  }

  public isChatFavorite(chat: any): boolean {
    const favoriteId = Number(this.favoriteChatId);
    const chatId = Number(chat?.id);
    if (!Number.isFinite(favoriteId) || favoriteId <= 0) return false;
    if (!Number.isFinite(chatId) || chatId <= 0) return false;
    return favoriteId === chatId;
  }

  private comparePinnedChatOrder(left: any, right: any): number {
    const leftPinned = this.isChatPinned(left) ? 1 : 0;
    const rightPinned = this.isChatPinned(right) ? 1 : 0;
    return rightPinned - leftPinned;
  }

  public toggleChatPinMenu(chat: any, event?: MouseEvent): void {
    event?.stopPropagation();
    const chatId = Number(chat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.openChatPinMenuChatId = null;
      return;
    }
    this.openChatPinMenuChatId =
      this.openChatPinMenuChatId === chatId ? null : chatId;
  }

  public togglePinnedChat(chat: any, event?: MouseEvent): void {
    event?.stopPropagation();
    const chatId = Number(chat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    if (this.isChatPinned(chat)) {
      this.pinnedChatId = null;
      this.showToast('Chat desfijado.', 'info', 'Chats', 1600);
    } else {
      this.pinnedChatId = Math.round(chatId);
      this.showToast('Chat fijado en la parte superior.', 'success', 'Chats', 1800);
    }
    this.persistPinnedChatToStorage();
    this.openChatPinMenuChatId = null;
    this.cdr.markForCheck();
  }

  public toggleFavoriteChat(chat: any, event?: MouseEvent): void {
    event?.stopPropagation();
    const chatId = Number(chat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const previousFavoriteChatId = this.favoriteChatId;

    if (this.isChatFavorite(chat)) {
      this.favoriteChatId = null;
      this.showToast('Chat quitado de favoritos.', 'info', 'Chats', 1600);
    } else {
      this.favoriteChatId = Math.round(chatId);
      this.showToast('Chat añadido a favoritos.', 'success', 'Chats', 1800);
    }
    this.persistFavoriteChatToStorage();
    this.syncFavoriteChatToBackend(
      this.favoriteChatId ? Math.round(this.favoriteChatId) : Math.round(chatId),
      previousFavoriteChatId
    );
    this.openChatPinMenuChatId = null;
    this.cdr.markForCheck();
  }

  public toggleChatMuted(chat: any, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.muteRequestInFlight) return;
    const chatId = Number(chat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    if (this.isChatMuted(chat)) {
      this.muteRequestInFlight = true;
      this.chatService.unmuteChat(chatId).subscribe({
        next: () => {
          this.setMutedChatState(chatId, undefined);
          this.showToast('Notificaciones activadas para este chat.', 'info', 'Chats', 1800);
          this.openChatPinMenuChatId = null;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const status = Number(err?.status || 0);
          const backendMsg = String(
            err?.error?.mensaje || err?.error?.message || err?.message || ''
          ).trim();
          const msg =
            status === 403
              ? 'No tienes permiso para cambiar el silencio de este chat.'
              : status === 404
              ? 'El chat ya no está disponible.'
              : backendMsg || 'No se pudo activar las notificaciones.';
          this.showToast(msg, 'warning', 'Chats', 2200);
        },
        complete: () => {
          this.muteRequestInFlight = false;
          this.cdr.markForCheck();
        },
      });
    } else {
      this.muteDurationTargetChat = chat;
      this.showMuteDurationPicker = true;
      this.openChatPinMenuChatId = null;
      this.cdr.markForCheck();
    }
  }

  public cancelarSelectorSilencio(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.showMuteDurationPicker = false;
    this.muteDurationTargetChat = null;
  }

  public confirmarSilencioConDuracion(
    option: MuteDurationOption,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.muteRequestInFlight) return;
    const chatId = Number(this.muteDurationTargetChat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    this.muteRequestInFlight = true;
    const durationMs = option?.durationMs ?? null;
    const payload =
      durationMs === null
        ? { mutedForever: true }
        : { durationSeconds: Math.max(1, Math.floor(durationMs / 1000)) };

    this.chatService.muteChat(chatId, payload).subscribe({
      next: (response) => {
        this.applyMuteStateFromBackend(response, chatId);
        if (!this.isChatMuted(chatId)) {
          // Fallback defensivo si backend no devuelve mutedUntil en respuesta.
          if (durationMs === null) this.setMutedChatState(chatId, null);
          else this.setMutedChatState(chatId, Date.now() + durationMs);
        }
        this.showMuteDurationPicker = false;
        this.muteDurationTargetChat = null;
        this.showToast(
          durationMs === null
            ? 'Chat silenciado indefinidamente.'
            : `Chat silenciado por ${option.label.toLowerCase()}.`,
          'success',
          'Chats',
          1900
        );
      },
      error: (err) => {
        const status = Number(err?.status || 0);
        const backendMsg = String(
          err?.error?.mensaje || err?.error?.message || err?.message || ''
        ).trim();
        const msg =
          status === 403
            ? 'No tienes permiso para silenciar este chat.'
            : status === 404
            ? 'El chat ya no está disponible.'
            : backendMsg || 'No se pudo silenciar este chat.';
        this.showToast(msg, 'warning', 'Chats', 2200);
      },
      complete: () => {
        this.muteRequestInFlight = false;
        this.cdr.markForCheck();
      },
    });
  }

  public vaciarChat(chat: any, event?: MouseEvent): void {
    event?.stopPropagation();
    const targetChat = chat || this.chatActual;
    const chatId = Number(targetChat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    const chatName = String(targetChat?.nombre || 'este chat').trim();

    Swal.fire({
      title: 'Vaciar chat',
      text: `Se ocultarán los mensajes anteriores en "${chatName}" solo para tu cuenta.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Vaciar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    }).then((res) => {
      if (!res.isConfirmed) return;

      this.chatService.clearChat(chatId).subscribe({
        next: () => {
          const activeChatId = Number(this.chatActual?.id);
          if (activeChatId === chatId) {
            this.mensajesSeleccionados = [];
            this.syncActiveHistoryStateMessages();
            this.loadInitialMessagesPage(this.chatActual, this.getLeftGroupIdsSet());
          }

          if (
            this.pinnedMessage &&
            Number(this.pinnedMessage?.chatId ?? chatId) === chatId
          ) {
            this.pinnedMessage = null;
          }

          this.chats = updateChatPreview(this.chats, chatId, 'Sin mensajes aún', null);
          const updatedChat = this.chats.find((c) => Number(c?.id) === chatId);
          if (updatedChat) {
            updatedChat.unreadCount = 0;
            updatedChat.ultimaMensajeTipo = null;
            updatedChat.ultimaMensajeEmisorId = null;
            updatedChat.ultimaMensajeRaw = null;
            updatedChat.__ultimaMensajeRaw = '';
            updatedChat.__ultimaTipo = null;
            updatedChat.ultimaMensajeAudioUrl = null;
            updatedChat.ultimaMensajeAudioMime = null;
            updatedChat.ultimaMensajeAudioDuracionMs = null;
            updatedChat.ultimaMensajeImageUrl = null;
            updatedChat.ultimaMensajeImageMime = null;
            updatedChat.ultimaMensajeImageNombre = null;
            updatedChat.ultimaMensajeFileUrl = null;
            updatedChat.ultimaMensajeFileMime = null;
            updatedChat.ultimaMensajeFileNombre = null;
            updatedChat.ultimaMensajeFileSizeBytes = null;
            this.clearChatImagePreview(updatedChat);
            this.clearChatFilePreview(updatedChat);
          }

          this.openChatPinMenuChatId = null;
          this.cerrarMenuOpciones();
          this.showToast('Chat vaciado para tu cuenta.', 'success', 'Chats', 1800);
          this.listarTodosLosChats();
          this.cdr.markForCheck();
        },
        error: (err) => {
          const status = Number(err?.status || 0);
          const backendMsg = String(
            err?.error?.mensaje || err?.error?.message || err?.message || ''
          ).trim();
          const msg =
            status === 403
              ? 'No tienes permiso para vaciar este chat.'
              : status === 404
              ? 'El chat ya no está disponible.'
              : backendMsg || 'No se pudo vaciar el chat.';
          this.openChatPinMenuChatId = null;
          this.cerrarMenuOpciones();
          this.showToast(msg, 'warning', 'Chats', 2200);
          this.cdr.markForCheck();
        },
      });
    });
  }

  public eliminarChat(chat: any, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.deleteChatRequestInFlight) return;

    const targetChat = chat || this.chatActual;
    const chatId = Number(targetChat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    const chatName = String(targetChat?.nombre || 'este chat').trim();
    Swal.fire({
      title: 'Eliminar chat',
      text: `Este chat se ocultará solo para ti. "${chatName}" volverá a aparecer si llegan mensajes nuevos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ocultar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    }).then(async (res) => {
      if (!res.isConfirmed) return;

      this.deleteChatRequestInFlight = true;
      try {
        await this.chatService.hideChatForMe(chatId);
        this.removeChatFromLocalState(chatId);
        this.showToast('Chat ocultado solo para ti.', 'success', 'Chats', 1900);
      } catch (err: any) {
        const status = Number(err?.status || 0);
        if (status === 404) {
          this.handleChatNoLongerVisible(chatId);
          return;
        }
        const backendMsg = String(
          err?.error?.mensaje || err?.error?.message || err?.message || ''
        ).trim();
        const msg =
          status === 403
            ? 'No tienes permisos para este chat.'
            : status === 400
            ? backendMsg || 'No se pudo ocultar el chat: datos inválidos.'
            : backendMsg || 'No se pudo ocultar el chat.';
        this.openChatPinMenuChatId = null;
        this.cerrarMenuOpciones();
        this.showToast(msg, 'warning', 'Chats', 2300);
      } finally {
        this.deleteChatRequestInFlight = false;
        this.cdr.markForCheck();
      }
    });
  }

  private removeChatFromLocalState(chatIdRaw: unknown): boolean {
    const chatId = Number(chatIdRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return false;

    const normalizedChatId = Math.round(chatId);
    this.wsService.desuscribirseDeGrupo(normalizedChatId, 'chat-removed-local-state');
    const existed = (this.chats || []).some(
      (c: any) => Number(c?.id) === normalizedChatId
    );
    this.chats = (this.chats || []).filter(
      (c: any) => Number(c?.id) !== normalizedChatId
    );

    this.clearStoredDraftForChat(normalizedChatId);
    if (this.temporarySecondsByChatId.delete(normalizedChatId)) {
      this.persistTemporarySettingsToStorage();
    }
    this.setMutedChatState(normalizedChatId, undefined);
    this.closedGroupReasonByChatId.delete(normalizedChatId);
    this.groupRecipientSeedByChatId.delete(normalizedChatId);
    this.groupHistoryHiddenByChatId.delete(normalizedChatId);
    this.adminDirectReadOnlyChatIds.delete(normalizedChatId);
    this.forgetAdminDirectChatCache(normalizedChatId);
    this.forgetAdminDirectMessagesCache(normalizedChatId);
    this.pendingGroupTextSendByChatId.delete(normalizedChatId);
    this.retryingGroupTextSendByChatId.delete(normalizedChatId);
    this.groupTextSendInFlightByChatId.delete(normalizedChatId);
    this.historyStateByConversation.delete(
      buildConversationHistoryKey(normalizedChatId, false)
    );
    this.historyStateByConversation.delete(
      buildConversationHistoryKey(normalizedChatId, true)
    );

    if (Number(this.pinnedChatId) === normalizedChatId) {
      this.pinnedChatId = null;
      this.persistPinnedChatToStorage();
    }

    const wasActive =
      Number(this.chatSeleccionadoId) === normalizedChatId ||
      Number(this.chatActual?.id) === normalizedChatId;
    if (wasActive) {
      this.chatSeleccionadoId = null;
      this.chatActual = null;
      this.mensajesSeleccionados = [];
      this.pinnedMessage = null;
      this.pinTargetMessage = null;
      this.mensajeNuevo = '';
      this.haSalidoDelGrupo = false;
      this.usuarioEscribiendo = false;
      this.usuarioGrabandoAudio = false;
      this.typingSetHeader.clear();
      this.audioSetHeader.clear();
      this.escribiendoHeader = '';
      this.audioGrabandoHeader = '';
      this.showPinnedActionsMenu = false;
      this.activeMainView = 'chat';
      this.closeGroupInfoPanel();
      this.closeUserInfoPanel();
      this.closeMessageSearchPanel();
      this.closePollVotesPanel();
      this.closeFilePreview();
      this.resetEdicion();
    }

    if (Number(this.openChatPinMenuChatId) === normalizedChatId) {
      this.openChatPinMenuChatId = null;
    }
    this.cerrarMenuOpciones();
    this.syncStarredMessagesWithChatSnapshots();
    return existed;
  }

  private handleChatNoLongerVisible(chatIdRaw: unknown, showNotice: boolean = true): void {
    this.removeChatFromLocalState(chatIdRaw);
    if (showNotice) {
      this.showToast('Este chat ya no está disponible.', 'info', 'Chats', 2200);
    }
    this.cdr.markForCheck();
  }

  private normalizeStarredMessageItems(raw: unknown): StarredMessageItem[] {
    const list = Array.isArray(raw) ? raw : [];
    const dedup = new Map<number, StarredMessageItem>();

    for (const row of list) {
      const item = (row || {}) as StarredMessageDTO;
      const messageId = Number(item?.messageId ?? item?.mensajeId);
      if (!Number.isFinite(messageId) || messageId <= 0) continue;

      const chatIdRaw = Number(item?.chatId);
      const chatId =
        Number.isFinite(chatIdRaw) && chatIdRaw > 0 ? Math.round(chatIdRaw) : null;
      const emisorId = Number(item?.emisorId ?? item?.senderId ?? 0) || 0;
      const fallbackSenderName =
        emisorId > 0
          ? this.resolveGroupMemberDisplayName(Number(chatId || 0), emisorId)
          : '';
      const normalizedTipo =
        String(item?.tipo ?? item?.tipoMensaje ?? 'TEXT').trim().toUpperCase() ||
        'TEXT';
      const rawPreview = String(item?.preview ?? item?.contenido ?? '').trim();

      const normalized: StarredMessageItem = {
        messageId: Math.round(messageId),
        chatId,
        chatNombre:
          String(item?.chatNombre ?? item?.nombreChat ?? '').trim() ||
          fallbackSenderName ||
          'Chat',
        emisorId,
        emisorNombre:
          String(
            item?.nombreEmisorCompleto ??
              item?.emisorNombre ??
              item?.nombreEmisor ??
              item?.senderName ??
              ''
          ).trim() ||
          fallbackSenderName ||
          'Usuario',
        tipo: normalizedTipo,
        preview: this.normalizeStarredPreviewByTipo(normalizedTipo, rawPreview),
        fechaEnvio:
          String(item?.fechaEnvio ?? item?.fechaMensaje ?? '').trim() || null,
        starredAt:
          String(item?.destacadoEn ?? item?.starredAt ?? item?.createdAt ?? '').trim() ||
          String(item?.fechaEnvio ?? item?.fechaMensaje ?? '').trim() ||
          new Date().toISOString(),
        audioSrc: null,
        audioDurationLabel: null,
        imageSrc: null,
        imageAlt: null,
        imageCaption: null,
        fileSrc: null,
        fileName: null,
        fileSizeLabel: null,
        fileTypeLabel: null,
        fileIconClass: null,
        fileCaption: null,
      };
      dedup.set(normalized.messageId, normalized);
    }

    return Array.from(dedup.values());
  }

  private normalizeStarredPreviewByTipo(tipo: string, previewRaw: string): string {
    const normalizedTipo =
      String(tipo || 'TEXT').trim().toUpperCase() || 'TEXT';
    const rawPreview = String(previewRaw || '').trim();
    const encryptedLike = this.looksLikeEncryptedPreview(rawPreview);

    if (normalizedTipo === 'AUDIO') {
      return encryptedLike || !rawPreview ? 'Mensaje de voz' : rawPreview;
    }
    if (normalizedTipo === 'IMAGE') {
      if (encryptedLike || !rawPreview) return 'Imagen';
      return `Imagen: ${rawPreview}`;
    }
    if (normalizedTipo === 'VIDEO') {
      if (encryptedLike || !rawPreview) return 'Video';
      return `Video: ${rawPreview}`;
    }
    if (normalizedTipo === 'FILE') {
      if (encryptedLike || !rawPreview) return 'Archivo';
      return rawPreview.toLowerCase().startsWith('archivo')
        ? rawPreview
        : `Archivo: ${rawPreview}`;
    }
    if (normalizedTipo === 'POLL') {
      return encryptedLike || !rawPreview ? 'Encuesta' : rawPreview;
    }
    if (encryptedLike) return '[Mensaje cifrado]';
    return rawPreview || '[Sin contenido]';
  }

  private looksLikeEncryptedPreview(raw: string): boolean {
    const text = String(raw || '').trim();
    if (!text) return false;
    const normalized = text.toLowerCase();
    if (text.startsWith('{') && text.endsWith('}')) return true;
    if (text.startsWith('{"') || text.startsWith('{\"')) return true;
    return (
      normalized.includes('forreceptor') ||
      normalized.includes('forreceptores') ||
      normalized.includes('foremisor') ||
      normalized.includes('ivfile') ||
      normalized.includes('ciphertext') ||
      normalized.includes('captionciphertext')
    );
  }

  private applyStarredMessages(
    items: StarredMessageItem[],
    resetKnownIds = false
  ): void {
    if (resetKnownIds) {
      this.starredMessageIds.clear();
    }
    const normalized = this.normalizeStarredMessageItems(items);
    this.mensajesDestacados = normalized;
    for (const item of normalized) {
      const id = Number(item?.messageId);
      if (!Number.isFinite(id) || id <= 0) continue;
      this.starredMessageIds.add(id);
    }
    this.syncStarredMessagesWithChatSnapshots();
    this.cleanupHydratedStarredMessages();
    this.prefetchHydratedStarredMessages();
  }

  private upsertStarredMessage(item: StarredMessageItem): void {
    const messageId = Number(item?.messageId);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    const normalized = this.normalizeStarredMessageItems([item])[0];
    if (!normalized) return;

    this.starredMessageIds.add(messageId);
    this.mensajesDestacados = [
      normalized,
      ...this.mensajesDestacados.filter((x) => Number(x?.messageId) !== messageId),
    ];
    this.syncStarredMessagesWithChatSnapshots();
    this.prefetchHydratedStarredMessages([messageId]);
  }

  private removeStarredMessageById(messageId: number): void {
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    this.mensajesDestacados = this.mensajesDestacados.filter(
      (item) => Number(item?.messageId) !== messageId
    );
    this.starredMessageIds.delete(messageId);
    this.starredHydratedMessagesById.delete(messageId);
  }

  private loadStarredMessagesFromBackend(
    showErrorToast = false,
    requestedPage?: number
  ): void {
    if (this.loadingStarredMessages) return;
    this.loadingStarredMessages = true;
    const page =
      Number.isFinite(Number(requestedPage)) && Number(requestedPage) >= 0
        ? Math.floor(Number(requestedPage))
        : Math.max(0, Number(this.starredPage || 0));

    this.chatService
      .listarDestacados(page, this.starredPageSize, 'fechaMensaje,desc')
      .pipe(
        finalize(() => {
          this.loadingStarredMessages = false;
        })
      )
      .subscribe({
        next: (response) => {
          const parsed = this.parseStarredMessagesPageResponse(response, page);
          this.starredPage = parsed.page;
          this.starredPageSize = parsed.size;
          this.starredTotalPages = parsed.totalPages;
          this.starredTotalElements = parsed.totalElements;
          this.starredHasNext = parsed.hasNext;
          this.starredHasPrevious = parsed.hasPrevious;
          this.applyStarredMessages(
            this.normalizeStarredMessageItems(parsed.content),
            parsed.totalElements === 0
          );
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.warn('[destacados] no se pudieron cargar desde backend', error);
          if (showErrorToast) {
            this.showToast(
              this.getDestacadoListErrorMessage(error),
              'warning',
              'Destacados'
            );
          }
          this.cdr.markForCheck();
        },
      });
  }

  private parseStarredMessagesPageResponse(
    response: StarredMessagesPageDTO | StarredMessageDTO[] | unknown,
    fallbackPage: number
  ): {
    content: StarredMessageDTO[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  } {
    if (Array.isArray(response)) {
      const content = response as StarredMessageDTO[];
      return {
        content,
        page: Math.max(0, Number(fallbackPage || 0)),
        size: this.starredPageSize,
        totalElements: content.length,
        totalPages: content.length > 0 ? 1 : 1,
        hasNext: false,
        hasPrevious: false,
      };
    }

    const pageResponse = (response || {}) as StarredMessagesPageDTO;
    const content = Array.isArray(pageResponse?.content)
      ? (pageResponse.content as StarredMessageDTO[])
      : [];
    const page = Math.max(
      0,
      Number(
        pageResponse?.page ??
          pageResponse?.number ??
          fallbackPage ??
          this.starredPage
      ) || 0
    );
    const size = Math.max(
      1,
      Number(pageResponse?.size ?? this.starredPageSize) || this.starredPageSize
    );
    const totalElements = Math.max(
      0,
      Number(pageResponse?.totalElements ?? content.length) || 0
    );
    const totalPages = Math.max(
      1,
      Number(pageResponse?.totalPages ?? 1) || 1
    );
    const fallbackLast = page >= totalPages - 1;
    const fallbackFirst = page <= 0;
    const hasNext = Boolean(
      pageResponse?.hasNext ?? !(pageResponse?.last ?? fallbackLast)
    );
    const hasPrevious = Boolean(
      pageResponse?.hasPrevious ?? !(pageResponse?.first ?? fallbackFirst)
    );

    return {
      content,
      page,
      size,
      totalElements,
      totalPages,
      hasNext,
      hasPrevious,
    };
  }

  private cleanupHydratedStarredMessages(): void {
    const allowedIds = new Set<number>();
    for (const item of this.mensajesDestacados || []) {
      const messageId = Number(item?.messageId);
      if (!Number.isFinite(messageId) || messageId <= 0) continue;
      allowedIds.add(messageId);
    }

    for (const key of Array.from(this.starredHydratedMessagesById.keys())) {
      if (!allowedIds.has(key)) {
        this.starredHydratedMessagesById.delete(key);
      }
    }
  }

  private prefetchHydratedStarredMessages(limitToMessageIds?: number[]): void {
    const targetByChat = new Map<number, Set<number>>();
    const only = new Set<number>(
      (limitToMessageIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    for (const item of this.mensajesDestacados || []) {
      const messageId = Number(item?.messageId);
      const chatId = Number(item?.chatId);
      if (!Number.isFinite(messageId) || messageId <= 0) continue;
      if (!Number.isFinite(chatId) || chatId <= 0) continue;
      if (this.starredHydratedMessagesById.has(messageId)) continue;
      if (only.size > 0 && !only.has(messageId)) continue;

      if (!targetByChat.has(chatId)) {
        targetByChat.set(chatId, new Set<number>());
      }
      targetByChat.get(chatId)?.add(messageId);
    }

    if (targetByChat.size === 0) return;
    const requestSeq = ++this.starredHydrationRequestSeq;

    void (async () => {
      for (const [chatId, targetIds] of targetByChat.entries()) {
        if (requestSeq !== this.starredHydrationRequestSeq) return;
        const chat = (this.chats || []).find((c: any) => Number(c?.id) === chatId);
        if (!chat) continue;

        const esGrupo = !!chat?.esGrupo;
        let rawMessages: any[] = [];
        try {
          rawMessages = await firstValueFrom(
            this.getHistorySource$(chatId, esGrupo, 0, this.HISTORY_PAGE_SIZE)
          );
        } catch {
          continue;
        }

        let decrypted: MensajeDTO[] = [];
        try {
          decrypted = await this.decryptHistoryPageMessages(
            rawMessages || [],
            chatId,
            esGrupo,
            esGrupo ? 'starred-prefetch-group' : 'starred-prefetch-individual'
          );
        } catch {
          continue;
        }

        let changed = false;
        for (const message of decrypted || []) {
          const messageId = Number(message?.id);
          if (!Number.isFinite(messageId) || messageId <= 0) continue;
          if (!targetIds.has(messageId)) continue;
          this.starredHydratedMessagesById.set(messageId, message);
          changed = true;
        }

        if (changed) {
          this.cdr.markForCheck();
        }
      }
    })();
  }

  private syncStarredMessagesWithChatSnapshots(): void {
    if (!Array.isArray(this.mensajesDestacados) || this.mensajesDestacados.length === 0) {
      return;
    }
    const byChatId = new Map<number, any>();
    for (const chat of this.chats || []) {
      const id = Number(chat?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      byChatId.set(id, chat);
    }

    let changed = false;
    this.mensajesDestacados = this.mensajesDestacados.map((item) => {
      const chatId = Number(item?.chatId);
      const chat = byChatId.get(chatId);
      if (!chat) return item;

      const nextChatNombre = String(chat?.nombre || item.chatNombre || '').trim() || 'Chat';
      const senderName =
        this.resolveGroupMemberDisplayName(chatId, Number(item?.emisorId || 0)) ||
        item.emisorNombre;
      if (nextChatNombre === item.chatNombre && senderName === item.emisorNombre) {
        return item;
      }
      changed = true;
      return {
        ...item,
        chatNombre: nextChatNombre,
        emisorNombre: senderName || item.emisorNombre,
      };
    });
    if (!changed) return;
  }

  private buildStarredMessagePreview(mensaje: MensajeDTO): string {
    const tipo = String(mensaje?.tipo || 'TEXT').trim().toUpperCase();
    if (tipo === 'AUDIO') {
      const dur = this.formatDur(mensaje?.audioDuracionMs || 0);
      return dur ? `Mensaje de voz (${dur})` : 'Mensaje de voz';
    }
    if (tipo === 'IMAGE') {
      const caption = String(mensaje?.contenido || '').trim();
      return caption ? `Imagen: ${caption}` : 'Imagen';
    }
    if (tipo === 'VIDEO') {
      const caption = String(mensaje?.contenido || '').trim();
      return caption ? `Video: ${caption}` : 'Video';
    }
    if (tipo === 'FILE') {
      return `Archivo: ${this.getFileName(mensaje)}`;
    }
    if (tipo === 'POLL') {
      const question = this.getPollQuestion(mensaje);
      return question ? `Encuesta: ${question}` : 'Encuesta';
    }
    const text = String(mensaje?.contenido || '').trim();
    if (!text) return '[Sin contenido]';
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  }

  private buildStarredMessageItem(mensaje: MensajeDTO): StarredMessageItem {
    const messageId = Number(mensaje?.id);
    const chatIdRaw = Number(mensaje?.chatId ?? this.chatActual?.id);
    const chatId =
      Number.isFinite(chatIdRaw) && chatIdRaw > 0 ? Math.round(chatIdRaw) : null;
    const chatItem = (this.chats || []).find(
      (chat: any) => Number(chat?.id) === chatId
    );
    const chatNombre =
      String(chatItem?.nombre || this.chatActual?.nombre || '').trim() || 'Chat';
    const emisorId = Number(mensaje?.emisorId || 0);
    const emisorNombre =
      `${mensaje?.emisorNombre || ''} ${mensaje?.emisorApellido || ''}`.trim() ||
      this.resolveGroupMemberDisplayName(Number(chatId || 0), emisorId) ||
      this.obtenerNombrePorId(emisorId) ||
      `Usuario ${emisorId || ''}`.trim() ||
      'Usuario';

    return {
      messageId: Number.isFinite(messageId) ? Math.round(messageId) : 0,
      chatId,
      chatNombre,
      emisorId,
      emisorNombre,
      tipo: String(mensaje?.tipo || 'TEXT').trim().toUpperCase(),
      preview: this.buildStarredMessagePreview(mensaje),
      fechaEnvio: String(mensaje?.fechaEnvio || '').trim() || null,
      starredAt: new Date().toISOString(),
      ...this.buildStarredMediaPatchFromMessage(mensaje),
    };
  }

  private buildStarredMediaPatchFromMessage(
    mensaje: MensajeDTO
  ): Partial<StarredMessageItem> {
    const tipo = String(mensaje?.tipo || 'TEXT').trim().toUpperCase();

    const clearPatch: Partial<StarredMessageItem> = {
      audioSrc: null,
      audioDurationLabel: null,
      imageSrc: null,
      imageAlt: null,
      imageCaption: null,
      fileSrc: null,
      fileName: null,
      fileSizeLabel: null,
      fileTypeLabel: null,
      fileIconClass: null,
      fileCaption: null,
    };

    if (tipo === 'AUDIO') {
      const audioSrc = String(this.getAudioSrc(mensaje) || '').trim();
      return {
        ...clearPatch,
        audioSrc: audioSrc || null,
        audioDurationLabel: this.formatDur(mensaje?.audioDuracionMs || 0) || null,
      };
    }

    if (tipo === 'IMAGE') {
      const imageSrc = String(this.getImageSrc(mensaje) || '').trim();
      const rawCaption = String(mensaje?.contenido || '').trim();
      return {
        ...clearPatch,
        imageSrc: imageSrc || null,
        imageAlt: this.getImageAlt(mensaje),
        imageCaption: rawCaption && !rawCaption.startsWith('{') ? rawCaption : null,
      };
    }

    if (tipo === 'FILE') {
      const fileSrc = String(this.getFileSrc(mensaje) || '').trim();
      const fileMime = String(mensaje?.fileMime || '').trim();
      return {
        ...clearPatch,
        fileSrc: fileSrc || null,
        fileName: this.getFileName(mensaje),
        fileSizeLabel: this.getFileSizeLabel(mensaje) || null,
        fileTypeLabel: this.getFileTypeLabel(mensaje) || null,
        fileIconClass: this.getFileIconClass(fileMime) || 'bi-file-earmark',
        fileCaption: this.getFileCaption(mensaje) || null,
      };
    }

    return clearPatch;
  }

  private resolveStarredMessageFromApiResponse(
    raw: unknown,
    fallbackMessage: MensajeDTO
  ): StarredMessageItem {
    const candidates: unknown[] = [];
    if (Array.isArray(raw)) {
      candidates.push(...raw);
    } else {
      candidates.push(raw);
    }

    const payload = (raw || {}) as any;
    if (payload && typeof payload === 'object') {
      candidates.push(payload?.item, payload?.data, payload?.mensaje);
      if (Array.isArray(payload?.items)) {
        candidates.push(...payload.items);
      }
    }

    const normalized = this.normalizeStarredMessageItems(candidates)[0];
    return normalized || this.buildStarredMessageItem(fallbackMessage);
  }

  private normalizeChatDraftText(raw: unknown): string {
    return String(raw || '').replace(/\r\n?/g, '\n');
  }

  private loadChatDraftsFromStorage(): void {
    this.draftByChatId.clear();
    try {
      const raw = localStorage.getItem(this.getChatDraftStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      for (const [chatIdRaw, draftRaw] of Object.entries(parsed)) {
        const chatId = Number(chatIdRaw);
        const text = this.normalizeChatDraftText(draftRaw);
        if (!Number.isFinite(chatId) || chatId <= 0) continue;
        if (!text.trim()) continue;
        this.draftByChatId.set(chatId, text);
      }
    } catch {}
  }

  private persistChatDraftsToStorage(): void {
    const payload: Record<string, string> = {};
    for (const [chatId, draft] of this.draftByChatId.entries()) {
      const id = Number(chatId);
      const text = this.normalizeChatDraftText(draft);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!text.trim()) continue;
      payload[String(id)] = text;
    }
    const storageKey = this.getChatDraftStorageKey();
    if (Object.keys(payload).length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  private getStoredDraftForChat(chatId: number): string {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return '';
    return String(this.draftByChatId.get(id) || '');
  }

  private setStoredDraftForChat(chatId: number, draft: string): void {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return;
    const text = this.normalizeChatDraftText(draft);
    if (text.trim()) {
      this.draftByChatId.set(id, text);
    } else {
      this.draftByChatId.delete(id);
    }
    this.syncChatListItemDraftState(id);
    this.persistChatDraftsToStorage();
  }

  private clearStoredDraftForChat(chatId: number): void {
    this.setStoredDraftForChat(chatId, '');
  }

  private syncChatListItemDraftState(chatId: number): void {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return;
    const draft = this.getStoredDraftForChat(id);
    const normalized = draft.trim() ? draft : null;
    const chatItem = (this.chats || []).find((c: any) => Number(c?.id) === id);
    if (chatItem) {
      chatItem.draftMensaje = normalized;
    }
    if (Number(this.chatActual?.id) === id) {
      this.chatActual.draftMensaje = normalized;
    }
  }

  private applyDraftsToChatList(): void {
    for (const chat of this.chats || []) {
      const chatId = Number(chat?.id);
      if (!Number.isFinite(chatId) || chatId <= 0) {
        chat.draftMensaje = null;
        continue;
      }
      const draft = this.getStoredDraftForChat(chatId);
      chat.draftMensaje = draft.trim() ? draft : null;
    }
  }

  private persistActiveChatDraft(): void {
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    this.setStoredDraftForChat(chatId, this.mensajeNuevo || '');
  }

  private restoreDraftForChat(chat: any): void {
    const chatId = Number(chat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.mensajeNuevo = '';
      this.composerDraftPrefixVisible = false;
      this.composeCursorStart = 0;
      this.composeCursorEnd = 0;
      return;
    }
    const draft = this.getStoredDraftForChat(chatId);
    this.mensajeNuevo = draft;
    this.composerDraftPrefixVisible = !!draft.trim();
    this.composeCursorStart = draft.length;
    this.composeCursorEnd = draft.length;
    this.syncChatListItemDraftState(chatId);
  }

  private getTemporarySettingsStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.TEMPORARY_CHAT_SETTINGS_KEY}:${userId}`
      : this.TEMPORARY_CHAT_SETTINGS_KEY;
  }

  private loadTemporarySettingsFromStorage(): void {
    this.temporarySecondsByChatId.clear();
    try {
      const raw = localStorage.getItem(this.getTemporarySettingsStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      for (const [chatIdRaw, secondsRaw] of Object.entries(parsed)) {
        const chatId = Number(chatIdRaw);
        const seconds = Number(secondsRaw);
        if (!Number.isFinite(chatId) || chatId <= 0) continue;
        if (!Number.isFinite(seconds) || seconds <= 0) continue;
        this.temporarySecondsByChatId.set(chatId, seconds);
      }
    } catch {}
  }

  private persistTemporarySettingsToStorage(): void {
    const payload: Record<string, number> = {};
    for (const [chatId, seconds] of this.temporarySecondsByChatId.entries()) {
      const id = Number(chatId);
      const value = Number(seconds);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!Number.isFinite(value) || value <= 0) continue;
      payload[String(id)] = value;
    }
    const storageKey = this.getTemporarySettingsStorageKey();
    if (Object.keys(payload).length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  private getTemporarySecondsForChat(chatIdRaw: unknown): number | null {
    const chatId = Number(chatIdRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return null;
    const value = Number(this.temporarySecondsByChatId.get(chatId) || 0);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }

  private setTemporarySecondsForChat(chatIdRaw: unknown, secondsRaw: unknown): void {
    const chatId = Number(chatIdRaw);
    const seconds = Number(secondsRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    if (!Number.isFinite(seconds) || seconds <= 0) {
      this.temporarySecondsByChatId.delete(chatId);
      this.persistTemporarySettingsToStorage();
      this.cdr.markForCheck();
      return;
    }
    this.temporarySecondsByChatId.set(chatId, seconds);
    this.persistTemporarySettingsToStorage();
    this.cdr.markForCheck();
  }

  private getActiveChatTemporarySeconds(): number | null {
    return this.getTemporarySecondsForChat(this.chatActual?.id);
  }

  private formatTemporaryBadge(secondsRaw: number): string {
    const seconds = Number(secondsRaw);
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    if (seconds % 3600 === 0) return `${seconds / 3600}h`;
    if (seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`;
  }

  private attachTemporaryMetadata<T extends object>(payload: T): T {
    const payloadAny = payload as any;
    const chatId = Number(payloadAny?.['chatId'] ?? this.chatActual?.id);
    const seconds = this.getTemporarySecondsForChat(chatId);
    if (!seconds) return payload;
    payloadAny['mensajeTemporal'] = true;
    payloadAny['mensajeTemporalSegundos'] = seconds;
    return payload;
  }

  private closeTemporaryMessagePopup(): void {
    this.showTemporaryMessagePopup = false;
  }

  private getLeftGroupIdsStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.LEFT_GROUP_IDS_KEY}:${userId}`
      : this.LEFT_GROUP_IDS_KEY;
  }

  private getLeftGroupNoticeStorageKey(): string {
    const userId = Number(this.usuarioActualId);
    return Number.isFinite(userId) && userId > 0
      ? `${this.LEFT_GROUP_NOTICE_KEY}:${userId}`
      : this.LEFT_GROUP_NOTICE_KEY;
  }

  private getLeftGroupIdsSet(): Set<number> {
    try {
      const raw = localStorage.getItem(this.getLeftGroupIdsStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed)
        ? parsed
            .map((v: any) => Number(v))
            .filter((v: number) => Number.isFinite(v) && v > 0)
        : [];
      return new Set<number>(ids);
    } catch {
      return new Set<number>();
    }
  }

  private persistLeftGroupIdsSet(leftSet: Set<number>): void {
    const values = Array.from(leftSet).filter(
      (v) => Number.isFinite(Number(v)) && Number(v) > 0
    );
    localStorage.setItem(this.getLeftGroupIdsStorageKey(), JSON.stringify(values));
  }

  private getLeftGroupNoticeMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.getLeftGroupNoticeStorageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const chatId = Number(k);
        const text = String(v || '').trim();
        if (!Number.isFinite(chatId) || chatId <= 0) continue;
        if (!text) continue;
        out[String(chatId)] = text;
      }
      return out;
    } catch {
      return {};
    }
  }

  private persistLeftGroupNoticeMap(map: Record<string, string>): void {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(map || {})) {
      const chatId = Number(k);
      const text = String(v || '').trim();
      if (!Number.isFinite(chatId) || chatId <= 0) continue;
      if (!text) continue;
      cleaned[String(chatId)] = text;
    }
    localStorage.setItem(
      this.getLeftGroupNoticeStorageKey(),
      JSON.stringify(cleaned)
    );
  }

  private getLeftGroupNotice(chatId: number): string | null {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const map = this.getLeftGroupNoticeMap();
    const txt = String(map[String(id)] || '').trim();
    return txt || null;
  }

  private setLeftGroupNotice(chatId: number, notice: string): void {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return;
    const normalized = String(notice || '').trim() || 'Has salido del grupo';
    const map = this.getLeftGroupNoticeMap();
    map[String(id)] = normalized;
    this.persistLeftGroupNoticeMap(map);
  }

  private clearLeftGroupNotice(chatId: number): void {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return;
    const map = this.getLeftGroupNoticeMap();
    if (map[String(id)] == null) return;
    delete map[String(id)];
    this.persistLeftGroupNoticeMap(map);
  }

  private getGroupExitNoticeForChat(chatId: number): string {
    return this.getLeftGroupNotice(chatId) || 'Has salido del grupo';
  }

  private markCurrentUserOutOfGroup(
    chatId: number,
    notice: string,
    systemMessage?: Partial<MensajeDTO> | null,
    syncChatPreview = true
  ): void {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return;
    this.wsService.desuscribirseDeGrupo(id, 'not-group-member');

    const normalizedNotice =
      String(notice || '').trim() || 'Has salido del grupo';

    const leftSet = this.getLeftGroupIdsSet();
    leftSet.add(id);
    this.persistLeftGroupIdsSet(leftSet);
    this.setLeftGroupNotice(id, normalizedNotice);

    const chatItem = (this.chats || []).find((c) => Number(c?.id) === id);
    const shouldSyncPreview =
      syncChatPreview && !/^has sido expulsad[oa]\b/i.test(normalizedNotice);
    if (chatItem && shouldSyncPreview) {
      chatItem.ultimaMensaje = normalizedNotice;
      chatItem.ultimaMensajeTipo = 'SYSTEM';
      chatItem.__ultimaTipo = 'SYSTEM';
      chatItem.__ultimaMensajeRaw = normalizedNotice;

      const nowIso = new Date().toISOString();
      const patchedMessage: Partial<MensajeDTO> = {
        id: Number(systemMessage?.id || chatItem?.lastPreviewId || 0) || undefined,
        chatId: id,
        emisorId:
          Number(systemMessage?.emisorId || this.usuarioActualId || 0) || undefined,
        receptorId: id,
        contenido: normalizedNotice,
        fechaEnvio: String(systemMessage?.fechaEnvio || nowIso),
        tipo: 'SYSTEM',
        esSistema: true,
        systemEvent: String(systemMessage?.systemEvent || '').trim() || 'GROUP_MEMBER_EXPELLED',
      };
      chatItem.ultimaFecha = patchedMessage.fechaEnvio || chatItem.ultimaFecha || nowIso;
      this.stampChatLastMessageFieldsFromMessage(chatItem, patchedMessage);
    }

    if (this.chatActual?.esGrupo && Number(this.chatActual?.id) === id) {
      this.haSalidoDelGrupo = true;
      this.mensajeNuevo = normalizedNotice;
    }
  }

  private clearCurrentUserOutOfGroup(chatId: number): void {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) return;
    const prevNotice = this.getGroupExitNoticeForChat(id);
    const leftSet = this.getLeftGroupIdsSet();
    if (leftSet.has(id)) {
      leftSet.delete(id);
      this.persistLeftGroupIdsSet(leftSet);
    }
    this.clearLeftGroupNotice(id);

    if (this.chatActual?.esGrupo && Number(this.chatActual?.id) === id) {
      this.haSalidoDelGrupo = false;
      const currentComposerText = String(this.mensajeNuevo || '').trim();
      if (
        currentComposerText === String(prevNotice || '').trim() ||
        /^has sido expulsad[oa]\b/i.test(currentComposerText) ||
        /^has salido del grupo$/i.test(currentComposerText)
      ) {
        this.mensajeNuevo = '';
      }
    }
  }

  private resolveGroupNameById(groupId: number): string {
    const id = Number(groupId);
    if (!Number.isFinite(id) || id <= 0) return '';
    if (this.chatActual?.esGrupo && Number(this.chatActual?.id) === id) {
      const activeName = String(
        this.chatActual?.nombreGrupo || this.chatActual?.nombre || ''
      ).trim();
      if (activeName) return activeName;
    }
    const listItem = (this.chats || []).find((c) => Number(c?.id) === id);
    return String(listItem?.nombreGrupo || listItem?.nombre || '').trim();
  }

  private extractGroupExpulsionTargetUserId(mensaje: any): number {
    const candidateFields = [
      'targetUserId',
      'targetId',
      'usuarioObjetivoId',
      'miembroId',
      'memberId',
      'removedUserId',
      'removedMemberId',
      'expulsadoId',
      'kickedUserId',
      'affectedUserId',
      'userIdObjetivo',
    ];
    for (const key of candidateFields) {
      const value = Number((mensaje as any)?.[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  private resolveExpulsorDisplayName(mensaje: any, groupId: number): string {
    const directFields = [
      (mensaje as any)?.expulsorNombreCompleto,
      (mensaje as any)?.actorNombreCompleto,
      (mensaje as any)?.adminNombreCompleto,
      (mensaje as any)?.expulsorNombre,
      (mensaje as any)?.actorNombre,
      (mensaje as any)?.adminNombre,
    ];
    for (const value of directFields) {
      const txt = String(value || '').trim();
      if (txt) return txt;
    }

    const emisorNombre = String(mensaje?.emisorNombre || '').trim();
    const emisorApellido = String(mensaje?.emisorApellido || '').trim();
    const full = `${emisorNombre} ${emisorApellido}`.trim();
    if (full && !/^(yo|t[uú])$/i.test(full)) return full;

    const emisorId = Number(mensaje?.emisorId);
    if (Number.isFinite(emisorId) && emisorId > 0) {
      const byId = this.resolveGroupMemberDisplayName(groupId, emisorId);
      if (byId && !/^(yo|t[uú])$/i.test(byId)) return byId;
    }
    return '';
  }

  private resolveExpelledNoticeFromMessage(mensaje: any): string {
    const direct = String(mensaje?.contenido || '').trim();
    if (/^has sido expulsad[oa]\b/i.test(direct)) return direct;

    const groupId = Number(mensaje?.chatId || 0);
    const groupName = this.resolveGroupNameById(groupId);
    const expulsor = this.resolveExpulsorDisplayName(mensaje, groupId);
    let notice = groupName
      ? `Has sido expulsado de "${groupName}"`
      : 'Has sido expulsado del grupo';
    if (expulsor) {
      notice += ` por "${expulsor}"`;
    }
    return notice;
  }

  private isCurrentUserExpelledFromGroupMessage(mensaje: any): boolean {
    if (!this.isSystemMessage(mensaje)) return false;
    const chatId = Number(mensaje?.chatId || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return false;

    const isGroupChat =
      (!!this.chatActual?.esGrupo && Number(this.chatActual?.id) === chatId) ||
      !!(this.chats || []).find(
        (c) => Number(c?.id) === chatId && !!c?.esGrupo
      );
    if (!isGroupChat) return false;

    const currentId = Number(this.usuarioActualId);
    const targetUserId = this.extractGroupExpulsionTargetUserId(mensaje);
    if (targetUserId > 0) {
      return targetUserId === currentId;
    }

    const eventCode = String(mensaje?.systemEvent || mensaje?.evento || '')
      .trim()
      .toUpperCase();
    const expulsionEvents = new Set([
      'GROUP_MEMBER_EXPELLED',
      'GROUP_MEMBER_KICKED',
      'GROUP_USER_EXPELLED',
      'GROUP_USER_KICKED',
    ]);
    if (!expulsionEvents.has(eventCode)) return false;

    const receptorId = Number(mensaje?.receptorId || 0);
    return receptorId > 0 && receptorId === currentId;
  }

  private maybeApplyGroupExpulsionStateFromMessage(mensaje: any): boolean {
    if (!this.isCurrentUserExpelledFromGroupMessage(mensaje)) return false;
    const chatId = Number(mensaje?.chatId || 0);
    if (!chatId) return false;
    const notice = this.resolveExpelledNoticeFromMessage(mensaje);
    this.markCurrentUserOutOfGroup(
      chatId,
      notice,
      mensaje as MensajeDTO,
      false
    );
    return true;
  }

  private isPrivateExpulsionNoticeSystemMessage(mensaje: any): boolean {
    if (!this.isSystemMessage(mensaje)) return false;
    const content = String(mensaje?.contenido || '').trim();
    if (!/^has sido expulsad[oa]\b/i.test(content)) return false;
    const chatId = Number(mensaje?.chatId || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return false;
    const isGroupChat =
      (!!this.chatActual?.esGrupo && Number(this.chatActual?.id) === chatId) ||
      !!(this.chats || []).find(
        (c) => Number(c?.id) === chatId && !!c?.esGrupo
      );
    return isGroupChat;
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

  private resetHistoryStateForConversation(
    chatId: number,
    esGrupo: boolean
  ): ChatHistoryState {
    const key = buildConversationHistoryKey(chatId, esGrupo);
    const state = createInitialHistoryState<MensajeDTO>();
    this.historyStateByConversation.set(key, state);
    return state;
  }

  private getHistoryStateForConversation(
    chatId: number,
    esGrupo: boolean
  ): ChatHistoryState | null {
    const key = buildConversationHistoryKey(chatId, esGrupo);
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
    this.debugAdminWarningFlow('history-decrypt-start', {
      source,
      chatId,
      esGrupo,
      totalMensajes: lista.length,
      adminLikeIds: lista
        .filter((m) => !esGrupo && this.looksLikeAdminWarningMessage(m))
        .map((m) => Number((m as any)?.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0),
    });
    for (const m of lista) {
      const isAdminLike = !esGrupo && this.looksLikeAdminWarningMessage(m);
      if (isAdminLike) {
        this.debugAdminWarningFlow('history-row-before', {
          source,
          payload: this.extractAdminWarningDebugMeta(m),
        });
      }
      Object.assign(m, this.normalizeMensajeEditadoFlag(m));
      const decryptInput = this.resolveDecryptInputFromMessageLike(m);
      this.preserveEncryptedPayloadForIaSummary(m as any, decryptInput);
      this.applySenderProfilePhotoFromDecryptInput(m, decryptInput);
      if (this.isSystemMessage(m)) {
        const hideOwnExpulsion = this.maybeApplyGroupExpulsionStateFromMessage(m);
        if (hideOwnExpulsion) {
          (m as any).__hideFromTimeline = true;
          if (isAdminLike) {
            this.debugAdminWarningFlow('history-row-hidden-system-expulsion', {
              source,
              payload: this.extractAdminWarningDebugMeta(m),
            });
          }
          continue;
        }
        if (this.isPrivateExpulsionNoticeSystemMessage(m)) {
          (m as any).__hideFromTimeline = true;
          if (isAdminLike) {
            this.debugAdminWarningFlow('history-row-hidden-private-expulsion', {
              source,
              payload: this.extractAdminWarningDebugMeta(m),
            });
          }
          continue;
        }
        m.contenido = String(m?.contenido ?? '').trim();
        if (isAdminLike) {
          this.debugAdminWarningFlow('history-row-system-visible', {
            source,
            payload: this.extractAdminWarningDebugMeta(m),
          });
        }
        continue;
      }
      if (Number((m as any)?.activo) === 0 && !this.isTemporalExpiredMessage(m)) {
        const normalizedDeleted = this.normalizeDeletedMessageForRetention(
          m as MensajeDTO
        );
        Object.assign(m, normalizedDeleted);
        if (this.shouldPurgeDeletedMessageFromTimeline(normalizedDeleted)) {
          (m as any).__hideFromTimeline = true;
          if (isAdminLike) {
            this.debugAdminWarningFlow('history-row-hidden-deleted-retention', {
              source,
              payload: this.extractAdminWarningDebugMeta(m),
            });
          }
        } else {
          m.contenido = String(m?.contenido ?? '').trim();
          if (isAdminLike) {
            this.debugAdminWarningFlow('history-row-deleted-visible', {
              source,
              payload: this.extractAdminWarningDebugMeta(m),
            });
          }
        }
        continue;
      }
      if (this.isTemporalExpiredMessage(m)) {
        const expiredPlaceholder = this.temporalExpiredPlaceholderText({
          ...(m || {}),
          contenido: '',
        });
        m.contenido = expiredPlaceholder;
        (m as any).placeholderTexto = expiredPlaceholder;
        if (isAdminLike) {
          this.debugAdminWarningFlow('history-row-temporal-expired-visible', {
            source,
            payload: this.extractAdminWarningDebugMeta(m),
          });
        }
        continue;
      }
      m.contenido = await this.decryptContenido(
        decryptInput,
        Number((m as any)?.emisorId ?? (m as any)?.emisor?.id ?? 0),
        Number((m as any)?.receptorId ?? (m as any)?.receptor?.id ?? 0),
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
      await this.hydrateIncomingFileMessage(m as MensajeDTO, {
        chatId,
        mensajeId: Number(m?.id),
        source: `${source}-file`,
      });
      if (isAdminLike) {
        this.debugAdminWarningFlow('history-row-after-decrypt', {
          source,
          payload: this.extractAdminWarningDebugMeta(m),
        });
      }
    }
    const result = (lista as MensajeDTO[]).filter(
      (m) => !(m as any)?.__hideFromTimeline
    );
    this.debugAdminWarningFlow('history-decrypt-end', {
      source,
      chatId,
      esGrupo,
      inputCount: lista.length,
      visibleCount: result.length,
      hiddenCount: Math.max(0, lista.length - result.length),
      visibleAdminLikeIds: result
        .filter((m) => !esGrupo && this.looksLikeAdminWarningMessage(m))
        .map((m) => Number(m?.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0),
    });
    if (!esGrupo) return result;
    const filtered = result.filter(
      (m) => this.isSystemMessage(m) || !this.isEncryptedHiddenPlaceholder(m?.contenido)
    );
    if (filtered.length < result.length) {
      this.groupHistoryHiddenByChatId.set(chatId, true);
    }
    return filtered;
  }

  private syncActiveHistoryStateMessages(): void {
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const esGrupo = !!this.chatActual?.esGrupo;
    const state = this.getHistoryStateForConversation(chatId, esGrupo);
    if (!state) return;
    state.messages = [...this.mensajesSeleccionados];
    if (
      !esGrupo &&
      (this.adminDirectReadOnlyChatIds.has(chatId) ||
        this.isAdminDirectReadOnlySnapshot(this.chatActual))
    ) {
      this.rememberAdminDirectMessagesCache(chatId, state.messages);
      this.rememberAdminDirectChatCacheById(chatId);
    }
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

  private loadInitialMessagesPage(chat: any, _leftSet: Set<number>): void {
    const chatId = Number(chat?.id);
    const esGrupo = !!chat?.esGrupo;
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.endInitialMessagesLoading(chatId, esGrupo);
      return;
    }

    const previousState = this.getHistoryStateForConversation(chatId, esGrupo);
    const previousMessages = Array.isArray(previousState?.messages)
      ? [...previousState!.messages]
      : [];
    const cachedAdminMessages = !esGrupo
      ? this.getAdminDirectMessagesCache(chatId)
      : [];
    const state = this.resetHistoryStateForConversation(chatId, esGrupo);
    const endpoint = esGrupo
      ? `/api/chat/mensajes/grupo/${chatId}?page=0&size=${this.HISTORY_PAGE_SIZE}`
      : `/api/chat/mensajes/${chatId}?page=0&size=${this.HISTORY_PAGE_SIZE}`;
    this.debugAdminWarningFlow('history-fetch-initial-start', {
      endpoint,
      chatId,
      esGrupo,
      chatReadOnly: this.chatEsSoloLecturaPorAdmin,
      receptorId: Number(chat?.receptor?.id || 0) || null,
    });

    this.getHistorySource$(chatId, esGrupo, 0, this.HISTORY_PAGE_SIZE).subscribe({
      next: async (mensajes: any[]) => {
        const fetchedCount = Array.isArray(mensajes) ? mensajes.length : 0;
        const adminLikeRaw = (mensajes || []).filter((m: any) =>
          !esGrupo && this.looksLikeAdminWarningMessage(m)
        );
        this.debugAdminWarningFlow('history-fetch-initial-response', {
          endpoint,
          chatId,
          esGrupo,
          fetchedCount,
          adminLikeCount: adminLikeRaw.length,
          adminLike: adminLikeRaw
            .slice(0, 10)
            .map((m: any) => this.extractAdminWarningDebugMeta(m)),
        });
        this.applyAdminDirectReadOnlyFromHistory(chatId, esGrupo, mensajes || []);
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
          this.debugAdminWarningFlow('history-fetch-initial-aborted-chat-switched', {
            endpoint,
            chatId,
            esGrupo,
            currentActiveChatId: Number(this.chatActual?.id || 0) || null,
            currentActiveIsGroup: !!this.chatActual?.esGrupo,
          });
          return;
        }

        let merged = mergeMessagesById([], lista, 'replace');
        const fallbackAdminMessages =
          previousMessages.length > 0 ? previousMessages : cachedAdminMessages;
        const preserveAdminDirectHistory =
          !esGrupo &&
          merged.length === 0 &&
          fallbackAdminMessages.length > 0 &&
          (this.adminDirectReadOnlyChatIds.has(chatId) ||
            this.isAdminDirectReadOnlySnapshot(chat));
        if (preserveAdminDirectHistory) {
          merged = mergeMessagesById([], fallbackAdminMessages, 'replace');
          this.debugAdminWarningFlow('history-fetch-initial-preserved-local-admin', {
            endpoint,
            chatId,
            esGrupo,
            fetchedCount,
            restoredCount: merged.length,
            restoredFromCache: fallbackAdminMessages === cachedAdminMessages,
          });
        }
        this.mensajesSeleccionados = merged;
        this.seedIncomingReactionsFromMessages(merged);
        this.evaluarRespuestasRapidas();
        state.messages = [...merged];
        if (
          !esGrupo &&
          merged.length > 0 &&
          (this.adminDirectReadOnlyChatIds.has(chatId) ||
            this.isAdminDirectReadOnlySnapshot(chat) ||
            merged.some((m) => this.hasAdminMessageFlag(m)))
        ) {
          this.rememberAdminDirectMessagesCache(chatId, merged);
          this.rememberAdminDirectChatCacheById(chatId);
        }
        state.page = 0;
        state.hasMore = fetchedCount === this.HISTORY_PAGE_SIZE;
        state.loadingMore = false;
        state.initialized = true;
        this.debugAdminWarningFlow('history-fetch-initial-applied', {
          endpoint,
          chatId,
          esGrupo,
          fetchedCount,
          visibleCount: merged.length,
          visibleAdminLike: merged
            .filter((m) => !esGrupo && this.looksLikeAdminWarningMessage(m))
            .slice(0, 10)
            .map((m) => this.extractAdminWarningDebugMeta(m)),
        });

        if (!esGrupo) {
          const noLeidos = this.collectReadableMessageIds(
            this.mensajesSeleccionados
          );
          if (noLeidos.length > 0) {
            this.wsService.marcarMensajesComoLeidos(noLeidos);
          }
        }

        const item = this.chats.find((c) => c.id === chatId);
        if (item) {
          item.unreadCount = 0;
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

          this.wsService.suscribirseAGrabandoAudioGrupo(chatId, (data: any) => {
            if (!this.chatActual || this.chatActual.id !== data.chatId) return;
            if (Number(data.emisorId) === this.usuarioActualId) return;

            const nombre =
              (
                data.emisorNombre ||
                getNombrePorId(this.chats, data.emisorId) ||
                'Alguien'
              ).trim() + (data.emisorApellido ? ` ${data.emisorApellido}` : '');

            if (data.grabandoAudio) this.audioSetHeader.add(nombre);
            else this.audioSetHeader.delete(nombre);

            this.audioGrabandoHeader = this.buildAudioHeaderText(
              Array.from(this.audioSetHeader)
            );
            this.cdr.markForCheck();
          });
        }

        const skipInitialAutoScroll =
          Number(this.pendingOpenFromStarredNavigation?.chatId) === chatId;
        if (!skipInitialAutoScroll) {
          this.scrollAlFinal();
        }
        this.endInitialMessagesLoading(chatId, esGrupo);
        this.cdr.markForCheck();
      },
      error: (err) => {
        state.loadingMore = false;
        state.initialized = false;
        this.endInitialMessagesLoading(chatId, esGrupo);
        this.debugAdminWarningFlow('history-fetch-initial-error', {
          endpoint,
          chatId,
          esGrupo,
          status: Number(err?.status || 0) || null,
          message: String(err?.message || err?.error?.mensaje || '').trim() || null,
        });
        console.error('[INICIO] error al obtener mensajes:', err);
        const status = Number(err?.status || 0);
        if (status === 404) {
          this.handleChatNoLongerVisible(chatId);
          return;
        }
        if (esGrupo && status === 403) {
          this.markCurrentUserOutOfGroup(
            chatId,
            this.getGroupExitNoticeForChat(chatId)
          );
        }
      },
    });
  }

  private beginInitialMessagesLoading(chatId: number, esGrupo: boolean): void {
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.messagesInitialLoadingConversationKey = null;
      return;
    }
    this.messagesInitialLoadingConversationKey = buildConversationHistoryKey(
      chatId,
      esGrupo
    );
  }

  private endInitialMessagesLoading(chatId: number, esGrupo: boolean): void {
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const key = buildConversationHistoryKey(chatId, esGrupo);
    if (this.messagesInitialLoadingConversationKey === key) {
      this.messagesInitialLoadingConversationKey = null;
    }
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
    const endpoint = esGrupo
      ? `/api/chat/mensajes/grupo/${chatId}?page=${nextPage}&size=${this.HISTORY_PAGE_SIZE}`
      : `/api/chat/mensajes/${chatId}?page=${nextPage}&size=${this.HISTORY_PAGE_SIZE}`;
    this.debugAdminWarningFlow('history-fetch-older-start', {
      endpoint,
      chatId,
      esGrupo,
      nextPage,
    });

    this.getHistorySource$(chatId, esGrupo, nextPage, this.HISTORY_PAGE_SIZE).subscribe({
      next: async (mensajes: any[]) => {
        const fetchedCount = Array.isArray(mensajes) ? mensajes.length : 0;
        this.debugAdminWarningFlow('history-fetch-older-response', {
          endpoint,
          chatId,
          esGrupo,
          nextPage,
          fetchedCount,
          adminLikeCount: (mensajes || []).filter((m: any) =>
            !esGrupo && this.looksLikeAdminWarningMessage(m)
          ).length,
        });
        this.applyAdminDirectReadOnlyFromHistory(chatId, esGrupo, mensajes || []);
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
          this.debugAdminWarningFlow('history-fetch-older-aborted-chat-switched', {
            endpoint,
            chatId,
            esGrupo,
            nextPage,
            currentActiveChatId: Number(this.chatActual?.id || 0) || null,
          });
          state.loadingMore = false;
          return;
        }

        const merged = mergeMessagesById(
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
        this.debugAdminWarningFlow('history-fetch-older-applied', {
          endpoint,
          chatId,
          esGrupo,
          nextPage,
          fetchedCount,
          visibleCount: merged.length,
        });

        this.cdr.markForCheck();
        this.retainScrollPositionAfterPrepend(previousHeight);
      },
      error: (err) => {
        state.loadingMore = false;
        this.debugAdminWarningFlow('history-fetch-older-error', {
          endpoint,
          chatId,
          esGrupo,
          nextPage,
          status: Number(err?.status || 0) || null,
          message: err?.message || err?.error?.mensaje || String(err),
        });
        console.error('[INICIO] error cargando más historial', {
          chatId,
          nextPage,
          status: err?.status,
          message: err?.message || err?.error?.mensaje || String(err),
        });
        if (Number(err?.status || 0) === 404) {
          this.handleChatNoLongerVisible(chatId);
        }
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

  private isPendingStarredNavigationTarget(messageIdRaw: unknown): boolean {
    const messageId = Number(messageIdRaw);
    const pending = this.pendingOpenFromStarredNavigation;
    const activeChatId = Number(this.chatActual?.id);
    if (!pending) return false;
    if (!Number.isFinite(messageId) || messageId <= 0) return false;
    if (!Number.isFinite(activeChatId) || activeChatId <= 0) return false;
    return (
      Number(pending.messageId) === Math.round(messageId) &&
      Number(pending.chatId) === Math.round(activeChatId)
    );
  }

  private injectMessageIntoActiveConversation(message: MensajeDTO): void {
    if (!message) return;
    const merged = mergeMessagesById(this.mensajesSeleccionados || [], [message], 'append');
    this.mensajesSeleccionados = merged;
    this.seedIncomingReactionsFromMessages(merged);

    const chatId = Number(this.chatActual?.id);
    const esGrupo = !!this.chatActual?.esGrupo;
    if (Number.isFinite(chatId) && chatId > 0) {
      const state = this.getHistoryStateForConversation(chatId, esGrupo);
      if (state) {
        state.messages = [...merged];
        if (!state.initialized) state.initialized = true;
      }
    }

    this.cdr.markForCheck();
  }

  private async fetchMessageByIdFromServerHistoryScan(
    chatIdRaw: unknown,
    messageIdRaw: unknown
  ): Promise<MensajeDTO | null> {
    const chatId = Number(chatIdRaw);
    const messageId = Number(messageIdRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return null;
    if (!Number.isFinite(messageId) || messageId <= 0) return null;

    const chatContext = this.resolveChatContextForMessage(chatId);
    const esGrupo = !!chatContext?.esGrupo;
    const seenFingerprints = new Set<string>();
    const maxPages = 80;

    for (let page = 0; page < maxPages; page++) {
      let rawMessages: any[] = [];
      try {
        rawMessages = await firstValueFrom(
          this.getHistorySource$(chatId, esGrupo, page, this.HISTORY_PAGE_SIZE)
        );
      } catch {
        break;
      }

      const list = Array.isArray(rawMessages) ? rawMessages : [];
      if (list.length === 0) break;

      const firstId = Number(list[0]?.id || 0);
      const lastId = Number(list[list.length - 1]?.id || 0);
      const fingerprint = `${list.length}|${firstId}|${lastId}`;
      if (seenFingerprints.has(fingerprint)) break;
      seenFingerprints.add(fingerprint);

      let decrypted: MensajeDTO[] = [];
      try {
        decrypted = await this.decryptHistoryPageMessages(
          list,
          chatId,
          esGrupo,
          esGrupo
            ? `starred-open-scan-group-${page}`
            : `starred-open-scan-individual-${page}`
        );
      } catch {
        continue;
      }

      const found =
        (decrypted || []).find((m) => Number(m?.id) === Math.round(messageId)) ||
        null;
      if (found) return found;

      if (list.length < this.HISTORY_PAGE_SIZE) break;
    }

    return null;
  }

  private async tryHydratePendingStarredNavigationMessage(
    messageIdRaw: unknown
  ): Promise<boolean> {
    const messageId = Number(messageIdRaw);
    if (!this.isPendingStarredNavigationTarget(messageId)) return false;

    const normalizedId = Math.round(messageId);
    const fromCache = this.starredHydratedMessagesById.get(normalizedId);
    if (fromCache) {
      this.injectMessageIntoActiveConversation(fromCache);
      return this.hasLoadedMessageById(normalizedId);
    }

    const chatId = Number(this.pendingOpenFromStarredNavigation?.chatId);
    const fromServer = await this.fetchMessageByIdFromServerHistoryScan(
      chatId,
      normalizedId
    );
    if (!fromServer) return false;

    this.starredHydratedMessagesById.set(normalizedId, fromServer);
    this.injectMessageIntoActiveConversation(fromServer);
    return this.hasLoadedMessageById(normalizedId);
  }

  private async ensureMessageLoadedForSearchNavigation(
    messageId: number
  ): Promise<boolean> {
    if (this.hasLoadedMessageById(messageId)) return true;
    const activeChatId = Number(this.chatActual?.id);
    const activeIsGroup = !!this.chatActual?.esGrupo;
    if (!Number.isFinite(activeChatId) || activeChatId <= 0) return false;

    const historyReady = await this.waitForCondition(() => {
      if (!this.chatActual) return false;
      if (Number(this.chatActual?.id) !== activeChatId) return false;
      if (!!this.chatActual?.esGrupo !== activeIsGroup) return false;
      const state = this.getHistoryStateForConversation(
        activeChatId,
        activeIsGroup
      );
      return !!state && state.initialized && !state.loadingMore;
    }, 12000);

    if (!historyReady) return this.hasLoadedMessageById(messageId);
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

  private async focusMessageInViewport(
    messageId: number,
    forceAnimatedTravel = false
  ): Promise<boolean> {
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.scrollMessageElementIntoView(messageId, forceAnimatedTravel)) {
        this.flashSearchTarget(messageId);
        return true;
      }
      await this.delay(120);
    }
    return false;
  }

  private scrollMessageElementIntoView(
    messageId: number,
    forceAnimatedTravel = false
  ): boolean {
    const container = this.contenedorMensajes?.nativeElement as
      | HTMLElement
      | undefined;
    if (!container) return false;

    const target = container.querySelector(
      `[data-message-id=\"${messageId}\"]`
    ) as HTMLElement | null;
    if (!target) return false;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const currentTop = container.scrollTop;
    const desiredTopRaw =
      currentTop +
      (targetRect.top - containerRect.top) -
      container.clientHeight / 2 +
      targetRect.height / 2;
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const desiredTop = Math.max(0, Math.min(maxTop, desiredTopRaw));

    if (forceAnimatedTravel) {
      this.nudgeScrollAwayFromTarget(container, desiredTop);
      this.animateMessageContainerScroll(container, desiredTop, 760);
      return true;
    }

    try {
      container.scrollTo({ top: desiredTop, behavior: 'smooth' });
    } catch {
      this.animateMessageContainerScroll(container, desiredTop);
    }
    return true;
  }

  private nudgeScrollAwayFromTarget(
    container: HTMLElement,
    targetTop: number
  ): void {
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxTop <= 0) return;

    const nudge = Math.max(80, Math.min(200, Math.round(container.clientHeight * 0.22)));
    const up = Math.max(0, Math.min(maxTop, targetTop - nudge));
    const down = Math.max(0, Math.min(maxTop, targetTop + nudge));
    const diffUp = Math.abs(targetTop - up);
    const diffDown = Math.abs(targetTop - down);
    const chosen = diffDown > diffUp ? down : up;

    if (Math.abs(targetTop - chosen) >= 8) {
      container.scrollTop = chosen;
    }
  }

  private animateMessageContainerScroll(
    container: HTMLElement,
    targetTop: number,
    durationMs: number = 560
  ): void {
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    if (Math.abs(distance) < 1) {
      container.scrollTop = targetTop;
      return;
    }

    if (this.messageScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.messageScrollAnimationFrame);
      this.messageScrollAnimationFrame = null;
    }

    const startedAt = performance.now();
    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

    const step = (now: number): void => {
      const progress = Math.max(
        0,
        Math.min(1, (now - startedAt) / Math.max(1, durationMs))
      );
      container.scrollTop = startTop + distance * easeOutCubic(progress);

      if (progress < 1) {
        this.messageScrollAnimationFrame = requestAnimationFrame(step);
        return;
      }
      this.messageScrollAnimationFrame = null;
    };

    this.messageScrollAnimationFrame = requestAnimationFrame(step);
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

  private normalizeContenidoBusqueda(raw: string): string {
    const base = String(raw || '')
      .trim()
      .toLowerCase();
    if (!base) return '';
    return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private attachContenidoBusqueda(
    payload: MensajeDTO | Record<string, any>,
    plainText: string
  ): void {
    const normalized = this.normalizeContenidoBusqueda(plainText);
    if (!normalized) return;
    (payload as any).contenidoBusqueda = normalized;
    (payload as any).contenido_busqueda = normalized;
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
          aesKeyRawBase64,
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
        aesKeyRawBase64,
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
      if (freshMemberIds.length === 0 && localPlusSeed.length === 0) {
        // Primeros instantes tras crear grupo: el detalle puede tardar en reflejar miembros.
        await new Promise((resolve) => setTimeout(resolve, 350));
        const retry = await fetchDetailMemberIds();
        detailMembers = retry.detailMembers;
        freshMemberIds = retry.freshMemberIds;
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
    if (this.chatEsSoloLecturaPorAdmin) return;
    if (this.chatGrupalCerradoPorAdmin) return;

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
      this.attachTemporaryMetadata(mensaje);
      this.attachContenidoBusqueda(mensaje, contenido);

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
      this.composerDraftPrefixVisible = false;
      this.clearStoredDraftForChat(chatId);
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
      this.attachTemporaryMetadata(mensaje);
      this.attachContenidoBusqueda(mensaje, contenido);

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
      this.composerDraftPrefixVisible = false;
      this.clearStoredDraftForChat(chatId);
      this.cancelarRespuestaMensaje();
    };

    // Ya existe el chat ? enviar directamente
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
          foto: avatarOrDefault(peer?.foto || null),
          receptor: {
            id: peer?.id,
            nombre: peer?.nombre,
            apellido: peer?.apellido,
            foto: avatarOrDefault(peer?.foto || null),
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
        console.error('? crearChatIndividual:', e);
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
  public preguntarIaSobreMensaje(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.aiQuote = String(mensaje?.contenido || '').trim();
    this.mensajeSeleccionadoParaIa = mensaje;
    this.preguntaIaMensaje = '';
    this.respuestaIaMensaje = '';
    this.errorIa = null;
    this.cargandoIaMensaje = false;
    this.openMensajeMenuId = null;
    this.mostrarModalPreguntaIa = true;
    this.aiPanelOpen = true;
  }

  public openAiPanelFromMessage(mensaje: MensajeDTO, event?: MouseEvent): void {
    this.preguntarIaSobreMensaje(mensaje, event);
  }

  public async abrirResumenConversacion(): Promise<void> {
    if (this.cargandoResumenIa) return;

    const activeChatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
    const requestSeq = ++this.resumenIaRequestSeq;
    this.openMensajeMenuId = null;
    this.mostrarMenuOpciones = false;
    this.mostrarPopupResumenIa = true;
    this.cargandoResumenIa = true;
    this.resumenIa = '';
    this.errorResumenIa = '';

    const request = this.construirRequestResumenConversacionEncrypted();
    if (!request) {
      this.cargandoResumenIa = false;
      this.errorResumenIa = 'No hay mensajes cifrados recientes compatibles para resumir.';
      this.cdr.markForCheck();
      return;
    }

    try {
      const response = await firstValueFrom(
        this.aiService.resumirConversacionEncrypted(request)
      );
      const currentChatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
      if (
        requestSeq !== this.resumenIaRequestSeq ||
        currentChatId !== activeChatId
      ) {
        return;
      }
      const resumen = await this.extraerResumenPlanoIa(response);

      if (response?.success && resumen) {
        this.resumenIa = resumen;
        return;
      }

      this.errorResumenIa =
        String(response?.mensaje || '').trim() ||
        'No se pudo generar el resumen.';
    } catch (err: any) {
      if (requestSeq !== this.resumenIaRequestSeq) return;
      this.errorResumenIa = this.resolveResumenIaErrorMessage(err);
    } finally {
      if (requestSeq !== this.resumenIaRequestSeq) return;
      this.cargandoResumenIa = false;
      this.cdr.markForCheck();
    }
  }

  public cerrarPopupResumenIa(): void {
    if (this.cargandoResumenIa) return;
    this.mostrarPopupResumenIa = false;
  }

  public limpiarRespuestasRapidas(cancelPending = true): void {
    if (this.quickRepliesDebounceTimer) {
      clearTimeout(this.quickRepliesDebounceTimer);
      this.quickRepliesDebounceTimer = null;
    }
    if (cancelPending) {
      this.quickRepliesRequestSeq += 1;
      this.quickRepliesRequestSub?.unsubscribe();
      this.quickRepliesRequestSub = undefined;
      this.cargandoQuickReplies = false;
    }
    this.quickReplies = [];
    this.quickRepliesMessageId = null;
    this.quickRepliesChatKey = null;
    this.errorQuickReplies = null;
    this.cdr.markForCheck();
  }

  public evaluarRespuestasRapidas(): void {
    const chatKey = this.getChatKeyActual();
    const ultimoMensaje = this.getUltimoMensajeRecibidoParaRespuestasRapidas();

    if (!chatKey || !ultimoMensaje || !this.puedeGenerarRespuestasRapidas(ultimoMensaje)) {
      this.limpiarRespuestasRapidas();
      return;
    }

    const messageIdRaw = Number(ultimoMensaje?.id || 0);
    const messageId =
      Number.isFinite(messageIdRaw) && messageIdRaw > 0
        ? Math.round(messageIdRaw)
        : null;
    const sameTarget =
      this.quickRepliesChatKey === chatKey &&
      this.quickRepliesMessageId === messageId;

    if (messageId) {
      const cached = this.quickRepliesCache.get(
        this.getQuickRepliesCacheKey(chatKey, messageId)
      );
      if (cached && cached.length > 0) {
        this.aplicarRespuestasRapidas(cached, chatKey, messageId);
        return;
      }
    }

    if (
      sameTarget &&
      (this.quickReplies.length > 0 ||
        this.cargandoQuickReplies ||
        !!this.quickRepliesDebounceTimer)
    ) {
      return;
    }

    this.quickReplies = [];
    this.quickRepliesMessageId = messageId;
    this.quickRepliesChatKey = chatKey;
    this.errorQuickReplies = null;
    this.programarGeneracionRespuestasRapidas(ultimoMensaje);
  }

  public async enviarRespuestaRapida(replyRaw: string): Promise<void> {
    const reply = String(replyRaw || '').trim();
    if (!reply || this.enviandoQuickReply || !this.canUseQuickReplySend) return;

    const previousText = this.mensajeNuevo;
    const previousCursorStart = this.composeCursorStart;
    const previousCursorEnd = this.composeCursorEnd;

    this.enviandoQuickReply = true;
    this.limpiarRespuestasRapidas();
    this.mensajeNuevo = reply;
    this.composeCursorStart = reply.length;
    this.composeCursorEnd = reply.length;

    try {
      await this.enviarMensajeDesdeComposer();
    } catch (error) {
      this.mensajeNuevo = previousText;
      this.composeCursorStart = previousCursorStart;
      this.composeCursorEnd = previousCursorEnd;
      this.scheduleComposerTextareaResize();
      this.focusMessageInput(previousCursorEnd);
    } finally {
      this.enviandoQuickReply = false;
      this.cdr.markForCheck();
    }
  }

  private programarGeneracionRespuestasRapidas(mensaje: MensajeDTO): void {
    const chatKey = this.getChatKeyActual();
    if (!chatKey || !this.puedeGenerarRespuestasRapidas(mensaje)) {
      this.limpiarRespuestasRapidas();
      return;
    }

    if (this.quickRepliesDebounceTimer) {
      clearTimeout(this.quickRepliesDebounceTimer);
      this.quickRepliesDebounceTimer = null;
    }

    const delayMs = Math.max(
      this.QUICK_REPLIES_DEBOUNCE_MS,
      this.getQuickRepliesCooldownRemainingMs(chatKey)
    );

    this.quickRepliesDebounceTimer = setTimeout(() => {
      this.quickRepliesDebounceTimer = null;
      if (!this.esObjetivoRespuestasRapidasActual(mensaje, chatKey)) return;
      this.cargarRespuestasRapidasParaMensaje(mensaje);
    }, delayMs);
  }

  private puedeGenerarRespuestasRapidas(
    mensaje: MensajeDTO | null | undefined
  ): boolean {
    if (!this.chatActual) return false;
    if (!!String(this.mensajeNuevo || '').trim()) return false;
    if (
      this.enviandoQuickReply ||
      this.attachmentUploading ||
      this.aiLoading ||
      this.cargandoIaInput ||
      this.recording ||
      !!this.pendingAttachmentFile ||
      !!this.mensajeEdicionObjetivo ||
      this.composerInteractionDisabled ||
      this.haSalidoDelGrupo ||
      this.noGroupRecipientsForSend
    ) {
      return false;
    }
    return this.esMensajeValidoParaRespuestasRapidas(mensaje);
  }

  private cargarRespuestasRapidasParaMensaje(mensaje: MensajeDTO): void {
    const chatKey = this.getChatKeyActual();
    if (!chatKey || !this.esObjetivoRespuestasRapidasActual(mensaje, chatKey)) return;

    const request = this.construirRequestRespuestasRapidas();
    if (!request) {
      this.limpiarRespuestasRapidas(false);
      return;
    }

    const messageId = Number(mensaje?.id || 0);
    const normalizedMessageId =
      Number.isFinite(messageId) && messageId > 0 ? Math.round(messageId) : null;
    const requestSeq = ++this.quickRepliesRequestSeq;

    this.quickReplies = [];
    this.quickRepliesChatKey = chatKey;
    this.quickRepliesMessageId = normalizedMessageId;
    this.errorQuickReplies = null;
    this.cargandoQuickReplies = true;
    this.quickRepliesLastGeneratedByChat.set(chatKey, Date.now());
    this.quickRepliesRequestSub = this.aiService
      .generarRespuestasRapidas(request)
      .pipe(
        finalize(() => {
          if (requestSeq !== this.quickRepliesRequestSeq) return;
          this.quickRepliesRequestSub = undefined;
          this.cargandoQuickReplies = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response: AiQuickRepliesResponseDTO) => {
          if (requestSeq !== this.quickRepliesRequestSeq) return;
          if (!this.esObjetivoRespuestasRapidasActual(mensaje, chatKey)) return;

          const suggestions = this.normalizarSugerenciasRapidas(response?.sugerencias);
          if (response?.success && suggestions.length > 0) {
            if (normalizedMessageId) {
              this.quickRepliesCache.set(
                this.getQuickRepliesCacheKey(chatKey, normalizedMessageId),
                suggestions
              );
            }
            this.aplicarRespuestasRapidas(suggestions, chatKey, normalizedMessageId);
            return;
          }

          this.errorQuickReplies = String(response?.mensaje || '').trim() || null;
          this.quickReplies = [];
        },
        error: (err: any) => {
          if (requestSeq !== this.quickRepliesRequestSeq) return;
          this.errorQuickReplies = this.isQuickRepliesRateLimitError(err)
            ? 'RATE_LIMIT'
            : String(err?.error?.mensaje || err?.error?.message || err?.message || '').trim() ||
              'ERROR';
          this.quickReplies = [];
        },
      });
  }

  private construirRequestRespuestasRapidas(): AiQuickRepliesRequestDTO | null {
    const chatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return null;

    const tipoChat: AiQuickRepliesChatType = this.chatActual?.esGrupo
      ? 'GRUPAL'
      : 'INDIVIDUAL';

    return {
      tipoChat,
      chatId: tipoChat === 'INDIVIDUAL' ? Math.round(chatId) : null,
      chatGrupalId: tipoChat === 'GRUPAL' ? Math.round(chatId) : null,
      maxMensajes: 20,
    };
  }

  private getChatKeyActual(): string | null {
    const chatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
    if (!this.chatActual) return null;
    if (!Number.isFinite(chatId) || chatId <= 0) return null;
    return `${this.chatActual?.esGrupo ? 'GRUPAL' : 'INDIVIDUAL'}:${Math.round(chatId)}`;
  }

  private getQuickRepliesCacheKey(chatKey: string, messageId: number): string {
    return `${chatKey}|${Math.round(messageId)}`;
  }

  private getQuickRepliesCooldownRemainingMs(chatKey: string): number {
    const lastGeneratedAt = Number(this.quickRepliesLastGeneratedByChat.get(chatKey) || 0);
    if (!Number.isFinite(lastGeneratedAt) || lastGeneratedAt <= 0) return 0;
    return Math.max(
      0,
      this.QUICK_REPLIES_COOLDOWN_MS - (Date.now() - lastGeneratedAt)
    );
  }

  private getUltimoMensajeRecibidoParaRespuestasRapidas(): MensajeDTO | null {
    const mensajes = Array.isArray(this.mensajesSeleccionados)
      ? this.mensajesSeleccionados
      : [];
    if (mensajes.length === 0) return null;
    const ultimoMensaje = mensajes[mensajes.length - 1] || null;
    return this.esMensajeValidoParaRespuestasRapidas(ultimoMensaje)
      ? ultimoMensaje
      : null;
  }

  private esMensajeValidoParaRespuestasRapidas(
    mensaje: MensajeDTO | null | undefined
  ): boolean {
    if (!mensaje) return false;
    if (Number(mensaje?.emisorId) === Number(this.usuarioActualId)) return false;
    if (this.isSystemMessage(mensaje)) return false;
    if (this.isTemporalExpiredMessage(mensaje)) return false;
    if (mensaje?.activo === false) return false;

    if (parsePollPayload(mensaje)) return false;

    const tipo = String(mensaje?.tipo || 'TEXT').trim().toUpperCase() || 'TEXT';
    const esAudio =
      tipo === 'AUDIO' ||
      !!String(mensaje?.audioUrl || '').trim() ||
      !!String(mensaje?.audioDataUrl || '').trim() ||
      String(mensaje?.audioMime || '').trim().toLowerCase().startsWith('audio/');
    if (esAudio) return true;

    const esSticker =
      tipo === 'STICKER' ||
      (Number.isFinite(Number(mensaje?.stickerId || 0)) && Number(mensaje?.stickerId || 0) > 0);
    if (esSticker) return false;

    const esImagen =
      tipo === 'IMAGE' ||
      !!String(mensaje?.imageUrl || '').trim() ||
      !!String(mensaje?.imageDataUrl || '').trim();
    if (esImagen) return false;

    const esArchivo =
      tipo === 'FILE' ||
      !!String(mensaje?.fileUrl || '').trim() ||
      !!String(mensaje?.fileDataUrl || '').trim();
    if (esArchivo) return false;

    if (tipo !== 'TEXT') return false;

    const contenido = String(mensaje?.contenido || '').trim();
    if (!contenido) return false;
    if (contenido.length < this.QUICK_REPLIES_MIN_MESSAGE_CHARS) return false;
    if (this.isEncryptedHiddenPlaceholder(contenido)) return false;
    return true;
  }

  private esObjetivoRespuestasRapidasActual(
    mensaje: MensajeDTO,
    chatKey: string
  ): boolean {
    if (this.getChatKeyActual() !== chatKey) return false;
    const ultimoMensaje = this.getUltimoMensajeRecibidoParaRespuestasRapidas();
    if (!ultimoMensaje) return false;

    const targetId = Number(mensaje?.id || 0);
    const currentId = Number(ultimoMensaje?.id || 0);
    if (
      Number.isFinite(targetId) &&
      targetId > 0 &&
      Number.isFinite(currentId) &&
      currentId > 0
    ) {
      return Math.round(targetId) === Math.round(currentId);
    }

    return (
      Number(mensaje?.emisorId) === Number(ultimoMensaje?.emisorId) &&
      String(mensaje?.contenido || '').trim() ===
        String(ultimoMensaje?.contenido || '').trim()
    );
  }

  private aplicarRespuestasRapidas(
    sugerencias: string[],
    chatKey: string,
    messageId: number | null
  ): void {
    this.quickReplies = sugerencias;
    this.quickRepliesChatKey = chatKey;
    this.quickRepliesMessageId = messageId;
    this.errorQuickReplies = null;
    this.cdr.markForCheck();
  }

  private normalizarSugerenciasRapidas(raw: unknown): string[] {
    const list = Array.isArray(raw) ? raw : [];
    const dedup = new Set<string>();

    for (const item of list) {
      const texto = String(item || '').replace(/\s+/g, ' ').trim();
      if (!texto) continue;
      dedup.add(texto);
      if (dedup.size >= this.QUICK_REPLIES_MAX_VISIBLE) break;
    }

    return Array.from(dedup);
  }

  private isQuickRepliesRateLimitError(err: any): boolean {
    const status = Number(err?.status || 0);
    if (status === 429) return true;

    const code = String(err?.error?.codigo || err?.error?.code || '')
      .trim()
      .toUpperCase();
    if (code.includes('RATE')) return true;

    const message = String(
      err?.error?.mensaje || err?.error?.message || err?.message || ''
    )
      .trim()
      .toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('demasiadas solicitudes') ||
      message.includes('too many requests')
    );
  }

  public cerrarModalIaMensaje(): void {
    if (this.cargandoIaMensaje) return;
    this.aiPanelOpen = false;
    this.mostrarModalPreguntaIa = false;
    this.errorIa = null;
    this.respuestaIaMensaje = '';
  }

  public cancelAiPanel(): void {
    this.cerrarModalIaMensaje();
  }

  public onAiQuestionChange(next: string): void {
    this.preguntaIaMensaje = String(next || '');
  }

  public onAiQuickAction(action: AiAskQuickAction): void {
    if (action === 'VERIFY') {
      void this.verificarMensajeConIa();
      return;
    }
    this.preguntaIaMensaje = '¿Que le puedo responder de forma cariñosa?';
    void this.confirmarPreguntaIa();
  }

  public submitAiQuestion(rawQuestion?: string): Promise<void> {
    return this.confirmarPreguntaIa(rawQuestion);
  }

  private construirRequestResumenConversacionEncrypted():
    | AiEncryptedConversationSummaryRequestDTO
    | null {
    const chatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return null;

    const esGrupo = !!this.chatActual?.esGrupo;
    const maxMensajes = Number(this.resumenIaMaxMensajes);
    return {
      tipoChat: esGrupo ? 'GRUPAL' : 'INDIVIDUAL',
      chatId: esGrupo ? undefined : Math.round(chatId),
      chatGrupalId: esGrupo ? Math.round(chatId) : undefined,
      estilo: this.resumenIaEstiloDefault || 'BREVE',
      maxLineas: this.resumenIaMaxLineasDefault,
      maxMensajes:
        Number.isFinite(maxMensajes) && maxMensajes > 0
          ? Math.round(maxMensajes)
          : 50,
    };
  }

  private extraerEncryptedPayloadResumenIa(mensaje: MensajeDTO): string {
    const preservedPayload = String(
      (mensaje as any)?.__encryptedPayloadForIaSummary || ''
    ).trim();
    const rawPayload = preservedPayload || this.resolveDecryptInputFromMessageLike(mensaje);
    const payloadText =
      preservedPayload
        ? preservedPayload
        : typeof rawPayload === 'string'
        ? rawPayload.trim()
        : rawPayload && typeof rawPayload === 'object'
        ? JSON.stringify(rawPayload)
        : '';
    if (!payloadText) return '';

    let parsed: any = null;
    try {
      parsed = JSON.parse(payloadText);
    } catch {
      return '';
    }

    const payloadType = String(parsed?.type || '').trim().toUpperCase();
    const isTextPayload =
      payloadType === 'E2E' ||
      payloadType === 'E2E_GROUP' ||
      (!payloadType &&
        typeof parsed?.ciphertext === 'string' &&
        typeof parsed?.iv === 'string' &&
        (
          typeof parsed?.forReceptor === 'string' ||
          typeof parsed?.forEmisor === 'string' ||
          typeof parsed?.forAdmin === 'string' ||
          (parsed?.forReceptores &&
            typeof parsed.forReceptores === 'object' &&
            Object.keys(parsed.forReceptores).length > 0)
        ));

    return isTextPayload ? payloadText : '';
  }

  private resolveResumenIaErrorMessage(err: any): string {
    const message = String(err?.message || '').trim();
    if (message === 'AI_SUMMARY_ENCRYPTED_PAYLOAD_MISSING') {
      return 'Resumen no disponible en este momento.';
    }
    if (message === 'AI_SUMMARY_DECRYPT_FAILED') {
      return 'No se pudo descifrar el resumen.';
    }

    const base = this.resolveComposerAiErrorMessage(err);
    if (base === 'No se pudo procesar el texto con IA.') {
      return 'No se pudo generar el resumen.';
    }
    return base;
  }

  public async confirmarPreguntaIa(rawQuestion?: string): Promise<void> {
    if (this.cargandoIaMensaje) return;

    const mensajeReferencia = this.mensajeSeleccionadoParaIa;
    const contenidoMensaje = String(mensajeReferencia?.contenido || '').trim();
    const pregunta = String(rawQuestion ?? this.preguntaIaMensaje ?? '').trim();
    if (!pregunta) {
      this.errorIa = 'Escribe una pregunta primero.';
      return;
    }
    if (!mensajeReferencia) {
      this.errorIa = 'No hay mensaje para analizar.';
      return;
    }
    if (!this.isAiAskAudioMessage(mensajeReferencia) && !contenidoMensaje) {
      this.errorIa = 'No hay texto para analizar.';
      return;
    }

    this.preguntaIaMensaje = pregunta;
    this.cargandoIaMensaje = true;
    this.errorIa = null;
    this.respuestaIaMensaje = '';

    try {
      const response = await firstValueFrom(
        this.mensajeriaService.procesarTextoConIa(
          this.buildAiAskRequestForMessage(
            mensajeReferencia,
            AiTextMode.RESPONDER,
            pregunta
          )
        )
      );
      if (response?.success) {
        this.respuestaIaMensaje =
          String(response?.textoGenerado || '').trim() || 'Sin respuesta.';
      } else {
        this.errorIa =
          String(response?.mensaje || '').trim() || 'No se pudo consultar a la IA.';
      }
    } catch (err: any) {
      this.errorIa = this.resolveComposerAiErrorMessage(err);
    } finally {
      this.cargandoIaMensaje = false;
      this.cdr.markForCheck();
    }
  }

  private async verificarMensajeConIa(): Promise<void> {
    if (this.cargandoIaMensaje) return;

    const mensajeReferencia = this.mensajeSeleccionadoParaIa;
    const contenidoMensaje = String(mensajeReferencia?.contenido || '').trim();
    if (!mensajeReferencia) {
      this.errorIa = 'No hay mensaje para verificar.';
      return;
    }
    if (!this.isAiAskAudioMessage(mensajeReferencia) && !contenidoMensaje) {
      this.errorIa = 'No hay texto para verificar.';
      return;
    }

    this.cargandoIaMensaje = true;
    this.errorIa = null;
    this.respuestaIaMensaje = '';

    try {
      const response = await firstValueFrom(
        this.mensajeriaService.procesarTextoConIa(
          this.buildAiAskRequestForMessage(
            mensajeReferencia,
            AiTextMode.EXPLICAR
          )
        )
      );
      if (response?.success) {
        this.respuestaIaMensaje =
          String(response?.textoGenerado || '').trim() || 'Sin respuesta.';
      } else {
        this.errorIa =
          String(response?.mensaje || '').trim() || 'No se pudo verificar el mensaje.';
      }
    } catch (err: any) {
      this.errorIa = this.resolveComposerAiErrorMessage(err);
    } finally {
      this.cargandoIaMensaje = false;
      this.cdr.markForCheck();
    }
  }

  private buildIaReplyPrompt(
    mensajeRecibido: string,
    pregunta: string
  ): string {
    const historial = this.buildIaRecentChatContext();
    return (
      'Contexto de estilo:\n' +
      'Estos son mensajes recientes del chat. Usa SOLO los mensajes del usuario actual para imitar su forma de escribir: tono, longitud, expresiones, emojis y faltas comunes. No copies mensajes literalmente.\n\n' +
      `Historial reciente:\n${historial}\n\n` +
      `Mensaje recibido:\n"${mensajeRecibido}"\n\n` +
      `Peticion del usuario:\n"${pregunta}"\n\n` +
      'Genera unicamente una respuesta directa que el usuario actual pueda enviar. No expliques nada. No digas "podrias responder". Devuelve solo el texto final.'
    );
  }

  public getAiAskReferenceType(): 'TEXT' | 'AUDIO' {
    return this.isAiAskAudioMessage(this.mensajeSeleccionadoParaIa) ? 'AUDIO' : 'TEXT';
  }

  public getAiAskReferenceAudioSrc(): string {
    const mensaje = this.mensajeSeleccionadoParaIa;
    if (!this.isAiAskAudioMessage(mensaje)) return '';
    if (!mensaje) return '';

    const direct = String(this.getAudioSrc(mensaje) || '').trim();
    if (direct) return direct;

    const fallbackUrl = String(
      (mensaje as any)?.mediaUrl ?? mensaje?.audioUrl ?? ''
    ).trim();
    return fallbackUrl;
  }

  public isAiAskReferenceMine(): boolean {
    return Number(this.mensajeSeleccionadoParaIa?.emisorId || 0) === Number(this.usuarioActualId);
  }

  private isAiAskAudioMessage(mensaje: MensajeDTO | null | undefined): boolean {
    if (!mensaje) return false;
    const tipo = String((mensaje as any)?.tipoMensaje ?? mensaje?.tipo ?? '')
      .trim()
      .toUpperCase();
    if (tipo === 'AUDIO') return true;
    if (String(mensaje?.audioUrl || '').trim()) return true;
    if (String(mensaje?.audioDataUrl || '').trim()) return true;
    return String(mensaje?.audioMime || '').trim().toLowerCase().startsWith('audio/');
  }

  private buildAiAskRequestForMessage(
    mensaje: MensajeDTO,
    modo: AiTextMode,
    pregunta?: string
  ): AiTextRequestDTO {
    if (this.isAiAskAudioMessage(mensaje)) {
      const rawAudioPayload = this.extractAiAskAudioEncryptedPayload(mensaje);
      return {
        modo,
        messageId: Number.isFinite(Number(mensaje?.id || 0)) && Number(mensaje?.id || 0) > 0
          ? Math.round(Number(mensaje.id || 0))
          : undefined,
        tipoMensaje: 'AUDIO',
        audioUrl:
          String(this.getAiAskReferenceAudioSrc() || (mensaje as any)?.audioUrl || '').trim() ||
          null,
        mediaUrl: String((mensaje as any)?.mediaUrl || '').trim() || null,
        audioEncryptedPayload: rawAudioPayload || null,
        mimeType: String(mensaje?.audioMime || '').trim() || null,
        encryptedPayload: null,
      };
    }

    const contenidoMensaje = String(mensaje?.contenido || '').trim();
    return {
      texto:
        modo === AiTextMode.RESPONDER
          ? this.buildIaReplyPrompt(contenidoMensaje, String(pregunta || '').trim())
          : contenidoMensaje,
      modo,
    };
  }

  private extractAiAskAudioEncryptedPayload(mensaje: MensajeDTO): string {
    const direct = String((mensaje as any)?.audioEncryptedPayload || '').trim();
    if (direct) return direct;

    const raw = this.resolveDecryptInputFromMessageLike(mensaje);
    if (typeof raw === 'string') {
      const payload = this.parseAiSummaryEncryptedPayload(raw);
      const type = String(payload?.type || '').trim().toUpperCase();
      if (type === 'E2E_AUDIO' || type === 'E2E_GROUP_AUDIO') {
        return raw.trim();
      }
    }

    if (raw && typeof raw === 'object') {
      const type = String((raw as any)?.type || '').trim().toUpperCase();
      if (type === 'E2E_AUDIO' || type === 'E2E_GROUP_AUDIO') {
        try {
          return JSON.stringify(raw);
        } catch {
          return '';
        }
      }
    }

    return '';
  }

  private buildIaRecentChatContext(): string {
    const recent = (this.mensajesSeleccionados || [])
      .filter((mensaje) => this.isValidIaContextMessage(mensaje))
      .slice(-20)
      .map((mensaje) => {
        const sender =
          Number(mensaje?.emisorId) === Number(this.usuarioActualId)
            ? 'usuarioActual'
            : 'otraPersona';
        return `${sender}: ${this.normalizeIaContextMessageContent(mensaje?.contenido)}`;
      });

    return recent.length > 0 ? recent.join('\n') : 'Sin contexto reciente.';
  }

  private isValidIaContextMessage(mensaje: MensajeDTO | null | undefined): boolean {
    const tipo = String(mensaje?.tipo || 'TEXT').trim().toUpperCase();
    const contenido = String(mensaje?.contenido || '').trim();
    return tipo === 'TEXT' && !!contenido;
  }

  private normalizeIaContextMessageContent(contenidoRaw: unknown): string {
    const contenido = String(contenidoRaw || '').replace(/\s+/g, ' ').trim();
    if (contenido.length <= 240) return contenido;
    return `${contenido.slice(0, 237).trim()}...`;
  }

  public aplicarRespuestaIaAlInput(): void {
    const texto = String(this.respuestaIaMensaje || '').trim();
    if (!texto) return;
    this.mensajeNuevo = texto;
    this.scheduleComposerTextareaResize();
    this.cerrarModalIaMensaje();
    this.focusMessageInput(texto.length);
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
        this.fetchEstadosForTopbarResults(); // ?? pide estados + WS live
      },
      error: (e) => {
        console.error('?? searchUsuarios error:', e);
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
    return avatarOrDefault(u?.foto || null);
  }

  public resolveAvatarSrc(
    src?: string | null,
    fallback: string = 'assets/usuario.png'
  ): string {
    return avatarOrDefault(src || null, fallback);
  }

  public hasChatAvatar(chat: any): boolean {
    const raw = this.getChatAvatarRaw(chat);
    if (!raw) return false;
    const normalized = String(raw).trim().toLowerCase();
    return !(
      normalized.endsWith('/assets/usuario.png') ||
      normalized.endsWith('assets/usuario.png') ||
      normalized.endsWith('/assets/placeholder-user.png') ||
      normalized.endsWith('assets/placeholder-user.png')
    );
  }

  public getChatAvatarSrc(chat: any): string {
    const raw = this.getChatAvatarRaw(chat);
    if (!raw) return '';
    return resolveMediaUrl(raw, environment.backendBaseUrl) || '';
  }

  public getChatInitials(chat: any): string {
    const name = this.getChatDisplayNameForAvatar(chat);
    const clean = String(name || '').trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase() || '?';
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }

  public getChatAvatarColor(chat: any): string {
    const idCandidate = Number(
      chat?.esGrupo
        ? chat?.id ?? chat?.chatGrupalId
        : chat?.receptor?.id ?? chat?.receptorId ?? chat?.id
    );
    const seed = Number.isFinite(idCandidate) && idCandidate > 0
      ? idCandidate
      : this.hashAvatarSeed(this.getChatDisplayNameForAvatar(chat));
    const index = Math.abs(seed) % this.chatAvatarPalette.length;
    return this.chatAvatarPalette[index];
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
    this.persistActiveChatDraft();

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

    this.resetEdicion();

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
    this.usuarioGrabandoAudio = false;
    this.escribiendoHeader = '';
    this.audioGrabandoHeader = '';
    this.typingSetHeader?.clear?.();
    this.audioSetHeader?.clear?.();
    this.composeCursorStart = 0;
    this.composeCursorEnd = 0;

    // Suscribir estado del receptor (WS string ? normalizado)
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
      this.wsService.enviarEscribiendoGrupo(this.chatActual.id, true);
      this.escribiendoTimeout = setTimeout(() => {
        this.wsService.enviarEscribiendoGrupo(this.chatActual.id, false);
      }, 1000);
    } else {
      const receptorId = this.chatActual.receptor?.id;
      if (!receptorId) return;
      this.wsService.enviarEscribiendo(receptorId, true);
      this.escribiendoTimeout = setTimeout(() => {
        this.wsService.enviarEscribiendo(receptorId, false);
      }, 1000);
    }
  }

  private buildAudioHeaderText(names: string[]): string {
    if (!names.length) return '';
    if (names.length === 1) return `${names[0]} está grabando audio...`;
    if (names.length === 2)
      return `${names[0]} y ${names[1]} están grabando audio...`;
    return `${names[0]}, ${names[1]} y ${
      names.length - 2
    } más están grabando audio...`;
  }

  /**
   * Notifica por WebSockets que el usuario actual está grabando audio.
   */
  public notificarGrabandoAudio(grabandoAudio: boolean): void {
    if (!this.chatActual) return;
    if (this.haSalidoDelGrupo) return;

    clearTimeout(this.grabandoAudioTimeout);

    if (this.chatActual.esGrupo) {
      this.wsService.enviarGrabandoAudioGrupo(
        this.usuarioActualId,
        this.chatActual.id,
        grabandoAudio
      );
      if (grabandoAudio) {
        this.grabandoAudioTimeout = setTimeout(() => {
          this.wsService.enviarGrabandoAudioGrupo(
            this.usuarioActualId,
            this.chatActual.id,
            false
          );
        }, 1500);
      }
      return;
    }

    const receptorId = this.chatActual.receptor?.id;
    if (!receptorId) return;
    this.wsService.enviarGrabandoAudio(
      this.usuarioActualId,
      receptorId,
      grabandoAudio
    );
    if (grabandoAudio) {
      this.grabandoAudioTimeout = setTimeout(() => {
        this.wsService.enviarGrabandoAudio(
          this.usuarioActualId,
          receptorId,
          false
        );
      }, 1500);
    }
  }

  /**
   * Cambia el estatus global del usuario (Conectado, Ausente, Desconectado) y notifica a la red.
   */
  public cambiarEstado(
    nuevoEstado: 'Conectado' | 'Ausente' | 'Desconectado'
  ): void {
    if (nuevoEstado === this.estadoActual) return;

    if (this.wsService.enviarEstado(nuevoEstado)) {
      this.estadoActual = nuevoEstado;
    }
  }

  /**
   * Realiza un borrado lógico (invisible) de un mensaje del chat para todos.
   */
  public eliminarMensaje(mensaje: MensajeDTO): void {
    if (!mensaje.id || mensaje.activo === false) return;
    const messageId = Number(mensaje.id);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    const originalSnapshot: MensajeDTO = { ...(mensaje || {}) };
    const deletedAtMs = Date.now();
    this.aplicarEliminacionEnUI({
      ...(mensaje || {}),
      activo: false,
      chatId: mensaje.chatId ?? this.chatActual?.id,
      __deletedAtMs: deletedAtMs,
      deletedAt: new Date(deletedAtMs).toISOString(),
    });

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

    this.messageReactionsByMessageId.delete(Number(mensaje.id));
    if (this.openIncomingReactionPickerMessageId === Number(mensaje.id)) {
      this.openIncomingReactionPickerMessageId = null;
    }
    if (this.openReactionDetailsMessageId === Number(mensaje.id)) {
      this.openReactionDetailsMessageId = null;
    }
    this.openMensajeMenuId = null;
    if (Number(this.mensajeEdicionObjetivo?.id) === Number(mensaje.id)) {
      this.cancelarEdicionMensaje();
    }

    this.chatService.eliminarMensaje(messageId).subscribe({
      next: (deletedResponse) => {
        const persistedDeletion: MensajeDTO = {
          ...(payloadEliminar || {}),
          ...(deletedResponse || {}),
          id: messageId,
          chatId:
            (deletedResponse as any)?.chatId ??
            mensaje.chatId ??
            this.chatActual?.id,
          activo: false,
          __deletedAtMs:
            (deletedResponse as any)?.__deletedAtMs ??
            (deletedResponse as any)?.deletedAtMs ??
            deletedAtMs,
          deletedAt:
            String(
              (deletedResponse as any)?.deletedAt ??
                (deletedResponse as any)?.deleted_at ??
                (deletedResponse as any)?.fechaEliminacion ??
                ''
            ).trim() || new Date(deletedAtMs).toISOString(),
        };
        this.aplicarEliminacionEnUI(persistedDeletion);
        this.wsService.enviarEliminarMensaje(persistedDeletion);
      },
      error: (err) => {
        this.aplicarRestauracionEnUI(originalSnapshot);
        const backendMsg = String(
          err?.error?.mensaje || err?.error?.message || err?.message || ''
        ).trim();
        this.showToast(
          backendMsg || 'No se pudo eliminar el mensaje.',
          'warning',
          'Mensajes'
        );
      },
    });
  }

  private getMensajeCreatedAtMs(mensaje: MensajeDTO): number | null {
    const raw = String(
      (mensaje as any)?.fechaEnvio ??
        (mensaje as any)?.fecha ??
        (mensaje as any)?.createdAt ??
        ''
    ).trim();
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }

  private isEditWindowExpired(mensaje: MensajeDTO): boolean {
    const createdAtMs = this.getMensajeCreatedAtMs(mensaje);
    if (!Number.isFinite(createdAtMs)) return true;
    return Date.now() - Number(createdAtMs) > this.MESSAGE_EDIT_WINDOW_MS;
  }

  public canEditMensaje(mensaje: MensajeDTO): boolean {
    if (!mensaje || mensaje.activo === false) return false;
    if (Number(mensaje.emisorId) !== Number(this.usuarioActualId)) return false;
    if (String(mensaje.tipo || 'TEXT').toUpperCase() !== 'TEXT') return false;
    if (this.isPollMessage(mensaje)) return false;
    if (this.isEditWindowExpired(mensaje)) return false;
    const id = Number(mensaje.id);
    return Number.isFinite(id) && id > 0;
  }

  public iniciarEdicionMensaje(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.canEditMensaje(mensaje)) {
      if (this.isEditWindowExpired(mensaje)) {
        this.showToast(
          'Solo puedes editar mensajes durante los primeros 30 minutos.',
          'warning',
          'Editar'
        );
      }
      return;
    }

    const contenido = String(mensaje?.contenido || '');
    if (!contenido.trim() || this.isNonForwardableTextPlaceholder(contenido)) {
      this.showToast(
        'Este mensaje no puede editarse porque no está descifrado en este dispositivo.',
        'warning',
        'Editar'
      );
      this.openMensajeMenuId = null;
      return;
    }

    this.mensajeEdicionObjetivo = { ...this.normalizeMensajeEditadoFlag(mensaje) };
    this.mensajeNuevo = contenido;
    this.composeCursorStart = contenido.length;
    this.composeCursorEnd = contenido.length;
    this.cancelarRespuestaMensaje();
    this.forwardModalOpen = false;
    this.openMensajeMenuId = null;
    this.focusMessageInput(contenido.length);
  }

  public cancelarEdicionMensaje(clearComposer = true): void {
    this.mensajeEdicionObjetivo = null;
    if (clearComposer) {
      this.mensajeNuevo = '';
      this.composeCursorStart = 0;
      this.composeCursorEnd = 0;
    }
  }

  private applyLocalEditedMessage(
    mensajeId: number,
    contenidoPlano: string,
    editedAt: string
  ): void {
    const id = Number(mensajeId);
    if (!Number.isFinite(id) || id <= 0) return;
    const idx = this.mensajesSeleccionados.findIndex((m) => Number(m.id) === id);
    if (idx === -1) return;

    const prev = this.mensajesSeleccionados[idx];
    const updated: MensajeDTO = {
      ...prev,
      contenido: contenidoPlano,
      editado: true,
      edited: true,
      fechaEdicion: editedAt,
      editedAt,
    };
    this.mensajesSeleccionados = [
      ...this.mensajesSeleccionados.slice(0, idx),
      updated,
      ...this.mensajesSeleccionados.slice(idx + 1),
    ];
    this.syncActiveHistoryStateMessages();

    const chatId = Number(updated.chatId ?? this.chatActual?.id);
    const chat = this.chats.find((c) => Number(c.id) === chatId);
    if (chat && this.shouldRefreshPreviewWithIncomingMessage(chat, updated)) {
      const { preview, fecha, lastId } = computePreviewPatch(
        updated,
        chat,
        this.usuarioActualId
      );
      chat.ultimaMensaje = preview;
      chat.ultimaFecha = fecha;
      chat.lastPreviewId = lastId;
      this.stampChatLastMessageFieldsFromMessage(chat, updated);
      void this.syncChatItemLastPreviewMedia(chat, updated, 'local-edit-message');
    }
  }

  private async editarMensajeDesdeComposer(): Promise<void> {
    if (!this.chatActual || !this.mensajeEdicionObjetivo) return;
    if (this.haSalidoDelGrupo) return;

    const target = this.mensajeEdicionObjetivo;
    if (!this.canEditMensaje(target)) {
      if (this.isEditWindowExpired(target)) {
        this.showToast(
          'Solo puedes editar mensajes durante los primeros 30 minutos.',
          'warning',
          'Editar'
        );
      }
      this.cancelarEdicionMensaje();
      return;
    }

    const contenidoPlano = String(this.mensajeNuevo || '').trim();
    if (!contenidoPlano) {
      this.showToast('Escribe algo para editar el mensaje.', 'warning', 'Editar');
      return;
    }

    const originalPlano = String(target?.contenido || '').trim();
    if (contenidoPlano === originalPlano) {
      this.showToast('No hay cambios para guardar.', 'info', 'Editar', 1800);
      this.cancelarEdicionMensaje();
      return;
    }

    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const mensajeId = Number(target.id);
    const editedAt = new Date().toISOString();
    const chatId = Number(this.chatActual.id);

    if (this.chatActual.esGrupo) {
      if (this.noGroupRecipientsForSend) {
        this.showToast(
          'Todavia no ha aceptado nadie.',
          'warning',
          'Grupo'
        );
        return;
      }
      if (!this.e2eSessionReady) {
        const synced = await this.forceSyncMyE2EPublicKeyForRetry();
        if (!synced) {
          this.showToast(
            'No se pudo sincronizar tu clave E2E. Revisa tu sesión antes de editar en el grupo.',
            'danger',
            'E2E'
          );
          return;
        }
      }

      const encryptedGroup = await this.buildOutgoingE2EContentForGroup(
        this.chatActual,
        contenidoPlano
      );
      const payload: MensajeDTO = {
        id: mensajeId,
        contenido: encryptedGroup.content,
        emisorId: myId,
        receptorId: chatId,
        chatId,
        activo: true,
        tipo: 'TEXT',
        editado: true,
        edited: true,
        fechaEdicion: editedAt,
        editedAt,
      };
      this.attachContenidoBusqueda(payload, contenidoPlano);

      const strictValidation = this.validateOutgoingGroupPayloadStrict(
        payload.contenido,
        encryptedGroup.expectedRecipientIds
      );
      if (!strictValidation.ok) {
        this.showToast(
          `No se pudo editar: ${strictValidation.reason || strictValidation.code || 'payload E2E_GROUP inválido'}.`,
          'danger',
          'E2E'
        );
        return;
      }

      await this.logGroupWsPayloadBeforeSend(
        'edit-message-group-text',
        payload,
        strictValidation.forReceptoresKeys
      );
      this.wsService.enviarEditarMensaje(payload);
    } else {
      const receptorId = Number(this.chatActual?.receptor?.id);
      if (!Number.isFinite(receptorId) || receptorId <= 0) return;
      const contenidoCifrado = await this.buildOutgoingE2EContent(
        receptorId,
        contenidoPlano
      );
      const payload: MensajeDTO = {
        id: mensajeId,
        contenido: contenidoCifrado,
        emisorId: myId,
        receptorId,
        chatId,
        activo: true,
        tipo: 'TEXT',
        editado: true,
        edited: true,
        fechaEdicion: editedAt,
        editedAt,
      };
      this.attachContenidoBusqueda(payload, contenidoPlano);
      this.wsService.enviarEditarMensaje(payload);
    }

    this.applyLocalEditedMessage(mensajeId, contenidoPlano, editedAt);
    this.cancelarEdicionMensaje();
    this.cdr.markForCheck();
  }

  public responderMensaje(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!mensaje?.id) return;
    this.cancelarEdicionMensaje(false);
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
    if ((ref.tipo || 'TEXT') === 'FILE') {
      return `Archivo: ${this.getFileName(ref)}`;
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
    if ((this.mensajeRespuestaObjetivo.tipo || 'TEXT') === 'FILE') {
      return `Archivo: ${this.getFileName(this.mensajeRespuestaObjetivo)}`;
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

  public isForwardTargetBlocked(chat: any): boolean {
    if (!chat || chat.esGrupo) return false;
    const peerId = Number(chat?.receptor?.id);
    if (!Number.isFinite(peerId) || peerId <= 0) return false;
    return this.bloqueadosIds.has(peerId) || this.meHanBloqueadoIds.has(peerId);
  }

  public toggleForwardChat(chatInput: any, event?: Event): void {
    event?.stopPropagation();
    const chat =
      chatInput && typeof chatInput === 'object'
        ? chatInput
        : (this.chats || []).find((c: any) => Number(c?.id) === Number(chatInput));
    const id = Number(chat?.id ?? chatInput);
    if (!id) return;
    if (this.isForwardTargetBlocked(chat)) {
      this.forwardSelectedChatIds.delete(id);
      this.forwardSelectedChatIds = new Set(this.forwardSelectedChatIds);
      return;
    }
    if (this.forwardSelectedChatIds.has(id)) {
      this.forwardSelectedChatIds.delete(id);
    } else {
      this.forwardSelectedChatIds.add(id);
    }
    this.forwardSelectedChatIds = new Set(this.forwardSelectedChatIds);
  }

  public onChatItemClick(chat: any): void {
    this.openChatPinMenuChatId = null;
    if (this.forwardModalOpen) {
      if (this.isForwardTargetBlocked(chat)) return;
      this.toggleForwardChat(chat);
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

    const destinosRaw = this.chats.filter((c) => ids.includes(Number(c?.id)));
    const destinos = destinosRaw.filter((c) => !this.isForwardTargetBlocked(c));
    if (destinos.length < destinosRaw.length) {
      this.showToast(
        'Se omitieron chats bloqueados del reenvío.',
        'info',
        'Reenvío',
        2200
      );
    }
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
    if (tipo === 'FILE') {
      return `Archivo: ${this.getFileName(original)}`;
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
    if (item) {
      const nowIso = new Date().toISOString();
      const receptorPreviewId = chatDestino?.esGrupo
        ? Number(chatId)
        : Number(chatDestino?.receptor?.id || 0);
      const previewMensaje: MensajeDTO = {
        id: -(Date.now() + Math.floor(Math.random() * 1000)),
        contenido:
          tipo === 'TEXT'
            ? contenidoPlano
            : tipo === 'AUDIO'
            ? `?? ${previewTexto}`
            : previewTexto,
        emisorId,
        receptorId: receptorPreviewId,
        activo: true,
        leido: true,
        chatId,
        fechaEnvio: nowIso,
        tipo: tipo as any,
        reenviado: true,
        mensajeOriginalId: Number(original?.id),
        audioUrl: original?.audioUrl || null,
        audioMime: original?.audioMime || null,
        audioDuracionMs: original?.audioDuracionMs ?? null,
        imageUrl: original?.imageUrl || null,
        imageMime: original?.imageMime || null,
        imageNombre: original?.imageNombre || null,
      };
      item.unreadCount = 0;
      item.ultimaFecha = nowIso;
      item.lastPreviewId = previewMensaje.id ?? item.lastPreviewId;
      this.stampChatLastMessageFieldsFromMessage(item, previewMensaje);
      void this.syncChatItemLastPreviewMedia(
        item,
        previewMensaje,
        'forward-local-preview'
      );
    }

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
      this.attachTemporaryMetadata(payloadGrupal);
      if (tipo === 'TEXT') {
        this.attachContenidoBusqueda(payloadGrupal, contenidoPlano);
      }
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
    this.attachTemporaryMetadata(payloadIndividual);
    if (tipo === 'TEXT') {
      this.attachContenidoBusqueda(payloadIndividual, contenidoPlano);
    }
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

  public canFijarMensaje(mensaje: MensajeDTO): boolean {
    if (!mensaje || mensaje.activo === false) return false;
    if (this.isSystemMessage(mensaje)) return false;
    const messageId = Number(mensaje.id);
    const chatId = Number(this.chatSeleccionadoId || this.chatActual?.id);
    return (
      Number.isFinite(messageId) &&
      messageId > 0 &&
      Number.isFinite(chatId) &&
      chatId > 0
    );
  }

  public abrirSelectorFijado(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canFijarMensaje(mensaje)) return;
    this.pinTargetMessage = mensaje;
    this.showPinDurationPicker = true;
    this.openMensajeMenuId = null;
  }

  public cancelarSelectorFijado(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.showPinDurationPicker = false;
    this.pinTargetMessage = null;
  }

  public confirmarFijadoConDuracion(
    option: PinDurationOption,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.pinRequestInFlight) return;
    const chatId = Number(this.chatSeleccionadoId || this.chatActual?.id);
    const messageId = Number(this.pinTargetMessage?.id);
    const durationSeconds = Number(option?.seconds);
    if (
      !Number.isFinite(chatId) ||
      chatId <= 0 ||
      !Number.isFinite(messageId) ||
      messageId <= 0 ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0
    ) {
      return;
    }

    this.pinRequestInFlight = true;
    const payload: PinMessageRequestDTO = { messageId, durationSeconds };
    this.chatService
      .fijarMensaje(chatId, payload)
      .pipe(
        finalize(() => {
          this.pinRequestInFlight = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          const normalized = this.normalizePinnedMessage(response);
          if (normalized) {
            this.pinnedMessage = normalized;
          } else if (this.pinTargetMessage) {
            this.pinnedMessage = this.buildPinnedFromLocalMessage(
              chatId,
              this.pinTargetMessage,
              durationSeconds
            );
          }
          this.showPinDurationPicker = false;
          this.pinTargetMessage = null;
          this.showToast('Mensaje fijado.', 'success', 'Fijados', 1800);
        },
        error: (error) => {
          console.warn('[fijados] no se pudo fijar mensaje', error);
          this.showToast(
            this.getFijadoActionErrorMessage(error, 'fijar'),
            'warning',
            'Fijados'
          );
        },
      });
  }

  public togglePinnedActionsMenu(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.pinnedMessage) return;
    this.showPinnedActionsMenu = !this.showPinnedActionsMenu;
  }

  public async irAlMensajeFijado(event?: MouseEvent): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    const messageId = Number(this.pinnedMessage?.messageId);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    this.showPinnedActionsMenu = false;
    await this.onMessageSearchResultSelect(messageId);
  }

  public desfijarMensajeActual(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.unpinRequestInFlight) return;
    const chatId = Number(this.chatSeleccionadoId || this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    this.unpinRequestInFlight = true;
    this.chatService
      .desfijarMensaje(chatId)
      .pipe(
        finalize(() => {
          this.unpinRequestInFlight = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.pinnedMessage = null;
          this.showPinnedActionsMenu = false;
          this.showToast('Mensaje desfijado.', 'info', 'Fijados', 1800);
        },
        error: (error) => {
          console.warn('[fijados] no se pudo desfijar mensaje', error);
          if (Number(error?.status || 0) === 404) {
            this.pinnedMessage = null;
            this.showPinnedActionsMenu = false;
            return;
          }
          this.showToast(
            this.getFijadoActionErrorMessage(error, 'desfijar'),
            'warning',
            'Fijados'
          );
        },
      });
  }

  public get pinnedMessageAuthorLabel(): string {
    const pinned = this.pinnedMessage;
    if (!pinned) return '';
    const senderId = Number(pinned.senderId);
    if (Number.isFinite(senderId) && senderId === Number(this.usuarioActualId)) {
      return 'Tu:';
    }

    const loaded = this.findLoadedMessageById(Number(pinned.messageId));
    const loadedName =
      `${loaded?.emisorNombre || ''} ${loaded?.emisorApellido || ''}`.trim();
    const fallbackById =
      Number.isFinite(senderId) && senderId > 0
        ? this.obtenerNombrePorId(senderId) || ''
        : '';
    const backendName = String(pinned.senderName || '').trim();
    const resolved = backendName || loadedName || fallbackById || 'Usuario';
    return `${resolved}:`;
  }

  public get pinnedMessagePreviewLabel(): string {
    const pinned = this.pinnedMessage;
    if (!pinned) return '';
    const loaded = this.findLoadedMessageById(Number(pinned.messageId));
    if (loaded) {
      return this.buildPinnedPreviewFromMessage(loaded);
    }

    const fromBackend = String(pinned.preview || '').trim();
    if (this.isUsablePinnedPreview(fromBackend)) return fromBackend;
    return this.buildPinnedPreviewByTypeFallback(pinned);
  }

  private isUsablePinnedPreview(raw: string): boolean {
    const text = String(raw || '').trim();
    if (!text) return false;
    const normalized = text.toLowerCase();
    if (normalized === '[mensaje cifrado]') return false;
    if (normalized === '[error de descifrado e2e]') return false;
    if (normalized.startsWith('[mensaje cifrado -')) return false;
    if (this.looksLikeEncryptedPreview(text)) return false;
    return true;
  }

  private buildPinnedPreviewByTypeFallback(pinned: ChatPinnedMessageDTO): string {
    const tipo = String(pinned?.messageType || '').trim().toUpperCase();
    if (tipo === 'AUDIO') return 'Mensaje de voz';
    if (tipo === 'IMAGE') return 'Imagen';
    if (tipo === 'FILE') return 'Archivo';
    if (tipo === 'POLL') return 'Encuesta';
    if (tipo === 'SYSTEM') return 'Mensaje del sistema';
    return 'Mensaje fijado';
  }

  public canDestacarMensaje(mensaje: MensajeDTO): boolean {
    if (!mensaje || mensaje.activo === false) return false;
    if (this.isSystemMessage(mensaje)) return false;
    if (Number(mensaje.emisorId) === Number(this.usuarioActualId)) return false;
    const id = Number(mensaje.id);
    return Number.isFinite(id) && id > 0;
  }

  public isMensajeDestacado(mensaje: MensajeDTO | null | undefined): boolean {
    const messageId = Number(mensaje?.id);
    return (
      Number.isFinite(messageId) &&
      messageId > 0 &&
      this.starredMessageIds.has(messageId)
    );
  }

  public toggleDestacarMensaje(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canDestacarMensaje(mensaje)) return;

    const messageId = Number(mensaje.id);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    if (this.starringMessageIds.has(messageId)) return;
    this.starringMessageIds.add(messageId);

    if (this.starredMessageIds.has(messageId)) {
      this.chatService
        .quitarDestacado(messageId)
        .pipe(
          finalize(() => {
            this.starringMessageIds.delete(messageId);
            this.cdr.markForCheck();
          })
        )
        .subscribe({
          next: () => {
            this.removeStarredMessageById(messageId);
            this.openMensajeMenuId = null;
            this.showToast(
              'Mensaje quitado de destacados.',
              'info',
              'Destacados',
              1800
            );
            if (this.isStarredView) {
              this.loadStarredMessagesFromBackend(false, this.starredPage);
            }
          },
          error: (error) => {
            console.warn('[destacados] no se pudo quitar destacado', error);
            if (Number(error?.status || 0) === 404) {
              this.removeStarredMessageById(messageId);
            }
            this.showToast(
              this.getDestacadoActionErrorMessage(error, 'quitar'),
              'warning',
              'Destacados'
            );
          },
        });
      return;
    }

    this.chatService
      .destacarMensaje(messageId)
      .pipe(
        finalize(() => {
          this.starringMessageIds.delete(messageId);
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          const nextItem = this.resolveStarredMessageFromApiResponse(
            response,
            mensaje
          );
          this.upsertStarredMessage(nextItem);
          this.openMensajeMenuId = null;
          this.showToast('Mensaje destacado.', 'success', 'Destacados', 1800);
          if (this.isStarredView) {
            this.loadStarredMessagesFromBackend(false, 0);
          }
        },
        error: (error) => {
          console.warn('[destacados] no se pudo destacar mensaje', error);
          this.showToast(
            this.getDestacadoActionErrorMessage(error, 'destacar'),
            'warning',
            'Destacados'
          );
        },
      });
  }

  public toggleDestacadoDesdeLista(
    item: StarredMessageItem,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    const messageId = Number(item?.messageId);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    if (this.starringMessageIds.has(messageId)) return;
    this.starringMessageIds.add(messageId);

    this.chatService
      .quitarDestacado(messageId)
      .pipe(
        finalize(() => {
          this.starringMessageIds.delete(messageId);
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.removeStarredMessageById(messageId);
          this.showToast(
            'Mensaje quitado de destacados.',
            'info',
            'Destacados',
            1800
          );
          if (this.isStarredView) {
            this.loadStarredMessagesFromBackend(false, this.starredPage);
          }
        },
        error: (error) => {
          console.warn('[destacados] no se pudo quitar destacado', error);
          if (Number(error?.status || 0) === 404) {
            this.removeStarredMessageById(messageId);
          }
          this.showToast(
            this.getDestacadoActionErrorMessage(error, 'quitar'),
            'warning',
            'Destacados'
          );
        },
      });
  }

  private getDestacadoActionErrorMessage(
    error: any,
    action: 'destacar' | 'quitar'
  ): string {
    const status = Number(error?.status || 0);
    const backendMsg = String(
      error?.error?.mensaje || error?.error?.message || ''
    ).trim();
    if (backendMsg) return backendMsg;

    if (status === 403) {
      return action === 'destacar'
        ? 'No tienes permisos para destacar este mensaje o es un mensaje propio.'
        : 'No tienes permisos para quitar el destacado de este mensaje.';
    }

    if (status === 404) {
      return 'El mensaje no existe o ya no está disponible.';
    }

    return action === 'destacar'
      ? 'No se pudo destacar el mensaje. Inténtalo de nuevo.'
      : 'No se pudo quitar el destacado. Inténtalo de nuevo.';
  }

  private getDestacadoListErrorMessage(error: any): string {
    const status = Number(error?.status || 0);
    const backendMsg = String(
      error?.error?.mensaje || error?.error?.message || ''
    ).trim();
    if (backendMsg) return backendMsg;

    if (status === 403) {
      return 'No tienes permisos para consultar mensajes destacados.';
    }
    if (status === 401) {
      return 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
    }

    return 'No se pudieron cargar los mensajes destacados.';
  }

  private getFijadoActionErrorMessage(
    error: any,
    action: 'fijar' | 'desfijar'
  ): string {
    const status = Number(error?.status || 0);
    const backendMsg = String(
      error?.error?.mensaje || error?.error?.message || ''
    ).trim();
    if (backendMsg) return backendMsg;
    if (status === 403) {
      return 'No tienes permisos para gestionar el mensaje fijado de este chat.';
    }
    if (status === 404) {
      return action === 'fijar'
        ? 'No se encontro el mensaje para fijar.'
        : 'No hay mensaje fijado en este chat.';
    }
    return action === 'fijar'
      ? 'No se pudo fijar el mensaje. Intentalo de nuevo.'
      : 'No se pudo desfijar el mensaje. Intentalo de nuevo.';
  }

  private normalizePinnedMessage(raw: any): ChatPinnedMessageDTO | null {
    if (!raw || typeof raw !== 'object') return null;
    const chatIdRaw = Number(raw?.chatId ?? this.chatSeleccionadoId ?? this.chatActual?.id);
    const messageIdRaw = Number(raw?.messageId ?? raw?.mensajeId);
    const senderIdRaw = Number(raw?.senderId ?? raw?.emisorId);
    if (
      !Number.isFinite(chatIdRaw) ||
      chatIdRaw <= 0 ||
      !Number.isFinite(messageIdRaw) ||
      messageIdRaw <= 0
    ) {
      return null;
    }

    return {
      chatId: Math.round(chatIdRaw),
      messageId: Math.round(messageIdRaw),
      senderId:
        Number.isFinite(senderIdRaw) && senderIdRaw > 0
          ? Math.round(senderIdRaw)
          : 0,
      senderName: String(raw?.senderName ?? raw?.emisorNombre ?? '').trim() || null,
      messageType: String(raw?.messageType ?? raw?.tipo ?? '').trim() || undefined,
      preview: String(raw?.preview ?? raw?.mensajePreview ?? '').trim() || null,
      pinnedAt: String(raw?.pinnedAt ?? raw?.fijadoEn ?? '').trim() || null,
      pinnedByUserId: Number.isFinite(Number(raw?.pinnedByUserId ?? raw?.fijadoPorId))
        ? Number(raw?.pinnedByUserId ?? raw?.fijadoPorId)
        : null,
      expiresAt: String(raw?.expiresAt ?? raw?.expiraEn ?? '').trim() || null,
    };
  }

  private buildPinnedFromLocalMessage(
    chatId: number,
    mensaje: MensajeDTO,
    durationSeconds: number
  ): ChatPinnedMessageDTO {
    const now = Date.now();
    const expiresAt = new Date(now + durationSeconds * 1000).toISOString();
    const senderName =
      `${mensaje?.emisorNombre || ''} ${mensaje?.emisorApellido || ''}`.trim() ||
      (Number(mensaje?.emisorId) === Number(this.usuarioActualId)
        ? 'Tu'
        : this.obtenerNombrePorId(Number(mensaje?.emisorId)) || 'Usuario');
    return {
      chatId,
      messageId: Number(mensaje?.id) || 0,
      senderId: Number(mensaje?.emisorId) || 0,
      senderName,
      messageType: String(mensaje?.tipo || 'TEXT'),
      preview: this.buildPinnedPreviewFromMessage(mensaje),
      pinnedAt: new Date(now).toISOString(),
      pinnedByUserId: Number(this.usuarioActualId) || null,
      expiresAt,
    };
  }

  private buildPinnedPreviewFromMessage(message: MensajeDTO | null | undefined): string {
    if (!message) return 'Mensaje fijado';
    const tipo = String(message?.tipo || 'TEXT').trim().toUpperCase();
    if (tipo === 'AUDIO') return 'Mensaje de voz';
    if (tipo === 'IMAGE') return 'Imagen';
    if (tipo === 'FILE') return `Archivo: ${this.getFileName(message) || 'Adjunto'}`;
    if (tipo === 'POLL') return this.getPollQuestion(message) || 'Encuesta';
    if (tipo === 'SYSTEM') return 'Mensaje del sistema';
    const raw = String(message?.contenido || '').trim();
    if (!raw) return 'Mensaje fijado';
    return raw.length > 90 ? `${raw.slice(0, 90)}...` : raw;
  }

  private findLoadedMessageById(messageId: number): MensajeDTO | null {
    if (!Number.isFinite(messageId) || messageId <= 0) return null;
    const list = Array.isArray(this.mensajesSeleccionados)
      ? this.mensajesSeleccionados
      : [];
    return list.find((item) => Number(item?.id) === messageId) || null;
  }

  private findLoadedMessageAcrossConversationsById(
    messageIdRaw: unknown
  ): MensajeDTO | null {
    const messageId = Number(messageIdRaw);
    if (!Number.isFinite(messageId) || messageId <= 0) return null;

    const fromActive = this.findLoadedMessageById(messageId);
    if (fromActive) return fromActive;

    const fromHydrated = this.starredHydratedMessagesById.get(Math.round(messageId));
    if (fromHydrated) return fromHydrated;

    for (const state of this.historyStateByConversation.values()) {
      const list = Array.isArray(state?.messages) ? state.messages : [];
      const found =
        list.find((item) => Number(item?.id) === Math.round(messageId)) || null;
      if (found) return found;
    }
    return null;
  }

  private resolveChatIdForStarredNavigation(
    item: StarredMessageItem,
    messageIdRaw: unknown
  ): number | null {
    const messageId = Number(messageIdRaw);
    const hydrated = this.findLoadedMessageAcrossConversationsById(messageId);
    const hydratedChatId = Number(hydrated?.chatId);
    const directChatId = Number(item?.chatId);
    const fallbackChatId = Number(
      (item as any)?.idChat ??
        (item as any)?.chatID ??
        (item as any)?.conversationId ??
        (item as any)?.conversation_id ??
        (item as any)?.roomId ??
        (item as any)?.room_id
    );

    const candidates = [directChatId, hydratedChatId, fallbackChatId];
    for (const candidate of candidates) {
      if (Number.isFinite(candidate) && candidate > 0) {
        return Math.round(candidate);
      }
    }
    return null;
  }

  private findChatForStarredByMetadata(item: StarredMessageItem): any | null {
    const list = Array.isArray(this.chats) ? this.chats : [];
    if (list.length === 0) return null;

    const senderId = Number(item?.emisorId);
    if (Number.isFinite(senderId) && senderId > 0) {
      const direct = list.find(
        (chat: any) => !chat?.esGrupo && Number(chat?.receptor?.id) === senderId
      );
      if (direct) return direct;
    }

    const normalizedChatName = String(item?.chatNombre || '')
      .trim()
      .toLowerCase();
    if (!normalizedChatName) return null;

    const byName = list.find((chat: any) => {
      const receptorFullName = `${chat?.receptor?.nombre || ''} ${
        chat?.receptor?.apellido || ''
      }`
        .trim()
        .toLowerCase();
      const groupName = String(chat?.nombreGrupo || chat?.nombre || '')
        .trim()
        .toLowerCase();
      return (
        normalizedChatName === receptorFullName || normalizedChatName === groupName
      );
    });
    return byName || null;
  }

  private async resolveChatForStarredNavigation(
    item: StarredMessageItem,
    messageIdRaw: unknown
  ): Promise<any | null> {
    const resolvedChatId = this.resolveChatIdForStarredNavigation(item, messageIdRaw);
    if (resolvedChatId) {
      const byId = this.resolveChatContextForMessage(resolvedChatId);
      if (byId) return byId;
    }

    const byMetadata = this.findChatForStarredByMetadata(item);
    if (byMetadata) return byMetadata;

    if (!this.chatListLoading) {
      this.listarTodosLosChats();
    }
    await this.waitForCondition(() => !this.chatListLoading, 12000);

    if (resolvedChatId) {
      const byIdAfterReload = this.resolveChatContextForMessage(resolvedChatId);
      if (byIdAfterReload) return byIdAfterReload;
    }

    return this.findChatForStarredByMetadata(item);
  }

  private async loadPinnedMessageForActiveChat(showErrorToast = false): Promise<void> {
    const chatId = Number(this.chatSeleccionadoId || this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.pinnedMessage = null;
      return;
    }

    const requestSeq = ++this.pinnedMessageRequestSeq;
    try {
      const response = await firstValueFrom(this.chatService.obtenerMensajeFijado(chatId));
      if (requestSeq !== this.pinnedMessageRequestSeq) return;
      this.pinnedMessage = this.normalizePinnedMessage(response);
    } catch (error) {
      if (requestSeq !== this.pinnedMessageRequestSeq) return;
      if (Number((error as any)?.status || 0) === 404) {
        this.pinnedMessage = null;
        return;
      }
      console.warn('[fijados] no se pudo cargar mensaje fijado', error);
      this.pinnedMessage = null;
      if (showErrorToast) {
        this.showToast(
          'No se pudo cargar el mensaje fijado del chat.',
          'warning',
          'Fijados'
        );
      }
    }
  }

  public async abrirMensajeDestacado(item: StarredMessageItem): Promise<void> {
    const targetId = Number(item?.messageId ?? (item as any)?.mensajeId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return;
    }

    const chat = await this.resolveChatForStarredNavigation(item, targetId);
    const chatId = Number(chat?.id);
    if (!chat || !Number.isFinite(chatId) || chatId <= 0) {
      this.showToast(
        'No se pudo abrir el mensaje destacado: chat no disponible.',
        'warning',
        'Destacados'
      );
      return;
    }

    this.openChatsSidebarView();
    this.activeMainView = 'chat';

    this.pendingOpenFromStarredNavigation = {
      chatId: Math.round(chatId),
      messageId: Math.round(targetId),
    };

    this.mostrarMensajes(chat);
    await this.waitForCondition(
      () => Number(this.chatActual?.id) === Math.round(chatId),
      5000
    );

    try {
      await this.onMessageSearchResultSelect(targetId);
    } finally {
      const pending = this.pendingOpenFromStarredNavigation;
      if (
        pending &&
        Number(pending.chatId) === Math.round(chatId) &&
        Number(pending.messageId) === Math.round(targetId)
      ) {
        this.pendingOpenFromStarredNavigation = null;
      }
    }
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
    this.openReactionDetailsMessageId = null;
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
    const prev = this.getUserReactionEmojiForMessage(
      id,
      Number(this.usuarioActualId)
    );
    const next = prev === selected ? '' : selected;

    if (next) {
      this.upsertMessageReactionByMessageId(id, {
        userId: Number(this.usuarioActualId),
        emoji: next,
        createdAt: new Date().toISOString(),
      });
    } else {
      this.removeMessageReactionByMessageId(id, Number(this.usuarioActualId));
    }
    this.emitOutgoingReactionEvent(mensaje, next || null);
    this.openIncomingReactionPickerMessageId = null;
    this.cdr.markForCheck();
  }

  public incomingQuickReaction(mensaje: MensajeDTO): string {
    const id = Number(mensaje.id);
    if (!Number.isFinite(id) || id <= 0) return '';
    const list = this.getMessageReactionsByMessageId(id);
    return String(list[0]?.emoji || '');
  }

  public hasReactionDetails(mensaje: MensajeDTO): boolean {
    const id = Number(mensaje?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    return this.getMessageReactionsByMessageId(id).length > 0;
  }

  public toggleMessageReactionDetails(
    mensaje: MensajeDTO,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    const id = Number(mensaje?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!this.hasReactionDetails(mensaje)) return;
    this.openReactionDetailsMessageId =
      this.openReactionDetailsMessageId === id ? null : id;
    this.openIncomingReactionPickerMessageId = null;
    this.cdr.markForCheck();
  }

  public isMessageReactionDetailsOpen(mensaje: MensajeDTO): boolean {
    const id = Number(mensaje?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    return this.openReactionDetailsMessageId === id;
  }

  public messageReactionDetails(mensaje: MensajeDTO): MessageReactionViewItem[] {
    const id = Number(mensaje?.id);
    if (!Number.isFinite(id) || id <= 0) return [];
    const state = this.getMessageReactionsByMessageId(id);
    return state.map((reaction) =>
      this.buildMessageReactionViewItem(mensaje, reaction)
    );
  }

  public trackMessageReaction = (_: number, r: MessageReactionViewItem) =>
    `${r.userId}-${r.emoji}-${r.createdAt || ''}`;

  private setMessageReactionsByMessageId(
    messageId: number,
    reactions: MessageReactionStateItem[] | null
  ): void {
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) return;
    const normalized = this.normalizeMessageReactionSnapshot(reactions || []);
    if (!normalized.length) {
      this.messageReactionsByMessageId.delete(id);
      return;
    }
    this.messageReactionsByMessageId.set(id, normalized);
  }

  private upsertMessageReactionByMessageId(
    messageId: number,
    reaction: MessageReactionStateItem
  ): void {
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) return;
    const userId = Number(reaction?.userId);
    const emoji = String(reaction?.emoji || '').trim();
    if (!Number.isFinite(userId) || userId <= 0 || !emoji) return;

    const current = this.getMessageReactionsByMessageId(id);
    const filtered = current.filter((r) => Number(r.userId) !== userId);
    const merged = [
      ...filtered,
      {
        userId,
        emoji,
        createdAt: String(reaction?.createdAt || '').trim() || null,
      },
    ];
    this.setMessageReactionsByMessageId(id, merged);
  }

  private removeMessageReactionByMessageId(
    messageId: number,
    reactorUserId: number
  ): void {
    const id = Number(messageId);
    const userId = Number(reactorUserId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!Number.isFinite(userId) || userId <= 0) return;
    const current = this.getMessageReactionsByMessageId(id);
    if (!current.length) return;
    this.setMessageReactionsByMessageId(
      id,
      current.filter((r) => Number(r.userId) !== userId)
    );
  }

  private getMessageReactionsByMessageId(messageId: number): MessageReactionStateItem[] {
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) return [];
    return [...(this.messageReactionsByMessageId.get(id) || [])];
  }

  private getUserReactionEmojiForMessage(
    messageId: number,
    userId: number
  ): string {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) return '';
    const reactions = this.getMessageReactionsByMessageId(messageId);
    const mine = reactions.find((r) => Number(r.userId) === uid);
    return String(mine?.emoji || '');
  }

  private normalizeMessageReactionSnapshot(
    reactions: MessageReactionStateItem[]
  ): MessageReactionStateItem[] {
    if (!Array.isArray(reactions) || reactions.length === 0) return [];
    const dedupByUserId = new Map<number, MessageReactionStateItem>();
    for (const reaction of reactions) {
      const userId = Number(reaction?.userId || 0);
      const emoji = String(reaction?.emoji || '').trim();
      if (!emoji || !Number.isFinite(userId) || userId <= 0) continue;
      const candidate: MessageReactionStateItem = {
        userId,
        emoji,
        createdAt: String(reaction?.createdAt || '').trim() || null,
      };
      const prev = dedupByUserId.get(userId);
      if (!prev) {
        dedupByUserId.set(userId, candidate);
        continue;
      }
      if (
        this.reactionSortValue(candidate.createdAt) >=
        this.reactionSortValue(prev.createdAt)
      ) {
        dedupByUserId.set(userId, candidate);
      }
    }

    return Array.from(dedupByUserId.values()).sort(
      (a, b) =>
        this.reactionSortValue(b.createdAt) - this.reactionSortValue(a.createdAt)
    );
  }

  private reactionSortValue(value?: string | null): number {
    const ts = Date.parse(String(value || ''));
    return Number.isFinite(ts) ? ts : 0;
  }

  private buildMessageReactionViewItem(
    mensaje: MensajeDTO,
    reaction: MessageReactionStateItem
  ): MessageReactionViewItem {
    const userId = Number(reaction?.userId || 0);
    const name = this.resolveReactionUserName(userId, mensaje);
    return {
      userId,
      emoji: String(reaction?.emoji || '').trim(),
      createdAt: String(reaction?.createdAt || '').trim() || null,
      name,
      photoUrl: this.resolveReactionUserPhoto(userId, mensaje),
      initials: this.buildInitials(name),
    };
  }

  private resolveReactionUserName(userId: number, mensaje: MensajeDTO): string {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return 'Usuario';
    if (id === Number(this.usuarioActualId)) return 'Tú';

    if (Number(mensaje?.emisorId) === id) {
      const senderName =
        `${mensaje?.emisorNombre || ''} ${mensaje?.emisorApellido || ''}`.trim();
      if (senderName) return senderName;
    }

    const member = this.findUserInCurrentChatById(id);
    if (member) {
      const full = `${member.nombre || ''} ${member.apellido || ''}`.trim();
      if (full) return full;
    }

    return this.obtenerNombrePorId(id) || `Usuario ${id}`;
  }

  private resolveReactionUserPhoto(
    userId: number,
    mensaje: MensajeDTO
  ): string | null {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;

    if (id === Number(this.usuarioActualId)) {
      const own = resolveMediaUrl(
        String(this.usuarioFotoUrl || this.perfilUsuario?.foto || '').trim(),
        environment.backendBaseUrl
      );
      return own || null;
    }

    if (Number(mensaje?.emisorId) === id) {
      const fromMessage = resolveMediaUrl(
        String(mensaje?.emisorFoto || '').trim(),
        environment.backendBaseUrl
      );
      if (fromMessage) return fromMessage;
    }

    const member = this.findUserInCurrentChatById(id);
    const fromMember = resolveMediaUrl(
      String(member?.foto || '').trim(),
      environment.backendBaseUrl
    );
    if (fromMember) return fromMember;

    return null;
  }

  private findUserInCurrentChatById(
    userId: number
  ): { nombre?: string; apellido?: string; foto?: string | null } | null {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;

    const receptor = this.chatActual?.receptor;
    if (receptor && Number(receptor?.id) === id) {
      return receptor;
    }

    const members = Array.isArray(this.chatActual?.usuarios)
      ? this.chatActual.usuarios
      : [];
    const found = members.find((m: any) => Number(m?.id) === id);
    return found || null;
  }

  private buildInitials(name: string): string {
    const clean = String(name || '').trim();
    if (!clean) return 'US';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  private getChatAvatarRaw(chat: any): string {
    const raw = chat?.esGrupo
      ? chat?.fotoGrupo ?? chat?.foto ?? null
      : chat?.receptor?.foto ?? chat?.foto ?? null;
    return String(raw || '').trim();
  }

  private getChatDisplayNameForAvatar(chat: any): string {
    if (!chat) return '';
    if (chat?.esGrupo) {
      return String(
        chat?.nombreChat ?? chat?.nombreGrupo ?? chat?.nombre ?? ''
      ).trim();
    }
    const fullName = String(
      chat?.nombreCompletoReceptor ||
      `${chat?.receptor?.nombre || ''} ${chat?.receptor?.apellido || ''}` ||
      chat?.nombre ||
      ''
    ).trim();
    return fullName;
  }

  private hashAvatarSeed(value: string): number {
    const text = String(value || '').trim();
    if (!text) return 0;
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return hash;
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
      this.removeMessageReactionByMessageId(event.messageId, event.reactorUserId);
    } else {
      const emoji = String(event.emoji || '').trim();
      if (!emoji) return;
      this.upsertMessageReactionByMessageId(event.messageId, {
        userId: event.reactorUserId,
        emoji,
        createdAt: event.createdAt || null,
      });
    }

    if (this.openIncomingReactionPickerMessageId === Number(event.messageId)) {
      this.openIncomingReactionPickerMessageId = null;
    }
    this.cdr.markForCheck();
  }

  private seedIncomingReactionsFromMessages(messages: MensajeDTO[]): void {
    if (!Array.isArray(messages) || messages.length === 0) return;
    for (const m of messages) {
      const id = Number(m?.id);
      if (!Number.isFinite(id) || id <= 0) continue;

      const hasA =
        Object.prototype.hasOwnProperty.call(m, 'reaccionEmoji') ||
        Object.prototype.hasOwnProperty.call(m, 'reactionEmoji');
      const hasB = Object.prototype.hasOwnProperty.call(m, 'reacciones');

      const normalizedFromList = Array.isArray(m?.reacciones)
        ? m.reacciones
            .map((r: any) => ({
              userId: Number(r?.userId ?? r?.usuarioId ?? 0),
              emoji: String(r?.emoji ?? r?.reaction ?? '').trim(),
              createdAt: String(r?.createdAt ?? r?.fecha ?? '').trim() || null,
            }))
            .filter((r) => Number.isFinite(r.userId) && r.userId > 0 && !!r.emoji)
        : [];

      if (normalizedFromList.length > 0) {
        this.setMessageReactionsByMessageId(id, normalizedFromList);
        continue;
      }

      const directEmoji = String(m?.reaccionEmoji ?? m?.reactionEmoji ?? '').trim();
      const directActorId = Number(m?.reaccionUsuarioId ?? m?.reactionUserId ?? 0);
      const directCreatedAt = String(m?.reaccionFecha ?? m?.reactionAt ?? '').trim();
      if (directEmoji && Number.isFinite(directActorId) && directActorId > 0) {
        this.setMessageReactionsByMessageId(id, [
          {
            userId: directActorId,
            emoji: directEmoji,
            createdAt: directCreatedAt || null,
          },
        ]);
        continue;
      }

      if (hasA || hasB) {
        this.messageReactionsByMessageId.delete(id);
      }
    }
  }

  @HostListener('document:click', ['$event'])
  public closeMensajeMenuOnOutsideClick(event: MouseEvent): void {
    this.openMensajeMenuId = null;
    this.showTopbarProfileMenu = false;
    const target = event?.target as Node | null;
    const targetEl = target instanceof Element ? target : null;

    if (this.showPinnedActionsMenu) {
      const insidePinnedActions = !!targetEl?.closest('.chat-pinned-banner__actions');
      if (!insidePinnedActions) {
        this.showPinnedActionsMenu = false;
      }
    }

    if (this.showChatListHeaderMenu) {
      const insideChatHeaderMenu = !!targetEl?.closest('.chat-list-menu-anchor');
      if (!insideChatHeaderMenu) {
        this.showChatListHeaderMenu = false;
      }
    }

    if (this.openChatPinMenuChatId !== null) {
      const insideChatPinMenu = !!targetEl?.closest('.chat-pin-anchor');
      if (!insideChatPinMenu) {
        this.openChatPinMenuChatId = null;
      }
    }

    if (this.openIncomingReactionPickerMessageId !== null) {
      const insideReactionUi = !!targetEl?.closest('.msg-reaction-box');
      if (!insideReactionUi) {
        this.openIncomingReactionPickerMessageId = null;
      }
    }
    if (this.openReactionDetailsMessageId !== null) {
      const insideReactionDetailUi = !!targetEl?.closest('.msg-reaction-indicator');
      if (!insideReactionDetailUi) {
        this.openReactionDetailsMessageId = null;
      }
    }

    if (this.showEmojiPicker) {
      const emojiAnchor = this.emojiAnchorRef?.nativeElement;
      if (!target || !emojiAnchor || !emojiAnchor.contains(target)) {
        this.closeEmojiPicker();
      }
    }

    if (this.showComposeActionsPopup) {
      const composeActionsAnchor = this.composeActionsAnchorRef?.nativeElement;
      if (
        !target ||
        !composeActionsAnchor ||
        !composeActionsAnchor.contains(target)
      ) {
        this.closeComposeActionsPopup();
      }
    }

    if (this.showComposeAiPopup) {
      const composeAiAnchor = this.composeAiAnchorRef?.nativeElement;
      if (!target || !composeAiAnchor || !composeAiAnchor.contains(target)) {
        this.closeComposeAiPopup();
      }
    }

    if (this.showTemporaryMessagePopup) {
      const temporaryAnchor = this.temporaryMessageAnchorRef?.nativeElement;
      if (!target || !temporaryAnchor || !temporaryAnchor.contains(target)) {
        this.closeTemporaryMessagePopup();
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

  public openChatsSidebarView(event?: MouseEvent): void {
    event?.stopPropagation();
    this.sidebarSection = 'CHATS';
    this.activeMainView = 'chat';
  }

  public openPublicChatsSidebarView(event?: MouseEvent): void {
    event?.stopPropagation();
    this.sidebarSection = 'PUBLIC';
    this.activeMainView = 'chat';
    this.showTopbarProfileMenu = false;
    this.showChatListHeaderMenu = false;
    this.openChatPinMenuChatId = null;
    this.openMensajeMenuId = null;
    this.showPinnedActionsMenu = false;
    this.showPinDurationPicker = false;
    this.showMuteDurationPicker = false;
    this.muteDurationTargetChat = null;
    this.pinTargetMessage = null;
    this.openIncomingReactionPickerMessageId = null;
    this.openReactionDetailsMessageId = null;
    this.mostrarMenuOpciones = false;
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker(true);
    this.closeTemporaryMessagePopup();
    this.closeGroupInfoPanel();
    this.closeUserInfoPanel();
    this.closeMessageSearchPanel();
    this.closePollVotesPanel();
    this.closeFilePreview();
    this.loadPublicChatsFromBackend();
  }

  public openStarredSidebarView(event?: MouseEvent): void {
    event?.stopPropagation();
    this.sidebarSection = 'STARRED';
    this.activeMainView = 'chat';
    this.loadStarredMessagesFromBackend(true, this.starredPage);
    this.showTopbarProfileMenu = false;
    this.showChatListHeaderMenu = false;
    this.openChatPinMenuChatId = null;
    this.openMensajeMenuId = null;
    this.showPinnedActionsMenu = false;
    this.showPinDurationPicker = false;
    this.showMuteDurationPicker = false;
    this.muteDurationTargetChat = null;
    this.pinTargetMessage = null;
    this.openIncomingReactionPickerMessageId = null;
    this.openReactionDetailsMessageId = null;
    this.mostrarMenuOpciones = false;
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker(true);
    this.closeTemporaryMessagePopup();
    this.closeGroupInfoPanel();
    this.closeUserInfoPanel();
    this.closeMessageSearchPanel();
    this.closePollVotesPanel();
    this.closeFilePreview();
  }

  public onPublicChatsSearch(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.publicChatsSearch = String(target?.value || '');
  }

  public entrarChatPublico(chat: PublicChatListItem, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.showToast(
      `Integracion pendiente para entrar a "${chat.nombre}".`,
      'info',
      'Chats publicos',
      2200
    );
  }

  private loadPublicChatsFromBackend(): void {
    if (this.publicChatsLoading) return;
    this.publicChatsLoading = true;
    this.chatService
      .listarTodosLosChats()
      .pipe(
        finalize(() => {
          this.publicChatsLoading = false;
        })
      )
      .subscribe({
        next: (items) => {
          const source = Array.isArray(items) ? items : [];
          this.publicChats = source
            .filter((chat: any) => this.isPublicGroupChat(chat))
            .map((chat: any) => this.mapPublicChatCard(chat));
        },
        error: () => {
          this.publicChats = [];
        },
      });
  }

  private isPublicGroupChat(chat: any): boolean {
    const isGroup =
      chat?.esGrupo === true ||
      chat?.grupo === true ||
      chat?.isGroup === true ||
      chat?.tipo === 'GRUPAL' ||
      chat?.tipoChat === 'GRUPAL' ||
      chat?.nombreGrupo != null;
    if (!isGroup) return false;

    return (
      chat?.publico === true ||
      chat?.esPublico === true ||
      chat?.isPublic === true ||
      chat?.chatPublico === true ||
      String(chat?.visibilidad || '').toUpperCase() === 'PUBLICO' ||
      String(chat?.visibility || '').toUpperCase() === 'PUBLIC'
    );
  }

  private mapPublicChatCard(chat: any): PublicChatListItem {
    const id = Number(chat?.id || 0);
    const nombre = String(
      chat?.nombreGrupo || chat?.nombre || `Grupo ${id}`
    ).trim() || `Grupo ${id}`;
    const descripcion =
      String(
        chat?.descripcion || chat?.descripcionGrupo || 'Grupo publico de la comunidad.'
      ).trim() || 'Grupo publico de la comunidad.';
    const miembrosRaw = Number(
      chat?.miembrosCount || chat?.miembros?.length || chat?.usuarios?.length || 0
    );
    const miembros = Number.isFinite(miembrosRaw) && miembrosRaw > 0 ? miembrosRaw : 0;
    const initials =
      nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'GP';

    return {
      id,
      nombre,
      descripcion,
      miembros,
      badge: 'Publico',
      initials,
      gradient: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
      badgeColor: '#1d4ed8',
    };
  }

  public nextStarredPage(): void {
    if (this.loadingStarredMessages || !this.starredHasNext) return;
    this.loadStarredMessagesFromBackend(true, this.starredPage + 1);
  }

  public prevStarredPage(): void {
    if (this.loadingStarredMessages || !this.starredHasPrevious) return;
    this.loadStarredMessagesFromBackend(true, this.starredPage - 1);
  }

  public openProfileView(event?: MouseEvent): void {
    event?.stopPropagation();
    this.sidebarSection = 'CHATS';
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
      this.authService
        .solicitarCodigoCambioPasswordPerfil(
          String(payload.passwordActual || ''),
          String(payload.nuevaPassword || '')
        )
        .subscribe({
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
      dni: payload.dni || '',
      telefono: payload.telefono || '',
      fechaNacimiento: payload.fechaNacimiento || '',
      genero: payload.genero || '',
      direccion: payload.direccion || '',
      nacionalidad: payload.nacionalidad || '',
      ocupacion: payload.ocupacion || '',
      instagram: payload.instagram || '',
    };
    const emailActual = (this.perfilUsuario?.email || '').trim();
    const emailNuevo = (payload.email || '').trim();
    if (emailNuevo && emailNuevo !== emailActual) {
      Swal.fire(
        'Aviso',
        'El endpoint actual de perfil no permite actualizar el email. Se guardarán nombre, apellidos, foto e información adicional.',
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
    const perfil = (this.perfilUsuario || {}) as UsuarioDTO;
    const nombreActual = (this.perfilUsuario?.nombre || '').trim();
    const apellidoActual = (this.perfilUsuario?.apellido || '').trim();
    const fotoActual = (this.usuarioFotoUrl || this.perfilUsuario?.foto || '').trim();
    const dniActual = String(perfil?.dni || perfil?.documento || '').trim();
    const telefonoActual = String(perfil?.telefono || perfil?.phone || '').trim();
    const fechaNacimientoActual = String(
      perfil?.fechaNacimiento || perfil?.fecha_nacimiento || perfil?.birthDate || ''
    ).trim();
    const generoActual = String(perfil?.genero || perfil?.gender || '').trim();
    const direccionActual = String(perfil?.direccion || perfil?.address || '').trim();
    const nacionalidadActual = String(perfil?.nacionalidad || perfil?.nationality || '').trim();
    const ocupacionActual = String(perfil?.ocupacion || perfil?.profesion || '').trim();
    const instagramActual = String(perfil?.instagram || perfil?.instagramHandle || '').trim();

    return (
      (payload.nombre || '').trim() !== nombreActual ||
      (payload.apellido || '').trim() !== apellidoActual ||
      (payload.foto || '').trim() !== fotoActual ||
      (payload.dni || '').trim() !== dniActual ||
      (payload.telefono || '').trim() !== telefonoActual ||
      (payload.fechaNacimiento || '').trim() !== fechaNacimientoActual ||
      (payload.genero || '').trim() !== generoActual ||
      (payload.direccion || '').trim() !== direccionActual ||
      (payload.nacionalidad || '').trim() !== nacionalidadActual ||
      (payload.ocupacion || '').trim() !== ocupacionActual ||
      (payload.instagram || '').trim() !== instagramActual
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
    this.persistActiveChatDraft();
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
      this.notificationService.markAllSeen().subscribe({
        next: () => {
          this.unseenCount = 0;
        },
        error: (e) => {
          const status = Number(e?.status || 0);
          const backendMsg = String(e?.error?.mensaje || '').trim();
          this.showToast(
            backendMsg ||
              (status === 403
                ? 'No tienes permisos para actualizar notificaciones.'
                : 'No se pudieron marcar las notificaciones como vistas.'),
            'warning',
            'Notificaciones'
          );
        },
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
          this.addHandledInviteId(inviteId); // ?? marca tratada
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
          this.addHandledInviteId(inviteId); // ?? marca tratada
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

  public shouldShowDraftPreview(chat: any): boolean {
    if (!chat) return false;
    if (Number(chat?.unreadCount || 0) > 0) return false;
    const chatId = Number(chat?.id);
    if (Number.isFinite(chatId) && chatId > 0) {
      const activeChatId = Number(this.chatSeleccionadoId);
      if (
        Number.isFinite(activeChatId) &&
        activeChatId > 0 &&
        activeChatId === chatId
      ) {
        return false;
      }
    }
    return !!this.chatDraftPreviewText(chat);
  }

  public chatDraftPreviewText(chat: any): string {
    const chatId = Number(chat?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return '';
    const raw =
      String(chat?.draftMensaje || '').trim() || this.getStoredDraftForChat(chatId);
    return raw.replace(/\s+/g, ' ').trim();
  }

  public shouldShowComposerDraftPrefix(): boolean {
    if (!this.composerDraftPrefixVisible) return false;
    if (this.haSalidoDelGrupo || this.chatEstaBloqueado) return false;
    return !!String(this.mensajeNuevo || '').trim();
  }

  public onComposerInput(event?: Event): void {
    this.composerDraftPrefixVisible = false;
    this.limpiarRespuestasRapidas();
    if (!String(this.mensajeNuevo || '').trim()) {
      this.closeComposeAiPopup();
    }
    const textarea = event?.target as HTMLTextAreaElement | null;
    this.resizeComposerTextarea(textarea);
  }

  public ngDoCheck(): void {
    const currentValue = String(this.mensajeNuevo || '');
    if (currentValue === this.lastComposerTextareaValue) return;
    this.lastComposerTextareaValue = currentValue;
    this.scheduleComposerTextareaResize();
  }

  private parseLastPreviewRawPayload(raw: unknown): any | null {
    if (raw && typeof raw === 'object') return raw;
    let text = String(raw || '').trim();
    if (!text) return null;

    const extracted = this.extractPayloadCandidateFromPreview(text);
    if (typeof extracted === 'object' && extracted != null) return extracted;
    if (typeof extracted === 'string') {
      text = extracted.trim();
    }

    for (let i = 0; i < 3; i += 1) {
      if (!text) return null;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') return parsed;
        if (typeof parsed === 'string') {
          text = parsed.trim();
          continue;
        }
        return null;
      } catch {
        const quoted =
          (text.startsWith('"') && text.endsWith('"')) ||
          (text.startsWith("'") && text.endsWith("'"));
        if (quoted) {
          text = text.slice(1, -1).trim();
          continue;
        }
        if (text.includes('\\"')) {
          const unescaped = text
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim();
          if (unescaped !== text) {
            text = unescaped;
            continue;
          }
        }
      }
      break;
    }

    return null;
  }

  private rewriteOwnGroupExpulsionPreviewIfNeeded(
    chat: any,
    normalizedPreview: string
  ): string {
    if (!chat?.esGrupo) return normalizedPreview;
    const previewText = String(normalizedPreview || '').trim();
    if (!previewText) return previewText;

    const bodyWithoutOwnPrefix = previewText.replace(/^yo:\s*/i, '').trim();
    if (!/^has sido expulsad[oa]\b/i.test(bodyWithoutOwnPrefix)) {
      return previewText;
    }

    const myId = Number(this.usuarioActualId);
    const senderId = this.getChatLastPreviewSenderId(chat);
    const isOwnPreview =
      /^yo:\s*/i.test(previewText) ||
      (Number.isFinite(senderId) && senderId > 0 && senderId === myId);
    if (!isOwnPreview) return previewText;

    const rawPayload = this.parseLastPreviewRawPayload(
      chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw
    );
    const messageLike =
      rawPayload && typeof rawPayload === 'object'
        ? {
            ...rawPayload,
            contenido: String(
              (rawPayload as any)?.contenido ?? chat?.ultimaMensaje ?? ''
            ).trim(),
            emisorId: Number(
              (rawPayload as any)?.emisorId ?? senderId ?? 0
            ),
            chatId: Number((rawPayload as any)?.chatId ?? chat?.id ?? 0),
            tipo: String(
              (rawPayload as any)?.tipo ??
                chat?.ultimaMensajeTipo ??
                chat?.__ultimaTipo ??
                'SYSTEM'
            ).trim(),
          }
        : {
            contenido: String(chat?.ultimaMensaje ?? '').trim(),
            emisorId: Number(senderId || 0),
            chatId: Number(chat?.id || 0),
            tipo: String(chat?.ultimaMensajeTipo ?? chat?.__ultimaTipo ?? 'SYSTEM').trim(),
          };

    const rebuilt = buildGroupExpulsionPreview(messageLike, chat, myId);
    if (rebuilt && !/^has sido expulsad[oa]\b/i.test(String(rebuilt).trim())) {
      return rebuilt;
    }

    const groupName = String(
      this.resolveGroupNameById(Number(chat?.id || 0)) ||
        chat?.nombreGrupo ||
        chat?.nombre ||
        ''
    ).trim();
    return groupName
      ? `Has expulsado a un usuario del grupo ${groupName}`
      : 'Has expulsado a un usuario del grupo';
  }

  private resolveChatContextForMessage(chatIdRaw: unknown): any | undefined {
    const chatId = Number(chatIdRaw || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      return this.chatActual || undefined;
    }
    if (
      this.chatActual &&
      Number(this.chatActual?.id) === chatId
    ) {
      return this.chatActual;
    }
    return (this.chats || []).find((c: any) => Number(c?.id) === chatId);
  }

  public formatSystemMessageContent(mensaje: any): string {
    if (!mensaje) return 'Evento del grupo';
    const rawContent = String(mensaje?.contenido ?? '').trim();
    const parsedPayload = this.parseLastPreviewRawPayload(mensaje?.contenido);
    const mergedMessage =
      parsedPayload && typeof parsedPayload === 'object'
        ? {
            ...(parsedPayload as any),
            ...mensaje,
            contenido: String(
              (parsedPayload as any)?.contenido ?? rawContent
            ).trim(),
            systemEvent: String(
              (mensaje as any)?.systemEvent ??
                (parsedPayload as any)?.systemEvent ??
                (parsedPayload as any)?.evento ??
                ''
            ).trim(),
            chatId: Number(
              (mensaje as any)?.chatId ??
                (parsedPayload as any)?.chatId ??
                this.chatActual?.id ??
                0
            ),
          }
        : mensaje;

    const chatContext = this.resolveChatContextForMessage(mergedMessage?.chatId);
    const expulsionText = buildGroupExpulsionPreview(
      mergedMessage,
      chatContext,
      Number(this.usuarioActualId)
    );
    if (expulsionText) return expulsionText;

    if (parsedPayload && typeof parsedPayload === 'object') {
      const preferred = [
        (parsedPayload as any)?.texto,
        (parsedPayload as any)?.mensaje,
        (parsedPayload as any)?.message,
        (parsedPayload as any)?.descripcion,
        (parsedPayload as any)?.description,
      ]
        .map((x) => String(x || '').trim())
        .find((x) => !!x);
      if (preferred) return preferred;

      const payloadContent = String((parsedPayload as any)?.contenido || '').trim();
      if (payloadContent && !/^[A-Z0-9_]+$/.test(payloadContent)) {
        return payloadContent;
      }
    }

    if (rawContent && !/^[A-Z0-9_]+$/.test(rawContent)) return rawContent;
    return 'Evento del grupo';
  }

  private escapeSystemMessageHtml(text: string): string {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private emphasizeQuotedSegments(text: string): string {
    const source = String(text || '').trim();
    if (!source) return '';
    const regex = /"([^"]+)"|“([^”]+)”/g;
    let html = '';
    let lastIndex = 0;
    let matched = false;
    let match: RegExpExecArray | null = null;

    while ((match = regex.exec(source)) !== null) {
      matched = true;
      html += this.escapeSystemMessageHtml(source.slice(lastIndex, match.index));
      const emphasized = String(match[1] || match[2] || '').trim();
      html += `<strong style="font-weight: 600;">${this.escapeSystemMessageHtml(emphasized)}</strong>`;
      lastIndex = regex.lastIndex;
    }
    html += this.escapeSystemMessageHtml(source.slice(lastIndex));
    return matched ? html : this.escapeSystemMessageHtml(source);
  }

  private extractExpulsionTargetUserIdFromSource(source: any): number {
    const fields = [
      'targetUserId',
      'targetId',
      'usuarioObjetivoId',
      'miembroId',
      'memberId',
      'removedUserId',
      'removedMemberId',
      'expulsadoId',
      'kickedUserId',
      'affectedUserId',
      'userIdObjetivo',
    ];
    for (const key of fields) {
      const value = Number(source?.[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  private resolveExpulsionPerspectiveTextForCurrentUser(source: any): string {
    if (!source || typeof source !== 'object') return '';
    const eventCode = String(source?.systemEvent || source?.evento || '')
      .trim()
      .toUpperCase();
    const hasExpulsionText =
      !!String(source?.textoActor || '').trim() ||
      !!String(source?.textoExpulsado || '').trim() ||
      !!String(source?.textoTerceros || '').trim();
    const expulsionEvents = new Set([
      'GROUP_MEMBER_EXPELLED',
      'GROUP_MEMBER_KICKED',
      'GROUP_USER_EXPELLED',
      'GROUP_USER_KICKED',
      'GROUP_MEMBER_REMOVED',
      'GROUP_USER_REMOVED',
    ]);
    const isExpulsionEvent =
      expulsionEvents.has(eventCode) ||
      (/^GROUP_/.test(eventCode) &&
        /(EXPELLED|KICKED|REMOVED)/.test(eventCode));
    if (!isExpulsionEvent && !hasExpulsionText) return '';

    const myId = Number(this.usuarioActualId);
    const actorId = Number(source?.emisorId || 0);
    const targetId = this.extractExpulsionTargetUserIdFromSource(source);

    if (targetId > 0 && targetId === myId) {
      return String(source?.textoExpulsado || '').trim();
    }
    if (actorId > 0 && actorId === myId) {
      return String(source?.textoActor || '').trim();
    }
    return String(source?.textoTerceros || '').trim();
  }

  private buildExpulsionSourceFromPreviewChat(chat: any): any | null {
    const rawPayload = this.parseLastPreviewRawPayload(
      chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw ?? chat?.ultimaMensaje
    );
    if (!rawPayload || typeof rawPayload !== 'object') return null;
    return {
      ...(rawPayload as any),
      emisorId: Number(
        (rawPayload as any)?.emisorId ??
          this.getChatLastPreviewSenderId(chat) ??
          chat?.ultimaMensajeEmisorId ??
          0
      ),
      chatId: Number((rawPayload as any)?.chatId ?? chat?.id ?? 0),
      systemEvent: String(
        (rawPayload as any)?.systemEvent ?? (rawPayload as any)?.evento ?? ''
      ).trim(),
    };
  }

  public formatSystemMessageContentHtml(mensaje: any): string {
    const parsedPayload = this.parseLastPreviewRawPayload(mensaje?.contenido);
    const source =
      parsedPayload && typeof parsedPayload === 'object'
        ? { ...(parsedPayload as any), ...(mensaje || {}) }
        : mensaje;
    const perspectiveText = this.resolveExpulsionPerspectiveTextForCurrentUser(source);
    if (perspectiveText) return this.emphasizeQuotedSegments(perspectiveText);

    const plain = this.formatSystemMessageContent(mensaje);
    return this.emphasizeQuotedSegments(plain);
  }

  public formatearPreviewHtml(chat: any): string {
    const source = this.buildExpulsionSourceFromPreviewChat(chat);
    const perspectiveText = this.resolveExpulsionPerspectiveTextForCurrentUser(source);
    if (perspectiveText) {
      return this.emphasizeQuotedSegments(this.truncateChatPreviewText(perspectiveText, 90));
    }
    return this.escapeSystemMessageHtml(
      this.truncateChatPreviewText(this.formatearPreview(chat), 90)
    );
  }

  private truncateChatPreviewText(text: string, maxLength: number = 90): string {
    const value = String(text || '').trim();
    if (!value) return '';
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).trimEnd()}...`;
  }

  public formatearPreview(chat: any): string {
    if (chat?.esGrupo && this.containsEncryptedHiddenPlaceholder(chat?.ultimaMensaje)) {
      return this.GROUP_HISTORY_UNAVAILABLE_TEXT;
    }
    if (this.isPollPreviewChat(chat)) {
      const senderLabel = this.pollPreviewSenderLabel(chat);
      const question = this.pollPreviewQuestion(chat);
      return senderLabel ? `${senderLabel}: Encuesta: ${question}` : `Encuesta: ${question}`;
    }
    const normalized = this.normalizeOwnPreviewPrefix(
      chat?.ultimaMensaje || '',
      chat
    );
    return formatPreviewText(
      this.rewriteOwnGroupExpulsionPreviewIfNeeded(chat, normalized)
    );
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
      tipo === 'SYSTEM' ||
      tipo === 'POLL'
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
    if (payloadType === 'E2E_FILE' || payloadType === 'E2E_GROUP_FILE') {
      return 'FILE';
    }
    if (payloadType === 'E2E' || payloadType === 'E2E_GROUP') {
      return 'TEXT';
    }
    if (payloadType === 'POLL_V1') {
      return 'POLL';
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
    chat.__ultimoAdminMessage = !!this.isTruthyFlag(
      mensaje?.adminMessage ?? mensaje?.admin_message
    );
    if (!!chat && !chat?.esGrupo && chat.__ultimoAdminMessage === true) {
      this.markAdminDirectChatReadOnly(chat?.id ?? mensaje?.chatId);
      chat.__adminDirectReadOnly = true;
    }
    chat.__ultimoTemporalEnabled = !!this.isTruthyFlag(
      mensaje?.mensajeTemporal ??
        mensaje?.mensaje_temporal ??
        mensaje?.temporal ??
        mensaje?.isTemporal
    );
    chat.__ultimoTemporalStatus =
      String(mensaje?.estadoTemporal ?? mensaje?.estado_temporal ?? '').trim() || null;
    chat.__ultimoTemporalExpired = !!this.isTruthyFlag(mensaje?.expiredByPolicy);
    chat.__ultimoTemporalExpiresAt =
      String(mensaje?.expiraEn ?? mensaje?.expiresAt ?? '').trim() || null;
    chat.__ultimoEmisorNombre =
      String(mensaje?.emisorNombre ?? mensaje?.senderName ?? '').trim() || null;

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
      chat.ultimaMensajeFileUrl = null;
      chat.ultimaMensajeFileMime = null;
      chat.ultimaMensajeFileNombre = null;
      chat.ultimaMensajeFileSizeBytes = null;
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
      chat.ultimaMensajeFileUrl = null;
      chat.ultimaMensajeFileMime = null;
      chat.ultimaMensajeFileNombre = null;
      chat.ultimaMensajeFileSizeBytes = null;
      return;
    }

    if (tipo === 'FILE') {
      chat.ultimaMensajeFileUrl = String(mensaje?.fileUrl || '').trim() || null;
      chat.ultimaMensajeFileMime = String(mensaje?.fileMime || '').trim() || null;
      chat.ultimaMensajeFileNombre =
        String(mensaje?.fileNombre || '').trim() || null;
      const fileSize = Number(mensaje?.fileSizeBytes);
      chat.ultimaMensajeFileSizeBytes =
        Number.isFinite(fileSize) && fileSize >= 0 ? Math.round(fileSize) : null;
      chat.ultimaMensajeAudioUrl = null;
      chat.ultimaMensajeAudioMime = null;
      chat.ultimaMensajeAudioDuracionMs = null;
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
    chat.ultimaMensajeFileUrl = null;
    chat.ultimaMensajeFileMime = null;
    chat.ultimaMensajeFileNombre = null;
    chat.ultimaMensajeFileSizeBytes = null;
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

  public isFilePreviewChat(chat: any): boolean {
    const lastTipo =
      this.normalizeLastMessageTipo(chat?.ultimaMensajeTipo ?? chat?.__ultimaTipo) ||
      this.inferLastMessageTipoFromRaw(
        chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw
      );
    if (lastTipo === 'FILE') return true;
    if (chat?.__ultimaEsArchivo === true) return true;
    return this.isFilePreviewText(chat?.ultimaMensaje, chat);
  }

  public filePreviewSenderLabel(chat: any): string {
    const senderId = this.getChatLastPreviewSenderId(chat);
    if (senderId && senderId === Number(this.usuarioActualId)) return 'Tú';
    if (!chat?.esGrupo) return '';
    return this.imagePreviewSenderLabel(chat);
  }

  public chatFilePreviewName(chat: any): string {
    const explicit = String(
      chat?.__ultimaArchivoNombre ||
        chat?.ultimaMensajeFileNombre ||
        chat?.lastMessageFileName ||
        ''
    ).trim();
    if (explicit) return explicit;

    const payload = this.parseFileE2EPayload(
      this.extractPayloadCandidateFromPreview(
        chat?.__ultimaMensajeRaw ?? chat?.ultimaMensajeRaw ?? chat?.ultimaMensaje ?? ''
      )
    );
    const byPayload = String(payload?.fileNombre || '').trim();
    if (byPayload) return byPayload;

    const fallback = String(chat?.ultimaMensaje || '').trim();
    const m = fallback.match(/archivo:\s*([^\-]+?)(?:\s*-\s*.*)?$/i);
    return String(m?.[1] || 'Archivo').trim() || 'Archivo';
  }

  public filePreviewCaption(chat: any): string {
    const explicit = String(chat?.__ultimaArchivoCaption || '').trim();
    if (explicit) return explicit;
    const normalized = this.normalizeOwnPreviewPrefix(
      String(chat?.ultimaMensaje || ''),
      chat
    );
    const formatted = formatPreviewText(normalized).trim();
    if (!formatted) return '';
    const body = formatted.replace(/^[^:]{1,80}:\s*/, '').trim();
    if (!body) return '';
    const withoutLabel = body.replace(/^archivo\s*:\s*[^-]+-\s*/i, '').trim();
    if (
      !withoutLabel ||
      withoutLabel === body ||
      /^archivo\s*:?\s*[^-]*$/i.test(body)
    ) {
      return '';
    }
    return withoutLabel;
  }

  public filePreviewIconClass(chat: any): string {
    const mime = String(
      chat?.__ultimaArchivoMime || chat?.ultimaMensajeFileMime || ''
    ).trim();
    return this.getFileIconClass(mime);
  }

  public isPollPreviewChat(chat: any): boolean {
    const pollRawCandidate =
      chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw ?? chat?.ultimaMensaje;
    const pollPayload = parsePollPayload(pollRawCandidate);
    if (pollPayload) return true;

    const pollType = this.normalizeLastMessageTipo(
      chat?.ultimaMensajeTipo ??
        chat?.__ultimaTipo ??
        this.inferLastMessageTipoFromRaw(String(pollRawCandidate || ''))
    );
    if (pollType === 'POLL') return true;

    return !!this.extractPollQuestionFromPreviewRaw(
      pollRawCandidate,
      chat?.ultimaMensaje
    );
  }

  public pollPreviewSenderLabel(chat: any): string {
    const senderId = Number(
      chat?.ultimaMensajeEmisorId ??
        chat?.ultimoMensajeEmisorId ??
        this.getChatLastPreviewSenderId(chat) ??
        0
    );
    const previewRaw = String(chat?.ultimaMensaje || '').trim();
    return this.resolvePollPreviewSenderLabel(chat, senderId, previewRaw);
  }

  public pollPreviewQuestion(chat: any): string {
    const pollRawCandidate =
      chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw ?? chat?.ultimaMensaje;
    const pollPayload = parsePollPayload(pollRawCandidate);
    const fallback = this.extractPollQuestionFromPreviewRaw(
      pollRawCandidate,
      chat?.ultimaMensaje
    );
    return String(pollPayload?.question || fallback || 'Encuesta').trim();
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
    this.closeUserInfoPanel();
    this.closeMessageSearchPanel();
    this.closePollVotesPanel();

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

  public onDirectChatHeaderKeydown(event: KeyboardEvent): void {
    if (!this.chatActual || this.chatActual?.esGrupo) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.toggleUserInfoPanel();
  }

  public toggleUserInfoPanel(event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.chatActual || this.chatActual?.esGrupo) return;
    if (this.showUserInfoPanel) {
      this.closeUserInfoPanel();
      return;
    }

    this.closeGroupInfoPanel();
    this.closeMessageSearchPanel();
    this.closePollVotesPanel();

    if (this.userInfoCloseTimer) {
      clearTimeout(this.userInfoCloseTimer);
      this.userInfoCloseTimer = null;
    }
    this.showUserInfoPanelMounted = true;
    setTimeout(() => {
      this.showUserInfoPanel = true;
    }, 10);
  }

  public closeUserInfoPanel(): void {
    this.showUserInfoPanel = false;
    if (this.userInfoCloseTimer) clearTimeout(this.userInfoCloseTimer);
    this.userInfoCloseTimer = setTimeout(() => {
      if (!this.showUserInfoPanel) {
        this.showUserInfoPanelMounted = false;
      }
      this.userInfoCloseTimer = null;
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
    this.closeUserInfoPanel();
    this.closePollVotesPanel();
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

  public openPollVotesPanel(mensaje: MensajeDTO, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!mensaje || !this.isPollMessage(mensaje)) return;

    const messageId = Number(mensaje?.id);
    if (!Number.isFinite(messageId) || messageId <= 0) return;

    if (this.showPollVotesPanel && this.pollVotesPanelMessageId === messageId) {
      this.closePollVotesPanel();
      return;
    }

    this.closeGroupInfoPanel();
    this.closeUserInfoPanel();
    this.closeMessageSearchPanel();
    if (this.pollVotesCloseTimer) {
      clearTimeout(this.pollVotesCloseTimer);
      this.pollVotesCloseTimer = null;
    }
    this.pollVotesPanelMessageId = messageId;
    this.showPollVotesPanelMounted = true;
    setTimeout(() => {
      this.showPollVotesPanel = true;
      this.cdr.markForCheck();
    }, 10);
  }

  public closePollVotesPanel(): void {
    this.showPollVotesPanel = false;
    if (this.pollVotesCloseTimer) clearTimeout(this.pollVotesCloseTimer);
    this.pollVotesCloseTimer = setTimeout(() => {
      if (!this.showPollVotesPanel) {
        this.showPollVotesPanelMounted = false;
        this.pollVotesPanelMessageId = null;
      }
      this.pollVotesCloseTimer = null;
    }, 230);
  }

  public get pollVotesPanelMessage(): MensajeDTO | null {
    const targetId = Number(this.pollVotesPanelMessageId);
    if (!Number.isFinite(targetId) || targetId <= 0) return null;
    const list = Array.isArray(this.mensajesSeleccionados)
      ? this.mensajesSeleccionados
      : [];
    return (
      list.find((item) => Number(item?.id) === targetId) || null
    );
  }

  public get pollVotesPanelData(): PollVotesPanelData | null {
    return this.buildPollVotesPanelData(this.pollVotesPanelMessage);
  }

  public async onMessageSearchResultSelect(messageId: number): Promise<void> {
    const targetId = Number(messageId);
    if (!Number.isFinite(targetId) || targetId <= 0) return;
    if (this.messageSearchNavigationInFlight) {
      const released = await this.waitForCondition(
        () => !this.messageSearchNavigationInFlight,
        12000
      );
      if (!released) return;
    }
    if (!this.chatActual) return;

    this.messageSearchNavigationInFlight = true;
    try {
      let loaded = await this.ensureMessageLoadedForSearchNavigation(targetId);
      if (!loaded && this.isPendingStarredNavigationTarget(targetId)) {
        loaded = await this.tryHydratePendingStarredNavigationMessage(targetId);
      }
      if (!loaded) {
        this.showToast(
          'No se encontro el mensaje dentro del historial disponible.',
          'warning',
          'Buscar'
        );
        return;
      }

      this.closeMessageSearchPanel();
      const focused = await this.focusMessageInViewport(
        targetId,
        this.isPendingStarredNavigationTarget(targetId)
      );
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
      error: (e) => console.error('? crear grupo:', e),
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
      error: (e) => console.error('? crear grupo:', e),
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

  public shouldShowDateSeparator(index: number): boolean {
    return shouldShowDateSeparatorForMessages(this.mensajesSeleccionados, index);
  }

  public getDateSeparatorLabel(m: MensajeDTO): string {
    return getDateSeparatorLabelForMessage(m);
  }

  public formatMensajeHora(m: MensajeDTO): string {
    return formatMensajeHoraFromMessage(m);
  }

  /**
   * Construye la URL correcta y accesible para que el navegador reproduzca un audio del servidor.
   */
  public getAudioSrc(m: MensajeDTO): string {
    const decrypted = String(m?.audioDataUrl || '').trim();
    if (decrypted) return decrypted;
    return '';
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
    return '';
  }

  public getImageAlt(m: MensajeDTO): string {
    const dtoName = String(m?.imageNombre || '').trim();
    if (dtoName) return dtoName;
    const meta = this.resolveImageMetaForRender(m);
    return meta.imageNombre || 'Imagen';
  }

  public isStickerMessage(m: MensajeDTO): boolean {
    const tipo = String(m?.tipo || '').trim().toUpperCase();
    const kind = String((m as any)?.contentKind || '').trim().toUpperCase();
    if (tipo === 'STICKER' || kind === 'STICKER') return true;
    const raw = String(m?.contenido || '').trim();
    if (!raw || raw[0] !== '{') return false;
    return raw.includes('"sticker":true') || raw.includes('"contentKind":"STICKER"');
  }

  private resolveImageMimeForPreview(m: MensajeDTO, imageSrcRaw: string): string {
    const meta = this.resolveImageMetaForRender(m);
    const explicitMime = String(m?.imageMime || meta.imageMime || '').trim();
    if (explicitMime) return explicitMime;

    const imageSrc = String(imageSrcRaw || '').trim();
    const dataUrlMime = imageSrc.match(/^data:([^;,]+)[;,]/i)?.[1];
    if (dataUrlMime) return String(dataUrlMime).trim().toLowerCase();

    const imageName = String(meta.imageNombre || m?.imageNombre || '').trim().toLowerCase();
    if (imageName.endsWith('.png')) return 'image/png';
    if (imageName.endsWith('.webp')) return 'image/webp';
    if (imageName.endsWith('.gif')) return 'image/gif';
    if (imageName.endsWith('.bmp')) return 'image/bmp';
    if (imageName.endsWith('.svg')) return 'image/svg+xml';
    return 'image/jpeg';
  }

  public openImagePreview(
    mensaje: MensajeDTO,
    imageSrcRaw: string,
    event?: Event
  ): void {
    event?.preventDefault();
    event?.stopPropagation();

    const imageSrc = String(imageSrcRaw || '').trim();
    if (!imageSrc) {
      const detail = String((mensaje as any)?.__attachmentLoadError || '').trim();
      this.showToast(
        detail || 'No se pudo abrir la previsualizacion de la imagen.',
        'warning',
        'Imagen'
      );
      return;
    }

    if (this.isStickerMessage(mensaje)) {
      this.incomingStickerPreviewSrc = imageSrc;
      this.incomingStickerSuggestedName = String(
        this.getImageAlt(mensaje) || 'sticker'
      )
        .replace(/\.[^.]+$/, '')
        .slice(0, 60);
      this.incomingStickerSourceId = this.resolveStickerSourceId(mensaje);
      this.incomingStickerOwnedLocalId = this.resolveOwnedStickerLocalId(
        imageSrc,
        this.incomingStickerSuggestedName
      );
      this.incomingStickerAlreadyOwned = false;
      this.incomingStickerOwnedChecking = true;
      this.showIncomingStickerSavePopup = true;
      if (!this.myStickers.length && !this.stickersLoading) {
        this.loadMyStickers();
      }
      if (
        Number.isFinite(Number(this.incomingStickerSourceId)) &&
        Number(this.incomingStickerSourceId) > 0
      ) {
        this.stickerService
          .isOwnedByMe(Number(this.incomingStickerSourceId))
          .subscribe({
            next: (owned) => {
              this.incomingStickerAlreadyOwned = owned === true;
              if (owned === true && !this.incomingStickerOwnedLocalId) {
                this.incomingStickerOwnedLocalId = this.resolveOwnedStickerLocalId(
                  imageSrc,
                  this.incomingStickerSuggestedName
                );
              }
              this.incomingStickerOwnedChecking = false;
            },
            error: () => {
              this.incomingStickerAlreadyOwned = this.isIncomingStickerAlreadyOwned(
                imageSrc,
                this.incomingStickerSuggestedName
              );
              if (this.incomingStickerAlreadyOwned && !this.incomingStickerOwnedLocalId) {
                this.incomingStickerOwnedLocalId = this.resolveOwnedStickerLocalId(
                  imageSrc,
                  this.incomingStickerSuggestedName
                );
              }
              this.incomingStickerOwnedChecking = false;
            },
          });
      } else {
        this.incomingStickerAlreadyOwned = this.isIncomingStickerAlreadyOwned(
          imageSrc,
          this.incomingStickerSuggestedName
        );
        if (this.incomingStickerAlreadyOwned && !this.incomingStickerOwnedLocalId) {
          this.incomingStickerOwnedLocalId = this.resolveOwnedStickerLocalId(
            imageSrc,
            this.incomingStickerSuggestedName
          );
        }
        this.incomingStickerOwnedChecking = false;
      }
      this.ensureStickerOwnershipStateWithLoadedCollection(
        imageSrc,
        this.incomingStickerSuggestedName
      );
      return;
    }

    this.showFilePreview = true;
    this.filePreviewSrc = imageSrc;
    this.filePreviewName = this.getImageAlt(mensaje);
    this.filePreviewSize = '';
    this.filePreviewType = 'Imagen';
    this.filePreviewMime = this.resolveImageMimeForPreview(mensaje, imageSrc);
  }

  public closeIncomingStickerSavePopup(): void {
    if (this.incomingStickerSaving) return;
    this.showIncomingStickerSavePopup = false;
    this.incomingStickerPreviewSrc = '';
    this.incomingStickerSuggestedName = '';
    this.incomingStickerOwnedChecking = false;
    this.incomingStickerAlreadyOwned = false;
    this.incomingStickerSourceId = null;
    this.incomingStickerOwnedLocalId = null;
  }

  public async saveIncomingStickerToMyCollection(): Promise<void> {
    if (this.incomingStickerSaving || this.stickerSaving) return;
    if (this.incomingStickerOwnedChecking) return;
    if (this.incomingStickerAlreadyOwned) return;
    const src = String(this.incomingStickerPreviewSrc || '').trim();
    if (!src) return;

    this.incomingStickerSaving = true;
    try {
      if (
        Number.isFinite(Number(this.incomingStickerSourceId)) &&
        Number(this.incomingStickerSourceId) > 0
      ) {
        const owned = await firstValueFrom(
          this.stickerService.isOwnedByMe(Number(this.incomingStickerSourceId))
        );
        if (owned === true) {
          this.incomingStickerAlreadyOwned = true;
          this.showToast('Este sticker ya lo tienes añadido.', 'info', 'Sticker');
          return;
        }
      }
      const response = await fetch(src);
      const blob = await response.blob();
      if (!blob || blob.size <= 0) {
        throw new Error('STICKER_EMPTY');
      }

      const mime = String(blob.type || 'image/png').trim().toLowerCase();
      const safeMime =
        mime === 'image/png' ||
        mime === 'image/webp' ||
        mime === 'image/jpeg' ||
        mime === 'image/jpg' ||
        mime === 'image/gif'
          ? mime
          : 'image/png';
      const ext =
        safeMime === 'image/webp'
          ? 'webp'
          : safeMime === 'image/png'
          ? 'png'
          : safeMime === 'image/gif'
          ? 'gif'
          : 'jpg';
      const baseName =
        String(this.incomingStickerSuggestedName || 'sticker').trim() ||
        'sticker';
      const file = new File([blob], `${baseName}.${ext}`, { type: safeMime });

      await firstValueFrom(this.stickerService.createSticker(file, baseName));
      this.showToast('Sticker añadido a tu colección.', 'success', 'Sticker');
      this.loadMyStickers();
      this.showIncomingStickerSavePopup = false;
      this.incomingStickerPreviewSrc = '';
      this.incomingStickerSuggestedName = '';
      this.incomingStickerOwnedChecking = false;
      this.incomingStickerAlreadyOwned = false;
      this.incomingStickerSourceId = null;
      this.incomingStickerOwnedLocalId = null;
    } catch {
      this.showToast('No se pudo añadir el sticker.', 'warning', 'Sticker');
    } finally {
      this.incomingStickerSaving = false;
    }
  }

  public deleteIncomingStickerFromMyCollection(): void {
    const localId = Number(this.incomingStickerOwnedLocalId || 0);
    if (!Number.isFinite(localId) || localId <= 0 || this.incomingStickerSaving) return;
    this.incomingStickerSaving = true;
    this.stickerService.deleteSticker(Math.round(localId)).pipe(
      finalize(() => {
        this.incomingStickerSaving = false;
      })
    ).subscribe({
      next: () => {
        this.myStickers = this.myStickers.filter((s) => Number(s?.id) !== Math.round(localId));
        this.incomingStickerAlreadyOwned = false;
        this.incomingStickerOwnedLocalId = null;
        this.showToast('Sticker eliminado.', 'info', 'Sticker', 1600);
      },
      error: () => {
        this.showToast('No se pudo eliminar el sticker.', 'warning', 'Sticker');
      }
    });
  }

  private resolveStickerSourceId(mensaje: MensajeDTO): number | null {
    const direct = Number((mensaje as any)?.stickerId);
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
    const raw = String(mensaje?.contenido || '').trim();
    if (!raw || raw[0] !== '{') return null;
    try {
      const parsed = JSON.parse(raw) as any;
      const nested = Number(parsed?.stickerId);
      if (Number.isFinite(nested) && nested > 0) return Math.round(nested);
    } catch {}
    return null;
  }

  private isIncomingStickerAlreadyOwned(srcRaw: string, suggestedNameRaw: string): boolean {
    const src = String(srcRaw || '').trim();
    const suggested = String(suggestedNameRaw || '')
      .trim()
      .replace(/\.[^.]+$/, '')
      .toLowerCase();
    const normalize = (value: string): string => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (raw.startsWith('data:')) return raw;
      if (raw.startsWith('blob:')) return '';
      try {
        const u = new URL(raw);
        return `${u.origin}${u.pathname}`.toLowerCase();
      } catch {
        return raw.split('?')[0].toLowerCase();
      }
    };
    const srcNormalized = normalize(src);

    return this.myStickers.some((item) => {
      const name = String(item?.nombre || '').trim().toLowerCase();
      const nameNoExt = name.replace(/\.[^.]+$/, '');
      const ownedUrl = this.resolveStickerImageUrl(item);
      const ownedNormalized = normalize(ownedUrl);
      if (srcNormalized && ownedNormalized && srcNormalized === ownedNormalized) return true;
      if (suggested && (name === suggested || nameNoExt === suggested)) return true;
      return false;
    });
  }

  private ensureStickerOwnershipStateWithLoadedCollection(
    imageSrc: string,
    suggestedName: string
  ): void {
    if (!this.myStickers.length) return;
    const owned = this.isIncomingStickerAlreadyOwned(imageSrc, suggestedName);
    if (owned) {
      this.incomingStickerAlreadyOwned = true;
      this.incomingStickerOwnedLocalId =
        this.resolveOwnedStickerLocalId(imageSrc, suggestedName) ?? this.incomingStickerOwnedLocalId;
    }
  }

  private resolveOwnedStickerLocalId(srcRaw: string, suggestedNameRaw: string): number | null {
    const src = String(srcRaw || '').trim().toLowerCase();
    const suggested = String(suggestedNameRaw || '')
      .trim()
      .replace(/\.[^.]+$/, '')
      .toLowerCase();
    const byName = this.myStickers.find((item) => {
      const n = String(item?.nombre || '').trim().toLowerCase();
      const nNoExt = n.replace(/\.[^.]+$/, '');
      return !!suggested && (n === suggested || nNoExt === suggested);
    });
    if (Number(byName?.id) > 0) return Number(byName?.id);

    if (src && !src.startsWith('blob:')) {
      const byUrl = this.myStickers.find((item) => {
        const u = String(this.resolveStickerImageUrl(item) || '').trim().toLowerCase();
        return !!u && (u === src || u.split('?')[0] === src.split('?')[0]);
      });
      if (Number(byUrl?.id) > 0) return Number(byUrl?.id);
    }
    return null;
  }

  private resolveFileMetaForRender(m: MensajeDTO): {
    fileUrl: string;
    fileMime: string;
    fileNombre: string;
    fileSizeBytes: number;
    isE2EFromContenido: boolean;
  } {
    const dtoFileUrl = String(m?.fileUrl || '').trim();
    const dtoFileMime = String(m?.fileMime || '').trim();
    const dtoFileNombre = String(m?.fileNombre || '').trim();
    const dtoFileSize = Number(m?.fileSizeBytes || 0);
    if (dtoFileUrl || dtoFileMime || dtoFileNombre || dtoFileSize > 0) {
      return {
        fileUrl: dtoFileUrl,
        fileMime: dtoFileMime,
        fileNombre: dtoFileNombre,
        fileSizeBytes:
          Number.isFinite(dtoFileSize) && dtoFileSize >= 0 ? dtoFileSize : 0,
        isE2EFromContenido: false,
      };
    }

    const payload = this.parseFileE2EPayload(m?.contenido);
    if (!payload) {
      return {
        fileUrl: '',
        fileMime: '',
        fileNombre: '',
        fileSizeBytes: 0,
        isE2EFromContenido: false,
      };
    }

    return {
      fileUrl: String(payload.fileUrl || '').trim(),
      fileMime: String(payload.fileMime || '').trim(),
      fileNombre: String(payload.fileNombre || '').trim(),
      fileSizeBytes:
        Number.isFinite(Number(payload.fileSizeBytes)) &&
        Number(payload.fileSizeBytes) >= 0
          ? Number(payload.fileSizeBytes)
          : 0,
      isE2EFromContenido: true,
    };
  }

  public getFileSrc(m: MensajeDTO): string {
    const decrypted = String(m?.fileDataUrl || '').trim();
    if (decrypted) return decrypted;
    return '';
  }

  public getFileName(m: MensajeDTO): string {
    const dtoName = String(m?.fileNombre || '').trim();
    if (dtoName) return dtoName;
    const meta = this.resolveFileMetaForRender(m);
    return meta.fileNombre || 'Archivo';
  }

  public getFileSizeLabel(m: MensajeDTO): string {
    const explicitSize = Number(m?.fileSizeBytes || 0);
    if (Number.isFinite(explicitSize) && explicitSize > 0) {
      return this.formatAttachmentSize(explicitSize);
    }
    const meta = this.resolveFileMetaForRender(m);
    if (Number.isFinite(meta.fileSizeBytes) && meta.fileSizeBytes > 0) {
      return this.formatAttachmentSize(meta.fileSizeBytes);
    }
    return '';
  }

  public getFileCaption(m: MensajeDTO): string {
    const caption = String(m?.contenido || '').trim();
    if (!caption || caption.startsWith('{')) return '';
    return caption;
  }

  public getFileTypeLabel(m: MensajeDTO): string {
    const meta = this.resolveFileMetaForRender(m);
    const mime = String(m?.fileMime || meta.fileMime || '').trim().toLowerCase();
    const fileName = this.getFileName(m);

    if (mime === 'application/pdf') return 'Documento PDF';
    if (mime.startsWith('text/')) return 'Archivo de texto';
    if (
      mime.includes('msword') ||
      mime.includes('wordprocessingml') ||
      mime.includes('officedocument.wordprocessingml')
    ) {
      return 'Documento Word';
    }
    if (
      mime.includes('spreadsheetml') ||
      mime.includes('excel') ||
      mime.includes('csv')
    ) {
      return 'Hoja de cálculo';
    }
    if (mime.includes('presentation') || mime.includes('powerpoint')) {
      return 'Presentación';
    }
    if (
      mime.includes('zip') ||
      mime.includes('rar') ||
      mime.includes('7z') ||
      mime.includes('tar')
    ) {
      return 'Archivo comprimido';
    }
    if (mime.startsWith('audio/')) return 'Audio';
    if (mime.startsWith('video/')) return 'Video';
    if (mime.startsWith('image/')) return 'Imagen';

    const ext = String(fileName.split('.').pop() || '').trim().toLowerCase();
    if (ext === 'txt' || ext === 'md' || ext === 'log') return 'Archivo de texto';
    if (ext === 'pdf') return 'Documento PDF';
    if (ext === 'doc' || ext === 'docx') return 'Documento Word';
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'Hoja de cálculo';
    if (ext === 'ppt' || ext === 'pptx') return 'Presentación';
    if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar') {
      return 'Archivo comprimido';
    }
    return 'Archivo';
  }

  public getFileIconClass(mimeRaw: unknown): string {
    const mime = String(mimeRaw || '').trim().toLowerCase();
    if (!mime) return 'bi-file-earmark';
    if (mime.includes('pdf')) return 'bi-file-earmark-pdf';
    if (
      mime.includes('msword') ||
      mime.includes('wordprocessingml') ||
      mime.includes('officedocument.wordprocessingml')
    ) {
      return 'bi-file-earmark-word';
    }
    if (
      mime.includes('spreadsheetml') ||
      mime.includes('excel') ||
      mime.includes('csv')
    ) {
      return 'bi-file-earmark-excel';
    }
    if (mime.includes('presentation') || mime.includes('powerpoint')) {
      return 'bi-file-earmark-ppt';
    }
    if (
      mime.includes('zip') ||
      mime.includes('rar') ||
      mime.includes('7z') ||
      mime.includes('tar')
    ) {
      return 'bi-file-earmark-zip';
    }
    if (mime.startsWith('audio/')) return 'bi-file-earmark-music';
    if (mime.startsWith('video/')) return 'bi-file-earmark-play';
    if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) {
      return 'bi-file-earmark-text';
    }
    return 'bi-file-earmark';
  }

  public openFilePreview(
    mensaje: MensajeDTO,
    fileSrcRaw: string,
    event?: MouseEvent
  ): void {
    event?.preventDefault();
    event?.stopPropagation();

    const fileSrc = String(fileSrcRaw || '').trim();
    if (!fileSrc) {
      const detail = String((mensaje as any)?.__attachmentLoadError || '').trim();
      this.showToast(
        detail || 'No se pudo abrir la previsualización.',
        'warning',
        'Archivo'
      );
      return;
    }

    const fileName = this.getFileName(mensaje);
    const meta = this.resolveFileMetaForRender(mensaje);
    const fileMime = String(mensaje?.fileMime || meta.fileMime || '').trim();
    this.showFilePreview = true;
    this.filePreviewSrc = fileSrc;
    this.filePreviewName = fileName;
    this.filePreviewSize = this.getFileSizeLabel(mensaje);
    this.filePreviewType = this.getFileTypeLabel(mensaje);
    this.filePreviewMime = fileMime;
  }

  public closeFilePreview(): void {
    this.showFilePreview = false;
    this.filePreviewSrc = '';
    this.filePreviewName = '';
    this.filePreviewSize = '';
    this.filePreviewType = '';
    this.filePreviewMime = '';
  }

  private parsePollPayloadForMessage(mensaje: MensajeDTO): ReturnType<typeof parsePollPayload> {
    if (!mensaje) return null;
    const rawContent =
      typeof mensaje?.contenido === 'string'
        ? String(mensaje.contenido)
        : JSON.stringify(mensaje?.contenido ?? '');
    const rawPoll =
      mensaje?.poll && typeof mensaje.poll === 'object'
        ? JSON.stringify(mensaje.poll)
        : '';
    const cacheKey = `${String(mensaje?.id ?? 'no-id')}|${rawContent}|${rawPoll}|${String(
      mensaje?.pollType || ''
    )}|${String(mensaje?.contentKind || '')}`;
    const cachedKey = String((mensaje as any)?.__pollPayloadCacheKey || '');
    if (cachedKey === cacheKey) {
      return ((mensaje as any)?.__pollPayloadCached ?? null) as ReturnType<
        typeof parsePollPayload
      >;
    }
    const parsed = parsePollPayload(mensaje);
    (mensaje as any).__pollPayloadCacheKey = cacheKey;
    (mensaje as any).__pollPayloadCached = parsed;
    return parsed;
  }

  private getPollMessageMapKey(mensaje: MensajeDTO): number | null {
    const id = Number(mensaje?.id);
    if (!Number.isFinite(id)) return null;
    return id;
  }

  private getPollBaseSelectedOptionIds(
    payload: NonNullable<ReturnType<typeof parsePollPayload>>
  ): Set<string> {
    const myId = Number(this.usuarioActualId);
    const selected = new Set<string>();
    for (const option of payload.options || []) {
      if (option?.votedByMe === true) {
        selected.add(String(option.id));
        continue;
      }
      if (
        Number.isFinite(myId) &&
        myId > 0 &&
        (option?.voterIds || []).includes(myId)
      ) {
        selected.add(String(option.id));
      }
    }
    return selected;
  }

  private getEffectivePollSelection(
    mensaje: MensajeDTO,
    payload: NonNullable<ReturnType<typeof parsePollPayload>>
  ): Set<string> {
    const key = this.getPollMessageMapKey(mensaje);
    if (key === null) return this.getPollBaseSelectedOptionIds(payload);
    const local = this.pollLocalSelectionByMessageId.get(key);
    if (local) return new Set(Array.from(local));
    return this.getPollBaseSelectedOptionIds(payload);
  }

  public isPollMessage(mensaje: MensajeDTO): boolean {
    if (!mensaje || mensaje.activo === false) return false;
    if (!isPollMessageLike(mensaje)) return false;
    return !!this.parsePollPayloadForMessage(mensaje);
  }

  public getPollQuestion(mensaje: MensajeDTO): string {
    const payload = this.parsePollPayloadForMessage(mensaje);
    return String(payload?.question || 'Encuesta');
  }

  public getPollStatusText(mensaje: MensajeDTO): string {
    const payload = this.parsePollPayloadForMessage(mensaje);
    if (!payload) return 'Selecciona una opción.';
    if (payload.statusText) return payload.statusText;
    return payload.allowMultiple
      ? 'Selecciona una o varias opciones.'
      : 'Selecciona una opción.';
  }

  public getPollOptionsForRender(mensaje: MensajeDTO): ChatPollOptionView[] {
    const payload = this.parsePollPayloadForMessage(mensaje);
    if (!payload) return [];

    const baseSelected = this.getPollBaseSelectedOptionIds(payload);
    const effectiveSelected = this.getEffectivePollSelection(mensaje, payload);

    const withCounts = (payload.options || []).map((option) => {
      const optionId = String(option.id || '');
      const votersFromDetails = Array.isArray(option.voters) ? option.voters.length : 0;
      const baseCount = Math.max(
        Number(option.voteCount || 0),
        Array.isArray(option.voterIds) ? option.voterIds.length : 0,
        votersFromDetails
      );
      const wasSelected = baseSelected.has(optionId);
      const isSelected = effectiveSelected.has(optionId);
      const delta = isSelected === wasSelected ? 0 : isSelected ? 1 : -1;
      const count = Math.max(0, baseCount + delta);
      return {
        id: optionId,
        text: String(option.text || '').trim(),
        count,
        selected: isSelected,
      };
    });

    const totalVotes = withCounts.reduce((acc, option) => acc + option.count, 0);
    const maxCount = withCounts.reduce(
      (max, option) => Math.max(max, option.count),
      0
    );

    return withCounts.map((option) => {
      const rawOption = payload.options.find((x) => String(x.id || '') === option.id);
      const voteEntries = this.resolvePollOptionVoteEntries(
        mensaje,
        rawOption,
        option.selected
      );
      return {
        voters: voteEntries.slice(0, 3).map((entry) => ({
          userId: entry.userId,
          photoUrl: entry.photoUrl,
          initials: entry.initials,
          votedAt: entry.votedAt,
        })),
        id: option.id,
        text: option.text,
        count: option.count,
        percent:
          totalVotes > 0
            ? Math.max(0, Math.min(100, (option.count / totalVotes) * 100))
            : 0,
        selected: option.selected,
        isLeading: option.count > 0 && option.count === maxCount,
      };
    });
  }

  private resolvePollPreviewSenderLabel(
    chat: any,
    senderIdRaw: number,
    previewRaw: string
  ): string {
    const senderId = Number(senderIdRaw);
    if (Number.isFinite(senderId) && senderId === Number(this.usuarioActualId)) {
      return 'yo';
    }

    const extractedSender = String(
      (/^([^:]{1,80}):\s*/.exec(String(previewRaw || '')) || [])[1] || ''
    ).trim();
    const extractedNormalized = extractedSender.toLowerCase();
    if (
      extractedSender &&
      !/^(yo|t[úu]|encuesta|\?\?)$/i.test(extractedNormalized)
    ) {
      return extractedSender;
    }

    if (!chat?.esGrupo) {
      const receptorNombre = String(chat?.receptor?.nombre || '').trim();
      const receptorApellido = String(chat?.receptor?.apellido || '').trim();
      const full = `${receptorNombre} ${receptorApellido}`.trim();
      if (full) return full;
      const alt = String(chat?.nombre || '').trim();
      if (alt) return alt;
    }

    if (Number.isFinite(senderId) && senderId > 0) {
      const member = Array.isArray(chat?.usuarios)
        ? chat.usuarios.find((u: any) => Number(u?.id) === senderId)
        : null;
      const memberName = `${member?.nombre || ''} ${member?.apellido || ''}`.trim();
      if (memberName) return memberName;
      const byChats = this.obtenerNombrePorId(senderId);
      if (byChats) return byChats;
    }
    return 'Alguien';
  }

  private collectPollOptionVoterIds(option: PollOptionPayload | undefined): number[] {
    const voterIdsFromList = Array.isArray(option?.voterIds)
      ? option.voterIds
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x) && x > 0)
      : [];
    const voterIdsFromDetails = Array.isArray(option?.voters)
      ? option.voters
          .map((voter) => Number(voter?.userId))
          .filter((x) => Number.isFinite(x) && x > 0)
      : [];
    return Array.from(new Set([...voterIdsFromList, ...voterIdsFromDetails]));
  }

  private getPollOptionEffectiveVoterIds(
    option: PollOptionPayload | undefined,
    isSelected: boolean
  ): number[] {
    const myId = Number(this.usuarioActualId);
    let effectiveVoterIds = [...this.collectPollOptionVoterIds(option)];

    if (Number.isFinite(myId) && myId > 0) {
      if (isSelected && !effectiveVoterIds.includes(myId)) {
        effectiveVoterIds = [myId, ...effectiveVoterIds];
      }
      if (!isSelected && effectiveVoterIds.includes(myId)) {
        effectiveVoterIds = effectiveVoterIds.filter((id) => id !== myId);
      }
      if (
        effectiveVoterIds.length === 0 &&
        option?.votedByMe === true &&
        isSelected
      ) {
        effectiveVoterIds = [myId];
      }
    }

    return effectiveVoterIds;
  }

  private resolvePollOptionVoteEntries(
    mensaje: MensajeDTO,
    option: PollOptionPayload | undefined,
    isSelected: boolean
  ): PollVoteEntryView[] {
    const effectiveVoterIds = this.getPollOptionEffectiveVoterIds(option, isSelected);
    if (!effectiveVoterIds.length) return [];

    const detailByUserId = new Map<number, PollOptionVoterPayload>();
    for (const detail of option?.voters || []) {
      const userId = Number(detail?.userId);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      const existing = detailByUserId.get(userId);
      if (!existing) {
        detailByUserId.set(userId, detail);
        continue;
      }
      const prevTs = Date.parse(String(existing?.votedAt || ''));
      const nextTs = Date.parse(String(detail?.votedAt || ''));
      const preferDetail =
        Number.isFinite(nextTs) && (!Number.isFinite(prevTs) || nextTs >= prevTs);
      detailByUserId.set(
        userId,
        preferDetail
          ? {
              ...existing,
              ...detail,
            }
          : {
              ...detail,
              ...existing,
            }
      );
    }

    return effectiveVoterIds.map((userId) => {
      const rawDetail = detailByUserId.get(userId);
      const isCurrentUser = Number(userId) === Number(this.usuarioActualId);
      const explicitName = String(rawDetail?.fullName || '').trim();
      const resolvedName = this.resolvePollVoterDisplayName(userId, mensaje);
      const fullName = explicitName || resolvedName;
      const label = isCurrentUser ? 'yo' : fullName;
      const rawPhotoUrl = String(rawDetail?.photoUrl || '').trim();
      const resolvedPhotoUrl = resolveMediaUrl(rawPhotoUrl, environment.backendBaseUrl);
      const photoUrl = resolvedPhotoUrl || this.resolveReactionUserPhoto(userId, mensaje);
      const votedAt = String(rawDetail?.votedAt || '').trim() || null;

      return {
        userId,
        label,
        fullName,
        photoUrl: photoUrl || null,
        initials: this.buildInitials(fullName),
        votedAt,
        votedAtLabel: this.formatPollVoteTime(votedAt),
        isCurrentUser,
      };
    });
  }

  private buildPollVotesPanelData(mensaje: MensajeDTO | null): PollVotesPanelData | null {
    if (!mensaje || !this.isPollMessage(mensaje)) return null;
    const payload = this.parsePollPayloadForMessage(mensaje);
    if (!payload) return null;

    const effectiveSelected = this.getEffectivePollSelection(mensaje, payload);
    const options: PollVotesPanelOption[] = (payload.options || []).map((option) => {
      const optionId = String(option.id || '');
      const voteEntries = this.resolvePollOptionVoteEntries(
        mensaje,
        option,
        effectiveSelected.has(optionId)
      );
      const count = Math.max(
        Number(option.voteCount || 0),
        Array.isArray(option.voterIds) ? option.voterIds.length : 0,
        voteEntries.length
      );
      return {
        id: optionId,
        text: String(option.text || '').trim() || 'Opción',
        count,
        voters: voteEntries as PollVotesPanelVoter[],
      };
    });

    const totalVotes = options.reduce((acc, option) => acc + option.count, 0);
    const payloadStatus = String(payload.statusText || '').trim();
    const statusText =
      payloadStatus ||
      (payload.allowMultiple
        ? 'Selecciona una o varias opciones.'
        : 'Selecciona una opción.');
    const messageId = Number(mensaje?.id);
    if (!Number.isFinite(messageId) || messageId <= 0) return null;

    return {
      messageId,
      question: String(payload.question || 'Encuesta').trim(),
      statusText,
      allowMultiple: payload.allowMultiple === true,
      totalVotes,
      options,
    };
  }

  private formatPollVoteTime(raw: string | null | undefined): string {
    const value = String(raw || '').trim();
    if (!value) return 'hora no disp.';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'hora no disp.';
    return parsed.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private resolvePollVoterDisplayName(userId: number, mensaje: MensajeDTO): string {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return 'Usuario';
    if (id === Number(this.usuarioActualId)) {
      const me = `${this.perfilUsuario?.nombre || ''} ${
        this.perfilUsuario?.apellido || ''
      }`.trim();
      if (me) return me;
    }
    return this.resolveReactionUserName(id, mensaje);
  }

  private extractPollQuestionFromPreviewRaw(...rawCandidates: unknown[]): string {
    for (const raw of rawCandidates) {
      const text = String(raw || '').trim();
      if (!text) continue;

      const encuestaLabel = text.match(/(?:^|:\s*)(?:\?\?\s*)?encuesta:\s*([^\n\r]+)/i);
      if (encuestaLabel?.[1]) {
        const q = String(encuestaLabel[1]).trim();
        if (q) return q;
      }

      const jsonQuestion = text.match(
        /"question"\s*:\s*"((?:[^"\\]|\\.)*)"/i
      );
      if (jsonQuestion?.[1]) {
        const decoded = this.safeDecodeJsonQuotedText(jsonQuestion[1]);
        const q = String(decoded || '').trim();
        if (q) return q;
      }

      const jsonQuestionEs = text.match(
        /"pregunta"\s*:\s*"((?:[^"\\]|\\.)*)"/i
      );
      if (jsonQuestionEs?.[1]) {
        const decoded = this.safeDecodeJsonQuotedText(jsonQuestionEs[1]);
        const q = String(decoded || '').trim();
        if (q) return q;
      }
    }
    return '';
  }

  private safeDecodeJsonQuotedText(value: string): string {
    const candidate = String(value || '');
    if (!candidate) return '';
    try {
      return JSON.parse(`"${candidate}"`);
    } catch {
      return candidate
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, ' ')
        .replace(/\\t/g, ' ');
    }
  }

  public trackPollOption(_index: number, option: ChatPollOptionView): string {
    return option.id;
  }

  public trackPollVoter(_index: number, voter: ChatPollVoterView): string {
    return `${voter.userId}-${voter.photoUrl || ''}-${voter.initials}`;
  }

  public async onPollOptionClick(
    mensaje: MensajeDTO,
    optionId: string,
    event?: MouseEvent
  ): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!mensaje || mensaje.activo === false) return;
    const payload = this.parsePollPayloadForMessage(mensaje);
    if (!payload) return;

    const optionExists = (payload.options || []).some(
      (option) => String(option.id) === String(optionId)
    );
    if (!optionExists) return;

    const key = this.getPollMessageMapKey(mensaje);
    if (key === null) return;

    const baseSelection = this.getPollBaseSelectedOptionIds(payload);
    const current =
      this.pollLocalSelectionByMessageId.get(key) ||
      new Set<string>(Array.from(baseSelection));
    const next = new Set<string>(Array.from(current));
    const normalizedOptionId = String(optionId);

    if (payload.allowMultiple) {
      if (next.has(normalizedOptionId)) next.delete(normalizedOptionId);
      else next.add(normalizedOptionId);
    } else {
      const onlyThisSelected = next.size === 1 && next.has(normalizedOptionId);
      if (onlyThisSelected) {
        next.clear();
      } else {
        next.clear();
        next.add(normalizedOptionId);
      }
    }

    this.pollLocalSelectionByMessageId.set(key, next);
    this.cdr.markForCheck();

    const votePayload = this.buildPollVotePayload(mensaje, payload, normalizedOptionId);
    if (!votePayload) return;

    let sentViaWs = false;
    const wsConnected = !!this.wsService.stompClient?.connected;
    if (wsConnected) {
      const wsResult = this.wsService.enviarVotoEncuesta(votePayload);
      sentViaWs = wsResult === 'sent';
      if (sentViaWs || wsResult === 'rate_limited') return;
    }

    try {
      const restPayload: PollVoteRestRequestDTO = {
        optionId: votePayload.optionId,
        chatId: votePayload.chatId,
        pollId: votePayload.pollId,
      };
      await firstValueFrom(
        this.chatService.votarEncuesta(votePayload.mensajeId, restPayload)
      );
    } catch (error: any) {
      this.pollLocalSelectionByMessageId.delete(key);
      this.cdr.markForCheck();
      const status = Number(error?.status || 0);
      const backendMsg = String(
        error?.error?.mensaje || error?.error?.message || ''
      ).trim();
      if (status === 403) {
        this.showToast(
          backendMsg || 'No tienes permisos para votar en esta encuesta.',
          'warning',
          'Encuesta'
        );
      } else if (status === 404) {
        this.showToast(
          backendMsg || 'La encuesta ya no está disponible.',
          'warning',
          'Encuesta'
        );
      } else {
        this.showToast(
          backendMsg || 'No se pudo registrar el voto.',
          'danger',
          'Encuesta'
        );
      }
    }
  }

  private buildPollVotePayload(
    mensaje: MensajeDTO,
    payload: NonNullable<ReturnType<typeof parsePollPayload>>,
    optionId: string
  ): PollVoteWSRequestDTO | null {
    const mensajeId = Number(mensaje?.id);
    const chatId = Number(mensaje?.chatId ?? this.chatActual?.id);
    if (!Number.isFinite(mensajeId) || mensajeId <= 0) return null;
    if (!Number.isFinite(chatId) || chatId <= 0) return null;

    const votePayload: PollVoteWSRequestDTO = {
      chatId,
      mensajeId,
      optionId: String(optionId),
    };

    const pollIdRaw =
      (payload as any)?.pollId ??
      (mensaje as any)?.pollId ??
      (mensaje as any)?.poll?.pollId ??
      (mensaje as any)?.poll?.id;
    const pollIdText = String(pollIdRaw ?? '').trim();
    if (pollIdText) {
      const pollIdNumber = Number(pollIdRaw);
      votePayload.pollId =
        Number.isFinite(pollIdNumber) && pollIdNumber > 0
          ? Math.round(pollIdNumber)
          : pollIdText;
    }
    return votePayload;
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

  private clearChatFilePreview(chat: any): void {
    if (!chat) return;
    chat.__ultimaEsArchivo = false;
    chat.__ultimaArchivoUrl = '';
    chat.__ultimaArchivoPayloadKey = '';
    chat.__ultimaArchivoDecryptOk = false;
    chat.__ultimaArchivoNombre = '';
    chat.__ultimaArchivoMime = '';
    chat.__ultimaArchivoCaption = '';
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

  private looksLikeE2EFilePayloadFragment(raw: unknown): boolean {
    const text = String(raw || '').trim();
    if (!text) return false;
    const hasTypeToken =
      /E2E_(GROUP_)?FILE/i.test(text) ||
      /"type"\s*:\s*"E2E_(GROUP_)?FILE"/i.test(text) ||
      /\\"type\\"\s*:\s*\\"E2E_(GROUP_)?FILE\\"/i.test(text);
    const hasJsonShape =
      text.startsWith('{') ||
      text.startsWith('"{') ||
      text.includes('{\\"') ||
      text.includes('"ivFile"') ||
      text.includes('\\"ivFile\\"');
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

  private isFilePreviewText(rawPreview: unknown, chat?: any): boolean {
    const normalized = this.normalizeOwnPreviewPrefix(
      String(rawPreview || ''),
      chat
    );
    const cleaned = formatPreviewText(normalized)
      .replace(/^[^:]{1,80}:\s*/, '')
      .trim()
      .toLowerCase();
    return (
      cleaned === 'archivo' ||
      cleaned.startsWith('archivo:') ||
      this.looksLikeE2EFilePayloadFragment(cleaned)
    );
  }

  private async syncChatItemLastPreviewMedia(
    chat: any,
    lastMessage?: Partial<MensajeDTO> | null,
    source = 'chat-preview'
  ): Promise<void> {
    if (!chat) return;

    const msg = lastMessage || null;
    const chatLastTipo =
      this.normalizeLastMessageTipo(chat?.ultimaMensajeTipo ?? chat?.__ultimaTipo) ||
      this.inferLastMessageTipoFromRaw(
        chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw
      );

    const isFileTipo = String(msg?.tipo || '').trim().toUpperCase() === 'FILE';
    const isFileByChatTipo = chatLastTipo === 'FILE';
    const msgEncryptedFile = !!(msg as any)?.__fileE2EEncrypted;
    const decryptedFileUrl = String(msg?.fileDataUrl || '').trim();
    const directMessageFileUrl = String(msg?.fileUrl || '').trim();
    const payloadFileFromMessage = this.parseFileE2EPayload(msg?.contenido);
    const payloadFileFromRaw = !msg
      ? this.parseFileE2EPayload(
          this.extractPayloadCandidateFromPreview(
            chat?.__ultimaMensajeRaw ?? chat?.ultimaMensajeRaw ?? ''
          )
        )
      : null;
    const payloadFileFromPreviewText = !msg && !payloadFileFromRaw
      ? this.parseFileE2EPayload(
          this.extractPayloadCandidateFromPreview(chat?.ultimaMensaje ?? '')
        )
      : null;
    const filePayload =
      payloadFileFromMessage || payloadFileFromRaw || payloadFileFromPreviewText;
    const fallbackChatFileUrl = String(
      chat?.ultimaMensajeFileUrl ||
        chat?.ultimaArchivoUrl ||
        chat?.lastMessageFileUrl ||
        chat?.lastFileUrl ||
        ''
    ).trim();
    const previewLooksFile = this.isFilePreviewText(chat?.ultimaMensaje, chat);
    const safeDirectFileUrl =
      msgEncryptedFile && !decryptedFileUrl ? '' : directMessageFileUrl;

    const isFile =
      isFileTipo ||
      isFileByChatTipo ||
      !!decryptedFileUrl ||
      !!safeDirectFileUrl ||
      !!fallbackChatFileUrl ||
      !!filePayload ||
      previewLooksFile;

    if (isFile) {
      chat.__ultimaEsArchivo = true;
      chat.__ultimaArchivoNombre = String(
        msg?.fileNombre ||
          filePayload?.fileNombre ||
          chat?.ultimaMensajeFileNombre ||
          chat?.lastMessageFileName ||
          ''
      ).trim();
      chat.__ultimaArchivoMime = String(
        msg?.fileMime ||
          filePayload?.fileMime ||
          chat?.ultimaMensajeFileMime ||
          chat?.lastMessageFileMime ||
          ''
      ).trim();
      chat.ultimaMensajeFileNombre = chat.__ultimaArchivoNombre || null;
      chat.ultimaMensajeFileMime = chat.__ultimaArchivoMime || null;
      chat.ultimaMensajeFileUrl =
        String(msg?.fileUrl || filePayload?.fileUrl || chat?.ultimaMensajeFileUrl || '')
          .trim() || null;
      const explicitSize = Number(
        msg?.fileSizeBytes ??
          filePayload?.fileSizeBytes ??
          chat?.ultimaMensajeFileSizeBytes ??
          0
      );
      chat.ultimaMensajeFileSizeBytes =
        Number.isFinite(explicitSize) && explicitSize >= 0
          ? Math.round(explicitSize)
          : null;

      const captionFromMessage = String(msg?.contenido || '').trim();
      if (captionFromMessage && !captionFromMessage.startsWith('{')) {
        chat.__ultimaArchivoCaption = captionFromMessage;
      }

      if (decryptedFileUrl) {
        chat.__ultimaArchivoUrl = decryptedFileUrl;
        chat.__ultimaArchivoDecryptOk = true;
        this.clearChatImagePreview(chat);
        return;
      }

      if (filePayload) {
        const payloadKey = this.buildFileE2ECacheKey(filePayload);
        if (
          chat.__ultimaArchivoPayloadKey === payloadKey &&
          String(chat.__ultimaArchivoUrl || '').trim()
        ) {
          chat.__ultimaArchivoDecryptOk = true;
          chat.__ultimaArchivoCaption =
            String(this.decryptedFileCaptionByCacheKey.get(payloadKey) || '').trim() ||
            chat.__ultimaArchivoCaption;
          this.clearChatImagePreview(chat);
          return;
        }

        const senderIdCandidate = Number(msg?.emisorId);
        const senderId =
          Number.isFinite(senderIdCandidate) && senderIdCandidate > 0
            ? senderIdCandidate
            : this.getChatLastPreviewSenderId(chat);
        const decrypted = await this.decryptFileE2EPayloadToObjectUrl(
          filePayload,
          senderId,
          {
            chatId: Number(chat?.id),
            mensajeId: Number(chat?.lastPreviewId ?? msg?.id),
            source,
          }
        );
        chat.__ultimaArchivoPayloadKey = payloadKey;
        chat.__ultimaArchivoUrl = String(decrypted.objectUrl || '').trim();
        chat.__ultimaArchivoDecryptOk = !!chat.__ultimaArchivoUrl;
        chat.__ultimaArchivoCaption =
          String(decrypted.caption || '').trim() || chat.__ultimaArchivoCaption;
        this.clearChatImagePreview(chat);
        return;
      }

      const plainUrl = safeDirectFileUrl || fallbackChatFileUrl;
      const plainFile = await this.resolveSecureAttachmentObjectUrl(
        'file',
        plainUrl,
        chat.__ultimaArchivoMime || 'application/octet-stream',
        {
          id: Number(chat?.lastPreviewId ?? msg?.id),
          chatId: Number(chat?.id),
        },
        {
          chatId: Number(chat?.id),
          mensajeId: Number(chat?.lastPreviewId ?? msg?.id),
          source,
        }
      );
      chat.__ultimaArchivoUrl = String(plainFile.objectUrl || '').trim();
      chat.__ultimaArchivoDecryptOk = !!chat.__ultimaArchivoUrl;
      this.clearChatImagePreview(chat);
      return;
    }

    this.clearChatFilePreview(chat);

    const isImageTipo = String(msg?.tipo || '').trim().toUpperCase() === 'IMAGE';
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
    const plainImage = await this.resolveSecureAttachmentObjectUrl(
      'image',
      plainUrl,
      chat?.ultimaMensajeImageMime || 'image/jpeg',
      {
        id: Number(chat?.lastPreviewId ?? msg?.id),
        chatId: Number(chat?.id),
      },
      {
        chatId: Number(chat?.id),
        mensajeId: Number(chat?.lastPreviewId ?? msg?.id),
        source,
      }
    );
    chat.__ultimaImagenUrl = String(plainImage.objectUrl || '').trim();
    chat.__ultimaImagenDecryptOk = !!chat.__ultimaImagenUrl;
  }

  public isImagePreviewChat(chat: any): boolean {
    const lastTipo =
      this.normalizeLastMessageTipo(chat?.ultimaMensajeTipo ?? chat?.__ultimaTipo) ||
      this.inferLastMessageTipoFromRaw(
        chat?.ultimaMensajeRaw ?? chat?.__ultimaMensajeRaw
      );
    if (lastTipo === 'IMAGE' || lastTipo === 'STICKER') return true;
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
      const detail = String((m as any)?.__attachmentLoadError || '').trim();
      this.showToast(
        detail || 'No se pudo cargar el audio para reproducirlo.',
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

  public get hasAnyChats(): boolean {
    return (this.chats?.length || 0) > 0;
  }

  public get chatFilterEmptyTitle(): string {
    switch (this.chatListFilter) {
      case 'NO_LEIDOS':
        return 'No hay chats no leídos';
      case 'FAVORITOS':
        return 'No hay chats favoritos';
      case 'GRUPOS':
        return 'No hay chats de grupo';
      case 'TODOS':
      default:
        return 'No hay chats para mostrar';
    }
  }

  public get chatFilterEmptyDescription(): string {
    switch (this.chatListFilter) {
      case 'NO_LEIDOS':
        return 'Cuando tengas mensajes pendientes, aparecerán aquí.';
      case 'FAVORITOS':
        return 'Fija chats para verlos rápidamente aquí.';
      case 'GRUPOS':
        return 'No perteneces a ningún grupo por ahora.';
      case 'TODOS':
      default:
        return 'No hay resultados con el filtro actual.';
    }
  }

  public get chatFilterEmptyIconClass(): string {
    switch (this.chatListFilter) {
      case 'NO_LEIDOS':
        return 'bi bi-check-circle-fill';
      case 'FAVORITOS':
        return 'bi bi-star-fill';
      case 'GRUPOS':
        return 'bi bi-people-fill';
      case 'TODOS':
      default:
        return 'bi bi-filter-circle';
    }
  }

  public get showChatListSkeleton(): boolean {
    return this.chatListLoading && (this.chats?.length || 0) === 0;
  }

  public get showMessagesSkeleton(): boolean {
    const chatId = Number(this.chatActual?.id ?? this.chatSeleccionadoId ?? 0);
    if (!Number.isFinite(chatId) || chatId <= 0 || !this.chatActual) return false;
    const key = buildConversationHistoryKey(chatId, !!this.chatActual.esGrupo);
    return this.messagesInitialLoadingConversationKey === key;
  }

  public deletedMessageTypeBadge(mensaje: MensajeDTO): string {
    const tipo = String(mensaje?.tipo || 'TEXT').trim().toUpperCase();
    if (tipo === 'STICKER') return 'STICKER';
    if (tipo === 'IMAGE') return 'IMAGEN';
    if (tipo === 'AUDIO') return 'AUDIO';
    if (tipo === 'FILE') return 'ARCHIVO';
    if (tipo === 'POLL') return 'ENCUESTA';
    if (tipo === 'SYSTEM') return 'SISTEMA';
    return 'MENSAJE';
  }

  // ? lista derivada para el *ngFor*
  //  - Coincidencias arriba (empieza por > contiene)
  //  - Luego el resto (sin coincidencia), conservando orden original
  //  - Empates: más no leídos primero y, luego, más reciente
  /**
   * Devuelve la lista ordenada localmente de los chats según su coincidencia de búsqueda, mensajes sin leer y fecha.
   */
  public get chatsFiltrados(): any[] {
    const base = (this.chats || [])
      .filter((chat) => !chat?.esGrupo || !this.isPublicGroupChat(chat))
      .filter((chat) => this.matchesChatListFilter(chat));
    const q = normalizeSearchText(this.busquedaChat);
    if (!q) {
      return base
        .map((c, idx) => ({ c, idx }))
        .sort((a, b) => {
          const pinnedDiff = this.comparePinnedChatOrder(a.c, b.c);
          if (pinnedDiff !== 0) return pinnedDiff;
          return a.idx - b.idx;
        })
        .map((x) => x.c);
    }

    return base
      .map((c, idx) => {
        const nombre = normalizeSearchText(c?.nombre || '');
        let score = 0;
        if (nombre.startsWith(q)) score = 2; // mejor match
        else if (nombre.includes(q)) score = 1; // match normal
        // score 0 = no coincide, se queda abajo
        return { c, idx, score };
      })
      .sort((a, b) => {
        // 0) chat fijado arriba de todo
        const pinnedDiff = this.comparePinnedChatOrder(a.c, b.c);
        if (pinnedDiff !== 0) return pinnedDiff;

        // 1) por score (desc)
        if (b.score !== a.score) return b.score - a.score;

        // 2) entre coincidencias, más no leídos arriba
        const unreadDiff = (b.c.unreadCount || 0) - (a.c.unreadCount || 0);
        if (unreadDiff !== 0) return unreadDiff;

        // 3) por fecha (más reciente arriba)
        const fd = compareFechaDesc(a.c.ultimaFecha, b.c.ultimaFecha);
        if (fd !== 0) return fd;

        // 4) estable: índice original
        return a.idx - b.idx;
      })
      .map((x) => x.c);
  }

  private promoteChatToTop(chatIdRaw: unknown): void {
    const chatId = Number(chatIdRaw || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const idx = (this.chats || []).findIndex((c: any) => Number(c?.id) === chatId);
    if (idx <= 0) return;
    const next = [...(this.chats || [])];
    const [target] = next.splice(idx, 1);
    if (!target) return;
    this.chats = [target, ...next];
  }

  // ==========
  // PRIVATE METHODS (helpers internos)
  // ==========

  private matchesChatListFilter(chat: any): boolean {
    switch (this.chatListFilter) {
      case 'NO_LEIDOS':
        return Number(chat?.unreadCount || 0) > 0;
      case 'FAVORITOS':
        return this.isChatFavorite(chat);
      case 'GRUPOS':
        return !!chat?.esGrupo;
      case 'TODOS':
      default:
        return true;
    }
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
        this.applyBlockedStateFromUserDto(u);
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
        console.error('? Error cargando perfil:', err);
        this.usuarioFotoUrl = this.normalizeOwnProfilePhoto(cachedFoto);
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Programa relojes de presencia:
   * - Inactividad general (20 min) => Ausente.
   * - Pestaña oculta (5 min aprox) => Ausente.
   */
  private inicializarDeteccionInactividad(): void {
    const resetTimerInactividad = () => {
      if (this.estadoActual === 'Ausente') {
        this.cambiarEstado('Conectado');
      }
      clearTimeout(this.inactividadTimer);
      this.inactividadTimer = setTimeout(() => {
        this.cambiarEstado('Ausente');
      }, 20 * 60 * 1000); // 20 min
    };

    const iniciarTimerPestanaOculta = () => {
      clearTimeout(this.tabOcultaTimer);
      this.tabOcultaTimer = setTimeout(() => {
        if (this.isAppTabInBackground()) {
          this.cambiarEstado('Ausente');
        }
      }, 5 * 60 * 1000); // ~5 min
    };

    this.presenciaOnActividad = () => {
      resetTimerInactividad();
    };

    this.presenciaOnVisibilidadChange = () => {
      if (this.isAppTabInBackground()) {
        iniciarTimerPestanaOculta();
        return;
      }
      clearTimeout(this.tabOcultaTimer);
      resetTimerInactividad();
    };

    this.presenciaActividadEventos.forEach((evento) => {
      window.addEventListener(evento, this.presenciaOnActividad!);
    });
    document.addEventListener('visibilitychange', this.presenciaOnVisibilidadChange);

    resetTimerInactividad();
    if (this.isAppTabInBackground()) {
      iniciarTimerPestanaOculta();
    }
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
      console.warn('?? No se pudo hacer scroll:', err);
    }
  }

  /**
   * El usuario cliquea "Contestar" al popup verde de llamada, validando permisos de micrófono/cámara y conectándolo.
   */
  public async aceptarLlamada(): Promise<void> {
    if (!this.ultimaInvite) return;
    this.stopIncomingRingtone();
    this.wsService.setActiveCallSession(
      this.ultimaInvite.callId,
      Number(this.ultimaInvite.callerId),
      Number(this.ultimaInvite.calleeId)
    );
    this.signalingBlockedCallIds.delete(
      String(this.ultimaInvite.callId || '').trim()
    );

    // ?? Primero probamos acceder a cam/mic. Si falla, rechazamos con motivo.
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
      const failedCallId = String(this.ultimaInvite.callId || '').trim();
      if (failedCallId) {
        this.signalingBlockedCallIds.add(failedCallId);
        this.wsService.markCallEnded(failedCallId);
      }
      // quitar el banner
      this.ultimaInvite = undefined;
      this.currentCallId = undefined;
      if (failedCallId) this.wsService.clearActiveCallSession(failedCallId);
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
    this.stopIncomingRingtone();
    const rejectedCallId = String(this.ultimaInvite.callId || '').trim();
    if (rejectedCallId) {
      this.signalingBlockedCallIds.add(rejectedCallId);
      this.wsService.markCallEnded(rejectedCallId);
    }
    this.wsService.responderLlamada(
      this.ultimaInvite.callId,
      this.ultimaInvite.callerId,
      this.ultimaInvite.calleeId,
      false,
      'REJECTED'
    );
    this.ultimaInvite = undefined;
    this.currentCallId = undefined;
    if (rejectedCallId) this.wsService.clearActiveCallSession(rejectedCallId);
  }

  /**
   * Termina la videollamada actual, cortando la conexión tanto si fuiste el creador como si fuiste el invitado.
   */
  public colgar(): void {
    this.stopOutgoingRingback();
    this.stopIncomingRingtone();
    this.outgoingCallPendingAcceptance = false;
    this.playHangupTone();
    const callId = this.currentCallId ?? this.ultimaInvite?.callId;
    if (callId) {
      this.signalingBlockedCallIds.add(String(callId).trim());
      this.wsService.markCallEnded(callId);
      this.wsService.colgarLlamada(callId, this.usuarioActualId);
    }
    this.cerrarLlamadaLocal();
  }

  /**
   * Limpia y apaga recursos locales de una llamada finalizada (cierra la cámara, micrófono y conexión remota).
   */
  private cerrarLlamadaLocal(): void {
    const closingCallId = String(
      this.currentCallId || this.ultimaInvite?.callId || ''
    ).trim();
    if (closingCallId) {
      this.wsService.clearActiveCallSession(closingCallId);
    }
    this.stopOutgoingRingback();
    this.stopIncomingRingtone();
    this.outgoingCallPendingAcceptance = false;
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

    // ?? Limpia el overlay de estado
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
      if (!this.shouldProcessInboundSignaling(offer.callId)) return;
      await this._handleRemoteOffer(offer);
    });

    // ANSWER entrante (yo soy A)
    this.wsService.suscribirseASdpAnswer(this.usuarioActualId, async (ans) => {
      if (!ans?.sdp || !this.peer) return;
      if (!this.shouldProcessInboundSignaling(ans.callId)) return;
      await this.peer.setRemoteDescription({ type: 'answer', sdp: ans.sdp });
    });

    // ICE entrante (ambos)
    this.wsService.suscribirseAIce(this.usuarioActualId, async (ice) => {
      if (!this.peer || !ice?.candidate) return;
      if (!this.shouldProcessInboundSignaling(ice.callId)) return;
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
    const callId = String(offer?.callId || '').trim();
    if (!callId || !this.shouldProcessInboundSignaling(callId)) return;
    this.wsService.setActiveCallSession(
      callId,
      Number(offer.fromUserId),
      Number(offer.toUserId)
    );
    this.currentCallId = callId;

    if (this.peer) {
      // Renegociacion
      await this.peer.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer);
      this.sendSdpAnswerSecure(callId, answer.sdp as string, offer.fromUserId);
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
    this.stopIncomingRingtone();

    const callerId = this.usuarioActualId;
    const calleeId = Number(this.chatActual?.receptor?.id);
    if (!calleeId) return;

    // Prepara cámara/mic local (opcional mostrarte mientras suena)
    try {
      await this.prepararMediosLocales();
    } catch {}

    this.remoteStream = null; // <- asegura que NO hay remoto aún
    this.showCallUI = true;
    this.outgoingCallPendingAcceptance = true;
    this.isMuted = true;
    this.setLocalAudioEnabled(false);

    const nombreCallee =
      `${this.chatActual?.receptor?.nombre || ''} ${
        this.chatActual?.receptor?.apellido || ''
      }`.trim() || 'la otra persona';
    this.showRemoteStatus(`Llamando a ${nombreCallee}`, 'is-ringing');
    this.startOutgoingRingback();

    // Envía invitación
    this.wsService.iniciarLlamada(callerId, calleeId, chatId);
  }

  /**
   * Activa/desactiva de forma masiva las pistas de audio locales.
   */
  private setLocalAudioEnabled(enabled: boolean): void {
    try {
      this.localStream
        ?.getAudioTracks()
        .forEach((t) => (t.enabled = !!enabled));
    } catch {}
  }

  /**
   * Reproduce tono local de llamada saliente mientras esperamos que la otra persona acepte.
   */
  private startOutgoingRingback(): void {
    this.stopOutgoingRingback();
    this.stopIncomingRingtone();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx: AudioContext = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Saliente: tono suave y menos agresivo.
      osc.type = 'triangle';
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.outgoingRingbackCtx = ctx;
      this.outgoingRingbackOsc = osc;
      this.outgoingRingbackGain = gain;
      this.outgoingRingbackActive = true;

      const pattern = [
        { freq: 440, ms: 420, vol: 0.038 },
        { freq: 523, ms: 420, vol: 0.038 },
        { freq: 440, ms: 420, vol: 0.038 },
        { freq: 0, ms: 1020, vol: 0 },
      ];
      let idx = 0;

      const step = () => {
        if (
          !this.outgoingRingbackActive ||
          !this.outgoingRingbackOsc ||
          !this.outgoingRingbackGain ||
          !this.outgoingRingbackCtx
        ) {
          return;
        }
        const p = pattern[idx];
        idx = (idx + 1) % pattern.length;

        if (p.freq > 0 && p.vol > 0) {
          this.outgoingRingbackOsc.frequency.setValueAtTime(
            p.freq,
            this.outgoingRingbackCtx.currentTime
          );
          this.outgoingRingbackGain.gain.setTargetAtTime(
            p.vol,
            this.outgoingRingbackCtx.currentTime,
            0.01
          );
        } else {
          this.outgoingRingbackGain.gain.setTargetAtTime(
            0,
            this.outgoingRingbackCtx.currentTime,
            0.02
          );
        }

        this.outgoingRingbackTimer = setTimeout(step, p.ms);
      };

      step();
      void ctx.resume().catch(() => {});
    } catch (e) {
      console.warn('No se pudo iniciar el tono de llamada saliente', e);
      this.stopOutgoingRingback();
    }
  }

  /**
   * Detiene y limpia cualquier tono local de llamada saliente en curso.
   */
  private stopOutgoingRingback(): void {
    this.outgoingRingbackActive = false;
    if (this.outgoingRingbackTimer) {
      clearTimeout(this.outgoingRingbackTimer);
      this.outgoingRingbackTimer = undefined;
    }
    try {
      if (this.outgoingRingbackGain && this.outgoingRingbackCtx) {
        this.outgoingRingbackGain.gain.setValueAtTime(
          0,
          this.outgoingRingbackCtx.currentTime
        );
      }
    } catch {}
    try {
      this.outgoingRingbackOsc?.stop();
    } catch {}
    try {
      this.outgoingRingbackOsc?.disconnect();
    } catch {}
    try {
      this.outgoingRingbackGain?.disconnect();
    } catch {}
    try {
      void this.outgoingRingbackCtx?.close();
    } catch {}
    this.outgoingRingbackOsc = undefined;
    this.outgoingRingbackGain = undefined;
    this.outgoingRingbackCtx = undefined;
  }

  /**
   * Reproduce tono de llamada entrante mientras el usuario decide aceptar/rechazar.
   */
  private startIncomingRingtone(): void {
    this.stopIncomingRingtone();
    this.stopOutgoingRingback();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx: AudioContext = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Entrante (estilo Teams): campana suave en dos notas.
      osc.type = 'sine';
      osc.frequency.value = 659;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.incomingRingtoneCtx = ctx;
      this.incomingRingtoneOsc = osc;
      this.incomingRingtoneGain = gain;
      this.incomingRingtoneActive = true;

      // Patrón "ring-ring" más suave y musical.
      const pattern = [
        { freq: 659, ms: 260, vol: 0.03 }, // E5
        { freq: 523, ms: 260, vol: 0.028 }, // C5
        { freq: 0, ms: 170, vol: 0 },
        { freq: 659, ms: 260, vol: 0.03 },
        { freq: 523, ms: 260, vol: 0.028 },
        { freq: 0, ms: 1120, vol: 0 },
      ];
      let idx = 0;

      const step = () => {
        if (
          !this.incomingRingtoneActive ||
          !this.incomingRingtoneOsc ||
          !this.incomingRingtoneGain ||
          !this.incomingRingtoneCtx
        ) {
          return;
        }

        const p = pattern[idx];
        idx = (idx + 1) % pattern.length;

        if (p.freq > 0) {
          this.incomingRingtoneOsc.frequency.setValueAtTime(
            p.freq,
            this.incomingRingtoneCtx.currentTime
          );
          this.incomingRingtoneGain.gain.setTargetAtTime(
            p.vol,
            this.incomingRingtoneCtx.currentTime,
            0.01
          );
        } else {
          this.incomingRingtoneGain.gain.setTargetAtTime(
            0,
            this.incomingRingtoneCtx.currentTime,
            0.02
          );
        }

        this.incomingRingtoneTimer = setTimeout(step, p.ms);
      };

      step();
      void ctx.resume().catch(() => {});
    } catch (e) {
      console.warn('No se pudo iniciar el tono de llamada entrante', e);
      this.stopIncomingRingtone();
    }
  }

  /**
   * Detiene el tono de llamada entrante.
   */
  private stopIncomingRingtone(): void {
    this.incomingRingtoneActive = false;
    if (this.incomingRingtoneTimer) {
      clearTimeout(this.incomingRingtoneTimer);
      this.incomingRingtoneTimer = undefined;
    }
    try {
      if (this.incomingRingtoneGain && this.incomingRingtoneCtx) {
        this.incomingRingtoneGain.gain.setValueAtTime(
          0,
          this.incomingRingtoneCtx.currentTime
        );
      }
    } catch {}
    try {
      this.incomingRingtoneOsc?.stop();
    } catch {}
    try {
      this.incomingRingtoneOsc?.disconnect();
    } catch {}
    try {
      this.incomingRingtoneGain?.disconnect();
    } catch {}
    try {
      void this.incomingRingtoneCtx?.close();
    } catch {}
    this.incomingRingtoneOsc = undefined;
    this.incomingRingtoneGain = undefined;
    this.incomingRingtoneCtx = undefined;
  }

  private isAppTabInBackground(): boolean {
    try {
      return document.visibilityState !== 'visible' || document.hidden === true;
    } catch {
      return false;
    }
  }

  /**
   * Reproduce un tono corto cuando llega un mensaje no leído en segundo plano.
   */
  private playUnreadMessageTone(chatRef?: any): void {
    if (this.isChatMuted(chatRef)) return;

    const nowMs = Date.now();
    if (
      nowMs - this.lastMessageNotificationToneAt <
      this.MESSAGE_NOTIFICATION_TONE_COOLDOWN_MS
    ) {
      return;
    }
    this.lastMessageNotificationToneAt = nowMs;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx: AudioContext = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);

      const startAt = ctx.currentTime + 0.01;
      const notes = [
        { freq: 784, start: 0, dur: 0.09, vol: 0.045 }, // G5
        { freq: 988, start: 0.11, dur: 0.11, vol: 0.04 }, // B5
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, startAt + note.start);
        osc.connect(gain);
        gain.connect(master);
        gain.gain.setValueAtTime(0.0001, startAt + note.start);
        gain.gain.linearRampToValueAtTime(
          note.vol,
          startAt + note.start + 0.015
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          startAt + note.start + note.dur
        );
        osc.start(startAt + note.start);
        osc.stop(startAt + note.start + note.dur + 0.02);
      }

      const totalMs =
        Math.ceil(
          (Math.max(...notes.map((n) => n.start + n.dur)) + 0.08) * 1000
        ) + 20;
      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, totalMs);
      void ctx.resume().catch(() => {});
    } catch (e) {
      console.warn('No se pudo reproducir el tono de notificacion de mensaje', e);
    }
  }

  /**
   * Reproduce un tono corto de finalización de llamada, tipo "hang up".
   */
  private playHangupTone(): void {
    try {
      this.stopOutgoingRingback();
      this.stopIncomingRingtone();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx: AudioContext = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);

      const now = ctx.currentTime;
      // Colgar: caída rápida de tono, corta y reconocible.
      const notes = [
        { freq: 740, start: 0, dur: 0.11 },
        { freq: 560, start: 0.12, dur: 0.12 },
        { freq: 370, start: 0.25, dur: 0.14 },
      ];

      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        osc.connect(gain);
        gain.connect(master);
        gain.gain.setValueAtTime(0.0001, now + n.start);
        gain.gain.linearRampToValueAtTime(0.09, now + n.start + 0.015);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + n.start + n.dur
        );
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.02);
      }

      void ctx.resume().catch(() => {});
      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 1000);
    } catch (e) {
      console.warn('No se pudo reproducir el tono de colgar', e);
    }
  }

  /**
   * Interno: Una vez el otro acepta, crea la conexión definitiva desde tu lado para enviar audio y esperar vídeo.
   */
  private async iniciarPeerComoCaller(
    callId: string,
    toUserId: number
  ): Promise<void> {
    const normalizedCallId = String(callId || '').trim();
    if (!normalizedCallId) return;
    if (!this.currentCallId) this.currentCallId = normalizedCallId;
    await this.prepararMediosLocales(); // solo audio
    this.crearPeerHandlers(normalizedCallId); // crea transceiver vídeo

    const offer = await this.peer!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peer!.setLocalDescription(offer);

    this.sendSdpOfferSecure(normalizedCallId, offer.sdp as string, toUserId);

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
    const normalizedCallId = String(offer?.callId || '').trim();
    if (!normalizedCallId) return;
    this.currentCallId = normalizedCallId;
    this.wsService.setActiveCallSession(
      normalizedCallId,
      Number(offer.fromUserId),
      Number(offer.toUserId)
    );
    this.signalingBlockedCallIds.delete(normalizedCallId);

    // ? ocultar banner de llamada entrante
    this.stopIncomingRingtone();
    this.ultimaInvite = undefined;

    this.showCallUI = true;
    await this.prepararMediosLocales();
    this.crearPeerHandlers(normalizedCallId);

    await this.peer!.setRemoteDescription({ type: 'offer', sdp: offer.sdp });

    const answer = await this.peer!.createAnswer();
    await this.peer!.setLocalDescription(answer);

    this.sendSdpAnswerSecure(
      normalizedCallId,
      answer.sdp as string,
      offer.fromUserId
    );

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

  /** Devuelve la URL real de foto si existe; si no hay foto ? null (para mostrar icono). */
  public get peerAvatarUrl(): string | null {
    const f = this.chatActual?.receptor?.foto?.trim();
    return f && !f.toLowerCase().includes('assets/usuario.png') ? f : null;
  }

  /**
   * Configura las reglas iniciales y los receptores de conexión WebRTC para conectar el video de otra persona directamente.
   */
  private crearPeerHandlers(
    callId: string
  ): void {
    const normalizedCallId = String(callId || '').trim();
    if (!normalizedCallId) return;
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
        this.sendIceCandidateSecure(
          normalizedCallId,
          ev.candidate.candidate,
          ev.candidate.sdpMid || undefined,
          ev.candidate.sdpMLineIndex ?? undefined
        );
      }
    };

    // 5) Re-negociación cuando haga falta (p.ej. al encender cámara)
    this.peer.onnegotiationneeded = async () => {
      try {
        const offer = await this.peer!.createOffer();
        await this.peer!.setLocalDescription(offer);
        this.sendSdpOfferSecure(normalizedCallId, offer.sdp as string);
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

  private shouldProcessInboundSignaling(callIdRaw?: string): boolean {
    const callId = String(callIdRaw || '').trim();
    if (!callId) return false;
    if (this.signalingBlockedCallIds.has(callId)) return false;
    if (this.currentCallId && this.currentCallId !== callId) return false;
    return true;
  }

  private canSendSignalingForCall(callIdRaw?: string): boolean {
    const callId = String(callIdRaw || '').trim();
    if (!callId) return false;
    if (this.signalingBlockedCallIds.has(callId)) return false;
    if (!this.currentCallId) return false;
    if (this.currentCallId !== callId) return false;
    return true;
  }

  private sendSdpOfferSecure(
    callIdRaw: string,
    sdpRaw: string,
    hintedToUserIdRaw?: number
  ): boolean {
    const callId = String(callIdRaw || '').trim();
    const sdp = String(sdpRaw || '').trim();
    if (!callId || !sdp) return false;
    if (!this.canSendSignalingForCall(callId)) return false;
    const hintedToUserId = Number(hintedToUserIdRaw);
    const ok = this.wsService.enviarSdpOffer({
      callId,
      fromUserId: this.usuarioActualId,
      toUserId:
        Number.isFinite(hintedToUserId) && hintedToUserId > 0
          ? hintedToUserId
          : 0,
      sdp,
    });
    if (!ok) return false;
    return true;
  }

  private sendSdpAnswerSecure(
    callIdRaw: string,
    sdpRaw: string,
    hintedToUserIdRaw?: number
  ): boolean {
    const callId = String(callIdRaw || '').trim();
    const sdp = String(sdpRaw || '').trim();
    if (!callId || !sdp) return false;
    if (!this.canSendSignalingForCall(callId)) return false;
    const hintedToUserId = Number(hintedToUserIdRaw);
    const ok = this.wsService.enviarSdpAnswer({
      callId,
      fromUserId: this.usuarioActualId,
      toUserId:
        Number.isFinite(hintedToUserId) && hintedToUserId > 0
          ? hintedToUserId
          : 0,
      sdp,
    });
    if (!ok) return false;
    return true;
  }

  private sendIceCandidateSecure(
    callIdRaw: string,
    candidateRaw: string,
    sdpMid?: string,
    sdpMLineIndex?: number
  ): boolean {
    const callId = String(callIdRaw || '').trim();
    const candidate = String(candidateRaw || '').trim();
    if (!callId || !candidate) return false;
    if (!this.canSendSignalingForCall(callId)) return false;
    const ok = this.wsService.enviarIce({
      callId,
      fromUserId: this.usuarioActualId,
      toUserId: 0,
      candidate,
      sdpMid,
      sdpMLineIndex,
    });
    if (!ok) return false;
    return true;
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
    if (this.outgoingCallPendingAcceptance) return;
    this.isMuted = !this.isMuted;
    this.setLocalAudioEnabled(!this.isMuted);
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
    const enrichedMessage = this.mergeDeletionPayloadWithLocalContext(mensaje);
    const deletedId = Number(enrichedMessage.id);
    const chatId = (enrichedMessage as any).chatId;
    const shouldTrace = this.looksLikeAdminWarningMessage(enrichedMessage);
    if (shouldTrace) {
      this.debugAdminWarningFlow('ui-delete-start', {
        payload: this.extractAdminWarningDebugMeta(enrichedMessage),
      });
    }
    const normalizedDeleted = this.normalizeDeletedMessageForRetention(
      { ...(enrichedMessage || {}) },
      Date.now()
    );
    const isTemporalExpired = this.isTemporalExpiredMessage(normalizedDeleted);
    const expiredPlaceholder = isTemporalExpired
      ? this.temporalExpiredPlaceholderText({
          ...(normalizedDeleted || {}),
          contenido: '',
        })
      : '';
    const mergedPayload: MensajeDTO = isTemporalExpired
      ? {
          ...(normalizedDeleted || {}),
          activo: false,
          contenido: expiredPlaceholder,
          placeholderTexto: expiredPlaceholder,
        }
      : {
          ...(normalizedDeleted || {}),
          activo: false,
        };
    const shouldHideFromTimeline = this.shouldHideMessageFromTimeline(mergedPayload);
    if (shouldTrace) {
      this.debugAdminWarningFlow('ui-delete-decision', {
        payload: this.extractAdminWarningDebugMeta(mergedPayload),
        isTemporalExpired,
        shouldHideFromTimeline,
        mensajesSeleccionadosBefore: this.mensajesSeleccionados.length,
      });
    }

    // 1) Marca en hilo abierto
    const idxMsg = this.mensajesSeleccionados.findIndex(
      (m) => Number(m.id) === deletedId
    );
    if (idxMsg !== -1) {
      if (shouldHideFromTimeline) {
        this.mensajesSeleccionados = [
          ...this.mensajesSeleccionados.slice(0, idxMsg),
          ...this.mensajesSeleccionados.slice(idxMsg + 1),
        ];
      } else {
        this.mensajesSeleccionados = [
          ...this.mensajesSeleccionados.slice(0, idxMsg),
          { ...this.mensajesSeleccionados[idxMsg], ...mergedPayload },
          ...this.mensajesSeleccionados.slice(idxMsg + 1),
        ];
      }
      this.syncActiveHistoryStateMessages();
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
      const newLast = [...copia]
        .reverse()
        .find((m) => this.canMessageBeUsedAsChatPreview(m));

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
    if (shouldTrace) {
      this.debugAdminWarningFlow('ui-delete-refresh-preview-from-server', {
        chatId: Number(chatId || 0) || null,
        deletedId: Number.isFinite(deletedId) ? deletedId : null,
      });
    }
    this.refrescarPreviewDesdeServidor(Number(chatId));
  }

  /**
   * Habla con los servidores de mensajería backend para refrescar y actualizar el resumen de "Último mensaje de chat"
   */
  private refrescarPreviewDesdeServidor(chatId: number): void {
    this.debugAdminWarningFlow('preview-refresh-start', {
      endpoint: `/api/chat/mensajes/${chatId}`,
      chatId,
    });
    this.chatService.listarMensajesPorChat(chatId).subscribe({
      next: (mensajes) => {
        const lastActivo = [...mensajes]
          .reverse()
          .find((m: any) => this.canMessageBeUsedAsChatPreview(m));
        const hasVisibleTimelineMessage = [...mensajes].some(
          (m: any) => !this.shouldHideMessageFromTimeline(m)
        );
        const hasExpiredAdminBroadcast = [...mensajes].some((m: any) =>
          this.isExpiredAdminBroadcastMessage(m)
        );
        this.debugAdminWarningFlow('preview-refresh-response', {
          endpoint: `/api/chat/mensajes/${chatId}`,
          chatId,
          totalMensajes: Array.isArray(mensajes) ? mensajes.length : 0,
          hasVisibleTimelineMessage,
          hasExpiredAdminBroadcast,
          lastActivoId: Number((lastActivo as any)?.id || 0) || null,
          adminLike: (mensajes || [])
            .filter((m: any) => this.looksLikeAdminWarningMessage(m))
            .slice(0, 10)
            .map((m: any) => this.extractAdminWarningDebugMeta(m)),
        });

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
      error: (err) => {
        this.debugAdminWarningFlow('preview-refresh-error', {
          endpoint: `/api/chat/mensajes/${chatId}`,
          chatId,
          status: Number(err?.status || 0) || null,
          message: err?.message || err?.error?.mensaje || String(err),
        });
        if (Number(err?.status || 0) === 404) {
          this.handleChatNoLongerVisible(chatId, false);
          return;
        }
        console.error('? Error refrescando preview:', err);
      },
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
    this.notificationService.list().subscribe({
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
      error: (e) => console.error('? list notifications:', e),
    });
  }

  private scheduleChatsRefresh(delayMs = 250): void {
    if (this.chatListAccessForbidden) return;
    if (this.chatsRefreshTimer) {
      clearTimeout(this.chatsRefreshTimer);
    }
    this.chatsRefreshTimer = setTimeout(() => {
      this.chatsRefreshTimer = null;
      if (this.chatListAccessForbidden) return;
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
          const foto = avatarOrDefault(u?.foto || null);

          item.nombre = nombre;
          item.foto = foto;
          item.receptor = {
            id: u.id,
            nombre: u.nombre,
            apellido: u.apellido,
            foto,
          };
        }

        // 2) si justo ese chat está abierto, refresca header también
        if (this.chatActual && Number(this.chatActual.id) === Number(chatId)) {
          this.chatActual.nombre =
            `${u?.nombre ?? ''} ${u?.apellido ?? ''}`.trim() ||
            (u?.nombre ?? 'Usuario');
          this.chatActual.foto = avatarOrDefault(u?.foto || null);
          this.chatActual.receptor = {
            id: u.id,
            nombre: u.nombre,
            apellido: u.apellido,
            foto: avatarOrDefault(u?.foto || null),
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
    mensaje = this.normalizeMensajeEditadoFlag(mensaje);
    const incomingMessageId = Number(mensaje?.id);
    const hasIncomingMessageId =
      Number.isFinite(incomingMessageId) && incomingMessageId > 0;
    if (hasIncomingMessageId) {
      this.pollLocalSelectionByMessageId.delete(incomingMessageId);
    }
    const isSystem = this.isSystemMessage(mensaje);
    if (isSystem) {
      const isOwnGroupExpulsion =
        this.maybeApplyGroupExpulsionStateFromMessage(mensaje);
      if (isOwnGroupExpulsion) return;
      if (this.isPrivateExpulsionNoticeSystemMessage(mensaje)) return;
    }
    if (!isSystem && this.isEncryptedHiddenPlaceholder(mensaje?.contenido)) {
      return;
    }

    // Si no estoy en ese grupo ? solo preview/contadores
    if (!this.chatActual || this.chatActual.id !== mensaje.chatId) {
      const chatItem = this.chats.find((c) => c.id === mensaje.chatId);
      if (chatItem) {
        const currentLastId = Number(
          chatItem?.lastPreviewId ?? chatItem?.ultimaMensajeId ?? 0
        );
        const isExistingMessageUpdate =
          hasIncomingMessageId &&
          Number.isFinite(currentLastId) &&
          currentLastId > 0 &&
          incomingMessageId <= currentLastId;
        if (
          !isSystem &&
          mensaje.emisorId !== this.usuarioActualId &&
          !this.isMensajeEditado(mensaje) &&
          !isExistingMessageUpdate
        ) {
          chatItem.unreadCount = (chatItem.unreadCount || 0) + 1;
          this.playUnreadMessageTone(chatItem);
        }
        if (this.shouldRefreshPreviewWithIncomingMessage(chatItem, mensaje)) {
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
        }
        this.cdr.markForCheck();
      } else {
        this.scheduleChatsRefresh(80);
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
      const incomingPollPayload = this.parsePollPayloadForMessage(mensaje as MensajeDTO);
      i = this.mensajesSeleccionados.findIndex(
        (m) =>
          Number(m.id) < 0 &&
          Number(m.emisorId) === Number(mensaje.emisorId) &&
          ((String(m.tipo || 'TEXT') === incomingTipo &&
            String(m.contenido ?? '') === incomingContenido) ||
            (() => {
              if (!incomingPollPayload) return false;
              const optimisticPoll = this.parsePollPayloadForMessage(m as MensajeDTO);
              if (!optimisticPoll) return false;
              const incomingOptions = (incomingPollPayload.options || [])
                .map((opt) => String(opt?.text || '').trim().toLowerCase())
                .join('|');
              const optimisticOptions = (optimisticPoll.options || [])
                .map((opt) => String(opt?.text || '').trim().toLowerCase())
                .join('|');
              return (
                String(optimisticPoll.question || '').trim().toLowerCase() ===
                  String(incomingPollPayload.question || '').trim().toLowerCase() &&
                optimisticOptions === incomingOptions
              );
            })())
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
    const replacedExisting = i !== -1;

    this.syncActiveHistoryStateMessages();

    // Preview y scroll
    const chat = this.chats.find((c) => c.id === mensaje.chatId);
    if (
      chat &&
      !replacedExisting &&
      !isSystem &&
      !this.isMensajeEditado(mensaje) &&
      Number(mensaje?.emisorId) !== Number(this.usuarioActualId) &&
      this.isAppTabInBackground()
    ) {
      this.playUnreadMessageTone(chat);
    }
    if (chat && this.shouldRefreshPreviewWithIncomingMessage(chat, mensaje)) {
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

    if (!replacedExisting) {
      this.scrollAlFinal();
    }
    this.evaluarRespuestasRapidas();
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

    // ? ids estrictamente number[]
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
      error: (e) => console.warn('?? estados REST (topbar):', e),
    });

    // b) WS: actualizaciones en vivo (string ? normalizamos con toEstado)
    for (const id of ids) {
      if (this.topbarEstadoSuscritos.has(id)) continue;
      this.topbarEstadoSuscritos.add(id);

      this.wsService.suscribirseAEstado(id, (estadoStr: string) => {
        this.ngZone.run(() => {
          const estado = this.toEstado(estadoStr); // 'Conectado' | 'Desconectado' | 'Ausente'
          const i = this.topbarResults.findIndex((u) => u.id === id);
          if (i !== -1) {
            this.topbarResults[i] = { ...this.topbarResults[i], estado };
            this.cdr.markForCheck();
          }
        });
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
    if (
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin
    ) {
      return;
    }
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
      this.notificarGrabandoAudio(true);
      this.lastAudioPingMs = this.recordStartMs;

      // Iniciar cronómetro
      this.clearRecordTicker();
      this.recordElapsedMs = 0;
      this.recordTicker = setInterval(() => {
        const now = Date.now();
        this.recordElapsedMs = now - this.recordStartMs;
        if (now - this.lastAudioPingMs >= 1000) {
          this.notificarGrabandoAudio(true);
          this.lastAudioPingMs = now;
        }
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
    this.lastAudioPingMs = 0;
    this.notificarGrabandoAudio(false);

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
          : Number(e?.status) === 403
          ? 'No tienes permisos para subir audio en este chat.'
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
    this.lastAudioPingMs = 0;
    this.notificarGrabandoAudio(false);
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
    const cachedBloqueadosPorDenuncia = localStorage.getItem('bloqueadosPorDenunciaIds');
    if (cachedBloqueadosPorDenuncia) {
      try {
        const arr = JSON.parse(cachedBloqueadosPorDenuncia) as number[];
        this.bloqueadosPorDenunciaIds = new Set(arr);
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
    this.limpiarRespuestasRapidas();
    if (this.chatGrupalCerradoPorAdmin) return;

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
        this.mensajeriaService.uploadAudio(blobToUpload, durMs, chatId)
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
      this.attachTemporaryMetadata(mensaje);

      const textoPreview = `?? Mensaje de voz (${this.formatDur(mensaje.audioDuracionMs)})`;
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
        this.mensajeriaService.uploadAudio(blobToUpload, durMs, chatId)
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
        this.mensajeriaService.uploadAudio(audioBlob, durMs, chatId)
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
    this.attachTemporaryMetadata(mensaje);

    const textoPreview = `?? Mensaje de voz (${this.formatDur(uploadedDurMs)})`;
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
          this.markCurrentUserOutOfGroup(groupId, 'Has salido del grupo');

          void backendMsg;

          // Cierra menú si lo tienes
          if (typeof this.cerrarMenuOpciones === 'function')
            this.cerrarMenuOpciones();

          // Si el grupo queda eliminado, retira chat lateral y limpia la zona de mensajes
          if (groupDeleted) {
            this.clearCurrentUserOutOfGroup(groupId);
            this.clearStoredDraftForChat(groupId);
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
        console.error('? salirDeChatGrupal:', err);
        alert('Ha ocurrido un error al salir del grupo.');
      },
    });
  }

  public async reportarCierreChatActual(event?: MouseEvent): Promise<void> {
    await this.reportarCierreChat(this.chatActual, event);
  }

  public async reportarCierreChatDesdeListado(
    chat: any,
    event?: MouseEvent
  ): Promise<void> {
    await this.reportarCierreChat(chat, event);
  }

  private async reportarCierreChat(chatTarget: any, event?: MouseEvent): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!chatTarget?.esGrupo) return;
    if (!this.isGroupChatClosed(chatTarget)) return;

    const chatId = Number(chatTarget?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    this.openChatPinMenuChatId = null;
    this.cerrarMenuOpciones();
    this.reportChatClosureTarget = chatTarget;
    this.reportChatClosureText = '';
    this.reportChatClosureSending = false;
    this.showReportChatClosurePopup = true;
  }

  public get reportChatClosureTargetName(): string {
    const chat = this.reportChatClosureTarget;
    if (!chat) return 'este chat';
    const chatId = Number(chat?.id);
    return (
      String(chat?.nombreGrupo || chat?.nombre || '').trim() ||
      (Number.isFinite(chatId) && chatId > 0 ? `Grupo #${chatId}` : 'este chat')
    );
  }

  public closeReportChatClosurePopup(): void {
    if (this.reportChatClosureSending) return;
    this.showReportChatClosurePopup = false;
    this.reportChatClosureTarget = null;
    this.reportChatClosureText = '';
  }

  public onReportChatClosureValueChange(next: string): void {
    this.reportChatClosureText = String(next || '');
  }

  public submitReportChatClosure(): void {
    if (this.reportChatClosureSending) return;
    const chatId = Number(this.reportChatClosureTarget?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    this.reportChatClosureSending = true;
    this.chatService
      .reportarCierreChatGrupal(chatId, {
        motivo: String(this.reportChatClosureText || '').trim() || null,
      })
      .subscribe({
        next: () => {
          this.reportChatClosureSending = false;
          this.showReportChatClosurePopup = false;
          this.reportChatClosureTarget = null;
          this.reportChatClosureText = '';
          this.showToast(
            'Reporte enviado. Administracion lo revisará en breve.',
            'success',
            'Reportes',
            2200
          );
        },
        error: (err) => {
          this.reportChatClosureSending = false;
          const status = Number(err?.status || 0);
          const backendMsg = String(
            err?.error?.mensaje || err?.error?.message || err?.message || ''
          ).trim();
          const msg =
            status === 409
              ? 'Ya tienes un reporte abierto para este chat.'
              : status === 423
              ? 'Este chat ya no está cerrado; no se puede reportar este motivo.'
              : status === 404
              ? 'La API de reportes de cierre aún no está disponible en backend.'
              : status === 403
              ? 'No tienes permisos para reportar este chat.'
              : backendMsg || 'No se pudo enviar el reporte.';
          this.showToast(msg, 'warning', 'Reportes', 2600);
        },
      });
  }

  public async reportarUsuarioActual(event?: MouseEvent): Promise<void> {
    await this.reportarUsuario(this.chatActual, event);
  }

  public async reportarUsuarioDesdeListado(chat: any, event?: MouseEvent): Promise<void> {
    await this.reportarUsuario(chat, event);
  }

  public async reportarUsuarioDesdeMensaje(
    mensaje: MensajeDTO,
    event?: MouseEvent
  ): Promise<void> {
    await this.reportarUsuario(this.chatActual, event, mensaje);
  }

  private async reportarUsuario(
    chatTarget: any,
    event?: MouseEvent,
    _mensaje?: MensajeDTO
  ): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!chatTarget || !!chatTarget?.esGrupo) return;
    if (chatTarget?.denunciado === true) return;

    this.openChatPinMenuChatId = null;
    this.openMensajeMenuId = null;
    this.cerrarMenuOpciones();
    this.reportUserTarget = chatTarget;
    this.reportUserReason = '';
    this.reportUserDetail = '';
    this.reportUserAiLoading = true;
    this.reportUserAiMessage = '';
    this.reportUserSending = false;
    this.reportUserSuccess = false;
    this.showReportUserPopup = true;
    void this.analizarDenunciaActualConIa(chatTarget);
  }

  public get reportUserTargetName(): string {
    const chat = this.reportUserTarget;
    if (!chat) return 'este usuario';
    const fallbackId = Number(chat?.receptorId || chat?.usuarioId || chat?.id);
    return (
      String(chat?.receptor?.nombre || chat?.nombre || '').trim() ||
      (Number.isFinite(fallbackId) && fallbackId > 0
        ? `Usuario #${fallbackId}`
        : 'este usuario')
    );
  }

  public closeReportUserPopup(): void {
    if (this.reportUserSending) return;
    this.showReportUserPopup = false;
    this.reportUserTarget = null;
    this.reportUserAiLoading = false;
    this.reportUserAiMessage = '';
    this.reportUserReason = '';
    this.reportUserDetail = '';
    this.reportUserSuccess = false;
    this.reportUserAiAnalysisSeq += 1;
  }

  public onReportUserReasonChange(next: string): void {
    this.reportUserReason = String(next || '');
  }

  public onReportUserDetailChange(next: string): void {
    this.reportUserDetail = String(next || '');
  }

  private async analizarDenunciaActualConIa(chatTarget: any): Promise<void> {
    const analysisSeq = ++this.reportUserAiAnalysisSeq;
    const request = await this.buildAiReportAnalysisRequest(chatTarget);

    if (!this.isCurrentReportUserAnalysis(analysisSeq, chatTarget)) return;

    if (!request) {
      this.reportUserAiLoading = false;
      this.reportUserAiMessage =
        'No se pudo analizar automaticamente. Puedes completar la denuncia manualmente.';
      this.cdr.markForCheck();
      return;
    }

    try {
      const response = await firstValueFrom(
        this.aiService.analizarDenunciaConIa(request)
      );
      if (!this.isCurrentReportUserAnalysis(analysisSeq, chatTarget)) return;

      const normalizedResponse = await this.normalizeAiReportAnalysisResponse(response);
      this.applyAiReportAnalysisResponse(normalizedResponse);
    } catch (err: any) {
      if (!this.isCurrentReportUserAnalysis(analysisSeq, chatTarget)) return;
      this.reportUserAiMessage =
        'No se pudo analizar automaticamente. Puedes completar la denuncia manualmente.';
      this.showToast(this.resolveAiReportAnalysisError(err), 'warning', 'IA', 2600);
    } finally {
      if (!this.isCurrentReportUserAnalysis(analysisSeq, chatTarget)) return;
      this.reportUserAiLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async buildAiReportAnalysisRequest(
    chatTarget: any
  ): Promise<AiReportAnalysisRequestDTO | null> {
    const chatId = Number(chatTarget?.id || chatTarget?.chatId || 0);
    const esGrupo = !!(chatTarget?.esGrupo || this.chatActual?.esGrupo);
    const usuarioDenunciadoId = Number(
      chatTarget?.receptor?.id || chatTarget?.receptorId || chatTarget?.usuarioId || 0
    );

    if (
      !Number.isFinite(chatId) ||
      chatId <= 0 ||
      !Number.isFinite(usuarioDenunciadoId) ||
      usuarioDenunciadoId <= 0
    ) {
      return null;
    }

    return {
      chatId: esGrupo ? null : Math.round(chatId),
      chatGrupalId: esGrupo ? Math.round(chatId) : null,
      tipoChat: esGrupo ? 'GRUPAL' : 'INDIVIDUAL',
      usuarioDenunciadoId,
      maxMensajes: 50,
    };
  }

  private normalizeReportAnalysisContent(value: unknown): string {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 250);
  }

  private async normalizeAiReportAnalysisResponse(
    response: AiReportAnalysisResponseDTO | null | undefined
  ): Promise<AiReportAnalysisResponseDTO | null | undefined> {
    if (!response?.encryptedPayload) return response;

    const plain = await this.tryDecryptAiEncryptedPayload(response.encryptedPayload);
    if (!plain) return response;

    try {
      const parsed = JSON.parse(plain) as Partial<AiReportAnalysisResponseDTO>;
      if (!parsed || typeof parsed !== 'object') return response;
      return { ...response, ...parsed };
    } catch {
      return {
        ...response,
        descripcionDenuncia:
          String((response as any)?.descripcionDenuncia || '').trim() || plain,
      };
    }
  }

  private compareMessagesForReportAnalysis(a: MensajeDTO, b: MensajeDTO): number {
    const timeA = this.resolveReportAnalysisMessageTime(a);
    const timeB = this.resolveReportAnalysisMessageTime(b);
    if (timeA !== timeB) return timeA - timeB;
    return Number(a?.id || 0) - Number(b?.id || 0);
  }

  private resolveReportAnalysisMessageTime(mensaje: MensajeDTO): number {
    const parsed = Date.parse(String(mensaje?.fechaEnvio || '').trim());
    if (Number.isFinite(parsed)) return parsed;
    const id = Number(mensaje?.id || 0);
    return Number.isFinite(id) ? id : 0;
  }

  private applyAiReportAnalysisResponse(
    response: AiReportAnalysisResponseDTO | null | undefined
  ): void {
    if (response?.success) {
      const matchedReason = this.matchReportUserReasonOption(
        String(response?.motivoSeleccionado || '')
      );
      this.reportUserReason = matchedReason || '';
      this.reportUserDetail = String(response?.descripcionDenuncia || '').trim();
      this.reportUserAiMessage =
        'Denuncia autocompletada con IA. Revisa y ajusta antes de continuar.';
      return;
    }

    this.reportUserAiMessage =
      String(response?.mensaje || '').trim() ||
      'No se pudo analizar automaticamente. Puedes completar la denuncia manualmente.';
  }

  private matchReportUserReasonOption(candidate: string): string | null {
    const normalizedCandidate = this.normalizeReportReasonValue(candidate);
    if (!normalizedCandidate) return null;

    const exact = this.reportUserReasonOptions.find((option) => {
      return (
        this.normalizeReportReasonValue(option.value) === normalizedCandidate ||
        this.normalizeReportReasonValue(option.label) === normalizedCandidate
      );
    });

    return exact ? exact.value : null;
  }

  private normalizeReportReasonValue(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private resolveAiReportAnalysisError(err: any): string {
    const backendMsg = String(
      err?.error?.mensaje || err?.error?.message || err?.message || ''
    ).trim();
    return (
      backendMsg ||
      'No se pudo analizar automaticamente. Puedes completar la denuncia manualmente.'
    );
  }

  private isCurrentReportUserAnalysis(analysisSeq: number, chatTarget: any): boolean {
    return (
      analysisSeq === this.reportUserAiAnalysisSeq &&
      this.showReportUserPopup &&
      !!this.reportUserTarget &&
      Number(this.reportUserTarget?.id || this.reportUserTarget?.chatId || 0) ===
        Number(chatTarget?.id || chatTarget?.chatId || 0)
    );
  }

  public submitReportUser(payload: { motivo: string; detalle: string }): void {
    if (this.reportUserSending || !this.reportUserTarget) return;
    if (this.reportUserTarget?.denunciado === true) return;

    const motivo = String(payload?.motivo || '').trim();
    const detalle = String(payload?.detalle || '').trim();
    if (!motivo || !detalle) return;

    this.reportUserSending = true;
    const target = this.reportUserTarget;
    const denunciadoId = Number(
      target?.receptor?.id || target?.receptorId || target?.usuarioId || 0
    );
    const chatId = Number(target?.id || target?.chatId || 0);
    const denunciadoNombre =
      String(target?.receptor?.nombre || target?.nombre || '').trim() || null;
    const chatNombreSnapshot =
      String(target?.nombreChat || target?.nombre || '').trim() || null;

    if (!Number.isFinite(denunciadoId) || denunciadoId <= 0) {
      this.reportUserSending = false;
      return;
    }

    void (async () => {
      try {
        await firstValueFrom(
          this.complaintService.createComplaint({
            denunciadoId,
            chatId: Number.isFinite(chatId) && chatId > 0 ? chatId : null,
            motivo,
            detalle,
            denunciadoNombre,
            chatNombreSnapshot,
          })
        );

        if (!this.bloqueadosIds.has(denunciadoId)) {
          await firstValueFrom(this.authService.bloquearUsuario(denunciadoId, 'REPORT'));
          this.bloqueadosIds.add(denunciadoId);
          this.updateCachedBloqueados();
        }
        this.bloqueadosPorDenunciaIds.add(denunciadoId);
        this.updateCachedBloqueadosPorDenuncia();

        // Marca local inmediata para ocultar acciones de re-denuncia en listado y cabecera.
        this.reportUserTarget.denunciado = true;
        const targetChatId = Number(target?.id || target?.chatId || 0);
        if (Number.isFinite(targetChatId) && targetChatId > 0) {
          const inList = this.chats.find((c) => Number(c?.id || 0) === targetChatId);
          if (inList) inList.denunciado = true;
          if (Number(this.chatActual?.id || 0) === targetChatId) {
            this.chatActual = { ...this.chatActual, denunciado: true };
          }
        }

        this.reportUserSuccess = true;
        this.cdr.markForCheck();
      } catch (err) {
        void Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar la denuncia o bloquear al usuario.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
        });
      } finally {
        this.reportUserSending = false;
      }
    })();
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

  public get isTemporaryMessageEnabledForActiveChat(): boolean {
    return (this.getActiveChatTemporarySeconds() || 0) > 0;
  }

  public get temporaryMessageBadgeLabel(): string {
    const seconds = this.getActiveChatTemporarySeconds();
    if (!seconds || seconds <= 0) return '';
    const option = this.temporaryMessageOptions.find((o) => o.seconds === seconds);
    if (option) return option.badge;
    return this.formatTemporaryBadge(seconds);
  }

  public get canCreatePollInCurrentChat(): boolean {
    return !!this.chatActual?.esGrupo;
  }

  public get canUseComposerAiActions(): boolean {
    const hasText = !!String(this.mensajeNuevo || '').trim();
    if (!hasText) return false;
    return !(
      this.attachmentUploading ||
      this.aiLoading ||
      this.cargandoIaInput ||
      this.haSalidoDelGrupo ||
      this.composerInteractionDisabled ||
      this.noGroupRecipientsForSend
    );
  }

  public get canSendComposerMessage(): boolean {
    const hasText = !!String(this.mensajeNuevo || '').trim();
    const hasAttachment = !!this.pendingAttachmentFile;
    if (!hasText && !hasAttachment) return false;
    return !(
      this.attachmentUploading ||
      this.aiLoading ||
      this.composerInteractionDisabled ||
      this.haSalidoDelGrupo ||
      this.noGroupRecipientsForSend
    );
  }

  public get shouldShowQuickRepliesLoading(): boolean {
    return this.cargandoQuickReplies && this.quickReplies.length === 0;
  }

  public get shouldShowQuickRepliesBlock(): boolean {
    return this.shouldShowQuickRepliesLoading || this.quickReplies.length > 0;
  }

  public get canUseQuickReplySend(): boolean {
    return !(
      this.enviandoQuickReply ||
      this.attachmentUploading ||
      this.aiLoading ||
      this.cargandoIaInput ||
      this.recording ||
      this.pendingAttachmentFile ||
      this.mensajeEdicionObjetivo ||
      this.composerInteractionDisabled ||
      this.haSalidoDelGrupo ||
      this.noGroupRecipientsForSend
    );
  }

  public toggleComposeAiPopup(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.canUseComposerAiActions) return;
    if (this.showComposeAiPopup) {
      this.cerrarMenusIa();
      return;
    }
    this.showChatListHeaderMenu = false;
    this.closeComposeActionsPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();
    this.composerAiError = null;
    this.mostrarMenuIdiomasIa = false;
    this.idiomaSeleccionadoIa = null;
    this.filtroIdiomasIa = '';
    this.showComposeAiPopup = true;
  }

  public abrirMenuIaInput(event: MouseEvent): void {
    this.toggleComposeAiPopup(event);
  }

  public abrirMenuTraduccionIa(event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.canUseComposerAiActions) return;
    if (!String(this.mensajeNuevo || '').trim()) {
      this.composerAiError = null;
      this.showToast('Escribe algo primero.', 'info', 'IA', 2200);
      return;
    }
    this.composerAiError = null;
    this.idiomaSeleccionadoIa = null;
    this.filtroIdiomasIa = '';
    this.mostrarMenuIdiomasIa = true;
    this.showComposeAiPopup = true;
  }

  public cerrarMenusIa(): void {
    this.closeComposeAiPopup();
  }

  public volverMenuIaPrincipal(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.cargandoIaInput) return;
    this.mostrarMenuIdiomasIa = false;
    this.idiomaSeleccionadoIa = null;
    this.filtroIdiomasIa = '';
    this.composerAiError = null;
  }

  public filtrarIdiomasIa(): void {
    this.filtroIdiomasIa = String(this.filtroIdiomasIa || '');
  }

  public get idiomasIaDestacadosFiltrados(): ComposeAiLanguageOption[] {
    return COMPOSE_AI_PRIMARY_TRANSLATION_LANGUAGES.filter((idioma) =>
      this.matchesComposeAiLanguageFilter(idioma)
    );
  }

  public get idiomasIaRestoFiltrados(): ComposeAiLanguageOption[] {
    return COMPOSE_AI_OTHER_TRANSLATION_LANGUAGES.filter((idioma) =>
      this.matchesComposeAiLanguageFilter(idioma)
    );
  }

  public get totalIdiomasIaDisponibles(): number {
    return COMPOSE_AI_TRANSLATION_LANGUAGES.length;
  }

  public trackComposeAiLanguage = (_: number, idioma: ComposeAiLanguageOption) =>
    `${idioma.codigo}-${idioma.idiomaDestino}`;

  public onComposerAiActionSelect(
    action: ComposerAiActionType,
    event?: MouseEvent
  ): void {
    event?.stopPropagation();
    if (!this.canUseComposerAiActions) return;
    if (action === 'TRANSLATE') {
      this.abrirMenuTraduccionIa();
      return;
    }
    void this.procesarTextoInputConIa(this.mapComposerAiActionToMode(action));
  }

  public get composerAiLoadingLabel(): string {
    return this.cargandoIaInput ? 'Procesando...' : 'Asistente de escritura';
  }

  private mapComposerAiActionToMode(action: ComposerAiActionType): AiTextMode {
    switch (action) {
      case 'SPELLCHECK':
        return AiTextMode.CORREGIR;
      case 'TONE':
        return AiTextMode.REFORMULAR;
      case 'FORMAT':
        return AiTextMode.FORMAL;
      case 'TRANSLATE':
        return AiTextMode.TRADUCIR;
      default:
        return AiTextMode.COMPLETAR_TEXTO;
    }
  }

  public async procesarTextoInputConIa(modo: AiTextMode | string): Promise<void> {
    this.cerrarMenusIa();
    const texto = String(this.mensajeNuevo || '').trim();
    if (!texto) {
      this.composerAiError = null;
      this.showToast('Escribe algo primero.', 'info', 'IA', 2200);
      return;
    }
    await this.procesarTextoComposerConIa(String(modo || '').trim());
  }

  private resolveComposerAiErrorMessage(err: any): string {
    const status = Number(err?.status || 0);
    const backendMsg = String(
      err?.error?.mensaje || err?.error?.message || err?.message || ''
    ).trim();

    if (status === 401) return 'Sesion expirada. Inicia sesion de nuevo.';
    if (status === 403) return 'No tienes permisos para usar IA en este chat.';
    if (status === 429) return 'Demasiadas solicitudes. Reintenta en unos segundos.';
    return backendMsg || 'No se pudo procesar el texto con IA.';
  }

  private async procesarTextoComposerConIa(modo: string): Promise<void> {
    const texto = String(this.mensajeNuevo || '').trim();
    if (!texto || this.aiLoading || this.cargandoIaInput) return;

    this.aiLoading = true;
    this.cargandoIaInput = true;
    this.composerAiError = null;

    try {
      const response = await firstValueFrom(
        this.mensajeriaService.procesarTextoConIa({
          texto,
          modo,
        })
      );

      if (response?.success) {
        this.aplicarTextoGeneradoAlInput(String(response?.textoGenerado || '').trim());
        this.cerrarMenusIa();
        return;
      }

      this.composerAiError =
        String(response?.mensaje || '').trim() ||
        'No se pudo procesar el texto con IA.';
      this.showComposeAiPopup = true;
    } catch (err: any) {
      this.composerAiError = this.resolveComposerAiErrorMessage(err);
      this.showComposeAiPopup = true;
    } finally {
      this.aiLoading = false;
      this.cargandoIaInput = false;
      this.cdr.markForCheck();
    }
  }

  public async traducirTextoInputConIa(idioma: string): Promise<void> {
    const idiomaDestino = String(idioma || '').trim();
    const texto = String(this.mensajeNuevo || '').trim();
    if (!idiomaDestino) return;
    if (!texto) {
      this.composerAiError = null;
      this.showToast('Escribe algo primero.', 'info', 'IA', 2200);
      this.mostrarMenuIdiomasIa = false;
      return;
    }
    if (this.aiLoading || this.cargandoIaInput) return;

    this.aiLoading = true;
    this.cargandoIaInput = true;
    this.composerAiError = null;
    this.idiomaSeleccionadoIa = idiomaDestino;

    try {
      const response = await firstValueFrom(
        this.mensajeriaService.procesarTextoConIa({
          texto,
          modo: AiTextMode.TRADUCIR,
          idiomaDestino,
        })
      );

      if (response?.success) {
        this.aplicarTextoGeneradoAlInput(String(response?.textoGenerado || '').trim());
        this.cerrarMenusIa();
        return;
      }

      this.composerAiError =
        String(response?.mensaje || '').trim() ||
        'No se pudo traducir el texto con IA.';
      this.showComposeAiPopup = true;
      this.mostrarMenuIdiomasIa = true;
    } catch (err: any) {
      this.composerAiError = this.resolveComposerAiErrorMessage(err);
      this.showComposeAiPopup = true;
      this.mostrarMenuIdiomasIa = true;
    } finally {
      this.aiLoading = false;
      this.cargandoIaInput = false;
      this.idiomaSeleccionadoIa = null;
      this.cdr.markForCheck();
    }
  }

  public aplicarTextoGeneradoAlInput(texto: string): void {
    this.mensajeNuevo = texto;
    this.scheduleComposerTextareaResize();
    this.focusMessageInput(this.mensajeNuevo.length);
  }

  private matchesComposeAiLanguageFilter(idioma: ComposeAiLanguageOption): boolean {
    const filtro = this.normalizeComposeAiLanguageText(this.filtroIdiomasIa);
    if (!filtro) return true;
    const haystack = this.normalizeComposeAiLanguageText(
      `${idioma.nombre} ${idioma.idiomaDestino} ${idioma.codigo}`
    );
    return haystack.includes(filtro);
  }

  private normalizeComposeAiLanguageText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  public toggleComposeActionsPopup(event: MouseEvent): void {
    event.stopPropagation();
    if (this.shouldDisableAttachmentAction()) return;
    if (this.showComposeActionsPopup) {
      this.closeComposeActionsPopup();
      return;
    }
    this.showChatListHeaderMenu = false;
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();
    this.showComposeActionsPopup = true;
  }

  public onComposerActionSelect(
    action: ComposerActionType,
    event?: MouseEvent
  ): void {
    event?.stopPropagation();
    if (action === 'archivo') {
      this.openAttachmentPicker();
      return;
    }
    if (action === 'encuesta') {
      this.openGroupPollComposer();
    }
  }

  public toggleChatListHeaderMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.openChatPinMenuChatId = null;
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();
    this.showChatListHeaderMenu = !this.showChatListHeaderMenu;
  }

  public openScheduleMessageComposerFromHeader(event?: MouseEvent): void {
    event?.stopPropagation();
    this.showChatListHeaderMenu = false;
    this.openScheduleMessageComposer(undefined, true);
  }

  public openGlobalMessageSearchPopup(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();
    this.showGlobalMessageSearchPopup = true;
    this.globalMessageSearchError = null;
    this.globalMessageSearchResumenBusqueda = null;
    this.globalMessageSearchResultados = [];
    this.cdr.detectChanges();
  }

  public closeGlobalMessageSearchPopup(): void {
    if (this.globalMessageSearchLoading) return;
    this.showGlobalMessageSearchPopup = false;
    this.globalMessageSearchError = null;
    this.globalMessageSearchResumenBusqueda = null;
  }

  public onGlobalMessageSearchConsultaChange(next: string): void {
    this.globalMessageSearchConsulta = String(next || '');
  }

  public submitGlobalMessageSearch(consulta: string): void {
    const normalizedConsulta = String(consulta || '').trim();
    if (!normalizedConsulta || this.globalMessageSearchLoading) return;

    const request: AiEncryptedMessageSearchRequest = {
      consulta: normalizedConsulta,
      maxResultados: 10,
      maxMensajesAnalizar: 300,
      fechaInicio: null,
      fechaFin: null,
      incluirGrupales: true,
      incluirIndividuales: true,
    };

    this.globalMessageSearchLoading = true;
    this.globalMessageSearchError = null;
    this.globalMessageSearchResumenBusqueda = null;
    this.globalMessageSearchResultados = [];

    this.aiService
      .buscarMensajesEncrypted(request)
      .pipe(
        finalize(() => {
          this.globalMessageSearchLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          const results = Array.isArray(response?.resultados) ? response.resultados : [];
          this.globalMessageSearchResumenBusqueda = String(response?.resumenBusqueda || '').trim() || null;
          this.globalMessageSearchResultados = results;
        },
        error: (error) => {
          const backendMessage = String(
            error?.error?.mensaje || error?.error?.message || ''
          ).trim();
          this.globalMessageSearchResumenBusqueda = null;
          this.globalMessageSearchError =
            backendMessage || 'No se pudo completar la busqueda global.';
        },
      });
  }

  public async onGlobalMessageSearchResultSelected(
    result: AiEncryptedMessageSearchResult
  ): Promise<void> {
    const chatId = Number(result?.chatId || 0);
    const messageId = Number(result?.mensajeId || 0);
    if (!Number.isFinite(chatId) || chatId <= 0 || !Number.isFinite(messageId) || messageId <= 0) {
      return;
    }

    let chat = (this.chats || []).find((c: any) => Number(c?.id) === chatId) || null;
    if (!chat) {
      if (!this.chatListLoading) this.listarTodosLosChats();
      await this.waitForCondition(() => !this.chatListLoading, 12000);
      chat = (this.chats || []).find((c: any) => Number(c?.id) === chatId) || null;
    }
    if (!chat) {
      this.showToast('No se encontro el chat del resultado.', 'warning', 'Busqueda IA');
      return;
    }

    this.showGlobalMessageSearchPopup = false;
    this.openChatsSidebarView();
    this.activeMainView = 'chat';
    this.pendingOpenFromStarredNavigation = {
      chatId: Math.round(chatId),
      messageId: Math.round(messageId),
    };
    this.mostrarMensajes(chat);
    await this.waitForCondition(
      () => Number(this.chatActual?.id) === Math.round(chatId),
      5000
    );
    try {
      await this.onMessageSearchResultSelect(messageId);
    } finally {
      const pending = this.pendingOpenFromStarredNavigation;
      if (
        pending &&
        Number(pending.chatId) === Math.round(chatId) &&
        Number(pending.messageId) === Math.round(messageId)
      ) {
        this.pendingOpenFromStarredNavigation = null;
      }
    }
  }

  public openGroupPollComposer(event?: MouseEvent): void {
    event?.stopPropagation();
    if (
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin
    ) {
      return;
    }
    if (!this.chatActual?.esGrupo) {
      this.closeComposeActionsPopup();
      return;
    }
    this.showChatListHeaderMenu = false;
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();
    this.closeScheduleMessageComposer();
    this.preparePollComposerIaContext();
    this.showGroupPollComposer = true;
  }

  public closeGroupPollComposer(): void {
    this.showGroupPollComposer = false;
    this.pollComposerAutogenerarIa = false;
  }

  private preparePollComposerIaContext(): void {
    const chatId = Number(this.chatActual?.id);
    if (!this.chatActual?.esGrupo || !Number.isFinite(chatId) || chatId <= 0) {
      this.pollComposerIaChatGrupalId = null;
      this.pollComposerIaMensajesContexto = [];
      this.pollComposerAutogenerarIa = false;
      return;
    }

    this.pollComposerIaChatGrupalId = Math.round(chatId);
    this.pollComposerIaMensajesContexto = this.buildPollComposerIaContextMessages();
    this.pollComposerAutogenerarIa = this.pollComposerIaMensajesContexto.length > 0;
  }

  private buildPollComposerIaContextMessages(): AiPollDraftContextMessageDTO[] {
    const mensajes = Array.isArray(this.mensajesSeleccionados)
      ? this.mensajesSeleccionados
      : [];

    return mensajes
      .filter((mensaje) => this.isMessageValidForPollIaContext(mensaje))
      .slice(-this.POLL_IA_MAX_CONTEXT_MESSAGES)
      .map((mensaje) => this.mapMessageToPollIaContext(mensaje))
      .filter((mensaje): mensaje is AiPollDraftContextMessageDTO => !!mensaje);
  }

  private mapMessageToPollIaContext(
    mensaje: MensajeDTO | null | undefined
  ): AiPollDraftContextMessageDTO | null {
    if (!mensaje) return null;
    const encryptedPayload = this.extraerEncryptedPayloadResumenIa(mensaje);
    if (!encryptedPayload) return null;

    const esUsuarioActual =
      Number(mensaje?.emisorId) === Number(this.usuarioActualId);
    const nombreEmisor =
      `${mensaje?.emisorNombre || ''} ${mensaje?.emisorApellido || ''}`.trim();

    return {
      id:
        Number.isFinite(Number(mensaje?.id)) && Number(mensaje?.id) > 0
          ? Math.round(Number(mensaje?.id))
          : undefined,
      autor: esUsuarioActual
        ? 'usuarioActual'
        : nombreEmisor || 'otroUsuario',
      encryptedPayload,
      esUsuarioActual,
      fecha: String(mensaje?.fechaEnvio || '').trim() || undefined,
    };
  }

  private isMessageValidForPollIaContext(
    mensaje: MensajeDTO | null | undefined
  ): boolean {
    if (!mensaje) return false;
    if (this.isSystemMessage(mensaje)) return false;
    if (this.isTemporalExpiredMessage(mensaje)) return false;
    if (mensaje?.activo === false) return false;

    return !!this.extraerEncryptedPayloadResumenIa(mensaje);
  }

  private truncatePollIaContextText(textoRaw: string): string {
    const texto = String(textoRaw || '').replace(/\s+/g, ' ').trim();
    if (!texto || this.isEncryptedHiddenPlaceholder(texto)) return '';
    if (texto.length <= this.POLL_IA_MAX_MESSAGE_CHARS) return texto;
    return `${texto.slice(0, this.POLL_IA_MAX_MESSAGE_CHARS).trimEnd()}...`;
  }

  public openScheduleMessageComposer(
    event?: MouseEvent,
    fromHeaderMenu: boolean = false
  ): void {
    event?.stopPropagation();
    if (
      !fromHeaderMenu &&
      (this.haSalidoDelGrupo ||
        this.chatEstaBloqueado ||
        this.chatEsSoloLecturaPorAdmin)
    ) {
      return;
    }
    this.activeMainView = 'chat';
    this.showTopbarProfileMenu = false;
    this.showChatListHeaderMenu = false;
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();
    this.closeGroupPollComposer();
    this.showScheduleMessageComposer = true;
  }

  public closeScheduleMessageComposer(): void {
    this.showScheduleMessageComposer = false;
    this.showChatListHeaderMenu = false;
  }

  public async onScheduleMessageDraftSubmit(
    payload: ScheduleMessageDraftPayload
  ): Promise<void> {
    if (this.scheduleCreateInFlight) return;
    const scheduledAtIso = String(payload?.scheduledAtIso || '').trim();
    const whenText = scheduledAtIso
      ? new Date(scheduledAtIso).toLocaleString('es-ES')
      : `${payload?.scheduledDate || ''} ${payload?.scheduledTime || ''}`.trim();

    const requestedChatIds = Array.isArray(payload?.chatIds)
      ? Array.from(
          new Set(
            payload.chatIds
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id) && id > 0)
          )
        )
      : [];
    const leftGroupIds = this.getLeftGroupIdsSet();
    const normalizedChatIds = requestedChatIds.filter((chatId) => {
      const chat = (this.chats || []).find((c: any) => Number(c?.id) === Number(chatId));
      if (!chat) return false;
      if (!!chat?.esGrupo && leftGroupIds.has(Number(chatId))) return false;
      return !this.isForwardTargetBlocked(chat);
    });
    const skippedByFront = Math.max(0, requestedChatIds.length - normalizedChatIds.length);
    const message = String(payload?.message || '').trim();
    const contenidoBusqueda = this.normalizeContenidoBusqueda(message);
    if (!message || normalizedChatIds.length === 0 || !scheduledAtIso) {
      this.showToast(
        'No se pudo programar: seleccion invalida o sin permisos en los chats elegidos.',
        'warning',
        'Programado'
      );
      return;
    }

    const requestBase: Pick<
      ProgramarMensajeRequestDTO,
      'message' | 'scheduledAt' | 'createdBy' | 'userId'
    > = {
      message,
      scheduledAt: scheduledAtIso,
      createdBy: Number(this.usuarioActualId) || undefined,
      userId: Number(this.usuarioActualId) || undefined,
    };

    this.scheduleCreateInFlight = true;
    try {
      const total = normalizedChatIds.length;
      let okCount = 0;
      let firstError = '';

      for (const chatId of normalizedChatIds) {
        const chatItem = (this.chats || []).find(
          (c: any) => Number(c?.id) === Number(chatId)
        );
        let encryptedContenido = message;
        try {
          if (chatItem?.esGrupo) {
            const encryptedGroup = await this.buildOutgoingE2EContentForGroup(
              chatItem,
              message
            );
            const strictValidation = this.validateOutgoingGroupPayloadStrict(
              encryptedGroup.content,
              encryptedGroup.expectedRecipientIds
            );
            if (!strictValidation.ok) {
              throw new Error(
                strictValidation.reason ||
                  strictValidation.code ||
                  'payload E2E_GROUP invalido para programado'
              );
            }
            encryptedContenido = encryptedGroup.content;
          } else {
            const receptorId = Number(chatItem?.receptor?.id);
            if (!Number.isFinite(receptorId) || receptorId <= 0) {
              throw new Error('No se pudo resolver el receptor del chat programado.');
            }
            encryptedContenido = await this.buildOutgoingE2EContent(
              receptorId,
              message
            );
          }
        } catch (encryptErr: any) {
          console.error('[SCHEDULE][encrypt-error]', {
            chatId,
            error: encryptErr?.message || String(encryptErr),
          });
          if (!firstError) {
            firstError =
              encryptErr?.message ||
              'No se pudo cifrar el mensaje programado para uno o mas chats.';
          }
          continue;
        }

        const request: ProgramarMensajeRequestDTO = {
          ...requestBase,
          chatIds: [chatId],
          contenido: encryptedContenido,
          contenidoBusqueda: contenidoBusqueda || undefined,
          contenido_busqueda: contenidoBusqueda || undefined,
        };
        try {
          const response = await firstValueFrom(
            this.chatService.programarMensajes(request)
          );
          const result = this.normalizeProgramarMensajesResponse(response);
          if (result.okCount > 0) {
            okCount += 1;
          } else if (!firstError) {
            firstError = result.errorMessage;
          }
        } catch (error: any) {
          console.error('[SCHEDULE][create-error]', { chatId, error });
          if (!firstError) {
            firstError = this.extractScheduleErrorMessage(error);
          }
        }
      }
      const failCount = Math.max(0, total - okCount) + skippedByFront;

      if (okCount > 0) {
        this.planScheduledDeliveryRealtimeProbe(normalizedChatIds, scheduledAtIso);
        this.closeScheduleMessageComposer();
        this.closeComposeActionsPopup();
        const base = `Mensaje programado para ${okCount} destino${
          okCount === 1 ? '' : 's'
        } (${whenText}).`;
        const extra =
          failCount > 0
            ? ` ${failCount} no pudieron programarse.`
            : '';
        this.showToast(
          `${base}${extra}`,
          failCount > 0 ? 'warning' : 'success',
          'Programado',
          3200
        );
      } else {
        this.showToast(
          firstError || 'No se pudo programar el mensaje.',
          'danger',
          'Programado'
        );
      }
    } catch (error: any) {
      console.error('[SCHEDULE][create-error]', error);
      this.showToast(
        this.extractScheduleErrorMessage(error),
        'danger',
        'Programado'
      );
    } finally {
      this.scheduleCreateInFlight = false;
    }
  }

  private normalizeProgramarMensajesResponse(
    response: ProgramarMensajeResponseDTO | null | undefined
  ): { okCount: number; errorMessage: string } {
    const items = (
      Array.isArray(response?.items) ? response?.items : []
    ) as Array<{ status?: unknown; estado?: unknown; error?: unknown; mensaje?: unknown }>;
    if (items.length === 0) {
      const ok = response?.ok === true;
      return {
        okCount: ok ? 1 : 0,
        errorMessage: String(response?.message || response?.mensaje || '').trim(),
      };
    }

    const isOk = (statusRaw: unknown): boolean => {
      const status = String(statusRaw || '').trim().toUpperCase();
      if (!status) return false;
      return status === 'PENDING' || status === 'SENT' || status === 'PROCESSING';
    };

    const okCount = items.filter((item) => isOk(item?.status ?? item?.estado)).length;
    const firstError = items
      .map((item) => String(item?.error || item?.mensaje || '').trim())
      .find((msg) => !!msg);

    return {
      okCount,
      errorMessage:
        firstError ||
        String(response?.message || response?.mensaje || '').trim() ||
        'Error de programacion',
    };
  }

  private extractScheduleErrorMessage(error: any): string {
    const status = Number(error?.status || 0);
    const body = error?.error;
    let backendMsg = '';

    if (typeof body === 'string') {
      backendMsg = body.trim();
    } else if (body && typeof body === 'object') {
      backendMsg = String(
        body?.mensaje ||
          body?.message ||
          body?.error ||
          body?.detail ||
          body?.path ||
          ''
      ).trim();
    }
    if (!backendMsg) {
      backendMsg = String(error?.message || '').trim();
    }

    if (status === 403) {
      return (
        backendMsg ||
        '403: no tienes permisos en uno o varios chats seleccionados.'
      );
    }
    if (status === 401) {
      return backendMsg || '401: sesion expirada. Vuelve a iniciar sesion.';
    }
    return (
      backendMsg ||
      `No se pudo programar el mensaje${status ? ` (HTTP ${status})` : ''}.`
    );
  }

  private planScheduledDeliveryRealtimeProbe(
    chatIds: number[],
    scheduledAtIso: string
  ): void {
    const targets = Array.from(
      new Set(
        (Array.isArray(chatIds) ? chatIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
    if (targets.length === 0) return;

    const dueTs = Date.parse(String(scheduledAtIso || '').trim());
    if (!Number.isFinite(dueTs)) return;

    const now = Date.now();
    const baseDelay = Math.max(1200, dueTs - now + 1200);
    const checkpointsMs = [0, 15000, 45000];

    for (const extra of checkpointsMs) {
      const timer = setTimeout(() => {
        this.scheduledDeliveryProbeTimers.delete(timer);
        this.ngZone.run(() => {
          this.scheduleChatsRefresh(0);
          this.refreshActiveChatAfterScheduledProbe(targets);
        });
      }, baseDelay + extra);
      this.scheduledDeliveryProbeTimers.add(timer);
    }
  }

  private refreshActiveChatAfterScheduledProbe(targetChatIds: number[]): void {
    const activeChatId = Number(this.chatActual?.id);
    if (!Number.isFinite(activeChatId) || activeChatId <= 0) return;
    if (!Array.isArray(targetChatIds) || !targetChatIds.includes(activeChatId)) {
      return;
    }
    if (!this.chatActual) return;
    this.loadInitialMessagesPage(this.chatActual, this.getLeftGroupIdsSet());
  }

  private buildOutgoingPollPayloadDraft(
    draft: PollDraftPayload,
    createdBy: number
  ): PollPayloadV1 {
    const normalizedQuestion = String(draft?.pregunta || '').trim();
    const normalizedOptions = Array.isArray(draft?.opciones)
      ? draft.opciones
          .map((option) => String(option || '').trim())
          .filter((option) => !!option)
      : [];
    const uniqueOptions = normalizedOptions.filter(
      (option, idx, list) =>
        list.findIndex((x) => x.toLowerCase() === option.toLowerCase()) === idx
    );

    return {
      type: 'POLL_V1',
      question: normalizedQuestion,
      allowMultiple: draft?.permitirMultiples === true,
      options: uniqueOptions.map((text, index) => ({
        id: `opt_${index + 1}`,
        text,
        voteCount: 0,
        voterIds: [],
      })),
      totalVotes: 0,
      statusText:
        draft?.permitirMultiples === true
          ? 'Selecciona una o varias opciones.'
          : 'Selecciona una opción.',
      createdAt: new Date().toISOString(),
      createdBy:
        Number.isFinite(Number(createdBy)) && Number(createdBy) > 0
          ? Number(createdBy)
          : undefined,
    };
  }

  public async onGroupPollDraftSubmit(payload: PollDraftPayload): Promise<void> {
    if (!this.chatActual?.esGrupo) return;
    if (
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.chatGrupalCerradoPorAdmin
    ) {
      return;
    }
    if (this.noGroupRecipientsForSend) {
      this.showToast('Todavia no ha aceptado nadie.', 'warning', 'Grupo');
      return;
    }

    const myId = this.getMyUserId ? this.getMyUserId() : this.usuarioActualId;
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    const pollPayload = this.buildOutgoingPollPayloadDraft(payload, myId);
    if (!pollPayload.question || pollPayload.options.length < 2) {
      this.showToast(
        'La encuesta necesita pregunta y al menos 2 opciones.',
        'warning',
        'Encuesta'
      );
      return;
    }

    if (this.groupTextSendInFlightByChatId.has(chatId)) return;
    this.groupTextSendInFlightByChatId.add(chatId);
    try {
      if (!this.e2eSessionReady) {
        const synced = await this.forceSyncMyE2EPublicKeyForRetry();
        if (!synced) {
          this.showToast(
            'No se pudo sincronizar tu clave E2E. Revisa tu sesión antes de enviar la encuesta.',
            'danger',
            'E2E'
          );
          return;
        }
      }

      const plainPollContent = JSON.stringify(pollPayload);
      const encryptedGroup = await this.buildOutgoingE2EContentForGroup(
        this.chatActual,
        plainPollContent
      );

      // Backend actual soporta tipo POLL y mantiene compatibilidad con metadata.
      const outgoing: MensajeDTO = {
        contenido: encryptedGroup.content,
        emisorId: myId,
        receptorId: chatId,
        chatId,
        activo: true,
        tipo: 'POLL',
        reenviado: false,
      };
      outgoing.poll = pollPayload;
      outgoing.pollType = 'POLL_V1';
      outgoing.contentKind = 'POLL';
      this.attachTemporaryMetadata(outgoing);

      const strictValidation = this.validateOutgoingGroupPayloadStrict(
        outgoing.contenido,
        encryptedGroup.expectedRecipientIds
      );
      if (!strictValidation.ok) {
        this.showToast(
          `No se pudo enviar la encuesta: ${
            strictValidation.reason ||
            strictValidation.code ||
            'payload E2E_GROUP inválido'
          }.`,
          'danger',
          'E2E'
        );
        return;
      }

      const optimisticMessage: MensajeDTO = {
        id: -(Date.now() + Math.floor(Math.random() * 1000)),
        chatId,
        emisorId: myId,
        receptorId: chatId,
        contenido: plainPollContent,
        fechaEnvio: new Date().toISOString(),
        activo: true,
        tipo: 'POLL',
        reenviado: false,
        leido: true,
        poll: pollPayload,
        pollType: 'POLL_V1',
        contentKind: 'POLL',
      };
      if (this.chatActual && Number(this.chatActual.id) === chatId) {
        this.mensajesSeleccionados = [...this.mensajesSeleccionados, optimisticMessage];
        this.syncActiveHistoryStateMessages();
        this.scrollAlFinal();
      }

      this.chats = updateChatPreview(
        this.chats || [],
        chatId,
        `Encuesta: ${pollPayload.question}`
      );
      const chatItem = (this.chats || []).find(
        (c: any) => Number(c?.id) === Number(chatId)
      );
      if (chatItem) {
        chatItem.unreadCount = 0;
        this.stampChatLastMessageFieldsFromMessage(chatItem, optimisticMessage);
      }

      await this.logGroupWsPayloadBeforeSend(
        'send-message-group-poll',
        outgoing,
        strictValidation.forReceptoresKeys
      );
      this.wsService.enviarMensajeGrupal(outgoing);
      this.closeGroupPollComposer();
      this.showToast('Encuesta enviada.', 'success', 'Encuesta', 1500);
    } catch (err: any) {
      console.warn('[POLL][send-failed]', {
        chatId,
        error: err?.message || String(err),
      });
      this.showToast(
        'No se pudo enviar la encuesta.',
        'danger',
        'Encuesta'
      );
    } finally {
      this.groupTextSendInFlightByChatId.delete(chatId);
    }
  }

  public toggleTemporaryMessagePopup(event: MouseEvent): void {
    event.stopPropagation();
    if (
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.chatGrupalCerradoPorAdmin
    ) {
      return;
    }
    if (this.showTemporaryMessagePopup) {
      this.closeTemporaryMessagePopup();
      return;
    }
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.showTemporaryMessagePopup = true;
  }

  public selectTemporaryMessageOption(
    option: TemporaryMessageOption,
    event?: MouseEvent
  ): void {
    event?.stopPropagation();
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.closeTemporaryMessagePopup();
      return;
    }
    this.setTemporarySecondsForChat(chatId, option.seconds);
    this.closeTemporaryMessagePopup();
    if (option.seconds && option.seconds > 0) {
      this.showToast(
        `Mensajes temporales activados: ${option.label}.`,
        'info',
        'Temporal',
        1800
      );
    } else {
      this.showToast(
        'Mensajes temporales desactivados en este chat.',
        'info',
        'Temporal',
        1800
      );
    }
  }

  public isTemporaryMessageOptionSelected(option: TemporaryMessageOption): boolean {
    const activeSeconds = this.getActiveChatTemporarySeconds();
    if (!option.seconds || option.seconds <= 0) {
      return !activeSeconds || activeSeconds <= 0;
    }
    return Number(activeSeconds || 0) === Number(option.seconds);
  }

  public toggleEmojiPicker(event: MouseEvent): void {
    event.stopPropagation();
    if (
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin
    ) {
      return;
    }
    this.onMessageInputSelectionChange();
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeTemporaryMessagePopup();
    if (this.showEmojiPicker) {
      this.closeEmojiPicker();
      return;
    }
    this.openEmojiPicker();
  }

  public onEmojiSelected(emoji: string): void {
    if (
      !emoji ||
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin
    ) {
      return;
    }
    this.insertEmojiAtCursor(emoji);
  }

  public onStickerTabOpen(): void {
    if (this.stickersLoading || this.myStickers.length > 0) return;
    this.loadMyStickers();
  }

  public openStickerFilePicker(): void {
    if (
      this.haSalidoDelGrupo ||
      this.chatEstaBloqueado ||
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin
    ) {
      return;
    }
    this.stickerFileInputRef?.nativeElement?.click();
  }

  public onStickerFileSelected(event: Event): void {
    const input = event?.target as HTMLInputElement | null;
    const file = input?.files?.[0] || null;
    if (input) input.value = '';
    if (!file) return;

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowedTypes.has(String(file.type || '').toLowerCase())) {
      this.showToast('Formato no válido. Usa PNG, JPG, WEBP o GIF.', 'warning', 'Sticker');
      return;
    }

    const maxSizeBytes = 8 * 1024 * 1024;
    if (Number(file.size || 0) > maxSizeBytes) {
      this.showToast('El sticker supera 8MB.', 'warning', 'Sticker');
      return;
    }

    this.resetStickerEditor();
    this.stickerDraftFile = file;
    this.stickerDraftName = String(file.name || '').replace(/\.[^.]+$/, '').slice(0, 60);
    this.stickerDraftPreviewUrl = URL.createObjectURL(file);
    this.stickerEditorVisible = true;
    this.closeEmojiPicker();
  }

  public cancelStickerCreation(): void {
    this.resetStickerEditor();
  }

  public saveEditedSticker(payload: StickerEditorSaveEvent): void {
    if (!payload?.file || this.stickerSaving) return;
    const safeMime = String(payload.mimeType || payload.file.type || '').toLowerCase();
    if (safeMime !== 'image/png' && safeMime !== 'image/webp') {
      this.showToast('Formato final no válido. Usa PNG o WEBP.', 'warning', 'Sticker');
      return;
    }
    const maxSizeBytes = 8 * 1024 * 1024;
    if (Number(payload.file.size || 0) > maxSizeBytes) {
      this.showToast('El sticker final supera 8MB.', 'warning', 'Sticker');
      return;
    }

    this.stickerSaving = true;
    const stickerName = String(payload.nombre || this.stickerDraftName || '').trim();
    this.stickerService
      .createSticker(payload.file, stickerName)
      .pipe(
        finalize(() => {
          this.stickerSaving = false;
        })
      )
      .subscribe({
        next: () => {
          this.showToast('Sticker guardado.', 'success', 'Sticker', 1600);
          this.resetStickerEditor();
          this.loadMyStickers();
        },
        error: (err) => {
          const message = String(
            err?.error?.mensaje || err?.error?.message || err?.message || ''
          ).trim();
          this.showToast(message || 'No se pudo guardar el sticker.', 'warning', 'Sticker');
        },
      });
  }

  public deleteSticker(stickerId: number): void {
    const safeId = Number(stickerId);
    if (!Number.isFinite(safeId) || safeId <= 0) return;
    this.stickerService.deleteSticker(Math.round(safeId)).subscribe({
      next: () => {
        const removed = this.myStickers.find(
          (item) => Number(item?.id) === Math.round(safeId)
        );
        const previewUrl = String(removed?.imageUrl || '').trim();
        if (previewUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(previewUrl);
          } catch {}
          this.stickerPreviewObjectUrls = this.stickerPreviewObjectUrls.filter(
            (url) => url !== previewUrl
          );
        }
        this.myStickers = this.myStickers.filter((item) => Number(item?.id) !== Math.round(safeId));
        this.showToast('Sticker eliminado.', 'info', 'Sticker', 1600);
      },
      error: (err) => {
        const message = String(
          err?.error?.mensaje || err?.error?.message || err?.message || ''
        ).trim();
        this.showToast(message || 'No se pudo eliminar el sticker.', 'warning', 'Sticker');
      },
    });
  }

  public async onStickerSelected(sticker: StickerDTO): Promise<void> {
    if (!this.chatActual || this.attachmentUploading || this.stickerSaving) return;
    const stickerId = Number(sticker?.id || 0);
    if (!Number.isFinite(stickerId) || stickerId <= 0) {
      this.showToast('Sticker inválido.', 'warning', 'Sticker');
      return;
    }
    try {
      this.attachmentUploading = true;
      const blob = await firstValueFrom(
        this.stickerService.getStickerArchivoBlob(
          stickerId,
          String(sticker?.archivoUrl || sticker?.url || sticker?.ruta || '').trim() || null
        )
      );
      const mime = String(sticker?.tipoMime || sticker?.mimeType || blob.type || 'image/png').trim();
      const ext =
        mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : 'jpg';
      const safeName = String(sticker?.nombre || 'sticker').trim() || 'sticker';
      const file = new File([blob], `${safeName}.${ext}`, { type: mime });
      await this.enviarImagenSeguro(file, '', true, stickerId);
      this.closeEmojiPicker();
    } catch {
      this.showToast('No se pudo enviar el sticker.', 'warning', 'Sticker');
    } finally {
      this.attachmentUploading = false;
    }
  }

  public resetStickerEditor(): void {
    if (this.stickerDraftPreviewUrl) {
      try {
        URL.revokeObjectURL(this.stickerDraftPreviewUrl);
      } catch {}
    }
    this.stickerEditorVisible = false;
    this.stickerDraftFile = null;
    this.stickerDraftPreviewUrl = null;
    this.stickerDraftName = '';
  }

  private loadMyStickers(): void {
    this.stickersLoading = true;
    this.stickerService
      .getMyStickers()
      .pipe(
        finalize(() => {
          this.stickersLoading = false;
        })
      )
      .subscribe({
        next: async (items) => {
          await this.hydrateStickerPreviews(items || []);
          if (this.showIncomingStickerSavePopup) {
            this.ensureStickerOwnershipStateWithLoadedCollection(
              this.incomingStickerPreviewSrc,
              this.incomingStickerSuggestedName
            );
          }
        },
        error: () => {
          this.clearStickerPreviewObjectUrls();
          this.myStickers = [];
          this.showToast('No se pudieron cargar tus stickers.', 'warning', 'Sticker');
        },
      });
  }

  private resolveStickerImageUrl(sticker: StickerDTO): string {
    const raw = String(
      sticker?.archivoUrl ||
        sticker?.imageUrl ||
        sticker?.url ||
        sticker?.stickerUrl ||
        sticker?.ruta ||
        ''
    ).trim();
    if (!raw) return '';
    return resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
  }

  private async hydrateStickerPreviews(items: StickerDTO[]): Promise<void> {
    this.clearStickerPreviewObjectUrls();

    const hydrated = await Promise.all(
      (items || []).map(async (item) => {
        const stickerId = Number(item?.id || 0);
        if (!Number.isFinite(stickerId) || stickerId <= 0) {
          return {
            ...item,
            imageUrl: this.resolveStickerImageUrl(item),
          };
        }

        try {
          const blob = await firstValueFrom(
            this.stickerService.getStickerArchivoBlob(stickerId, item?.archivoUrl || null)
          );
          const objectUrl = URL.createObjectURL(blob);
          this.stickerPreviewObjectUrls.push(objectUrl);
          return {
            ...item,
            imageUrl: objectUrl,
          };
        } catch {
          return {
            ...item,
            imageUrl: this.resolveStickerImageUrl(item),
          };
        }
      })
    );

    this.myStickers = hydrated;
  }

  private clearStickerPreviewObjectUrls(): void {
    for (const url of this.stickerPreviewObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.stickerPreviewObjectUrls = [];
  }

  public openAttachmentPicker(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.shouldDisableAttachmentAction()) return;
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();
    this.attachmentInputRef?.nativeElement?.click();
  }

  public async onAttachmentSelected(event: Event): Promise<void> {
    const input = event?.target as HTMLInputElement | null;
    const files = this.extractFilesFromInput(input);
    if (input) input.value = '';
    await this.handleSelectedAttachments(files, 'picker');
  }

  public onMessageAreaDragEnter(event: DragEvent): void {
    if (!this.isFileDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.messageAreaDragDepth++;
    if (this.canAcceptDroppedAttachments()) {
      this.messageAreaDragActive = true;
    }
  }

  public onMessageAreaDragOver(event: DragEvent): void {
    if (!this.isFileDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.canAcceptDroppedAttachments()
        ? 'copy'
        : 'none';
    }
    if (this.canAcceptDroppedAttachments()) {
      this.messageAreaDragActive = true;
    }
  }

  public onMessageAreaDragLeave(event: DragEvent): void {
    if (!this.isFileDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.messageAreaDragDepth = Math.max(0, this.messageAreaDragDepth - 1);
    if (this.messageAreaDragDepth === 0) {
      this.messageAreaDragActive = false;
    }
  }

  public async onMessageAreaDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.messageAreaDragDepth = 0;
    this.messageAreaDragActive = false;
    const zippedFolder = await this.resolveDroppedFolderAsZip(event.dataTransfer);
    if (zippedFolder) {
      await this.handleSelectedAttachments([zippedFolder], 'drop');
      return;
    }
    const files = Array.from(event.dataTransfer?.files || []);
    await this.handleSelectedAttachments(files, 'drop');
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

  private extractFilesFromInput(input: HTMLInputElement | null): File[] {
    if (!input?.files || input.files.length === 0) return [];
    return Array.from(input.files);
  }

  private isFileDragEvent(event: DragEvent): boolean {
    const types = Array.from(event.dataTransfer?.types || []);
    return types.includes('Files');
  }

  private canAcceptDroppedAttachments(): boolean {
    if (this.activeMainView !== 'chat') return false;
    if (this.chatSeleccionadoId === null) return false;
    return !this.shouldDisableAttachmentAction();
  }

  private setPendingAttachment(file: File): void {
    this.clearPendingAttachment(false);
    this.pendingAttachmentFile = file;
    this.pendingAttachmentIsImage = /^image\//i.test(file.type || '');
    this.pendingAttachmentPreviewUrl = this.pendingAttachmentIsImage
      ? URL.createObjectURL(file)
      : null;
  }

  private splitValidAndOversizedAttachments(files: File[]): {
    validFiles: File[];
    oversizedFiles: File[];
  } {
    const validFiles: File[] = [];
    const oversizedFiles: File[] = [];
    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (Number(file.size || 0) > this.MAX_ATTACHMENT_FILE_SIZE_BYTES) {
        oversizedFiles.push(file);
      } else {
        validFiles.push(file);
      }
    }
    return { validFiles, oversizedFiles };
  }

  private async handleSelectedAttachments(
    files: File[],
    source: 'picker' | 'drop'
  ): Promise<void> {
    const normalizedFiles = Array.isArray(files)
      ? files.filter((f): f is File => f instanceof File)
      : [];
    if (normalizedFiles.length === 0) return;

    if (this.shouldDisableAttachmentAction()) {
      return;
    }

    if (source === 'drop' && !this.canAcceptDroppedAttachments()) {
      this.showToast(
        'Selecciona un chat activo para adjuntar archivos.',
        'warning',
        'Adjunto'
      );
      return;
    }

    let selectedFile = normalizedFiles[0];
    if (normalizedFiles.length > 1) {
      this.showToast(
        'Solo se tomara el primer archivo del grupo arrastrado.',
        'warning',
        'Adjunto'
      );
    }

    const { validFiles } = this.splitValidAndOversizedAttachments([selectedFile]);
    if (validFiles.length === 0) {
      this.showToast('El archivo supera 25MB.', 'warning', 'Adjunto');
      return;
    }

    this.setPendingAttachment(validFiles[0]);
    this.showToast('Archivo listo para enviar.', 'info', 'Adjunto', 1600);
  }

  private async resolveDroppedFolderAsZip(
    dataTransfer: DataTransfer | null | undefined
  ): Promise<File | null> {
    const entries = this.extractDropEntries(dataTransfer);
    const directoryEntries = entries.filter((entry: any) => !!entry?.isDirectory);
    if (directoryEntries.length === 0) return null;

    const collected: Array<{ file: File; path: string }> = [];
    for (const dirEntry of directoryEntries) {
      await this.collectDroppedEntryFiles(dirEntry, '', collected);
    }
    if (collected.length === 0) return null;

    const rootName =
      directoryEntries.length === 1
        ? String(directoryEntries[0]?.name || 'carpeta')
        : `carpeta-${Date.now()}`;
    const zip = new JSZip();
    for (const item of collected) {
      const path = String(item.path || item.file.name || '').replace(/\\/g, '/');
      if (!path) continue;
      zip.file(path, item.file);
    }
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const zipFile = new File([zipBlob], `${rootName}.zip`, {
      type: 'application/zip',
    });
    this.showToast(
      `Carpeta convertida a ZIP (${collected.length} archivos).`,
      'info',
      'Carpeta'
    );
    return zipFile;
  }

  private extractDropEntries(
    dataTransfer: DataTransfer | null | undefined
  ): any[] {
    const items = Array.from(dataTransfer?.items || []);
    const entries: any[] = [];
    for (const item of items) {
      const entry =
        (item as any)?.webkitGetAsEntry?.() ||
        (item as any)?.getAsEntry?.() ||
        null;
      if (entry) entries.push(entry);
    }
    return entries;
  }

  private async collectDroppedEntryFiles(
    entry: any,
    basePath: string,
    output: Array<{ file: File; path: string }>
  ): Promise<void> {
    if (!entry) return;
    if (entry.isFile) {
      const file = await this.getFileFromDroppedEntry(entry);
      if (!file) return;
      const path = basePath
        ? `${basePath}/${file.name}`
        : String(file.name || 'archivo');
      output.push({ file, path });
      return;
    }
    if (!entry.isDirectory) return;

    const nextBase = basePath
      ? `${basePath}/${entry.name}`
      : String(entry.name || 'carpeta');
    const children = await this.readDroppedDirectoryEntries(entry);
    for (const child of children) {
      await this.collectDroppedEntryFiles(child, nextBase, output);
    }
  }

  private async readDroppedDirectoryEntries(directoryEntry: any): Promise<any[]> {
    const reader = directoryEntry?.createReader?.();
    if (!reader) return [];
    const all: any[] = [];
    for (;;) {
      const batch = await new Promise<any[]>((resolve) => {
        try {
          reader.readEntries(
            (entries: any[]) => resolve(Array.isArray(entries) ? entries : []),
            () => resolve([])
          );
        } catch {
          resolve([]);
        }
      });
      if (batch.length === 0) break;
      all.push(...batch);
    }
    return all;
  }

  private async getFileFromDroppedEntry(fileEntry: any): Promise<File | null> {
    return await new Promise<File | null>((resolve) => {
      try {
        fileEntry.file(
          (file: File) => resolve(file),
          () => resolve(null)
        );
      } catch {
        resolve(null);
      }
    });
  }

  public formatAttachmentSize(bytes: number): string {
    return formatAttachmentSizeUtil(bytes);
  }

  public async enviarMensajeDesdeComposer(): Promise<void> {
    if (!this.canSendComposerMessage) {
      return;
    }
    if (this.chatEsSoloLecturaPorAdmin || this.chatGrupalCerradoPorAdmin) return;
    if (this.attachmentUploading) return;
    this.limpiarRespuestasRapidas();
    this.closeComposeActionsPopup();
    this.closeComposeAiPopup();
    this.closeEmojiPicker();
    this.closeTemporaryMessagePopup();

    if (this.mensajeEdicionObjetivo) {
      if (this.pendingAttachmentFile) {
        this.showToast(
          'Quita el adjunto pendiente para editar el mensaje.',
          'warning',
          'Editar'
        );
        return;
      }
      await this.editarMensajeDesdeComposer();
      return;
    }

    if (this.pendingAttachmentFile) {
      if (this.pendingAttachmentIsImage) {
        await this.enviarImagenSeguro(this.pendingAttachmentFile, this.mensajeNuevo);
        return;
      }
      await this.enviarArchivoSeguro(this.pendingAttachmentFile, this.mensajeNuevo);
      return;
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
    this.showEmojiPicker = true;
  }

  private closeComposeActionsPopup(): void {
    this.showComposeActionsPopup = false;
  }

  private closeComposeAiPopup(): void {
    this.showComposeAiPopup = false;
    this.composerAiError = null;
    this.mostrarMenuIdiomasIa = false;
    this.idiomaSeleccionadoIa = null;
    this.filtroIdiomasIa = '';
  }

  private closeEmojiPicker(immediate = false): void {
    void immediate;
    this.showEmojiPicker = false;
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
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin ||
      this.noGroupRecipientsForSend
    );
  }

  private isUploadTooLargeError(err: any): boolean {
    const status = Number(err?.status || 0);
    if (status === 413) return true;
    const message = String(
      err?.error?.mensaje || err?.error?.message || err?.message || ''
    ).toLowerCase();
    return (
      message.includes('maximum upload size exceeded') ||
      message.includes('maxuploadsizeexceededexception') ||
      message.includes('payload too large') ||
      message.includes('tamano maximo') ||
      message.includes('tamaño maximo')
    );
  }

  private async uploadPendingAttachmentIntoMessage(): Promise<boolean> {
    if (!this.pendingAttachmentFile) return true;
    const chatId = Number(this.chatActual?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      this.showToast('Selecciona un chat antes de adjuntar archivos.', 'warning', 'Adjunto');
      return false;
    }
    this.attachmentUploading = true;
    try {
      const uploaded = await this.mensajeriaService.uploadFile(
        this.pendingAttachmentFile,
        chatId
      );
      const icon = this.pendingAttachmentIsImage ? '???' : '??';
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
      if (this.isUploadTooLargeError(err)) {
        this.showToast(
          'El archivo supera el limite de subida del servidor.',
          'warning',
          'Adjunto'
        );
      } else if (status === 403) {
        this.showToast(
          'No tienes permisos para adjuntar archivos en este chat.',
          'warning',
          'Adjunto'
        );
      } else if (status === 400) {
        this.showToast(
          backendMsg || 'Solicitud inválida al subir el archivo.',
          'warning',
          'Adjunto'
        );
      } else if (status === 404) {
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
    captionRaw: string,
    asSticker = false,
    stickerSourceId?: number | null
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
          chatId,
          `img-${Date.now()}.bin`
        );
        built.payload.imageUrl = upload.url;
        built.payload.imageMime = imageFile.type || built.payload.imageMime || 'image/jpeg';
        built.payload.imageNombre = imageFile.name || built.payload.imageNombre || undefined;
        if (asSticker) {
          (built.payload as any).sticker = true;
          (built.payload as any).contentKind = 'STICKER';
          if (Number.isFinite(Number(stickerSourceId)) && Number(stickerSourceId) > 0) {
            (built.payload as any).stickerId = Math.round(Number(stickerSourceId));
          }
        }

        const payloadContenido = JSON.stringify(built.payload);
        const outgoing: MensajeDTO = {
          tipo: asSticker ? 'STICKER' : 'IMAGE',
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
        if (asSticker) outgoing.contentKind = 'STICKER';
        if (asSticker && Number.isFinite(Number(stickerSourceId)) && Number(stickerSourceId) > 0) {
          outgoing.stickerId = Math.round(Number(stickerSourceId));
        }
        this.attachTemporaryMetadata(outgoing);

        this.chats = updateChatPreview(
          this.chats || [],
          chatId,
          asSticker ? 'Sticker' : caption ? `Imagen: ${caption}` : 'Imagen'
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
          chatId,
          `img-${Date.now()}.bin`
        );
        built.payload.imageUrl = upload.url;
        built.payload.imageMime = imageFile.type || built.payload.imageMime || 'image/jpeg';
        built.payload.imageNombre = imageFile.name || built.payload.imageNombre || undefined;
        if (asSticker) {
          (built.payload as any).sticker = true;
          (built.payload as any).contentKind = 'STICKER';
          if (Number.isFinite(Number(stickerSourceId)) && Number(stickerSourceId) > 0) {
            (built.payload as any).stickerId = Math.round(Number(stickerSourceId));
          }
        }

        const payloadContenido = JSON.stringify(built.payload);
        const outgoing: MensajeDTO = {
          tipo: asSticker ? 'STICKER' : 'IMAGE',
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
        if (asSticker) outgoing.contentKind = 'STICKER';
        if (asSticker && Number.isFinite(Number(stickerSourceId)) && Number(stickerSourceId) > 0) {
          outgoing.stickerId = Math.round(Number(stickerSourceId));
        }
        this.attachTemporaryMetadata(outgoing);
        this.chats = updateChatPreview(
          this.chats || [],
          chatId,
          asSticker ? 'Sticker' : caption ? `Imagen: ${caption}` : 'Imagen'
        );
        const chatItem = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
        if (chatItem) chatItem.unreadCount = 0;
        this.wsService.enviarMensajeIndividual(outgoing);
      }

      this.clearPendingAttachment();
      this.mensajeNuevo = '';
      this.composerDraftPrefixVisible = false;
      this.clearStoredDraftForChat(chatId);
      this.cancelarRespuestaMensaje();
      this.cdr.markForCheck();
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const backendCode = String(err?.error?.code || '').trim();
      const backendTrace = String(err?.error?.traceId || '').trim();
      const backendMsg = String(
        err?.error?.mensaje || err?.error?.message || err?.message || ''
      ).trim();
      const traceSuffix = backendTrace ? ` (traceId: ${backendTrace})` : '';
      const detail =
        backendMsg ||
        backendCode ||
        (status === 403
          ? 'No tienes permisos para enviar imágenes en este chat.'
          : status === 400
          ? 'Solicitud inválida para enviar la imagen.'
          : '');
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

  private async enviarArchivoSeguro(
    file: File,
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

        const built = await this.buildOutgoingE2EFileForGroup(
          this.chatActual,
          file,
          caption
        );
        const upload = await this.mensajeriaService.uploadFile(
          built.encryptedBlob,
          chatId,
          `file-${Date.now()}.bin`
        );
        built.payload.fileUrl = upload.url;
        built.payload.fileMime =
          file.type || upload.mime || built.payload.fileMime || 'application/octet-stream';
        built.payload.fileNombre =
          file.name || upload.fileName || built.payload.fileNombre || undefined;
        built.payload.fileSizeBytes = Number(upload.sizeBytes || file.size || 0) || 0;

        const payloadContenido = JSON.stringify(built.payload);
        const outgoing: MensajeDTO = {
          tipo: 'FILE',
          contenido: payloadContenido,
          emisorId: myId,
          receptorId: chatId,
          activo: true,
          chatId,
          reenviado: false,
          fileUrl: upload.url,
          fileMime:
            file.type || upload.mime || built.payload.fileMime || 'application/octet-stream',
          fileNombre:
            file.name || upload.fileName || built.payload.fileNombre || null,
          fileSizeBytes: Number(upload.sizeBytes || file.size || 0) || 0,
          replyToMessageId: this.mensajeRespuestaObjetivo?.id
            ? Number(this.mensajeRespuestaObjetivo.id)
            : undefined,
          replySnippet: this.getComposeReplySnippet(),
          replyAuthorName: this.getComposeReplyAuthorName(),
        };
        this.attachTemporaryMetadata(outgoing);

        const chatItem = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
        const preview = buildPreviewFromMessage(outgoing, chatItem, myId);
        this.chats = updateChatPreview(this.chats || [], chatId, preview);
        const chatAfter = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
        if (chatAfter) {
          chatAfter.unreadCount = 0;
          chatAfter.ultimaMensajeTipo = 'FILE';
          chatAfter.__ultimaTipo = 'FILE';
          chatAfter.ultimaMensajeEmisorId = Number(myId);
          chatAfter.__ultimaEsArchivo = true;
          chatAfter.__ultimaArchivoNombre = String(outgoing.fileNombre || '').trim();
          chatAfter.__ultimaArchivoMime = String(outgoing.fileMime || '').trim();
          chatAfter.__ultimaArchivoCaption = String(caption || '').trim();
          chatAfter.ultimaMensajeFileNombre = outgoing.fileNombre || null;
          chatAfter.ultimaMensajeFileMime = outgoing.fileMime || null;
          chatAfter.ultimaMensajeFileSizeBytes = Number(outgoing.fileSizeBytes || 0) || 0;
        }

        await this.logGroupWsPayloadBeforeSend(
          'send-message-group-file',
          outgoing,
          built.forReceptoresKeys
        );
        this.wsService.enviarMensajeGrupal(outgoing);
      } else {
        const built = await this.buildOutgoingE2EFileForIndividual(
          receptorId,
          file,
          caption
        );
        const upload = await this.mensajeriaService.uploadFile(
          built.encryptedBlob,
          chatId,
          `file-${Date.now()}.bin`
        );
        built.payload.fileUrl = upload.url;
        built.payload.fileMime =
          file.type || upload.mime || built.payload.fileMime || 'application/octet-stream';
        built.payload.fileNombre =
          file.name || upload.fileName || built.payload.fileNombre || undefined;
        built.payload.fileSizeBytes = Number(upload.sizeBytes || file.size || 0) || 0;

        const payloadContenido = JSON.stringify(built.payload);
        const outgoing: MensajeDTO = {
          tipo: 'FILE',
          contenido: payloadContenido,
          emisorId: myId,
          receptorId,
          activo: true,
          chatId,
          reenviado: false,
          fileUrl: upload.url,
          fileMime:
            file.type || upload.mime || built.payload.fileMime || 'application/octet-stream',
          fileNombre:
            file.name || upload.fileName || built.payload.fileNombre || null,
          fileSizeBytes: Number(upload.sizeBytes || file.size || 0) || 0,
          replyToMessageId: this.mensajeRespuestaObjetivo?.id
            ? Number(this.mensajeRespuestaObjetivo.id)
            : undefined,
          replySnippet: this.getComposeReplySnippet(),
          replyAuthorName: this.getComposeReplyAuthorName(),
        };
        this.attachTemporaryMetadata(outgoing);

        const chatItem = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
        const preview = buildPreviewFromMessage(outgoing, chatItem, myId);
        this.chats = updateChatPreview(this.chats || [], chatId, preview);
        const chatAfter = (this.chats || []).find((c: any) => Number(c.id) === Number(chatId));
        if (chatAfter) {
          chatAfter.unreadCount = 0;
          chatAfter.ultimaMensajeTipo = 'FILE';
          chatAfter.__ultimaTipo = 'FILE';
          chatAfter.ultimaMensajeEmisorId = Number(myId);
          chatAfter.__ultimaEsArchivo = true;
          chatAfter.__ultimaArchivoNombre = String(outgoing.fileNombre || '').trim();
          chatAfter.__ultimaArchivoMime = String(outgoing.fileMime || '').trim();
          chatAfter.__ultimaArchivoCaption = String(caption || '').trim();
          chatAfter.ultimaMensajeFileNombre = outgoing.fileNombre || null;
          chatAfter.ultimaMensajeFileMime = outgoing.fileMime || null;
          chatAfter.ultimaMensajeFileSizeBytes = Number(outgoing.fileSizeBytes || 0) || 0;
        }
        this.wsService.enviarMensajeIndividual(outgoing);
      }

      this.clearPendingAttachment();
      this.mensajeNuevo = '';
      this.composerDraftPrefixVisible = false;
      this.clearStoredDraftForChat(chatId);
      this.cancelarRespuestaMensaje();
      this.cdr.markForCheck();
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const backendCode = String(err?.error?.code || '').trim();
      const backendTrace = String(err?.error?.traceId || '').trim();
      const backendMsg = String(
        err?.error?.mensaje || err?.error?.message || err?.message || ''
      ).trim();
      const traceSuffix = backendTrace ? ` (traceId: ${backendTrace})` : '';
      const detail =
        backendMsg ||
        backendCode ||
        (status === 403
          ? 'No tienes permisos para enviar archivos en este chat.'
          : status === 400
          ? 'Solicitud inválida para enviar el archivo.'
          : '');
      if (this.isUploadTooLargeError(err)) {
        this.showToast(
          'No se pudo enviar el archivo: supera el limite de subida del servidor.',
          'warning',
          'Archivo'
        );
      } else {
        this.showToast(
          detail
            ? `No se pudo enviar el archivo: ${detail}${traceSuffix}`
            : 'No se pudo enviar el archivo.',
          'danger',
          backendCode.startsWith('E2E_') ? 'E2E' : 'Archivo'
        );
      }
      console.warn('[E2E][file-send-error]', {
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

  private scheduleComposerTextareaResize(): void {
    if (this.composerResizeQueued) return;
    this.composerResizeQueued = true;
    setTimeout(() => {
      this.composerResizeQueued = false;
      this.resizeComposerTextarea();
    }, 0);
  }

  private resizeComposerTextarea(textarea?: HTMLTextAreaElement | null): void {
    const el = textarea || this.getMessageInputElement();
    if (!el) return;
    const minHeight = this.composerTextareaMinHeightPx;
    const maxHeight = this.composerTextareaMaxHeightPx;
    // Medir siempre desde la altura base evita crecer por la altura intrinseca del textarea.
    el.style.height = `${minHeight}px`;
    const contentHeight = Math.ceil(Number(el.scrollHeight || 0));
    const nextHeight = Math.max(
      minHeight,
      Math.min(contentHeight, maxHeight)
    );
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
  }

  /**
   * Evento nativo de escritura dentro del campo `textarea`. Envía a webSockets avisos de que un individuo teclea.
   */
  public onKeydown(evt: any): void {
    if (
      this.haSalidoDelGrupo ||
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin
    ) {
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
    if (
      !this.canSendComposerMessage ||
      this.chatEsSoloLecturaPorAdmin ||
      this.chatGrupalCerradoPorAdmin
    ) {
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
    this.composerDraftPrefixVisible = false;
    this.mensajeNuevo = '';
    this.limpiarRespuestasRapidas();
    this.showChatListHeaderMenu = false;
    this.openChatPinMenuChatId = null;
    this.mensajeEdicionObjetivo = null;
    this.mostrarMenuOpciones = false;
    this.openIncomingReactionPickerMessageId = null;
    this.openReactionDetailsMessageId = null;
    this.clearPendingAttachment();
    this.closeComposeActionsPopup();
    this.closeEmojiPicker(true);
    this.closeTemporaryMessagePopup();
    this.closeGroupPollComposer();
    this.closeScheduleMessageComposer();
    this.closeMessageSearchPanel();
    this.closePollVotesPanel();
    this.closeFilePreview();
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

  private normalizeValidChatId(chatIdRaw: unknown): number | null {
    const chatId = Number(chatIdRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return null;
    return Math.round(chatId);
  }

  private hasAdminMessageFlag(source: any): boolean {
    return [source?.adminMessage, source?.admin_message, source?.fromAdmin, source?.from_admin]
      .some((value) => this.isTruthyFlag(value));
  }

  private markAdminDirectChatReadOnly(chatIdRaw: unknown): void {
    const chatId = this.normalizeValidChatId(chatIdRaw);
    if (!chatId) return;
    this.adminDirectReadOnlyChatIds.add(chatId);

    const chatItem = (this.chats || []).find((c: any) => Number(c?.id) === chatId);
    if (chatItem && !chatItem?.esGrupo) {
      (chatItem as any).__adminDirectReadOnly = true;
    }
    if (Number(this.chatActual?.id) === chatId && !this.chatActual?.esGrupo) {
      (this.chatActual as any).__adminDirectReadOnly = true;
      if ((this.mensajesSeleccionados || []).length > 0) {
        this.rememberAdminDirectMessagesCache(chatId, this.mensajesSeleccionados);
      }
    }
    this.rememberAdminDirectChatCacheById(chatId);
  }

  private isAdminDirectReadOnlySnapshot(chat: any, lastMsgSnapshot?: any): boolean {
    if (!chat || !!chat?.esGrupo) return false;
    return (
      this.hasAdminMessageFlag(lastMsgSnapshot) ||
      this.hasAdminMessageFlag(chat) ||
      this.isTruthyFlag((chat as any)?.__adminDirectReadOnly) ||
      this.isTruthyFlag((chat as any)?.__ultimoAdminMessage) ||
      this.isTruthyFlag((chat as any)?.ultimoMensajeAdminMessage) ||
      this.isTruthyFlag((chat as any)?.ultimaMensajeAdminMessage)
    );
  }

  private applyAdminDirectReadOnlyFromHistory(
    chatIdRaw: unknown,
    esGrupo: boolean,
    mensajes: any[]
  ): void {
    if (esGrupo || !Array.isArray(mensajes) || mensajes.length === 0) return;
    if (!mensajes.some((m) => this.hasAdminMessageFlag(m))) return;
    this.markAdminDirectChatReadOnly(chatIdRaw);
  }

  private applyAdminDirectReadOnlyFromMessage(mensaje: any): void {
    if (!this.hasAdminMessageFlag(mensaje)) return;
    const chatId = this.normalizeValidChatId(mensaje?.chatId);
    if (!chatId) return;
    const chatItem = (this.chats || []).find((c: any) => Number(c?.id) === chatId);
    if (chatItem?.esGrupo) return;
    this.markAdminDirectChatReadOnly(chatId);
  }

  public get chatEsSoloLecturaPorAdmin(): boolean {
    if (!this.chatActual || this.chatActual?.esGrupo) return false;
    const chatId = this.normalizeValidChatId(this.chatActual?.id);
    if (!chatId) return false;
    if (this.adminDirectReadOnlyChatIds.has(chatId)) return true;

    const hasFromSnapshot = this.isAdminDirectReadOnlySnapshot(this.chatActual);
    const hasFromLoadedMessages = (this.mensajesSeleccionados || []).some((m) =>
      this.hasAdminMessageFlag(m)
    );
    return hasFromSnapshot || hasFromLoadedMessages;
  }

  public get composerInteractionDisabled(): boolean {
    return (
      this.chatEstaBloqueado ||
      this.chatGrupalCerradoPorAdmin ||
      this.chatEsSoloLecturaPorAdmin
    );
  }

  public get composerPlaceholder(): string {
    if (this.chatEsSoloLecturaPorAdmin) {
      return this.adminDirectReplyDisabledPlaceholder;
    }
    if (this.chatGrupalCerradoPorAdmin) {
      return this.chatGrupalCerradoMotivo;
    }
    if (this.chatEstaBloqueado) {
      return this.yoLoBloquee
        ? 'Has bloqueado a este usuario.'
        : 'Estás bloqueado por este usuario.';
    }
    return 'Escribe un mensaje...';
  }

  public get composerDisabledReason(): string {
    if (this.chatEsSoloLecturaPorAdmin) {
      return this.adminDirectReplyDisabledPlaceholder;
    }
    if (this.chatGrupalCerradoPorAdmin) {
      return this.chatGrupalCerradoMotivo;
    }
    if (this.chatEstaBloqueado) {
      return this.yoLoBloquee ? 'Has bloqueado a este usuario' : 'Estás bloqueado';
    }
    return '';
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

  public get yoLoBloqueeManual(): boolean {
    if (!this.chatActual || this.chatActual.esGrupo) return false;
    const peerId = this.chatActual.receptor?.id;
    if (!peerId) return false;
    return (
      this.bloqueadosIds.has(peerId) &&
      !this.bloqueadosPorDenunciaIds.has(peerId)
    );
  }

  /**
   * Invierte asimétricamente al individuo activo según su estado cacheado (Si es target bloquéndolo/ o a la inversa desbloquearlo).
   */
  public toggleBloquearUsuario(): void {
    if (!this.chatActual || this.chatActual.esGrupo) {
       return;
    }
    const peerId = this.chatActual.receptor?.id;
    if (!peerId) {
       return;
    }
    if (this.yoLoBloqueeManual) {
      this.authService.desbloquearUsuario(peerId).subscribe({
        next: () => {
          this.bloqueadosIds.delete(peerId);
          this.updateCachedBloqueados();
          this.cdr.markForCheck();
        },
        error: (err) => alert("Error al desbloquear usuario")
      });
    } else {
      if (this.bloqueadosPorDenunciaIds.has(peerId)) {
        this.showToast(
          'Este usuario está bloqueado por una denuncia.',
          'info',
          'Denuncias',
          2400
        );
        this.cerrarMenuOpciones();
        return;
      }
      this.authService.bloquearUsuario(peerId, 'MANUAL').subscribe({
        next: () => {
          this.bloqueadosIds.add(peerId);
          this.bloqueadosPorDenunciaIds.delete(peerId);
          this.updateCachedBloqueados();
          this.updateCachedBloqueadosPorDenuncia();
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

  private updateCachedBloqueadosPorDenuncia(): void {
    localStorage.setItem(
      'bloqueadosPorDenunciaIds',
      JSON.stringify(Array.from(this.bloqueadosPorDenunciaIds))
    );
  }

  private applyBlockedStateFromUserDto(u: any): void {
    const blockedIds = this.extractBlockedIdsFromUserDto(u);
    const blockedByReportIds = this.extractBlockedByReportIdsFromUserDto(u);
    this.bloqueadosIds = new Set(blockedIds);
    this.bloqueadosPorDenunciaIds = new Set(blockedByReportIds);
    this.updateCachedBloqueados();
    this.updateCachedBloqueadosPorDenuncia();
  }

  private extractBlockedIdsFromUserDto(u: any): number[] {
    const relations = Array.isArray(u?.bloqueados) ? u.bloqueados : [];
    const relationIds = relations
      .map((x: any) => Number(x?.userId || 0))
      .filter((id: number) => Number.isFinite(id) && id > 0);
    if (relationIds.length > 0) return Array.from(new Set(relationIds));

    const legacy = Array.isArray(u?.bloqueadosIds) ? u.bloqueadosIds : [];
    return Array.from(
      new Set(
        legacy
          .map((x: any) => Number(x || 0))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    );
  }

  private extractBlockedByReportIdsFromUserDto(u: any): number[] {
    const relations = Array.isArray(u?.bloqueados) ? u.bloqueados : [];
    const reportSources = new Set(['DENUNCIA', 'REPORT']);
    return Array.from(
      new Set(
        relations
          .map((x: any) => ({
            id: Number(x?.userId || 0),
            source: String(x?.source || '').trim().toUpperCase(),
          }))
          .filter(
            (x: any) =>
              Number.isFinite(x.id) && x.id > 0 && reportSources.has(x.source)
          )
          .map((x: any) => x.id)
      )
    );
  }

  /**
   * Guarda de manera perenne cada aviso que hemos pillado del websocket entrante cuando A NOSOTROS nos bloquean.
   */
  private updateCachedMeHanBloqueado(): void {
    localStorage.setItem('meHanBloqueadoIds', JSON.stringify(Array.from(this.meHanBloqueadoIds)));
  }

  public ngOnDestroy(): void {
    this.limpiarRespuestasRapidas();
    if (this.browserNotificationRouteSub) {
      this.browserNotificationRouteSub.unsubscribe();
      this.browserNotificationRouteSub = undefined;
    }
    this.wsService.limpiarSuscripcionesChatUI();
    this.persistActiveChatDraft();
    this.stopProfileCodeCountdown();
    this.clearPendingAttachment();
    this.resetStickerEditor();
    this.clearStickerPreviewObjectUrls();
    this.closeFilePreview();
    for (const timer of this.scheduledDeliveryProbeTimers) {
      clearTimeout(timer);
    }
    this.scheduledDeliveryProbeTimers.clear();
    clearTimeout(this.inactividadTimer);
    clearTimeout(this.tabOcultaTimer);
    if (this.presenciaOnActividad) {
      this.presenciaActividadEventos.forEach((evento) => {
        window.removeEventListener(evento, this.presenciaOnActividad!);
      });
    }
    if (this.presenciaOnVisibilidadChange) {
      document.removeEventListener('visibilitychange', this.presenciaOnVisibilidadChange);
    }
    clearTimeout(this.escribiendoTimeout);
    clearTimeout(this.grabandoAudioTimeout);
    if (this.recording) {
      this.notificarGrabandoAudio(false);
    }
    if (this.chatsRefreshTimer) clearTimeout(this.chatsRefreshTimer);
    if (this.groupInfoCloseTimer) clearTimeout(this.groupInfoCloseTimer);
    if (this.userInfoCloseTimer) clearTimeout(this.userInfoCloseTimer);
    if (this.messageSearchCloseTimer) clearTimeout(this.messageSearchCloseTimer);
    if (this.pollVotesCloseTimer) clearTimeout(this.pollVotesCloseTimer);
    if (this.highlightedMessageTimer) clearTimeout(this.highlightedMessageTimer);
    if (this.messageScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.messageScrollAnimationFrame);
      this.messageScrollAnimationFrame = null;
    }
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
    for (const url of this.decryptedFileUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.decryptedFileUrlByCacheKey.clear();
    this.decryptedFileCaptionByCacheKey.clear();
    this.decryptingFileByCacheKey.clear();
    for (const url of this.secureAttachmentUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.secureAttachmentUrlByCacheKey.clear();
    this.secureAttachmentLoadingByCacheKey.clear();
    this.messageReactionsByMessageId.clear();
    this.pollLocalSelectionByMessageId.clear();
    this.openIncomingReactionPickerMessageId = null;
    this.openReactionDetailsMessageId = null;
    this.showChatListHeaderMenu = false;
    this.showScheduleMessageComposer = false;
    this.showPollVotesPanel = false;
    this.showPollVotesPanelMounted = false;
    this.pollVotesPanelMessageId = null;
    this.stopOutgoingRingback();
    this.stopIncomingRingtone();
  }
}
