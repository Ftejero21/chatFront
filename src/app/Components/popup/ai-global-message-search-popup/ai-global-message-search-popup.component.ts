import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { AiEncryptedMessageSearchResult } from '../../../Interface/AiEncryptedMessageSearchDTO';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { clampPercent, formatDuration, parseAudioDurationMs } from '../../../utils/chat-utils';

type SearchResultMessageType = 'TEXT' | 'AUDIO' | 'IMAGE' | 'STICKER' | 'FILE' | 'UNKNOWN';
type SearchImagePayload =
  | {
      type: 'E2E_IMAGE';
      ivFile: string;
      imageUrl: string;
      imageMime?: string;
      imageNombre?: string;
      forEmisor: string;
      forAdmin: string;
      forReceptor: string;
    }
  | {
      type: 'E2E_GROUP_IMAGE';
      ivFile: string;
      imageUrl: string;
      imageMime?: string;
      imageNombre?: string;
      forEmisor: string;
      forAdmin: string;
      forReceptores: Record<string, string>;
    };
type SearchAudioPayload =
  | {
      type: 'E2E_AUDIO';
      ivFile: string;
      audioUrl: string;
      audioMime?: string;
      audioDuracionMs?: number;
      forEmisor: string;
      forAdmin: string;
      forReceptor: string;
    }
  | {
      type: 'E2E_GROUP_AUDIO';
      ivFile: string;
      audioUrl: string;
      audioMime?: string;
      audioDuracionMs?: number;
      forEmisor: string;
      forAdmin: string;
      forReceptores: Record<string, string>;
    };

@Component({
  selector: 'app-ai-global-message-search-popup',
  templateUrl: './ai-global-message-search-popup.component.html',
  styleUrls: ['./ai-global-message-search-popup.component.css'],
})
export class AiGlobalMessageSearchPopupComponent implements OnChanges, OnDestroy {
  private readonly mediaLoadErrors = new Set<string>();
  private readonly hydratedMediaUrls = new Map<string, string>();
  private readonly hydratingMediaKeys = new Set<string>();
  private currentPlayingResultId: number | null = null;
  public readonly audioStates = new Map<number, { playing: boolean; current: number; duration: number }>();

