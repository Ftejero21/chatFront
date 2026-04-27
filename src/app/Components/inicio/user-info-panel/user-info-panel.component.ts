import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { AuthService } from '../../../Service/auth/auth.service';
import { ChatService } from '../../../Service/chat/chat.service';
import { MensajeDTO } from '../../../Interface/MensajeDTO';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { resolveMediaUrl } from '../../../utils/chat-utils';
import { environment } from '../../../environments';

type EstadoUsuario = 'Conectado' | 'Desconectado' | 'Ausente';
type UserMediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';

interface E2EEncryptedMediaPayload {
  type: string;
  ivFile: string;
  mediaUrl: string;
  mediaMime?: string;
  mediaDurMs?: number;
  fileName?: string;
  forEmisor: string;
  forAdmin?: string;
  forReceptor?: string;
  forReceptores?: Record<string, string>;
}

interface UserMediaViewItem {
  messageId: number;
  chatId: number;
  emisorId: number;
  emisorNombreCompleto: string;
  fechaEnvio: string;
  tipo: string;
  kind: UserMediaKind;
  mime: string;
  sizeBytes: number;
  durMs: number;
  fileName: string;
  encrypted: boolean;
  e2ePayload: E2EEncryptedMediaPayload | null;
  mediaUrlRaw: string;
  resolvedUrl: string;
  decrypting: boolean;
  decryptError: string;
}

interface PanelAudioState {
  playing: boolean;
  current: number;
  duration: number;
}

interface UserDetailItem {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-user-info-panel',
  templateUrl: './user-info-panel.component.html',
  styleUrl: './user-info-panel.component.css',
})
export class UserInfoPanelComponent implements OnChanges, OnDestroy {
  @Input() chat: any;
  @Input() currentUserId = 0;
  @Input() isChatMuted = false;
  @Input() isUserBlocked = false;
  @Input() isUserReported = false;
  @Output() closePanel = new EventEmitter<void>();
  @Output() muteNotifications = new EventEmitter<void>();
  @Output() blockUser = new EventEmitter<void>();
  @Output() reportUser = new EventEmitter<void>();

  public detail: UsuarioDTO | null = null;
  public loading = false;
  public loadError: string | null = null;

  public mediaOpen = false;
  public mediaLoading = false;
  public mediaLoadingMore = false;
  public mediaInitialized = false;
  public mediaHasMore = true;
  public mediaPage = 0;
  public mediaError: string | null = null;
  public mediaItems: UserMediaViewItem[] = [];
  public mediaDecryptingMessageId: number | null = null;

  public filesOpen = false;
  public filesLoading = false;
  public filesLoadingMore = false;
  public filesInitialized = false;
  public filesHasMore = true;
  public filesPage = 0;
  public filesError: string | null = null;
  public filesItems: UserMediaViewItem[] = [];
  public filesDecryptingMessageId: number | null = null;

  public mediaAudioStates = new Map<number, PanelAudioState>();
  private mediaCurrentAudioEl: HTMLAudioElement | null = null;
  private mediaCurrentAudioMessageId: number | null = null;

  private decryptedMediaUrlByCacheKey = new Map<string, string>();
  private decryptingMediaByCacheKey = new Map<string, Promise<string | null>>();

