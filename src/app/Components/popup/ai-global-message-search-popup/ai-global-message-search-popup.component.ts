import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { AiEncryptedMessageSearchReportHistoryItem, AiEncryptedMessageSearchResult } from '../../../Interface/AiEncryptedMessageSearchDTO';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { WebSocketService } from '../../../Service/WebSocket/web-socket.service';
import { clampPercent, formatDuration, parseAudioDurationMs } from '../../../utils/chat-utils';

type AiSearchProgressStatus = 'STARTED' | 'COMPLETED' | 'FAILED';
type AiSearchProgressStep =
  | 'ANALYZING_CONTEXT'
  | 'ANALYZING_MESSAGES'
  | 'MESSAGE_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'APP_REPORT'
  | 'APP_REPORT_STATUS'
  | 'ERROR'
  | string;
interface AiSearchProgressWS {
  requestId?: string;
  step?: AiSearchProgressStep;
  status: AiSearchProgressStatus;
  message?: string;
  timestamp?: string;
  hasApproximateResult?: boolean;
  target?: string;
  phase?: string;
  tipoReporte?: string;
}
interface VisibleAiProgressEvent {
  requestId: string;
  step: AiSearchProgressStep;
  status: AiSearchProgressStatus;
  label: string;
  iconClass: string;
  state: 'active' | 'done' | 'warning' | 'error';
  hasApproximateResult: boolean;
  dedupeKey: string;
}

