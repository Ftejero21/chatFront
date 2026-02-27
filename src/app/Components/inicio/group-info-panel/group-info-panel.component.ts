import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ChatService } from '../../../Service/chat/chat.service';
import { GroupDetailDTO } from '../../../Interface/GroupDetailDTO';
import { resolveMediaUrl } from '../../../utils/chat-utils';
import { environment } from '../../../environments';
import { AuthService } from '../../../Service/auth/auth.service';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { WebSocketService } from '../../../Service/WebSocket/web-socket.service';
import { StompSubscription } from '@stomp/stompjs';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { GroupInviteService } from '../../../Service/GroupInvite/group-invite.service';
import {
  GroupMediaItemDTO,
  GroupMediaListResponseDTO,
} from '../../../Interface/GroupMediaDTO';

interface E2EEncryptedMediaPayload {
  type: string;
  ivFile: string;
  mediaUrl: string;
  mediaMime?: string;
  mediaDurMs?: number;
  forEmisor: string;
  forAdmin: string;
  forReceptor?: string;
  forReceptores?: Record<string, string>;
}

type GroupMediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';

interface GroupMediaViewItem {
  messageId: number;
  chatId: number;
  emisorId: number;
  emisorNombreCompleto: string;
  fechaEnvio: string;
  tipo: string;
  kind: GroupMediaKind;
  mime: string;
  sizeBytes: number;
  durMs: number;
  fileName: string;
  thumbUrl: string;
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

@Component({
  selector: 'app-group-info-panel',
  templateUrl: './group-info-panel.component.html',
  styleUrl: './group-info-panel.component.css',
})
export class GroupInfoPanelComponent implements OnChanges, OnDestroy {
  @Input() group: any;
  @Input() currentUserId = 0;
  @Output() closePanel = new EventEmitter<void>();
  @Output() leaveGroup = new EventEmitter<void>();

  public detail: GroupDetailDTO | null = null;
  public loading = false;
  public loadError: string | null = null;
  public isMuted = false;
  public adminBusyUserId: number | null = null;
  public editingName = false;
  public editingDescription = false;
  public draftName = '';
  public draftDescription = '';
  public savingMeta = false;
  public inviteBusy = false;
  public inviteOpen = false;
  public inviteQuery = '';
  public inviteSuccessMessage: string | null = null;
  public usuariosActivos: UsuarioDTO[] = [];
  public selectedInviteUserId: number | null = null;
  public mediaOpen = false;
  public mediaLoading = false;
  public mediaLoadingMore = false;
  public mediaInitialized = false;
  public mediaCountLoading = false;
  public mediaTotalCount: number | null = null;
  public mediaHasMore = true;
  public mediaNextCursor: string | null = null;
  public mediaError: string | null = null;
  public mediaItems: GroupMediaViewItem[] = [];
  public mediaDecryptingMessageId: number | null = null;
  public mediaAudioStates = new Map<number, PanelAudioState>();
  private memberEstadoSubs = new Map<number, StompSubscription>();
  private memberEstados = new Map<number, 'Conectado' | 'Desconectado' | 'Ausente'>();
  private decryptedMediaUrlByCacheKey = new Map<string, string>();
  private decryptingMediaByCacheKey = new Map<string, Promise<string | null>>();
  private mediaCurrentAudioEl: HTMLAudioElement | null = null;
  private mediaCurrentAudioMessageId: number | null = null;
  private inviteSuccessTimer: any = null;

  constructor(
    private chatService: ChatService,
    private groupInviteService: GroupInviteService,
    private authService: AuthService,
    private wsService: WebSocketService,
    private cryptoService: CryptoService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['group']) {
      this.editingName = false;
      this.editingDescription = false;
      this.inviteOpen = false;
      this.selectedInviteUserId = null;
      this.inviteQuery = '';
      this.inviteSuccessMessage = null;
      this.clearInviteSuccessTimer();
      this.resetMediaState();
      this.clearDecryptedMediaUrls();
      this.clearMemberEstadoSubs();
      this.memberEstados.clear();
      this.prefetchMediaCount(Number(this.group?.id));
      this.loadMedia(true);
      this.loadGroupDetail();
    }
  }

