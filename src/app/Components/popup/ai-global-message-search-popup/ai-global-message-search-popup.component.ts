import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import {
  AiEncryptedMessageSearchResponse,
  AiEncryptedMessageSearchComplaintHistoryItem,
  AiEncryptedMessageSearchReportHistoryItem,
  AiEncryptedMessageSearchResult,
} from '../../../Interface/AiEncryptedMessageSearchDTO';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { WebSocketService } from '../../../Service/WebSocket/web-socket.service';
import { UiCustomizationService } from '../../../shared/ui-customization/ui-customization.service';
import { NEXO_CUSTOMIZABLE_AREAS, NexoAreaId, NexoCssProperty } from '../../../shared/ui-customization/nexo-customizable-areas';
import { UiCustomizationChange } from '../../../Interface/UiCustomizationIntentDTO';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments';
import { clampPercent, formatDuration, parseAudioDurationMs, resolveMediaUrl } from '../../../utils/chat-utils';

type AiSearchProgressStatus = 'STARTED' | 'COMPLETED' | 'FAILED';
type AiSearchProgressStep =
  | 'ANALYZING_CONTEXT'
  | 'ANALYZING_MESSAGES'
  | 'MESSAGE_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'APP_REPORT'
  | 'APP_REPORT_STATUS'
  | 'COMPLAINTS_SEARCH'
  | 'UI_CUSTOMIZATION_ANALYZING'
  | 'UI_CUSTOMIZATION_VALIDATING'
  | 'UI_CUSTOMIZATION_READY'
  | 'UI_CUSTOMIZATION_FAILED'
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
interface EditableUiCustomizationChange extends UiCustomizationChange {
  selected: boolean;
  value: string;
  colorError: string | null;
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
interface ComplaintStatusCard {
  key: string;
  denunciaId: number | null;
  estadoDenuncia: string;
  motivoDenuncia: string;
  detalleDenuncia: string;
  denuncianteNombre: string | null;
  denunciadoNombre: string | null;
  chatId: number | null;
  chatNombreSnapshot: string | null;
  fechaDenuncia: string;
  mejorResultadoAproximado: boolean;
  relevancia: number | null;
  historialDenuncia: ComplaintHistoryItem[];
}
interface ComplaintHistoryItem {
  key: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  estadoLabel: string | null;
  motivo: string;
  detalle: string | null;
  resolucionMotivo: string | null;
  fecha: string;
  adminId: number | null;
  accion: string | null;
  timestampMs: number;
}
type SearchImagePayload =
  | {
      type: 'E2E_IMAGE';
      ivFile: string;
      imageUrl: string;
      imageMime?: string;
      imageNombre?: string;
      forEmisor: string;
      forAdmin?: string; // optional — sticker payloads may omit it
      forReceptor: string;
    }
  | {
      type: 'E2E_GROUP_IMAGE';
      ivFile: string;
      imageUrl: string;
      imageMime?: string;
      imageNombre?: string;
      forEmisor: string;
      forAdmin?: string; // optional
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
  @Input() uiCustomizationResult: AiEncryptedMessageSearchResponse | null = null;
  @Input() awaitingClarification = false;
  @Input() clarificationMessage: string | null = null;
  @Input() clarificationReason: string | null = null;
  @Input() clarificationTarget: string | null = null;
  @Input() smartActionThinkingVisible = false;

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
    private readonly cdr: ChangeDetectorRef,
    private readonly uiCustomizationService: UiCustomizationService
  ) {}