  @Input() open = false;
  @Input() loading = false;
  @Input() consulta = '';
  @Input() error: string | null = null;
  @Input() resumenBusqueda: string | null = null;
  @Input() resultados: AiEncryptedMessageSearchResult[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() consultaChange = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<string>();
  @Output() resultSelected = new EventEmitter<AiEncryptedMessageSearchResult>();

  public constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly mensajeriaService: MensajeriaService,
    private readonly cryptoService: CryptoService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['resultados']) this.hydrateVisibleResultAssets();
  }

  public ngOnDestroy(): void {
    this.pauseAllResultAudios();
    for (const url of this.hydratedMediaUrls.values()) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    this.hydratedMediaUrls.clear();
  }

  public onBackdropClick(): void {
    if (this.loading) return;
    this.closed.emit();
  }

  public onClose(): void {
    if (this.loading) return;
    this.closed.emit();
  }

  public onConsultaChange(next: string): void {
    this.consultaChange.emit(String(next || ''));
  }

  public onSubmit(): void {
    if (this.loading) return;
    const normalized = String(this.consulta || '').trim();
    if (!normalized) return;
    this.submitted.emit(normalized);
  }

  public onSelectResult(item: AiEncryptedMessageSearchResult): void {
    if (this.loading) return;
    this.resultSelected.emit(item);
  }

  public onResultCardKeydown(event: KeyboardEvent, item: AiEncryptedMessageSearchResult): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    this.onSelectResult(item);
  }

  public resolveResultMessageType(item: AiEncryptedMessageSearchResult): SearchResultMessageType {
    const explicitType = String(item?.tipoMensaje || '').trim().toUpperCase();
    if (this.isKnownMessageType(explicitType)) return explicitType;

    const contentKind = String(item?.contentKind || '').trim().toUpperCase();
    if (contentKind === 'STICKER') return 'STICKER';

    const mimeType = String(item?.mimeType || '').trim().toLowerCase();
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.startsWith('image/')) return 'IMAGE';

    if (String(item?.contenido || '').trim()) return 'TEXT';
    return 'UNKNOWN';
  }

  public getResultTextContent(item: AiEncryptedMessageSearchResult): string {
    return String(item?.contenido || item?.contenidoVisible || '').trim();
  }

  public getResultMediaUrl(item: AiEncryptedMessageSearchResult): string {
    if (this.hasMediaLoadError(item)) return '';
    return String(this.hydratedMediaUrls.get(this.getMediaKey(item)) || '').trim();
  }

  public isHydratingResultMedia(item: AiEncryptedMessageSearchResult): boolean {
    return this.hydratingMediaKeys.has(this.getMediaKey(item));
  }

  public getResultImageFallback(item: AiEncryptedMessageSearchResult): string {
    return String(item?.contenidoVisible || '').trim() || '[Imagen]';
  }

  public getResultStickerFallback(item: AiEncryptedMessageSearchResult): string {
    return String(item?.contenidoVisible || '').trim() || '[Sticker]';
  }

  public getResultAudioFallback(item: AiEncryptedMessageSearchResult): string {
    return String(item?.contenidoVisible || '').trim() || '[Audio]';
  }

  public isResultMine(item: AiEncryptedMessageSearchResult): boolean {
    return Number(item?.emisorId || 0) === this.getCurrentUserId();
  }

  public getResultAudioSrc(item: AiEncryptedMessageSearchResult): string {
    if (this.hasMediaLoadError(item)) return '';
    return String(this.hydratedMediaUrls.get(this.getMediaKey(item)) || '').trim();
  }

  public getResultAudioProgressPercent(item: AiEncryptedMessageSearchResult): number {
    const id = Number(item?.mensajeId || 0);
    const state = this.audioStates.get(id);
    return clampPercent(state?.current ?? 0, state?.duration ?? 0);
  }

  public getResultAudioTimeLabel(item: AiEncryptedMessageSearchResult): string {
    const id = Number(item?.mensajeId || 0);
    const state = this.audioStates.get(id);
    if ((state?.current || 0) > 0) return formatDuration((state?.current || 0) * 1000);
    if ((state?.duration || 0) > 0) return formatDuration((state?.duration || 0) * 1000);
    const inferredMs =
      parseAudioDurationMs(item?.contenidoVisible) ||
      parseAudioDurationMs(item?.descripcionTipoMensaje) ||
      0;
    return formatDuration(inferredMs);
  }

  public onResultAudioLoadedMetadata(
    item: AiEncryptedMessageSearchResult,
    audio: HTMLAudioElement
  ): void {
    const id = Number(item?.mensajeId || 0);
    if (!Number.isFinite(id) || id <= 0) return;
    const duration = isFinite(audio.duration) ? Math.max(0, Math.floor(audio.duration)) : 0;
    const previous = this.audioStates.get(id);
    this.audioStates.set(id, {
      playing: previous?.playing ?? false,
      current: previous?.current ?? 0,
      duration,
    });
    this.cdr.markForCheck();
  }

  public onResultAudioTimeUpdate(
    item: AiEncryptedMessageSearchResult,
    audio: HTMLAudioElement
  ): void {
    const id = Number(item?.mensajeId || 0);
    if (!Number.isFinite(id) || id <= 0) return;
    const state = this.audioStates.get(id) || { playing: false, current: 0, duration: 0 };
    this.audioStates.set(id, { ...state, current: Math.floor(audio.currentTime || 0) });
    this.cdr.markForCheck();
  }

  public onResultAudioEnded(item: AiEncryptedMessageSearchResult): void {
    const id = Number(item?.mensajeId || 0);
    if (!Number.isFinite(id) || id <= 0) return;
    const state = this.audioStates.get(id) || { playing: false, current: 0, duration: 0 };
    this.audioStates.set(id, { ...state, playing: false, current: state.duration });
    if (this.currentPlayingResultId === id) this.currentPlayingResultId = null;
    this.cdr.markForCheck();
  }

  public toggleResultAudio(
    item: AiEncryptedMessageSearchResult,
    audio: HTMLAudioElement,
    event: Event
  ): void {
    this.stopResultNavigation(event);
    const src = this.getResultAudioSrc(item);
    if (!src) return;

    const id = Number(item?.mensajeId || 0);
    if (!Number.isFinite(id) || id <= 0) return;
    const state = this.audioStates.get(id) || { playing: false, current: 0, duration: 0 };

    if (state.playing) {
      audio.pause();
      this.audioStates.set(id, { ...state, playing: false });
      if (this.currentPlayingResultId === id) this.currentPlayingResultId = null;
      this.cdr.markForCheck();
      return;
    }

    this.pauseAllResultAudios();
    if (isNaN(audio.duration) || !isFinite(audio.duration)) {
      try {
        audio.load();
      } catch {}
    }

    void audio.play().then(() => {
      const duration = isFinite(audio.duration) ? Math.max(0, Math.floor(audio.duration)) : state.duration;
      this.audioStates.set(id, {
        playing: true,
        current: Math.floor(audio.currentTime || 0),
        duration,
      });
      this.currentPlayingResultId = id;
      this.cdr.markForCheck();
    }).catch(() => {
      this.audioStates.set(id, { ...state, playing: false });
      this.cdr.markForCheck();
    });
  }

  public getResultFileFallback(item: AiEncryptedMessageSearchResult): string {
    return String(item?.contenidoVisible || '').trim() || '[Archivo]';
  }

  public getResultFileName(item: AiEncryptedMessageSearchResult): string {
    return String(item?.nombreArchivo || '').trim() || this.getResultFileFallback(item);
  }

  public stopResultNavigation(event: Event): void {
    event.stopPropagation();
  }

  public onResultMediaError(item: AiEncryptedMessageSearchResult, event: Event): void {
    this.mediaLoadErrors.add(this.getMediaKey(item));
    console.error('[ai-search-popup][media][img-error]', {
      mensajeId: Number(item?.mensajeId || 0),
      chatId: Number(item?.chatId || 0),
      tipo: this.resolveResultMessageType(item),
      renderedUrl: this.getResultMediaUrl(item),
      rawUrl: String(item?.mediaUrl || '').trim(),
    });
    event.stopPropagation();
  }

  public get canSubmit(): boolean {
    return !this.loading && !!String(this.consulta || '').trim();
  }

  public get hasResumenBusqueda(): boolean {
    return !!String(this.resumenBusqueda || '').trim();
  }

  private isKnownMessageType(value: string): value is SearchResultMessageType {
    return (
      value === 'TEXT' ||
      value === 'AUDIO' ||
      value === 'IMAGE' ||
      value === 'STICKER' ||
      value === 'FILE' ||
      value === 'UNKNOWN'
    );
  }

  private hasMediaLoadError(item: AiEncryptedMessageSearchResult): boolean {
    return this.mediaLoadErrors.has(this.getMediaKey(item));
  }

  private pauseAllResultAudios(): void {
    const audios = this.host.nativeElement.querySelectorAll<HTMLAudioElement>('audio[data-ai-search-audio="true"]');
    audios.forEach((audio) => {
      try {
        audio.pause();
      } catch {}
    });
    if (this.currentPlayingResultId != null) {
      const state = this.audioStates.get(this.currentPlayingResultId);
      if (state) this.audioStates.set(this.currentPlayingResultId, { ...state, playing: false });
    }
    this.currentPlayingResultId = null;
  }

  private getMediaKey(item: AiEncryptedMessageSearchResult): string {
    const type = this.resolveResultMessageType(item);
    return `${Number(item?.mensajeId || 0)}::${type}::${this.getPreferredAssetUrl(item, type)}`;
  }

  private hydrateVisibleResultAssets(): void {
    for (const item of this.resultados || []) {
      const type = this.resolveResultMessageType(item);
      if (type !== 'IMAGE' && type !== 'STICKER' && type !== 'AUDIO') continue;

      const rawUrl = this.getPreferredAssetUrl(item, type);
      const key = this.getMediaKey(item);
      if (!rawUrl || this.hydratedMediaUrls.has(key) || this.hydratingMediaKeys.has(key)) continue;

      const chatId = Number(item?.chatId || 0);
      const mensajeId = Number(item?.mensajeId || 0);
      if (!Number.isFinite(chatId) || chatId <= 0 || !Number.isFinite(mensajeId) || mensajeId <= 0) {
        console.error('[ai-search-popup][media][invalid-context]', {
          mensajeId,
          chatId,
          tipo: type,
          rawUrl,
        });
        continue;
      }

      this.hydratingMediaKeys.add(key);
      void this.mensajeriaService
        .downloadChatAttachmentBlob(rawUrl, chatId, mensajeId, 1)
        .then(async (blob) => {
          const imagePayload = type === 'IMAGE' || type === 'STICKER'
            ? this.parseImageE2EPayload(this.getAttachmentPayloadSource(item))
            : null;
          const audioPayload = type === 'AUDIO'
            ? this.parseAudioE2EPayload(this.getAttachmentPayloadSource(item))
            : null;
          const safeBlob = imagePayload
            ? await this.decryptImageBlobFromPayload(blob, imagePayload, item)
            : audioPayload
              ? await this.decryptAudioBlobFromPayload(blob, audioPayload, item)
              : this.normalizeAssetBlobMime(blob, item, type);
          if (type === 'IMAGE' || type === 'STICKER') {
            await this.assertRenderableImageBlob(safeBlob, {
              mensajeId,
              chatId,
              rawUrl,
              mimeType: this.getPreferredAssetMime(item, type),
              tipo: type,
            });
          }
          const objectUrl = URL.createObjectURL(safeBlob);
          const previous = this.hydratedMediaUrls.get(key);
          if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
          this.hydratedMediaUrls.set(key, objectUrl);
          this.mediaLoadErrors.delete(key);
          this.cdr.markForCheck();
        })
        .catch(() => {
          this.hydratedMediaUrls.delete(key);
          this.cdr.markForCheck();
        })
        .finally(() => {
          this.hydratingMediaKeys.delete(key);
          this.cdr.markForCheck();
        });
    }
  }

  private getPreferredAssetUrl(
    item: AiEncryptedMessageSearchResult,
    type: SearchResultMessageType
  ): string {
    if (type === 'AUDIO') {
      const payload = this.parseAudioE2EPayload(this.getAttachmentPayloadSource(item));
      return String(payload?.audioUrl || item?.mediaUrl || '').trim();
    }
    const payload = this.parseImageE2EPayload(this.getAttachmentPayloadSource(item));
    return String(payload?.imageUrl || item?.imageUrl || item?.mediaUrl || '').trim();
  }

  private getPreferredAssetMime(
    item: AiEncryptedMessageSearchResult,
    type: SearchResultMessageType
  ): string {
    if (type === 'AUDIO') {
      const payload = this.parseAudioE2EPayload(this.getAttachmentPayloadSource(item));
      return String(payload?.audioMime || item?.mimeType || 'audio/webm').trim();
    }
    const payload = this.parseImageE2EPayload(this.getAttachmentPayloadSource(item));
    return String(payload?.imageMime || item?.imageMime || item?.mimeType || '').trim();
  }

  private getAttachmentPayloadSource(item: AiEncryptedMessageSearchResult): unknown {
    return item?.contenidoPayloadOriginal ?? item?.contenido;
  }

  private normalizeAssetBlobMime(
    blob: Blob,
    item: AiEncryptedMessageSearchResult,
    type: SearchResultMessageType
  ): Blob {
    const mimeType = this.getPreferredAssetMime(item, type);
    const shouldOverrideMime =
      !!mimeType &&
      (type === 'IMAGE' || type === 'STICKER' || type === 'AUDIO') &&
      (!blob.type || blob.type === 'application/octet-stream');
    return shouldOverrideMime
      ? blob.slice(0, blob.size, mimeType)
      : !blob.type && mimeType
        ? blob.slice(0, blob.size, mimeType)
      : blob;
  }

  private parseAudioE2EPayload(contenido: unknown): SearchAudioPayload | null {
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
    if (payloadType !== 'E2E_AUDIO' && payloadType !== 'E2E_GROUP_AUDIO') return null;
    if (typeof payload?.ivFile !== 'string' || !payload.ivFile.trim()) return null;
    if (typeof payload?.forEmisor !== 'string' || !payload.forEmisor.trim()) return null;
    if (typeof payload?.forAdmin !== 'string' || !payload.forAdmin.trim()) return null;

    if (payloadType === 'E2E_AUDIO') {
      if (typeof payload?.forReceptor !== 'string' || !payload.forReceptor.trim()) return null;
      return {
        type: 'E2E_AUDIO',
        ivFile: payload.ivFile,
        audioUrl: String(payload?.audioUrl || ''),
        audioMime: typeof payload?.audioMime === 'string' ? payload.audioMime : undefined,
        audioDuracionMs: Number.isFinite(Number(payload?.audioDuracionMs)) ? Number(payload.audioDuracionMs) : undefined,
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
      audioDuracionMs: Number.isFinite(Number(payload?.audioDuracionMs)) ? Number(payload.audioDuracionMs) : undefined,
      forEmisor: payload.forEmisor,
      forAdmin: payload.forAdmin,
      forReceptores,
    };
  }

  private parseImageE2EPayload(contenido: unknown): SearchImagePayload | null {
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
    if (payloadType !== 'E2E_IMAGE' && payloadType !== 'E2E_GROUP_IMAGE') return null;
    if (typeof payload?.ivFile !== 'string' || !payload.ivFile.trim()) return null;
    if (typeof payload?.forEmisor !== 'string' || !payload.forEmisor.trim()) return null;
    if (typeof payload?.forAdmin !== 'string' || !payload.forAdmin.trim()) return null;

    if (payloadType === 'E2E_IMAGE') {
      if (typeof payload?.forReceptor !== 'string' || !payload.forReceptor.trim()) return null;
      return {
        type: 'E2E_IMAGE',
        ivFile: payload.ivFile,
        imageUrl: String(payload?.imageUrl || ''),
        imageMime: typeof payload?.imageMime === 'string' ? payload.imageMime : undefined,
        imageNombre: typeof payload?.imageNombre === 'string' ? payload.imageNombre : undefined,
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
      forEmisor: payload.forEmisor,
      forAdmin: payload.forAdmin,
      forReceptores,
    };
  }

  private getCurrentUserId(): number {
    const fromLocal = Number(localStorage.getItem('usuarioId') || 0);
    if (Number.isFinite(fromLocal) && fromLocal > 0) return fromLocal;
    const fromSession = Number(sessionStorage.getItem('usuarioId') || 0);
    if (Number.isFinite(fromSession) && fromSession > 0) return fromSession;
    return 0;
  }

  private extractAesBase64FromEnvelope(raw: unknown): string {
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

  private async resolveImageEnvelopeForCurrentUser(
    payload: SearchImagePayload,
    emisorId: number,
    myPrivKey: CryptoKey
  ): Promise<string | null> {
    const myId = this.getCurrentUserId();
    const isSender = Number(emisorId) === Number(myId);
    const orderedCandidates: string[] = [];

    const pushIfAny = (candidate: unknown): void => {
      if (typeof candidate !== 'string') return;
      const clean = candidate.trim();
      if (!clean || orderedCandidates.includes(clean)) return;
      orderedCandidates.push(clean);
    };

    if (isSender) pushIfAny(payload.forEmisor);

    if (payload.type === 'E2E_IMAGE') {
      if (!isSender) pushIfAny(payload.forReceptor);
      pushIfAny(payload.forEmisor);
      pushIfAny(payload.forReceptor);
    } else {
      pushIfAny(payload.forReceptores?.[String(myId)]);
      if (!isSender) {
        for (const candidate of Object.values(payload.forReceptores || {})) pushIfAny(candidate);
      }
      pushIfAny(payload.forEmisor);
      for (const candidate of Object.values(payload.forReceptores || {})) pushIfAny(candidate);
    }

    for (const candidate of orderedCandidates) {
      try {
        await this.cryptoService.decryptRSA(candidate, myPrivKey);
        return candidate;
      } catch {}
    }
    return null;
  }

  private async resolveAudioEnvelopeForCurrentUser(
    payload: SearchAudioPayload,
    emisorId: number,
    myPrivKey: CryptoKey
  ): Promise<string | null> {
    const myId = this.getCurrentUserId();
    const isSender = Number(emisorId) === Number(myId);
    if (isSender && payload.forEmisor) return payload.forEmisor;

    if (payload.type === 'E2E_AUDIO') return payload.forReceptor || null;

    const direct = payload.forReceptores?.[String(myId)];
    if (typeof direct === 'string' && direct.trim()) return direct;

    for (const candidate of Object.values(payload.forReceptores || {})) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      try {
        await this.cryptoService.decryptRSA(candidate, myPrivKey);
        return candidate;
      } catch {}
    }
    return null;
  }

  private async decryptImageBlobFromPayload(
    encryptedBlob: Blob,
    payload: SearchImagePayload,
    item: AiEncryptedMessageSearchResult
  ): Promise<Blob> {
    const myId = this.getCurrentUserId();
    if (!myId) throw new Error('AI_SEARCH_IMAGE_USER_ID_MISSING');
    const privKeyBase64 = String(localStorage.getItem(`privateKey_${myId}`) || '').trim();
    if (!privKeyBase64) throw new Error('AI_SEARCH_IMAGE_PRIVATE_KEY_MISSING');

    const myPrivKey = await this.cryptoService.importPrivateKey(privKeyBase64);
    const aesEnvelope = await this.resolveImageEnvelopeForCurrentUser(
      payload,
      Number(item?.emisorId || 0),
      myPrivKey
    );
    if (!aesEnvelope) throw new Error('AI_SEARCH_IMAGE_ENVELOPE_MISSING');

    const aesRawBase64 = await this.cryptoService.decryptRSA(aesEnvelope, myPrivKey);
    const aesBase64 = this.extractAesBase64FromEnvelope(aesRawBase64);
    const aesKey = await this.cryptoService.importAESKey(aesBase64);
    const encryptedBytes = await encryptedBlob.arrayBuffer();
    const decryptedBuffer = await this.cryptoService.decryptAESBinary(
      encryptedBytes,
      payload.ivFile,
      aesKey
    );
    const mime = String(payload.imageMime || item?.imageMime || item?.mimeType || 'image/jpeg').trim() || 'image/jpeg';
    return new Blob([decryptedBuffer], { type: mime });
  }

  private async decryptAudioBlobFromPayload(
    encryptedBlob: Blob,
    payload: SearchAudioPayload,
    item: AiEncryptedMessageSearchResult
  ): Promise<Blob> {
    const myId = this.getCurrentUserId();
    if (!myId) throw new Error('AI_SEARCH_AUDIO_USER_ID_MISSING');
    const privKeyBase64 = String(localStorage.getItem(`privateKey_${myId}`) || '').trim();
    if (!privKeyBase64) throw new Error('AI_SEARCH_AUDIO_PRIVATE_KEY_MISSING');

    const myPrivKey = await this.cryptoService.importPrivateKey(privKeyBase64);
    const aesEnvelope = await this.resolveAudioEnvelopeForCurrentUser(
      payload,
      Number(item?.emisorId || 0),
      myPrivKey
    );
    if (!aesEnvelope) throw new Error('AI_SEARCH_AUDIO_ENVELOPE_MISSING');

    const aesRawBase64 = await this.cryptoService.decryptRSA(aesEnvelope, myPrivKey);
    const aesBase64 = this.extractAesBase64FromEnvelope(aesRawBase64);
    const aesKey = await this.cryptoService.importAESKey(aesBase64);
    const encryptedBytes = await encryptedBlob.arrayBuffer();
    const decryptedBuffer = await this.cryptoService.decryptAESBinary(
      encryptedBytes,
      payload.ivFile,
      aesKey
    );
    const mime = String(payload.audioMime || item?.mimeType || 'audio/webm').trim() || 'audio/webm';
    return new Blob([decryptedBuffer], { type: mime });
  }

  private async assertRenderableImageBlob(
    blob: Blob,
    ctx: {
      mensajeId: number;
      chatId: number;
      rawUrl: string;
      mimeType: string;
      tipo: SearchResultMessageType;
    }
  ): Promise<void> {
    const objectUrl = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = (ev) => reject(ev);
        img.src = objectUrl;
      });
      console.log('[ai-search-popup][media][decode-ok]', {
        ...ctx,
        blobType: blob.type,
        blobSize: blob.size,
      });
    } catch (error) {
      console.error('[ai-search-popup][media][decode-failed]', {
        ...ctx,
        blobType: blob.type,
        blobSize: blob.size,
        error,
      });
      throw error;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