  public ngOnDestroy(): void {
    this.clearInviteSuccessTimer();
    this.clearMemberEstadoSubs();
    this.clearDecryptedMediaUrls();
  }

  public get members(): any[] {
    const list = this.detail?.miembros;
    if (Array.isArray(list) && list.length >= 0) return list;
    return Array.isArray(this.group?.usuarios) ? this.group.usuarios : [];
  }

  public get memberCount(): number {
    return this.members.length;
  }

  public get groupName(): string {
    return String(this.detail?.nombreGrupo || this.group?.nombreGrupo || this.group?.nombre || 'Grupo sin nombre');
  }

  public get groupPhoto(): string {
    const raw =
      this.detail?.fotoGrupo || this.group?.fotoGrupo || this.group?.foto || '';
    return resolveMediaUrl(raw, environment.backendBaseUrl) || 'assets/usuario.png';
  }

  public memberPhoto(m: any): string {
    const raw = m?.foto || '';
    return resolveMediaUrl(raw, environment.backendBaseUrl) || 'assets/usuario.png';
  }

  public get groupDescription(): string {
    const txt = this.rawGroupDescription;
    return txt || 'Descripción del grupo pendiente. Se mostrará cuando backend la devuelva.';
  }

  private get rawGroupDescription(): string {
    return String(this.detail?.descripcion || this.group?.descripcion || '').trim();
  }

  public get createdByLabel(): string {
    if (this.detail?.nombreCreador) return this.detail.nombreCreador;

    const creatorId = Number(this.detail?.idCreador ?? this.group?.idCreador);
    if (Number.isFinite(creatorId) && creatorId > 0) {
      const creator = this.members.find((m) => Number(m?.id) === creatorId);
      if (creator) return `${creator.nombre || ''} ${creator.apellido || ''}`.trim();
    }

    return 'No disponible';
  }

  public get createdAtLabel(): string {
    const raw =
      this.detail?.fechaCreacion ||
      this.group?.fechaCreacion ||
      this.group?.createdAt ||
      this.group?.fechaEnvio ||
      this.group?.ultimaFecha;

    if (!raw) return 'hora no disponible';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return 'hora no disponible';
    return d.toLocaleString();
  }

  public get sharedMediaCount(): number {
    const fromDetail = Number(this.detail?.mediaCount ?? this.group?.mediaCount);
    if (Number.isFinite(fromDetail) && fromDetail > 0) {
      return fromDetail;
    }
    if (Number.isFinite(Number(this.mediaTotalCount)) && Number(this.mediaTotalCount) >= 0) {
      return Number(this.mediaTotalCount);
    }
    if (this.mediaInitialized && !this.mediaHasMore) return this.mediaItems.length;
    return 0;
  }

  public get sharedMediaSubtitle(): string {
    const count = this.sharedMediaCount;
    if (count > 0) return `${count} archivos multimedia`;
    if (this.mediaCountLoading) return 'Calculando...';
    return 'Sin archivos multimedia';
  }

  public get sharedFilesCount(): number {
    return Number(this.detail?.filesCount ?? this.group?.filesCount ?? 12) || 0;
  }

  public trackMediaItem(_: number, item: GroupMediaViewItem): number {
    return Number(item?.messageId || _);
  }

  public isImageItem(item: GroupMediaViewItem): boolean {
    return item?.kind === 'IMAGE';
  }

  public isVideoItem(item: GroupMediaViewItem): boolean {
    return item?.kind === 'VIDEO';
  }

  public isAudioItem(item: GroupMediaViewItem): boolean {
    return item?.kind === 'AUDIO';
  }

  public isFileItem(item: GroupMediaViewItem): boolean {
    return item?.kind === 'FILE';
  }