  public animationActive = false;
  public showResult = false;
  public customizationPreviewActive = false;
  public customizationFeedback: string | null = null;
  public changesDropdownOpen = false;
  public editableChanges: EditableUiCustomizationChange[] = [];
  public activeColorEditorKey: string | null = null;
  public isApproximateResult = false;
  public showHistoryReportImagePreview = false;
  public historyReportImagePreviewSrc = '';
  public historyReportImagePreviewName = 'Imagen adjunta';
  public historyReportImagePreviewSize = '';
  public historyReportImagePreviewMime = 'image/jpeg';
  public showSearchResultMediaPreview = false;
  public searchResultMediaPreviewUrl = '';
  public searchResultMediaPreviewName = 'Imagen';
  public searchResultMediaPreviewSize = '';
  public searchResultMediaPreviewMime = 'image/jpeg';
  public visibleProgressEvents: VisibleAiProgressEvent[] = [];
  public reportCards: ReportCard[] = [];
  public complaintStatusCards: ComplaintStatusCard[] = [];
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
  /** Minimum time a STARTED event stays visible before being replaced by COMPLETED. */
  private readonly STEP_MIN_MS = 400;
  private smartActionFirstWsReceived = false;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && changes['open'].currentValue === false) {
      this.clearReportImageState();
      this.closeHistoryReportImagePreview();
      this.clearHistoryReportImageCache();
      this.closeSearchResultMediaPreview();
      if (this.customizationPreviewActive) {
        this.uiCustomizationService.cancelPreview();
        this.customizationPreviewActive = false;
      }
      this.customizationFeedback = null;
      this.activeColorEditorKey = null;
      this.changesDropdownOpen = false;
    }
    if (changes['uiCustomizationResult'] && this.uiCustomizationResult) {
      console.log('[UI_CUSTOMIZATION][DROPDOWN] ngOnChanges uiCustomizationResult', {
        action: this.uiCustomizationResult?.action,
        changesCount: ((this.uiCustomizationResult as any)?.changes ?? []).length,
        dropdownOpenBefore: this.changesDropdownOpen,
      });
      // Signal WS steps complete so animation can resolve
      if (this.animationActive) {
        this.wsStepsComplete = true;
        if (this.httpResponseReady) this.scheduleFinalResultDisplay();
      }
      this.customizationPreviewActive = false;
      this.customizationFeedback = null;
      this.resetEditableCustomizationChanges();
      console.log('[UI_CUSTOMIZATION][DROPDOWN] ngOnChanges uiCustomizationResult done', {
        dropdownOpenAfter: this.changesDropdownOpen,
        editableChangesCount: this.editableChanges.length,
      });
    }
    if (changes['resultados']) {
      console.debug('[AI_SEARCH_RENDER] codigo=%s resultados=%o', this.searchCodigo, this.resultados);
      this.hydrateVisibleResultAssets();
      this.reportCards = this.getSortedReportResults(this.resultados);
      this.complaintStatusCards = this.getSortedComplaintStatusResults(this.resultados);
      console.debug(
        '[AI_SEARCH_RENDER] renderingComplaintStatus=%s',
        this.isComplaintStatusResponse() && this.complaintStatusCards.length > 0
      );
      this.hydrateReportHistoryImages();
    }
    if (changes['loading']) {
      if (this.loading) {
        this.showResult = false;
        this.smartActionFirstWsReceived = false;
      } else if (this.animationActive) {
        if (this.error) {
          this.showResult = true;
          this.stopLoadingAnimation();
        } else {
          this.httpResponseReady = true;
          if (this.isEmptyAiResponse()) {
            this.wsStepsComplete = true;
          }
          console.log('[AI_SEARCH][HTTP] final response ready', {
            wsStepsComplete: this.wsStepsComplete,
            queueLength: this.progressQueue.length,
            searchCodigo: this.searchCodigo,
          });
          if (this.wsStepsComplete || this.shouldResolveWithoutWsProgress()) {
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
    this.consultaChange.emit('');
    this.closed.emit();
  }

  public onClose(): void {
    if (this.loading) return;
    this.consultaChange.emit('');
    this.closed.emit();
  }

  public onConsultaChange(next: string): void {
    this.consultaChange.emit(String(next || ''));
  }

  public readonly suggestionChips: string[] = [
    'Resume los mensajes no leídos de hoy',
    'Buscar audios de Marcos esta semana',
    'Cambiar tema a claro',
    'Generar informe del grupo Diseño',
  ];

  public applySuggestion(text: string): void {
    if (this.loading || this.animationActive) return;
    this.consulta = text;
    this.consultaChange.emit(text);
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

  public isImageSearchResult(item: AiEncryptedMessageSearchResult): boolean {
    return this.resolveResultMessageType(item) === 'IMAGE';
  }

  public isStickerSearchResult(item: AiEncryptedMessageSearchResult): boolean {
    return this.resolveResultMessageType(item) === 'STICKER';
  }

  public getSearchResultMediaRawUrl(item: AiEncryptedMessageSearchResult): string {
    return String(item?.imageUrl || item?.mediaUrl || '').trim();
  }

  public openSearchResultPreview(item: AiEncryptedMessageSearchResult, event: Event): void {
    event.stopPropagation();
    const url = this.getResultMediaUrl(item);
    if (!url) return;
    const type = this.resolveResultMessageType(item);
    this.searchResultMediaPreviewUrl = url;
    this.searchResultMediaPreviewName = String(
      item?.imageNombre || item?.descripcionTipoMensaje || (type === 'STICKER' ? 'Sticker' : 'Imagen')
    ).trim() || (type === 'STICKER' ? 'Sticker' : 'Imagen');
    this.searchResultMediaPreviewMime = String(item?.imageMime || item?.mimeType || 'image/jpeg').trim() || 'image/jpeg';
    this.searchResultMediaPreviewSize = '';
    this.showSearchResultMediaPreview = true;
    this.cdr.markForCheck();
  }

  public closeSearchResultMediaPreview(): void {
    this.showSearchResultMediaPreview = false;
    this.searchResultMediaPreviewUrl = '';
    this.cdr.markForCheck();
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

  public getLegacyComplaintBadgeClass(item: AiEncryptedMessageSearchResult): Record<string, boolean> {
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
    const key = this.getMediaKey(item);
    this.mediaLoadErrors.add(key);
    const prev = this.hydratedMediaUrls.get(key);
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.hydratedMediaUrls.delete(key);
    const rawUrl = String(item?.imageUrl || item?.mediaUrl || '').trim();
    console.error('[ai-search-popup][media][img-error]', {
      mensajeId: Number(item?.mensajeId || 0),
      rawUrl,
      normalizedUrl: this.normalizeSearchMediaUrl(rawUrl),
    });
    event.stopPropagation();
    this.cdr.markForCheck();
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
      const canResolve =
        this.wsStepsComplete || this.shouldResolveWithoutWsProgress();
      if (!this.animationActive || !this.httpResponseReady || !canResolve) {
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
    if (this.smartActionThinkingVisible && !this.smartActionFirstWsReceived) {
      this.smartActionFirstWsReceived = true;
      console.log('[AI][SMART_ACTION_FIRST_WS] hideThinking=true');
      this.cdr.markForCheck();
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
    const backendMessage = this.sanitizeVisibleText(String(event?.message || '').trim());
    const dedupeKey = `${requestId}:${step}:${rawStatus}:${rawTarget}:${rawPhase}:${backendMessage}`;
    if (this.handledProgressKeys.has(dedupeKey)) {
      console.log('[AI_SEARCH][WS] drop: duplicate', { dedupeKey, event });
      return null;
    }
    this.handledProgressKeys.add(dedupeKey);
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
        // Yield after STARTED so Angular CD fires and user sees spinner
        // before the COMPLETED event (which may already be in queue) replaces it
        if (nextEvent.status === 'STARTED') {
          await new Promise<void>((resolve) => setTimeout(resolve, this.STEP_MIN_MS));
          if (!this.animationActive) break;
        }
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
    if (event.status === 'FAILED') return true;
    if (event.status !== 'COMPLETED') return false;
    return (
      event.step === 'MESSAGE_FOUND' ||
      event.step === 'MESSAGE_NOT_FOUND' ||
      event.step === 'APP_REPORT' ||
      event.step === 'APP_REPORT_STATUS' ||
      event.step === 'UI_CUSTOMIZATION_READY' ||
      event.step === 'UI_CUSTOMIZATION_FAILED' ||
      event.step === 'ERROR'
    );
  }
  private resolveProgressStep(rawStep: string, rawPhase: string, rawTarget: string): string {
    // Only infer from target/phase when rawStep is absent
    if (!rawStep) {
      if (rawTarget === 'APP_REPORT_STATUS' || rawPhase === 'APP_REPORT_STATUS') {
        return 'APP_REPORT_STATUS';
      }
      if (rawTarget === 'APP_REPORT' || rawPhase === 'APP_REPORT') {
        return 'APP_REPORT';
      }
      return rawPhase || rawTarget || 'UNKNOWN';
    }
    return rawStep;
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
    // Backend is source of truth — always show backend message when present
    if (backendMessage) return backendMessage;

    // Fallbacks when backend sends no message
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
      if (status === 'STARTED') return 'Generando reporte...';
      if (status === 'COMPLETED') return 'Reporte generado';
      if (status === 'FAILED') return 'No se pudo generar el reporte';
    }
    if (step === 'APP_REPORT_STATUS') {
      if (status === 'STARTED') return 'Buscando tus reportes...';
      if (status === 'COMPLETED') return 'Busqueda de reportes finalizada';
      if (status === 'FAILED') return 'No se pudo consultar el estado del reporte';
    }
    if (step === 'ERROR') return 'Error al procesar la busqueda';
    if (status === 'STARTED') return 'Procesando...';
    if (status === 'COMPLETED') return 'Completado';
    if (status === 'FAILED') return 'No se pudo completar la operacion';
    return 'Procesando...';
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

  // ─── UI Customization ───────────────────────────────────────────────────────

  public isUiCustomizationResponse(): boolean {
    const target = String(this.uiCustomizationResult?.target || '').trim().toUpperCase();
    const c = String(this.searchCodigo || '').trim().toUpperCase();
    return (
      target === 'UI_CUSTOMIZATION' ||
      c === 'UI_CUSTOMIZATION_OK' ||
      c === 'UI_CUSTOMIZATION_LOW_CONFIDENCE' ||
      c === 'UI_CUSTOMIZATION_NOT_ALLOWED' ||
      c === 'UI_CUSTOMIZATION_NEEDS_CLARIFICATION' ||
      c === 'RESET_THEME'
    );
  }

  public isUiCustomizationLowConfidence(): boolean {
    return (
      this.isUiCustomizationResponse() &&
      String(this.searchCodigo || '').trim().toUpperCase().includes('LOW_CONFIDENCE')
    );
  }

  public isUiCustomizationBlocked(): boolean {
    const codigo = String(this.searchCodigo || '').trim().toUpperCase();
    return (
      this.isUiCustomizationResponse() &&
      (codigo === 'UI_CUSTOMIZATION_NOT_ALLOWED' || codigo === 'UI_CUSTOMIZATION_NEEDS_CLARIFICATION')
    );
  }

  public shouldShowUiCustomizationNotice(): boolean {
    return this.isUiCustomizationLowConfidence() || this.isUiCustomizationBlocked();
  }

  public getUiCustomizationNoticeText(): string {
    const codigo = String(this.searchCodigo || '').trim().toUpperCase();
    if (codigo === 'UI_CUSTOMIZATION_NOT_ALLOWED') {
      return 'Ese cambio no esta permitido en el frontend.';
    }
    if (codigo === 'UI_CUSTOMIZATION_NEEDS_CLARIFICATION') {
      return 'La solicitud necesita mas detalle antes de aplicarse.';
    }
    return 'No estoy completamente seguro de este cambio. Revisalo antes de aplicar.';
  }

  public canExecuteUiCustomization(): boolean {
    if (this.isResetThemeAction()) return true;
    if (this.isUiCustomizationBlocked()) return false;
    if (this.getChangesCount() > 0) {
      return this.selectedChangesCount() > 0;
    }
    const result = this.uiCustomizationResult;
    if (!result) return false;
    // Show buttons if area+property present (value validated on click), or direct cssVariable
    return (!!result.area && !!result.property) || !!String(result.cssVariable || '').trim();
  }

  public isResetThemeAction(): boolean {
    const action = String(this.uiCustomizationResult?.action || '').trim().toUpperCase();
    const codigo = String(this.searchCodigo || '').trim().toUpperCase();
    return action === 'RESET_THEME' || codigo === 'RESET_THEME';
  }

  public isUpdateStyleGroup(): boolean {
    const action = String(this.uiCustomizationResult?.action || '').trim().toUpperCase();
    return action === 'UPDATE_STYLE_GROUP' || action === 'UPDATE_STYLE_MULTI';
  }

  public getChangesCount(): number {
    return this.getDisplayChanges().length;
  }

  public getGroupChanges(): UiCustomizationChange[] {
    if (this.editableChanges.length > 0) {
      return this.editableChanges.map((change) => ({
        area: change.area,
        property: change.property,
        value: change.value,
        valuePreset: change.valuePreset,
      }));
    }
    return this.getDisplayChanges(this.uiCustomizationResult);
  }

  public getDisplayChanges(response?: AiEncryptedMessageSearchResponse | null): UiCustomizationChange[] {
    const source = response ?? this.uiCustomizationResult;
    const groupChanges = ((source as any)?.changes ?? []) as UiCustomizationChange[];
    if (groupChanges.length > 0) {
      return groupChanges.map((change) => ({
        ...change,
        value: String(change.appliedValue ?? change.value ?? '').trim() || change.value || null,
      }));
    }
    const rawSource = source as any;
    const value = String(rawSource?.appliedValue ?? rawSource?.value ?? '').trim();
    const valuePreset = String(rawSource?.valuePreset ?? '').trim();
    if (rawSource?.area && rawSource?.property && (value || valuePreset)) {
      return [{
        area: rawSource.area,
        property: rawSource.property,
        value: value || null,
        valuePreset: valuePreset || null,
        requestedValue: rawSource.requestedValue ?? null,
        appliedValue: rawSource.appliedValue ?? null,
        minAllowedValue: rawSource.minAllowedValue ?? null,
        maxAllowedValue: rawSource.maxAllowedValue ?? null,
        normalized: rawSource.normalized ?? null,
        normalizationReason: rawSource.normalizationReason ?? null,
      }];
    }
    return [];
  }

  public toggleChangesDropdown(event?: Event): void {
    event?.stopPropagation();
    console.log('[UI_CUSTOMIZATION][DROPDOWN] toggle click', {
      dropdownOpenBefore: this.changesDropdownOpen,
      editableChangesCount: this.editableChanges.length,
    });
    if (this.changesDropdownOpen) return;
    this.changesDropdownOpen = true;
    console.log('[UI_CUSTOMIZATION][DROPDOWN] opened', {
      dropdownOpenAfter: this.changesDropdownOpen,
    });
  }

  public getSelectedChanges(): UiCustomizationChange[] {
    if (this.editableChanges.length === 0) {
      return this.getDisplayChanges();
    }
    return this.editableChanges
      .filter((change) => change.selected)
      .map((change) => ({
        area: change.area,
        property: change.property,
        value: change.value,
        valuePreset: change.valuePreset,
      }));
  }

  public selectedChangesCount(): number {
    return this.getSelectedChanges().length;
  }

  public hasInvalidSelectedChanges(): boolean {
    return this.editableChanges.some((change) => change.selected && !!change.colorError);
  }

  public toggleChangeSelected(change: EditableUiCustomizationChange, event?: Event): void {
    event?.stopPropagation();
    change.selected = !change.selected;
    if (this.customizationPreviewActive) this.reapplyGroupPreview();
  }

  public applySingleChange(change: EditableUiCustomizationChange, event?: Event): void {
    event?.stopPropagation();
    if (!change.selected || !!change.colorError) return;
    const singleChange: UiCustomizationChange = {
      area: change.area,
      property: change.property,
      value: change.value,
      valuePreset: change.valuePreset,
    };
    if (this.customizationPreviewActive) {
      this.uiCustomizationService.cancelPreview();
      this.customizationPreviewActive = false;
    }
    const ok = this.uiCustomizationService.applyCustomizationGroup([singleChange]);
    if (ok && this.getSelectedChanges().length > 0) {
      this.customizationPreviewActive = this.uiCustomizationService.previewCustomizationGroup(this.getSelectedChanges());
    }
    this.customizationFeedback = ok ? 'Cambio aplicado ✓' : 'No se pudo aplicar esta personalizacion.';
    this.cdr.markForCheck();
  }

  public onEditableValueInput(change: EditableUiCustomizationChange, newValue: string): void {
    console.log('[UI_CUSTOMIZATION][DROPDOWN] value input', {
      area: change.area,
      property: change.property,
      prevValue: change.value,
      newValue,
      dropdownOpen: this.changesDropdownOpen,
    });
    change.value = String(newValue || '').trim();
    this.applyEditableChange(change);
  }

  public onEditableNumericValueInput(change: EditableUiCustomizationChange, newValue: string): void {
    console.log('[UI_CUSTOMIZATION][DROPDOWN] numeric value input', {
      area: change.area,
      property: change.property,
      prevValue: change.value,
      newValue,
      dropdownOpen: this.changesDropdownOpen,
    });
    const normalized = String(newValue || '').trim();
    change.value = normalized ? `${normalized}px` : '';
    this.applyEditableChange(change);
  }

  public openValueEditor(change: EditableUiCustomizationChange, event?: Event): void {
    event?.stopPropagation();
    if (!this.isEditableProperty(change.property) || !change.selected) return;
    const key = this.getEditableChangeKey(change);
    this.activeColorEditorKey = this.activeColorEditorKey === key ? null : key;
  }

  public closeColorEditor(event?: Event): void {
    event?.stopPropagation();
    this.activeColorEditorKey = null;
  }

  public isColorEditorOpen(change: EditableUiCustomizationChange): boolean {
    return this.activeColorEditorKey === this.getEditableChangeKey(change);
  }

  public stopEvent(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
  }

  public stopPropagationOnly(event?: Event): void {
    event?.stopPropagation();
  }

  private getEditableChangeKey(change: UiCustomizationChange): string {
    return `${change.area || 'AREA'}:${change.property || 'PROPERTY'}`;
  }

  public applyEditableChange(change: EditableUiCustomizationChange): void {
    const normalized = String(change.value || '').trim();
    if (!this.isValidEditableValue(change.property, normalized, change)) {
      change.colorError = this.getInvalidChangeMessage(change, normalized);
      this.cdr.markForCheck();
      return;
    }
    change.colorError = null;
    change.value = normalized;
    if (this.customizationPreviewActive) {
      this.reapplyGroupPreview();
    } else {
      this.cdr.markForCheck();
    }
  }

  public getChangeIconClass(area?: string): string {
    const normalized = String(area || '').trim().toUpperCase();
    if (normalized.includes('SIDEBAR')) return 'bi-layout-sidebar-inset';
    if (normalized.includes('FILTER')) return 'bi-funnel';
    if (normalized.includes('SEARCH')) return 'bi-search';
    if (normalized.includes('ICON')) return 'bi-stars';
    if (normalized.includes('HEADER')) return 'bi-type-h3';
    if (normalized.includes('BADGE')) return 'bi-circle-fill';
    return 'bi-palette';
  }

  public trackByCustomizationChange(index: number, change: UiCustomizationChange): string {
    return `${change.area || 'AREA'}:${change.property || 'PROPERTY'}:${index}`;
  }

  public getReadableAreaLabel(area: string): string {
    const staticLabels: Record<string, string> = {
      CHAT_LIST_PANEL: 'Listado de chats',
      CHAT_LIST_HEADER: 'Encabezado de chats',
      CHAT_LIST_TITLE: 'Titulo del encabezado de chats',
      CHAT_LIST_HEADER_ACTIONS: 'Iconos del encabezado de chats',
      CHAT_LIST_SEARCH: 'Buscador del listado',
      CHAT_LIST_FILTERS: 'Filtros del listado',
      CHAT_LIST_FILTER_BUTTONS: 'Botones de filtro',
      CHAT_LIST_FILTER_BUTTONS_ACTIVE: 'Filtro activo',
      CHAT_LIST_ITEM: 'Chat individual',
      CHAT_LIST_ITEM_GROUP: 'Chat grupal',
      CHAT_LIST_ITEM_ACTIVE: 'Chat seleccionado',
      CHAT_LIST_ITEM_GROUP_ACTIVE: 'Chat grupal seleccionado',
      CHAT_LIST_ITEM_UNREAD: 'Chat no leido',
      CHAT_LIST_PREVIEW: 'Ultimo mensaje',
      CHAT_LIST_ITEM_PREVIEW: 'Ultimo mensaje de chat individual',
      CHAT_LIST_ITEM_GROUP_PREVIEW: 'Ultimo mensaje de chat grupal',
      CHAT_LIST_BADGES: 'Contadores del listado',
      CHAT_LIST_ITEM_GROUP_BADGES: 'Contador de grupo',
      CHAT_LIST_PIN_MENU: 'Desplegable de opciones del chat',
      CHAT_LIST_PIN_MENU_ITEM: 'Opciones del desplegable del chat',
      CHAT_LIST_PIN_MENU_REPORT: 'Opcion denunciar del desplegable',
      CHAT_LIST_PIN_MENU_DANGER: 'Opcion peligrosa del desplegable',
      CHAT_LIST_ACTIONS_MENU: 'Menu superior del listado',
      CHAT_LIST_ACTIONS_MENU_ITEM: 'Opcion del menu superior',
      CHAT_LIST_PIN_TOGGLE: 'Icono para abrir opciones del chat',
      SIDEBAR_NAV_PANEL: 'Barra lateral',
      SIDEBAR_NAV_GROUP: 'Zona superior de la barra lateral',
      SIDEBAR_NAV_BOTTOM: 'Zona inferior de la barra lateral',
      SIDEBAR_NAV_ITEM: 'Boton del menu lateral',
      SIDEBAR_NAV_ITEM_ACTIVE: 'Boton activo del menu lateral',
      SIDEBAR_NAV_ACTIVE_INDICATOR: 'Indicador activo del menu lateral',
      SIDEBAR_NAV_LOGO: 'Logo N del menu lateral',
      SIDEBAR_NAV_ICON: 'Iconos del menu lateral',
      SIDEBAR_NAV_ICON_ACTIVE: 'Iconos activos del menu lateral',
      SIDEBAR_NAV_AI_ICON: 'Icono de Nexo IA',
      SIDEBAR_NAV_TOOLTIP: 'Tooltip del menu lateral',
      SIDEBAR_NAV_AVATAR: 'Avatar del menu lateral',
      SIDEBAR_NAV_SETTINGS: 'Ajustes del menu lateral',
    };
    const normalized = String(area || '').trim().toUpperCase();
    if (staticLabels[normalized]) return staticLabels[normalized];
    const catalogLabel = (NEXO_CUSTOMIZABLE_AREAS as Record<string, { label?: string }>)[normalized]?.label;
    if (catalogLabel) return catalogLabel;
    return this.humanizeTechnicalName(normalized);
  }

  public getReadablePropertyLabel(property: string): string {
    const labels: Record<string, string> = {
      BACKGROUND_COLOR: 'Fondo',
      TEXT_COLOR: 'Texto',
      ICON_COLOR: 'Icono',
      BORDER_COLOR: 'Color del borde',
      BORDER_WIDTH: 'Grosor del borde',
      BORDER_RADIUS: 'Redondeado',
      HOVER_BACKGROUND_COLOR: 'Fondo al pasar el raton',
      HOVER_TEXT_COLOR: 'Texto al pasar el raton',
      HOVER_ICON_COLOR: 'Icono al pasar el raton',
      PLACEHOLDER_COLOR: 'Placeholder',
      PREVIEW_SENDER_TEXT_COLOR: 'Nombre del remitente',
      LABEL_COLOR: 'Etiqueta',
      SEPARATOR_COLOR: 'Separador',
      TIME_COLOR: 'Hora',
      SHADOW: 'Sombra',
      OPACITY: 'Opacidad',
      FONT_SIZE: 'Tamano de texto',
      FONT_WEIGHT: 'Grosor de texto',
    };
    const normalized = String(property || '').trim().toUpperCase();
    return labels[normalized] || this.humanizeTechnicalName(normalized);
  }

  public humanizeTechnicalName(value?: string): string {
    if (!value) return 'Cambio';
    return value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  public isColorValue(value?: string | null): boolean {
    return !!value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
  }

  public isColorProperty(property: string): boolean {
    return [
      'BACKGROUND_COLOR',
      'TEXT_COLOR',
      'ICON_COLOR',
      'BORDER_COLOR',
      'HOVER_BACKGROUND_COLOR',
      'HOVER_TEXT_COLOR',
      'HOVER_ICON_COLOR',
      'PLACEHOLDER_COLOR',
      'PREVIEW_SENDER_TEXT_COLOR',
      'LABEL_COLOR',
      'SEPARATOR_COLOR',
      'TIME_COLOR',
    ].includes(String(property || '').trim().toUpperCase());
  }

  public isSizeProperty(property: string): boolean {
    return [
      'FONT_SIZE',
      'BORDER_WIDTH',
      'BORDER_RADIUS',
      'WIDTH',
      'HEIGHT',
    ].includes(String(property || '').trim().toUpperCase());
  }

  public isEditableProperty(property: string): boolean {
    return this.isColorProperty(property) || this.isSizeProperty(property);
  }

  public isSafeSizeValue(value?: string | null): boolean {
    return !!value && /^(0|[0-9]{1,3}(\.[0-9]{1,2})?)(px|rem|em|%)$/.test(value);
  }

  public isPxValue(value?: string | null): boolean {
    return !!value && /^(0|[0-9]{1,3}(\.[0-9]{1,2})?)px$/.test(value);
  }

  public getChangeDisplayValue(change: UiCustomizationChange): string {
    return String(change.value ?? change.valuePreset ?? '').trim();
  }

  public isValidEditableValue(property: string, value?: string | null, change?: UiCustomizationChange): boolean {
    if (this.isColorProperty(property)) return this.isColorValue(value);
    if (this.isSizeProperty(property)) {
      if (!this.isSafeSizeValue(value)) return false;
      return this.isWithinAllowedRange(change, value);
    }
    return !!String(value || '').trim();
  }

  public hasAllowedRange(change: UiCustomizationChange): boolean {
    return this.parseNumericAllowedValue(change.minAllowedValue) != null || this.parseNumericAllowedValue(change.maxAllowedValue) != null;
  }

  public getAllowedRangeLabel(change: UiCustomizationChange): string | null {
    const min = this.getNormalizedAllowedValueLabel(change.minAllowedValue);
    const max = this.getNormalizedAllowedValueLabel(change.maxAllowedValue);
    if (!min && !max) return null;
    if (min && max) return `Permitido: ${min} - ${max}`;
    if (min) return `Minimo permitido: ${min}`;
    return `Maximo permitido: ${max}`;
  }

  public shouldShowNormalizedNotice(change: UiCustomizationChange): boolean {
    return !!change.normalized && (!!change.requestedValue || !!change.appliedValue || !!change.normalizationReason || this.hasAllowedRange(change));
  }

  public getNormalizedNotice(change: UiCustomizationChange): string {
    const requested = this.getNormalizedAllowedValueLabel(change.requestedValue);
    const applied = this.getNormalizedAllowedValueLabel(change.appliedValue || change.value);
    const rangeLabel = this.getAllowedRangeLabel(change);
    if (requested && applied && requested !== applied) {
      return rangeLabel
        ? `Se ajusto de ${requested} a ${applied}. ${rangeLabel}.`
        : `Se ajusto de ${requested} a ${applied}.`;
    }
    if (change.normalizationReason) {
      return rangeLabel ? `${change.normalizationReason}. ${rangeLabel}.` : `${change.normalizationReason}.`;
    }
    return rangeLabel || 'Se ajusto el valor segun las restricciones permitidas.';
  }

  public shouldUseNumericPxEditor(change: UiCustomizationChange): boolean {
    return this.isSizeProperty(change.property) && (this.hasAllowedRange(change) || this.isPxValue(change.value) || this.isPxValue(change.appliedValue));
  }

  public getNumericEditorValue(change: UiCustomizationChange): number | null {
    return this.parseNumericAllowedValue(change.value);
  }

  public getNumericEditorMin(change: UiCustomizationChange): number | null {
    return this.parseNumericAllowedValue(change.minAllowedValue);
  }

  public getNumericEditorMax(change: UiCustomizationChange): number | null {
    return this.parseNumericAllowedValue(change.maxAllowedValue);
  }

  public getValueEditorPlaceholder(property: string): string {
    if (String(property || '').trim().toUpperCase() === 'FONT_SIZE') {
      return '13px o 1rem';
    }
    if (String(property || '').trim().toUpperCase() === 'BORDER_WIDTH') {
      return '0px a 4px';
    }
    if (String(property || '').trim().toUpperCase() === 'BORDER_RADIUS') {
      return '12px';
    }
    return 'Valor';
  }

  private getInvalidChangeMessage(change: UiCustomizationChange, value: string): string {
    if (this.isColorProperty(change.property)) {
      return 'Color HEX invalido';
    }
    if (this.isSizeProperty(change.property)) {
      if (!this.isSafeSizeValue(value)) {
        return 'Usa un valor seguro, por ejemplo 13px o 1rem';
      }
      const min = this.getNormalizedAllowedValueLabel(change.minAllowedValue);
      const max = this.getNormalizedAllowedValueLabel(change.maxAllowedValue);
      if (min && max) return `Valor fuera de rango. Permitido: ${min} - ${max}`;
      if (min) return `Valor menor del minimo permitido: ${min}`;
      if (max) return `Valor mayor del maximo permitido: ${max}`;
    }
    return 'Valor no permitido';
  }

  private isWithinAllowedRange(change: UiCustomizationChange | undefined, value?: string | null): boolean {
    if (!change) return true;
    const numericValue = this.parseNumericAllowedValue(value);
    const min = this.parseNumericAllowedValue(change.minAllowedValue);
    const max = this.parseNumericAllowedValue(change.maxAllowedValue);
    if (numericValue == null) return min == null && max == null;
    if (min != null && numericValue < min) return false;
    if (max != null && numericValue > max) return false;
    return true;
  }

  private parseNumericAllowedValue(value?: string | null): number | null {
    const normalized = String(value || '').trim();
    const match = normalized.match(/^([0-9]{1,3}(?:\.[0-9]{1,2})?)(px|rem|em|%)$/);
    if (!match) return null;
    return Number(match[1]);
  }

  private getNormalizedAllowedValueLabel(value?: string | null): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private resetEditableCustomizationChanges(): void {
    const changes = this.getDisplayChanges(this.uiCustomizationResult);
    this.activeColorEditorKey = null;
    this.editableChanges = changes.map((change) => ({
      ...change,
      value: String(change.appliedValue || change.value || change.valuePreset || '').trim(),
      selected: true,
      colorError: null,
    }));
    for (const change of this.editableChanges) {
      this.applyEditableChange(change);
    }
    console.log('[UI_CUSTOMIZATION][DROPDOWN] reset editable changes', {
      mappedCount: this.editableChanges.length,
      dropdownOpen: this.changesDropdownOpen,
    });
  }

  private reapplyGroupPreview(): void {
    if (!this.customizationPreviewActive) return;
    this.uiCustomizationService.cancelPreview();
    const selectedChanges = this.getSelectedChanges();
    if (selectedChanges.length === 0) {
      this.customizationPreviewActive = false;
      this.cdr.markForCheck();
      return;
    }
    this.customizationPreviewActive = this.uiCustomizationService.previewCustomizationGroup(selectedChanges);
    this.cdr.markForCheck();
  }

  public getCustomizationLabel(): string {
    return String(
      this.uiCustomizationResult?.label ||
      this.uiCustomizationResult?.mensaje ||
      'Personalización solicitada'
    ).trim();
  }

  public onPreviewCustomization(): void {
    if (!this.canExecuteUiCustomization()) return;
    if (this.hasInvalidSelectedChanges()) {
      this.customizationFeedback = 'Corrige los valores invalidos antes de previsualizar.';
      this.cdr.markForCheck();
      return;
    }

    const _action = String(this.uiCustomizationResult?.action || '').toUpperCase();

    if (this.getChangesCount() > 0) {
      const changes = this.getSelectedChanges();
      console.log(
        `[UI_CUSTOMIZATION][POPUP_PREVIEW] action=${_action} changesCount=${changes.length}` +
        ` area=${changes[0]?.area ?? '-'} property=${changes[0]?.property ?? '-'}`
      );
      if (changes.length === 0) {
        this.customizationFeedback = 'Selecciona al menos un cambio.';
        this.cdr.markForCheck();
        return;
      }
      const ok = this.uiCustomizationService.previewCustomizationGroup(changes);
      if (ok) {
        this.customizationPreviewActive = true;
        this.customizationFeedback = null;
      } else {
        this.customizationFeedback = 'No se pudo aplicar esta personalización.';
      }
      this.cdr.markForCheck();
      return;
    }

    const result = this.uiCustomizationResult;
    if (!result) return;
    const value = String((result as any)?.value || '').trim();
    if (!value) {
      this.customizationFeedback = 'No se pudo aplicar esta personalización.';
      this.cdr.markForCheck();
      return;
    }

    console.log(
      `[UI_CUSTOMIZATION][POPUP_PREVIEW] action=${_action} changesCount=1` +
      ` area=${result.area ?? '-'} property=${result.property ?? '-'}`
    );
    let ok = false;
    if (result.area && result.property) {
      ok = this.uiCustomizationService.previewCustomization(
        result.area as NexoAreaId,
        result.property as NexoCssProperty,
        value
      );
    } else if (result.cssVariable) {
      ok = this.uiCustomizationService.previewByCssVariable(result.cssVariable, value);
    }

    if (ok) {
      this.customizationPreviewActive = true;
      this.customizationFeedback = null;
    } else {
      this.customizationFeedback = 'No se pudo aplicar esta personalización.';
    }
    this.cdr.markForCheck();
  }

  public onApplyCustomization(): void {
    if (!this.canExecuteUiCustomization()) return;
    if (this.hasInvalidSelectedChanges()) {
      this.customizationFeedback = 'Corrige los valores invalidos antes de aplicar.';
      this.cdr.markForCheck();
      return;
    }

    const _action = String(this.uiCustomizationResult?.action || '').toUpperCase();

    if (this.getChangesCount() > 0) {
      const changes = this.getSelectedChanges();
      console.log(
        `[UI_CUSTOMIZATION][POPUP_APPLY] action=${_action} changesCount=${changes.length}` +
        ` area=${changes[0]?.area ?? '-'} property=${changes[0]?.property ?? '-'}` +
        ` previewActive=${this.customizationPreviewActive}`
      );
      if (changes.length === 0) {
        this.customizationFeedback = 'Selecciona al menos un cambio.';
        this.cdr.markForCheck();
        return;
      }
      let ok: boolean;
      if (this.customizationPreviewActive) {
        this.uiCustomizationService.confirmPreview();
        ok = true;
      } else {
        ok = this.uiCustomizationService.applyCustomizationGroup(changes);
      }
      this.customizationPreviewActive = false;
      this.customizationFeedback = ok ? 'Cambios aplicados ✓' : 'No se pudo aplicar esta personalización.';
      this.cdr.markForCheck();
      return;
    }

    const result = this.uiCustomizationResult;
    if (!result) return;
    const value = String((result as any)?.value || '').trim();
    if (!value) {
      this.customizationFeedback = 'No se pudo aplicar esta personalización.';
      this.cdr.markForCheck();
      return;
    }

    console.log(
      `[UI_CUSTOMIZATION][POPUP_APPLY] action=${_action} changesCount=1` +
      ` area=${result.area ?? '-'} property=${result.property ?? '-'}` +
      ` previewActive=${this.customizationPreviewActive}`
    );
    let ok = false;
    if (this.customizationPreviewActive) {
      this.uiCustomizationService.confirmPreview();
      ok = true;
    } else if (result.area && result.property) {
      ok = this.uiCustomizationService.applyCustomization(
        result.area as NexoAreaId,
        result.property as NexoCssProperty,
        value
      );
    } else if (result.cssVariable) {
      ok = this.uiCustomizationService.applyByCssVariable(result.cssVariable, value);
    }

    this.customizationPreviewActive = false;
    this.customizationFeedback = ok ? 'Cambio aplicado ✓' : 'No se pudo aplicar esta personalización.';
    this.cdr.markForCheck();
  }

  public onCancelCustomization(): void {
    const wasPreviewActive = this.customizationPreviewActive;
    if (wasPreviewActive) {
      this.uiCustomizationService.cancelPreview();
      this.customizationPreviewActive = false;
      this.customizationFeedback = 'Personalización cancelada';
    } else {
      this.customizationFeedback = null;
    }
    this.cdr.markForCheck();
  }

  public onResetTheme(): void {
    this.uiCustomizationService.resetTheme();
    this.customizationPreviewActive = false;
    this.customizationFeedback = 'Tema restaurado ✓';
    this.cdr.markForCheck();
  }

  // ─── End UI Customization ───────────────────────────────────────────────────

  public isAppReportStatusResponse(): boolean {
    return String(this.searchCodigo || '').trim().toUpperCase() === 'APP_REPORT_STATUS_OK';
  }

  public isComplaintStatusResponse(): boolean {
    return String(this.searchCodigo || '').trim().toUpperCase() === 'COMPLAINT_STATUS_OK';
  }

  public isEmptyAiResponse(): boolean {
    if (this.awaitingClarification) return false;
    const codigo = String(this.searchCodigo || '').trim().toUpperCase();
    return codigo.endsWith('_EMPTY');
  }

  public getEmptyAiResponseMessage(): string {
    const codigo = String(this.searchCodigo || '').trim().toUpperCase();
    if (codigo === 'COMPLAINT_STATUS_EMPTY') {
      return 'No se encontraron denuncias para esa búsqueda.';
    }
    if (codigo === 'APP_REPORT_STATUS_EMPTY') {
      return 'No se encontraron reportes para esa búsqueda.';
    }
    return 'Sin resultados.';
  }

  public getReportCards(): ReportCard[] {
    return this.reportCards;
  }

  public getComplaintStatusCards(): ComplaintStatusCard[] {
    return this.complaintStatusCards;
  }

  public trackByVisibleProgressEvent(_index: number, event: VisibleAiProgressEvent): string {
    return `${event.requestId}:${event.step}`;
  }

  public trackByReporteId(_index: number, item: ReportCard): string {
    return item.key;
  }

  public trackByComplaintId(_index: number, item: ComplaintStatusCard): string {
    return item.key;
  }

  public trackByHistoryItem(_index: number, item: ReportHistoryItem): string {
    return item.key;
  }

  public trackByComplaintHistoryItem(_index: number, item: ComplaintHistoryItem): string {
    return item.key;
  }

  public trackBySearchResult(index: number, result: AiEncryptedMessageSearchResult): string | number {
    const tipo = String(result?.tipoResultado || '').trim().toUpperCase();
    if (tipo === 'APP_REPORT_STATUS') return this.normalizeReportGroupKey(result);
    if (tipo === 'COMPLAINT_STATUS') return this.normalizeComplaintGroupKey(result);
    const mensajeId = Number(result?.mensajeId || 0);
    if (Number.isFinite(mensajeId) && mensajeId > 0) return mensajeId;
    return index;
  }

  public getVisibleProgressEventIconClass(event: VisibleAiProgressEvent): string {
    return event.iconClass;
  }

  public shouldShowSmartActionThinking(): boolean {
    return this.smartActionThinkingVisible && this.loading && !this.smartActionFirstWsReceived && this.visibleProgressEvents.length === 0;
  }

  public getSortedReportResults(resultados: AiEncryptedMessageSearchResult[]): ReportCard[] {
    return (resultados || [])
      .filter((result) => String(result?.tipoResultado || '').trim().toUpperCase() === 'APP_REPORT_STATUS')
      .map((result) => this.mapReportCard(result));
  }

  public getSortedComplaintStatusResults(resultados: AiEncryptedMessageSearchResult[]): ComplaintStatusCard[] {
    if (!this.isComplaintStatusResponse()) return [];
    return (resultados || [])
      .filter((result) => this.isComplaintStatusResult(result))
      .map((result) => this.mapComplaintStatusCard(result));
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

  public normalizeComplaintGroupKey(result: AiEncryptedMessageSearchResult): string {
    const complaintId = Number(result?.denunciaId || 0);
    if (Number.isFinite(complaintId) && complaintId > 0) return `complaint-id:${complaintId}`;
    const motivo = String(result?.motivoDenuncia || result?.motivo || '').trim().toUpperCase();
    const detalle = String(result?.detalleDenuncia || result?.contenido || '').trim().toUpperCase();
    return `complaint:${motivo}:${detalle}`;
  }

  public isComplaintStatusResult(result: AiEncryptedMessageSearchResult | null | undefined): boolean {
    const tipo = String(result?.tipoResultado || '').trim().toUpperCase();
    const hasComplaintTipo =
      tipo === 'COMPLAINT_STATUS' ||
      tipo === 'COMPLAINT_CREATED' ||
      tipo === 'COMPLAINT_RECEIVED';
    const denunciaId = Number(result?.denunciaId || 0);
    const hasDenunciaId = Number.isFinite(denunciaId) && denunciaId > 0;
    const hasHistory = Array.isArray(result?.historialDenuncia) && result!.historialDenuncia!.length > 0;
    return hasComplaintTipo || hasDenunciaId || hasHistory;
  }

  public getComplaintStatusLabel(
    resultOrStatus: AiEncryptedMessageSearchResult | ComplaintHistoryItem | string | null | undefined
  ): string {
    const estado = typeof resultOrStatus === 'string'
      ? String(resultOrStatus || '').trim().toUpperCase()
      : String(
          (resultOrStatus as AiEncryptedMessageSearchResult)?.estadoDenuncia ||
          (resultOrStatus as ComplaintHistoryItem)?.estadoNuevo ||
          ''
        ).trim().toUpperCase();
    if (estado === 'PENDIENTE') return 'Pendiente';
    if (estado === 'EN_REVISION') return 'En revisión';
    if (estado === 'RESUELTA') return 'Resuelta';
    if (estado === 'DESCARTADA') return 'Descartada';
    return estado || 'Desconocido';
  }

  public getComplaintBadgeClass(status: string | null | undefined): string {
    const estado = String(status || '').trim().toUpperCase();
    if (estado === 'PENDIENTE') return 'badge-pendiente';
    if (estado === 'EN_REVISION') return 'badge-revision';
    if (estado === 'RESUELTA') return 'badge-aprobada';
    if (estado === 'DESCARTADA') return 'badge-rechazada';
    return 'badge-pendiente';
  }

  public getComplaintCircleClass(status: string | null | undefined): string {
    const estado = String(status || '').trim().toUpperCase();
    if (estado === 'PENDIENTE') return 'status-circle--pendiente';
    if (estado === 'EN_REVISION') return 'status-circle--revision';
    if (estado === 'RESUELTA') return 'status-circle--aprobada';
    if (estado === 'DESCARTADA') return 'status-circle--rechazada';
    return 'status-circle--pendiente';
  }

  public getComplaintIconClass(status: string | null | undefined): string {
    const estado = String(status || '').trim().toUpperCase();
    if (estado === 'PENDIENTE') return 'bi bi-hourglass-split';
    if (estado === 'EN_REVISION') return 'bi bi-clock';
    if (estado === 'RESUELTA') return 'bi bi-check-lg';
    if (estado === 'DESCARTADA') return 'bi bi-x-lg';
    return 'bi bi-hourglass-split';
  }

  public getComplaintDateText(item: ComplaintHistoryItem): string {
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

  private mapComplaintStatusCard(result: AiEncryptedMessageSearchResult): ComplaintStatusCard {
    return {
      key: this.normalizeComplaintGroupKey(result),
      denunciaId: Number.isFinite(Number(result?.denunciaId)) && Number(result?.denunciaId) > 0 ? Number(result?.denunciaId) : null,
      estadoDenuncia: String(result?.estadoDenuncia || '').trim().toUpperCase() || 'PENDIENTE',
      motivoDenuncia: String(result?.motivoDenuncia || result?.motivo || '').trim(),
      detalleDenuncia: String(result?.detalleDenuncia || result?.contenido || result?.contenidoVisible || '').trim(),
      denuncianteNombre: String(result?.denuncianteNombre || '').trim() || null,
      denunciadoNombre: String(result?.denunciadoNombre || result?.nombreUsuarioDenunciado || '').trim() || null,
      chatId: Number.isFinite(Number(result?.chatId)) && Number(result?.chatId) > 0 ? Number(result?.chatId) : null,
      chatNombreSnapshot: String(
        result?.chatNombreSnapshotDenuncia ||
        result?.chatNombreSnapshot ||
        result?.nombreChatGrupal ||
        ''
      ).trim() || null,
      fechaDenuncia: String(result?.fechaDenuncia || result?.createdAt || result?.fechaEnvio || '').trim(),
      mejorResultadoAproximado: result?.mejorResultadoAproximado === true || result?.resultadoAproximado === true,
      relevancia: typeof result?.relevancia === 'number' && Number.isFinite(result.relevancia) ? result.relevancia : null,
      historialDenuncia: this.buildComplaintHistory(result),
    };
  }

  private buildComplaintHistory(result: AiEncryptedMessageSearchResult): ComplaintHistoryItem[] {
    const rawHistory = Array.isArray(result?.historialDenuncia) ? result.historialDenuncia : [];
    const history = rawHistory
      .map((item, index) => this.mapComplaintHistoryItem(item, result, index))
      .filter((item): item is ComplaintHistoryItem => !!item);
    if (history.length > 0) return [...history];
    return [this.buildFallbackComplaintHistoryItem(result)];
  }

  private mapComplaintHistoryItem(
    item: AiEncryptedMessageSearchComplaintHistoryItem | null | undefined,
    result: AiEncryptedMessageSearchResult,
    index: number
  ): ComplaintHistoryItem | null {
    const estadoNuevo = String(item?.estadoNuevo || '').trim().toUpperCase();
    const fecha = String(item?.fecha || '').trim();
    if (!estadoNuevo && !fecha && !item?.motivo && !item?.detalle && !item?.resolucionMotivo) return null;
    return {
      key: `${this.normalizeComplaintGroupKey(result)}:history:${index}:${estadoNuevo || 'UNKNOWN'}:${fecha || 'no-date'}`,
      estadoAnterior: item?.estadoAnterior ? String(item.estadoAnterior).trim().toUpperCase() : null,
      estadoNuevo: estadoNuevo || String(result?.estadoDenuncia || '').trim().toUpperCase() || 'PENDIENTE',
      estadoLabel: item?.estadoLabel ? String(item.estadoLabel).trim() : null,
      motivo: String(item?.motivo || result?.motivoDenuncia || result?.motivo || '').trim(),
      detalle: String(item?.detalle || result?.detalleDenuncia || result?.contenido || '').trim() || null,
      resolucionMotivo: String(item?.resolucionMotivo || '').trim() || null,
      fecha,
      adminId: Number.isFinite(Number(item?.adminId)) ? Number(item?.adminId) : null,
      accion: String(item?.accion || '').trim() || null,
      timestampMs: this.parseReportDate(fecha)?.getTime() ?? 0,
    };
  }

  private buildFallbackComplaintHistoryItem(result: AiEncryptedMessageSearchResult): ComplaintHistoryItem {
    const estado = String(result?.estadoDenuncia || '').trim().toUpperCase() || 'PENDIENTE';
    const accion = estado === 'PENDIENTE' ? 'CREACION' : 'CAMBIO_ESTADO';
    const fecha = String(result?.fechaDenuncia || result?.createdAt || result?.fechaEnvio || '').trim();
    return {
      key: `${this.normalizeComplaintGroupKey(result)}:history:fallback`,
      estadoAnterior: null,
      estadoNuevo: estado,
      estadoLabel: null,
      motivo: String(result?.motivoDenuncia || result?.motivo || '').trim(),
      detalle: String(result?.detalleDenuncia || result?.contenido || result?.contenidoVisible || '').trim() || null,
      resolucionMotivo: String(result?.resolucionMotivo || '').trim() || null,
      fecha,
      adminId: null,
      accion,
      timestampMs: this.parseReportDate(fecha)?.getTime() ?? 0,
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
      if (!rawUrl || this.hydratedMediaUrls.has(key) || this.hydratingMediaKeys.has(key) || this.mediaLoadErrors.has(key)) continue;

      if (type === 'IMAGE' || type === 'STICKER') {
        // Fetch directly with JWT interceptor — backend decrypts for admin.
        // No proxy needed; chatId/mensajeId not required for this path.
        this.hydrateImageOrStickerResult(item, rawUrl, key);
      } else {
        // AUDIO: use proxy (requires chatId/mensajeId for auth check)
        const chatId = Number(item?.chatId || 0);
        const mensajeId = Number(item?.mensajeId || 0);
        if (!Number.isFinite(chatId) || chatId <= 0 || !Number.isFinite(mensajeId) || mensajeId <= 0) {
          const audioPayload = this.parseAudioE2EPayload(this.getAttachmentPayloadSource(item));
          if (!audioPayload) {
            this.hydratedMediaUrls.set(key, rawUrl);
            this.mediaLoadErrors.delete(key);
            this.cdr.markForCheck();
          }
          continue;
        }
        this.hydrateAudioResult(item, rawUrl, key, chatId, mensajeId);
      }
    }
  }

  private normalizeSearchMediaUrl(rawUrl: string): string {
    return resolveMediaUrl(rawUrl, environment.backendBaseUrl);
  }

  private hydrateImageOrStickerResult(
    item: AiEncryptedMessageSearchResult,
    rawUrl: string,
    key: string
  ): void {
    const mensajeId = Number(item?.mensajeId || 0);
    const chatId = Number(item?.chatId || 0);
    const type = this.resolveResultMessageType(item);
    const imagePayload = this.parseImageE2EPayload(this.getAttachmentPayloadSource(item));
    // Use relative URL for proxy (same as InicioComponent). rawUrl may already be normalized.
    const relativeUrl = String(imagePayload?.imageUrl || item?.imageUrl || item?.mediaUrl || '').trim();
    const fallbackUrl = rawUrl || this.normalizeSearchMediaUrl(relativeUrl);

    console.log('[ai-search-popup][media][hydrate-start]', { mensajeId, tipo: type, relativeUrl, chatId });

    if (!relativeUrl && !fallbackUrl) {
      this.mediaLoadErrors.add(key);
      this.cdr.markForCheck();
      return;
    }

    this.hydratingMediaKeys.add(key);

    const useProxy = Number.isFinite(chatId) && chatId > 0 && Number.isFinite(mensajeId) && mensajeId > 0;
    const fetchPromise: Promise<Blob> = useProxy
      ? this.mensajeriaService.downloadChatAttachmentBlob(relativeUrl || fallbackUrl, chatId, mensajeId, 1)
      : firstValueFrom(this.http.get(fallbackUrl, { responseType: 'blob' }));

    void fetchPromise
      .then(async (blob) => {
        if (!blob) throw new Error('EMPTY_BLOB');
        let safeBlob: Blob;
        if (imagePayload) {
          safeBlob = await this.decryptImageBlobFromPayload(blob, imagePayload, item);
        } else {
          safeBlob = this.normalizeAssetBlobMime(blob, item, type);
        }
        const objectUrl = URL.createObjectURL(safeBlob);
        const previous = this.hydratedMediaUrls.get(key);
        if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
        this.hydratedMediaUrls.set(key, objectUrl);
        this.mediaLoadErrors.delete(key);
        console.log('[ai-search-popup][media][hydrate-ok]', { mensajeId, hasPreview: true });
      })
      .catch((err: unknown) => {
        this.hydratedMediaUrls.delete(key);
        this.mediaLoadErrors.add(key);
        console.error('[ai-search-popup][media][hydrate-error]', { mensajeId, error: err });
      })
      .finally(() => {
        this.hydratingMediaKeys.delete(key);
        this.cdr.markForCheck();
      });
  }

  private hydrateAudioResult(
    item: AiEncryptedMessageSearchResult,
    rawUrl: string,
    key: string,
    chatId: number,
    mensajeId: number
  ): void {
    this.hydratingMediaKeys.add(key);
    void this.mensajeriaService
      .downloadChatAttachmentBlob(rawUrl, chatId, mensajeId, 1)
      .then(async (blob) => {
        const audioPayload = this.parseAudioE2EPayload(this.getAttachmentPayloadSource(item));
        const safeBlob = audioPayload
          ? await this.decryptAudioBlobFromPayload(blob, audioPayload, item)
          : this.normalizeAssetBlobMime(blob, item, 'AUDIO');
        const objectUrl = URL.createObjectURL(safeBlob);
        const previous = this.hydratedMediaUrls.get(key);
        if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
        this.hydratedMediaUrls.set(key, objectUrl);
        this.mediaLoadErrors.delete(key);
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.hydratedMediaUrls.delete(key);
        this.mediaLoadErrors.add(key);
        this.cdr.markForCheck();
      })
      .finally(() => {
        this.hydratingMediaKeys.delete(key);
        this.cdr.markForCheck();
      });
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
    const raw = String(payload?.imageUrl || item?.imageUrl || item?.mediaUrl || '').trim();
    // Normalize to absolute URL so the cache key is stable regardless of relative/absolute form
    return raw ? this.normalizeSearchMediaUrl(raw) : '';
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
    // forAdmin is optional — sticker search results may not include it

    if (payloadType === 'E2E_IMAGE') {
      if (typeof payload?.forReceptor !== 'string' || !payload.forReceptor.trim()) return null;
      return {
        type: 'E2E_IMAGE',
        ivFile: payload.ivFile,
        imageUrl: String(payload?.imageUrl || ''),
        imageMime: typeof payload?.imageMime === 'string' ? payload.imageMime : undefined,
        imageNombre: typeof payload?.imageNombre === 'string' ? payload.imageNombre : undefined,
        forEmisor: payload.forEmisor,
        forAdmin: typeof payload?.forAdmin === 'string' && payload.forAdmin.trim() ? payload.forAdmin : undefined,
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
      forAdmin: typeof payload?.forAdmin === 'string' && payload.forAdmin.trim() ? payload.forAdmin : undefined,
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

    // Admin context: try forAdmin first so admin can always decrypt regardless of chat role
    pushIfAny(payload.forAdmin);

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

  private shouldResolveWithoutWsProgress(): boolean {
    return (
      this.visibleProgressEvents.length === 0 &&
      this.progressQueue.length === 0 &&
      this.handledProgressKeys.size === 0
    );
  }

  private activateResultAnimation(): void {
    if (!this.currentRequestId || this.renderedResultRequestId === this.currentRequestId) return;
    this.renderedResultRequestId = this.currentRequestId;
    this.resultAnimationKey = this.currentRequestId;
  }
}
