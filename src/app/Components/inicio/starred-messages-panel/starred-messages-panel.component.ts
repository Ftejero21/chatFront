import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
} from '@angular/core';
import { StarredMessageItem } from '../../../Interface/StarredMessageDTO';

type StarredCardTone = 'blue' | 'green' | 'yellow' | 'white';

@Component({
  selector: 'app-starred-messages-panel',
  templateUrl: './starred-messages-panel.component.html',
  styleUrl: './starred-messages-panel.component.css',
})
export class StarredMessagesPanelComponent implements OnChanges, OnDestroy {
  @Input() public items: StarredMessageItem[] = [];
  @Input() public page = 0;
  @Input() public totalPages = 1;
  @Input() public totalElements = 0;
  @Input() public hasNext = false;
  @Input() public hasPrevious = false;
  @Input() public loading = false;
  @Output() public openMessage = new EventEmitter<StarredMessageItem>();
  @Output() public toggleStar = new EventEmitter<StarredMessageItem>();
  @Output() public nextPage = new EventEmitter<void>();
  @Output() public prevPage = new EventEmitter<void>();

  public query = '';
  public filteredItems: StarredMessageItem[] = [];
  private explodingMessageIds = new Set<number>();
  private explosionTimers = new Map<number, ReturnType<typeof setTimeout>>();

  public ngOnChanges(): void {
    this.applyFilter();
  }

  public onQueryInput(event: Event): void {
    const input = event?.target as HTMLInputElement | null;
    this.query = String(input?.value || '');
    this.applyFilter();
  }

  public onOpenMessage(item: StarredMessageItem, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMessage.emit(item);
  }

  public onToggleStar(item: StarredMessageItem, event?: MouseEvent): void {
    this.onToggleStarWithExplosion(item, event);
  }

  public onToggleStarWithExplosion(
    item: StarredMessageItem,
    event?: MouseEvent,
    cardElement?: HTMLElement | null
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    const messageId = Number(item?.messageId);
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    if (this.loading || this.explodingMessageIds.has(messageId)) return;

    if (!cardElement) {
      this.toggleStar.emit(item);
      return;
    }

    this.explodingMessageIds.add(messageId);
    cardElement.classList.add('pixel-pluf-out');
    this.launchPixelParticles(cardElement, 400);

    setTimeout(() => {
      this.toggleStar.emit(item);
    }, 400);

    this.clearExplosionTimer(messageId);
    const timer = setTimeout(() => {
      this.explodingMessageIds.delete(messageId);
      try {
        cardElement.classList.remove('pixel-pluf-out');
      } catch {}
      this.explosionTimers.delete(messageId);
    }, 1200);
    this.explosionTimers.set(messageId, timer);
  }

  public onNextPage(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.loading || !this.hasNext) return;
    this.nextPage.emit();
  }

  public onPrevPage(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.loading || !this.hasPrevious) return;
    this.prevPage.emit();
  }

  public trackByMessageId(_: number, item: StarredMessageItem): number {
    return Number(item?.messageId || 0);
  }

  public formatDate(raw: string | null | undefined): string {
    const value = String(raw || '').trim();
    if (!value) return 'Fecha no disponible';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Fecha no disponible';
    return parsed.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  public senderInitial(item: StarredMessageItem): string {
    const sender = String(item?.emisorNombre || '').trim();
    if (!sender) return 'U';
    const parts = sender.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  public messageTypeLabel(rawType: string | null | undefined): string {
    const type = String(rawType || '').trim().toUpperCase();
    if (type === 'AUDIO') return 'Audio';
    if (type === 'IMAGE') return 'Imagen';
    if (type === 'VIDEO') return 'Video';
    if (type === 'FILE') return 'Archivo';
    if (type === 'POLL') return 'Encuesta';
    return 'Texto';
  }

  public cardTone(item: StarredMessageItem): StarredCardTone {
    const type = String(item?.tipo || '').toUpperCase();
    if (type === 'POLL') return 'yellow';
    if (type === 'AUDIO') return 'green';
    if (type === 'IMAGE' || type === 'VIDEO' || type === 'FILE') return 'blue';
    return 'white';
  }

  public isExploding(item: StarredMessageItem): boolean {
    const messageId = Number(item?.messageId);
    return Number.isFinite(messageId) && this.explodingMessageIds.has(messageId);
  }

  public ngOnDestroy(): void {
    for (const timer of this.explosionTimers.values()) {
      clearTimeout(timer);
    }
    this.explosionTimers.clear();
    this.explodingMessageIds.clear();
  }

  private clearExplosionTimer(messageId: number): void {
    const timer = this.explosionTimers.get(messageId);
    if (!timer) return;
    clearTimeout(timer);
    this.explosionTimers.delete(messageId);
  }

  private launchPixelParticles(cardElement: HTMLElement, durationMs = 400): void {
    const rect = cardElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const colors = ['#facc15', '#eab308', '#fbbf24', '#fef08a', '#ffffff'];

    for (let i = 0; i < 45; i++) {
      const pixel = document.createElement('span');
      pixel.className = 'pixel-particle';
      pixel.textContent = '★';
      pixel.style.position = 'absolute';
      pixel.style.display = 'inline-flex';
      pixel.style.alignItems = 'center';
      pixel.style.justifyContent = 'center';
      pixel.style.fontSize = `${Math.floor(Math.random() * 7) + 10}px`;
      pixel.style.lineHeight = '1';
      pixel.style.pointerEvents = 'none';
      pixel.style.zIndex = '100';
      pixel.style.color = colors[Math.floor(Math.random() * colors.length)];
      pixel.style.textShadow = '0 1px 2px rgba(0,0,0,0.12)';

      const randomX = rect.left + scrollX + Math.random() * rect.width;
      const randomY = rect.top + scrollY + Math.random() * rect.height;
      pixel.style.left = `${randomX}px`;
      pixel.style.top = `${randomY}px`;

      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 200 + 100;
      const rotation = Math.random() * 720;
      pixel.style.setProperty('--tw-x', `${Math.cos(angle) * dist}px`);
      pixel.style.setProperty('--tw-y', `${Math.sin(angle) * dist}px`);
      pixel.style.setProperty('--tw-rotate', `${rotation}deg`);
      pixel.style.animation = `pixel-fly ${durationMs}ms cubic-bezier(0.1, 0.8, 0.3, 1) forwards`;

      document.body.appendChild(pixel);
      setTimeout(() => {
        try {
          pixel.remove();
        } catch {}
      }, durationMs);
    }
  }

  private applyFilter(): void {
    const normalizedQuery = String(this.query || '').trim().toLowerCase();
    if (!normalizedQuery) {
      this.filteredItems = [...(this.items || [])];
      return;
    }

    this.filteredItems = (this.items || []).filter((item) => {
      const sender = String(item?.emisorNombre || '').toLowerCase();
      const chat = String(item?.chatNombre || '').toLowerCase();
      const preview = String(item?.preview || '').toLowerCase();
      return (
        sender.includes(normalizedQuery) ||
        chat.includes(normalizedQuery) ||
        preview.includes(normalizedQuery)
      );
    });
  }
}
