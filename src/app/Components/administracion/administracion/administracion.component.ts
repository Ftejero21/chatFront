import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { DashboardStatsDTO } from '../../../Interface/DashboardStatsDTO';
import { PageResponse } from '../../../Interface/PageResponse';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { ChatService } from '../../../Service/chat/chat.service';
import { decryptPreviewStringE2E, resolveMediaUrl } from '../../../utils/chat-utils';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { environment } from '../../../environments';
import { SessionService } from '../../../Service/session/session.service';

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

@Component({
  selector: 'app-administracion',
  templateUrl: './administracion.component.html',
  styleUrls: ['./administracion.component.css']
})
export class AdministracionComponent implements OnInit, OnDestroy {

  // Variables de control de vista
  isDashboardView: boolean = true;
  isSidebarOpen: boolean = false;
  headerSubtitle: string = "Gestion centralizada de TejeChat.";
  currentUserName: string = "";
  loadingConversations: boolean = false;
  loadingChatMessages: boolean = false;
  selectedChatMessagesSource: 'admin' | 'group' = 'admin';
  public usuarioActualId!: number;
  userChats: any[] = [];
  selectedChat: any | null = null;
  selectedChatMensajes: any[] = [];
  adminAudioStates = new Map<string, { playing: boolean; current: number; duration: number }>();
  private adminDecryptedAudioUrlByCacheKey = new Map<string, string>();
  private adminDecryptingAudioByCacheKey = new Map<string, Promise<string | null>>();
  private adminDecryptedImageUrlByCacheKey = new Map<string, string>();
  private adminDecryptingImageByCacheKey = new Map<string, Promise<string | null>>();
  private adminImageCaptionByCacheKey = new Map<string, string>();
  private adminDecryptingImageCaptionByCacheKey = new Map<string, Promise<string>>();
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
  busquedaTerm: string = "";
  currentPage: number = 0;
  pageSize: number = 10;
  totalPages: number = 1;
  totalElements: number = 0;
  isLastPage: boolean = true;
  loadingUsuarios: boolean = false;

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
    private sessionService: SessionService
  ) { }

  ngOnInit(): void {
    const id = localStorage.getItem('usuarioId');
    this.cargarEstadisticas();
    this.cargarUsuariosRecientes();

    if (!id) {
      console.warn('No hay usuario logueado');
      return;
    }

    this.usuarioActualId = parseInt(id, 10);
    this.cargarAdminPerfil(this.usuarioActualId);
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
    this.adminDecryptedAudioUrlByCacheKey.clear();
    this.adminDecryptingAudioByCacheKey.clear();
    this.adminDecryptedImageUrlByCacheKey.clear();
    this.adminDecryptingImageByCacheKey.clear();
    this.adminImageCaptionByCacheKey.clear();
    this.adminDecryptingImageCaptionByCacheKey.clear();
  }

  cargarEstadisticas(): void {
    this.authService.getDashboardStats().subscribe({
      next: (data) => this.stats = data,
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
    this.currentUserName = user.nombre;
    this.headerSubtitle = `Inspeccionando registros de: ${user.nombre}`;
    this.inspectedUserId = Number(user.id);
    this.selectedChat = null;
    this.selectedChatMensajes = [];

    this.loadingConversations = true;
    this.userChats = [];

    this.chatService.listarConversacionesAdmin(Number(user.id)).subscribe({
      next: async (data: any) => {
        try {
          this.userChats = await this.normalizeAdminChatSummaries(data || []);
        } catch (err) {
          console.error('Error normalizando conversaciones admin', err);
          this.userChats = Array.isArray(data) ? data : [];
        }
        this.loadingConversations = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err: any) => {
        console.error("Error cargando chats", err);
        this.loadingConversations = false;
        this.userChats = [];
        Swal.fire('Error', 'No se pudieron cargar las conversaciones del usuario.', 'error');
      }
    });
  }

  private async normalizeAdminChatSummaries(chats: any[]): Promise<any[]> {
    if (!Array.isArray(chats)) return [];
    return Promise.all(chats.map((chat) => this.normalizeAdminChatSummary(chat)));
  }

  private async normalizeAdminChatSummary(chat: any): Promise<any> {
    if (!chat) return chat;

    const tipo = this.resolveAdminLastMessageTipo(chat);
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

    if (isInactive) return 'Mensaje eliminado';

    let textoResuelto = 'Sin datos';
    if (tipo === 'AUDIO' || chat?.__ultimoEsAudio === true || this.isAudioLikePayload(chat, tipo, true)) {
      const durMs = this.extractAudioDurationMs(chat, true);
      textoResuelto = this.buildAudioVoiceLabel(durMs);
    } else if (tipo === 'IMAGE' || chat?.__ultimoEsImagen === true) {
      const caption = String(chat?.__ultimoImagenCaption || '').trim();
      textoResuelto = caption ? `Imagen: ${caption}` : 'Imagen';
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
          textoResuelto = normalized || '[Mensaje Cifrado]';
        } catch {
          textoResuelto = '[Mensaje Cifrado]';
        }
      } else {
        textoResuelto = raw;
      }
    }

    if (this.isAdminGroupChat(chat) && textoResuelto !== 'Sin datos' && textoResuelto !== 'Mensaje eliminado') {
      const sender = this.buildAdminSenderName(chat);
      if (sender && !/^[^:]{1,80}:\s*/.test(textoResuelto)) return `${sender}: ${textoResuelto}`;
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
    if (t === 'TEXT' || t === 'AUDIO' || t === 'IMAGE' || t === 'VIDEO' || t === 'FILE' || t === 'SYSTEM') {
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
    if (payloadType === 'E2E' || payloadType === 'E2E_GROUP') return 'TEXT';
    return '';
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

    if (!chat.__ultimoEsImagen) return;

    if (imagePayload) {
      const objectUrl = await this.decryptAdminImagePayloadToObjectUrl(
        imagePayload,
        chat?.ultimoMensajeId ?? chat?.ultimaMensajeId
      );
      chat.__ultimoImagenUrl = String(objectUrl || '').trim();
      chat.__ultimoImagenNombre =
        chat.__ultimoImagenNombre || String(imagePayload?.imageNombre || '').trim();
      chat.__ultimoImagenCaption = await this.decryptAdminImageCaption(imagePayload);
      return;
    }

    chat.__ultimoImagenUrl = resolveMediaUrl(directImageUrl, environment.backendBaseUrl) || '';
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
  }

  private async buildChatMessages(chat: any, rawMessages: any[] = []): Promise<any[]> {
    if (!chat || !Array.isArray(rawMessages) || !rawMessages.length) return [];

    const normalized = await Promise.all(
      rawMessages.map(async (msg: any, index: number) => {
        const emisorId = Number(msg?.emisorId ?? msg?.emisor?.id ?? 0);
        const receptorId = Number(msg?.receptorId ?? msg?.receptor?.id ?? 0);
        const tipo = String(msg?.tipo ?? msg?.messageType ?? '').trim().toUpperCase();
        let audioDurMs = this.extractAudioDurationMs(msg, false);
        const rawContenido =
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
        const e2eAudioPayload = this.parseAdminAudioE2EPayload(rawContenido);
        const e2eImagePayload = this.parseAdminImageE2EPayload(rawContenido);
        const isImage = this.isImageLikePayload(msg, tipo, false) || !!e2eImagePayload;
        const isAudio = !isImage && this.isAudioLikePayload(msg, tipo, false);
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
        const imageMime = String(
          msg?.imageMime ??
            msg?.imagenMime ??
            e2eImagePayload?.imageMime ??
            ''
        ).trim();
        const imageNombre = String(
          msg?.imageNombre ??
            msg?.imagenNombre ??
            msg?.imageName ??
            e2eImagePayload?.imageNombre ??
            ''
        ).trim();

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
        } else {
          try {
            if (text && this.isEncryptedE2EPayload(text)) {
              text = await this.decryptContenido(text, emisorId, receptorId, chat);
            }
          } catch {
            // Si falla descifrado dejamos el contenido tal cual.
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
          senderName,
          senderLastName,
          senderFullName,
          isFromInspectedUser: this.inspectedUserId !== null && emisorId === this.inspectedUserId,
          activo: Number(msg?.activo ?? 1),
          reenviado:
            msg?.reenviado === true ||
            msg?.reenvio === true ||
            msg?.forwarded === true,
          replyToMessageId: msg?.replyToMessageId ?? null,
          replySnippet: msg?.replySnippet ?? null,
          replyAuthorName: msg?.replyAuthorName ?? null,
          createdAt: msg?.fechaEnvio || msg?.fecha || msg?.createdAt || msg?.timestamp || null,
        };
      })
    );

    return normalized.sort((a, b) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
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
      rawContenido,
    ];

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
    if (tipo === 'IMAGE') return true;
    return !!String(msg?.imageUrl ?? '').trim();
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
    return this.chatService.listarMensajesAdminPorChat(chatId);
  }

  private isEncryptedE2EPayload(value: string): boolean {
    const payload = this.parseAdminPayload(this.extractAdminPayloadCandidate(value));
    const type = String(payload?.type || '').toUpperCase();
    return (type === 'E2E' || type === 'E2E_GROUP') && !!payload?.ciphertext;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  showDashboard() {
    this.isDashboardView = true;
    this.isSidebarOpen = false;
    this.selectedChat = null;
    this.selectedChatMensajes = [];
    this.selectedChatMessagesSource = 'admin';
    this.headerSubtitle = "Gestion centralizada de TejeChat.";
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
          console.log('[ADMIN_E2E] Descifrado OK en admin', {
            source,
            userId,
            candidatesTried: candidates.length,
          });
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
        console.log('[ADMIN_E2E] Descifrado OK via forAdmin (AES envelope)', {
          source,
          payloadType,
        });
        return String(plain ?? '');
      } catch {
        // Compatibilidad legado:
        // algunos mensajes guardan forAdmin como texto claro cifrado por RSA.
        const directPlain = String(decryptedForAdmin ?? '').trim();
        if (directPlain) {
          console.log('[ADMIN_E2E] Descifrado OK via forAdmin (direct plain)', {
            source,
            payloadType,
          });
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



