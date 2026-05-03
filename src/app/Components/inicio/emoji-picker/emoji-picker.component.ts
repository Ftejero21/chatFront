import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import {
  EmojiCatalogService,
  EmojiLibraryItem,
} from '../../../Service/emoji/emoji-catalog.service';
import { StickerDTO } from '../../../Interface/StickerDTO';

type EmojiTab = 'emoji' | 'gif' | 'sticker';

interface EmojiItem {
  char: string;
  search: string;
  order: number;
  imageUrl: string;
  name: string;
}

interface EmojiSection {
  id: string;
  category: string;
  type: string;
  emojis: EmojiItem[];
}

@Component({
  selector: 'app-emoji-picker',
  templateUrl: './emoji-picker.component.html',
  styleUrl: './emoji-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmojiPickerComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainerRef?: ElementRef<HTMLDivElement>;
  @Output() public emojiSelect = new EventEmitter<string>();
  @Output() public stickerTabOpen = new EventEmitter<void>();
  @Output() public stickerCreateClick = new EventEmitter<void>();
  @Output() public stickerClick = new EventEmitter<StickerDTO>();
  @Output() public stickerDeleteClick = new EventEmitter<number>();
  @Input() public stickerItems: StickerDTO[] = [];
  @Input() public stickerLoading = false;

  public readonly activeTab = signal<EmojiTab>('emoji');
  public readonly activeCategory = signal('recent');
  public readonly searchTerm = signal('');
  public readonly copiedEmoji = signal<string | null>(null);
  public readonly isReady = signal(false);

  private readonly recentStorageKey = 'tejechat:emoji-recientes';
  private readonly maxRecentEmojis = 24;

  private isProgrammaticScroll = false;
  private programmaticScrollTimeout: any = null;

  public readonly navSections: Array<{ id: string; category: string; type: string }> = [
    { id: 'recent', category: 'Recientes', type: 'recent' },
    { id: 'smileys', category: 'Emoticonos', type: 'smileys' },
    { id: 'people', category: 'Personas', type: 'people' },
    { id: 'food', category: 'Comida y bebida', type: 'food' },
    { id: 'activities', category: 'Actividades', type: 'activities' },
    { id: 'travel', category: 'Viajes y lugares', type: 'travel' },
    { id: 'objects', category: 'Objetos', type: 'objects' },
    { id: 'symbols', category: 'Símbolos', type: 'symbols' },
    { id: 'flags', category: 'Banderas', type: 'flags' },
  ];

  private readonly groupToSection: Record<number, string> = {
    0: 'smileys', 1: 'people', 2: 'people', 3: 'smileys', 4: 'food',
    5: 'travel', 6: 'activities', 7: 'objects', 8: 'symbols', 9: 'flags'
  };

  private copiedTimer: any = null;
  private readonly allSections = signal<EmojiSection[]>([]);
  private readonly recentEmojis = signal<string[]>([]);
  private readonly hiddenEmojis = signal<Set<string>>(new Set<string>());

  constructor(private readonly emojiCatalogService: EmojiCatalogService) {}

  public readonly sectionsToRender = computed<EmojiSection[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const hidden = this.hiddenEmojis();
    const regular = this.allSections()
      .map((section) => ({
        ...section,
        emojis: term
          ? section.emojis.filter(
              (emoji) => emoji.search.includes(term) || emoji.char.includes(term)
            )
          : section.emojis,
      }))
      .map((section) => ({
        ...section,
        emojis: section.emojis.filter((emoji) => !hidden.has(emoji.char)),
      }))
      .filter((section) => section.emojis.length > 0);

    const recentItems = this.recentEmojis()
      .filter((emoji) => !hidden.has(emoji))
      .filter((emoji) => !term || emoji.includes(term))
      .map((emoji, idx) => ({
        char: emoji,
        search: emoji,
        order: idx,
        imageUrl: this.toTwemojiUrl(emoji),
        name: 'Emoji reciente'
      }));

    const recentSection: EmojiSection = {
      id: 'recent',
      category: 'Recientes',
      type: 'recent',
      emojis: recentItems,
    };

    return [recentSection, ...regular];
  });

  public ngOnInit(): void {
    this.recentEmojis.set(this.loadRecentEmojis());
    void this.loadEmojiData();
  }

  public ngOnDestroy(): void {
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    if (this.programmaticScrollTimeout) clearTimeout(this.programmaticScrollTimeout);
  }

  public isTabActive(tab: EmojiTab): boolean {
    return this.activeTab() === tab;
  }

  public setActiveTab(tab: EmojiTab): void {
    this.activeTab.set(tab);
    if (tab === 'sticker') this.stickerTabOpen.emit();
  }

  public updateSearch(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.searchTerm.set(value.trim().toLowerCase());
  }

  public scrollToCategory(id: string): void {
    this.activeTab.set('emoji');
    this.activeCategory.set(id);
    this.isProgrammaticScroll = true;

    if (this.programmaticScrollTimeout) clearTimeout(this.programmaticScrollTimeout);

    const element = document.getElementById('cat-' + id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.programmaticScrollTimeout = setTimeout(() => {
        this.isProgrammaticScroll = false;
      }, 800);
    } else {
      this.isProgrammaticScroll = false;
    }
  }

  public onScroll(event: Event): void {
    if (this.isProgrammaticScroll || this.activeTab() !== 'emoji') return;

    const container = event.target as HTMLElement;
    const sections = container.querySelectorAll('.category-section');
    const containerRect = container.getBoundingClientRect();

    for (const section of Array.from(sections)) {
      const rect = section.getBoundingClientRect();
      if (rect.top >= containerRect.top - 30 && rect.top <= containerRect.top + 120) {
        this.activeCategory.set(section.id.replace('cat-', ''));
        break;
      }
    }
  }

  public onEmojiClick(emoji: string): void {
    const value = String(emoji || '').trim();
    if (!value) return;

    this.pushRecentEmoji(value);
    this.emojiSelect.emit(value);
    this.showCopiedFeedback(value);
  }
  // Si falla la imagen (404 o bloqueo), ocultamos ese emoji para no mostrar fallback roto.
  public onEmojiImgError(_event: Event, emoji: string): void {
    const value = String(emoji || '').trim();
    if (!value) return;

    const next = new Set(this.hiddenEmojis());
    if (next.has(value)) return;
    next.add(value);
    this.hiddenEmojis.set(next);

    const recent = this.recentEmojis().filter((item) => item !== value);
    this.recentEmojis.set(recent);
    localStorage.setItem(this.recentStorageKey, JSON.stringify(recent));
  }

  public onCreateStickerClick(): void {
    this.stickerCreateClick.emit();
  }

  public onStickerClick(sticker: StickerDTO): void {
    this.stickerClick.emit(sticker);
  }

  public onDeleteSticker(sticker: StickerDTO, event: MouseEvent): void {
    event.stopPropagation();
    const stickerId = Number(sticker?.id);
    if (!Number.isFinite(stickerId) || stickerId <= 0) return;
    this.stickerDeleteClick.emit(Math.round(stickerId));
  }

  private async loadEmojiData(): Promise<void> {
    try {
      const data = await this.emojiCatalogService.getOrLoad();
      this.allSections.set(this.buildSectionsFromLibrary(data));
    } catch (err) {
      console.error('Error cargando emojis:', err);
      this.allSections.set([]);
    } finally {
      this.isReady.set(true);
    }
  }

  private buildSectionsFromLibrary(data: EmojiLibraryItem[]): EmojiSection[] {
    const byId = new Map<string, EmojiSection>();
    for (const meta of this.navSections) {
      if (meta.id === 'recent') continue;
      byId.set(meta.id, { id: meta.id, category: meta.category, type: meta.type, emojis: [] });
    }

    const seenBySection = new Map<string, Set<string>>();
    byId.forEach((_, id) => seenBySection.set(id, new Set<string>()));

    for (const row of data || []) {
      const char = String(row?.emoji || '').trim();
      const group = Number(row?.group);
      if (!char || !Number.isFinite(group) || !this.isRenderableEmoji(char)) continue;

      const sectionId = this.groupToSection[group];
      const section = byId.get(sectionId || '');
      if (!section) continue;

      const seen = seenBySection.get(sectionId!);
      if (seen?.has(char)) continue;
      seen?.add(char);

      section.emojis.push({
        char,
        name: row?.annotation || 'Emoji',
        order: Number(row?.order) || 0,
        search: this.buildSearchTokens(row, char),
        imageUrl: this.toTwemojiUrlFromLibrary(row, char),
      });
    }

    return Array.from(byId.values()).map(s => {
      s.emojis.sort((a, b) => a.order - b.order);
      return s;
    });
  }

  private buildSearchTokens(item: EmojiLibraryItem, char: string): string {
    const parts = [char, String(item?.annotation || '')];
    (item?.tags || []).forEach(t => parts.push(String(t)));
    (item?.shortcodes || []).forEach(s => parts.push(String(s).replace(/_/g, ' ')));
    return parts.join(' ').toLowerCase();
  }

  private loadRecentEmojis(): string[] {
    try {
      const raw = localStorage.getItem(this.recentStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(v => this.isRenderableEmoji(String(v))).slice(0, this.maxRecentEmojis) : [];
    } catch { return []; }
  }

  private pushRecentEmoji(emoji: string): void {
    const next = [emoji, ...this.recentEmojis().filter((e) => e !== emoji)].slice(0, this.maxRecentEmojis);
    this.recentEmojis.set(next);
    localStorage.setItem(this.recentStorageKey, JSON.stringify(next));
  }

  private showCopiedFeedback(emoji: string): void {
    this.copiedEmoji.set(emoji);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copiedEmoji.set(null), 1200);
  }

  private isRenderableEmoji(value: string): boolean {
    const emoji = String(value || '').trim();
    if (!emoji) return false;
    return /[\u{1F1E6}-\u{1F1FF}]/u.test(emoji) || /\p{Extended_Pictographic}/u.test(emoji);
  }

  private toTwemojiUrl(emoji: string): string {
    const points = Array.from(emoji).map((char) =>
      (char.codePointAt(0) || 0).toString(16)
    );
    const hasJoiner = points.includes('200d');
    const normalizedPoints = hasJoiner
      ? points
      : points.filter((cp) => cp !== 'fe0f');
    const codePoints = normalizedPoints.join('-');
    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints}.svg`;
  }

  private toTwemojiUrlFromLibrary(item: EmojiLibraryItem, fallbackEmoji: string): string {
    const hexcode = String(item?.hexcode || '').trim().toLowerCase();
    if (hexcode) {
      return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${hexcode}.svg`;
    }
    return this.toTwemojiUrl(fallbackEmoji);
  }
}