  public mediaDateLabel(item: GroupMediaViewItem): string {
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

  public onMediaAudioLoadedMetadata(item: GroupMediaViewItem, audio: HTMLAudioElement): void {
    const id = Number(item?.messageId || 0);
    if (!id) return;
    const prev = this.mediaAudioStates.get(id);
    const duration = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
    this.mediaAudioStates.set(id, {
      playing: prev?.playing ?? false,
      current: prev?.current ?? 0,
      duration: duration > 0 ? duration : (prev?.duration ?? Math.max(0, Number(item?.durMs || 0))),
    });
  }

  public onMediaAudioTimeUpdate(item: GroupMediaViewItem, audio: HTMLAudioElement): void {
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

  public onMediaAudioEnded(item: GroupMediaViewItem): void {
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

  public mediaAudioProgressPercent(item: GroupMediaViewItem): number {
    const id = Number(item?.messageId || 0);
    if (!id) return 0;
    const st = this.mediaAudioStates.get(id);
    const current = Number(st?.current || 0);
    const duration = Number(st?.duration || Number(item?.durMs || 0));
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (current / duration) * 100));
  }

  public async toggleMediaAudioPlay(item: GroupMediaViewItem, audio: HTMLAudioElement): Promise<void> {
    const id = Number(item?.messageId || 0);
    if (!id) return;

    if (this.mediaCurrentAudioEl && this.mediaCurrentAudioEl !== audio) {
      try {
        this.mediaCurrentAudioEl.pause();
      } catch {}
      if (this.mediaCurrentAudioMessageId) {
        const prev = this.mediaAudioStates.get(this.mediaCurrentAudioMessageId);
        if (prev) {
          this.mediaAudioStates.set(this.mediaCurrentAudioMessageId, { ...prev, playing: false });
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
      } catch {
        // restricciones del navegador
      }
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
    if (this.mediaOpen && !this.mediaInitialized && !this.mediaLoading) {
      this.loadMedia(true);
    }
  }

  public loadMoreMedia(): void {
    this.loadMedia(false);
  }

  public async prepareMedia(item: GroupMediaViewItem, silent: boolean = false): Promise<void> {
    if (!item || item.decrypting) return;
    if (item.resolvedUrl) return;
    if (!item.encrypted || !item.e2ePayload) {
      item.decryptError = 'No hay URL disponible para este archivo.';
      return;
    }

    item.decrypting = true;
    item.decryptError = '';
    if (!silent) this.mediaDecryptingMessageId = item.messageId;

    try {
      const objectUrl = await this.decryptMediaPayloadToObjectUrl(item);
      if (!objectUrl) {
        item.decryptError = 'No se pudo descifrar en este dispositivo.';
      } else {
        item.resolvedUrl = objectUrl;
      }
    } finally {
      item.decrypting = false;
      if (!silent && this.mediaDecryptingMessageId === item.messageId) {
        this.mediaDecryptingMessageId = null;
      }
      this.cdr.markForCheck();
    }
  }

  public get groupVisibilityLabel(): string {
    return String(this.detail?.visibilidad || this.group?.visibilidad || 'PUBLICO');
  }

  public getMemberDisplayName(m: any): string {
    if (Number(m?.id) === Number(this.currentUserId)) return 'Tú';
    return `${m?.nombre || ''} ${m?.apellido || ''}`.trim() || 'Participante';
  }

  public isGroupAdmin(m: any): boolean {
    const role = String(m?.rolGrupo || '').toUpperCase();
    if (role === 'ADMIN') return true;

    const creatorId = Number(this.detail?.idCreador ?? this.group?.idCreador);
    if (Number.isFinite(creatorId) && creatorId > 0) {
      return Number(m?.id) === creatorId;
    }

    return this.members.length > 0 && Number(m?.id) === Number(this.members[0]?.id);
  }

  public isCurrentUser(m: any): boolean {
    return Number(m?.id) === Number(this.currentUserId);
  }

  public isCurrentUserAdmin(): boolean {
    const me = this.members.find((m) => Number(m?.id) === Number(this.currentUserId));
    return !!me && this.isGroupAdmin(me);
  }

  public memberStatus(m: any): string {
    const id = Number(m?.id);
    if (Number.isFinite(id) && this.memberEstados.has(id)) {
      return this.memberEstados.get(id)!;
    }
    return this.normalizeEstado(m?.estado);
  }

  public memberEstadoDotClass(m: any): string {
    const st = this.memberStatus(m);
    if (st === 'Conectado') return 'is-connected';
    if (st === 'Ausente') return 'is-away';
    return 'is-disconnected';
  }

  public memberStatusClass(m: any): string {
    const st = this.memberStatus(m);
    if (st === 'Conectado') return 'is-connected';
    if (st === 'Ausente') return 'is-away';
    return 'is-disconnected';
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
  }

  public get adminOnlyHint(): string {
    return this.isCurrentUserAdmin()
      ? ''
      : 'Solo los administradores del grupo pueden realizar esta acción.';
  }

  public get canSaveMeta(): boolean {
    if (!this.isCurrentUserAdmin() || this.savingMeta) return false;
    const name = this.draftName.trim();
    const description = this.draftDescription.trim();
    return !!name && (name !== this.groupName || description !== this.rawGroupDescription);
  }

  public get canSendInvite(): boolean {
    return this.isCurrentUserAdmin() && !this.inviteBusy && !!this.selectedInviteUserId;
  }

  public get inviteCandidates(): UsuarioDTO[] {
    const q = this.inviteQuery.trim().toLowerCase();
    const memberIds = new Set((this.members || []).map((m: any) => Number(m?.id)));
    return (this.usuariosActivos || [])
      .filter((u) => !memberIds.has(Number(u?.id)))
      .filter((u) => {
        if (!q) return true;
        const nombre = `${u?.nombre || ''} ${u?.apellido || ''}`.toLowerCase();
        const email = String(u?.email || '').toLowerCase();
        return nombre.includes(q) || email.includes(q);
      })
      .slice(0, 30);
  }

  public startEditName(): void {
    if (!this.isCurrentUserAdmin()) return;
    this.editingName = true;
    this.draftName = this.groupName;
  }

  public startEditDescription(): void {
    if (!this.isCurrentUserAdmin()) return;
    this.editingDescription = true;
    this.draftDescription = this.rawGroupDescription;
  }

  public cancelEditName(): void {
    this.editingName = false;
    this.draftName = this.groupName;
  }

  public cancelEditDescription(): void {
    this.editingDescription = false;
    this.draftDescription = this.rawGroupDescription;
  }

  public saveGroupMeta(): void {
    if (!this.canSaveMeta) return;
    const groupId = Number(this.group?.id || this.detail?.id);
    if (!groupId) return;

    this.savingMeta = true;
    this.loadError = null;
    this.chatService
      .actualizarGrupo(groupId, {
        nombreGrupo: this.draftName.trim(),
        descripcion: this.draftDescription.trim(),
      })
      .subscribe({
        next: () => {
          this.savingMeta = false;
          this.editingName = false;
          this.editingDescription = false;
          this.loadGroupDetail();
        },
        error: (err) => {
          this.savingMeta = false;
          this.loadError = err?.error?.mensaje || 'No se pudo actualizar la información del grupo.';
        },
      });
  }

  public onGroupPhotoSelected(event: Event): void {
    if (!this.isCurrentUserAdmin()) return;
    const groupId = Number(this.group?.id || this.detail?.id);
    if (!groupId) return;

    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.loadError = 'Selecciona una imagen válida.';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.loadError = 'La imagen supera 5MB.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fotoGrupo = String(reader.result || '');
      this.savingMeta = true;
      this.loadError = null;
      this.chatService.actualizarGrupo(groupId, { fotoGrupo }).subscribe({
        next: () => {
          this.savingMeta = false;
          this.loadGroupDetail();
          input.value = '';
        },
        error: (err) => {
          this.savingMeta = false;
          this.loadError = err?.error?.mensaje || 'No se pudo actualizar la foto del grupo.';
          input.value = '';
        },
      });
    };
    reader.readAsDataURL(file);
  }

  public openInvitePanel(): void {
    if (!this.isCurrentUserAdmin()) return;
    this.inviteOpen = !this.inviteOpen;
    this.loadError = null;
    if (!this.inviteOpen) return;
    if (this.usuariosActivos.length > 0) return;

    this.authService.listarActivos().subscribe({
      next: (users) => {
        this.usuariosActivos = users || [];
      },
      error: (err) => {
        this.loadError = err?.error?.mensaje || 'No se pudieron cargar usuarios para invitar.';
      },
    });
  }

  public sendInvite(): void {
    if (!this.canSendInvite) return;
    const groupId = Number(this.group?.id || this.detail?.id);
    const userId = Number(this.selectedInviteUserId);
    if (!groupId || !userId) return;
    const invitee = (this.usuariosActivos || []).find(
      (u) => Number(u?.id) === userId
    );
    const inviteeLabel =
      `${invitee?.nombre || ''} ${invitee?.apellido || ''}`.trim() ||
      `Usuario ${userId}`;

    this.inviteBusy = true;
    this.loadError = null;
    this.inviteSuccessMessage = null;
    this.clearInviteSuccessTimer();

    this.groupInviteService
      .create(groupId, userId)
      .subscribe({
        next: () => {
          this.inviteBusy = false;
          this.selectedInviteUserId = null;
          this.inviteQuery = '';
          this.inviteOpen = false;
          this.inviteSuccessMessage = `Invitacion enviada a ${inviteeLabel}.`;
          this.inviteSuccessTimer = setTimeout(() => {
            this.inviteSuccessMessage = null;
            this.inviteSuccessTimer = null;
            this.cdr.markForCheck();
          }, 3600);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.inviteBusy = false;
          const status = Number(err?.status || 0);
          if (status === 403) {
            this.loadError = 'No tienes permisos para invitar en este grupo.';
            return;
          }
          if (status === 404) {
            this.loadError = 'Grupo o usuario no encontrado.';
            return;
          }
          if (status === 409) {
            this.loadError = 'Ese usuario ya pertenece al grupo o ya tiene invitacion pendiente.';
            return;
          }
          if (status === 400) {
            this.loadError = 'La invitacion no es valida para ese usuario.';
            return;
          }
          this.loadError = err?.error?.mensaje || 'No se pudo enviar la invitacion.';
        },
      });
  }

  public toggleAdmin(m: any): void {
    const groupId = Number(this.group?.id || this.detail?.id);
    const userId = Number(m?.id);
    if (!groupId || !userId) return;
    if (this.adminBusyUserId != null) return;

    this.adminBusyUserId = userId;
    const req$ = this.isGroupAdmin(m)
      ? this.chatService.quitarAdminGrupo(groupId, userId)
      : this.chatService.asignarAdminGrupo(groupId, userId);

    req$.subscribe({
      next: () => {
        this.adminBusyUserId = null;
        this.loadGroupDetail();
      },
      error: (err) => {
        this.adminBusyUserId = null;
        this.loadError = err?.error?.mensaje || 'No se pudo actualizar el rol admin.';
      },
    });
  }

  public onClose(): void {
    this.closePanel.emit();
  }

  public onLeaveGroup(): void {
    this.leaveGroup.emit();
  }

  private clearInviteSuccessTimer(): void {
    if (!this.inviteSuccessTimer) return;
    clearTimeout(this.inviteSuccessTimer);
    this.inviteSuccessTimer = null;
  }

  private resetMediaState(): void {
    this.mediaOpen = false;
    this.mediaLoading = false;
    this.mediaLoadingMore = false;
    this.mediaInitialized = false;
    this.mediaCountLoading = false;
    this.mediaTotalCount = null;
    this.mediaHasMore = true;
    this.mediaNextCursor = null;
    this.mediaError = null;
    this.mediaItems = [];
    this.mediaDecryptingMessageId = null;
    this.mediaAudioStates.clear();
    this.mediaCurrentAudioEl = null;
    this.mediaCurrentAudioMessageId = null;
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

  private loadMedia(reset: boolean): void {
    const groupId = Number(this.group?.id || this.detail?.id);
    if (!groupId) return;
    if (this.mediaLoading || this.mediaLoadingMore) return;
    if (!reset && !this.mediaHasMore) return;

    this.mediaError = null;
    if (reset) {
      this.mediaLoading = true;
      this.mediaNextCursor = null;
      this.mediaHasMore = true;
    } else {
      this.mediaLoadingMore = true;
    }

    this.chatService
      .listarMediaGrupo(groupId, reset ? null : this.mediaNextCursor, 30, [
        'AUDIO',
      ])
      .subscribe({
        next: (res: GroupMediaListResponseDTO) => {
          const itemsRaw = Array.isArray((res as any)?.items)
            ? (res as any).items
            : [];
          const mapped = itemsRaw
            .map((it: GroupMediaItemDTO) => this.mapMediaItem(it, groupId))
            .filter((it: GroupMediaViewItem) => it.kind === 'AUDIO');

          if (reset) {
            this.mediaItems = mapped;
          } else {
            const merged = [...this.mediaItems, ...mapped];
            const dedup = new Map<number, GroupMediaViewItem>();
            for (const item of merged) {
              if (!Number.isFinite(Number(item?.messageId))) continue;
              dedup.set(Number(item.messageId), item);
            }
            this.mediaItems = Array.from(dedup.values()).sort((a, b) => {
              const aTime = new Date(a.fechaEnvio || 0).getTime();
              const bTime = new Date(b.fechaEnvio || 0).getTime();
              if (bTime !== aTime) return bTime - aTime;
              return Number(b.messageId) - Number(a.messageId);
            });
          }

          const nextCursor = String((res as any)?.nextCursor || '').trim();
          const hasMoreFromBack = !!(res as any)?.hasMore;
          this.mediaNextCursor = nextCursor || null;
          this.mediaHasMore = hasMoreFromBack || !!nextCursor;
          this.mediaInitialized = true;
          if (!this.mediaHasMore) {
            this.mediaTotalCount = this.mediaItems.length;
          }
          this.mediaLoading = false;
          this.mediaLoadingMore = false;
          void this.autoDecryptLoadedItems(mapped);
          this.cdr.markForCheck();
        },
          error: (err) => {
            this.mediaLoading = false;
            this.mediaLoadingMore = false;
            this.mediaInitialized = true;
          this.mediaError =
            err?.error?.mensaje || 'No se pudo cargar la multimedia del grupo.';
          this.cdr.markForCheck();
        },
      });
  }

  private async autoDecryptLoadedItems(items: GroupMediaViewItem[]): Promise<void> {
    const encryptedItems = (items || []).filter(
      (i) => !!i?.encrypted && !!i?.e2ePayload && !i?.resolvedUrl
    );
    if (encryptedItems.length === 0) return;

    await Promise.allSettled(
      encryptedItems.map((item) => this.prepareMedia(item, true))
    );
    this.cdr.markForCheck();
  }

  private prefetchMediaCount(groupIdRaw?: number): void {
    const groupId = Number(groupIdRaw || this.group?.id || this.detail?.id);
    if (!groupId) return;
    if (this.mediaCountLoading) return;
    if (Number.isFinite(Number(this.mediaTotalCount)) && Number(this.mediaTotalCount) >= 0) return;

    this.mediaCountLoading = true;
    let total = 0;
    const maxPages = 40;

    const step = (cursor: string | null, page: number) => {
      this.chatService
        .listarMediaGrupo(groupId, cursor, 50, ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'])
        .subscribe({
          next: (res: GroupMediaListResponseDTO) => {
            const items = Array.isArray((res as any)?.items) ? (res as any).items : [];
            total += items.length;
            const nextCursor = String((res as any)?.nextCursor || '').trim();
            const hasMore = !!(res as any)?.hasMore || !!nextCursor;

            if (hasMore && nextCursor && page < maxPages) {
              step(nextCursor, page + 1);
              return;
            }

            this.mediaTotalCount = total;
            this.mediaCountLoading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.mediaCountLoading = false;
            this.cdr.markForCheck();
          },
        });
    };

    step(null, 1);
  }

  private mapMediaItem(raw: GroupMediaItemDTO, fallbackChatId: number): GroupMediaViewItem {
    const contenidoRaw = String(raw?.contenidoRaw ?? raw?.contenido ?? '').trim();
    const payload = this.parseE2EEncryptedMediaPayload(contenidoRaw);
    const tipo = String(raw?.tipo || '').trim().toUpperCase();
    const kind = this.resolveMediaKind(tipo, String(raw?.mime || ''), payload);
    const mime = String(raw?.mime || payload?.mediaMime || '').trim();
    const durMsRaw = Number(raw?.durMs);
    const durMsFromPayload = Number(payload?.mediaDurMs);
    const durMs = Number.isFinite(durMsRaw) && durMsRaw > 0
      ? durMsRaw
      : Number.isFinite(durMsFromPayload) && durMsFromPayload > 0
      ? durMsFromPayload
      : 0;

    const mediaUrlRaw =
      String(raw?.mediaUrl || raw?.audioUrl || payload?.mediaUrl || '').trim();

    const resolvedPlainUrl =
      !payload && mediaUrlRaw
        ? resolveMediaUrl(mediaUrlRaw, environment.backendBaseUrl) || mediaUrlRaw
        : '';

    return {
      messageId: Number(raw?.messageId ?? 0),
      chatId: Number(raw?.chatId ?? fallbackChatId),
      emisorId: Number(raw?.emisorId ?? 0),
      emisorNombreCompleto: String(raw?.emisorNombreCompleto || '').trim(),
      fechaEnvio: String(raw?.fechaEnvio || '').trim(),
      tipo: tipo || String(kind),
      kind,
      mime,
      sizeBytes: Number(raw?.sizeBytes || 0) || 0,
      durMs,
      fileName: String(raw?.fileName || '').trim(),
      thumbUrl: resolveMediaUrl(String(raw?.thumbUrl || ''), environment.backendBaseUrl) || '',
      encrypted: !!payload,
      e2ePayload: payload,
      mediaUrlRaw,
      resolvedUrl: resolvedPlainUrl,
      decrypting: false,
      decryptError: '',
    };
  }

  private resolveMediaKind(
    tipo: string,
    mime: string,
    payload: E2EEncryptedMediaPayload | null
  ): GroupMediaKind {
    const type = String(tipo || '').trim().toUpperCase();
    if (type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO' || type === 'FILE') {
      return type as GroupMediaKind;
    }

    const m = String(mime || payload?.mediaMime || '').trim().toLowerCase();
    if (m.startsWith('image/')) return 'IMAGE';
    if (m.startsWith('video/')) return 'VIDEO';
    if (m.startsWith('audio/')) return 'AUDIO';
    return 'FILE';
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
      if (!ivFile || !forEmisor || !forAdmin || !mediaUrl) return null;

      const mapped: E2EEncryptedMediaPayload = {
        type: type as E2EEncryptedMediaPayload['type'],
        ivFile,
        mediaUrl,
        mediaMime: String(payload?.audioMime || payload?.mediaMime || '').trim() || undefined,
        mediaDurMs: Number(payload?.audioDuracionMs || payload?.durMs || 0) || undefined,
        forEmisor,
        forAdmin,
      };

      const hasGroupMap =
        payload?.forReceptores && typeof payload.forReceptores === 'object';
      if (hasGroupMap) {
        const map = payload?.forReceptores;
        mapped.forReceptores = map as Record<string, string>;
      } else {
        const forReceptor = String(payload?.forReceptor || '').trim();
        if (!forReceptor) return null;
        mapped.forReceptor = forReceptor;
      }
      return mapped;
    } catch {
      return null;
    }
  }

  private buildDecryptCacheKey(item: GroupMediaViewItem): string {
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
    item: GroupMediaViewItem
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
        const encryptedUrl = resolveMediaUrl(payload.mediaUrl, environment.backendBaseUrl);
        if (!encryptedUrl) return null;

        const response = await fetch(encryptedUrl);
        if (!response.ok) return null;

        const encryptedBuffer = await response.arrayBuffer();
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

        const objectUrl = URL.createObjectURL(
          new Blob([decryptedBuffer], { type: mime })
        );
        this.decryptedMediaUrlByCacheKey.set(cacheKey, objectUrl);
        return objectUrl;
      } catch {
        return null;
      } finally {
        this.decryptingMediaByCacheKey.delete(cacheKey);
      }
    })();

    this.decryptingMediaByCacheKey.set(cacheKey, promise);
    return promise;
  }

