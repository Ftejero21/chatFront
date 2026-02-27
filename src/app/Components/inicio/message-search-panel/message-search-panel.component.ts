import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  MessageSearchItemDTO,
  MessageSearchResponseDTO,
} from '../../../Interface/MessageSearchDTO';
import { MensajeDTO } from '../../../Interface/MensajeDTO';
import { ChatService } from '../../../Service/chat/chat.service';

@Component({
  selector: 'app-message-search-panel',
  templateUrl: './message-search-panel.component.html',
  styleUrl: './message-search-panel.component.css',
})
export class MessageSearchPanelComponent implements OnChanges, OnDestroy {
  @Input() chat: any = null;
  @Input() messages: MensajeDTO[] = [];
  @Input() currentUserId = 0;
  @Output() closePanel = new EventEmitter<void>();
  @Output() openMessage = new EventEmitter<number>();

  public query = '';
  public results: MessageSearchItemDTO[] = [];
  public total = 0;
  public searching = false;
  public hasMore = false;
  public errorMessage = '';
  public readonly pageSize = 20;

  private page = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;

  public constructor(private chatService: ChatService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['chat'] && !changes['chat'].firstChange) {
      this.query = '';
      this.cancelPendingDebounce();
      this.resetResults();
    }
  }

  public ngOnDestroy(): void {
    this.cancelPendingDebounce();
    this.requestSeq++;
  }

  public onClose(): void {
    this.closePanel.emit();
  }

  public clearQuery(): void {
    this.query = '';
    this.cancelPendingDebounce();
    this.resetResults();
  }

  public onQueryModelChange(value: string): void {
    this.query = value;
    this.onQueryChange();
  }

  public onQueryChange(): void {
    const query = this.normalizedQuery;
    this.cancelPendingDebounce();
    this.errorMessage = '';

    if (!query) {
      this.requestSeq++;
      this.resetResults();
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.fetchPage(0, false);
    }, 260);
  }

  public loadMore(): void {
    if (this.searching || !this.canLoadMore || !this.normalizedQuery) return;
    this.fetchPage(this.page + 1, true);
  }

  public onResultClick(item: MessageSearchItemDTO): void {
    const messageId = Number(item?.id);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    this.openMessage.emit(messageId);
  }

  public authorLabel(item: MessageSearchItemDTO): string {
    if (Number(item?.emisorId) === Number(this.currentUserId)) return 'Tu';
    const nombre = String(item?.emisorNombre || '').trim();
    const apellido = String(item?.emisorApellido || '').trim();
    const fullName = `${nombre} ${apellido}`.trim();
    return fullName || `Usuario ${Number(item?.emisorId) || ''}`.trim();
  }

  public getSnippet(item: MessageSearchItemDTO): string {
    const snippet = String(item?.snippet || '').trim();
    if (snippet) return snippet;
    return String(item?.contenido || '').trim();
  }

  public formatDate(raw?: string | null): string {
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString();
  }

  public trackByResultId(index: number, item: MessageSearchItemDTO): string | number {
    return Number(item?.id) || `msg-${index}`;
  }

  public get normalizedQuery(): string {
    return this.normalize(this.query);
  }

  public get showResultsCount(): boolean {
    return !!this.normalizedQuery;
  }

  public get resultCountLabel(): string {
    const count = this.total > 0 ? this.total : this.results.length;
    return `${count} resultado${count === 1 ? '' : 's'}`;
  }

  public get showEmptyState(): boolean {
    if (!this.normalizedQuery) return true;
    if (this.errorMessage) return true;
    if (this.searching && this.results.length === 0) return true;
    return !this.searching && this.results.length === 0;
  }

  public get emptyStateText(): string {
    if (!this.normalizedQuery) {
      return 'Escribe una palabra para buscar en la base de datos del chat.';
    }
    if (this.errorMessage) {
      return this.errorMessage;
    }
    if (this.searching && this.results.length === 0) {
      return 'Buscando mensajes...';
    }
    return 'No hay coincidencias con el texto indicado.';
  }

  public get emptyStateClass(): string {
    return this.errorMessage ? 'search-empty search-empty--error' : 'search-empty';
  }

  public get canLoadMore(): boolean {
    return this.hasMore && this.results.length > 0;
  }

  public get loadMoreDisabled(): boolean {
    return this.searching;
  }

  public get loadMoreLabel(): string {
    return this.searching ? 'Cargando...' : 'Cargar mas';
  }

  private fetchPage(page: number, append: boolean): void {
    const chatId = Number(this.chat?.id);
    const query = this.normalizedQuery;

    if (!Number.isFinite(chatId) || chatId <= 0 || !query) {
      this.resetResults();
      return;
    }

    const seq = ++this.requestSeq;
    this.searching = true;

    this.chatService
      .buscarMensajesEnChat(chatId, query, page, this.pageSize)
      .subscribe({
        next: (response: MessageSearchResponseDTO) => {
          if (seq !== this.requestSeq) return;
          const incoming = Array.isArray(response?.items) ? response.items : [];
          this.results = append ? [...this.results, ...incoming] : incoming;
          this.total = Number(response?.total) || 0;
          this.page = Number(response?.page) || 0;
          this.hasMore = !!response?.hasMore;
          this.errorMessage = '';
          this.searching = false;
        },
        error: (err) => {
          if (seq !== this.requestSeq) return;
          console.error('[SEARCH] buscarMensajesEnChat error', err);
          this.searching = false;
          this.errorMessage = 'No se pudo buscar en el servidor.';
          if (!append) {
            this.results = [];
            this.total = 0;
            this.page = 0;
            this.hasMore = false;
          }
        },
      });
  }

  private resetResults(): void {
    this.results = [];
    this.total = 0;
    this.page = 0;
    this.hasMore = false;
    this.searching = false;
    this.errorMessage = '';
  }

  private cancelPendingDebounce(): void {
    if (!this.debounceTimer) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private normalize(value: unknown): string {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }
}