  constructor(
    private authService: AuthService,
    private chatService: ChatService,
    private mensajeriaService: MensajeriaService,
    private cryptoService: CryptoService,
    private cdr: ChangeDetectorRef
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['chat']) return;
    this.loadUserDetail();
    this.resetMediaState();
    this.resetFilesState();
    this.clearDecryptedMediaUrls();
  }

  public ngOnDestroy(): void {
    this.stopCurrentAudioPlayback();
    this.clearDecryptedMediaUrls();
  }

  public onClose(): void {
    this.stopCurrentAudioPlayback();
    this.closePanel.emit();
  }

  public onMuteNotifications(): void {
    this.muteNotifications.emit();
  }

  public onBlockUser(): void {
    this.blockUser.emit();
  }

  public onReportUser(): void {
    this.reportUser.emit();
  }

  public get muteButtonLabel(): string {
    return this.isChatMuted ? 'Activar Notificaciones' : 'Silenciar Notificaciones';
  }

  public get blockButtonLabel(): string {
    return this.isUserBlocked ? 'Desbloquear Usuario' : 'Bloquear Usuario';
  }

  public get userName(): string {
    const fromDetail = `${this.detail?.nombre || ''} ${this.detail?.apellido || ''}`.trim();
    if (fromDetail) return fromDetail;

    const receptor = this.chat?.receptor || {};
    const fromReceptor = `${receptor?.nombre || ''} ${receptor?.apellido || ''}`.trim();
    if (fromReceptor) return fromReceptor;

    const fromChat = String(this.chat?.nombre || '').trim();
    return fromChat || 'Usuario';
  }

  public get userPhoto(): string {
    const raw =
      String(this.detail?.foto || '').trim() ||
      String(this.chat?.receptor?.foto || '').trim() ||
      String(this.chat?.foto || '').trim();
    return resolveMediaUrl(raw, environment.backendBaseUrl) || 'assets/usuario.png';
  }

  public get estadoLabel(): EstadoUsuario {
    const normalized = String(this.chat?.estado || '').trim().toLowerCase();
    if (normalized === 'conectado') return 'Conectado';
    if (normalized === 'ausente') return 'Ausente';
    return 'Desconectado';
  }

  public get estadoClass(): string {
    if (this.estadoLabel === 'Conectado') return 'is-connected';
    if (this.estadoLabel === 'Ausente') return 'is-away';
    return 'is-disconnected';
  }

  public get userStatusUiClass(): 'online' | 'away' | 'offline' {
    if (this.estadoLabel === 'Conectado') return 'online';
    if (this.estadoLabel === 'Ausente') return 'away';
    return 'offline';
  }

  public get userStatusLabel(): string {
    if (this.estadoLabel === 'Conectado') return 'Disponible ahora';
    if (this.estadoLabel === 'Ausente') return 'Fuera de la oficina';
    return 'Desconectado';
  }

  public get userEmail(): string {
    return this.stringOrFallback(
      this.detail?.email ?? this.chat?.receptor?.email,
      'No cuenta con correo electronico.'
    );
  }

  public get userPhone(): string {
    return this.stringOrFallback(
      this.detail?.telefono ??
        this.detail?.phone ??
        this.chat?.receptor?.telefono ??
        this.chat?.receptor?.phone,
      'No cuenta con numero de telefono.'
    );
  }

  public get userDni(): string {
    return this.stringOrFallback(
      this.detail?.dni ??
        this.detail?.documento ??
        this.chat?.receptor?.dni ??
        this.chat?.receptor?.documento,
      'No cuenta con DNI.'
    );
  }

  public get userNacionalidad(): string {
    return this.stringOrFallback(
      this.detail?.nacionalidad ??
        this.detail?.nationality ??
        this.chat?.receptor?.nacionalidad ??
        this.chat?.receptor?.nationality,
      'No cuenta con nacionalidad.'
    );
  }

  public get userOcupacion(): string {
    return this.stringOrFallback(
      this.detail?.ocupacion ??
        this.detail?.profesion ??
        this.chat?.receptor?.ocupacion ??
        this.chat?.receptor?.profesion,
      'No cuenta con ocupacion.'
    );
  }

  public get profileBio(): string {
    const raw = String(
      this.detail?.ocupacion ??
        this.detail?.profesion ??
        this.chat?.receptor?.ocupacion ??
        this.chat?.receptor?.profesion ??
        ''
    ).trim();
    return raw || 'Sin ocupacion definida';
  }

  public get userIdLabel(): string {
    const id = Number(this.detail?.id ?? this.chat?.receptor?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) return 'No disponible.';
    return String(Math.round(id));
  }

  public get userNombreLabel(): string {
    return this.stringOrFallback(
      this.detail?.nombre ?? this.chat?.receptor?.nombre,
      'No cuenta con nombre.'
    );
  }

  public get userApellidoLabel(): string {
    return this.stringOrFallback(
      this.detail?.apellido ?? this.chat?.receptor?.apellido,
      'No cuenta con apellido.'
    );
  }

  public get userActivoLabel(): string {
    const activo = this.detail?.activo;
    if (typeof activo === 'boolean') return activo ? 'Activo' : 'Inactivo';
    return 'No disponible.';
  }

  public get userDireccionLabel(): string {
    return this.stringOrFallback(
      this.detail?.direccion ?? this.chat?.receptor?.direccion,
      'No cuenta con direccion.'
    );
  }

  public get userFechaNacimientoLabel(): string {
    const raw =
      this.detail?.fechaNacimiento ??
      this.detail?.fecha_nacimiento ??
      this.detail?.birthDate ??
      this.chat?.receptor?.fechaNacimiento ??
      this.chat?.receptor?.fecha_nacimiento ??
      this.chat?.receptor?.birthDate ??
      '';
    const txt = String(raw || '').trim();
    if (!txt) return 'No cuenta con fecha de nacimiento.';
    const date = new Date(txt);
    if (isNaN(date.getTime())) return txt;
    return date.toLocaleDateString();
  }

  public get userGeneroLabel(): string {
    return this.stringOrFallback(
      this.detail?.genero ??
        this.detail?.gender ??
        this.chat?.receptor?.genero ??
        this.chat?.receptor?.gender,
      'No cuenta con genero.'
    );
  }

  public get userInstagramLabel(): string {
    return this.stringOrFallback(
      this.detail?.instagram ??
        this.detail?.instagramHandle ??
        this.chat?.receptor?.instagram ??
        this.chat?.receptor?.instagramHandle,
      'No cuenta con cuenta de Instagram.'
    );
  }

  public get userHasPublicKeyLabel(): string {
    const value = this.detail?.hasPublicKey;
    if (typeof value !== 'boolean') return 'No disponible.';
    return value ? 'Si, cuenta con clave publica.' : 'No cuenta con clave publica.';
  }

  public get userDetails(): UserDetailItem[] {
    return [
      { label: 'Email personal', value: this.userEmail, icon: '✉️' },
      { label: 'Telefono', value: this.userPhone, icon: '📱' },
      { label: 'Documento', value: this.userDni, icon: '🪪' },
      { label: 'Direccion', value: this.userDireccionLabel, icon: '📍' },
      { label: 'Fecha de nacimiento', value: this.userFechaNacimientoLabel, icon: '🎂' },
      { label: 'Genero', value: this.userGeneroLabel, icon: '👤' },
      { label: 'Instagram', value: this.userInstagramLabel, icon: '📷' },
      { label: 'Nacionalidad', value: this.userNacionalidad, icon: '🌐' },
      { label: 'Ocupacion', value: this.userOcupacion, icon: '💼' },
    ];
  }

  public get sharedMediaSubtitle(): string {
    const count = this.mediaItems.length;
    if (count > 0) return `${count} elementos multimedia`;
    if (this.mediaLoading) return 'Cargando...';
    return 'Sin archivos multimedia';
  }

  public get sharedFilesSubtitle(): string {
    const count = this.filesItems.length;
    if (count > 0) return `${count} archivos`;
    if (this.filesLoading) return 'Cargando...';
    return 'Sin archivos compartidos';
  }

  public trackMediaItem(_: number, item: UserMediaViewItem): number {
    return Number(item?.messageId || _);
  }

  public trackFileItem(_: number, item: UserMediaViewItem): number {
    return Number(item?.messageId || _);
  }

  public isImageItem(item: UserMediaViewItem): boolean {
    return item?.kind === 'IMAGE';
  }

  public isVideoItem(item: UserMediaViewItem): boolean {
    return item?.kind === 'VIDEO';
  }

  public isAudioItem(item: UserMediaViewItem): boolean {
    return item?.kind === 'AUDIO';
  }

  public mediaDateLabel(item: UserMediaViewItem): string {
    const raw = String(item?.fechaEnvio || '').trim();
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString();
  }

  public mediaSizeLabel(bytes: number): string {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  public mediaDurationLabel(ms: number): string {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0) return '';
    const total = Math.round(value / 1000);
    const min = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const sec = (total % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }
  public onMediaAudioLoadedMetadata(
    item: UserMediaViewItem,
    audio: HTMLAudioElement
  ): void {
    const id = Number(item?.messageId || 0);
    if (!id) return;
    const prev = this.mediaAudioStates.get(id);
    const duration = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
    this.mediaAudioStates.set(id, {
      playing: prev?.playing ?? false,
      current: prev?.current ?? 0,
      duration:
        duration > 0
          ? duration
          : prev?.duration ?? Math.max(0, Number(item?.durMs || 0)),
    });
  }

  public onMediaAudioTimeUpdate(
    item: UserMediaViewItem,
    audio: HTMLAudioElement
  ): void {
    const id = Number(item?.messageId || 0);
    if (!id) return;
    const prev = this.mediaAudioStates.get(id);
    this.mediaAudioStates.set(id, {
      playing: !audio.paused,
      current: Math.max(0, audio.currentTime * 1000),
      duration:
        prev?.duration && prev.duration > 0
          ? prev.duration
          : Number.isFinite(audio.duration)
          ? audio.duration * 1000
          : Math.max(0, Number(item?.durMs || 0)),
    });
  }

  public onMediaAudioEnded(item: UserMediaViewItem): void {
    const id = Number(item?.messageId || 0);
    if (!id) return;
    const prev = this.mediaAudioStates.get(id);
    this.mediaAudioStates.set(id, {
      playing: false,
      current: 0,
      duration: prev?.duration ?? Math.max(0, Number(item?.durMs || 0)),
    });
    if (this.mediaCurrentAudioMessageId === id) {
      this.mediaCurrentAudioMessageId = null;
      this.mediaCurrentAudioEl = null;
    }
  }

  public mediaAudioProgressPercent(item: UserMediaViewItem): number {
    const id = Number(item?.messageId || 0);
    if (!id) return 0;
    const st = this.mediaAudioStates.get(id);
    const current = Number(st?.current || 0);
    const duration = Number(st?.duration || Number(item?.durMs || 0));
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (current / duration) * 100));
  }

  public async toggleMediaAudioPlay(
    item: UserMediaViewItem,
    audio: HTMLAudioElement
  ): Promise<void> {
    const id = Number(item?.messageId || 0);
    if (!id) return;

    if (this.mediaCurrentAudioEl && this.mediaCurrentAudioEl !== audio) {
      try {
        this.mediaCurrentAudioEl.pause();
      } catch {}
      if (this.mediaCurrentAudioMessageId) {
        const prev = this.mediaAudioStates.get(this.mediaCurrentAudioMessageId);
        if (prev) {
          this.mediaAudioStates.set(this.mediaCurrentAudioMessageId, {
            ...prev,
            playing: false,
          });
        }
      }
    }

    if (audio.paused) {
      try {
        await audio.play();
        const prev = this.mediaAudioStates.get(id);
        this.mediaAudioStates.set(id, {
          playing: true,
          current: prev?.current ?? 0,
          duration: prev?.duration ?? Math.max(0, Number(item?.durMs || 0)),
        });
        this.mediaCurrentAudioEl = audio;
        this.mediaCurrentAudioMessageId = id;
      } catch {}
    } else {
      audio.pause();
      const prev = this.mediaAudioStates.get(id);
      this.mediaAudioStates.set(id, {
        playing: false,
        current: prev?.current ?? 0,
        duration: prev?.duration ?? Math.max(0, Number(item?.durMs || 0)),
      });
    }
  }

  public async toggleMedia(): Promise<void> {
    this.mediaOpen = !this.mediaOpen;
    if (this.mediaOpen) this.filesOpen = false;
    if (this.mediaOpen && !this.mediaInitialized && !this.mediaLoading) {
      this.loadMedia(true);
    }
  }

  public loadMoreMedia(): void {
    this.loadMedia(false);
  }

  public async toggleFiles(): Promise<void> {
    this.filesOpen = !this.filesOpen;
    if (this.filesOpen) this.mediaOpen = false;
    if (this.filesOpen && !this.filesInitialized && !this.filesLoading) {
      this.loadFiles(true);
    }
  }

  public loadMoreFiles(): void {
    this.loadFiles(false);
  }

  public fileNameLabel(item: UserMediaViewItem): string {
    const explicitName = String(item?.fileName || '').trim();
    if (explicitName) return explicitName;

    const fromUrl = String(item?.mediaUrlRaw || '').split('?')[0].split('#')[0];
    const parts = fromUrl.split('/').filter((p) => !!p);
    if (parts.length > 0) {
      try {
        return decodeURIComponent(parts[parts.length - 1]);
      } catch {
        return parts[parts.length - 1];
      }
    }

    return `Archivo #${Number(item?.messageId || 0)}`;
  }

  public async openFileItem(
    item: UserMediaViewItem,
    event?: MouseEvent
  ): Promise<void> {
    event?.stopPropagation();
    if (!item) return;

    if (!item.resolvedUrl) {
      this.filesDecryptingMessageId = item.messageId;
      try {
        await this.prepareMedia(item, true);
      } finally {
        if (this.filesDecryptingMessageId === item.messageId) {
          this.filesDecryptingMessageId = null;
        }
      }
    }

    const url = String(item.resolvedUrl || '').trim();
    if (!url) {
      item.decryptError = item.decryptError || 'No hay URL disponible para abrir este archivo.';
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  public async downloadFileItem(
    item: UserMediaViewItem,
    event?: MouseEvent
  ): Promise<void> {
    event?.stopPropagation();
    if (!item) return;

    if (!item.resolvedUrl) {
      this.filesDecryptingMessageId = item.messageId;
      try {
        await this.prepareMedia(item, true);
      } finally {
        if (this.filesDecryptingMessageId === item.messageId) {
          this.filesDecryptingMessageId = null;
        }
      }
    }

    const url = String(item.resolvedUrl || '').trim();
    if (!url) {
      item.decryptError = item.decryptError || 'No hay URL disponible para descargar este archivo.';
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileNameLabel(item);
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  public async prepareMedia(
    item: UserMediaViewItem,
    silent: boolean = false
  ): Promise<void> {
    if (!item || item.decrypting) return;
    if (item.resolvedUrl) return;
    if (!item.mediaUrlRaw && (!item.encrypted || !item.e2ePayload)) {
      item.decryptError = 'No hay URL disponible para este archivo.';
      return;
    }

    item.decrypting = true;
    item.decryptError = '';
    if (!silent) this.mediaDecryptingMessageId = item.messageId;

    try {
      const objectUrl =
        item.encrypted && item.e2ePayload
          ? await this.decryptMediaPayloadToObjectUrl(item)
          : await this.downloadMediaToObjectUrl(item);
      if (!objectUrl) {
        item.decryptError =
          item.encrypted && item.e2ePayload
            ? 'No se pudo descifrar en este dispositivo.'
            : 'No se pudo descargar el archivo protegido.';
      } else {
        item.resolvedUrl = objectUrl;
      }
    } catch (err: any) {
      const status = Number(err?.status || 0);
      if (status === 403) {
        item.decryptError = 'No tienes permisos para descargar este archivo.';
      } else if (status === 400) {
        item.decryptError = 'La descarga fue rechazada por datos invalidos.';
      } else {
        item.decryptError =
          item.encrypted && item.e2ePayload
            ? 'No se pudo descifrar en este dispositivo.'
            : 'No se pudo descargar el archivo protegido.';
      }
    } finally {
      item.decrypting = false;
      if (!silent && this.mediaDecryptingMessageId === item.messageId) {
        this.mediaDecryptingMessageId = null;
      }
      this.cdr.markForCheck();
    }
  }

  private loadUserDetail(): void {
    const userId = this.resolveTargetUserId();
    if (!userId) {
      this.detail = null;
      this.loading = false;
      this.loadError = 'No se pudo identificar el usuario del chat.';
      return;
    }

    this.loading = true;
    this.loadError = null;
    this.authService.getById(userId).subscribe({
      next: (res) => {
        this.detail = { ...(res || {}) };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.detail = null;
        this.loadError = 'No se pudo cargar la informacion del usuario.';
      },
    });
  }

  private resolveTargetUserId(): number {
    const raw =
      this.chat?.receptor?.id ??
      this.chat?.receptorId ??
      this.chat?.usuarioId ??
      this.chat?.idReceptor ??
      0;
    const userId = Number(raw || 0);
    if (!Number.isFinite(userId) || userId <= 0) return 0;
    return Math.round(userId);
  }

  private resolveChatId(): number {
    const chatId = Number(this.chat?.id || 0);
    if (!Number.isFinite(chatId) || chatId <= 0) return 0;
    return Math.round(chatId);
  }

  private stringOrFallback(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim();
    return text || fallback;
  }
  private resetMediaState(): void {
    this.mediaOpen = false;
    this.mediaLoading = false;
    this.mediaLoadingMore = false;
    this.mediaInitialized = false;
    this.mediaHasMore = true;
    this.mediaPage = 0;
    this.mediaError = null;
    this.mediaItems = [];
    this.mediaDecryptingMessageId = null;
    this.mediaAudioStates.clear();
    this.stopCurrentAudioPlayback();
  }

  private resetFilesState(): void {
    this.filesOpen = false;
    this.filesLoading = false;
    this.filesLoadingMore = false;
    this.filesInitialized = false;
    this.filesHasMore = true;
    this.filesPage = 0;
    this.filesError = null;
    this.filesItems = [];
    this.filesDecryptingMessageId = null;
  }

  private loadMedia(reset: boolean): void {
    const chatId = this.resolveChatId();
    if (!chatId) return;
    if (this.mediaLoading || this.mediaLoadingMore) return;
    if (!reset && !this.mediaHasMore) return;

    const pageSize = 40;
    const pageToLoad = reset ? 0 : this.mediaPage;
    this.mediaError = null;
    if (reset) {
      this.mediaLoading = true;
      this.mediaHasMore = true;
    } else {
      this.mediaLoadingMore = true;
    }

    this.chatService.listarMensajesPorChat(chatId, pageToLoad, pageSize).subscribe({
      next: (rows: MensajeDTO[]) => {
        const list = Array.isArray(rows) ? rows : [];
        const mapped = list
          .map((m) => this.mapMessageAttachment(m, chatId))
          .filter(
            (item): item is UserMediaViewItem =>
              !!item && (item.kind === 'AUDIO' || item.kind === 'IMAGE' || item.kind === 'VIDEO')
          );

        if (reset) {
          this.mediaItems = mapped;
        } else {
          this.mediaItems = this.mergeAndSortMediaItems(this.mediaItems, mapped);
        }

        this.mediaHasMore = list.length >= pageSize;
        this.mediaPage = pageToLoad + 1;
        this.mediaInitialized = true;
        this.mediaLoading = false;
        this.mediaLoadingMore = false;
        void this.autoPrepareLoadedItems(mapped);
        this.cdr.markForCheck();
      },
      error: () => {
        this.mediaLoading = false;
        this.mediaLoadingMore = false;
        this.mediaInitialized = true;
        this.mediaError = 'No se pudo cargar la multimedia del chat.';
        this.cdr.markForCheck();
      },
    });
  }

  private loadFiles(reset: boolean): void {
    const chatId = this.resolveChatId();
    if (!chatId) return;
    if (this.filesLoading || this.filesLoadingMore) return;
    if (!reset && !this.filesHasMore) return;

    const pageSize = 40;
    const pageToLoad = reset ? 0 : this.filesPage;
    this.filesError = null;
    if (reset) {
      this.filesLoading = true;
      this.filesHasMore = true;
    } else {
      this.filesLoadingMore = true;
    }

    this.chatService.listarMensajesPorChat(chatId, pageToLoad, pageSize).subscribe({
      next: (rows: MensajeDTO[]) => {
        const list = Array.isArray(rows) ? rows : [];
        const mapped = list
          .map((m) => this.mapMessageAttachment(m, chatId))
          .filter((item): item is UserMediaViewItem => !!item && item.kind === 'FILE');

        if (reset) {
          this.filesItems = mapped;
        } else {
          this.filesItems = this.mergeAndSortMediaItems(this.filesItems, mapped);
        }

        this.filesHasMore = list.length >= pageSize;
        this.filesPage = pageToLoad + 1;
        this.filesInitialized = true;
        this.filesLoading = false;
        this.filesLoadingMore = false;
        void this.autoPrepareLoadedItems(mapped);
        this.cdr.markForCheck();
      },
      error: () => {
        this.filesLoading = false;
        this.filesLoadingMore = false;
        this.filesInitialized = true;
        this.filesError = 'No se pudieron cargar los archivos del chat.';
        this.cdr.markForCheck();
      },
    });
  }

  private mapMessageAttachment(
    msg: MensajeDTO,
    fallbackChatId: number
  ): UserMediaViewItem | null {
    const contenidoRaw = String(msg?.contenido ?? '').trim();
    const payload = this.parseE2EEncryptedMediaPayload(contenidoRaw);
    const tipo = String(msg?.tipo || '').trim().toUpperCase();
    const kind = this.resolveMediaKind(msg, tipo, payload);
    if (!kind) return null;

    const mime = String(
      (kind === 'AUDIO'
        ? msg?.audioMime
        : kind === 'FILE'
        ? msg?.fileMime
        : kind === 'IMAGE'
        ? msg?.imageMime
        : (msg as any)?.videoMime) ||
        payload?.mediaMime ||
        ''
    ).trim();

    const durMsRaw = Number(msg?.audioDuracionMs || 0);
    const durMsFromPayload = Number(payload?.mediaDurMs || 0);
    const durMs =
      Number.isFinite(durMsRaw) && durMsRaw > 0
        ? durMsRaw
        : Number.isFinite(durMsFromPayload) && durMsFromPayload > 0
        ? durMsFromPayload
        : 0;

    const mediaUrlRaw = String(
      (kind === 'AUDIO'
        ? msg?.audioUrl
        : kind === 'FILE'
        ? msg?.fileUrl
        : kind === 'IMAGE'
        ? msg?.imageUrl
        : (msg as any)?.videoUrl) ||
        payload?.mediaUrl ||
        ''
    ).trim();

    const resolvedUrl = String(
      (kind === 'AUDIO'
        ? msg?.audioDataUrl
        : kind === 'FILE'
        ? msg?.fileDataUrl
        : kind === 'IMAGE'
        ? msg?.imageDataUrl
        : '') || ''
    ).trim();

    if (!mediaUrlRaw && !resolvedUrl) return null;

    return {
      messageId: Number(msg?.id ?? 0),
      chatId: Number(msg?.chatId ?? fallbackChatId),
      emisorId: Number(msg?.emisorId ?? 0),
      emisorNombreCompleto: `${msg?.emisorNombre || ''} ${msg?.emisorApellido || ''}`.trim(),
      fechaEnvio: String(msg?.fechaEnvio || '').trim(),
      tipo: tipo || String(kind),
      kind,
      mime,
      sizeBytes: Number(msg?.fileSizeBytes || 0) || 0,
      durMs,
      fileName: String(payload?.fileName || msg?.fileNombre || msg?.imageNombre || '').trim(),
      encrypted: !!payload,
      e2ePayload: payload,
      mediaUrlRaw,
      resolvedUrl,
      decrypting: false,
      decryptError: '',
    };
  }

  private resolveMediaKind(
    msg: MensajeDTO,
    tipo: string,
    payload: E2EEncryptedMediaPayload | null
  ): UserMediaKind | null {
    const type = String(tipo || '').trim().toUpperCase();
    if (type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO' || type === 'FILE') {
      return type as UserMediaKind;
    }

    if (String(msg?.audioUrl || '').trim()) return 'AUDIO';
    if (String(msg?.fileUrl || '').trim()) return 'FILE';
    if (String(msg?.imageUrl || '').trim()) return 'IMAGE';
    if (String((msg as any)?.videoUrl || '').trim()) return 'VIDEO';

    const payloadType = String(payload?.type || '').trim().toUpperCase();
    if (payloadType.includes('AUDIO')) return 'AUDIO';
    if (payloadType.includes('FILE')) return 'FILE';
    if (payloadType.includes('IMAGE')) return 'IMAGE';
    if (payloadType.includes('VIDEO')) return 'VIDEO';

    const m = String(payload?.mediaMime || '').trim().toLowerCase();
    if (m.startsWith('audio/')) return 'AUDIO';
    if (m.startsWith('image/')) return 'IMAGE';
    if (m.startsWith('video/')) return 'VIDEO';
    if (m) return 'FILE';

    return null;
  }

  private parseE2EEncryptedMediaPayload(raw: string): E2EEncryptedMediaPayload | null {
    if (!raw || !raw.startsWith('{')) return null;
    try {
      const payload = JSON.parse(raw);
      const type = String(payload?.type || '').trim().toUpperCase();
      if (!type.startsWith('E2E')) return null;

      const ivFile = String(payload?.ivFile || '').trim();
      const forEmisor = String(payload?.forEmisor || '').trim();
      const forAdmin = String(payload?.forAdmin || '').trim();
      const mediaUrl = String(
        payload?.audioUrl ||
          payload?.videoUrl ||
          payload?.imageUrl ||
          payload?.fileUrl ||
          payload?.mediaUrl ||
          payload?.url ||
          ''
      ).trim();
      if (!ivFile || !forEmisor || !mediaUrl) return null;

      const mapped: E2EEncryptedMediaPayload = {
        type,
        ivFile,
        mediaUrl,
        mediaMime: String(
          payload?.audioMime ||
            payload?.videoMime ||
            payload?.imageMime ||
            payload?.fileMime ||
            payload?.mediaMime ||
            ''
        ).trim() || undefined,
        mediaDurMs: Number(payload?.audioDuracionMs || payload?.durMs || 0) || undefined,
        fileName: String(
          payload?.fileNombre || payload?.fileName || payload?.nombreArchivo || ''
        ).trim() || undefined,
        forEmisor,
        forAdmin: forAdmin || undefined,
      };

      const hasMap = payload?.forReceptores && typeof payload.forReceptores === 'object';
      if (hasMap) {
        mapped.forReceptores = payload.forReceptores as Record<string, string>;
      } else {
        const forReceptor = String(payload?.forReceptor || '').trim();
        if (forReceptor) mapped.forReceptor = forReceptor;
      }

      return mapped;
    } catch {
      return null;
    }
  }

  private mergeAndSortMediaItems(
    current: UserMediaViewItem[],
    next: UserMediaViewItem[]
  ): UserMediaViewItem[] {
    const dedup = new Map<number, UserMediaViewItem>();
    for (const item of [...(current || []), ...(next || [])]) {
      if (!item || !Number.isFinite(Number(item?.messageId))) continue;
      dedup.set(Number(item.messageId), item);
    }

    return Array.from(dedup.values()).sort((a, b) => {
      const aTime = new Date(a.fechaEnvio || 0).getTime();
      const bTime = new Date(b.fechaEnvio || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.messageId) - Number(a.messageId);
    });
  }

  private async autoPrepareLoadedItems(items: UserMediaViewItem[]): Promise<void> {
    const pendingItems = (items || []).filter((i) => !!i && !i.resolvedUrl).slice(0, 8);
    if (pendingItems.length === 0) return;
    await Promise.allSettled(pendingItems.map((item) => this.prepareMedia(item, true)));
    this.cdr.markForCheck();
  }

  private buildDecryptCacheKey(item: UserMediaViewItem): string {
    const payload = item.e2ePayload;
    if (!payload) return String(item.messageId);
    return [
      String(this.currentUserId),
      String(item.messageId),
      payload.type,
      payload.ivFile,
      payload.mediaUrl,
    ].join('|');
  }
  private async decryptMediaPayloadToObjectUrl(
    item: UserMediaViewItem
  ): Promise<string | null> {
    const payload = item.e2ePayload;
    if (!payload) return null;

    const cacheKey = this.buildDecryptCacheKey(item);
    const cached = this.decryptedMediaUrlByCacheKey.get(cacheKey);
    if (cached) return cached;

    const inFlight = this.decryptingMediaByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async (): Promise<string | null> => {
      try {
        const myPrivBase64 = String(
          localStorage.getItem(`privateKey_${this.currentUserId}`) || ''
        ).trim();
        if (!myPrivBase64) return null;

        const myPrivKey = await this.cryptoService.importPrivateKey(myPrivBase64);
        const envelope = await this.resolveEnvelopeForCurrentUser(payload, item.emisorId, myPrivKey);
        if (!envelope) return null;

        const aesRawBase64 = await this.cryptoService.decryptRSA(envelope, myPrivKey);
        const aesKey = await this.cryptoService.importAESKey(aesRawBase64);
        const encryptedBlob = await this.mensajeriaService.downloadChatAttachmentBlob(
          payload.mediaUrl,
          item.chatId,
          item.messageId,
          1
        );
        const encryptedBuffer = await encryptedBlob.arrayBuffer();
        const decryptedBuffer = await this.cryptoService.decryptAESBinary(
          encryptedBuffer,
          payload.ivFile,
          aesKey
        );

        const mime =
          String(item.mime || payload.mediaMime || '').trim() ||
          (item.kind === 'AUDIO'
            ? 'audio/webm'
            : item.kind === 'VIDEO'
            ? 'video/mp4'
            : item.kind === 'IMAGE'
            ? 'image/jpeg'
            : 'application/octet-stream');

        const objectUrl = URL.createObjectURL(new Blob([decryptedBuffer], { type: mime }));
        this.decryptedMediaUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch (err: any) {
        const status = Number(err?.status || 0);
        if (status === 400 || status === 403) {
          throw err;
        }
        return null;
      } finally {
        this.decryptingMediaByCacheKey.delete(cacheKey);
      }
    })();

    this.decryptingMediaByCacheKey.set(cacheKey, promise);
    return promise;
  }

  private async downloadMediaToObjectUrl(item: UserMediaViewItem): Promise<string | null> {
    const url = String(item?.mediaUrlRaw || '').trim();
    if (!url) return null;

    const cacheKey = `plain|${Number(item?.chatId || 0)}|${Number(
      item?.messageId || 0
    )}|${url}`;
    const cached = this.decryptedMediaUrlByCacheKey.get(cacheKey);
    if (cached) return cached;

    const inFlight = this.decryptingMediaByCacheKey.get(cacheKey);
    if (inFlight) return inFlight;

    const task = (async (): Promise<string | null> => {
      try {
        const downloaded = await this.mensajeriaService.downloadChatAttachmentBlob(
          url,
          item.chatId,
          item.messageId,
          1
        );
        const mime =
          String(item?.mime || '').trim() ||
          (item.kind === 'AUDIO'
            ? 'audio/webm'
            : item.kind === 'VIDEO'
            ? 'video/mp4'
            : item.kind === 'IMAGE'
            ? 'image/jpeg'
            : 'application/octet-stream');
        const blob =
          downloaded.type && downloaded.type.trim()
            ? downloaded
            : downloaded.slice(0, downloaded.size, mime);
        const objectUrl = URL.createObjectURL(blob);
        this.decryptedMediaUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } finally {
        this.decryptingMediaByCacheKey.delete(cacheKey);
      }
    })();

    this.decryptingMediaByCacheKey.set(cacheKey, task);
    return task;
  }

  private async resolveEnvelopeForCurrentUser(
    payload: E2EEncryptedMediaPayload,
    emisorId: number,
    myPrivKey: CryptoKey
  ): Promise<string | null> {
    if (Number(emisorId) === Number(this.currentUserId)) {
      return payload.forEmisor || null;
    }

    const directReceptor = String(payload.forReceptor || '').trim();
    if (directReceptor) return directReceptor;

    const directMap = payload.forReceptores?.[String(this.currentUserId)];
    if (typeof directMap === 'string' && directMap.trim()) return directMap;

    const candidates: string[] = [];
    if (payload.forAdmin) candidates.push(payload.forAdmin);
    candidates.push(...Object.values(payload.forReceptores || {}));

    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      try {
        await this.cryptoService.decryptRSA(candidate, myPrivKey);
        return candidate;
      } catch {}
    }
    return null;
  }

  private clearDecryptedMediaUrls(): void {
    for (const url of this.decryptedMediaUrlByCacheKey.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.decryptedMediaUrlByCacheKey.clear();
    this.decryptingMediaByCacheKey.clear();
  }

  private stopCurrentAudioPlayback(): void {
    if (!this.mediaCurrentAudioEl) return;
    try {
      this.mediaCurrentAudioEl.pause();
      this.mediaCurrentAudioEl.currentTime = 0;
    } catch {}
    this.mediaCurrentAudioEl = null;
    this.mediaCurrentAudioMessageId = null;
  }
}
