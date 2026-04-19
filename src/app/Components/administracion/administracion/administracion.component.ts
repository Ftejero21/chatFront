import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { DashboardStatsDTO } from '../../../Interface/DashboardStatsDTO';
import { PageResponse } from '../../../Interface/PageResponse';
import { firstValueFrom, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { StompSubscription } from '@stomp/stompjs';
import {
  AdminBulkEmailRequestDTO,
  AdminBulkEmailResponseDTO,
  AdminScheduleBulkEmailRequestDTO,
  AdminScheduleDirectMessageRequestDTO,
  AdminDirectMessageEncryptedItemDTO,
  AdminDirectMessageResponseDTO,
  AdminGroupListDTO,
  ChatService,
  ProgramarMensajeResponseDTO,
} from '../../../Service/chat/chat.service';
import {
  decryptPreviewStringE2E,
  parsePollPayload,
  resolveMediaUrl,
} from '../../../utils/chat-utils';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { environment } from '../../../environments';
import { SessionService } from '../../../Service/session/session.service';
import { WebSocketService } from '../../../Service/WebSocket/web-socket.service';
import {
  UnbanAppealDTO,
  UnbanAppealEstado,
  UnbanAppealTipoReporte,
} from '../../../Interface/UnbanAppealDTO';
import { UnbanAppealEventDTO } from '../../../Interface/UnbanAppealEventDTO';
import {
  RATE_LIMIT_SCOPES,
  RateLimitService,
} from '../../../Service/rate-limit/rate-limit.service';
import { AdminMessageComposerSubmitEvent } from '../admin-message-composer/admin-message-composer.component';

type AdminAudioE2EPayload = {
  type: 'E2E_AUDIO' | 'E2E_GROUP_AUDIO';
  ivFile: string;
  audioUrl: string;
  audioMime?: string;
  audioDuracionMs?: number;
  forAdmin: string;
};

type AdminImageE2EPayload = {
  type: 'E2E_IMAGE' | 'E2E_GROUP_IMAGE';
  ivFile: string;
  imageUrl: string;
  imageMime?: string;
  imageNombre?: string;
  captionIv?: string;
  captionCiphertext?: string;
  forAdmin: string;
};

type AdminFileE2EPayload = {
  type: 'E2E_FILE' | 'E2E_GROUP_FILE';
  ivFile: string;
  fileUrl: string;
  fileMime?: string;
  fileNombre?: string;
  fileSizeBytes?: number;
  captionIv?: string;
  captionCiphertext?: string;
  forAdmin?: string;
  forEmisor?: string;
  forReceptor?: string;
  forReceptores?: Record<string, string>;
};
type AdminPollVoterView = {
  userId: number;
  photoUrl: string | null;
  initials: string;
};

type AdminPollOptionView = {
  id: string;
  text: string;
  count: number;
  percent: number;
  selected: boolean;
  isLeading: boolean;
  voters: AdminPollVoterView[];
};

type TemporalEstado = 'ACTIVO' | 'EXPIRADO' | 'NO_TEMPORAL';
type AdminTemporalFilter = 'TODOS' | TemporalEstado;
type AdminGroupStatusFilter = 'TODOS' | 'ACTIVO' | 'INACTIVO';
type AdminGroupVisibilityFilter = 'TODOS' | 'PUBLICO' | 'PRIVADO';
type AdminGroupView = AdminGroupListDTO & {
  imagen?: string | null;
  fotoGrupo?: string | null;
  foto?: string | null;
  nombre?: string | null;
};

@Component({
  selector: 'app-administracion',
  templateUrl: './administracion.component.html',
  styleUrls: ['./administracion.component.css']
})
export class AdministracionComponent implements OnInit, OnDestroy {

  // Variables de control de vista
  isDashboardView: boolean = true;
  isReportsView: boolean = false;
  isComplaintsView: boolean = false;
  isGroupsView: boolean = false;
  isMessagesView: boolean = false;
  isScheduledMessagesView: boolean = false;
  isGroupsTableMode: boolean = false;
  isDashboardMenuOpen: boolean = true;
  isIncidentsMenuOpen: boolean = true;
  isMessagesMenuOpen: boolean = true;
  isSidebarOpen: boolean = false;
  headerSubtitle: string = "Gestion centralizada de TejeChat.";
  currentUserName: string = "";
  loadingConversations: boolean = false;
  loadingGroups: boolean = false;
  loadingChatMessages: boolean = false;
  isSendingAdminMessage: boolean = false;
  adminMessageComposerResetSignal: number = 0;
  selectedChatMessagesSource: 'admin' | 'group' = 'admin';
  public usuarioActualId!: number;
  userChats: any[] = [];
  selectedChat: any | null = null;
  selectedChatMensajes: any[] = [];
  adminGroups: AdminGroupView[] = [];
  groupsPage: number = 0;
  groupsPageSize: number = 10;
  groupsTotalPages: number = 1;
  groupsTotalElements: number = 0;
  groupsIsLastPage: boolean = true;
  groupSearchTerm: string = '';
  groupStatusFilter: AdminGroupStatusFilter = 'ACTIVO';
  groupVisibilityFilter: AdminGroupVisibilityFilter = 'PUBLICO';
  isGroupStatusMenuOpen: boolean = false;
  isGroupVisibilityMenuOpen: boolean = false;
  private brokenGroupPhotoIds = new Set<number>();
  showAdminFilePreview: boolean = false;
  adminFilePreviewSrc: string = '';
  adminFilePreviewName: string = '';
  adminFilePreviewSize: string = '';
  adminFilePreviewType: string = '';
  adminFilePreviewMime: string = '';
  adminTemporalFilter: AdminTemporalFilter = 'TODOS';
  adminAudioStates = new Map<string, { playing: boolean; current: number; duration: number }>();
  private adminDecryptedAudioUrlByCacheKey = new Map<string, string>();
  
  private adminDecryptingAudioByCacheKey = new Map<string, Promise<string | null>>();
  
  private adminDecryptedImageUrlByCacheKey = new Map<string, string>();
  
  private adminDecryptingImageByCacheKey = new Map<string, Promise<string | null>>();
  
  private adminDecryptedFileUrlByCacheKey = new Map<string, string>();
  private adminDecryptingFileByCacheKey = new Map<string, Promise<string | null>>();
  private adminImageCaptionByCacheKey = new Map<string, string>();
  private adminDecryptingImageCaptionByCacheKey = new Map<string, Promise<string>>();
  private adminFileCaptionByCacheKey = new Map<string, string>();
  private adminDecryptingFileCaptionByCacheKey = new Map<string, Promise<string>>();
  private adminCurrentAudioEl: HTMLAudioElement | null = null;
  private adminCurrentAudioKey: string | null = null;
  inspectedUserId: number | null = null;
  adminNombreCompleto: string = 'Administrador';
  adminFotoUrl: string = '';
  // Datos del servidor
  stats: DashboardStatsDTO = {
    totalUsuarios: 0, porcentajeUsuarios: 0,
    chatsActivos: 0, porcentajeChats: 0,
    reportes: 0, porcentajeReportes: 0,
    mensajesHoy: 0, porcentajeMensajes: 0
  };
  usuariosLocales: UsuarioDTO[] = [];
  usuariosMostrados: UsuarioDTO[] = [];
  adminMessageUsers: UsuarioDTO[] = [];
  busquedaTerm: string = "";
  currentPage: number = 0;
  pageSize: number = 10;
  totalPages: number = 1;
  totalElements: number = 0;
  isLastPage: boolean = true;
  loadingUsuarios: boolean = false;
  adminMessageUsersPage: number = 0;
  adminMessageUsersPageSize: number = 10;
  adminMessageUsersTotalElements: number = 0;
  adminMessageUsersIsLastPage: boolean = false;
  adminMessageUsersLoading: boolean = false;
  appealItems: UnbanAppealDTO[] = [];
  loadingAppeals: boolean = false;
  appealPage: number = 0;
  appealPageSize: number = 8;
  appealTotalPages: number = 1;
  appealTotalElements: number = 0;
  appealIsLastPage: boolean = true;
  appealViewFilter: 'ABIERTOS' | 'APROBADA' | 'RECHAZADA' = 'ABIERTOS';
  reportesBadgeCount: number = 0;
  reportesPendientesCount: number = 0;
  reportesHoyCount: number = 0;
  reportesHoyFechaReferencia: string = '';
  reportesHoyTimezone: string = '';
  processingAppealId: number | null = null;
  private reportUserNamesById = new Map<number, string>();
  private reportesWsSub: StompSubscription | null = null;
  private adminAuditPublicKeyInitPromise: Promise<void> | null = null;
  readonly appealFilterOptions = [
    { value: 'ABIERTOS', label: 'Pendientes + En revisión' },
    { value: 'APROBADA', label: 'Aprobados' },
    { value: 'RECHAZADA', label: 'Rechazados' },
  ];
  readonly groupStatusFilterOptions = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'ACTIVO', label: 'Activos' },
    { value: 'INACTIVO', label: 'Inactivos' },
  ];
  readonly groupVisibilityFilterOptions = [
    { value: 'TODOS', label: 'Todo tipo' },
    { value: 'PUBLICO', label: 'Publicos' },
    { value: 'PRIVADO', label: 'Privados' },
  ];
  readonly adminTemporalFilterOptions = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'ACTIVO', label: 'Activos' },
    { value: 'EXPIRADO', label: 'Expirados' },
    { value: 'NO_TEMPORAL', label: 'No temporal' },
  ];

  // Suscripción a búsqueda por input en tiempo real (debounce)
  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;
  private auditPrivateKeyImportCache:
    | { raw: string; key: CryptoKey }
    | null = null;

  constructor(
    private authService: AuthService,
    private chatService: ChatService,
    private cryptoService: CryptoService,
    private sessionService: SessionService,
    private wsService: WebSocketService,
    private rateLimitService: RateLimitService
  ) { }

  ngOnInit(): void {
    const id = localStorage.getItem('usuarioId');
    this.cargarEstadisticas();
    this.cargarUsuariosRecientes();
    this.cargarSolicitudesDesbaneo();

    if (!id) {
      console.warn('No hay usuario logueado');
      return;
    }

    this.usuarioActualId = parseInt(id, 10);
    this.cargarAdminPerfil(this.usuarioActualId);
    this.inicializarWsReportesAdmin();
    // Configurar búsqueda con un poco de retraso (300ms) para no saturar al teclear
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.realizarBusqueda(term);
    });
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    if (this.reportesWsSub) {
      try {
        this.reportesWsSub.unsubscribe();
      } catch {}
      this.reportesWsSub = null;
    }
    if (this.adminCurrentAudioEl) {
      try {
        this.adminCurrentAudioEl.pause();
      } catch {}
    }
    for (const url of this.adminDecryptedAudioUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    for (const url of this.adminDecryptedImageUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    for (const url of this.adminDecryptedFileUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.adminDecryptedAudioUrlByCacheKey.clear();
    this.adminDecryptingAudioByCacheKey.clear();
    this.adminDecryptedImageUrlByCacheKey.clear();
    this.adminDecryptingImageByCacheKey.clear();
    this.adminDecryptedFileUrlByCacheKey.clear();
    this.adminDecryptingFileByCacheKey.clear();
    this.adminImageCaptionByCacheKey.clear();
    this.adminDecryptingImageCaptionByCacheKey.clear();
    this.adminFileCaptionByCacheKey.clear();
    this.adminDecryptingFileCaptionByCacheKey.clear();
  }
  cargarEstadisticas(): void {
    this.authService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats = data;
        const reportesDiariosHoy = Number(data?.reportesDiariosHoy);
        if (Number.isFinite(reportesDiariosHoy) && reportesDiariosHoy >= 0) {
          this.reportesHoyCount = Math.max(0, reportesDiariosHoy);
        }
      },
      error: (err) => console.error("Error cargando estadísticas", err)
    });
  }

  cargarUsuariosRecientes(): void {
    this.loadingUsuarios = true;
    this.authService.getUsuariosRecientes(this.currentPage, this.pageSize).subscribe({
      next: (data: PageResponse<UsuarioDTO>) => {
        const content = this.normalizeUsuariosFotos(data?.content || []);
        this.usuariosLocales = content;
        this.usuariosMostrados = content;

        this.currentPage = Number(data?.number ?? this.currentPage);
        this.pageSize = Number(data?.size ?? this.pageSize);
        this.totalPages = Math.max(1, Number(data?.totalPages ?? 1));
        this.totalElements = Number(data?.totalElements ?? content.length);
        this.isLastPage = Boolean(data?.last ?? (this.currentPage >= this.totalPages - 1));

        this.loadingUsuarios = false;
      },
      error: (err) => {
        console.error("Error cargando recientes", err);
        this.loadingUsuarios = false;
      }
    });
  }

  cargarSolicitudesDesbaneo(page: number = 0): void {
    this.loadingAppeals = true;
    this.appealPage = Number.isFinite(Number(page)) ? Number(page) : 0;
    const estadoFilter: UnbanAppealEstado | UnbanAppealEstado[] =
      this.appealViewFilter === 'ABIERTOS'
        ? ['PENDIENTE', 'EN_REVISION']
        : this.appealViewFilter;

    this.authService
      .listarSolicitudesDesbaneoAdmin(
        this.appealPage,
        this.appealPageSize,
        estadoFilter,
        'createdAt,desc'
      )
      .subscribe({
        next: (data: PageResponse<UnbanAppealDTO>) => {
          const content = Array.isArray(data?.content)
            ? data.content.map((raw) => this.normalizeAppeal(raw))
            : [];
          this.appealItems = this.sortAppealsByCreatedDesc(content);
          this.appealPage = Number(data?.number ?? this.appealPage);
          this.appealPageSize = Number(data?.size ?? this.appealPageSize);
          this.appealTotalPages = Math.max(1, Number(data?.totalPages ?? 1));
          this.appealTotalElements = Number(data?.totalElements ?? content.length ?? 0);
          this.appealIsLastPage = Boolean(
            data?.last ?? (this.appealPage >= this.appealTotalPages - 1)
          );
          this.loadingAppeals = false;
          this.hydrateAppealUserNames(content);
          this.refreshOpenAppealsBadgeCount();
        },
        error: (err) => {
          if (this.rateLimitService.isRateLimitHttpError(err)) {
            this.loadingAppeals = false;
            this.refreshOpenAppealsBadgeCount();
            return;
          }
          console.error('Error cargando solicitudes de desbaneo', err);
          this.appealItems = [];
          this.appealTotalPages = 1;
          this.appealTotalElements = 0;
          this.appealIsLastPage = true;
          this.loadingAppeals = false;
          this.refreshOpenAppealsBadgeCount();
        },
      });
  }

  private normalizeAppeal(raw: any): UnbanAppealDTO {
    const tipoRaw = String(raw?.tipoReporte || raw?.tipo || '').trim().toUpperCase();
    const normalizedTipo = (tipoRaw ? tipoRaw : null) as UnbanAppealTipoReporte | null;
    const chatId = Number(raw?.chatId ?? 0) || null;
    return {
      id: Number(raw?.id ?? 0),
      usuarioId: Number(raw?.usuarioId ?? raw?.userId ?? 0) || null,
      email: String(raw?.email || '').trim(),
      motivo: String(raw?.motivo ?? '').trim() || null,
      estado: String(raw?.estado || 'PENDIENTE').trim().toUpperCase() as UnbanAppealEstado,
      createdAt: String(raw?.createdAt || raw?.fechaCreacion || '').trim() || null,
      updatedAt: String(raw?.updatedAt || raw?.fechaActualizacion || '').trim() || null,
      reviewedByAdminId: Number(raw?.reviewedByAdminId ?? raw?.adminId ?? 0) || null,
      resolucionMotivo: String(raw?.resolucionMotivo || '').trim() || null,
      usuarioNombre: String(raw?.usuarioNombre || raw?.nombre || '').trim() || null,
      usuarioApellido: String(raw?.usuarioApellido || raw?.apellido || '').trim() || null,
      tipoReporte: normalizedTipo,
      chatId,
      chatNombreSnapshot: String(raw?.chatNombreSnapshot || raw?.chatNombre || '').trim() || null,
      chatCerradoMotivoSnapshot:
        String(raw?.chatCerradoMotivoSnapshot || raw?.chatCerradoMotivo || '').trim() || null,
    };
  }

  private inicializarWsReportesAdmin(): void {
    const subscribe = () => {
      if (this.reportesWsSub) return;
      this.reportesWsSub = this.wsService.suscribirseAReportesAdmin((event) => {
        this.handleAppealWsEvent(event);
      });
    };

    if (this.wsService.stompClient?.connected) {
      subscribe();
      return;
    }

    const isActive = (this.wsService.stompClient as any)?.active === true;
    if (!isActive) {
      this.wsService.conectar(() => subscribe());
      return;
    }
    this.wsService.esperarConexion(() => subscribe());
  }

  private handleAppealWsEvent(event: UnbanAppealEventDTO): void {
    const normalized = this.normalizeAppeal(event);
    if (!normalized?.id) return;
    if (normalized.estado === 'APROBADA' && this.isUserUnbanAppeal(normalized)) {
      this.applyUserActiveFromAppeal(normalized, true);
    }
    this.hydrateAppealUserNames([normalized]);
    this.refreshOpenAppealsBadgeCount();
    if (this.isReportsView) {
      this.cargarSolicitudesDesbaneo(this.appealPage);
    }
  }

  private upsertAppeal(next: UnbanAppealDTO): void {
    const id = Number(next?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    const idx = this.appealItems.findIndex((x) => Number(x?.id) === id);
    if (idx === -1) {
      this.appealItems = [next, ...this.appealItems];
      return;
    }
    this.appealItems = [
      ...this.appealItems.slice(0, idx),
      { ...this.appealItems[idx], ...next },
      ...this.appealItems.slice(idx + 1),
    ];
  }

  private removeAppealById(id: number): void {
    const appealId = Number(id);
    if (!Number.isFinite(appealId) || appealId <= 0) return;
    this.appealItems = this.appealItems.filter((x) => Number(x?.id) !== appealId);
  }

  private sortAppealsByCreatedDesc(items: UnbanAppealDTO[]): UnbanAppealDTO[] {
    return [...(items || [])].sort((a, b) => {
      const tsA = Date.parse(String(a?.createdAt || a?.updatedAt || ''));
      const tsB = Date.parse(String(b?.createdAt || b?.updatedAt || ''));
      const left = Number.isFinite(tsA) ? tsA : 0;
      const right = Number.isFinite(tsB) ? tsB : 0;
      return right - left;
    });
  }

  private hydrateAppealUserNames(items: UnbanAppealDTO[]): void {
    const list = Array.isArray(items) ? items : [];
    for (const item of list) {
      const uid = Number(item?.usuarioId || 0);
      if (!Number.isFinite(uid) || uid <= 0) continue;
      const full = `${item?.usuarioNombre || ''} ${item?.usuarioApellido || ''}`.trim();
      if (full) this.reportUserNamesById.set(uid, full);
    }

    const ids = list
      .map((x) => Number(x?.usuarioId || 0))
      .filter((id, pos, arr) => Number.isFinite(id) && id > 0 && arr.indexOf(id) === pos)
      .filter((id) => !this.reportUserNamesById.has(id));
    for (const id of ids) {
      this.authService.getById(id).subscribe({
        next: (u) => {
          const nombre = `${u?.nombre || ''} ${u?.apellido || ''}`.trim();
          if (nombre) this.reportUserNamesById.set(id, nombre);
        },
        error: () => {},
      });
    }
  }

  public showReportes(): void {
    this.isDashboardView = false;
    this.isReportsView = true;
    this.isComplaintsView = false;
    this.isGroupsView = false;
    this.isMessagesView = false;
    this.isGroupsTableMode = false;
    this.isSidebarOpen = false;
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.selectedChatMessagesSource = 'admin';
    this.headerSubtitle =
      'Revisión de reportes (desbaneo de usuario y reapertura de chats) en tiempo real.';
    this.appealViewFilter = 'ABIERTOS';
    this.cargarSolicitudesDesbaneo(0);
  }

  public showComplaintsView(): void {
    this.isDashboardView = false;
    this.isReportsView = false;
    this.isComplaintsView = true;
    this.isGroupsView = false;
    this.isMessagesView = false;
    this.isScheduledMessagesView = false;
    this.isGroupsTableMode = false;
    this.isSidebarOpen = false;
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.selectedChatMessagesSource = 'admin';
    this.headerSubtitle = 'Mensajeria administrativa programada.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public setAppealViewFilter(
    filter: 'ABIERTOS' | 'APROBADA' | 'RECHAZADA'
  ): void {
    if (this.appealViewFilter === filter) return;
    this.appealViewFilter = filter;
    this.appealPage = 0;
    this.cargarSolicitudesDesbaneo(0);
  }

  public isAppealFilterActive(
    filter: 'ABIERTOS' | 'APROBADA' | 'RECHAZADA'
  ): boolean {
    return this.appealViewFilter === filter;
  }


  public get appealEmptyText(): string {
    if (this.appealViewFilter === 'APROBADA') {
      return 'No hay reportes aprobados por mostrar.';
    }
    if (this.appealViewFilter === 'RECHAZADA') {
      return 'No hay reportes rechazados por mostrar.';
    }
    return 'No hay reportes pendientes o en revisión por mostrar.';
  }

  public get reportesBadgeText(): string {
    const count = Math.max(0, Number(this.reportesBadgeCount || 0));
    return count > 99 ? '99+' : String(count);
  }

  public get chatsCreadosHoyCard(): number {
    const rawToday = Number(this.stats?.chatsCreadosHoy);
    if (Number.isFinite(rawToday)) return Math.max(0, rawToday);
    return Math.max(0, Number(this.stats?.chatsActivos || 0));
  }

  public get porcentajeUsuariosCard(): number {
    const rawToday = Number(this.stats?.porcentajeUsuariosHoy);
    if (Number.isFinite(rawToday)) return rawToday;
    return Number(this.stats?.porcentajeUsuarios || 0);
  }

  public get porcentajeChatsCard(): number {
    const rawToday = Number(this.stats?.porcentajeChatsHoy);
    if (Number.isFinite(rawToday)) return rawToday;
    return Number(this.stats?.porcentajeChats || 0);
  }

  public get porcentajeReportesCard(): number {
    const rawToday = Number(this.stats?.porcentajeReportesHoy);
    if (Number.isFinite(rawToday)) return rawToday;
    return Number(this.stats?.porcentajeReportes || 0);
  }

  public get porcentajeMensajesCard(): number {
    const rawToday = Number(this.stats?.porcentajeMensajesHoy);
    if (Number.isFinite(rawToday)) return rawToday;
    return Number(this.stats?.porcentajeMensajes || 0);
  }

  private isGroupClosedAppeal(item: UnbanAppealDTO): boolean {
    const tipo = String(item?.tipoReporte || '').trim().toUpperCase();
    if (tipo === 'CHAT_CERRADO') return true;
    if (tipo === 'DESBANEO') return false;
    const chatId = Number(item?.chatId || 0);
    return Number.isFinite(chatId) && chatId > 0;
  }

  private isUserUnbanAppeal(item: UnbanAppealDTO): boolean {
    const tipo = String(item?.tipoReporte || '').trim().toUpperCase();
    // Backends antiguos no enviaban tipoReporte; asumimos DESBANEO si no viene chatId.
    if (!tipo) return !this.isGroupClosedAppeal(item);
    return tipo === 'DESBANEO';
  }

  public getAppealTipoLabel(item: UnbanAppealDTO): string {
    if (this.isGroupClosedAppeal(item)) return 'Chat bloqueado';
    return 'Usuario baneado';
  }

  public getAppealTipoClass(item: UnbanAppealDTO): string {
    return this.isGroupClosedAppeal(item)
      ? 'appeal-chip appeal-chip--type-group'
      : 'appeal-chip appeal-chip--type-user';
  }

  public getAppealCtaLabel(item: UnbanAppealDTO): string {
    if (this.isGroupClosedAppeal(item)) return 'Click para revisar y reabrir chat';
    return 'Click para revisar y aprobar desbaneo';
  }

  public getAppealReporterLabel(item: UnbanAppealDTO): string {
    const nombreApi =
      `${item?.usuarioNombre || ''} ${item?.usuarioApellido || ''}`.trim();
    if (nombreApi) return nombreApi;

    const uid = Number(item?.usuarioId || 0);
    if (Number.isFinite(uid) && uid > 0) {
      const cached = String(this.reportUserNamesById.get(uid) || '').trim();
      if (cached) return cached;
      return `Usuario #${uid}`;
    }
    return String(item?.email || 'Usuario').trim() || 'Usuario';
  }

  public getAppealEstadoClass(item: UnbanAppealDTO): string {
    const estado = String(item?.estado || '').trim().toUpperCase();
    if (estado === 'APROBADA') return 'appeal-chip appeal-chip--ok';
    if (estado === 'RECHAZADA') return 'appeal-chip appeal-chip--danger';
    if (estado === 'EN_REVISION') return 'appeal-chip appeal-chip--review';
    return 'appeal-chip appeal-chip--pending';
  }

  public trackAppeal = (_: number, item: UnbanAppealDTO) => item.id;

  public async onAppealCardClick(item: UnbanAppealDTO): Promise<void> {
    const appealId = Number(item?.id);
    if (!Number.isFinite(appealId) || appealId <= 0) return;
    if (this.processingAppealId === appealId) return;

    const estadoActual = String(item?.estado || '').trim().toUpperCase() as UnbanAppealEstado;
    if (estadoActual === 'APROBADA') {
      await Swal.fire({
        icon: 'info',
        title: 'Solicitud ya aprobada',
        text: 'Esta solicitud ya fue marcada como APROBADA.',
        confirmButtonColor: '#2563eb',
      });
      return;
    }
    if (estadoActual === 'RECHAZADA') {
      await Swal.fire({
        icon: 'info',
        title: 'Solicitud rechazada',
        text: 'Esta solicitud ya fue cerrada como RECHAZADA.',
        confirmButtonColor: '#2563eb',
      });
      return;
    }

    const isGroupReport = this.isGroupClosedAppeal(item);
    this.processingAppealId = appealId;
    try {
      if (estadoActual === 'PENDIENTE') {
        const moved = await this.patchAppealStatus(item, 'EN_REVISION', null);
        if (!moved) return;
      }

      const reporter = this.getAppealReporterLabel(item);
      const chatName = String(item?.chatNombreSnapshot || '').trim();
      const chatId = Number(item?.chatId || 0);
      const targetStrong = isGroupReport
        ? chatName || (Number.isFinite(chatId) && chatId > 0 ? `chat #${chatId}` : 'chat')
        : reporter;
      const headerTitle = isGroupReport ? 'Reabrir chat' : 'Aprobar desbaneo';
      const labelText = isGroupReport
        ? 'Motivo de reapertura (opcional)'
        : 'Motivo de desbaneo (opcional)';
      const helperText = 'Si lo dejas vacio, backend completara un motivo automatico.';
      const inputPlaceholder = isGroupReport
        ? 'Ej: Se reviso el caso y procede reabrir el chat.'
        : 'Ej: Se verifico el caso y procede reactivar la cuenta.';
      const confirmText = isGroupReport ? 'Reabrir chat' : 'Desbanear';
      const cancelText = isGroupReport ? 'No reabrir' : 'No desbanear';
      const confirmColor = isGroupReport ? '#f97316' : '#3b82f6';
      const { value: motivo, isConfirmed, dismiss } = await Swal.fire({
        html: `
          <div class="swal-unban-header">
            <div class="swal-unban-header-icon"><i class="bi bi-person-check-fill"></i></div>
            <div class="swal-unban-header-text">
              <h2>${headerTitle}</h2>
              <p>Revisar solicitud de <strong>${targetStrong}</strong></p>
            </div>
          </div>
          <div class="swal-unban-body">
            <label class="swal-unban-label">${labelText}</label>
            <p class="swal-unban-helper">${helperText}</p>
          </div>
        `,
        input: 'textarea',
        inputPlaceholder,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: confirmColor,
        cancelButtonColor: '#64748b',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          popup: 'swal-unban-popup',
          htmlContainer: 'swal-unban-html',
          input: 'swal-unban-textarea',
          confirmButton: 'swal-unban-confirm',
          cancelButton: 'swal-unban-cancel',
          actions: 'swal-unban-actions',
        },
      });

      if (!isConfirmed) {
        if (dismiss === Swal.DismissReason.cancel) {
          const rejected = await this.patchAppealStatus(item, 'RECHAZADA', null);
          if (rejected) {
            await Swal.fire({
              title: 'Solicitud rechazada',
              text: isGroupReport
                ? 'El reporte quedó en estado RECHAZADA. El backend notificará por email.'
                : 'La solicitud quedó en estado RECHAZADA. El backend notificará al usuario por email.',
              icon: 'success',
              confirmButtonColor: '#ef4444',
            });
          }
        }
        return;
      }

      const approved = await this.patchAppealStatus(
        item,
        'APROBADA',
        String(motivo || '').trim() || null
      );
      if (!approved) return;

      await Swal.fire({
        title: 'Solicitud aprobada',
        text: isGroupReport
          ? 'El reporte quedó en estado APROBADA. El backend aplicará la reapertura (si corresponde) y enviará un email informativo.'
          : 'La solicitud quedó en estado APROBADA. El backend aplicará el desbaneo y enviará el email al usuario.',
        icon: 'success',
        confirmButtonColor: '#10b981',
      });
    } finally {
      this.processingAppealId = null;
    }
  }

  private async patchAppealStatus(
    item: UnbanAppealDTO,
    estado: UnbanAppealEstado,
    resolucionMotivo?: string | null
  ): Promise<boolean> {
    const id = Number(item?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    try {
      const response = await firstValueFrom(
        this.authService.actualizarEstadoSolicitudDesbaneoAdmin(id, {
          estado,
          resolucionMotivo: String(resolucionMotivo || '').trim() || null,
        })
      );

      const merged = this.normalizeAppeal({
        ...item,
        ...(response || {}),
        id,
        estado,
        resolucionMotivo:
          String((response as any)?.resolucionMotivo ?? resolucionMotivo ?? '').trim() || null,
        updatedAt:
          String((response as any)?.updatedAt || new Date().toISOString()).trim() ||
          new Date().toISOString(),
      });
      this.upsertAppeal(merged);
      this.appealItems = this.sortAppealsByCreatedDesc(this.appealItems);
      const shouldKeep =
        this.appealViewFilter === 'ABIERTOS'
          ? merged.estado === 'PENDIENTE' || merged.estado === 'EN_REVISION'
          : merged.estado === this.appealViewFilter;
      if (!shouldKeep) {
        this.removeAppealById(merged.id);
      }
      if (merged.estado === 'APROBADA' && this.isUserUnbanAppeal(merged)) {
        this.applyUserActiveFromAppeal(merged, true);
      }
      this.refreshOpenAppealsBadgeCount();
      return true;
    } catch (err: any) {
      if (this.rateLimitService.isRateLimitHttpError(err)) {
        const remaining = this.rateLimitService.getScopeRemainingSeconds(
          RATE_LIMIT_SCOPES.ADMIN_GLOBAL
        );
        Swal.fire({
          title: 'Límite temporal',
          text: `Demasiadas acciones administrativas. Reintenta en ${remaining || 30}s.`,
          icon: 'warning',
          confirmButtonColor: '#2563eb',
        });
        return false;
      }
      Swal.fire({
        title: 'Error',
        text:
          err?.error?.mensaje ||
          'No se pudo actualizar el estado del reporte. Intenta nuevamente.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
      return false;
    }
  }

  private refreshOpenAppealsBadgeCount(): void {
    const tz = this.getBrowserTimeZone();
    this.authService.getSolicitudesDesbaneoStatsAdmin(tz).subscribe({
      next: (stats) => {
        const pendientes = Number(stats?.pendientes ?? stats?.abiertas ?? 0);
        this.reportesPendientesCount = Math.max(0, Number.isFinite(pendientes) ? pendientes : 0);
        this.reportesBadgeCount = this.reportesPendientesCount;
        this.reportesHoyFechaReferencia = String(stats?.fechaReferencia || '').trim();
        this.reportesHoyTimezone = String(stats?.timezone || '').trim();
      },
      error: () => {},
    });
  }

  private getBrowserTimeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  }

  public nextAppealsPage(): void {
    if (this.appealIsLastPage) return;
    this.cargarSolicitudesDesbaneo(this.appealPage + 1);
  }

  public prevAppealsPage(): void {
    if (this.appealPage <= 0) return;
    this.cargarSolicitudesDesbaneo(this.appealPage - 1);
  }

  private applyUserActiveFromAppeal(
    appeal: UnbanAppealDTO,
    activo: boolean
  ): void {
    const targetUserId = Number(appeal?.usuarioId || 0);
    const targetEmail = String(appeal?.email || '').trim().toLowerCase();
    if (!targetUserId && !targetEmail) return;

    const patchList = (list: UsuarioDTO[]): UsuarioDTO[] =>
      (list || []).map((u) => {
        const uid = Number((u as any)?.id || 0);
        const email = String((u as any)?.email || '').trim().toLowerCase();
        const matchById = targetUserId > 0 && uid === targetUserId;
        const matchByEmail = !!targetEmail && email === targetEmail;
        if (!matchById && !matchByEmail) return u;
        return { ...u, activo };
      });

    this.usuariosLocales = patchList(this.usuariosLocales);
    this.usuariosMostrados = patchList(this.usuariosMostrados);
  }

  onSearchChange(event: any): void {
    const term = event.target.value || '';
    this.busquedaTerm = term;
    this.searchSubject.next(term);
  }

  realizarBusqueda(term: string): void {
    if (!term || term.trim() === '') {
      // Si se borra la búsqueda, mostrar la tabla de recientes inicial
      this.usuariosMostrados = this.usuariosLocales;
      return;
    }

    const lowerTerm = term.toLowerCase().trim();

    // 1) Filtrar la lista local memoria
    const filterLocals = this.usuariosLocales.filter(u =>
      u.nombre.toLowerCase().includes(lowerTerm) ||
      u.email.toLowerCase().includes(lowerTerm)
    );

    if (filterLocals.length > 0) {
      this.usuariosMostrados = filterLocals;
    } else {
      // 2) Si localmente no hay coincidencias directas, pedir al backend
      this.authService.searchUsuarios(lowerTerm).subscribe({
        next: (data) => this.usuariosMostrados = this.normalizeUsuariosFotos(data || []),
        error: (err) => console.error("Error buscando usuarios remotamente", err)
      });
    }
  }

  private normalizeUsuariosFotos(users: UsuarioDTO[]): UsuarioDTO[] {
    return (users || []).map((u) => ({
      ...u,
      foto: resolveMediaUrl(u?.foto || '', environment.backendBaseUrl) || ''
    }));
  }

  private resetAdminMessageUsersFeed(): void {
    this.adminMessageUsers = [];
    this.adminMessageUsersPage = 0;
    this.adminMessageUsersTotalElements = 0;
    this.adminMessageUsersIsLastPage = false;
  }

  private loadAdminMessageUsersPage(page: number, append: boolean = false): void {
    if (this.adminMessageUsersLoading) return;

    const targetPage = Math.max(0, Number(page || 0));
    this.adminMessageUsersLoading = true;

    this.authService
      .getUsuariosRecientes(targetPage, this.adminMessageUsersPageSize)
      .subscribe({
        next: (data: PageResponse<UsuarioDTO>) => {
          const content = this.normalizeUsuariosFotos(data?.content || []);
          const merged = append
            ? [
                ...(this.adminMessageUsers || []),
                ...content.filter((user) => {
                  const id = Number(user?.id || 0);
                  return !this.adminMessageUsers.some(
                    (existing) => Number(existing?.id || 0) === id
                  );
                }),
              ]
            : content;

          this.adminMessageUsers = merged;
          this.adminMessageUsersPage = Number(data?.number ?? targetPage);
          this.adminMessageUsersPageSize = Number(
            data?.size ?? this.adminMessageUsersPageSize
          );
          this.adminMessageUsersTotalElements = Number(
            data?.totalElements ?? merged.length
          );
          this.adminMessageUsersIsLastPage = Boolean(
            data?.last ??
              (this.adminMessageUsersPage >=
                Math.max(1, Number(data?.totalPages ?? 1)) - 1)
          );
          this.adminMessageUsersLoading = false;
        },
        error: (err) => {
          console.error('Error cargando usuarios para mensajeria admin', err);
          this.adminMessageUsersLoading = false;
        },
      });
  }

  private cargarAdminPerfil(usuarioId: number): void {
    const cachedFoto = localStorage.getItem('usuarioFoto') || '';
    if (cachedFoto) {
      this.adminFotoUrl = resolveMediaUrl(cachedFoto, environment.backendBaseUrl) || '';
    }

    this.authService.getById(usuarioId).subscribe({
      next: (u: UsuarioDTO) => {
        const nombre = (u?.nombre || '').trim();
        const apellido = (u?.apellido || '').trim();
        const fullName = `${nombre} ${apellido}`.trim();

        this.adminNombreCompleto = fullName || 'Administrador';
        this.adminFotoUrl = resolveMediaUrl(u?.foto || cachedFoto, environment.backendBaseUrl) || '';
        if (u?.foto) localStorage.setItem('usuarioFoto', u.foto);
      },
      error: (err) => {
        console.error('Error cargando perfil admin', err);
      }
    });
  }

  get adminIniciales(): string {
    const parts = (this.adminNombreCompleto || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AD';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  getRoleName(roles: string[] | undefined): string {
    if (!roles || roles.length === 0) return 'Usuario';
    const mainRole = roles[0];
    return mainRole.replace('ROLE_', '').charAt(0) + mainRole.replace('ROLE_', '').slice(1).toLowerCase();
  }

  showConversations(user: any): void {
    this.isDashboardView = false;
    this.isReportsView = false;
    this.isGroupsView = false;
    this.isMessagesView = false;
    this.isGroupsTableMode = false;
    this.currentUserName = user.nombre;
    this.headerSubtitle = `Inspeccionando registros de: ${user.nombre}`;
    this.inspectedUserId = Number(user.id);
    this.adminTemporalFilter = 'TODOS';
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.loadInspectedUserConversations();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadInspectedUserConversations(
    preserveSelectedChatId?: number | null
  ): void {
    const inspectedId = Number(this.inspectedUserId || 0);
    if (!Number.isFinite(inspectedId) || inspectedId <= 0) {
      this.userChats = [];
      this.loadingConversations = false;
      return;
    }

    this.loadingConversations = true;
    this.userChats = [];

    this.chatService
      .listarConversacionesAdmin(inspectedId, true)
      .subscribe({
        next: async (data: any) => {
          try {
            this.userChats = await this.normalizeAdminChatSummaries(data || []);
          } catch (err) {
            console.error('Error normalizando conversaciones admin', err);
            this.userChats = Array.isArray(data) ? data : [];
          }
          this.loadingConversations = false;

          const keepId = Number(preserveSelectedChatId || 0);
          if (!Number.isFinite(keepId) || keepId <= 0) return;
          const match = (this.userChats || []).find(
            (chat: any) => Number(chat?.id) === keepId
          );
          if (match) {
            this.openChatDetail(match);
            return;
          }
          this.closeChatDetail();
        },
        error: (err: any) => {
          console.error('Error cargando chats', err);
          this.loadingConversations = false;
          this.userChats = [];
          this.closeChatDetail();
          Swal.fire(
            'Error',
            'No se pudieron cargar las conversaciones del usuario.',
            'error'
          );
        },
      });
  }

  private async normalizeAdminChatSummaries(chats: any[]): Promise<any[]> {
    if (!Array.isArray(chats)) return [];
    return Promise.all(chats.map((chat) => this.normalizeAdminChatSummary(chat)));
  }

  private async normalizeAdminChatSummary(chat: any): Promise<any> {
    if (!chat) return chat;

    const tipo = this.resolveAdminLastMessageTipo(chat);
    const summaryTemporal = this.resolveTemporalMetaForSummary(chat);
    await this.syncAdminSummaryMedia(chat, tipo);
    const preview = await this.resolveAdminChatPreview(chat, tipo);
    const fecha = chat?.ultimoMensajeFecha ?? chat?.fechaUltimoMensaje ?? null;
    const emisorNombre = String(chat?.ultimoMensajeEmisorNombre ?? '').trim();
    const emisorApellido = String(chat?.ultimoMensajeEmisorApellido ?? '').trim();
    const emisorCompleto =
      String(chat?.ultimoMensajeEmisorNombreCompleto ?? '').trim() ||
      `${emisorNombre}${emisorApellido ? ' ' + emisorApellido : ''}`.trim();

    const totalMensajesRaw = Number(chat?.totalMensajes);
    const totalMensajes = Number.isFinite(totalMensajesRaw)
      ? Math.max(0, totalMensajesRaw)
      : Array.isArray(chat?.mensajes)
      ? chat.mensajes.length
      : 0;

    return {
      ...chat,
      ultimoMensajePreview: preview,
      ultimoMensajeTexto: chat?.ultimoMensajeTexto ?? preview,
      ultimoMensaje: preview,
      ultimoMensajeFecha: fecha,
      fechaUltimoMensaje: fecha,
      ultimoMensajeTipo: tipo || chat?.ultimoMensajeTipo || null,
      ultimoMensajeEmisorNombre: emisorNombre || chat?.ultimoMensajeEmisorNombre || '',
      ultimoMensajeEmisorApellido: emisorApellido || chat?.ultimoMensajeEmisorApellido || '',
      ultimoMensajeEmisorNombreCompleto:
        emisorCompleto || chat?.ultimoMensajeEmisorNombreCompleto || '',
      totalMensajes,
      __ultimoTipo: tipo || null,
      __ultimoAudioDurMs: Number(chat?.__ultimoAudioDurMs || 0),
            __ultimoEsAudio: chat?.__ultimoEsAudio === true,
      __ultimoEsImagen: chat?.__ultimoEsImagen === true,
      __ultimoImagenUrl: String(chat?.__ultimoImagenUrl || '').trim(),
      __ultimoImagenNombre: String(chat?.__ultimoImagenNombre || '').trim(),
      __ultimoImagenCaption: String(chat?.__ultimoImagenCaption || '').trim(),
      __ultimoEsArchivo: chat?.__ultimoEsArchivo === true,
      __ultimoArchivoNombre: String(chat?.__ultimoArchivoNombre || '').trim(),
      __ultimoArchivoMime: String(chat?.__ultimoArchivoMime || '').trim(),
      __ultimoArchivoCaption: String(chat?.__ultimoArchivoCaption || '').trim(),
      __ultimoTemporalEnabled: summaryTemporal.enabled,
      __ultimoTemporalSegundos:summaryTemporal.seconds,
      __ultimoTemporalExpiresAt: summaryTemporal.expiresAt,
      __ultimoTemporalExpired: summaryTemporal.expired,
      __ultimoTemporalStatus: summaryTemporal.status,
      __ultimoTemporalLabel: this.formatTemporalDurationShort(summaryTemporal.seconds),
    };
  }

  private async resolveAdminChatPreview(chat: any, resolvedTipo?: string): Promise<string> {
    const tipo = String(
      resolvedTipo || this.resolveAdminLastMessageTipo(chat) || chat?.ultimoMensajeTipo || ''
    )
      .trim()
      .toUpperCase();
    const activoRaw =
      chat?.ultimoMensajeActivo ??
      chat?.activoUltimoMensaje ??
      chat?.ultimoMensajeActivoFlag;
    const isInactive = activoRaw === false || Number(activoRaw) === 0;
    const temporalSummary = this.resolveTemporalMetaForSummary(chat);

    if (isInactive) {
      if (temporalSummary.status === 'EXPIRADO') {
        return this.resolveTemporalPlaceholderTextForItem(chat);
      }
      return 'Mensaje eliminado';
    }

    let textoResuelto = 'Sin datos';
    if (tipo === 'AUDIO' || chat?.__ultimoEsAudio === true || this.isAudioLikePayload(chat, tipo, true)) {
      const durMs = this.extractAudioDurationMs(chat, true);
      textoResuelto = this.buildAudioVoiceLabel(durMs);
    } else if (tipo === 'IMAGE' || chat?.__ultimoEsImagen === true) {
      const caption = String(chat?.__ultimoImagenCaption || '').trim();
      textoResuelto = caption ? `Imagen: ${caption}` : 'Imagen';
    } else if (tipo === 'FILE' || chat?.__ultimoEsArchivo === true || this.isFileLikePayload(chat, tipo, true)) {
      const raw = this.getAdminLastMessageRaw(chat);
      const payloadCandidate = this.extractAdminPayloadCandidate(raw);
      const filePayload =
        this.parseAdminFileE2EPayload(payloadCandidate) || this.parseAdminFileE2EPayload(raw);
      const fileName = String(chat?.__ultimoArchivoNombre || filePayload?.fileNombre || '').trim();

      if (filePayload) {
        const cachedCaption = String(chat?.__ultimoArchivoCaption || '').trim();
        const caption = cachedCaption || (await this.decryptAdminFileCaption(filePayload));
        textoResuelto = this.buildAdminFileLabel(fileName, caption);
      } else if (raw && !this.isLikelySerializedPayloadText(raw)) {
        const plain = String(raw).trim();
        textoResuelto = /^archivo\s*:/i.test(plain)
          ? plain
          : this.buildAdminFileLabel(fileName, plain);
      } else {
        textoResuelto = this.buildAdminFileLabel(fileName);
      }
    } else {
      const raw = this.getAdminLastMessageRaw(chat);
      if (!raw) {
        textoResuelto = 'Sin datos';
      } else if (raw === 'NO_AUDITABLE') {
        textoResuelto = '[Mensaje legado no auditable]';
      } else if (this.isEncryptedE2EPayload(raw)) {
        try {
          const payloadCandidate = this.extractAdminPayloadCandidate(raw);
          const decryptInput =
            typeof payloadCandidate === 'string'
              ? payloadCandidate
              : payloadCandidate && typeof payloadCandidate === 'object'
              ? JSON.stringify(payloadCandidate)
              : raw;
          const decrypted = await this.decryptContenidoWithCandidates(
            decryptInput,
            this.buildDecryptCandidateIds(
              Number(chat?.ultimoMensajeEmisorId ?? 0),
              Number(this.inspectedUserId ?? 0),
              chat
            ),
            'admin-chat-preview'
          );
          const normalized = String(decrypted ?? '').trim();
          const pollPreview = this.buildAdminPollPreviewText(normalized);
          textoResuelto = pollPreview || normalized || '[Mensaje Cifrado]';
        } catch {
          textoResuelto = '[Mensaje Cifrado]';
        }
      } else {
        const pollPreview = this.buildAdminPollPreviewText(raw);
        textoResuelto = pollPreview || raw;
      }
    }

    if (
      this.isAdminGroupChat(chat) &&
      textoResuelto !== 'Sin datos' &&
      textoResuelto !== 'Mensaje eliminado'
    ) {
      const sender = this.buildAdminSenderName(chat);
      const hasSenderPrefix = /^[^:]{1,80}:\s*/.test(textoResuelto);
      const forcePrefixForPoll = /^encuesta:\s*/i.test(textoResuelto);
      if (sender && (!hasSenderPrefix || forcePrefixForPoll)) {
        return `${sender}: ${textoResuelto}`;
      }
    }

    return textoResuelto;
  }
  private resolveAdminLastMessageTipo(chat: any): string {
    const explicit = this.normalizeAdminLastMessageTipo(
      chat?.ultimoMensajeTipo ?? chat?.ultimaMensajeTipo ?? chat?.messageType
    );
    const inferred = this.inferAdminLastMessageTipoFromRaw(this.getAdminLastMessageRaw(chat));
    if (explicit === 'TEXT' && inferred && inferred !== 'TEXT') return inferred;
    return explicit || inferred;
  }

  private normalizeAdminLastMessageTipo(tipo: unknown): string {
    const t = String(tipo || '').trim().toUpperCase();
    if (!t) return '';
    if (
      t === 'TEXT' ||
      t === 'POLL' ||
      t === 'AUDIO' ||
      t === 'IMAGE' ||
      t === 'VIDEO' ||
      t === 'FILE' ||
      t === 'SYSTEM'
    ) {
      return t;
    }
    return '';
  }

  private inferAdminLastMessageTipoFromRaw(raw: unknown): string {
    const payload = this.parseAdminPayload(this.extractAdminPayloadCandidate(raw));
    const payloadType = String(payload?.type || '').trim().toUpperCase();
    if (!payloadType) return '';
    if (payloadType === 'E2E_AUDIO' || payloadType === 'E2E_GROUP_AUDIO') return 'AUDIO';
    if (payloadType === 'E2E_IMAGE' || payloadType === 'E2E_GROUP_IMAGE') return 'IMAGE';
    if (payloadType === 'E2E_FILE' || payloadType === 'E2E_GROUP_FILE') return 'FILE';
    if (payloadType === 'E2E' || payloadType === 'E2E_GROUP') return 'TEXT';
    if (payloadType === 'POLL_V1') return 'POLL';
    return '';
  }

  private buildAdminPollPreviewText(raw: unknown): string | null {
    const poll = parsePollPayload(raw);
    if (!poll) return null;
    const question = String(poll?.question || '').trim();
    return question ? `Encuesta: ${question}` : 'Encuesta';
  }

  private getAdminLastMessageRaw(chat: any): string {
    return String(
      chat?.ultimoMensajeRaw ??
        chat?.ultimaMensajeRaw ??
        chat?.ultimoMensajeContenidoRaw ??
        chat?.ultimoMensaje ??
        chat?.ultimoMensajePreview ??
        chat?.ultimoMensajeTexto ??
        ''
    ).trim();
  }

  private extractAdminPayloadCandidate(raw: unknown): unknown {
    if (raw && typeof raw === 'object') return raw;
    const text = String(raw || '').trim();
    if (!text) return null;
    if (text.startsWith('{')) return text;
    const withPrefixMatch = text.match(/^[^:]{1,80}:\s*(\{[\s\S]*\})\s*$/);
    if (withPrefixMatch?.[1]) return withPrefixMatch[1];
    if (/\\"type\\"/.test(text)) return text;
    return null;
  }

  private parseAdminPayload(raw: unknown): any | null {
    if (raw && typeof raw === 'object') return raw;
    let candidate = String(raw || '').trim();
    if (!candidate) return null;

    for (let i = 0; i < 4; i++) {
      if (!candidate) return null;

      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') return parsed;
        if (typeof parsed === 'string') {
          candidate = parsed.trim();
          continue;
        }
        return null;
      } catch {
        // continuamos con normalizacion de cadenas escapadas
      }

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

      break;
    }

    return null;
  }

  private async syncAdminSummaryMedia(chat: any, resolvedTipo: string): Promise<void> {
    const rawSummary = this.getAdminLastMessageRaw(chat);
    const payloadCandidate = this.extractAdminPayloadCandidate(rawSummary);
    const payload = this.parseAdminPayload(payloadCandidate);

    const audioPayload =
      this.parseAdminAudioE2EPayload(payloadCandidate) || this.parseAdminAudioE2EPayload(payload);
    const audioDur = Math.max(
      this.extractAudioDurationMs(chat, true),
      Number(audioPayload?.audioDuracionMs || 0)
    );
    chat.__ultimoAudioDurMs = Number.isFinite(audioDur) && audioDur > 0 ? Math.round(audioDur) : 0;
    chat.__ultimoEsAudio =
      resolvedTipo === 'AUDIO' || this.isAudioLikePayload(chat, resolvedTipo, true) || !!audioPayload;

    const imagePayload =
      this.parseAdminImageE2EPayload(payloadCandidate) || this.parseAdminImageE2EPayload(payload);
    const directImageUrl = String(
      chat?.ultimoMensajeImageUrl ??
        chat?.ultimaMensajeImageUrl ??
        chat?.ultimoImageUrl ??
        chat?.imageUrl ??
        ''
    ).trim();
    const directImageName = String(
      chat?.ultimoMensajeImageNombre ??
        chat?.ultimaMensajeImageNombre ??
        chat?.ultimoImageNombre ??
        chat?.imageNombre ??
        ''
    ).trim();

    chat.__ultimoEsImagen = resolvedTipo === 'IMAGE' || !!directImageUrl || !!imagePayload;
    chat.__ultimoImagenNombre = directImageName || String(imagePayload?.imageNombre || '').trim();
    chat.__ultimoImagenCaption = '';
    chat.__ultimoImagenUrl = '';

    if (chat.__ultimoEsImagen) {
      if (imagePayload) {
        const objectUrl = await this.decryptAdminImagePayloadToObjectUrl(
          imagePayload,
          chat?.ultimoMensajeId ?? chat?.ultimaMensajeId
        );
        chat.__ultimoImagenUrl = String(objectUrl || '').trim();
        chat.__ultimoImagenNombre =
          chat.__ultimoImagenNombre || String(imagePayload?.imageNombre || '').trim();
        chat.__ultimoImagenCaption = await this.decryptAdminImageCaption(imagePayload);
      } else {
        chat.__ultimoImagenUrl = resolveMediaUrl(directImageUrl, environment.backendBaseUrl) || '';
      }
    }

    const filePayload =
      this.parseAdminFileE2EPayload(payloadCandidate) || this.parseAdminFileE2EPayload(payload);
    const directFileName = String(
      chat?.ultimoMensajeFileNombre ??
        chat?.ultimaMensajeFileNombre ??
        chat?.ultimoFileNombre ??
        chat?.fileNombre ??
        ''
    ).trim();
    const directFileMime = String(
      chat?.ultimoMensajeFileMime ??
        chat?.ultimaMensajeFileMime ??
        chat?.ultimoFileMime ??
        chat?.fileMime ??
        ''
    ).trim();

    chat.__ultimoEsArchivo =
      resolvedTipo === 'FILE' || this.isFileLikePayload(chat, resolvedTipo, true) || !!filePayload;
    chat.__ultimoArchivoNombre = directFileName || String(filePayload?.fileNombre || '').trim();
    chat.__ultimoArchivoMime = directFileMime || String(filePayload?.fileMime || '').trim();
    chat.__ultimoArchivoCaption = '';

    if (chat.__ultimoEsArchivo && filePayload) {
      chat.__ultimoArchivoCaption = await this.decryptAdminFileCaption(filePayload);
    }
  }
  private buildAdminSenderName(chat: any): string {
    const full = String(chat?.ultimoMensajeEmisorNombreCompleto ?? '').trim();
    if (full) return full;
    const nombre = String(chat?.ultimoMensajeEmisorNombre ?? '').trim();
    const apellido = String(chat?.ultimoMensajeEmisorApellido ?? '').trim();
    return `${nombre}${apellido ? ' ' + apellido : ''}`.trim();
  }

  private isAdminGroupChat(chat: any): boolean {
    if (!chat) return false;
    if (chat?.esGrupo === true) return true;
    const tipo = String(chat?.tipo ?? chat?.chatTipo ?? '').toUpperCase();
    if (tipo.includes('GRUP')) return true;
    if (chat?.nombreGrupo) return true;
    const members = chat?.usuarios;
    return Array.isArray(members) && members.length > 2;
  }

  openChatDetail(chat: any): void {
    this.selectedChat = chat;
    this.adminTemporalFilter = 'TODOS';
    this.selectedChatMensajes = [];

    const chatId = Number(chat?.id);
    if (!chatId) return;

    this.loadingChatMessages = true;
    this.selectedChatMessagesSource = 'admin';

    this.getMensajesObservable(chat, chatId).subscribe({
      next: async (data: any[]) => {
        this.selectedChatMensajes = await this.buildChatMessages(chat, data || []);
        this.loadingChatMessages = false;
      },
      error: (err: any) => {
        console.error('Error cargando mensajes admin por chat', err);
        this.loadingChatMessages = false;
        this.selectedChatMensajes = [];
        Swal.fire('Error', 'No se pudieron cargar los mensajes del chat seleccionado.', 'error');
      }
    });
  }

  nextUsuariosPage(): void {
    if (this.isLastPage) return;
    this.currentPage = this.currentPage + 1;
    this.cargarUsuariosRecientes();
  }

  prevUsuariosPage(): void {
    if (this.currentPage <= 0) return;
    this.currentPage = this.currentPage - 1;
    this.cargarUsuariosRecientes();
  }

  closeChatDetail(): void {
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.loadingChatMessages = false;
    this.closeAdminFilePreview();
  }

  private async buildChatMessages(chat: any, rawMessages: any[] = []): Promise<any[]> {
    if (!chat || !Array.isArray(rawMessages) || !rawMessages.length) return [];

    const normalized = await Promise.all(
      rawMessages.map(async (msg: any, index: number) => {
        const temporalMeta = this.resolveTemporalMetaForMessage(msg);
        const emisorId = Number(msg?.emisorId ?? msg?.emisor?.id ?? 0);
        const receptorId = Number(msg?.receptorId ?? msg?.receptor?.id ?? 0);
        const isTemporalExpired = temporalMeta.status === 'EXPIRADO';
        const auditSnapshot = isTemporalExpired
          ? this.resolveAdminExpiredTemporalAuditSnapshot(msg)
          : null;
        let tipo = String(
          auditSnapshot?.tipo ?? msg?.tipo ?? msg?.messageType ?? ''
        )
          .trim()
          .toUpperCase();
        let audioDurMs = this.extractAudioDurationMs(msg, false);
        if (
          (!Number.isFinite(audioDurMs) || audioDurMs <= 0) &&
          Number.isFinite(Number(auditSnapshot?.audioDuracionMs))
        ) {
          audioDurMs = Number(auditSnapshot?.audioDuracionMs);
        }
        let rawContenido =
          auditSnapshot?.contenido ??
          msg?.contenido ??
          msg?.mensaje ??
          msg?.texto ??
          msg?.content ??
          msg?.contenidoDescifrado ??
          msg?.contenidoPlano ??
          msg?.mensajePlano ??
          msg?.textoPlano ??
          msg?.previewAdmin ??
          msg?.ultimoMensajeDescifrado ??
          '';
        let pollPayload = parsePollPayload(msg?.poll) || parsePollPayload(rawContenido);
        const e2eAudioPayload = this.parseAdminAudioE2EPayload(rawContenido);
        const e2eImagePayload = this.parseAdminImageE2EPayload(rawContenido);
        const e2eFilePayload = this.parseAdminFileE2EPayload(rawContenido);
        const isImage =
          this.isImageLikePayload(msg, tipo, false) ||
          !!e2eImagePayload ||
          !!String(auditSnapshot?.imageUrl || '').trim();
        const isAudio =
          !isImage &&
          (this.isAudioLikePayload(msg, tipo, false) ||
            !!String(auditSnapshot?.audioUrl || '').trim());
        const isFile =
          !isImage &&
          !isAudio &&
          (this.isFileLikePayload(msg, tipo, false) || !!e2eFilePayload);
        if (
          (!Number.isFinite(audioDurMs) || audioDurMs <= 0) &&
          Number.isFinite(Number(e2eAudioPayload?.audioDuracionMs))
        ) {
          audioDurMs = Number(e2eAudioPayload?.audioDuracionMs);
        }
        let resolvedAudioUrl = this.resolveAudioUrlFromPayload(
          msg,
          rawContenido,
          e2eAudioPayload
        );
        let resolvedImageUrl = this.resolveImageUrlFromPayload(
          msg,
          rawContenido,
          e2eImagePayload
        );
        let resolvedFileUrl = this.resolveFileUrlFromPayload(
          msg,
          rawContenido,
          e2eFilePayload
        );
        const snapshotAudioUrl = this.resolveAdminMediaUrlCandidate(
          auditSnapshot?.audioUrl
        );
        const snapshotImageUrl = this.resolveAdminMediaUrlCandidate(
          auditSnapshot?.imageUrl
        );
        const snapshotFileUrl = this.resolveAdminMediaUrlCandidate(
          (auditSnapshot as any)?.fileUrl
        );
        if (snapshotAudioUrl) resolvedAudioUrl = snapshotAudioUrl;
        if (snapshotImageUrl) resolvedImageUrl = snapshotImageUrl;
        if (snapshotFileUrl) resolvedFileUrl = snapshotFileUrl;
        if (!isImage) resolvedImageUrl = '';
        const imageMime = String(
          auditSnapshot?.imageMime ??
            msg?.imageMime ??
            msg?.imagenMime ??
            e2eImagePayload?.imageMime ??
            ''
        ).trim();
        const imageNombre = String(
          auditSnapshot?.imageNombre ??
            msg?.imageNombre ??
            msg?.imagenNombre ??
            msg?.imageName ??
            e2eImagePayload?.imageNombre ??
            ''
        ).trim();
        const fileMime = String(
          (auditSnapshot as any)?.fileMime ??
            msg?.fileMime ??
            msg?.archivoMime ??
            e2eFilePayload?.fileMime ??
            ''
        ).trim();
        const fileNombre = String(
          (auditSnapshot as any)?.fileNombre ??
            msg?.fileNombre ??
            msg?.archivoNombre ??
            msg?.fileName ??
            e2eFilePayload?.fileNombre ??
            ''
        ).trim();
        const fileSizeRaw = Number(
          (auditSnapshot as any)?.fileSizeBytes ??
            msg?.fileSizeBytes ??
            e2eFilePayload?.fileSizeBytes ??
            NaN
        );
        const fileSizeBytes =
          Number.isFinite(fileSizeRaw) && fileSizeRaw >= 0 ? Math.round(fileSizeRaw) : null;

        const placeholderText = this.resolveTemporalPlaceholderTextForItem(msg);
        let text = String(rawContenido ?? '');
        if (isImage) {
          if (e2eImagePayload) {
            const decryptedImageUrl =
              await this.decryptAdminImagePayloadToObjectUrl(
                e2eImagePayload,
                msg?.id
              );
            resolvedImageUrl = String(decryptedImageUrl || '').trim();
            const caption = await this.decryptAdminImageCaption(e2eImagePayload);
            text = String(caption || '').trim();
          }
          if (this.isLikelySerializedPayloadText(text)) {
            text = '';
          }
          if (!resolvedImageUrl) {
            text = text || 'Imagen (no disponible)';
          }
        } else if (isAudio) {
          text = this.buildAudioVoiceLabel(audioDurMs);
          if (e2eAudioPayload) {
            const decryptedAudioUrl =
              await this.decryptAdminAudioPayloadToObjectUrl(
                e2eAudioPayload,
                msg?.id
              );
            resolvedAudioUrl = decryptedAudioUrl || null;
          }
          if (!resolvedAudioUrl) {
            text = `${text} (audio no disponible)`;
          }
        } else if (isFile) {
          if (!tipo || tipo === 'TEXT') tipo = 'FILE';
          const displayName = fileNombre || String(e2eFilePayload?.fileNombre || '').trim();
          if (e2eFilePayload) {
            const decryptCandidateUserIds = this.buildDecryptCandidateIds(
              emisorId,
              receptorId,
              chat
            );
            const resolvedFileUrlCandidate = resolvedFileUrl;
            resolvedFileUrl = '';
            const decryptedFileUrl =
              await this.decryptAdminFilePayloadToObjectUrl(
                e2eFilePayload,
                msg?.id,
                decryptCandidateUserIds,
                resolvedFileUrlCandidate
              );
            if (decryptedFileUrl) {
              resolvedFileUrl = String(decryptedFileUrl || '').trim();
            }
            const caption = await this.decryptAdminFileCaption(e2eFilePayload);
            text = this.buildAdminFileLabel(displayName, caption);
          } else if (this.isLikelySerializedPayloadText(text)) {
            text = this.buildAdminFileLabel(displayName);
          } else {
            const plain = String(text || '').trim();
            text = /^archivo\s*:/i.test(plain)
              ? plain
              : this.buildAdminFileLabel(displayName, plain);
          }
        } else {
          try {
            if (text && this.isEncryptedE2EPayload(text)) {
              text = await this.decryptContenido(text, emisorId, receptorId, chat);
            }
          } catch {
            // Si falla descifrado dejamos el contenido tal cual.
          }
          pollPayload = pollPayload || parsePollPayload(text);
          const pollPreview = this.buildAdminPollPreviewText(text);
          if (pollPreview) {
            text = pollPreview;
            if (!tipo || tipo === 'TEXT') tipo = 'POLL';
          }
        }
        if (isTemporalExpired) {
          const hasRenderableOriginal =
            !!String(text || '').trim() ||
            !!String(resolvedAudioUrl || '').trim() ||
            !!String(resolvedImageUrl || '').trim() ||
            !!String(resolvedFileUrl || '').trim();
          if (!hasRenderableOriginal) {
            text = placeholderText;
            resolvedAudioUrl = null;
            resolvedImageUrl = '';
            resolvedFileUrl = '';
          }
        }

        const senderName =
          msg?.emisorNombre ||
          msg?.emisor?.nombre ||
          this.resolveMemberNameById(chat, emisorId)?.nombre ||
          msg?.senderName ||
          'Usuario';
        const senderLastName =
          msg?.emisorApellido ||
          msg?.emisorApellidos ||
          msg?.emisor?.apellido ||
          msg?.emisor?.apellidos ||
          this.resolveMemberNameById(chat, emisorId)?.apellido ||
          msg?.senderLastName ||
          '';
        const senderFullName =
          msg?.emisorNombreCompleto ||
          `${senderName}${senderLastName ? ' ' + senderLastName : ''}`.trim();

        return {
          id: msg?.id ?? `msg-${index}`,
          text,
          tipo: tipo || null,
          audioDuracionMs: audioDurMs || null,
          audioUrl: resolvedAudioUrl,
          imageUrl: resolvedImageUrl,
          imageMime: imageMime || null,
          imageNombre: imageNombre || null,
          fileUrl: resolvedFileUrl || null,
          fileMime: fileMime || null,
          fileNombre: fileNombre || null,
          fileSizeBytes,
          senderName,
          senderLastName,
          senderFullName,
          emisorId,
          receptorId,
          chatId: Number(chat?.id || msg?.chatId || 0) || null,
          pollPayload,
          isFromInspectedUser: this.inspectedUserId !== null && emisorId === this.inspectedUserId,
          activo: Number(msg?.activo ?? 1),
          reenviado: this.normalizeBooleanLike(
            this.pickFirstCandidate([
              auditSnapshot?.reenviado,
              msg?.reenviado,
              msg?.reenvio,
              msg?.forwarded,
            ])
          ),
          replyToMessageId: this.pickFirstCandidate([
            auditSnapshot?.replyToMessageId,
            msg?.replyToMessageId,
          ]),
          replySnippet: this.pickFirstCandidate([
            auditSnapshot?.replySnippet,
            msg?.replySnippet,
          ]),
          replyAuthorName: this.pickFirstCandidate([
            auditSnapshot?.replyAuthorName,
            msg?.replyAuthorName,
          ]),
          createdAt: this.pickFirstCandidate([
            auditSnapshot?.fechaEnvio,
            msg?.fechaEnvio,
            msg?.fecha,
            msg?.createdAt,
            msg?.timestamp,
          ]),
          mensajeTemporal: temporalMeta.enabled,
          mensajeTemporalSegundos: temporalMeta.seconds,
          expiraEn: temporalMeta.expiresAt,
          temporalExpirado: temporalMeta.expired,
          estadoTemporal: temporalMeta.status,
          motivoEliminacion:
            msg?.motivoEliminacion ?? msg?.motivo_eliminacion ?? null,
          placeholderTexto:
            msg?.placeholderTexto ?? msg?.placeholder_texto ?? placeholderText,
        };
      })
    );

    return normalized.sort((a, b) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  }

  private pickFirstCandidate(values: any[]): any {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      return value;
    }
    return null;
  }

  private pickFromSourcesByKeys(
    sources: any[],
    keys: string[],
    allowObjects: boolean = false
  ): any {
    if (!Array.isArray(sources) || !Array.isArray(keys)) return null;
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      for (const key of keys) {
        if (!key) continue;
        const value = source?.[key];
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && !value.trim()) continue;
        if (!allowObjects && typeof value === 'object') continue;
        return value;
      }
    }
    return null;
  }

  private collectAdminTemporalAuditSources(msg: any): any[] {
    const keys = [
      'auditoriaTemporal',
      'auditoria_temporal',
      'auditoriaMensajeTemporal',
      'auditoria_mensaje_temporal',
      'mensajeTemporalAuditoria',
      'mensaje_temporal_auditoria',
      'snapshotTemporal',
      'snapshot_temporal',
      'snapshotAuditoria',
      'snapshot_auditoria',
      'auditSnapshot',
      'audit_snapshot',
      'temporalAudit',
      'temporal_audit',
      'auditoria',
      'audit',
      'expiredTemporalSnapshot',
      'expired_temporal_snapshot',
    ];
    const sources: any[] = [];
    for (const key of keys) {
      const candidate = msg?.[key];
      if (!candidate || typeof candidate !== 'object') continue;
      sources.push(candidate);
    }
    return sources;
  }

  private resolveAdminMediaUrlCandidate(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    return resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
  }

  private resolveAdminExpiredTemporalAuditSnapshot(msg: any): {
    contenido: string | null;
    tipo: string;
    audioUrl: string | null;
    imageUrl: string;
    imageMime: string | null;
    imageNombre: string | null;
    audioDuracionMs: number | null;
    reenviado: boolean | null;
    replyToMessageId: any;
    replySnippet: string | null;
    replyAuthorName: string | null;
    fechaEnvio: string | null;
  } {
    const rootSource = msg && typeof msg === 'object' ? [msg] : [];
    const nestedSources = this.collectAdminTemporalAuditSources(msg);

    const directContent = this.pickFromSourcesByKeys(rootSource, [
      'contenidoOriginal',
      'contenido_original',
      'mensajeOriginal',
      'mensaje_original',
      'textoOriginal',
      'texto_original',
      'contentOriginal',
      'content_original',
      'contenidoAuditoria',
      'contenido_auditoria',
      'snapshotContenido',
      'snapshot_contenido',
    ]);
    const nestedContent = this.pickFromSourcesByKeys(nestedSources, [
      'contenidoOriginal',
      'contenido_original',
      'mensajeOriginal',
      'mensaje_original',
      'textoOriginal',
      'texto_original',
      'contentOriginal',
      'content_original',
      'contenido',
      'mensaje',
      'texto',
      'content',
      'contenidoPlano',
      'mensajePlano',
      'textoPlano',
      'rawContent',
      'raw_content',
      'ciphertextOriginal',
      'ciphertext_original',
      'snapshotContenido',
      'snapshot_contenido',
    ]);
    const contenidoRaw = this.pickFirstCandidate([directContent, nestedContent]);

    const directTipo = this.pickFromSourcesByKeys(rootSource, [
      'tipoOriginal',
      'tipo_original',
      'messageTypeOriginal',
      'message_type_original',
      'contenidoTipoOriginal',
      'contenido_tipo_original',
    ]);
    const nestedTipo = this.pickFromSourcesByKeys(nestedSources, [
      'tipoOriginal',
      'tipo_original',
      'messageTypeOriginal',
      'message_type_original',
      'tipo',
      'messageType',
      'type',
      'snapshotTipo',
      'snapshot_tipo',
    ]);
    const tipoRaw = this.pickFirstCandidate([directTipo, nestedTipo]);

    const directAudioUrl = this.pickFromSourcesByKeys(rootSource, [
      'audioUrlOriginal',
      'audio_url_original',
      'urlAudioOriginal',
      'url_audio_original',
      'audioPathOriginal',
      'audio_path_original',
    ]);
    const nestedAudioUrl = this.pickFromSourcesByKeys(nestedSources, [
      'audioUrlOriginal',
      'audio_url_original',
      'urlAudioOriginal',
      'url_audio_original',
      'audioPathOriginal',
      'audio_path_original',
      'audioUrl',
      'urlAudio',
      'audioPath',
      'audio_path',
      'mediaUrl',
      'url',
      'snapshotAudioUrl',
      'snapshot_audio_url',
    ]);

    const directImageUrl = this.pickFromSourcesByKeys(rootSource, [
      'imageUrlOriginal',
      'image_url_original',
      'imagenUrlOriginal',
      'imagen_url_original',
      'urlImagenOriginal',
      'url_imagen_original',
      'imagePathOriginal',
      'image_path_original',
    ]);
    const nestedImageUrl = this.pickFromSourcesByKeys(nestedSources, [
      'imageUrlOriginal',
      'image_url_original',
      'imagenUrlOriginal',
      'imagen_url_original',
      'urlImagenOriginal',
      'url_imagen_original',
      'imagePathOriginal',
      'image_path_original',
      'imageUrl',
      'imagenUrl',
      'urlImagen',
      'imagePath',
      'mediaUrl',
      'url',
      'snapshotImageUrl',
      'snapshot_image_url',
    ]);

    const imageMime = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'imageMimeOriginal',
        'image_mime_original',
        'imagenMimeOriginal',
        'imagen_mime_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'imageMimeOriginal',
        'image_mime_original',
        'imagenMimeOriginal',
        'imagen_mime_original',
        'imageMime',
        'imagenMime',
      ]),
    ]);
    const imageNombre = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'imageNombreOriginal',
        'image_nombre_original',
        'imagenNombreOriginal',
        'imagen_nombre_original',
        'imageNameOriginal',
        'image_name_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'imageNombreOriginal',
        'image_nombre_original',
        'imagenNombreOriginal',
        'imagen_nombre_original',
        'imageNameOriginal',
        'image_name_original',
        'imageNombre',
        'imagenNombre',
        'imageName',
      ]),
    ]);
    const audioDuracionMs = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'audioDuracionMsOriginal',
        'audio_duracion_ms_original',
        'audioDurationMsOriginal',
        'audio_duration_ms_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'audioDuracionMsOriginal',
        'audio_duracion_ms_original',
        'audioDurationMsOriginal',
        'audio_duration_ms_original',
        'audioDuracionMs',
        'audioDurationMs',
        'durMs',
      ]),
    ]);
    const reenviadoRaw = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'reenviadoOriginal',
        'reenviado_original',
        'forwardedOriginal',
        'forwarded_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'reenviadoOriginal',
        'reenviado_original',
        'forwardedOriginal',
        'forwarded_original',
        'reenviado',
        'reenvio',
        'forwarded',
      ]),
    ]);
    const replyToMessageId = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'replyToMessageIdOriginal',
        'reply_to_message_id_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'replyToMessageIdOriginal',
        'reply_to_message_id_original',
        'replyToMessageId',
        'reply_to_message_id',
      ]),
    ]);
    const replySnippet = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'replySnippetOriginal',
        'reply_snippet_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'replySnippetOriginal',
        'reply_snippet_original',
        'replySnippet',
        'reply_snippet',
      ]),
    ]);
    const replyAuthorName = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'replyAuthorNameOriginal',
        'reply_author_name_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'replyAuthorNameOriginal',
        'reply_author_name_original',
        'replyAuthorName',
        'reply_author_name',
      ]),
    ]);
    const fechaEnvio = this.pickFirstCandidate([
      this.pickFromSourcesByKeys(rootSource, [
        'fechaEnvioOriginal',
        'fecha_envio_original',
        'createdAtOriginal',
        'created_at_original',
      ]),
      this.pickFromSourcesByKeys(nestedSources, [
        'fechaEnvioOriginal',
        'fecha_envio_original',
        'createdAtOriginal',
        'created_at_original',
        'fechaEnvio',
        'fecha',
        'createdAt',
        'timestamp',
      ]),
    ]);

    const tipo =
      this.normalizeAdminLastMessageTipo(tipoRaw) ||
      this.inferAdminLastMessageTipoFromRaw(contenidoRaw) ||
      '';

    const contenidoText =
      contenidoRaw === undefined || contenidoRaw === null
        ? null
        : String(contenidoRaw);

    const audioUrlRaw = this.pickFirstCandidate([directAudioUrl, nestedAudioUrl]);
    const imageUrlRaw = this.pickFirstCandidate([directImageUrl, nestedImageUrl]);

    const audioDurNum = Number(audioDuracionMs);
    return {
      contenido: contenidoText,
      tipo,
      audioUrl: String(audioUrlRaw || '').trim() || null,
      imageUrl: String(imageUrlRaw || '').trim(),
      imageMime: String(imageMime || '').trim() || null,
      imageNombre: String(imageNombre || '').trim() || null,
      audioDuracionMs:
        Number.isFinite(audioDurNum) && audioDurNum > 0
          ? Math.round(audioDurNum)
          : null,
      reenviado:
        reenviadoRaw === undefined || reenviadoRaw === null
          ? null
          : this.normalizeBooleanLike(reenviadoRaw),
      replyToMessageId:
        replyToMessageId === undefined ? null : replyToMessageId,
      replySnippet:
        replySnippet === undefined || replySnippet === null
          ? null
          : String(replySnippet),
      replyAuthorName:
        replyAuthorName === undefined || replyAuthorName === null
          ? null
          : String(replyAuthorName),
      fechaEnvio:
        fechaEnvio === undefined || fechaEnvio === null
          ? null
          : String(fechaEnvio),
    };
  }

  private normalizeBooleanLike(value: any): boolean {
    if (value === true) return true;
    const n = Number(value);
    if (Number.isFinite(n)) return n === 1;
    const text = String(value || '').trim().toLowerCase();
    return text === 'true' || text === 'yes' || text === 'si';
  }

  private normalizePositiveSeconds(value: any): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }

  private normalizeDateIso(value: any): string | null {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) return null;
    return new Date(ts).toISOString();
  }

  private resolveTemporalMeta(
    enabledCandidates: any[],
    secondsCandidates: any[],
    expiresCandidates: any[],
    statusCandidates: any[] = []
  ): {
    enabled: boolean;
    seconds: number | null;
    expiresAt: string | null;
    expired: boolean;
    status: TemporalEstado;
  } {
    const enabledRaw = this.pickFirstCandidate(enabledCandidates);
    const secondsRaw = this.pickFirstCandidate(secondsCandidates);
    const expiresRaw = this.pickFirstCandidate(expiresCandidates);
    const statusRaw = this.pickFirstCandidate(statusCandidates);

    const seconds = this.normalizePositiveSeconds(secondsRaw);
    const expiresAt = this.normalizeDateIso(expiresRaw);
    const enabled = this.normalizeBooleanLike(enabledRaw) || !!seconds || !!expiresAt;
    const expired =
      !!expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now();
    const status = this.normalizeTemporalStatus(statusRaw, enabled, expired);

    return { enabled, seconds, expiresAt, expired, status };
  }

  private resolveTemporalMetaForMessage(msg: any): {
    enabled: boolean;
    seconds: number | null;
    expiresAt: string | null;
    expired: boolean;
    status: TemporalEstado;
  } {
    return this.resolveTemporalMeta(
      [msg?.mensajeTemporal, msg?.mensaje_temporal, msg?.temporal, msg?.isTemporal],
      [
        msg?.mensajeTemporalSegundos,
        msg?.mensaje_temporal_segundos,
        msg?.temporalSegundos,
        msg?.ttlSeconds,
        msg?.ttl_segundos,
        msg?.ttl,
      ],
      [msg?.expiraEn, msg?.expira_en, msg?.expiresAt, msg?.expires_at],
      [msg?.estadoTemporal, msg?.estado_temporal, msg?.temporalEstado]
    );
  }

  private resolveTemporalMetaForSummary(chat: any): {
    enabled: boolean;
    seconds: number | null;
    expiresAt: string | null;
    expired: boolean;
    status: TemporalEstado;
  } {
    const lastMsg = chat?.ultimoMensajeDto || chat?.ultimoMensajeData || chat?.ultimoMensajePayload || null;
    return this.resolveTemporalMeta(
      [
        chat?.ultimoMensajeTemporal,
        chat?.ultimo_mensaje_temporal,
        chat?.mensajeTemporal,
        lastMsg?.mensajeTemporal,
        lastMsg?.mensaje_temporal,
      ],
      [
        chat?.ultimoMensajeTemporalSegundos,
        chat?.ultimo_mensaje_temporal_segundos,
        chat?.mensajeTemporalSegundos,
        chat?.ultimoMensajeTtlSegundos,
        chat?.ultimoMensajeTtlSeconds,
        lastMsg?.mensajeTemporalSegundos,
        lastMsg?.mensaje_temporal_segundos,
      ],
      [
        chat?.ultimoMensajeExpiraEn,
        chat?.ultimoMensajeExpira_en,
        chat?.ultimoMensajeExpiresAt,
        chat?.expiraEn,
        chat?.expira_en,
        lastMsg?.expiraEn,
        lastMsg?.expira_en,
        lastMsg?.expiresAt,
      ],
      [
        chat?.ultimoMensajeEstadoTemporal,
        chat?.ultimo_mensaje_estado_temporal,
        lastMsg?.estadoTemporal,
        lastMsg?.estado_temporal,
      ]
    );
  }

  private normalizeTemporalStatus(
    statusRaw: any,
    enabledFallback: boolean,
    expiredFallback: boolean
  ): TemporalEstado {
    const normalized = String(statusRaw || '')
      .trim()
      .toUpperCase();
    if (
      normalized === 'ACTIVO' ||
      normalized === 'EXPIRADO' ||
      normalized === 'NO_TEMPORAL'
    ) {
      return normalized as TemporalEstado;
    }
    if (!enabledFallback) return 'NO_TEMPORAL';
    return expiredFallback ? 'EXPIRADO' : 'ACTIVO';
  }

  private formatTemporalDurationShort(secondsRaw: number | null | undefined): string {
    const seconds = Number(secondsRaw || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    if (seconds % (24 * 60 * 60) === 0) return `${seconds / (24 * 60 * 60)}d`;
    if (seconds % (60 * 60) === 0) return `${seconds / (60 * 60)}h`;
    if (seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`;
  }

  public adminTemporalChipLabel(item: any): string {
    const duration = this.formatTemporalDurationShort(
      Number(item?.mensajeTemporalSegundos ?? item?.__ultimoTemporalSegundos ?? 0)
    );
    return duration ? `Temporal ${duration}` : 'Temporal';
  }

  public adminTemporalStatusLabel(item: any): string {
    const status = this.resolveTemporalStatusForItem(item);
    if (status === 'ACTIVO') return 'Activo';
    if (status === 'EXPIRADO') return 'Expirado';
    return 'No temporal';
  }

  public adminTemporalStatusClass(item: any): string {
    const status = this.resolveTemporalStatusForItem(item);
    if (status === 'ACTIVO') return 'admin-temporal-chip--active';
    if (status === 'EXPIRADO') return 'admin-temporal-chip--expired';
    return 'admin-temporal-chip--none';
  }

  private resolveTemporalStatusForItem(item: any): TemporalEstado {
    const raw = String(item?.estadoTemporal ?? item?.__ultimoTemporalStatus ?? '')
      .trim()
      .toUpperCase();
    if (
      raw === 'ACTIVO' ||
      raw === 'EXPIRADO' ||
      raw === 'NO_TEMPORAL'
    ) {
      return raw as TemporalEstado;
    }
    const enabled =
      !!item?.mensajeTemporal || !!item?.__ultimoTemporalEnabled;
    const expired =
      !!item?.temporalExpirado || !!item?.__ultimoTemporalExpired;
    if (!enabled) return 'NO_TEMPORAL';
    return expired ? 'EXPIRADO' : 'ACTIVO';
  }

  public isAdminTemporalExpiredMessage(item: any): boolean {
    return this.resolveTemporalStatusForItem(item) === 'EXPIRADO';
  }

  public isAdminDeletedByUserMessage(item: any): boolean {
    const isInactive = Number(item?.activo ?? 1) === 0 || item?.activo === false;
    if (!isInactive) return false;
    return !this.isAdminTemporalExpiredMessage(item);
  }

  private formatTemporalDurationLong(secondsRaw: unknown): string {
    const seconds = Number(secondsRaw);
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    if (seconds % (24 * 60 * 60) === 0) {
      const days = Math.round(seconds / (24 * 60 * 60));
      return `${days} ${days === 1 ? 'dia' : 'dias'}`;
    }
    if (seconds % (60 * 60) === 0) {
      const hours = Math.round(seconds / (60 * 60));
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    if (seconds % 60 === 0) {
      const mins = Math.round(seconds / 60);
      return `${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
    }
    return `${Math.round(seconds)} segundos`;
  }

  private resolveTemporalPlaceholderTextForItem(item: any): string {
    const explicit = String(
      item?.placeholderTexto ??
        item?.placeholder_texto ??
        item?.ultimoMensajePlaceholderTexto ??
        item?.ultimo_mensaje_placeholder_texto ??
        item?.contenido ??
        item?.ultimoMensaje ??
        item?.ultimoMensajeTexto ??
        ''
    ).trim();
    if (explicit) return explicit;
    const duration = this.formatTemporalDurationLong(
      item?.mensajeTemporalSegundos ??
        item?.mensaje_temporal_segundos ??
        item?.ultimoMensajeTemporalSegundos ??
        item?.ultimo_mensaje_temporal_segundos
    );
    if (duration) {
      return `Se trataba de un mensaje temporal que solo estaba disponible los primeros ${duration}.`;
    }
    return 'Se trataba de un mensaje temporal que ya ha expirado.';
  }

  public setAdminTemporalFilter(filter: AdminTemporalFilter): void {
    this.adminTemporalFilter = filter;
  }

  public isAdminTemporalFilterActive(filter: AdminTemporalFilter): boolean {
    return this.adminTemporalFilter === filter;
  }

  public get filteredSelectedChatMensajes(): any[] {
    const list = Array.isArray(this.selectedChatMensajes)
      ? this.selectedChatMensajes
      : [];
    if (this.adminTemporalFilter === 'TODOS') return list;
    return list.filter(
      (msg) => this.resolveTemporalStatusForItem(msg) === this.adminTemporalFilter
    );
  }

  private isAudioLikePayload(payload: any, tipo: string, isSummary: boolean): boolean {
    if (tipo === 'AUDIO') return true;
    if (isSummary) {
      return !!(
        payload?.ultimoMensajeAudioUrl ||
        payload?.ultimoAudioUrl ||
        payload?.audioUrl ||
        payload?.ultimoMensajeAudioDuracionMs ||
        payload?.ultimoMensajeDurMs ||
        payload?.ultimoDurMs
      );
    }
    return !!(
      payload?.audioUrl ||
      payload?.urlAudio ||
      payload?.audioPath ||
      payload?.audio_path ||
      payload?.mediaUrl ||
      payload?.url ||
      payload?.audioMime ||
      payload?.audioDuracionMs ||
      payload?.durMs ||
      payload?.durationMs
    );
  }

  private isImageLikePayload(payload: any, tipo: string, isSummary: boolean): boolean {
    if (tipo === 'IMAGE') return true;
    if (isSummary) {
      return !!(
        payload?.ultimoMensajeImageUrl ||
        payload?.ultimaMensajeImageUrl ||
        payload?.ultimoImageUrl ||
        payload?.imageUrl ||
        payload?.ultimoMensajeImageNombre ||
        payload?.ultimaMensajeImageNombre
      );
    }
    return !!(
      payload?.imageUrl ||
      payload?.imagenUrl ||
      payload?.urlImagen ||
      payload?.imagePath ||
      payload?.imageMime ||
      payload?.imageNombre ||
      payload?.imagenNombre
    );
  }

  private isFileLikePayload(payload: any, tipo: string, isSummary: boolean): boolean {
    if (tipo === 'FILE') return true;
    if (isSummary) {
      return !!(
        payload?.ultimoMensajeFileUrl ||
        payload?.ultimaMensajeFileUrl ||
        payload?.ultimoFileUrl ||
        payload?.fileUrl ||
        payload?.ultimoMensajeFileNombre ||
        payload?.ultimaMensajeFileNombre ||
        payload?.fileNombre
      );
    }
    return !!(
      payload?.fileUrl ||
      payload?.archivoUrl ||
      payload?.urlArchivo ||
      payload?.filePath ||
      payload?.fileMime ||
      payload?.fileNombre ||
      payload?.archivoNombre
    );
  }

  private resolveFileUrlFromPayload(
    payload: any,
    rawContenido: unknown,
    e2eFilePayload?: AdminFileE2EPayload | null
  ): string {
    const directE2E = String(
      e2eFilePayload?.fileUrl ?? this.parseAdminFileE2EPayload(rawContenido)?.fileUrl ?? ''
    ).trim();
    if (directE2E) {
      return resolveMediaUrl(directE2E, environment.backendBaseUrl) || directE2E;
    }

    const candidates = [
      payload?.fileUrl,
      payload?.archivoUrl,
      payload?.urlArchivo,
      payload?.filePath,
      payload?.mediaUrl,
      payload?.url,
      rawContenido,
    ];

    for (const candidate of candidates) {
      const raw = String(candidate ?? '').trim();
      if (!raw) continue;
      if (!this.isLikelyFileUrl(raw)) continue;
      const resolved = resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
      if (resolved) return resolved;
    }

    return '';
  }
  private resolveImageUrlFromPayload(
    payload: any,
    rawContenido: unknown,
    e2eImagePayload?: AdminImageE2EPayload | null
  ): string {
    const directE2E = String(
      e2eImagePayload?.imageUrl ??
        this.parseAdminImageE2EPayload(rawContenido)?.imageUrl ??
        ''
    ).trim();
    if (directE2E) {
      return resolveMediaUrl(directE2E, environment.backendBaseUrl) || directE2E;
    }

    const candidates = [
      payload?.imageUrl,
      payload?.imagenUrl,
      payload?.urlImagen,
      payload?.imagePath,
      payload?.mediaUrl,
      payload?.url,
    ];

    if (!this.isLikelySerializedPayloadText(rawContenido)) {
      candidates.push(rawContenido);
    }

    for (const candidate of candidates) {
      const raw = String(candidate ?? '').trim();
      if (!raw) continue;
      if (!this.isLikelyImageUrl(raw)) continue;
      const resolved = resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
      if (resolved) return resolved;
    }
    return '';
  }
  private resolveAudioUrlFromPayload(
    payload: any,
    rawContenido: unknown,
    e2eAudioPayload?: AdminAudioE2EPayload | null
  ): string | null {
    const candidates = [
      e2eAudioPayload?.audioUrl ??
        this.parseAdminAudioE2EPayload(rawContenido)?.audioUrl,
      payload?.audioUrl,
      payload?.urlAudio,
      payload?.audioPath,
      payload?.audio_path,
      payload?.mediaUrl,
      payload?.url,
      rawContenido,
    ];

    for (const candidate of candidates) {
      const raw = String(candidate ?? '').trim();
      if (!raw) continue;
      if (!this.isLikelyAudioUrl(raw)) continue;
      const resolved = resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
      if (resolved) return resolved;
    }
    return null;
  }

  private parseAdminAudioE2EPayload(
    contenido: unknown
  ): AdminAudioE2EPayload | null {
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

    const type = String(payload?.type || '').trim().toUpperCase();
    if (type !== 'E2E_AUDIO' && type !== 'E2E_GROUP_AUDIO') return null;

    const ivFile = String(payload?.ivFile || '').trim();
    const forAdmin = String(payload?.forAdmin || '').trim();
    const audioUrl = String(payload?.audioUrl || '').trim();
    if (!ivFile || !forAdmin || !audioUrl) return null;

    const parsed: AdminAudioE2EPayload = {
      type: type as AdminAudioE2EPayload['type'],
      ivFile,
      audioUrl,
      forAdmin,
    };

    const audioMime = String(payload?.audioMime || '').trim();
    if (audioMime) parsed.audioMime = audioMime;

    const dur = Number(payload?.audioDuracionMs);
    if (Number.isFinite(dur) && dur > 0) parsed.audioDuracionMs = dur;

    return parsed;
  }

  private parseAdminImageE2EPayload(
    contenido: unknown
  ): AdminImageE2EPayload | null {
    const payload = this.parseAdminPayload(contenido);
    if (!payload) return null;

    const type = String(payload?.type || '').trim().toUpperCase();
    if (type !== 'E2E_IMAGE' && type !== 'E2E_GROUP_IMAGE') return null;

    const ivFile = String(payload?.ivFile || '').trim();
    const forAdmin = String(payload?.forAdmin || '').trim();
    const imageUrl = String(payload?.imageUrl || '').trim();
    if (!ivFile || !forAdmin || !imageUrl) return null;

    const parsed: AdminImageE2EPayload = {
      type: type as AdminImageE2EPayload['type'],
      ivFile,
      imageUrl,
      forAdmin,
    };

    const imageMime = String(payload?.imageMime || '').trim();
    if (imageMime) parsed.imageMime = imageMime;
    const imageNombre = String(payload?.imageNombre || '').trim();
    if (imageNombre) parsed.imageNombre = imageNombre;
    const captionIv = String(payload?.captionIv || '').trim();
    if (captionIv) parsed.captionIv = captionIv;
    const captionCiphertext = String(payload?.captionCiphertext || '').trim();
    if (captionCiphertext) parsed.captionCiphertext = captionCiphertext;

    return parsed;
  }

  private parseAdminFileE2EPayload(
    contenido: unknown
  ): AdminFileE2EPayload | null {
    const payload = this.parseAdminPayload(contenido);
    if (!payload) return null;

    const type = String(payload?.type || '').trim().toUpperCase();
    if (type !== 'E2E_FILE' && type !== 'E2E_GROUP_FILE') return null;

    const ivFile = String(payload?.ivFile || '').trim();
    if (!ivFile) return null;

    const forAdmin = String(payload?.forAdmin || '').trim();
    const forEmisor = String(payload?.forEmisor || '').trim();
    const forReceptor = String(payload?.forReceptor || '').trim();
    const forReceptoresRaw =
      payload?.forReceptores && typeof payload.forReceptores === 'object'
        ? payload.forReceptores
        : null;
    const forReceptores = forReceptoresRaw
      ? Object.entries(forReceptoresRaw).reduce((acc, [k, v]) => {
          const key = String(k || '').trim();
          const value = String(v || '').trim();
          if (!key || !value) return acc;
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>)
      : undefined;
    const hasRecipientEnvelope = !!(
      forAdmin ||
      forEmisor ||
      forReceptor ||
      (forReceptores && Object.keys(forReceptores).length)
    );
    if (!hasRecipientEnvelope) return null;

    const parsed: AdminFileE2EPayload = {
      type: type as AdminFileE2EPayload['type'],
      ivFile,
      fileUrl: String(
        payload?.fileUrl ?? payload?.archivoUrl ?? payload?.urlArchivo ?? ''
      ).trim(),
    };
    if (forAdmin) parsed.forAdmin = forAdmin;
    if (forEmisor) parsed.forEmisor = forEmisor;
    if (forReceptor) parsed.forReceptor = forReceptor;
    if (forReceptores && Object.keys(forReceptores).length) {
      parsed.forReceptores = forReceptores;
    }

    const fileMime = String(payload?.fileMime || '').trim();
    if (fileMime) parsed.fileMime = fileMime;
    const fileNombre = String(payload?.fileNombre || '').trim();
    if (fileNombre) parsed.fileNombre = fileNombre;
    const fileSizeRaw = Number(payload?.fileSizeBytes);
    if (Number.isFinite(fileSizeRaw) && fileSizeRaw >= 0) {
      parsed.fileSizeBytes = Math.round(fileSizeRaw);
    }
    const captionIv = String(payload?.captionIv || '').trim();
    if (captionIv) parsed.captionIv = captionIv;
    const captionCiphertext = String(payload?.captionCiphertext || '').trim();
    if (captionCiphertext) parsed.captionCiphertext = captionCiphertext;

    return parsed;
  }
  private buildAdminImageE2ECacheKey(
    messageId: unknown,
    payload: AdminImageE2EPayload
  ): string {
    const id = Number(messageId);
    if (Number.isFinite(id) && id > 0) {
      return `msg-image:${id}:${payload.ivFile}`;
    }
    return `payload-image:${payload.type}:${payload.ivFile}:${payload.imageUrl}`;
  }

  private async decryptAdminImagePayloadToObjectUrl(
    payload: AdminImageE2EPayload,
    messageId: unknown
  ): Promise<string | null> {
    const cacheKey = this.buildAdminImageE2ECacheKey(messageId, payload);
    const cached = this.adminDecryptedImageUrlByCacheKey.get(cacheKey);
    if (cached) return cached;

    const inFlight = this.adminDecryptingImageByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const decryptPromise = (async (): Promise<string | null> => {
      try {
        const auditPrivateKey = await this.importAuditPrivateKeyFromStorage();
        if (!auditPrivateKey) return null;

        const aesRawBase64 = await this.cryptoService.decryptRSA(
          String(payload.forAdmin),
          auditPrivateKey
        );
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);

        const encryptedUrl = resolveMediaUrl(
          payload.imageUrl,
          environment.backendBaseUrl
        );
        if (!encryptedUrl) return null;

        const response = await fetch(encryptedUrl);
        if (!response.ok) {
          console.warn('[ADMIN_E2E][image-fetch-failed]', {
            messageId: Number(messageId || 0),
            status: Number(response.status),
          });
          return null;
        }

        const encryptedBytes = await response.arrayBuffer();
        const decryptedBuffer = await this.cryptoService.decryptAESBinary(
          encryptedBytes,
          payload.ivFile,
          aesKey
        );
        const mime = String(payload.imageMime || 'image/png').trim() || 'image/png';
        const objectUrl = URL.createObjectURL(
          new Blob([decryptedBuffer], { type: mime })
        );

        const prev = this.adminDecryptedImageUrlByCacheKey.get(cacheKey);
        if (prev && prev !== objectUrl) {
          try {
            URL.revokeObjectURL(prev);
          } catch {}
        }
        this.adminDecryptedImageUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch (err) {
        console.warn('[ADMIN_E2E][image-decrypt-failed]', {
          messageId: Number(messageId || 0),
          error: String((err as any)?.message || err),
        });
        return null;
      } finally {
        this.adminDecryptingImageByCacheKey.delete(cacheKey);
      }
    })();

    this.adminDecryptingImageByCacheKey.set(cacheKey, decryptPromise);
    return decryptPromise;
  }
    private async decryptAdminImageCaption(
    payload: AdminImageE2EPayload
  ): Promise<string> {
    if (!payload?.captionCiphertext || !payload?.captionIv) return '';
    if (!payload?.forAdmin) return '';

    const cacheKey = `caption:${payload.ivFile}:${payload.imageUrl}`;
    const cached = this.adminImageCaptionByCacheKey.get(cacheKey);
    if (typeof cached === 'string') return cached;

    const inFlight = this.adminDecryptingImageCaptionByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      try {
        const auditPrivateKey = await this.importAuditPrivateKeyFromStorage();
        if (!auditPrivateKey) return '';
        const aesRawBase64 = await this.cryptoService.decryptRSA(
          String(payload.forAdmin),
          auditPrivateKey
        );
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);
        const plain = await this.cryptoService.decryptAES(
          String(payload.captionCiphertext),
          String(payload.captionIv),
          aesKey
        );
        const caption = String(plain || '').trim();
        this.adminImageCaptionByCacheKey.set(cacheKey, caption);
        return caption;
      } catch {
        this.adminImageCaptionByCacheKey.set(cacheKey, '');
        return '';
      } finally {
        this.adminDecryptingImageCaptionByCacheKey.delete(cacheKey);
      }
    })();

    this.adminDecryptingImageCaptionByCacheKey.set(cacheKey, promise);
    return promise;
  }

  private buildAdminFileE2ECacheKey(
    messageId: unknown,
    payload: AdminFileE2EPayload
  ): string {
    const id = Number(messageId);
    if (Number.isFinite(id) && id > 0) {
      return `msg-file:${id}:${payload.ivFile}`;
    }
    return `payload-file:${payload.type}:${payload.ivFile}:${payload.fileUrl}`;
  }

  private async decryptAdminFilePayloadToObjectUrl(
    payload: AdminFileE2EPayload,
    messageId: unknown,
    candidateUserIds: number[] = [],
    fallbackEncryptedUrl?: string
  ): Promise<string | null> {
    const cacheKey = this.buildAdminFileE2ECacheKey(messageId, payload);
    const cached = this.adminDecryptedFileUrlByCacheKey.get(cacheKey);
    if (cached) return cached;

    const inFlight = this.adminDecryptingFileByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const decryptPromise = (async (): Promise<string | null> => {
      try {
        let aesRawBase64 = '';
        if (payload.forAdmin) {
          const auditPrivateKey = await this.importAuditPrivateKeyFromStorage();
          if (auditPrivateKey) {
            try {
              aesRawBase64 = await this.cryptoService.decryptRSA(
                String(payload.forAdmin),
                auditPrivateKey
              );
            } catch {
              aesRawBase64 = '';
            }
          }
        }
        if (!aesRawBase64) {
          aesRawBase64 = await this.decryptAdminFileAesWithLocalCandidates(
            payload,
            candidateUserIds
          );
        }
        if (!aesRawBase64) return null;
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);

        const encryptedUrl = resolveMediaUrl(
          payload.fileUrl || String(fallbackEncryptedUrl || '').trim(),
          environment.backendBaseUrl
        );
        if (!encryptedUrl) return null;

        const response = await fetch(encryptedUrl);
        if (!response.ok) {
          console.warn('[ADMIN_E2E][file-fetch-failed]', {
            messageId: Number(messageId || 0),
            status: Number(response.status),
          });
          return null;
        }

        const encryptedBytes = await response.arrayBuffer();
        const decryptedBuffer = await this.cryptoService.decryptAESBinary(
          encryptedBytes,
          payload.ivFile,
          aesKey
        );
        const mime = String(payload.fileMime || 'application/octet-stream').trim() || 'application/octet-stream';
        const objectUrl = URL.createObjectURL(
          new Blob([decryptedBuffer], { type: mime })
        );

        const prev = this.adminDecryptedFileUrlByCacheKey.get(cacheKey);
        if (prev && prev !== objectUrl) {
          try {
            URL.revokeObjectURL(prev);
          } catch {}
        }
        this.adminDecryptedFileUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch (err) {
        console.warn('[ADMIN_E2E][file-decrypt-failed]', {
          messageId: Number(messageId || 0),
          error: String((err as any)?.message || err),
        });
        return null;
      } finally {
        this.adminDecryptingFileByCacheKey.delete(cacheKey);
      }
    })();

    this.adminDecryptingFileByCacheKey.set(cacheKey, decryptPromise);
    return decryptPromise;
  }

  private buildAdminFileEnvelopeCandidates(
    payload: AdminFileE2EPayload,
    userId: number
  ): string[] {
    const ordered: string[] = [];
    const pushIfAny = (value: unknown) => {
      const clean = String(value || '').trim();
      if (!clean) return;
      if (!ordered.includes(clean)) ordered.push(clean);
    };

    pushIfAny(payload.forEmisor);
    if (payload.type === 'E2E_FILE') {
      pushIfAny(payload.forReceptor);
    } else {
      pushIfAny(payload.forReceptores?.[String(userId)]);
      const allGroupEnvelopes = Object.values(payload.forReceptores || {});
      for (const env of allGroupEnvelopes) pushIfAny(env);
    }

    pushIfAny(payload.forAdmin);
    return ordered;
  }

  private async decryptAdminFileAesWithLocalCandidates(
    payload: AdminFileE2EPayload,
    candidateUserIds: number[]
  ): Promise<string> {
    const ids = Array.isArray(candidateUserIds) ? candidateUserIds : [];
    for (const userIdRaw of ids) {
      const userId = Number(userIdRaw);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      const keyRaw = String(localStorage.getItem('privateKey_' + userId) || '').trim();
      if (!keyRaw) continue;

      try {
        const privateKey = await this.cryptoService.importPrivateKey(keyRaw);
        const envelopes = this.buildAdminFileEnvelopeCandidates(payload, userId);
        for (const envelope of envelopes) {
          try {
            const plain = await this.cryptoService.decryptRSA(envelope, privateKey);
            if (String(plain || '').trim()) return String(plain).trim();
          } catch {
            // Seguimos intentando con el siguiente sobre/candidato.
          }
        }
      } catch {
        // Ignoramos claves privadas locales invalidas.
      }
    }
    return '';
  }
  private async decryptAdminFileCaption(
    payload: AdminFileE2EPayload
  ): Promise<string> {
    if (!payload?.captionCiphertext || !payload?.captionIv) return '';
    if (!payload?.forAdmin) return '';

    const cacheKey = `file-caption:${payload.ivFile}:${payload.fileUrl}`;
    const cached = this.adminFileCaptionByCacheKey.get(cacheKey);
    if (typeof cached === 'string') return cached;

    const inFlight = this.adminDecryptingFileCaptionByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      try {
        const auditPrivateKey = await this.importAuditPrivateKeyFromStorage();
        if (!auditPrivateKey) return '';
        const aesRawBase64 = await this.cryptoService.decryptRSA(
          String(payload.forAdmin),
          auditPrivateKey
        );
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);
        const plain = await this.cryptoService.decryptAES(
          String(payload.captionCiphertext),
          String(payload.captionIv),
          aesKey
        );
        const caption = String(plain || '').trim();
        this.adminFileCaptionByCacheKey.set(cacheKey, caption);
        return caption;
      } catch {
        this.adminFileCaptionByCacheKey.set(cacheKey, '');
        return '';
      } finally {
        this.adminDecryptingFileCaptionByCacheKey.delete(cacheKey);
      }
    })();

    this.adminDecryptingFileCaptionByCacheKey.set(cacheKey, promise);
    return promise;
  }
  private buildAdminAudioE2ECacheKey(
    messageId: unknown,
    payload: AdminAudioE2EPayload
  ): string {
    const id = Number(messageId);
    if (Number.isFinite(id) && id > 0) {
      return `msg:${id}:${payload.ivFile}`;
    }
    return `payload:${payload.type}:${payload.ivFile}:${payload.audioUrl}`;
  }

  private async decryptAdminAudioPayloadToObjectUrl(
    payload: AdminAudioE2EPayload,
    messageId: unknown
  ): Promise<string | null> {
    const cacheKey = this.buildAdminAudioE2ECacheKey(messageId, payload);
    const cached = this.adminDecryptedAudioUrlByCacheKey.get(cacheKey);
    if (cached) return cached;

    const inFlight = this.adminDecryptingAudioByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const decryptPromise = (async (): Promise<string | null> => {
      try {
        const auditPrivateKey = await this.importAuditPrivateKeyFromStorage();
        if (!auditPrivateKey) return null;

        const aesRawBase64 = await this.cryptoService.decryptRSA(
          String(payload.forAdmin),
          auditPrivateKey
        );
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);

        const encryptedUrl = resolveMediaUrl(
          payload.audioUrl,
          environment.backendBaseUrl
        );
        if (!encryptedUrl) return null;

        const response = await fetch(encryptedUrl);
        if (!response.ok) {
          console.warn('[ADMIN_E2E][audio-fetch-failed]', {
            messageId: Number(messageId || 0),
            status: Number(response.status),
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

        const prev = this.adminDecryptedAudioUrlByCacheKey.get(cacheKey);
        if (prev && prev !== objectUrl) {
          try {
            URL.revokeObjectURL(prev);
          } catch {}
        }
        this.adminDecryptedAudioUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch (err) {
        console.warn('[ADMIN_E2E][audio-decrypt-failed]', {
          messageId: Number(messageId || 0),
          error: String((err as any)?.message || err),
        });
        return null;
      } finally {
        this.adminDecryptingAudioByCacheKey.delete(cacheKey);
      }
    })();

    this.adminDecryptingAudioByCacheKey.set(cacheKey, decryptPromise);
    return decryptPromise;
  }

  private isLikelyAudioUrl(value: string): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();
    if (lower.startsWith('data:audio/')) return true;
    if (
      lower.includes('/api/uploads/audio') ||
      lower.includes('/uploads/audio') ||
      lower.includes('/audio/')
    ) {
      return true;
    }
    if (/\.(mp3|mpeg|ogg|wav|webm|m4a)(\?|#|$)/i.test(raw)) return true;
    return false;
  }

  private isLikelyFileUrl(value: string): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();
    if (lower.startsWith('blob:')) return true;
    if (lower.startsWith('data:application/')) return true;
    if (
      lower.includes('/api/uploads/file') ||
      lower.includes('/uploads/file') ||
      lower.includes('/uploads/media') ||
      lower.includes('/files/')
    ) {
      return true;
    }
    if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z|bin)(\?|#|$)/i.test(raw)) {
      return true;
    }
    return false;
  }
  private isLikelyImageUrl(value: string): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();
    if (lower.startsWith('data:image/')) return true;
    if (
      lower.includes('/api/uploads/image') ||
      lower.includes('/uploads/image') ||
      lower.includes('/uploads/media') ||
      lower.includes('/image/')
    ) {
      return true;
    }
    if (/\.(png|jpe?g|webp|gif|bmp|svg|avif|bin)(\?|#|$)/i.test(raw)) return true;
    return false;
  }

  private isLikelySerializedPayloadText(value: unknown): boolean {
    const payload = this.parseAdminPayload(this.extractAdminPayloadCandidate(value));
    return !!String(payload?.type || '').trim();
  }

  public isAdminAudioPreviewChat(chat: any): boolean {
    const tipo = this.resolveAdminLastMessageTipo(chat);
    if (tipo === 'AUDIO') return true;
    if (chat?.__ultimoEsAudio === true) return true;
    const preview = String(chat?.ultimoMensajePreview || chat?.ultimoMensaje || '').toLowerCase();
    return preview.includes('mensaje de voz') || /\baudio\b/.test(preview);
  }

  public adminAudioPreviewTime(chat: any): string {
    const durMs = Number(
      chat?.__ultimoAudioDurMs ??
        chat?.ultimoMensajeAudioDuracionMs ??
        chat?.ultimaMensajeAudioDuracionMs ??
        0
    );
    if (Number.isFinite(durMs) && durMs > 0) return this.adminFormatDur(durMs);

    const preview = String(chat?.ultimoMensajePreview || chat?.ultimoMensaje || '');
    const m = preview.match(/\((\d{1,2}):([0-5]\d)\)/);
    if (!m) return '00:00';
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }

  public adminAudioPreviewLabel(chat: any): string {
    const preview = String(chat?.ultimoMensajePreview || chat?.ultimoMensaje || '').trim();
    const match = /^([^:]{1,30}):\s*/.exec(preview);
    return String(match?.[1] || '').trim();
  }

  public isAdminImagePreviewChat(chat: any): boolean {
    const tipo = this.resolveAdminLastMessageTipo(chat);
    if (tipo === 'FILE' || chat?.__ultimoEsArchivo === true) return false;
    if (tipo === 'IMAGE') return true;
    if (chat?.__ultimoEsImagen === true) return true;
    const raw = this.getAdminLastMessageRaw(chat);
    const payload = this.parseAdminImageE2EPayload(this.extractAdminPayloadCandidate(raw));
    if (payload) return true;
    const preview = String(chat?.ultimoMensajePreview || chat?.ultimoMensaje || '').toLowerCase();
    return preview.includes('imagen');
  }
  public adminImagePreviewSrc(chat: any): string {
    return String(chat?.__ultimoImagenUrl || '').trim();
  }

  public adminImagePreviewAlt(chat: any): string {
    const name = String(chat?.__ultimoImagenNombre || '').trim();
    return name || 'Imagen';
  }

  public adminImagePreviewSenderLabel(chat: any): string {
    return this.getAdminLastPreviewSenderLabel(chat);
  }

  public adminImagePreviewCaption(chat: any): string {
    const caption = String(chat?.__ultimoImagenCaption || '').trim();
    if (caption) return caption;

    const raw = String(chat?.ultimoMensajePreview || chat?.ultimoMensaje || '').trim();
    const withoutPrefix = raw.replace(/^[^:]{1,80}:\s*/, '').trim();
    if (!withoutPrefix || withoutPrefix.startsWith('{')) return '';
    if (/^imagen$/i.test(withoutPrefix)) return '';

    const labeled = /^imagen\s*[:,\-]\s*(.+)$/i.exec(withoutPrefix);
    if (labeled?.[1]) return String(labeled[1]).trim();

    return '';
  }

  private getAdminLastPreviewSenderLabel(chat: any): string {
    const full = String(chat?.ultimoMensajeEmisorNombreCompleto || '').trim();
    if (full) return full;

    const nombre = String(chat?.ultimoMensajeEmisorNombre || '').trim();
    const apellido = String(chat?.ultimoMensajeEmisorApellido || '').trim();
    const composed = `${nombre}${apellido ? ' ' + apellido : ''}`.trim();
    if (composed) return composed;

    const preview = String(chat?.ultimoMensajePreview || chat?.ultimoMensaje || '').trim();
    const pref = /^([^:]{1,80}):\s*/.exec(preview);
    if (pref?.[1]) return String(pref[1]).trim();

    return '';
  }

  public isAudioMessage(msg: any): boolean {
    const tipo = String(msg?.tipo ?? '').trim().toUpperCase();
    if (tipo === 'AUDIO') return true;
    return !!String(msg?.audioUrl ?? '').trim();
  }

  public isImageMessage(msg: any): boolean {
    const tipo = String(msg?.tipo ?? '').trim().toUpperCase();
    if (tipo === 'FILE') return false;
    if (tipo === 'IMAGE') return true;
    if (!!String(msg?.fileUrl ?? '').trim()) return false;
    return !!String(msg?.imageUrl ?? '').trim();
  }

  public isFileMessage(msg: any): boolean {
    const tipo = String(msg?.tipo ?? '').trim().toUpperCase();
    if (tipo === 'FILE') return true;
    return !!String(msg?.fileUrl ?? '').trim();
  }

  public getAdminFileSrc(msg: any): string {
    const raw = String(msg?.fileUrl ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    return resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
  }

  public getAdminFileName(msg: any): string {
    const direct = String(msg?.fileNombre ?? '').trim();
    if (direct) return direct;

    const text = String(msg?.text || '').trim();
    const match = /^archivo\s*:\s*([^\-]+?)(?:\s*\-\s*.*)?$/i.exec(text);
    if (match?.[1]) return String(match[1]).trim();

    return 'Archivo';
  }

  private formatAdminFileSize(bytesRaw: unknown): string {
    const bytes = Number(bytesRaw);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
  }

  public getAdminFileSizeLabel(msg: any): string {
    return this.formatAdminFileSize(msg?.fileSizeBytes);
  }

  public getAdminFileCaption(msg: any): string {
    const text = String(msg?.text || '').trim();
    if (!text || this.isLikelySerializedPayloadText(text)) return '';
    if (!/^archivo\s*:/i.test(text)) return text;

    const stripped = text.replace(/^archivo\s*:\s*[^\-]+\s*\-\s*/i, '').trim();
    if (!stripped || stripped === text) return '';
    return stripped;
  }

  public getAdminFileTypeLabel(msg: any): string {
    const mime = String(msg?.fileMime || '').trim().toLowerCase();
    const name = this.getAdminFileName(msg);

    if (mime === 'application/pdf') return 'Documento PDF';
    if (mime.startsWith('text/')) return 'Archivo de texto';
    if (mime.includes('msword') || mime.includes('wordprocessingml')) return 'Documento Word';
    if (mime.includes('spreadsheetml') || mime.includes('excel') || mime.includes('csv')) {
      return 'Hoja de calculo';
    }
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Presentacion';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar')) {
      return 'Archivo comprimido';
    }
    if (mime.startsWith('audio/')) return 'Audio';
    if (mime.startsWith('video/')) return 'Video';
    if (mime.startsWith('image/')) return 'Imagen';

    const ext = String(name.split('.').pop() || '').trim().toLowerCase();
    if (ext === 'pdf') return 'Documento PDF';
    if (ext === 'doc' || ext === 'docx') return 'Documento Word';
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'Hoja de calculo';
    if (ext === 'ppt' || ext === 'pptx') return 'Presentacion';
    if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar') {
      return 'Archivo comprimido';
    }

    return 'Archivo';
  }

  public getAdminFileIconClass(mimeRaw: unknown): string {
    const mime = String(mimeRaw || '').trim().toLowerCase();
    if (!mime) return 'bi-file-earmark';
    if (mime.includes('pdf')) return 'bi-file-earmark-pdf';
    if (mime.includes('msword') || mime.includes('wordprocessingml')) {
      return 'bi-file-earmark-word';
    }
    if (mime.includes('spreadsheetml') || mime.includes('excel') || mime.includes('csv')) {
      return 'bi-file-earmark-excel';
    }
    if (mime.includes('presentation') || mime.includes('powerpoint')) {
      return 'bi-file-earmark-ppt';
    }
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar')) {
      return 'bi-file-earmark-zip';
    }
    if (mime.startsWith('audio/')) return 'bi-file-earmark-music';
    if (mime.startsWith('video/')) return 'bi-file-earmark-play';
    if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) {
      return 'bi-file-earmark-text';
    }
    return 'bi-file-earmark';
  }

  public openAdminFilePreview(msg: any, fileSrcRaw: string, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    const fileSrc = String(fileSrcRaw || '').trim();
    if (!fileSrc) return;

    this.showAdminFilePreview = true;
    this.adminFilePreviewSrc = fileSrc;
    this.adminFilePreviewName = this.getAdminFileName(msg);
    this.adminFilePreviewSize = this.getAdminFileSizeLabel(msg);
    this.adminFilePreviewType = this.getAdminFileTypeLabel(msg);
    this.adminFilePreviewMime = String(msg?.fileMime || '').trim();
  }

  public closeAdminFilePreview(): void {
    this.showAdminFilePreview = false;
    this.adminFilePreviewSrc = '';
    this.adminFilePreviewName = '';
    this.adminFilePreviewSize = '';
    this.adminFilePreviewType = '';
    this.adminFilePreviewMime = '';
  }
  public isPollMessage(msg: any): boolean {
    if (!msg || Number(msg?.activo) === 0) return false;
    return !!this.parseAdminPollPayloadForMessage(msg);
  }

  public getAdminPollQuestion(msg: any): string {
    const payload = this.parseAdminPollPayloadForMessage(msg);
    return String(payload?.question || 'Encuesta').trim() || 'Encuesta';
  }

  public getAdminPollStatusText(msg: any): string {
    const payload = this.parseAdminPollPayloadForMessage(msg);
    if (!payload) return 'Selecciona una opción.';
    const text = String(payload?.statusText || '').trim();
    if (text) return text;
    return payload.allowMultiple
      ? 'Selecciona una o varias opciones.'
      : 'Selecciona una opción.';
  }

  public getAdminPollOptionsForRender(msg: any): AdminPollOptionView[] {
    const payload = this.parseAdminPollPayloadForMessage(msg);
    if (!payload) return [];

    const viewerId = this.getAdminPollViewerUserId();
    const withCounts = (payload.options || []).map((option) => {
      const voterIds = this.collectAdminPollOptionVoterIds(option);
      const votersFromDetails = Array.isArray(option?.voters) ? option.voters.length : 0;
      const count = Math.max(
        Number(option?.voteCount || 0),
        voterIds.length,
        votersFromDetails
      );
      return {
        id: String(option?.id || ''),
        text: String(option?.text || '').trim() || 'Opción',
        count,
        selected: viewerId > 0 ? voterIds.includes(viewerId) : option?.votedByMe === true,
      };
    });

    const totalVotes = withCounts.reduce((acc, option) => acc + option.count, 0);
    const maxCount = withCounts.reduce((max, option) => Math.max(max, option.count), 0);

    return withCounts.map((option) => {
      const rawOption = (payload.options || []).find(
        (x) => String(x?.id || '') === option.id
      );
      return {
        ...option,
        percent:
          totalVotes > 0
            ? Math.max(0, Math.min(100, (option.count / totalVotes) * 100))
            : 0,
        isLeading: option.count > 0 && option.count === maxCount,
        voters: this.resolveAdminPollVoters(rawOption).slice(0, 3),
      };
    });
  }

  public trackAdminPollOption(_index: number, option: AdminPollOptionView): string {
    return option.id;
  }

  public trackAdminPollVoter(_index: number, voter: AdminPollVoterView): string {
    return `${voter.userId}-${voter.photoUrl || ''}-${voter.initials}`;
  }

  public openAdminPollVotes(msg: any, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    const payload = this.parseAdminPollPayloadForMessage(msg);
    if (!payload) return;

    const options = this.getAdminPollOptionsForRender(msg);
    const html = options
      .map((option) => {
        const voters = this.resolveAdminPollVoterNamesForOption(payload, option.id);
        const votersText = voters.length ? voters.join(', ') : 'Sin votos';
        return `
          <div style="text-align:left;margin-bottom:10px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;">
            <div style="font-weight:700;color:#0f172a;">${this.escapeHtml(option.text)} (${option.count})</div>
            <div style="font-size:12px;color:#475569;margin-top:4px;">${this.escapeHtml(votersText)}</div>
          </div>
        `;
      })
      .join('');

    void Swal.fire({
      title: this.getAdminPollQuestion(msg),
      html:
        html ||
        '<div style="font-size:13px;color:#475569;">No hay votos registrados todavía.</div>',
      width: 560,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#0ea5e9',
    });
  }

  private parseAdminPollPayloadForMessage(msg: any): ReturnType<typeof parsePollPayload> {
    if (!msg) return null;
    return (
      parsePollPayload(msg?.pollPayload) ||
      parsePollPayload(msg?.poll) ||
      parsePollPayload(msg?.text) ||
      parsePollPayload(msg?.contenido) ||
      null
    );
  }

  private getAdminPollViewerUserId(): number {
    const inspected = Number(this.inspectedUserId || 0);
    if (Number.isFinite(inspected) && inspected > 0) return inspected;
    const current = Number(this.usuarioActualId || 0);
    return Number.isFinite(current) && current > 0 ? current : 0;
  }

  private collectAdminPollOptionVoterIds(option: any): number[] {
    const idsFromList = Array.isArray(option?.voterIds)
      ? option.voterIds
          .map((v: any) => Number(v))
          .filter((v: number) => Number.isFinite(v) && v > 0)
      : [];
    const idsFromDetails = Array.isArray(option?.voters)
      ? option.voters
          .map((v: any) => Number(v?.userId))
          .filter((v: number) => Number.isFinite(v) && v > 0)
      : [];
    return Array.from(new Set([...idsFromList, ...idsFromDetails]));
  }

  private resolveAdminPollVoters(option: any): AdminPollVoterView[] {
    const ids = this.collectAdminPollOptionVoterIds(option);
    if (!ids.length) return [];

    const detailById = new Map<number, any>();
    for (const detail of option?.voters || []) {
      const id = Number(detail?.userId);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!detailById.has(id)) detailById.set(id, detail);
    }

    return ids.map((userId) => {
      const detail = detailById.get(userId);
      const fullName = this.resolveAdminPollVoterDisplayName(userId, detail);
      const detailPhoto = String(detail?.photoUrl || '').trim();
      const photoUrl = resolveMediaUrl(detailPhoto, environment.backendBaseUrl) || null;
      return {
        userId,
        photoUrl,
        initials: this.buildAdminInitials(fullName),
      };
    });
  }

  private resolveAdminPollVoterNamesForOption(
    payload: NonNullable<ReturnType<typeof parsePollPayload>>,
    optionId: string
  ): string[] {
    const option = (payload.options || []).find(
      (opt) => String(opt?.id || '') === String(optionId)
    );
    if (!option) return [];
    const ids = this.collectAdminPollOptionVoterIds(option);
    if (!ids.length) return [];
    return ids.map((userId) => this.resolveAdminPollVoterDisplayName(userId));
  }

  private resolveAdminPollVoterDisplayName(userIdRaw: unknown, detail?: any): string {
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId) || userId <= 0) return 'Usuario';
    if (userId === Number(this.inspectedUserId)) return this.currentUserName || 'Usuario';
    if (userId === Number(this.usuarioActualId)) {
      return this.adminNombreCompleto || 'Administrador';
    }

    const explicit = String(detail?.fullName || '').trim();
    if (explicit) return explicit;

    const member = this.resolveMemberNameById(this.selectedChat, userId);
    const memberFull = `${member?.nombre || ''} ${member?.apellido || ''}`.trim();
    if (memberFull) return memberFull;

    return `Usuario ${userId}`;
  }

  private buildAdminInitials(nameRaw: unknown): string {
    const text = String(nameRaw || '').trim();
    if (!text) return '??';
    const parts = text.split(/\s+/).filter(Boolean);
    if (!parts.length) return '??';
    const first = parts[0].charAt(0);
    const second = parts.length > 1 ? parts[1].charAt(0) : parts[0].charAt(1);
    return `${first || ''}${second || ''}`.toUpperCase() || '??';
  }

  private escapeHtml(text: unknown): string {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  public getAdminAudioSrc(msg: any): string {
    const raw = String(msg?.audioUrl ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    return resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
  }

  public getAdminImageSrc(msg: any): string {
    const raw = String(msg?.imageUrl ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    return resolveMediaUrl(raw, environment.backendBaseUrl) || raw;
  }

  public getAdminImageAlt(msg: any): string {
    const name = String(msg?.imageNombre || '').trim();
    return name || 'Imagen';
  }

  public getAdminImageCaption(msg: any): string {
    const text = String(msg?.text || '').trim();
    if (!text) return '';
    if (this.isLikelySerializedPayloadText(text)) return '';
    return text;
  }

  private getAdminAudioKey(msg: any): string {
    return String(msg?.id ?? '');
  }

  public getAdminAudioState(msg: any): { playing: boolean; current: number; duration: number } | undefined {
    return this.adminAudioStates.get(this.getAdminAudioKey(msg));
  }

  public onAdminAudioLoadedMetadata(msg: any, audio: HTMLAudioElement): void {
    const key = this.getAdminAudioKey(msg);
    const prev = this.adminAudioStates.get(key);
    const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
    this.adminAudioStates.set(key, {
      playing: prev?.playing ?? false,
      current: prev?.current ?? 0,
      duration: durationMs > 0 ? durationMs : (prev?.duration ?? 0),
    });
  }

  public onAdminAudioTimeUpdate(msg: any, audio: HTMLAudioElement): void {
    const key = this.getAdminAudioKey(msg);
    const prev = this.adminAudioStates.get(key);
    this.adminAudioStates.set(key, {
      playing: !audio.paused,
      current: Math.max(0, audio.currentTime * 1000),
      duration:
        prev?.duration && prev.duration > 0
          ? prev.duration
          : Number.isFinite(audio.duration)
          ? audio.duration * 1000
          : 0,
    });
  }

  public onAdminAudioEnded(msg: any): void {
    const key = this.getAdminAudioKey(msg);
    const prev = this.adminAudioStates.get(key);
    this.adminAudioStates.set(key, {
      playing: false,
      current: 0,
      duration: prev?.duration ?? 0,
    });
    if (this.adminCurrentAudioKey === key) {
      this.adminCurrentAudioKey = null;
      this.adminCurrentAudioEl = null;
    }
  }

  public async toggleAdminPlay(msg: any, audio: HTMLAudioElement): Promise<void> {
    const key = this.getAdminAudioKey(msg);

    if (this.adminCurrentAudioEl && this.adminCurrentAudioEl !== audio) {
      try {
        this.adminCurrentAudioEl.pause();
      } catch {}
      if (this.adminCurrentAudioKey) {
        const prev = this.adminAudioStates.get(this.adminCurrentAudioKey);
        if (prev) {
          this.adminAudioStates.set(this.adminCurrentAudioKey, { ...prev, playing: false });
        }
      }
    }

    if (audio.paused) {
      try {
        await audio.play();
        const prev = this.adminAudioStates.get(key);
        this.adminAudioStates.set(key, {
          playing: true,
          current: prev?.current ?? 0,
          duration: prev?.duration ?? (Number(msg?.audioDuracionMs) || 0),
        });
        this.adminCurrentAudioEl = audio;
        this.adminCurrentAudioKey = key;
      } catch {
        // autoplay/user gesture restrictions
      }
    } else {
      audio.pause();
      const prev = this.adminAudioStates.get(key);
      this.adminAudioStates.set(key, {
        playing: false,
        current: prev?.current ?? 0,
        duration: prev?.duration ?? (Number(msg?.audioDuracionMs) || 0),
      });
    }
  }

  public adminProgressPercent(msg: any): number {
    const state = this.getAdminAudioState(msg);
    const current = Number(state?.current || 0);
    const duration = Number(state?.duration || Number(msg?.audioDuracionMs) || 0);
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (current / duration) * 100));
  }

  public adminFormatDur(ms: number | null | undefined): string {
    const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const min = Math.floor(total / 60).toString().padStart(2, '0');
    const sec = (total % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  private extractAudioDurationMs(payload: any, isSummary: boolean): number {
    const candidates = isSummary
      ? [
          payload?.ultimoMensajeAudioDuracionMs,
          payload?.ultimaMensajeAudioDuracionMs,
          payload?.ultimoMensajeDurMs,
          payload?.ultimoDurMs,
          payload?.audioDuracionMs,
          payload?.durMs,
        ]
      : [
          payload?.audioDuracionMs,
          payload?.durMs,
          payload?.durationMs,
          payload?.audioDurationMs,
        ];
    for (const candidate of candidates) {
      const n = Number(candidate);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
    return 0;
  }

  private buildAudioVoiceLabel(durationMs: number): string {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return 'Mensaje de voz';
    const totalSec = Math.max(0, Math.round(durationMs / 1000));
    const min = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    return `Mensaje de voz (${min}:${sec})`;
  }

  private buildAdminFileLabel(fileNameRaw: unknown, captionRaw?: unknown): string {
    const fileName = String(fileNameRaw || '').trim() || 'Archivo';
    const caption = String(captionRaw || '').trim();
    if (caption) return `Archivo: ${fileName} - ${caption}`;
    return `Archivo: ${fileName}`;
  }
  private resolveMemberNameById(
    chat: any,
    userId: number
  ): { nombre?: string; apellido?: string } | null {
    if (!chat || !Array.isArray(chat?.usuarios)) return null;
    const member = chat.usuarios.find((u: any) => Number(u?.id) === Number(userId));
    if (!member) return null;
    return {
      nombre: member?.nombre,
      apellido: member?.apellido,
    };
  }

  private getMensajesObservable(chat: any, chatId: number): Observable<any[]> {
    void chat;
    return this.chatService.listarMensajesAdminPorChat(chatId, true);
  }

  private isEncryptedE2EPayload(value: string): boolean {
    const payload = this.parseAdminPayload(this.extractAdminPayloadCandidate(value));
    const type = String(payload?.type || '').toUpperCase();
    return (type === 'E2E' || type === 'E2E_GROUP') && !!payload?.ciphertext;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  public toggleDashboardMenu(): void {
    this.isDashboardMenuOpen = !this.isDashboardMenuOpen;
  }

  public toggleIncidentsMenu(): void {
    this.isIncidentsMenuOpen = !this.isIncidentsMenuOpen;
  }

  public toggleMessagesMenu(): void {
    this.isMessagesMenuOpen = !this.isMessagesMenuOpen;
  }

  showDashboard() {
    this.isDashboardView = true;
    this.isReportsView = false;
    this.isComplaintsView = false;
    this.isGroupsView = false;
    this.isMessagesView = false;
    this.isScheduledMessagesView = false;
    this.isGroupsTableMode = false;
    this.isSidebarOpen = false;
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.selectedChatMessagesSource = 'admin';
    this.headerSubtitle = "Gestion centralizada de TejeChat.";
  }

  public showUsersView(): void {
    this.showDashboard();
  }

  public showGroupsView(): void {
    this.isDashboardView = true;
    this.isReportsView = false;
    this.isComplaintsView = false;
    this.isGroupsView = true;
    this.isMessagesView = false;
    this.isScheduledMessagesView = false;
    this.isGroupsTableMode = false;
    this.isSidebarOpen = false;
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.selectedChatMessagesSource = 'admin';
    this.headerSubtitle = 'Dashboard con listado administrativo de grupos.';
    this.loadAdminGroups(0);
  }

  public showMessagesView(): void {
    this.isDashboardView = false;
    this.isReportsView = false;
    this.isComplaintsView = false;
    this.isGroupsView = false;
    this.isMessagesView = true;
    this.isScheduledMessagesView = false;
    this.isGroupsTableMode = false;
    this.isMessagesMenuOpen = true;
    this.isSidebarOpen = false;
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.selectedChatMessagesSource = 'admin';
    this.headerSubtitle = 'Mensajeria administrativa en modo maqueta.';
    if (!this.adminMessageUsers.length && !this.adminMessageUsersLoading) {
      this.resetAdminMessageUsersFeed();
      this.loadAdminMessageUsersPage(0);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public showScheduledMessagesView(): void {
    this.isDashboardView = false;
    this.isReportsView = false;
    this.isComplaintsView = false;
    this.isGroupsView = false;
    this.isMessagesView = false;
    this.isScheduledMessagesView = true;
    this.isGroupsTableMode = false;
    this.isMessagesMenuOpen = true;
    this.isSidebarOpen = false;
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.selectedChatMessagesSource = 'admin';
    this.headerSubtitle = 'Mensajeria administrativa programada.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public get adminMessageUsersCount(): number {
    const fallback = Array.isArray(this.adminMessageUsers) ? this.adminMessageUsers.length : 0;
    return Math.max(0, Number(this.adminMessageUsersTotalElements ?? fallback) || fallback);
  }

  public get adminMessageUsersHasMore(): boolean {
    return !this.adminMessageUsersIsLastPage;
  }

  public onAdminMessageUsersLoadMore(): void {
    if (this.adminMessageUsersLoading || this.adminMessageUsersIsLastPage) return;
    this.loadAdminMessageUsersPage(this.adminMessageUsersPage + 1, true);
  }

  public async onAdminMessageSend(
    event: AdminMessageComposerSubmitEvent
  ): Promise<void> {
    if (event?.deliveryType === 'email') {
      await this.onAdminEmailSend(event);
      return;
    }

    const message = String(event?.message || '').trim();
    if (!message || this.isSendingAdminMessage) return;

    this.isSendingAdminMessage = true;
    try {
      const recipients = await this.resolveAdminMessageRecipients(event);
      if (recipients.length === 0) {
        await Swal.fire('Sin destinatarios', 'No hay usuarios validos para enviar el mensaje.', 'warning');
        return;
      }
      const confirmed = await this.confirmAdminBulkDeliveryAction({
        action: 'send',
        deliveryType: 'message',
        recipientCount: recipients.length,
        attachmentCount: 0,
        event,
      });
      if (!confirmed) return;

      const keysReady = await this.ensureAdminMessagingKeysReady();
      if (!keysReady) {
        await Swal.fire(
          'Claves E2E no disponibles',
          'No se pudo preparar la clave publica del administrador para mensajeria cifrada.',
          'error'
        );
        return;
      }

      const encryptedPayloads: AdminDirectMessageEncryptedItemDTO[] = [];
      const failedNames: string[] = [];

      for (const recipient of recipients) {
        try {
          encryptedPayloads.push({
            userId: Number(recipient.id),
            contenido: await this.buildAdminOutgoingE2EContent(
              Number(recipient.id),
              message
            ),
          });
        } catch (err) {
          console.error('Error cifrando comunicado admin para usuario', {
            recipientId: recipient?.id,
            err,
          });
          failedNames.push(this.getAdminRecipientDisplayName(recipient));
        }
      }

      if (encryptedPayloads.length === 0) {
        await Swal.fire(
          'Envio fallido',
          'No se pudo preparar ningun payload cifrado.',
          'error'
        );
        return;
      }

      const response: AdminDirectMessageResponseDTO = await firstValueFrom(
        this.chatService.enviarMensajesDirectosAdmin({
          userIds: encryptedPayloads.map((item) => Number(item.userId)),
          encryptedPayloads,
        })
      );

      const responseItems = Array.isArray(response?.items) ? response.items : [];
      const responseSuccessCount = responseItems.filter((item) => {
        if (item?.ok === true) return true;
        const status = String(item?.status || '').trim().toUpperCase();
        return status === 'SENT' || status === 'SUCCESS' || status === 'OK';
      }).length;
      const responseFailureItems = responseItems.filter((item) => {
        if (item?.ok === false) return true;
        const status = String(item?.status || '').trim().toUpperCase();
        return status === 'FAILED' || status === 'ERROR';
      });

      const explicitSentCount = Number(response?.sentCount || 0);
      const explicitFailedCount = Number(response?.failedCount || 0);
      const fallbackSentCount =
        responseItems.length > 0
          ? Math.max(0, responseItems.length - responseFailureItems.length)
          : encryptedPayloads.length;
      const sentCount = Math.max(
        explicitSentCount,
        responseSuccessCount,
        response?.ok === false ? 0 : fallbackSentCount
      );
      const totalFailedCount = Math.max(
        failedNames.length + responseFailureItems.length,
        explicitFailedCount
      );

      const responseFailures = responseFailureItems
        .map((item) => {
          const recipient = recipients.find((user) => Number(user?.id) === Number(item?.userId));
          return recipient ? this.getAdminRecipientDisplayName(recipient) : `#${item?.userId || '?'}`;
        });
      failedNames.push(...responseFailures);

      if (sentCount > 0 && totalFailedCount === 0) {
        this.bumpAdminMessageComposerResetSignal();
        await Swal.fire(
          'Comunicado enviado',
          `Se enviaron ${sentCount} mensajes cifrados por WS.`,
          'success'
        );
        return;
      }

      if (sentCount > 0) {
        this.bumpAdminMessageComposerResetSignal();
        await Swal.fire(
          'Envio parcial',
          `Se enviaron ${sentCount} mensajes. Fallaron ${totalFailedCount}.`,
          'warning'
        );
        return;
      }

      await Swal.fire(
        'Envio fallido',
        'No se pudo enviar el comunicado a ningun destinatario.',
        'error'
      );
    } finally {
      this.isSendingAdminMessage = false;
    }
  }

  public async onAdminMessageSchedule(
    event: AdminMessageComposerSubmitEvent
  ): Promise<void> {
    const scheduledAt = String(event?.scheduledAt || '').trim();
    if (!scheduledAt || this.isSendingAdminMessage) return;

    if (event?.deliveryType === 'email') {
      await this.onAdminEmailSchedule(event);
      return;
    }

    const message = String(event?.message || '').trim();
    if (!message) return;

    this.isSendingAdminMessage = true;
    try {
      const recipients = await this.resolveAdminMessageRecipients(event);
      if (recipients.length === 0) {
        await Swal.fire('Sin destinatarios', 'No hay usuarios validos para programar el mensaje.', 'warning');
        return;
      }
      const confirmed = await this.confirmAdminBulkDeliveryAction({
        action: 'schedule',
        deliveryType: 'message',
        recipientCount: recipients.length,
        attachmentCount: 0,
        event,
      });
      if (!confirmed) return;

      const keysReady = await this.ensureAdminMessagingKeysReady();
      if (!keysReady) {
        await Swal.fire(
          'Claves E2E no disponibles',
          'No se pudo preparar la clave publica del administrador para mensajeria cifrada.',
          'error'
        );
        return;
      }

      const encryptedPayloads: AdminDirectMessageEncryptedItemDTO[] = [];
      const failedNames: string[] = [];

      for (const recipient of recipients) {
        try {
          encryptedPayloads.push({
            userId: Number(recipient.id),
            contenido: await this.buildAdminOutgoingE2EContent(
              Number(recipient.id),
              message
            ),
          });
        } catch (err) {
          console.error('Error cifrando comunicado admin programado para usuario', {
            recipientId: recipient?.id,
            err,
          });
          failedNames.push(this.getAdminRecipientDisplayName(recipient));
        }
      }

      if (encryptedPayloads.length === 0) {
        await Swal.fire(
          'Programacion fallida',
          'No se pudo preparar ningun payload cifrado.',
          'error'
        );
        return;
      }

      const request: AdminScheduleDirectMessageRequestDTO = {
        audienceMode: String(event?.mode || 'selected'),
        userIds: encryptedPayloads
          .map((item) => Number(item.userId))
          .filter((id) => Number.isFinite(id) && id > 0),
        encryptedPayloads,
        scheduledAt,
        scheduledAtLocal: String(event?.scheduledAtLocal || '').trim() || undefined,
      };

      const response: ProgramarMensajeResponseDTO = await firstValueFrom(
        this.chatService.programarMensajesDirectosAdmin(request)
      );

      this.bumpAdminMessageComposerResetSignal();
      await Swal.fire(
        'Mensaje programado',
        failedNames.length > 0
          ? `Se programaron ${encryptedPayloads.length} mensajes. ${failedNames.length} destinatarios quedaron fuera por error de cifrado.`
          : String(response?.message || response?.mensaje || 'El envio ha quedado programado.'),
        failedNames.length > 0 ? 'warning' : 'success'
      );
    } finally {
      this.isSendingAdminMessage = false;
    }
  }

  private async onAdminEmailSend(
    event: AdminMessageComposerSubmitEvent
  ): Promise<void> {
    const subject = String(event?.subject || '').trim();
    const body = String(event?.message || '').trim();
    const attachments = Array.isArray(event?.attachments) ? event.attachments : [];
    if (!subject || !body || this.isSendingAdminMessage) return;

    this.isSendingAdminMessage = true;
    try {
      const recipients = await this.resolveAdminMessageRecipients(event);
      const normalizedRecipients = recipients
        .map((user) => ({
          userId: Number(user?.id || 0),
          email: String(user?.email || '').trim().toLowerCase(),
          raw: user,
        }))
        .filter((item) => item.userId > 0 && !!item.email);

      if (normalizedRecipients.length === 0) {
        await Swal.fire(
          'Sin destinatarios',
          'No hay usuarios validos con email para enviar el correo.',
          'warning'
        );
        return;
      }

      const deduped = normalizedRecipients.filter(
        (item, index, arr) =>
          arr.findIndex((candidate) => candidate.email === item.email) === index
      );

      const emailConfirmed = await this.confirmAdminBulkDeliveryAction({
        action: 'send',
        deliveryType: 'email',
        recipientCount: deduped.length,
        attachmentCount: attachments.length,
        event,
      });
      if (!emailConfirmed) {
        return;
      }

      const payload: AdminBulkEmailRequestDTO = {
        audienceMode: String(event?.mode || 'selected'),
        userIds: deduped.map((item) => item.userId),
        recipientEmails: deduped.map((item) => item.email),
        subject,
        body,
        attachmentCount: attachments.length,
        attachmentsMeta: attachments.map((file) => ({
          fileName: String(file?.name || 'archivo'),
          mimeType: String(file?.type || 'application/octet-stream'),
          sizeBytes: Math.max(0, Number(file?.size || 0)),
        })),
      };

      const response: AdminBulkEmailResponseDTO = await firstValueFrom(
        this.chatService.enviarCorreoMasivoAdmin(payload, attachments)
      );

      const responseItems = Array.isArray(response?.items) ? response.items : [];
      const responseSuccessCount = responseItems.filter((item) => {
        if (item?.ok === true) return true;
        const status = String(item?.status || '').trim().toUpperCase();
        return status === 'SENT' || status === 'SUCCESS' || status === 'OK';
      }).length;
      const responseFailureItems = responseItems.filter((item) => {
        if (item?.ok === false) return true;
        const status = String(item?.status || '').trim().toUpperCase();
        return status === 'FAILED' || status === 'ERROR';
      });

      const explicitSentCount = Number(response?.sentCount || 0);
      const explicitFailedCount = Number(response?.failedCount || 0);
      const fallbackSentCount =
        responseItems.length > 0
          ? Math.max(0, responseItems.length - responseFailureItems.length)
          : deduped.length;
      const sentCount = Math.max(
        explicitSentCount,
        responseSuccessCount,
        response?.ok === false ? 0 : fallbackSentCount
      );
      const failedCount = Math.max(
        explicitFailedCount,
        responseFailureItems.length
      );

      if (sentCount > 0 && failedCount === 0) {
        this.bumpAdminMessageComposerResetSignal();
        await Swal.fire(
          'Correo enviado',
          `Se enviaron ${sentCount} correos${attachments.length ? ` con ${attachments.length} adjunto(s)` : ''}.`,
          'success'
        );
        return;
      }

      if (sentCount > 0) {
        this.bumpAdminMessageComposerResetSignal();
        await Swal.fire(
          'Envio parcial',
          `Se enviaron ${sentCount} correos. Fallaron ${failedCount}.`,
          'warning'
        );
        return;
      }

      await Swal.fire(
        'Envio fallido',
        'No se pudo enviar el correo a ningun destinatario.',
        'error'
      );
    } finally {
      this.isSendingAdminMessage = false;
    }
  }

  private async confirmAdminBulkEmailSend(
    recipientCount: number,
    attachmentCount: number,
    event: AdminMessageComposerSubmitEvent
  ): Promise<boolean> {
    const count = Math.max(0, Number(recipientCount || 0));
    if (count <= 0) return false;

    const audienceLabel =
      event?.mode === 'all'
        ? 'a todos los usuarios válidos'
        : 'a los usuarios seleccionados';
    const attachmentLabel =
      attachmentCount > 0
        ? `<p class="swal-unban-helper">Tambien se enviaran <strong>${attachmentCount}</strong> adjunto(s).</p>`
        : '';

    const result = await Swal.fire({
      html: `
        <div class="swal-unban-header">
          <div class="swal-unban-header-icon"><i class="bi bi-envelope-fill"></i></div>
          <div class="swal-unban-header-text">
            <h2>Confirmar envio de correo</h2>
            <p>Vas a enviar un correo a <strong>${count}</strong> usuario(s).</p>
          </div>
        </div>
        <div class="swal-unban-body">
          <label class="swal-unban-label">Destino</label>
          <p class="swal-unban-helper">El sistema enviara este correo ${audienceLabel}.</p>
          ${attachmentLabel}
          <p class="swal-unban-helper">¿Estas seguro de que quieres continuar?</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Si, enviar correo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      allowOutsideClick: false,
      customClass: {
        popup: 'swal-unban-popup',
        htmlContainer: 'swal-unban-html',
        confirmButton: 'swal-unban-confirm',
        cancelButton: 'swal-unban-cancel',
        actions: 'swal-unban-actions',
      },
    });

    return !!result.isConfirmed;
  }

  private async confirmAdminBulkDeliveryAction(params: {
    action: 'send' | 'schedule';
    deliveryType: 'message' | 'email';
    recipientCount: number;
    attachmentCount: number;
    event: AdminMessageComposerSubmitEvent;
  }): Promise<boolean> {
    const { action, deliveryType, recipientCount, attachmentCount, event } = params;
    const count = Math.max(0, Number(recipientCount || 0));
    if (count <= 0) return false;

    const noun = deliveryType === 'email' ? 'correo' : 'mensaje';
    const verb = action === 'schedule' ? 'programar' : 'enviar';
    const title = `Confirmar ${action === 'schedule' ? 'programacion' : 'envio'} de ${noun}`;
    const audienceLabel =
      event?.mode === 'all'
        ? 'a todos los usuarios validos'
        : 'a los usuarios seleccionados';
    const attachmentLabel =
      deliveryType === 'email' && attachmentCount > 0
        ? `<p class="swal-unban-helper">Tambien se incluiran <strong>${attachmentCount}</strong> adjunto(s).</p>`
        : '';
    const scheduleLabel =
      action === 'schedule'
        ? `<p class="swal-unban-helper">La accion quedara programada para envio posterior.</p>`
        : '';

    const result = await Swal.fire({
      html: `
        <div class="swal-unban-header">
          <div class="swal-unban-header-icon"><i class="bi ${deliveryType === 'email' ? 'bi-envelope-fill' : 'bi-chat-dots-fill'}"></i></div>
          <div class="swal-unban-header-text">
            <h2>${title}</h2>
            <p>Vas a ${verb} un ${noun} a <strong>${count}</strong> usuario(s).</p>
          </div>
        </div>
        <div class="swal-unban-body">
          <label class="swal-unban-label">Destino</label>
          <p class="swal-unban-helper">El sistema va a ${verb} este ${noun} ${audienceLabel}.</p>
          ${attachmentLabel}
          ${scheduleLabel}
          <p class="swal-unban-helper">Estas seguro de que quieres continuar?</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: `Si, ${verb} ${noun}`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      allowOutsideClick: false,
      customClass: {
        popup: 'swal-unban-popup',
        htmlContainer: 'swal-unban-html',
        confirmButton: 'swal-unban-confirm',
        cancelButton: 'swal-unban-cancel',
        actions: 'swal-unban-actions',
      },
    });

    return !!result.isConfirmed;
  }

  private async onAdminEmailSchedule(
    event: AdminMessageComposerSubmitEvent
  ): Promise<void> {
    const subject = String(event?.subject || '').trim();
    const body = String(event?.message || '').trim();
    const scheduledAt = String(event?.scheduledAt || '').trim();
    const attachments = Array.isArray(event?.attachments) ? event.attachments : [];
    if (!subject || !body || !scheduledAt || this.isSendingAdminMessage) return;

    this.isSendingAdminMessage = true;
    try {
      const recipients = await this.resolveAdminMessageRecipients(event);
      const normalizedRecipients = recipients
        .map((user) => ({
          userId: Number(user?.id || 0),
          email: String(user?.email || '').trim().toLowerCase(),
        }))
        .filter((item) => item.userId > 0 && !!item.email);

      if (normalizedRecipients.length === 0) {
        await Swal.fire(
          'Sin destinatarios',
          'No hay usuarios validos con email para programar el correo.',
          'warning'
        );
        return;
      }

      const deduped = normalizedRecipients.filter(
        (item, index, arr) =>
          arr.findIndex((candidate) => candidate.email === item.email) === index
      );
      const confirmed = await this.confirmAdminBulkDeliveryAction({
        action: 'schedule',
        deliveryType: 'email',
        recipientCount: deduped.length,
        attachmentCount: attachments.length,
        event,
      });
      if (!confirmed) return;

      const payload: AdminScheduleBulkEmailRequestDTO = {
        audienceMode: String(event?.mode || 'selected'),
        userIds: deduped.map((item) => item.userId),
        recipientEmails: deduped.map((item) => item.email),
        subject,
        body,
        attachmentCount: attachments.length,
        attachmentsMeta: attachments.map((file) => ({
          fileName: String(file?.name || 'archivo'),
          mimeType: String(file?.type || 'application/octet-stream'),
          sizeBytes: Math.max(0, Number(file?.size || 0)),
        })),
        scheduledAt,
        scheduledAtLocal: String(event?.scheduledAtLocal || '').trim() || undefined,
      };

      const response: ProgramarMensajeResponseDTO = await firstValueFrom(
        this.chatService.programarCorreoMasivoAdmin(payload, attachments)
      );

      this.bumpAdminMessageComposerResetSignal();
      await Swal.fire(
        'Email programado',
        String(response?.message || response?.mensaje || 'El correo ha quedado programado.'),
        'success'
      );
    } finally {
      this.isSendingAdminMessage = false;
    }
  }

  private async resolveAdminMessageRecipients(
    event: AdminMessageComposerSubmitEvent
  ): Promise<UsuarioDTO[]> {
    const myId = Number(this.usuarioActualId || 0);
    const filterSelf = (users: UsuarioDTO[]) =>
      (users || []).filter((user) => Number(user?.id) > 0 && Number(user?.id) !== myId);

    if (event.mode === 'selected') {
      const selectedIds = new Set(
        (event.selectedUserIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      );
      return filterSelf(
        (this.adminMessageUsers || []).filter((user) => selectedIds.has(Number(user?.id)))
      );
    }

    const requestedSize = Math.max(
      Number(this.adminMessageUsersTotalElements || 0),
      Number(this.adminMessageUsersPageSize || 0),
      Array.isArray(this.adminMessageUsers) ? this.adminMessageUsers.length : 0,
      1
    );

    try {
      const page = await firstValueFrom(
        this.authService.getUsuariosRecientes(0, requestedSize)
      );
      const content = this.normalizeUsuariosFotos(page?.content || []);
      return filterSelf(content);
    } catch (err) {
      console.warn('Fallo cargando destinatarios admin para modo all; usando cache local.', err);
      return filterSelf(this.adminMessageUsers || []);
    }
  }

  private bumpAdminMessageComposerResetSignal(): void {
    this.adminMessageComposerResetSignal += 1;
  }

  private async ensureAdminMessagingKeysReady(): Promise<boolean> {
    try {
      const adminId = Number(this.usuarioActualId || 0);
      if (!Number.isFinite(adminId) || adminId <= 0) return false;

      let publicKeyBase64 = String(
        localStorage.getItem(`publicKey_${adminId}`) || ''
      ).trim();
      let privateKeyBase64 = String(
        localStorage.getItem(`privateKey_${adminId}`) || ''
      ).trim();

      if (!publicKeyBase64 || !privateKeyBase64) {
        const keys = await this.cryptoService.generateKeyPair();
        publicKeyBase64 = await this.cryptoService.exportPublicKey(keys.publicKey);
        privateKeyBase64 = await this.cryptoService.exportPrivateKey(keys.privateKey);
        localStorage.setItem(`publicKey_${adminId}`, publicKeyBase64);
        localStorage.setItem(`privateKey_${adminId}`, privateKeyBase64);
      }

      if (!publicKeyBase64) return false;
      await firstValueFrom(this.authService.updatePublicKey(adminId, publicKeyBase64));
      await this.ensureAdminAuditPublicKeyForE2E();
      return !!this.getStoredAdminAuditPublicKey();
    } catch (err) {
      console.error('Error preparando claves E2E admin', err);
      return false;
    }
  }

  private async buildAdminOutgoingE2EContent(
    recipientId: number,
    plainText: string
  ): Promise<string> {
    const recipient = await firstValueFrom(this.authService.getById(recipientId));
    const recipientPubKeyBase64 = String(recipient?.publicKey || '').trim();
    if (!recipientPubKeyBase64) {
      throw new Error(`RECIPIENT_PUBLIC_KEY_MISSING_${recipientId}`);
    }

    const adminPubKeyBase64 = String(
      localStorage.getItem(`publicKey_${this.usuarioActualId}`) || ''
    ).trim();
    if (!adminPubKeyBase64) {
      throw new Error('ADMIN_PUBLIC_KEY_MISSING');
    }

    await this.ensureAdminAuditPublicKeyForE2E();
    const auditPubKeyBase64 = this.getStoredAdminAuditPublicKey();
    if (!auditPubKeyBase64) {
      throw new Error('AUDIT_PUBLIC_KEY_MISSING');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const { iv, ciphertext } = await this.cryptoService.encryptAES(
      plainText,
      aesKey
    );
    const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);

    const recipientRsaKey = await this.cryptoService.importPublicKey(
      recipientPubKeyBase64
    );
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPubKeyBase64);
    const auditRsaKey = await this.cryptoService.importPublicKey(auditPubKeyBase64);

    return JSON.stringify({
      type: 'E2E',
      iv,
      ciphertext,
      forEmisor: await this.cryptoService.encryptRSA(aesKeyRawBase64, adminRsaKey),
      forReceptor: await this.cryptoService.encryptRSA(aesKeyRawBase64, recipientRsaKey),
      forAdmin: await this.cryptoService.encryptRSA(aesKeyRawBase64, auditRsaKey),
    });
  }

  private extractAuditPublicKeyFromSource(source: any): string | null {
    const candidates = [
      source,
      source?.publicKey,
      source?.auditPublicKey,
      source?.forAdminPublicKey,
      source?.public_key,
      source?.audit_public_key,
      source?.key,
      source?.value,
    ];
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) return normalized;
    }
    return null;
  }

  private persistAdminAuditPublicKeyLocal(key: string): void {
    const normalized = String(key || '').trim();
    if (!normalized) return;
    localStorage.setItem('auditPublicKey', normalized);
    localStorage.setItem('publicKey_admin_audit', normalized);
    localStorage.setItem('forAdminPublicKey', normalized);
  }

  private getStoredAdminAuditPublicKey(): string | null {
    const local =
      localStorage.getItem('auditPublicKey') ||
      localStorage.getItem('publicKey_admin_audit') ||
      localStorage.getItem('forAdminPublicKey') ||
      '';
    const normalized = String(local).trim();
    return normalized || null;
  }

  private async ensureAdminAuditPublicKeyForE2E(): Promise<void> {
    if (this.getStoredAdminAuditPublicKey()) return;
    if (this.adminAuditPublicKeyInitPromise) {
      await this.adminAuditPublicKeyInitPromise;
      return;
    }

    const initPromise = new Promise<void>((resolve) => {
      this.authService.getAuditPublicKey().subscribe({
        next: (resp: any) => {
          const key =
            this.extractAuditPublicKeyFromSource(resp) ||
            this.extractAuditPublicKeyFromSource(resp?.data) ||
            this.extractAuditPublicKeyFromSource(resp?.result);
          if (key) this.persistAdminAuditPublicKeyLocal(key);
          resolve();
        },
        error: (err) => {
          console.warn('No se pudo cargar audit public key para admin messaging', err);
          resolve();
        },
      });
    });

    this.adminAuditPublicKeyInitPromise = initPromise;
    try {
      await initPromise;
    } finally {
      if (this.adminAuditPublicKeyInitPromise === initPromise) {
        this.adminAuditPublicKeyInitPromise = null;
      }
    }
  }

  private getAdminRecipientDisplayName(user: UsuarioDTO): string {
    return `${user?.nombre || ''} ${user?.apellido || ''}`.trim() || user?.email || 'Usuario';
  }

  public loadAdminGroups(page: number = 0): void {
    this.loadingGroups = true;
    const targetPage = Number.isFinite(Number(page)) ? Math.max(0, Number(page)) : 0;
    this.chatService.listarGruposAdmin(targetPage, this.groupsPageSize).subscribe({
      next: (resp) => {
        const content = Array.isArray(resp?.content) ? resp.content : [];
        const normalizedContent = content.map((group: any) =>
          this.normalizeAdminGroupClosureState(group)
        );
        this.adminGroups = normalizedContent;
        this.groupsPage = Number(resp?.number ?? targetPage);
        this.groupsPageSize = Number(resp?.size ?? this.groupsPageSize);
        this.groupsTotalPages = Math.max(1, Number(resp?.totalPages ?? 1));
        this.groupsTotalElements = Math.max(
          0,
          Number(resp?.totalElements ?? normalizedContent.length)
        );
        this.groupsIsLastPage = Boolean(resp?.last ?? (this.groupsPage >= this.groupsTotalPages - 1));
        this.loadingGroups = false;
      },
      error: (err) => {
        console.error('Error cargando grupos admin', err);
        this.loadingGroups = false;
        this.adminGroups = [];
        this.groupsTotalElements = 0;
        this.groupsTotalPages = 1;
        this.groupsIsLastPage = true;
      },
    });
  }

  private normalizeAdminGroupClosureState(group: any): AdminGroupView {
    const next: any = { ...(group || {}) };
    const closed = this.resolveBooleanLike([
      next?.chatCerrado,
      next?.closed,
      next?.cerrado,
      next?.chat_cerrado,
      next?.chatClosed,
      next?.isChatClosed,
      next?.estadoCierre,
    ]);
    const reason = this.resolveStringLike([
      next?.chatCerradoMotivo,
      next?.reason,
      next?.motivo,
      next?.chat_cerrado_motivo,
      next?.chatClosedReason,
      next?.closureReason,
      next?.cierreMotivo,
    ]);
    if (closed !== null) {
      next.chatCerrado = closed;
      next.closed = closed;
    }
    if (reason) {
      next.chatCerradoMotivo = reason;
      next.reason = reason;
    }
    const photoRaw = this.resolveStringLike([
      next?.imagen,
      next?.fotoGrupo,
      next?.foto,
      next?.avatarGrupo,
      next?.avatar,
      next?.image,
      next?.iconoGrupo,
    ]);
    const photoResolved = resolveMediaUrl(photoRaw, environment.backendBaseUrl) || photoRaw || '';
    next.imagen = photoResolved || null;
    next.fotoGrupo = photoResolved || null;
    next.foto = photoResolved || null;
    return next as AdminGroupView;
  }

  public get filteredAdminGroups(): AdminGroupView[] {
    const search = String(this.groupSearchTerm || '').trim().toLowerCase();
    return this.adminGroups.filter((group) => {
      const name = this.getGroupDisplayName(group).toLowerCase();
      const matchesSearch = !search || name.includes(search);
      const matchesStatus =
        this.groupStatusFilter === 'TODOS' ||
        (this.groupStatusFilter === 'ACTIVO' && !!group?.activo) ||
        (this.groupStatusFilter === 'INACTIVO' && !group?.activo);
      const visibility = String(group?.visibilidad || '').trim().toUpperCase();
      const matchesVisibility =
        this.groupVisibilityFilter === 'TODOS' ||
        visibility === this.groupVisibilityFilter;
      return matchesSearch && matchesStatus && matchesVisibility;
    });
  }

  public get hasActiveGroupFilters(): boolean {
    return !!String(this.groupSearchTerm || '').trim()
      || this.groupStatusFilter !== 'TODOS'
      || this.groupVisibilityFilter !== 'TODOS';
  }

  public get groupStatusFilterLabel(): string {
    return this.groupStatusFilterOptions.find(
      (option) => option.value === this.groupStatusFilter
    )?.label || 'Estado';
  }

  public get groupVisibilityFilterLabel(): string {
    return this.groupVisibilityFilterOptions.find(
      (option) => option.value === this.groupVisibilityFilter
    )?.label || 'Visibilidad';
  }

  public toggleGroupStatusMenu(event?: Event): void {
    event?.stopPropagation();
    this.isGroupStatusMenuOpen = !this.isGroupStatusMenuOpen;
    if (this.isGroupStatusMenuOpen) this.isGroupVisibilityMenuOpen = false;
  }

  public toggleGroupVisibilityMenu(event?: Event): void {
    event?.stopPropagation();
    this.isGroupVisibilityMenuOpen = !this.isGroupVisibilityMenuOpen;
    if (this.isGroupVisibilityMenuOpen) this.isGroupStatusMenuOpen = false;
  }

  public selectGroupStatusFilter(value: string): void {
    this.groupStatusFilter = value as AdminGroupStatusFilter;
    this.isGroupStatusMenuOpen = false;
  }

  public selectGroupVisibilityFilter(value: string): void {
    this.groupVisibilityFilter = value as AdminGroupVisibilityFilter;
    this.isGroupVisibilityMenuOpen = false;
  }

  public resetGroupFilters(): void {
    this.groupSearchTerm = '';
    this.groupStatusFilter = 'TODOS';
    this.groupVisibilityFilter = 'TODOS';
    this.isGroupStatusMenuOpen = false;
    this.isGroupVisibilityMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.admin-groups-toolbar')) return;
    this.isGroupStatusMenuOpen = false;
    this.isGroupVisibilityMenuOpen = false;
  }

  public getGroupDisplayName(group: AdminGroupListDTO | null | undefined): string {
    return String(group?.nombreGrupo || (group as any)?.nombre || '').trim()
      || `Grupo #${group?.id ?? '-'}`;
  }

  public getGroupPhotoUrl(group: AdminGroupView | null | undefined): string {
    const groupId = Number(group?.id || 0);
    if (Number.isFinite(groupId) && groupId > 0 && this.brokenGroupPhotoIds.has(groupId)) {
      return '';
    }
    return String(group?.imagen || group?.fotoGrupo || group?.foto || '').trim();
  }

  public onGroupPhotoError(group: AdminGroupView | null | undefined): void {
    const groupId = Number(group?.id || 0);
    if (!Number.isFinite(groupId) || groupId <= 0) return;
    this.brokenGroupPhotoIds.add(groupId);
  }

  public getGroupInitials(group: AdminGroupListDTO | null | undefined): string {
    const words = this.getGroupDisplayName(group)
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2);
    const initials = words.map((part) => part.charAt(0)).join('');
    return (initials || 'GR').toUpperCase();
  }

  public groupVisibilityLabel(group: AdminGroupListDTO | null | undefined): string {
    const visibility = String(group?.visibilidad || '').trim().toUpperCase();
    if (visibility === 'PUBLICO') return 'Publico';
    if (visibility === 'PRIVADO') return 'Privado';
    return 'Sin visibilidad';
  }

  public isGroupPublic(group: AdminGroupListDTO | null | undefined): boolean {
    return String(group?.visibilidad || '').trim().toUpperCase() === 'PUBLICO';
  }

  private resolveBooleanLike(candidates: any[]): boolean | null {
    for (const candidate of candidates || []) {
      if (typeof candidate === 'boolean') return candidate;
      if (typeof candidate === 'number') return candidate !== 0;
      const text = String(candidate || '').trim().toLowerCase();
      if (!text) continue;
      if (['true', '1', 'si', 'yes', 'cerrado', 'closed'].includes(text)) return true;
      if (['false', '0', 'no', 'abierto', 'open'].includes(text)) return false;
    }
    return null;
  }

  private resolveStringLike(candidates: any[]): string {
    for (const candidate of candidates || []) {
      const text = String(candidate || '').trim();
      if (text) return text;
    }
    return '';
  }

  public nextGroupsPage(): void {
    if (this.loadingGroups || this.groupsIsLastPage) return;
    this.loadAdminGroups(this.groupsPage + 1);
  }

  public prevGroupsPage(): void {
    if (this.loadingGroups || this.groupsPage <= 0) return;
    this.loadAdminGroups(this.groupsPage - 1);
  }

  public onGroupSettings(group: AdminGroupListDTO): void {
    const groupLabel = group?.nombreGrupo?.trim() || `Grupo #${group?.id ?? '-'}`;
    void Swal.fire({
      title: 'Configuracion de grupo',
      text: `Abriremos la configuracion de ${groupLabel} cuando conectemos esta accion con backend.`,
      icon: 'info',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#2563eb',
    });
  }

  public isGroupClosed(group: AdminGroupListDTO | null | undefined): boolean {
    if (!group) return false;
    const resolved = this.resolveBooleanLike([
      (group as any)?.chatCerrado,
      (group as any)?.closed,
      (group as any)?.cerrado,
      (group as any)?.chat_cerrado,
      (group as any)?.chatClosed,
      (group as any)?.isChatClosed,
      (group as any)?.estadoCierre,
    ]);
    return resolved === true;
  }

  public async onGroupMute(group: AdminGroupListDTO): Promise<void> {
    const groupLabel = group?.nombreGrupo?.trim() || `Grupo #${group?.id ?? '-'}`;
    const chatId = Number(group?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    const { value: motivo } = await Swal.fire({
      title: '',
      html: `
        <header class="swal-close-head">
          <h1>Cerrar chat grupal</h1>
          <p>Estas a punto de restringir el acceso al chat.</p>
        </header>

        <div class="swal-close-alert">
          <div class="swal-close-alert-icon" aria-hidden="true">
            <i class="bi bi-lock-fill"></i>
          </div>
          <div class="swal-close-alert-body">
            <h3>Cerrar chat de forma inmediata</h3>
            <p>
              Los miembros de <span class="swal-close-alert-chat">${groupLabel}</span>
              no podran enviar mas mensajes hasta que se reabra.
            </p>
          </div>
        </div>

        <div class="swal-close-body">
          <label class="swal-close-label">Mensaje personalizado para los usuarios</label>
          <p class="swal-close-helper">
            Si lo dejas vacio, el sistema aplicara un mensaje por defecto automaticamente.
          </p>
        </div>

        <footer class="swal-close-foot">Panel de Control Admin</footer>
      `,
      input: 'textarea',
      inputPlaceholder:
        'Ej: Chat cerrado temporalmente por mantenimiento de administracion...',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'swal-close-popup',
        htmlContainer: 'swal-close-html',
        input: 'swal-close-textarea',
        confirmButton: 'swal-close-confirm',
        cancelButton: 'swal-close-cancel',
        actions: 'swal-close-actions',
      },
    });
    if (motivo === undefined) return;

    const confirmed = await Swal.fire({
      title: 'Confirmar cierre del chat',
      text: `Vas a cerrar ${groupLabel}. Se bloqueara el envio para todos sus miembros.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Si, cerrar chat',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmed.isConfirmed) return;

    this.chatService
      .cerrarChatGrupalAdmin(chatId, { motivo: String(motivo || '').trim() || null })
      .subscribe({
        next: (state) => {
          (group as any).chatCerrado = true;
          (group as any).closed = true;
          (group as any).chatCerradoMotivo = String(
            (state as any)?.reason || (state as any)?.motivo || motivo || ''
          ).trim();
          (group as any).reason = (group as any).chatCerradoMotivo || null;
          void Swal.fire({
            title: 'Chat cerrado',
            text: `${groupLabel} se ha cerrado correctamente.`,
            icon: 'success',
            confirmButtonColor: '#10b981',
          });
        },
        error: (err) => {
          console.error('Error cerrando chat grupal', err);
          const backendMsg = String(
            err?.error?.mensaje || err?.error?.message || err?.message || ''
          ).trim();
          void Swal.fire({
            title: 'Error',
            text: backendMsg || 'No se pudo cerrar el chat grupal en el servidor.',
            icon: 'error',
          });
        },
      });
  }

  public onGroupReopen(group: AdminGroupListDTO): void {
    const groupLabel = group?.nombreGrupo?.trim() || `Grupo #${group?.id ?? '-'}`;
    const chatId = Number(group?.id);
    if (!Number.isFinite(chatId) || chatId <= 0) return;

    void Swal.fire({
      title: 'Reabrir chat',
      text: `Vas a reabrir ${groupLabel}. Los miembros podran volver a enviar mensajes.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Si, reabrir',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.chatService.reabrirChatGrupalAdmin(chatId).subscribe({
        next: () => {
          (group as any).chatCerrado = false;
          (group as any).closed = false;
          (group as any).chatCerradoMotivo = null;
          (group as any).reason = null;
          void Swal.fire({
            title: 'Chat reabierto',
            text: `${groupLabel} ya permite envio de mensajes.`,
            icon: 'success',
            confirmButtonColor: '#10b981',
          });
        },
        error: (err) => {
          console.error('Error reabriendo chat grupal', err);
          const backendMsg = String(
            err?.error?.mensaje || err?.error?.message || err?.message || ''
          ).trim();
          void Swal.fire({
            title: 'Error',
            text: backendMsg || 'No se pudo reabrir el chat grupal en el servidor.',
            icon: 'error',
          });
        },
      });
    });
  }

  public onGroupDelete(group: AdminGroupListDTO): void {
    const groupLabel = group?.nombreGrupo?.trim() || `Grupo #${group?.id ?? '-'}`;
    void Swal.fire({
      title: 'Eliminar grupo',
      text: `La accion de eliminar ${groupLabel} queda preparada en UI. Falta enlazar endpoint backend.`,
      icon: 'warning',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#e11d48',
    });
  }

  logoutFromAdmin(): void {
    this.sessionService.logout({
      clearE2EKeys: false,
      clearAuditKeys: false,
      broadcast: true,
      reason: 'admin-panel',
    });
  }

   async banUsuario(usuario: any) {
    const { value: motivo } = await Swal.fire({
      title: '',
      html: `
        <div class="swal-ban-header">
          <div class="swal-ban-header-icon"><i class="bi bi-slash-circle-fill"></i></div>
          <div class="swal-ban-header-text">
            <h2>Banear usuario</h2>
            <p>Vas a restringir el acceso de <strong>${usuario.nombre}</strong> a TejeChat</p>
          </div>
        </div>

        <div class="swal-ban-body">
          <label class="swal-ban-label">Motivo del baneo (opcional)</label>
          <p class="swal-ban-helper">Puedes dejarlo vacio si no quieres indicar un motivo especifico.</p>
        </div>
      `,
      input: 'textarea',
      inputPlaceholder: 'Ej: Insultos reiterados, spam, comportamiento inapropiado...',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'swal-ban-popup',
        htmlContainer: 'swal-ban-html',
        input: 'swal-ban-textarea',
        confirmButton: 'swal-ban-confirm',
        cancelButton: 'swal-ban-cancel',
        actions: 'swal-ban-actions'
      }
    });

    // Si cancela
    if (motivo === undefined) return;

    const result = await Swal.fire({
      title: 'Estas seguro?',
      text: `Vas a banear a ${usuario.nombre}. Perdera el acceso a TejeChat inmediatamente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Si, banear',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.authService.banearUsuario(Number(usuario.id), (motivo || '').trim()).subscribe({
      next: () => {
        Swal.fire('Usuario baneado!', `${usuario.nombre} ha sido baneado correctamente.`, 'success');
        usuario.activo = false;
      },
      error: (err) => {
        console.error('Error al banear usuario', err);
        Swal.fire('Error', 'No se pudo banear al usuario en el servidor.', 'error');
      }
    });
  }

  unbanUsuario(usuario: any) {
    Swal.fire({
      title: 'Reactivar usuario?',
      text: `Estas a punto de desbanear a ${usuario.nombre}. Recuperara el acceso a TejeChat de forma inmediata.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6', // Un azul vibrante para diferenciar de la advertencia
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Si, desbanear',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Llamada al servicio que definiste
        this.authService.desbanearUsuario(Number(usuario.id)).subscribe({
          next: () => {
            Swal.fire({
              title: 'Cuenta reactivada!',
              text: `El usuario ${usuario.nombre} ya puede volver a iniciar sesión.`,
              icon: 'success',
              confirmButtonColor: '#10b981'
            });

            // Esto actualiza la interfaz automáticamente gracias al *ngIf
            usuario.activo = true;
          },
          error: (err) => {
            console.error("Error al desbanear", err);
            Swal.fire('Error', 'No se pudo reactivar al usuario en el servidor.', 'error');
          }
        });
      }
    });
  }

  private getLocalPrivateKeyUserIds(): number[] {
    const ids: number[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const match = /^privateKey_(\d+)$/.exec(key);
      if (!match) continue;
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    }
    return ids;
  }

  private buildDecryptCandidateIds(
    emisorId: number,
    receptorId: number,
    chat?: any
  ): number[] {
    const ids: number[] = [];
    const pushId = (id: unknown) => {
      const n = Number(id);
      if (!Number.isFinite(n) || n <= 0) return;
      if (!ids.includes(n)) ids.push(n);
    };

    pushId(this.usuarioActualId);
    pushId(this.inspectedUserId);
    pushId(emisorId);
    pushId(receptorId);

    if (Array.isArray(chat?.usuarios)) {
      for (const member of chat.usuarios) {
        pushId(member?.id);
      }
    }

    for (const localId of this.getLocalPrivateKeyUserIds()) {
      pushId(localId);
    }

    return ids;
  }

  private async decryptContenidoWithCandidates(
    contenido: string,
    candidateUserIds: number[],
    source: string
  ): Promise<string> {
    const encryptedFallback = '[Mensaje Cifrado]';
    const adminEnvelopePlain = await this.tryDecryptWithAuditEnvelope(
      contenido,
      source
    );
    if (adminEnvelopePlain !== null) {
      return adminEnvelopePlain;
    }

    const candidates = Array.isArray(candidateUserIds) ? candidateUserIds : [];
    if (!candidates.length) {
      console.warn('[ADMIN_E2E] Sin claves privadas candidatas para descifrar', {
        source,
      });
      return encryptedFallback;
    }

    for (const userId of candidates) {
      try {
        const plain = await decryptPreviewStringE2E(
          contenido,
          userId,
          this.cryptoService,
          { source: `${source}-uid-${userId}` }
        );
        if (plain !== encryptedFallback) {
          return plain;
        }
      } catch {
        // Seguimos con el siguiente candidato.
      }
    }

    console.warn('[ADMIN_E2E] No se pudo descifrar con claves locales', {
      source,
      candidateUserIds: candidates,
    });
    return encryptedFallback;
  }

  private getStoredAuditPrivateKeyRaw(): string {
    const storageKeys = [
      'auditPrivateKey',
      'forAdminPrivateKey',
      'privateKey_admin_audit',
      'auditPrivateKeyPem',
      'app_audit_admin_private_key_pem',
    ];

    const fromLocalStorage = storageKeys
      .map((k) => localStorage.getItem(k))
      .find((v) => !!String(v || '').trim());
    if (fromLocalStorage) return String(fromLocalStorage);

    const fromSessionStorage = storageKeys
      .map((k) => sessionStorage.getItem(k))
      .find((v) => !!String(v || '').trim());
    if (fromSessionStorage) return String(fromSessionStorage);

    const fromWindow = [
      (window as any)?.APP_AUDIT_ADMIN_PRIVATE_KEY,
      (window as any)?.APP_AUDIT_ADMIN_PRIVATE_KEY_PEM,
    ].find((v) => !!String(v || '').trim());
    if (fromWindow) return String(fromWindow);

    return '';
  }

  private normalizePrivateKeyBase64(raw: string): string {
    const text = String(raw || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\\n/g, '\n');
    if (!text) return '';
    const noHeaders = text
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s+/g, '')
      .trim();
    return noHeaders;
  }

  private async importAuditPrivateKeyFromStorage(): Promise<CryptoKey | null> {
    const raw = this.getStoredAuditPrivateKeyRaw();
    const normalized = this.normalizePrivateKeyBase64(raw);
    if (!normalized) return null;

    if (
      this.auditPrivateKeyImportCache &&
      this.auditPrivateKeyImportCache.raw === normalized
    ) {
      return this.auditPrivateKeyImportCache.key;
    }

    try {
      const key = await this.cryptoService.importPrivateKey(normalized);
      this.auditPrivateKeyImportCache = { raw: normalized, key };
      return key;
    } catch (err) {
      console.warn('[ADMIN_E2E] Clave privada de auditoria invalida', {
        error: String((err as any)?.message || err),
      });
      this.auditPrivateKeyImportCache = null;
      return null;
    }
  }

  private async tryDecryptWithAuditEnvelope(
    contenido: string,
    source: string
  ): Promise<string | null> {
    const text = String(contenido || '').trim();
    if (!text.startsWith('{')) return null;

    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      return null;
    }

    const payloadType = String(payload?.type || '').toUpperCase();
    if ((payloadType !== 'E2E' && payloadType !== 'E2E_GROUP') || !payload?.forAdmin) {
      return null;
    }

    const auditPrivateKey = await this.importAuditPrivateKeyFromStorage();
    if (!auditPrivateKey) return null;

    try {
      const decryptedForAdmin = await this.cryptoService.decryptRSA(
        String(payload.forAdmin),
        auditPrivateKey
      );

      try {
        const aesKey = await this.cryptoService.importAESKey(decryptedForAdmin);
        const plain = await this.cryptoService.decryptAES(
          String(payload.ciphertext || ''),
          String(payload.iv || ''),
          aesKey
        );
        return String(plain ?? '');
      } catch {
        // Compatibilidad legado:
        // algunos mensajes guardan forAdmin como texto claro cifrado por RSA.
        const directPlain = String(decryptedForAdmin ?? '').trim();
        if (directPlain) {
          return directPlain;
        }
      }
    } catch (err) {
      console.warn('[ADMIN_E2E] Fallo descifrado via forAdmin', {
        source,
        payloadType,
        error: String((err as any)?.message || err),
      });
    }
    return null;
  }

  private async decryptContenido(
    contenido: string,
    emisorId: number,
    receptorId: number,
    chat?: any
  ): Promise<string> {
    const candidateIds = this.buildDecryptCandidateIds(emisorId, receptorId, chat);
    return this.decryptContenidoWithCandidates(
      contenido,
      candidateIds,
      'admin-chat-detail'
    );
  }

}