  private async resolveEnvelopeForCurrentUser(
    payload: E2EEncryptedMediaPayload,
    emisorId: number,
    myPrivKey: CryptoKey
  ): Promise<string | null> {
    if (Number(emisorId) === Number(this.currentUserId)) {
      return payload.forEmisor || null;
    }

    if (!payload.forReceptores) {
      return payload.forReceptor || null;
    }

    const direct = payload.forReceptores?.[String(this.currentUserId)];
    if (typeof direct === 'string' && direct.trim()) return direct;

    const candidates = Object.values(payload.forReceptores || {});
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      try {
        await this.cryptoService.decryptRSA(candidate, myPrivKey);
        return candidate;
      } catch {
        // Intenta el siguiente sobre
      }
    }
    return null;
  }

  private loadGroupDetail(): void {
    const groupId = Number(this.group?.id);
    if (!groupId) {
      this.detail = null;
      return;
    }

    this.loading = true;
    this.loadError = null;
    this.chatService.obtenerDetalleGrupo(groupId).subscribe({
      next: (res) => {
        this.detail = res;
        this.draftName = this.groupName;
        this.draftDescription = this.rawGroupDescription;
        this.loading = false;
        this.hydrateMemberEstados();
        if (
          !this.mediaCountLoading &&
          !Number.isFinite(Number(this.mediaTotalCount))
        ) {
          this.prefetchMediaCount(groupId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.mediaCountLoading = false;
        this.detail = null;
        this.loadError = err?.error?.mensaje || 'No se pudo cargar el detalle del grupo.';
      },
    });
  }

  private normalizeEstado(value: unknown): 'Conectado' | 'Desconectado' | 'Ausente' {
    const s = String(value || '').trim().toLowerCase();
    if (s === 'conectado') return 'Conectado';
    if (s === 'ausente') return 'Ausente';
    return 'Desconectado';
  }

  private hydrateMemberEstados(): void {
    const ids = this.members
      .map((m: any) => Number(m?.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return;

    for (const m of this.members) {
      const id = Number(m?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      this.memberEstados.set(id, this.normalizeEstado(m?.estado));
    }

    this.chatService.obtenerEstadosDeUsuarios(ids).subscribe({
      next: (mapa: Record<number, boolean>) => {
        for (const id of ids) {
          const conectado = !!mapa?.[id];
          const current = this.memberEstados.get(id);
          if (current === 'Ausente') continue;
          this.memberEstados.set(id, conectado ? 'Conectado' : 'Desconectado');
        }
        this.cdr.markForCheck();
      },
      error: () => {},
    });

    this.wsService.esperarConexion(() => {
      for (const id of ids) {
        if (this.memberEstadoSubs.has(id)) continue;
        const sub = this.wsService.suscribirseAEstado(id, (estadoRaw: string) => {
          const estado = this.normalizeEstado(estadoRaw);
          this.ngZone.run(() => {
            this.memberEstados.set(id, estado);
            this.cdr.markForCheck();
          });
        });
        if (sub) this.memberEstadoSubs.set(id, sub);
      }
    });
  }

  private clearMemberEstadoSubs(): void {
    this.memberEstadoSubs.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch {}
    });
    this.memberEstadoSubs.clear();
  }
}


