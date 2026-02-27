import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import 'emoji-picker-element';
import { Database } from 'emoji-picker-element';
import esI18n from 'emoji-picker-element/i18n/es';

interface EmojiClickDetail {
  unicode?: string;
  emoji?: {
    unicode?: string;
  };
}

@Component({
  selector: 'app-emoji-picker',
  templateUrl: './emoji-picker.component.html',
  styleUrl: './emoji-picker.component.css',
})
export class EmojiPickerComponent implements AfterViewInit {
  @ViewChild('nativePicker')
  private nativePickerRef?: ElementRef<any>;
  @Output() public emojiSelect = new EventEmitter<string>();

  public readonly emojiDataSourceEs =
    '/assets/emoji-picker-element-data/es/emojibase/data.json';

  private readonly pickerI18nEs = {
    ...esI18n,
    searchLabel: 'Buscar emojis...',
    searchResultsLabel: 'Resultados de busqueda',
  };

  private readonly emojiDatabase = new Database({
    locale: 'es',
    dataSource: this.emojiDataSourceEs,
  });

  public ngAfterViewInit(): void {
    const picker = this.nativePickerRef?.nativeElement;
    if (!picker) return;

    picker.database = this.emojiDatabase;
    picker.locale = 'es';
    picker.dataSource = this.emojiDataSourceEs;
    picker.i18n = this.pickerI18nEs;

    this.applyCustomPickerStyles(picker);
    this.ensureSpanishSearchPlaceholder(picker);
  }

  public onPickerEmojiClick(event: Event): void {
    const detail = (event as CustomEvent<EmojiClickDetail>)?.detail;
    const emoji = detail?.unicode || detail?.emoji?.unicode || '';
    if (!emoji) return;
    this.emojiSelect.emit(emoji);
  }

  private applyCustomPickerStyles(picker: any): void {
    const root = picker?.shadowRoot as ShadowRoot | null;
    if (!root) return;
    if (root.getElementById('custom-emoji-search-style')) return;

    const style = document.createElement('style');
    style.id = 'custom-emoji-search-style';
    style.textContent = `
      .search-row {
        padding-inline: 12px !important;
        padding-bottom: 10px !important;
        background: linear-gradient(180deg, #eef6ff 0%, #ffffff 100%);
        border-bottom: 1px solid #dbeafe;
      }
      .search-wrapper {
        position: relative;
      }
      .search-wrapper::before {
        content: '';
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 14px;
        height: 14px;
        border: 2px solid #60a5fa;
        border-radius: 9999px;
        opacity: 0.9;
        pointer-events: none;
      }
      .search-wrapper::after {
        content: '';
        position: absolute;
        left: 23px;
        top: calc(50% + 3px);
        width: 7px;
        height: 2px;
        background: #60a5fa;
        border-radius: 9999px;
        transform: rotate(40deg);
        pointer-events: none;
      }
      input.search {
        border-radius: 9999px !important;
        padding: 0.52rem 0.85rem 0.52rem 2.15rem !important;
        border: 1px solid #bfdbfe !important;
        background: #f8fbff !important;
        color: #1e293b !important;
        box-shadow:
          inset 0 1px 2px rgba(15, 23, 42, 0.08),
          0 2px 8px rgba(37, 99, 235, 0.08);
        transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
      }
      input.search::placeholder {
        color: #2563eb !important;
        opacity: 0.85;
        font-weight: 500;
      }
      input.search:focus {
        border-color: #2563eb !important;
        background: #ffffff !important;
        box-shadow:
          inset 0 1px 2px rgba(15, 23, 42, 0.08),
          0 0 0 3px rgba(37, 99, 235, 0.22) !important;
      }
    `;
    root.appendChild(style);
  }

  private ensureSpanishSearchPlaceholder(picker: any): void {
    let tries = 0;

    const apply = (): boolean => {
      const root = picker?.shadowRoot as ShadowRoot | null;
      if (!root) return false;
      const input = root.querySelector('input.search') as HTMLInputElement | null;
      if (!input) return false;
      input.placeholder = 'Buscar emojis...';
      input.setAttribute('aria-label', 'Buscar emojis');
      return true;
    };

    if (apply()) return;

    const tick = () => {
      tries += 1;
      if (apply() || tries >= 25) return;
      setTimeout(tick, 80);
    };

    setTimeout(tick, 80);
  }
}