type SearchResultMessageType = 'TEXT' | 'AUDIO' | 'IMAGE' | 'STICKER' | 'FILE' | 'UNKNOWN';
type ReportStatusState = 'APROBADA' | 'EN_REVISION' | 'PENDIENTE' | 'RECHAZADA';
interface ReportTimelineItem {
  result: AiEncryptedMessageSearchResult;
  stateOrder: number;
  timestampMs: number;
}
interface ReportCard {
  key: string;
  reporteId: number | null;
  tipoReporte: string;
  estadoReporte: string;
  motivoReporte: string;
  resolucionMotivoReporte: string | null;
  fechaCreacionReporte: string;
  fechaActualizacionReporte: string;
  mejorResultadoAproximado: boolean;
  relevancia: number | null;
  historialReporte: ReportHistoryItem[];
  currentStateOrder: number;
  latestTimestampMs: number;
}
interface ReportHistoryItem {
  key: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  estadoLabel: string | null;
  motivo: string;
  resolucionMotivo: string | null;
  fecha: string;
  adminId: number | null;
  accion: string | null;
  timestampMs: number;
  tieneImagenReporte: boolean;
  imagenReporteMimeType: string | null;
  imagenReporteNombre: string | null;
  imagenReporteSize: number | null;
  imagenReporteUrl: string | null;
}
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
  private readonly allowedReportImageMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
  ]);
  private readonly maxReportImageSizeBytes = 5 * 1024 * 1024;
  private readonly mediaLoadErrors = new Set<string>();
  private readonly hydratedMediaUrls = new Map<string, string>();
  private readonly hydratingMediaKeys = new Set<string>();
  private readonly reportHistoryImagePreviewUrls = new Map<string, string>();
  private readonly reportHistoryImageLoadingKeys = new Set<string>();
  private readonly reportHistoryImageErrorKeys = new Set<string>();
  private currentPlayingResultId: number | null = null;
  public readonly audioStates = new Map<number, { playing: boolean; current: number; duration: number }>();

  @Input() open = false;
  @Input() loading = false;
  @Input() consulta = '';
  @Input() error: string | null = null;
  @Input() resumenBusqueda: string | null = null;
  @Input() resultados: AiEncryptedMessageSearchResult[] = [];
  @Input() aiSummary: string | null = null;
  @Input() aiSummaryLoading = false;
  @Input() searchCodigo: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() consultaChange = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<{
    consulta: string;
    requestId: string;
    imagenReporteBase64?: string;
    imagenReporteMimeType?: string;
    imagenReporteNombre?: string;
  }>();
  @Output() resultSelected = new EventEmitter<AiEncryptedMessageSearchResult>();

  public imagenReporteBase64: string | null = null;
  public imagenReporteMimeType: string | null = null;
  public imagenReporteNombre: string | null = null;

  public constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly mensajeriaService: MensajeriaService,
    private readonly cryptoService: CryptoService,
    private readonly webSocketService: WebSocketService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public animationActive = false;
  public showResult = false;
  public isApproximateResult = false;
  public showHistoryReportImagePreview = false;
  public historyReportImagePreviewSrc = '';
  public historyReportImagePreviewName = 'Imagen adjunta';
  public historyReportImagePreviewSize = '';
  public historyReportImagePreviewMime = 'image/jpeg';
  public visibleProgressEvents: VisibleAiProgressEvent[] = [];
  public reportCards: ReportCard[] = [];
  public resultAnimationKey = '';
  private loadingTimers: ReturnType<typeof setTimeout>[] = [];
  private httpResponseReady = false;
  private wsStepsComplete = false;
  private currentRequestId = '';
  private wsProgressRequestId = '';
  private renderedResultRequestId = '';
  private progressQueue: VisibleAiProgressEvent[] = [];
  private isProcessingProgressQueue = false;
  private finalResultDelayScheduled = false;
  private readonly handledProgressKeys = new Set<string>();
  private readonly finalResultDelayMs = 750;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && changes['open'].currentValue === false) {
      this.clearReportImageState();
      this.closeHistoryReportImagePreview();
      this.clearHistoryReportImageCache();
    }
    if (changes['resultados']) {
      this.hydrateVisibleResultAssets();
      this.reportCards = this.getSortedReportResults(this.resultados);
      this.hydrateReportHistoryImages();
    }
    if (changes['loading']) {
      if (this.loading) {
        this.showResult = false;
      } else if (this.animationActive) {
        if (this.error) {
          this.showResult = true;
          this.stopLoadingAnimation();
        } else {
          this.httpResponseReady = true;
          console.log('[AI_SEARCH][HTTP] final response ready', {
            wsStepsComplete: this.wsStepsComplete,
            queueLength: this.progressQueue.length,
          });
          if (this.wsStepsComplete) {
            this.scheduleFinalResultDisplay();
          }
        }
      }
    }
  }

  public ngOnDestroy(): void {
    this.stopLoadingAnimation();
    this.pauseAllResultAudios();
    for (const url of this.hydratedMediaUrls.values()) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    this.hydratedMediaUrls.clear();
    this.clearHistoryReportImageCache();
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
    if (this.loading || this.animationActive) return;
    const normalized = String(this.consulta || '').trim();
    if (!normalized) return;
    const requestId = this.generateRequestId();
    console.log('[AI_SEARCH][POPUP] submit', { requestId, consulta: normalized });
    this.currentRequestId = requestId;
    this.showResult = false;
    this.resultAnimationKey = '';
    this.startLoadingAnimation();
    this.subscribeToWsProgress(requestId);
    this.submitted.emit({
      consulta: normalized,
      requestId,
      imagenReporteBase64: this.imagenReporteBase64 || undefined,
      imagenReporteMimeType: this.imagenReporteMimeType || undefined,
      imagenReporteNombre: this.imagenReporteNombre || undefined,
    });
  }

  public triggerReportImageInput(fileInput: HTMLInputElement): void {
    if (this.loading || this.animationActive) return;
    fileInput.click();
  }

  public async onReportImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) return;

    if (!this.allowedReportImageMimeTypes.has(file.type)) {
      this.clearReportImageState(input);
      this.error = 'Solo se permiten imagenes PNG, JPG o WEBP.';
      this.cdr.markForCheck();
      return;
    }

    if (file.size > this.maxReportImageSizeBytes) {
      this.clearReportImageState(input);
      this.error = 'La imagen supera el limite de 5 MB.';
      this.cdr.markForCheck();
      return;
    }

    try {
      const base64 = await this.fileToBase64(file);
      this.imagenReporteBase64 = base64;
      this.imagenReporteMimeType = file.type;
      this.imagenReporteNombre = file.name;
      this.error = null;
    } catch {
      this.clearReportImageState(input);
      this.error = 'No se pudo procesar la imagen seleccionada.';
    } finally {
      if (input) input.value = '';
      this.cdr.markForCheck();
    }
  }

  public removeReportImage(event?: Event): void {
    event?.stopPropagation();
    this.clearReportImageState();
    if (!this.loading) {
      this.error = null;
    }
    this.cdr.markForCheck();
  }

  public get hasReportImage(): boolean {
    return !!this.imagenReporteBase64 && !!this.imagenReporteMimeType && !!this.imagenReporteNombre;
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

  public isComplaintResult(item: AiEncryptedMessageSearchResult): boolean {
    const tipo = String(item?.tipoResultado || '').trim().toUpperCase();
    return tipo.startsWith('COMPLAINT') || Number(item?.denunciaId || 0) > 0;
  }

  public getComplaintTitle(item: AiEncryptedMessageSearchResult): string {
    const tipo = String(item?.tipoResultado || '').trim().toUpperCase();
    if (tipo === 'COMPLAINT_CREATED') return 'Denuncia enviada';
    if (tipo === 'COMPLAINT_RECEIVED') return 'Denuncia recibida';
    return 'Denuncia';
  }

  public getComplaintIndicatorClass(item: AiEncryptedMessageSearchResult): string {
    const estado = String(item?.estadoDenuncia || '').trim().toUpperCase();
    if (estado === 'RESUELTO' || estado === 'CERRADO') return 'priority-green';
    return 'priority-red';
  }

  public getComplaintBadgeClass(item: AiEncryptedMessageSearchResult): Record<string, boolean> {
    const estado = String(item?.estadoDenuncia || '').trim().toUpperCase();
    const resolved = estado === 'RESUELTO' || estado === 'CERRADO';
    return { 'badge-green': resolved, 'badge-red': !resolved };
  }

  public getComplaintGravedadClass(item: AiEncryptedMessageSearchResult): string {
    const g = String(item?.gravedad || '').trim().toUpperCase();
    if (g === 'ALTA' || g === 'CRITICA') return 'gravedad--alta';
    if (g === 'MEDIA') return 'gravedad--media';
    return 'gravedad--baja';
  }

  public getComplaintMotivo(item: AiEncryptedMessageSearchResult): string {
    return String(item?.motivo || item?.tipoDenuncia || '').trim() || 'Sin motivo especificado';
  }

  public getComplaintDetalle(item: AiEncryptedMessageSearchResult): string {
    return String(item?.contenido || item?.contenidoVisible || '').trim();
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
    return !this.loading && !this.animationActive && !!String(this.consulta || '').trim();
  }

  public get hasResumenBusqueda(): boolean {
    return !!String(this.resumenBusqueda || '').trim();
  }

  public get resolvedAiSummary(): string | null {
    const decrypted = String(this.aiSummary || '').trim();
    if (decrypted) return decrypted;
    const fallback = String(this.resumenBusqueda || '').trim();
    return fallback || null;
  }

  public get shouldShowAiSummaryCard(): boolean {
    return this.aiSummaryLoading || !!this.resolvedAiSummary;
  }

  public hasHistoryReportImage(item: ReportHistoryItem): boolean {
    return (
      item?.tieneImagenReporte === true &&
      !!String(item?.imagenReporteUrl || '').trim() &&
      String(item?.imagenReporteMimeType || '').trim().toLowerCase().startsWith('image/')
    );
  }

  public isLoadingHistoryReportImage(item: ReportHistoryItem): boolean {
    return this.reportHistoryImageLoadingKeys.has(item.key);
  }

  public hasHistoryReportImageError(item: ReportHistoryItem): boolean {
    return this.reportHistoryImageErrorKeys.has(item.key);
  }

  public getHistoryReportImagePreviewUrl(item: ReportHistoryItem): string {
    return String(this.reportHistoryImagePreviewUrls.get(item.key) || '').trim();
  }

  public getHistoryReportImageMeta(item: ReportHistoryItem): string {
    const name = String(item?.imagenReporteNombre || '').trim();
    const size = this.formatHistoryReportImageSize(item?.imagenReporteSize);
    if (name && size) return `${name} · ${size}`;
    return name || size || 'Imagen adjunta';
  }

  public openHistoryReportImagePreview(item: ReportHistoryItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const objectUrl = this.getHistoryReportImagePreviewUrl(item);
    if (!objectUrl) return;
    this.historyReportImagePreviewSrc = objectUrl;
    this.historyReportImagePreviewName =
      String(item?.imagenReporteNombre || '').trim() || 'Imagen adjunta';
    this.historyReportImagePreviewSize = this.formatHistoryReportImageSize(item?.imagenReporteSize);
    this.historyReportImagePreviewMime =
      String(item?.imagenReporteMimeType || '').trim() || 'image/jpeg';
    this.showHistoryReportImagePreview = true;
    this.cdr.markForCheck();
  }

  public closeHistoryReportImagePreview(): void {
    this.showHistoryReportImagePreview = false;
    this.historyReportImagePreviewSrc = '';
    this.historyReportImagePreviewName = 'Imagen adjunta';
    this.historyReportImagePreviewSize = '';
    this.historyReportImagePreviewMime = 'image/jpeg';
    this.cdr.markForCheck();
  }

  public formatHistoryReportImageSize(value: number | null | undefined): string {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return '';
    if (size < 1024) return `${Math.round(size)} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private clearReportImageState(input?: HTMLInputElement | null): void {
    this.imagenReporteBase64 = null;
    this.imagenReporteMimeType = null;
    this.imagenReporteNombre = null;
    if (input) input.value = '';
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIndex = result.indexOf(',');
        const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
        if (!base64) {
          reject(new Error('REPORT_IMAGE_BASE64_EMPTY'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error('REPORT_IMAGE_READ_ERROR'));
      reader.readAsDataURL(file);
    });
  }

  private hydrateReportHistoryImages(): void {
    for (const report of this.reportCards || []) {
      for (const item of report.historialReporte || []) {
        if (!this.hasHistoryReportImage(item)) continue;
        this.loadHistoryReportImage(item);
      }
    }
  }

  private loadHistoryReportImage(item: ReportHistoryItem): void {
    if (!this.hasHistoryReportImage(item)) return;
    if (this.reportHistoryImagePreviewUrls.has(item.key)) return;
    if (this.reportHistoryImageLoadingKeys.has(item.key)) return;

    const url = String(item?.imagenReporteUrl || '').trim();
    if (!url) return;

    this.reportHistoryImageLoadingKeys.add(item.key);
    this.reportHistoryImageErrorKeys.delete(item.key);

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const mime = String(blob?.type || item?.imagenReporteMimeType || '').trim().toLowerCase();
        if (!mime.startsWith('image/')) {
          this.reportHistoryImageErrorKeys.add(item.key);
          return;
        }
        const safeBlob =
          blob.type && blob.type.toLowerCase().startsWith('image/')
            ? blob
            : blob.slice(
                0,
                blob.size,
                String(item?.imagenReporteMimeType || 'image/jpeg').trim() || 'image/jpeg'
              );
        const previous = this.reportHistoryImagePreviewUrls.get(item.key);
        if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
        this.reportHistoryImagePreviewUrls.set(item.key, URL.createObjectURL(safeBlob));
        this.reportHistoryImageErrorKeys.delete(item.key);
        this.cdr.markForCheck();
      },
      error: () => {
        this.reportHistoryImageErrorKeys.add(item.key);
        this.cdr.markForCheck();
      },
      complete: () => {
        this.reportHistoryImageLoadingKeys.delete(item.key);
        this.cdr.markForCheck();
      },
    });
  }

  private clearHistoryReportImageCache(): void {
    for (const url of this.reportHistoryImagePreviewUrls.values()) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    this.reportHistoryImagePreviewUrls.clear();
    this.reportHistoryImageLoadingKeys.clear();
    this.reportHistoryImageErrorKeys.clear();
  }

  private startLoadingAnimation(): void {
    this.stopLoadingAnimation();
    this.httpResponseReady = false;
    this.wsStepsComplete = false;
    this.isApproximateResult = false;
    this.animationActive = true;
    this.wsProgressRequestId = '';
    this.visibleProgressEvents = [];
    this.progressQueue = [];
    this.isProcessingProgressQueue = false;
    this.finalResultDelayScheduled = false;
    this.handledProgressKeys.clear();
    this.cdr.markForCheck();
  }

  private stopLoadingAnimation(): void {
    for (const timer of this.loadingTimers) clearTimeout(timer);
    this.loadingTimers = [];
    this.animationActive = false;
    this.httpResponseReady = false;
    this.wsStepsComplete = false;
    this.wsProgressRequestId = '';
    this.visibleProgressEvents = [];
    this.progressQueue = [];
    this.isProcessingProgressQueue = false;
    this.finalResultDelayScheduled = false;
    this.handledProgressKeys.clear();
    this.unsubscribeWsProgress();
    this.cdr.markForCheck();
  }

  private resolveAnimation(): void {
    this.showResult = true;
    this.activateResultAnimation();
    this.animationActive = false;
    this.unsubscribeWsProgress();
    this.cdr.markForCheck();
  }

  private scheduleFinalResultDisplay(): void {
    if (this.finalResultDelayScheduled) return;
    this.finalResultDelayScheduled = true;
    console.log('[AI_SEARCH][FINAL] scheduling final result display', {
      currentRequestId: this.currentRequestId,
      delayMs: this.finalResultDelayMs,
    });
    this.loadingTimers.push(setTimeout(() => {
      if (!this.animationActive || !this.httpResponseReady || !this.wsStepsComplete) {
        this.finalResultDelayScheduled = false;
        return;
      }
      console.log('[AI_SEARCH][FINAL] showing final results', {
        currentRequestId: this.currentRequestId,
      });
      this.resolveAnimation();
    }, this.finalResultDelayMs));
  }

  private handleWsProgressEvent(event: AiSearchProgressWS): void {
    if (!this.animationActive) {
      console.log('[AI_SEARCH][WS] ignored: animation inactive', event);
      return;
    }
    console.log('[AI_SEARCH][WS] received raw', {
      currentRequestId: this.currentRequestId,
      event,
    });
    const normalizedEvent = this.normalizeProgressEvent(event);
    if (!normalizedEvent) return;
    console.log('[AI_SEARCH][WS] enqueue normalized', normalizedEvent);
    this.enqueueProgressEvent(normalizedEvent);
  }
  private normalizeProgressEvent(event: AiSearchProgressWS): VisibleAiProgressEvent | null {
    const requestId = String(event?.requestId || '').trim();
    if (!requestId) {
      console.log('[AI_SEARCH][WS] drop: missing requestId', event);
      return null;
    }

    if (!this.wsProgressRequestId) {
      this.wsProgressRequestId = requestId;
      console.log('[AI_SEARCH][WS] bound requestId adopted from backend event', {
        submitRequestId: this.currentRequestId,
        wsProgressRequestId: this.wsProgressRequestId,
        event,
      });
    }

    if (requestId !== this.wsProgressRequestId) {
      console.log('[AI_SEARCH][WS] drop: wsProgressRequestId mismatch', {
        submitRequestId: this.currentRequestId,
        wsProgressRequestId: this.wsProgressRequestId,
        incomingRequestId: requestId,
        event,
      });
      return null;
    }

    const rawStatus = String(event?.status || '').trim().toUpperCase() as AiSearchProgressStatus;
    if (rawStatus !== 'STARTED' && rawStatus !== 'COMPLETED' && rawStatus !== 'FAILED') {
      console.log('[AI_SEARCH][WS] drop: unsupported status', { rawStatus, event });
      return null;
    }

    const rawStep = String(event?.step || '').trim().toUpperCase();
    const rawPhase = String(event?.phase || '').trim().toUpperCase();
    const rawTarget = String(event?.target || '').trim().toUpperCase();
    const step = this.resolveProgressStep(rawStep, rawPhase, rawTarget);
    const dedupeKey = `${requestId}:${step}:${rawStatus}`;
    if (this.handledProgressKeys.has(dedupeKey)) {
      console.log('[AI_SEARCH][WS] drop: duplicate', { dedupeKey, event });
      return null;
    }
    this.handledProgressKeys.add(dedupeKey);
    const backendMessage = this.sanitizeVisibleText(String(event?.message || '').trim());
    const hasApproximateResult = event?.hasApproximateResult === true;

    console.log('[AI_SEARCH][WS] normalized fields', {
      requestId,
      rawStep,
      rawPhase,
      rawTarget,
      submitRequestId: this.currentRequestId,
      wsProgressRequestId: this.wsProgressRequestId,
      resolvedStep: step,
      rawStatus,
      backendMessage,
      hasApproximateResult,
    });

    return {
      requestId,
      step,
      status: rawStatus,
      label: this.resolveProgressEventLabel(step, rawStatus, backendMessage, hasApproximateResult),
      iconClass: this.resolveProgressEventIconClass(step, rawStatus, hasApproximateResult),
      state: this.resolveProgressEventState(step, rawStatus, hasApproximateResult),
      hasApproximateResult,
      dedupeKey,
    };
  }
  private enqueueProgressEvent(event: VisibleAiProgressEvent): void {
    this.progressQueue = [...this.progressQueue, event];
    console.log('[AI_SEARCH][WS] queue push', {
      added: event,
      queueLength: this.progressQueue.length,
      visibleCount: this.visibleProgressEvents.length,
    });
    void this.processProgressQueue();
  }
  private async processProgressQueue(): Promise<void> {
    if (this.isProcessingProgressQueue) {
      console.log('[AI_SEARCH][WS] queue skip: already processing', {
        queueLength: this.progressQueue.length,
      });
      return;
    }
    if (!this.animationActive) {
      console.log('[AI_SEARCH][WS] queue skip: animation inactive', {
        queueLength: this.progressQueue.length,
      });
      return;
    }
    this.isProcessingProgressQueue = true;
    console.log('[AI_SEARCH][WS] queue start', { queueLength: this.progressQueue.length });
    try {
      while (this.animationActive && this.progressQueue.length > 0) {
        const nextEvent = this.progressQueue.shift();
        if (!nextEvent) continue;
        console.log('[AI_SEARCH][WS] queue pop', {
          event: nextEvent,
          remainingQueue: this.progressQueue.length,
        });
        this.applyVisibleProgressEvent(nextEvent);
        if (nextEvent.status === 'FAILED') {
          this.wsStepsComplete = true;
          console.log('[AI_SEARCH][WS] failed event visible', nextEvent);
          if (this.httpResponseReady) this.scheduleFinalResultDisplay();
          return;
        }
        if (this.isTerminalProgressEvent(nextEvent)) {
          this.wsStepsComplete = true;
          console.log('[AI_SEARCH][WS] terminal progress event', {
            step: nextEvent.step,
            httpResponseReady: this.httpResponseReady,
          });
          if (this.httpResponseReady) this.scheduleFinalResultDisplay();
        }
      }
    } finally {
      this.isProcessingProgressQueue = false;
      console.log('[AI_SEARCH][WS] queue end', {
        queueLength: this.progressQueue.length,
        animationActive: this.animationActive,
      });
    }
  }
  private applyVisibleProgressEvent(event: VisibleAiProgressEvent): void {
    const currentEvents = [...this.visibleProgressEvents];
    const existingIndex = currentEvents.findIndex((item) => item.requestId === event.requestId && item.step === event.step);
    if (event.step === 'MESSAGE_NOT_FOUND' && event.status === 'COMPLETED') {
      this.isApproximateResult = event.hasApproximateResult;
    }
    if (existingIndex >= 0) {
      currentEvents[existingIndex] = event;
    } else {
      currentEvents.push(event);
    }
    this.visibleProgressEvents = currentEvents;
    console.log('[AI_SEARCH][WS] visible progress updated', {
      event,
      visibleProgressEvents: this.visibleProgressEvents,
    });
    this.cdr.markForCheck();
  }
  private isTerminalProgressEvent(event: VisibleAiProgressEvent): boolean {
    if (event.status !== 'COMPLETED') return false;
    return (
      event.step === 'MESSAGE_FOUND' ||
      event.step === 'MESSAGE_NOT_FOUND' ||
      event.step === 'APP_REPORT' ||
      event.step === 'APP_REPORT_STATUS' ||
      event.step === 'ERROR'
    );
  }
  private resolveProgressStep(rawStep: string, rawPhase: string, rawTarget: string): string {
    if (rawTarget === 'APP_REPORT_STATUS' || rawPhase === 'APP_REPORT_STATUS') {
      return 'APP_REPORT_STATUS';
    }
    if (rawTarget === 'APP_REPORT' || rawPhase === 'APP_REPORT') {
      return 'APP_REPORT';
    }
    return rawStep || rawPhase || rawTarget || 'UNKNOWN';
  }

  private sanitizeVisibleText(value: string): string {
    return String(value || '')
      .replace(/BÃºsqueda/g, 'Busqueda')
      .replace(/bÃºsqueda/g, 'busqueda')
      .replace(/denuncias finalizad[ao]s?/g, 'denuncias finalizadas')
      .replace(/Ã¡/g, 'a')
      .replace(/Ã©/g, 'e')
      .replace(/Ã­/g, 'i')
      .replace(/Ã³/g, 'o')
      .replace(/Ãº/g, 'u')
      .replace(/Ã±/g, 'n')
      .replace(/Â/g, '')
      .replace(/�/g, '');
  }

  private resolveProgressEventLabel(
    step: string,
    status: AiSearchProgressStatus,
    backendMessage: string,
    hasApproximateResult: boolean
  ): string {
    if (step === 'ANALYZING_CONTEXT') {
      if (status === 'STARTED') return 'Analizando contexto...';
      if (status === 'COMPLETED') return 'Contexto analizado';
    }
    if (step === 'ANALYZING_MESSAGES') {
      if (status === 'STARTED') return 'Analizando mensajes...';
      if (status === 'COMPLETED') return 'Mensajes analizados';
    }
    if (step === 'MESSAGE_FOUND') {
      if (status === 'STARTED') return 'Preparando resultado...';
      if (status === 'COMPLETED') return 'Mensaje encontrado';
    }
    if (step === 'MESSAGE_NOT_FOUND') {
      if (status === 'STARTED') return 'Revisando coincidencias...';
      if (status === 'COMPLETED') {
        return hasApproximateResult
          ? 'No se encontro una coincidencia clara. Resultado aproximado'
          : 'No se encontro una coincidencia clara';
      }
    }
    if (step === 'APP_REPORT') {
      if (status === 'STARTED') return backendMessage || 'Generando reporte...';
      if (status === 'COMPLETED') return backendMessage || 'Reporte generado';
      if (status === 'FAILED') return backendMessage || 'No se pudo generar el reporte';
    }
    if (step === 'APP_REPORT_STATUS') {
      if (status === 'STARTED') return backendMessage || 'Buscando tus reportes...';
      if (status === 'COMPLETED') return backendMessage || 'Busqueda de reportes finalizada';
      if (status === 'FAILED') return backendMessage || 'No se pudo consultar el estado del reporte';
    }
    if (step === 'ERROR') return backendMessage || 'Error al procesar la busqueda';
    if (status === 'STARTED') return backendMessage || 'Procesando...';
    if (status === 'COMPLETED') return backendMessage || 'Completado';
    return backendMessage || 'No se pudo completar la operacion';
  }
  private resolveProgressEventState(
    step: string,
    status: AiSearchProgressStatus,
    hasApproximateResult: boolean
  ): 'active' | 'done' | 'warning' | 'error' {
    if (status === 'STARTED') return 'active';
    if (status === 'FAILED') return 'error';
    if (step === 'ERROR') return 'error';
    if (step === 'MESSAGE_NOT_FOUND') return 'warning';
    if (hasApproximateResult) return 'warning';
    return 'done';
  }
  private resolveProgressEventIconClass(
    step: string,
    status: AiSearchProgressStatus,
    hasApproximateResult: boolean
  ): string {
    if (status === 'STARTED') return 'bi-arrow-repeat';
    if (status === 'FAILED' || step === 'ERROR') return 'bi-exclamation-circle-fill';
    if (step === 'MESSAGE_NOT_FOUND') return hasApproximateResult ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-triangle';
    return 'bi-check-circle-fill';
  }

  public isAppReportStatusResponse(): boolean {
    return String(this.searchCodigo || '').trim().toUpperCase() === 'APP_REPORT_STATUS_OK';
  }

  public getReportCards(): ReportCard[] {
    return this.reportCards;
  }

  public trackByVisibleProgressEvent(_index: number, event: VisibleAiProgressEvent): string {
    return `${event.requestId}:${event.step}`;
  }

  public trackByReporteId(_index: number, item: ReportCard): string {
    return item.key;
  }

  public trackByHistoryItem(_index: number, item: ReportHistoryItem): string {
    return item.key;
  }

  public trackBySearchResult(index: number, result: AiEncryptedMessageSearchResult): string | number {
    const tipo = String(result?.tipoResultado || '').trim().toUpperCase();
    if (tipo === 'APP_REPORT_STATUS') return this.normalizeReportGroupKey(result);
    const mensajeId = Number(result?.mensajeId || 0);
    if (Number.isFinite(mensajeId) && mensajeId > 0) return mensajeId;
    return index;
  }

  public getVisibleProgressEventIconClass(event: VisibleAiProgressEvent): string {
    return event.iconClass;
  }

  public getSortedReportResults(resultados: AiEncryptedMessageSearchResult[]): ReportCard[] {
    return (resultados || [])
      .filter((result) => String(result?.tipoResultado || '').trim().toUpperCase() === 'APP_REPORT_STATUS')
      .map((result) => this.mapReportCard(result));
  }

  public normalizeReportGroupKey(result: AiEncryptedMessageSearchResult): string {
    const reportId = this.parseReportId(result?.reporteId);
    if (reportId != null) return `report-id:${reportId}`;

    const tipo = String(result?.tipoReporte || '').trim().toUpperCase();
    const motivo = this.normalizeReportText(this.getReportMotivo(result));
    const resolution = this.normalizeReportText(this.getReportResolution(result) || '');
    return `report:${tipo}:${motivo}:${resolution}`;
  }

  public getReportStateOrder(estadoReporte: string | null | undefined): number {
    const estado = String(estadoReporte || '').trim().toUpperCase();
    if (estado === 'APROBADA') return 1;
    if (estado === 'EN_REVISION') return 2;
    if (estado === 'PENDIENTE') return 3;
    if (estado === 'RECHAZADA') return 4;
    return 99;
  }

  public getReportStatusLabel(
    resultOrStatus: AiEncryptedMessageSearchResult | ReportHistoryItem | string | null | undefined,
    tipoReporte?: string | null | undefined
  ): string {
    const estado = typeof resultOrStatus === 'string'
      ? String(resultOrStatus || '').trim().toUpperCase()
      : String(
          (resultOrStatus as AiEncryptedMessageSearchResult)?.estadoReporte ||
          (resultOrStatus as ReportHistoryItem)?.estadoNuevo ||
          ''
        ).trim().toUpperCase();
    const tipo = typeof resultOrStatus === 'object' && resultOrStatus
      ? String((resultOrStatus as AiEncryptedMessageSearchResult)?.tipoReporte || tipoReporte || '').trim().toUpperCase()
      : String(tipoReporte || '').trim().toUpperCase();
    switch (estado) {
      case 'PENDIENTE':   return 'Pendiente';
      case 'EN_REVISION': return 'En revision';
      case 'APROBADA':
        if (tipo === 'INCIDENCIA' || tipo === 'ERROR_APP')   return 'Resuelto';
        if (tipo === 'QUEJA')                                return 'Atendida';
        if (tipo === 'MEJORA' || tipo === 'SUGERENCIA')      return 'Revisada';
        if (tipo === 'DESBANEO')                             return 'Aprobada';
        if (tipo === 'CHAT_CERRADO')                         return 'Reabierto';
        return 'Revisado';
      case 'RECHAZADA':
        if (tipo === 'INCIDENCIA' || tipo === 'ERROR_APP')              return 'Descartado';
        if (tipo === 'QUEJA' || tipo === 'MEJORA' || tipo === 'SUGERENCIA') return 'Descartada';
        if (tipo === 'DESBANEO')                             return 'Rechazada';
        if (tipo === 'CHAT_CERRADO')                         return 'No reabierto';
        return 'Descartado';
      default: return estado || 'Desconocido';
    }
  }

  public getReportStatusClass(r: AiEncryptedMessageSearchResult | ReportHistoryItem | string | null | undefined): string {
    const estado = typeof r === 'string'
      ? String(r || '').trim().toUpperCase()
      : String((r as AiEncryptedMessageSearchResult)?.estadoReporte || (r as ReportHistoryItem)?.estadoNuevo || '').trim().toUpperCase();
    if (estado === 'PENDIENTE')   return 'pendiente';
    if (estado === 'EN_REVISION') return 'en-revision';
    if (estado === 'APROBADA')    return 'aprobada';
    if (estado === 'RECHAZADA')   return 'rechazada';
    return 'pendiente';
  }

  public getReportIconClass(r: AiEncryptedMessageSearchResult | ReportHistoryItem | string | null | undefined): string {
    const estado = typeof r === 'string'
      ? String(r || '').trim().toUpperCase()
      : String((r as AiEncryptedMessageSearchResult)?.estadoReporte || (r as ReportHistoryItem)?.estadoNuevo || '').trim().toUpperCase();
    if (estado === 'PENDIENTE')   return 'bi bi-clock';
    if (estado === 'EN_REVISION') return 'bi bi-clock';
    if (estado === 'APROBADA')    return 'bi bi-check-lg';
    if (estado === 'RECHAZADA')   return 'bi bi-x-lg';
    return 'bi bi-clock';
  }

  public getReportTypeLabel(tipoReporte: string | AiEncryptedMessageSearchResult | ReportCard | null | undefined): string {
    const tipo = typeof tipoReporte === 'string'
      ? String(tipoReporte || '').trim().toUpperCase()
      : String(tipoReporte?.tipoReporte || '').trim().toUpperCase();
    switch (tipo) {
      case 'INCIDENCIA':   return 'Incidencia';
      case 'ERROR_APP':    return 'Error de aplicación';
      case 'QUEJA':        return 'Queja';
      case 'MEJORA':       return 'Mejora';
      case 'SUGERENCIA':   return 'Sugerencia';
      case 'DESBANEO':     return 'Desbaneo';
      case 'CHAT_CERRADO': return 'Chat bloqueado';
      case 'OTRO':         return 'Reporte general';
      default:
        return tipo
          ? tipo.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
          : 'Reporte';
    }
  }

  public getReportTypeClass(r: AiEncryptedMessageSearchResult): string {
    const tipo = String(r?.tipoReporte || '').trim().toUpperCase();
    if (tipo === 'INCIDENCIA')   return 'incidencia';
    if (tipo === 'ERROR_APP')    return 'error';
    if (tipo === 'QUEJA')        return 'queja';
    if (tipo === 'MEJORA')       return 'mejora';
    if (tipo === 'SUGERENCIA')   return 'sugerencia';
    if (tipo === 'DESBANEO')     return 'desbaneo';
    if (tipo === 'CHAT_CERRADO') return 'chat';
    return 'otro';
  }

  public getReportDateLabel(r: AiEncryptedMessageSearchResult): string {
    const estado = String(r?.estadoReporte || '').trim().toUpperCase();
    return estado === 'PENDIENTE' ? 'Creado el' : 'Actualizado el';
  }

  public getReportDateValue(r: AiEncryptedMessageSearchResult): string {
    const rawDate = this.getReportRelevantDate(r);
    const parsed = this.parseReportDate(rawDate);
    if (!parsed) return '';

    return parsed.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  public getReportMotivo(r: AiEncryptedMessageSearchResult): string {
    return String(r?.motivoReporte || r?.motivo || r?.motivoCoincidencia || '').trim();
  }

  public getReportResolution(r: AiEncryptedMessageSearchResult): string | null {
    const val = String(r?.resolucionMotivoReporte || r?.resolucionMotivo || '').trim();
    return val || null;
  }

  public getReportTimelineItems(card: ReportCard): ReportHistoryItem[] {
    return this.getSortedReportHistory(card?.historialReporte || []);
  }

  public getReportGroupTypeLabel(card: ReportCard): string {
    return this.getReportTypeLabel(card?.tipoReporte || null);
  }

  public hasReportRelevance(r: AiEncryptedMessageSearchResult | ReportCard): boolean {
    return typeof r?.relevancia === 'number' && Number.isFinite(r.relevancia);
  }

  public isApproximateReportResult(r: AiEncryptedMessageSearchResult): boolean {
    return r?.mejorResultadoAproximado === true;
  }

  public getSortedReportHistory(historial: ReportHistoryItem[]): ReportHistoryItem[] {
    return Array.isArray(historial) ? [...historial] : [];
  }

  public getReportHistoryStatusOrder(status: string | null | undefined): number {
    const estado = String(status || '').trim().toUpperCase();
    if (estado === 'PENDIENTE') return 1;
    if (estado === 'EN_REVISION') return 2;
    if (estado === 'APROBADA') return 3;
    if (estado === 'RECHAZADA') return 3;
    return 99;
  }

  public getReportBadgeClass(status: string | null | undefined): string {
    const estado = String(status || '').trim().toUpperCase();
    if (estado === 'PENDIENTE') return 'badge-pendiente';
    if (estado === 'EN_REVISION') return 'badge-revision';
    if (estado === 'APROBADA') return 'badge-aprobada';
    if (estado === 'RECHAZADA') return 'badge-rechazada';
    return 'badge-pendiente';
  }

  public getReportCircleClass(status: string | null | undefined): string {
    const estado = String(status || '').trim().toUpperCase();
    if (estado === 'PENDIENTE') return 'status-circle--pendiente';
    if (estado === 'EN_REVISION') return 'status-circle--revision';
    if (estado === 'APROBADA') return 'status-circle--aprobada';
    if (estado === 'RECHAZADA') return 'status-circle--rechazada';
    return 'status-circle--pendiente';
  }

  public getReportDateText(item: ReportHistoryItem): string {
    const accion = String(item?.accion || '').trim().toUpperCase();
    const estado = String(item?.estadoNuevo || '').trim().toUpperCase();
    const prefix = accion === 'CREACION' || estado === 'PENDIENTE' ? 'Creado el' : 'Actualizado el';
    return item?.fecha ? `${prefix} ${item.fecha}` : prefix;
  }

  private mapReportCard(result: AiEncryptedMessageSearchResult): ReportCard {
    const historial = this.buildReportHistory(result);
    return {
      key: this.normalizeReportGroupKey(result),
      reporteId: this.parseReportId(result?.reporteId),
      tipoReporte: String(result?.tipoReporte || '').trim().toUpperCase(),
      estadoReporte: String(result?.estadoReporte || '').trim().toUpperCase(),
      motivoReporte: this.getReportMotivo(result),
      resolucionMotivoReporte: this.getReportResolution(result),
      fechaCreacionReporte: String(result?.fechaCreacionReporte || result?.createdAt || result?.fechaEnvio || '').trim(),
      fechaActualizacionReporte: String(result?.fechaActualizacionReporte || result?.updatedAt || result?.fechaCreacionReporte || result?.createdAt || result?.fechaEnvio || '').trim(),
      mejorResultadoAproximado: result?.mejorResultadoAproximado === true,
      relevancia: typeof result?.relevancia === 'number' && Number.isFinite(result.relevancia) ? result.relevancia : null,
      historialReporte: historial,
      currentStateOrder: this.getReportStateOrder(result?.estadoReporte),
      latestTimestampMs: historial.reduce((max, item) => Math.max(max, item.timestampMs), this.getReportSortTimestamp(result)),
    };
  }

  private buildReportHistory(result: AiEncryptedMessageSearchResult): ReportHistoryItem[] {
    const rawHistory = Array.isArray(result?.historialReporte) ? result.historialReporte : [];
    const history = rawHistory
      .map((item, index) => this.mapReportHistoryItem(item, result, index))
      .filter((item): item is ReportHistoryItem => !!item);

    if (history.length > 0) return this.getSortedReportHistory(history);
    return [this.buildFallbackReportHistoryItem(result)];
  }

  private mapReportHistoryItem(
    item: AiEncryptedMessageSearchReportHistoryItem | null | undefined,
    result: AiEncryptedMessageSearchResult,
    index: number
  ): ReportHistoryItem | null {
    const estadoNuevo = String(item?.estadoNuevo || '').trim().toUpperCase();
    const fecha = String(item?.fecha || '').trim();
    if (!estadoNuevo && !fecha && !item?.motivo && !item?.resolucionMotivo) return null;

    return {
      key: `${this.normalizeReportGroupKey(result)}:history:${index}:${estadoNuevo || 'UNKNOWN'}:${fecha || 'no-date'}`,
      estadoAnterior: item?.estadoAnterior ? String(item.estadoAnterior).trim().toUpperCase() : null,
      estadoNuevo: estadoNuevo || String(result?.estadoReporte || '').trim().toUpperCase() || 'PENDIENTE',
      estadoLabel: item?.estadoLabel ? String(item.estadoLabel).trim() : null,
      motivo: String(item?.motivo || result?.motivoReporte || result?.motivo || '').trim(),
      resolucionMotivo: String(item?.resolucionMotivo || '').trim() || null,
      fecha,
      adminId: Number.isFinite(Number(item?.adminId)) ? Number(item?.adminId) : null,
      accion: String(item?.accion || '').trim() || null,
      timestampMs: this.parseReportDate(fecha)?.getTime() ?? 0,
      tieneImagenReporte: item?.tieneImagenReporte === true,
      imagenReporteMimeType: String(item?.imagenReporteMimeType || '').trim() || null,
      imagenReporteNombre: String(item?.imagenReporteNombre || '').trim() || null,
      imagenReporteSize:
        Number.isFinite(Number(item?.imagenReporteSize)) && Number(item?.imagenReporteSize) >= 0
          ? Number(item?.imagenReporteSize)
          : null,
      imagenReporteUrl: String(item?.imagenReporteUrl || '').trim() || null,
    };
  }

  private buildFallbackReportHistoryItem(result: AiEncryptedMessageSearchResult): ReportHistoryItem {
    const estado = String(result?.estadoReporte || '').trim().toUpperCase() || 'PENDIENTE';
    const accion = estado === 'PENDIENTE' ? 'CREACION' : 'CAMBIO_ESTADO';
    const fecha = estado === 'PENDIENTE'
      ? String(result?.fechaCreacionReporte || result?.createdAt || result?.fechaEnvio || '').trim()
      : String(result?.fechaActualizacionReporte || result?.updatedAt || result?.fechaCreacionReporte || result?.createdAt || result?.fechaEnvio || '').trim();

    return {
      key: `${this.normalizeReportGroupKey(result)}:fallback:${estado}:${fecha || 'no-date'}`,
      estadoAnterior: null,
      estadoNuevo: estado,
      estadoLabel: null,
      motivo: this.getReportMotivo(result),
      resolucionMotivo: this.getReportResolution(result),
      fecha,
      adminId: Number.isFinite(Number(result?.reviewedByAdminId)) ? Number(result?.reviewedByAdminId) : null,
      accion,
      timestampMs: this.parseReportDate(fecha)?.getTime() ?? 0,
      tieneImagenReporte: false,
      imagenReporteMimeType: null,
      imagenReporteNombre: null,
      imagenReporteSize: null,
      imagenReporteUrl: null,
    };
  }

  private getAppReportStartedLabel(tipoReporte: string): string {
    const t = tipoReporte.toUpperCase();
    if (t === 'QUEJA')                         return 'Generando queja...';
    if (t === 'INCIDENCIA' || t === 'ERROR_APP') return 'Generando incidencia...';
    if (t === 'MEJORA'     || t === 'SUGERENCIA') return 'Generando sugerencia...';
    if (t === 'DESBANEO')                        return 'Generando solicitud...';
    return 'Generando reporte...';
  }

  private subscribeToWsProgress(_requestId: string): void {
    console.log('[AI_SEARCH][WS] subscribe requested', { requestId: _requestId });
    this.webSocketService.suscribirseAProgressoBusquedaIA((payload) => {
      console.log('[AI_SEARCH][WS] payload from service', payload);
      this.handleWsProgressEvent(payload as AiSearchProgressWS);
    });
  }

  private unsubscribeWsProgress(): void {
    console.log('[AI_SEARCH][WS] unsubscribe requested', { currentRequestId: this.currentRequestId });
    this.webSocketService.desuscribirseDeProgressoBusquedaIA();
  }

  private generateRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID() as string;
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

  private getReportRelevantDate(r: AiEncryptedMessageSearchResult): string {
    const estado = String(r?.estadoReporte || '').trim().toUpperCase();
    if (estado === 'PENDIENTE') {
      return String(r?.fechaCreacionReporte || r?.createdAt || r?.fechaEnvio || '').trim();
    }
    return String(r?.fechaActualizacionReporte || r?.updatedAt || r?.fechaCreacionReporte || r?.createdAt || r?.fechaEnvio || '').trim();
  }

  private getReportSortTimestamp(r: AiEncryptedMessageSearchResult): number {
    const parsed = this.parseReportDate(this.getReportRelevantDate(r));
    return parsed?.getTime() ?? 0;
  }

  private parseReportDate(raw: string | null | undefined): Date | null {
    const value = String(raw || '').trim();
    if (!value) return null;
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
      const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
      const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private normalizeReportText(value: string): string {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private parseReportId(value: number | null | undefined): number | null {
    const reportId = Number(value);
    return Number.isFinite(reportId) && reportId > 0 ? reportId : null;
  }

  private activateResultAnimation(): void {
    if (!this.currentRequestId || this.renderedResultRequestId === this.currentRequestId) return;
    this.renderedResultRequestId = this.currentRequestId;
    this.resultAnimationKey = this.currentRequestId;
  }
}


