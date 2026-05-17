import { Injectable } from '@angular/core';
import {
  NEXO_CUSTOMIZATION_CSS_VARIABLES,
  NEXO_CUSTOMIZABLE_AREAS,
  NexoAreaId,
  NexoCssProperty,
} from './nexo-customizable-areas';
import { UiCustomizationChange, UiCustomizationContext, UiCustomizationAreaCatalogEntry, UiCustomizationDomStateEntry } from '../../Interface/UiCustomizationIntentDTO';

/** Legacy flat key — migrated on first load. */
const STORAGE_KEY_OLD   = 'nexo-ui-custom-theme';
const STORAGE_KEY_LIGHT = 'nexo-ui-custom-theme-light';
const STORAGE_KEY_DARK  = 'nexo-ui-custom-theme-dark';

@Injectable({ providedIn: 'root' })
export class UiCustomizationService {
  private readonly allowedCssVars = new Set(NEXO_CUSTOMIZATION_CSS_VARIABLES);

  /** Applied CSS vars per theme (source of truth after loadSavedTheme). */
  private lightAppliedVars = new Map<string, string>();
  private darkAppliedVars  = new Map<string, string>();

  /** Preview snapshot: cssVar → value before preview ('' = was not set). */
  private previewVars  = new Map<string, string>();
  private previewTheme: 'light' | 'dark' = 'light';

  /**
   * When a property is applied, these additional CSS variables are also set to the same value.
   * Key format: "AREA_ID:PROPERTY_NAME"
   */
  private static readonly COMPANION_VARS: Readonly<Record<string, string[]>> = {
    'CHAT_LIST_ITEM:TEXT_COLOR': [
      '--nexo-chat-item-name-color',
      '--nexo-chat-item-children-text',
      '--nexo-chat-item-action-icon',
    ],
    'CHAT_LIST_ITEM_GROUP:TEXT_COLOR': [
      '--nexo-chat-group-pill-text',
      '--nexo-chat-item-children-text',
    ],
    'CHAT_LIST_PREVIEW:TEXT_COLOR': [
      '--nexo-chat-preview-sender-color',
      '--nexo-chat-preview-draft-text',
      '--nexo-chat-preview-audio-text',
    ],
    'CHAT_LIST_ITEM_UNREAD:BORDER_RADIUS': ['--nexo-chat-unread-badge-radius'],
    'CHAT_LIST_ITEM:ICON_COLOR': ['--nexo-chat-pin-toggle-icon'],
    'CHAT_LIST_PIN_TOGGLE:BACKGROUND_COLOR': ['--nexo-chat-pin-menu-bg'],
    'CHAT_LIST_PIN_MENU:TEXT_COLOR': ['--nexo-chat-pin-menu-item-text'],
  };

  /** Area aliases: backend may send short names — normalize to canonical NexoAreaId. */
  private static readonly AREA_ALIASES: Readonly<Record<string, string>> = {
    'CHAT_HEADER': 'CHAT_LIST_HEADER',
  };

  /** Property aliases per area (key = "AREA:PROPERTY"). */
  private static readonly PROPERTY_ALIASES: Readonly<Record<string, string>> = {
    'CHAT_LIST_FILTERS:SEND_BUTTON_COLOR': 'ICON_COLOR',
    'CHAT_LIST_SEARCH:SEND_BUTTON_COLOR':  'ICON_COLOR',
  };

  /**
   * DOM fallback: when inline style and localStorage are both missing,
   * read the computed style of a real DOM element.
   * Key format: "AREA_ID:PROPERTY_NAME"
   */
  private static readonly DOM_FALLBACKS: Readonly<Record<string, { selector: string; cssProperty: string; default?: string }>> = {
    'CHAT_LIST_PIN_MENU_ITEM:FONT_SIZE': { selector: '.chat-pin-menu-btn', cssProperty: 'font-size', default: '12px' },
    'CHAT_LIST_PIN_MENU:FONT_SIZE':      { selector: '.chat-pin-menu',     cssProperty: 'font-size', default: '12px' },
    'CHAT_LIST_PREVIEW:FONT_SIZE':       { selector: '.preview-text',      cssProperty: 'font-size' },
    'CHAT_LIST_SEARCH:FONT_SIZE':        { selector: '.input-busqueda',    cssProperty: 'font-size' },
    'CHAT_LIST_FILTERS:FONT_SIZE':        { selector: '.chat-filter-btn',   cssProperty: 'font-size' },
    'CHAT_LIST_FILTER_BUTTONS:FONT_SIZE':        { selector: '.chat-filter-btn',          cssProperty: 'font-size', default: '12px' },
    'CHAT_LIST_FILTER_BUTTONS_ACTIVE:FONT_SIZE': { selector: '.chat-filter-btn.is-active', cssProperty: 'font-size', default: '12px' },
    'CHAT_LIST_BADGES:FONT_SIZE':        { selector: '.badge-inline',      cssProperty: 'font-size' },
    'CHAT_LIST_AUDIO_PREVIEW:FONT_SIZE': { selector: '.preview-audio.compact', cssProperty: 'font-size' },
    'CHAT_LIST_GROUP_PILL:FONT_SIZE':    { selector: '.pill--group',       cssProperty: 'font-size' },
  };

  /** DOM selectors per area — first match wins. Used for domState and computedStyles. */
  private static readonly AREA_DOM_SELECTORS: Readonly<Record<string, string[]>> = {
    'CHAT_LIST_PANEL':                   ['.chat-list-wrapper', '.listadoChats'],
    'CHAT_LIST_HEADER':                  ['.encabezado-chats'],
    'CHAT_LIST_ACTIONS_MENU':            ['.chat-list-menu'],
    'CHAT_LIST_SEARCH':                  ['.buscador', '.input-busqueda'],
    'CHAT_LIST_FILTERS':                 ['.chat-filters'],
    'CHAT_LIST_FILTER_BUTTONS':          ['.chat-filter-btn'],
    'CHAT_LIST_FILTER_BUTTONS_ACTIVE':   ['.chat-filter-btn.is-active'],
    'CHAT_LIST_ITEM':                    ['.chat-item'],
    'CHAT_LIST_ITEM_ACTIVE':             ['.chat-item.chat-item--selected'],
    'CHAT_LIST_ITEM_UNREAD':             ['.chat-item.chat-item--unread'],
    'CHAT_LIST_ITEM_GROUP':              ['.chat-item.chat-item--group'],
    'CHAT_LIST_PREVIEW':                 ['.mensaje-preview', '.preview-text', '.preview-line'],
    'CHAT_LIST_AUDIO_PREVIEW':           ['.preview-audio', '.preview-audio.compact'],
    'CHAT_LIST_BADGES':                  ['.badge-inline'],
    'CHAT_LIST_GROUP_PILL':              ['.pill--group'],
    'CHAT_LIST_STATUS_PILLS':            ['.pill--reported', '.pill--blocked'],
    'CHAT_LIST_DRAFT_PREVIEW':           ['.preview-text--draft', '.preview-draft-label', '.preview-line--draft'],
    'CHAT_LIST_ITEM_ACTIONS':            ['.chat-muted-indicator', '.chat-favorite-indicator', '.chat-closed-indicator'],
    'CHAT_LIST_ITEM_CHILDREN':           ['.chat-item-children'],
    'CHAT_LIST_PIN_TOGGLE':              ['.chat-pin-toggle'],
    'CHAT_LIST_PIN_MENU':                ['.chat-pin-menu'],
    'CHAT_LIST_PIN_MENU_ITEM':           ['.chat-pin-menu-btn'],
    'CHAT_LIST_PIN_MENU_DANGER':         ['.chat-pin-menu-btn--danger'],
    'CHAT_LIST_PIN_MENU_REPORT':         ['.chat-pin-menu-btn--report'],
    'CHAT_LIST_TITLE':                   ['.titulo-chat'],
    'CHAT_LIST_HEADER_ACTIONS':          ['.acciones-chat', '.icono-chat'],
    'CHAT_LIST_ACTIONS_MENU_ITEM':       ['.chat-list-menu-item'],
    'CHAT_LIST_SCROLL':                  ['.chat-scroll'],
    'CHAT_LIST_AVATAR':                  ['.foto-con-estado', '.foto-perfil', '.chat-avatar-fallback-spacing'],
    'CHAT_LIST_ITEM_CONTENT':            ['.info-chat'],
    'CHAT_LIST_ITEM_NAME':               ['.nombre', '.nombre-linea'],
    'CHAT_LIST_IMAGE_PREVIEW':           ['.preview-line--image', '.preview-image-thumb', '.preview-image-sender', '.preview-caption-chip'],
    'CHAT_LIST_FILE_PREVIEW':            ['.preview-line--file', '.preview-file-icon', '.preview-file-name', '.preview-file-caption'],
    'CHAT_LIST_STATUS_PILL_REPORTED':    ['.pill--reported'],
    'CHAT_LIST_STATUS_PILL_BLOCKED':     ['.pill--blocked'],
    // Group-scoped areas — selectors are intentionally compound (.chat-item.chat-item--group > child)
    'CHAT_LIST_ITEM_GROUP_PREVIEW':      ['.chat-item.chat-item--group .mensaje-preview', '.chat-item.chat-item--group .preview-text'],
    'CHAT_LIST_ITEM_GROUP_DRAFT_PREVIEW':['.chat-item.chat-item--group .preview-text--draft', '.chat-item.chat-item--group .preview-draft-label'],
    'CHAT_LIST_ITEM_GROUP_AUDIO_PREVIEW':['.chat-item.chat-item--group .preview-audio.compact', '.chat-item.chat-item--group .preview-audio'],
    'CHAT_LIST_ITEM_GROUP_IMAGE_PREVIEW':['.chat-item.chat-item--group .preview-image-thumb', '.chat-item.chat-item--group .preview-line--image', '.chat-item.chat-item--group .preview-image-sender', '.chat-item.chat-item--group .preview-caption-chip'],
    'CHAT_LIST_ITEM_GROUP_FILE_PREVIEW': ['.chat-item.chat-item--group .preview-file-icon', '.chat-item.chat-item--group .preview-file-name', '.chat-item.chat-item--group .preview-line--file', '.chat-item.chat-item--group .preview-file-caption'],
    'CHAT_LIST_ITEM_GROUP_BADGES':       ['.chat-item.chat-item--group .badge-inline'],
    'CHAT_LIST_ITEM_GROUP_ACTIONS':      ['.chat-item.chat-item--group .chat-muted-indicator', '.chat-item.chat-item--group .chat-favorite-indicator'],
    'CHAT_LIST_ITEM_GROUP_STATUS_PILLS': ['.chat-item.chat-item--group .pill--reported', '.chat-item.chat-item--group .pill--blocked'],
    'CHAT_LIST_ITEM_GROUP_NAME':         ['.chat-item.chat-item--group .nombre', '.chat-item.chat-item--group .nombre-linea'],
    // Individual-chat-scoped areas (only affect .chat-item:not(.chat-item--group))
    'CHAT_LIST_ITEM_PREVIEW':            ['.chat-item:not(.chat-item--group) .mensaje-preview', '.chat-item:not(.chat-item--group) .preview-text'],
    'CHAT_LIST_ITEM_DRAFT_PREVIEW':      ['.chat-item:not(.chat-item--group) .preview-text--draft', '.chat-item:not(.chat-item--group) .preview-draft-label'],
    'CHAT_LIST_ITEM_AUDIO_PREVIEW':      ['.chat-item:not(.chat-item--group) .preview-audio.compact', '.chat-item:not(.chat-item--group) .preview-audio'],
    'CHAT_LIST_ITEM_IMAGE_PREVIEW':      ['.chat-item:not(.chat-item--group) .preview-image-thumb', '.chat-item:not(.chat-item--group) .preview-line--image', '.chat-item:not(.chat-item--group) .preview-image-sender', '.chat-item:not(.chat-item--group) .preview-caption-chip'],
    'CHAT_LIST_ITEM_FILE_PREVIEW':       ['.chat-item:not(.chat-item--group) .preview-file-icon', '.chat-item:not(.chat-item--group) .preview-file-name', '.chat-item:not(.chat-item--group) .preview-line--file', '.chat-item:not(.chat-item--group) .preview-file-caption'],
    'CHAT_LIST_ITEM_BADGES':             ['.chat-item:not(.chat-item--group) .badge-inline'],
    'CHAT_LIST_ITEM_ACTIONS_SCOPED':     ['.chat-item:not(.chat-item--group) .chat-muted-indicator', '.chat-item:not(.chat-item--group) .chat-favorite-indicator'],
    'CHAT_LIST_ITEM_STATUS_PILLS':       ['.chat-item:not(.chat-item--group) .pill--reported', '.chat-item:not(.chat-item--group) .pill--blocked'],
    'CHAT_LIST_ITEM_NAME_SCOPED':        ['.chat-item:not(.chat-item--group) .nombre', '.chat-item:not(.chat-item--group) .nombre-linea'],
    // Sidebar nav areas — all scoped to .barraLateral.sidebar-nav
    'SIDEBAR_NAV':                       ['.barraLateral.sidebar-nav'],
    'SIDEBAR_NAV_PANEL':                 ['.barraLateral.sidebar-nav'],
    'SIDEBAR_NAV_GROUP':                 ['.barraLateral.sidebar-nav .iconos-superiores.sidebar-nav__group', '.barraLateral.sidebar-nav .sidebar-nav__group'],
    'SIDEBAR_NAV_BOTTOM':                ['.barraLateral.sidebar-nav .usuario-config.sidebar-nav__bottom', '.barraLateral.sidebar-nav .sidebar-nav__bottom'],
    'SIDEBAR_NAV_ITEM':                  ['.barraLateral.sidebar-nav .sidebar-nav__item'],
    'SIDEBAR_NAV_ITEM_ACTIVE':           ['.barraLateral.sidebar-nav .sidebar-nav__item.sidebar-nav__item--active'],
    'SIDEBAR_NAV_ACTIVE_ITEM':           ['.barraLateral.sidebar-nav .sidebar-nav__item.sidebar-nav__item--active'],
    'SIDEBAR_NAV_ACTIVE_INDICATOR':      ['.barraLateral.sidebar-nav .sidebar-nav__item--active .sidebar-nav__active-indicator'],
    'SIDEBAR_NAV_LOGO':                  ['.barraLateral.sidebar-nav .sidebar-nav__item--logo', '.barraLateral.sidebar-nav .sidebar-nav__nexo-logo'],
    'SIDEBAR_NAV_ICON':                  ['.barraLateral.sidebar-nav .sidebar-nav__item .icono-barra', '.barraLateral.sidebar-nav .sidebar-nav__item i'],
    'SIDEBAR_NAV_ICON_ACTIVE':           ['.barraLateral.sidebar-nav .sidebar-nav__item--active .icono-barra'],
    'SIDEBAR_NAV_AI_ICON':               ['.barraLateral.sidebar-nav .sidebar-nav__nexo-ai-icon'],
    'SIDEBAR_NAV_TOOLTIP':               ['.barraLateral.sidebar-nav .sidebar-nav__tooltip'],
    'SIDEBAR_NAV_AVATAR':                ['.barraLateral.sidebar-nav .sidebar-nav__item--avatar', '.barraLateral.sidebar-nav .sidebar-nav__avatar-img'],
    'SIDEBAR_NAV_SETTINGS':              ['.barraLateral.sidebar-nav .sidebar-nav__bottom .sidebar-nav__item'],
  };

  /** Maps NexoCssProperty key to the DOM CSS property for getComputedStyle. */
  private static readonly CSS_COMPUTED_PROPS: Readonly<Record<string, string>> = {
    'BACKGROUND_COLOR':          'background-color',
    'INPUT_BACKGROUND_COLOR':    'background-color',
    'CARD_BACKGROUND_COLOR':     'background-color',
    'UNREAD_BACKGROUND_COLOR':   'background-color',
    'ACTIVE_BACKGROUND_COLOR':   'background-color',
    'HOVER_BACKGROUND_COLOR':    'background-color',
    'TEXT_COLOR':                'color',
    'SECONDARY_TEXT_COLOR':      'color',
    'ACTIVE_TEXT_COLOR':         'color',
    'SENDER_TEXT_COLOR':         'color',
    'PREVIEW_SENDER_TEXT_COLOR': 'color',
    'ICON_COLOR':                'color',
    'ACTIVE_ICON_COLOR':         'color',
    'PLACEHOLDER_COLOR':         'color',
    'LABEL_COLOR':               'color',
    'TIME_COLOR':                'color',
    'CHECK_COLOR':               'color',
    'BADGE_COLOR':               'background-color',
    'BORDER_COLOR':              'border-color',
    'FOCUS_BORDER_COLOR':        'outline-color',
    'SEPARATOR_COLOR':           'border-color',
    'BORDER_RADIUS':             'border-radius',
    'BORDER_WIDTH':              'border-width',
    'FONT_SIZE':                 'font-size',
    'SHADOW_PRESET':             'box-shadow',
    'SHADOW':                    'box-shadow',
    'OPACITY':                   'opacity',
    'GAP':                       'gap',
    'WIDTH':                     'width',
    'HOVER_TEXT_COLOR':          'color',
    'HOVER_ICON_COLOR':          'color',
  };

  /** Static parent→children expansion hints sent to the AI. */
  private static readonly GROUP_EXPANSION_HINTS: Readonly<Record<string, string[]>> = {
    'CHAT_LIST_PANEL': [
      'CHAT_LIST_HEADER', 'CHAT_LIST_TITLE', 'CHAT_LIST_HEADER_ACTIONS', 'CHAT_LIST_ACTIONS_MENU',
      'CHAT_LIST_SEARCH', 'CHAT_LIST_FILTERS', 'CHAT_LIST_FILTER_BUTTONS', 'CHAT_LIST_FILTER_BUTTONS_ACTIVE',
      'CHAT_LIST_SCROLL', 'CHAT_LIST_ITEM', 'CHAT_LIST_ITEM_GROUP', 'CHAT_LIST_ITEM_ACTIVE', 'CHAT_LIST_ITEM_UNREAD',
      'CHAT_LIST_AVATAR', 'CHAT_LIST_ITEM_CONTENT', 'CHAT_LIST_ITEM_NAME',
      'CHAT_LIST_PREVIEW', 'CHAT_LIST_DRAFT_PREVIEW', 'CHAT_LIST_AUDIO_PREVIEW',
      'CHAT_LIST_IMAGE_PREVIEW', 'CHAT_LIST_FILE_PREVIEW',
      'CHAT_LIST_BADGES', 'CHAT_LIST_GROUP_PILL', 'CHAT_LIST_STATUS_PILLS',
      'CHAT_LIST_STATUS_PILL_REPORTED', 'CHAT_LIST_STATUS_PILL_BLOCKED',
      'CHAT_LIST_ITEM_ACTIONS', 'CHAT_LIST_PIN_TOGGLE',
      'CHAT_LIST_PIN_MENU', 'CHAT_LIST_PIN_MENU_ITEM', 'CHAT_LIST_PIN_MENU_REPORT', 'CHAT_LIST_PIN_MENU_DANGER',
      'CHAT_LIST_ITEM_GROUP_NAME', 'CHAT_LIST_ITEM_GROUP_PREVIEW', 'CHAT_LIST_ITEM_GROUP_DRAFT_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_AUDIO_PREVIEW', 'CHAT_LIST_ITEM_GROUP_IMAGE_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_FILE_PREVIEW', 'CHAT_LIST_ITEM_GROUP_BADGES',
      'CHAT_LIST_ITEM_GROUP_ACTIONS', 'CHAT_LIST_ITEM_GROUP_STATUS_PILLS',
      'CHAT_LIST_ITEM_NAME_SCOPED', 'CHAT_LIST_ITEM_PREVIEW', 'CHAT_LIST_ITEM_DRAFT_PREVIEW',
      'CHAT_LIST_ITEM_AUDIO_PREVIEW', 'CHAT_LIST_ITEM_IMAGE_PREVIEW', 'CHAT_LIST_ITEM_FILE_PREVIEW',
      'CHAT_LIST_ITEM_BADGES', 'CHAT_LIST_ITEM_ACTIONS_SCOPED', 'CHAT_LIST_ITEM_STATUS_PILLS',
    ],
    'CHAT_LIST_HEADER': [
      'CHAT_LIST_TITLE', 'CHAT_LIST_HEADER_ACTIONS', 'CHAT_LIST_ACTIONS_MENU', 'CHAT_LIST_ACTIONS_MENU_ITEM',
    ],
    'CHAT_LIST_ACTIONS_MENU': ['CHAT_LIST_ACTIONS_MENU_ITEM'],
    'CHAT_LIST_FILTERS': ['CHAT_LIST_FILTER_BUTTONS', 'CHAT_LIST_FILTER_BUTTONS_ACTIVE'],
    'CHAT_LIST_ITEM': [
      'CHAT_LIST_AVATAR', 'CHAT_LIST_ITEM_CONTENT', 'CHAT_LIST_ITEM_NAME',
      'CHAT_LIST_PREVIEW', 'CHAT_LIST_DRAFT_PREVIEW', 'CHAT_LIST_AUDIO_PREVIEW',
      'CHAT_LIST_IMAGE_PREVIEW', 'CHAT_LIST_FILE_PREVIEW',
      'CHAT_LIST_BADGES', 'CHAT_LIST_GROUP_PILL', 'CHAT_LIST_STATUS_PILLS',
      'CHAT_LIST_STATUS_PILL_REPORTED', 'CHAT_LIST_STATUS_PILL_BLOCKED',
      'CHAT_LIST_ITEM_ACTIONS', 'CHAT_LIST_PIN_TOGGLE',
      // Individual-chat-scoped (non-group only):
      'CHAT_LIST_ITEM_NAME_SCOPED', 'CHAT_LIST_ITEM_PREVIEW', 'CHAT_LIST_ITEM_DRAFT_PREVIEW',
      'CHAT_LIST_ITEM_AUDIO_PREVIEW', 'CHAT_LIST_ITEM_IMAGE_PREVIEW', 'CHAT_LIST_ITEM_FILE_PREVIEW',
      'CHAT_LIST_ITEM_BADGES', 'CHAT_LIST_ITEM_ACTIONS_SCOPED', 'CHAT_LIST_ITEM_STATUS_PILLS',
    ],
    'CHAT_LIST_ITEM_GROUP': [
      'CHAT_LIST_ITEM_GROUP_NAME', 'CHAT_LIST_GROUP_PILL',
      'CHAT_LIST_ITEM_GROUP_PREVIEW', 'CHAT_LIST_ITEM_GROUP_DRAFT_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_AUDIO_PREVIEW', 'CHAT_LIST_ITEM_GROUP_IMAGE_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_FILE_PREVIEW', 'CHAT_LIST_ITEM_GROUP_BADGES',
      'CHAT_LIST_ITEM_GROUP_ACTIONS', 'CHAT_LIST_ITEM_GROUP_STATUS_PILLS',
    ],
    'CHAT_LIST_ITEM_ACTIVE': ['CHAT_LIST_ITEM_NAME', 'CHAT_LIST_PREVIEW', 'CHAT_LIST_BADGES'],
    'CHAT_LIST_ITEM_UNREAD': ['CHAT_LIST_ITEM_NAME', 'CHAT_LIST_PREVIEW', 'CHAT_LIST_BADGES'],
    'CHAT_LIST_STATUS_PILLS': ['CHAT_LIST_STATUS_PILL_REPORTED', 'CHAT_LIST_STATUS_PILL_BLOCKED'],
    'CHAT_LIST_PIN_TOGGLE': [
      'CHAT_LIST_PIN_MENU', 'CHAT_LIST_PIN_MENU_ITEM',
      'CHAT_LIST_PIN_MENU_DANGER', 'CHAT_LIST_PIN_MENU_REPORT',
    ],
    'CHAT_LIST_PIN_MENU': [
      'CHAT_LIST_PIN_MENU_ITEM', 'CHAT_LIST_PIN_MENU_REPORT', 'CHAT_LIST_PIN_MENU_DANGER',
    ],
    'SIDEBAR_NAV_PANEL': [
      'SIDEBAR_NAV', 'SIDEBAR_NAV_GROUP', 'SIDEBAR_NAV_BOTTOM',
      'SIDEBAR_NAV_ITEM', 'SIDEBAR_NAV_ITEM_ACTIVE', 'SIDEBAR_NAV_ACTIVE_ITEM',
      'SIDEBAR_NAV_ACTIVE_INDICATOR', 'SIDEBAR_NAV_LOGO',
      'SIDEBAR_NAV_ICON', 'SIDEBAR_NAV_ICON_ACTIVE',
      'SIDEBAR_NAV_AI_ICON', 'SIDEBAR_NAV_TOOLTIP',
      'SIDEBAR_NAV_AVATAR', 'SIDEBAR_NAV_SETTINGS',
    ],
    'SIDEBAR_NAV': [
      'SIDEBAR_NAV_GROUP', 'SIDEBAR_NAV_BOTTOM',
      'SIDEBAR_NAV_ITEM', 'SIDEBAR_NAV_ITEM_ACTIVE',
      'SIDEBAR_NAV_ICON', 'SIDEBAR_NAV_ICON_ACTIVE',
      'SIDEBAR_NAV_LOGO', 'SIDEBAR_NAV_AVATAR', 'SIDEBAR_NAV_TOOLTIP',
    ],
    'SIDEBAR_NAV_ITEM': [
      'SIDEBAR_NAV_ICON', 'SIDEBAR_NAV_ACTIVE_INDICATOR',
    ],
    'SIDEBAR_NAV_ITEM_ACTIVE': [
      'SIDEBAR_NAV_ICON_ACTIVE', 'SIDEBAR_NAV_ACTIVE_INDICATOR',
    ],
    'SIDEBAR_NAV_BOTTOM': [
      'SIDEBAR_NAV_AVATAR', 'SIDEBAR_NAV_SETTINGS',
    ],
  };

  /** Maps SHADOW_PRESET keyword values to actual box-shadow CSS values. */
  private static readonly SHADOW_PRESETS: Readonly<Record<string, string>> = {
    'NONE':   'none',
    'SOFT':   '0 1px 3px rgba(0,0,0,0.08)',
    'MEDIUM': '0 2px 8px rgba(0,0,0,0.15)',
    'STRONG': '0 4px 16px rgba(0,0,0,0.25)',
  };

  /** Reason why a DOM element may not exist at query time (area valid but closed/inactive). */
  private static readonly CLOSED_AREA_REASONS: Readonly<Record<string, string>> = {
    'CHAT_LIST_PIN_MENU':              'menu_closed',
    'CHAT_LIST_PIN_MENU_ITEM':         'menu_closed',
    'CHAT_LIST_PIN_MENU_DANGER':       'menu_closed',
    'CHAT_LIST_PIN_MENU_REPORT':       'menu_closed',
    'CHAT_LIST_FILTER_BUTTONS_ACTIVE': 'no_active_filter',
    'CHAT_LIST_ITEM_ACTIVE':           'no_active_chat',
    'CHAT_LIST_ITEM_UNREAD':           'no_unread_chats',
  };

  // ─── Theme helpers ─────────────────────────────────────────────────────────

  private getActiveTheme(): 'light' | 'dark' {
    return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
  }

  private getThemeVars(theme: 'light' | 'dark'): Map<string, string> {
    return theme === 'dark' ? this.darkAppliedVars : this.lightAppliedVars;
  }

  private getStorageKey(theme: 'light' | 'dark'): string {
    return theme === 'dark' ? STORAGE_KEY_DARK : STORAGE_KEY_LIGHT;
  }

  private getOrCreateStyleTag(theme: 'light' | 'dark'): HTMLStyleElement {
    const id = `nexo-ui-custom-${theme}`;
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    return el;
  }

  /**
   * Rebuilds the scoped <style> tag for the given theme.
   * Light vars → body:not(.dark-mode) { ... }
   * Dark  vars → body.dark-mode { ... }
   */
  private flushStyleTag(theme: 'light' | 'dark'): void {
    const vars = this.getThemeVars(theme);
    const selector = theme === 'dark' ? 'body.dark-mode' : 'body:not(.dark-mode)';
    const declarations = Array.from(vars.entries())
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    const css = declarations ? `${selector} {\n${declarations}\n}` : '';
    this.getOrCreateStyleTag(theme).textContent = css;
  }

  private applyVariable(cssVar: string, value: string, theme: 'light' | 'dark'): void {
    this.getThemeVars(theme).set(cssVar, value);
    this.flushStyleTag(theme);
    console.log(`[UI_CUSTOMIZATION][STYLE_TAG_UPDATED] themeMode=${theme} containsVar=${cssVar} value=${value}`);
  }

  private saveCustomization(cssVar: string, value: string, theme: 'light' | 'dark'): void {
    const normalizedVar   = this.normalizeValue(cssVar);
    const normalizedValue = this.normalizeValue(value);
    if (!this.isAllowedCssVar(normalizedVar) || !normalizedValue) return;
    try {
      const key     = this.getStorageKey(theme);
      const raw     = localStorage.getItem(key);
      const current: Record<string, string> = raw ? JSON.parse(raw) : {};
      current[normalizedVar] = normalizedValue;
      localStorage.setItem(key, JSON.stringify(current));
      console.log(`[UI_CUSTOMIZATION][THEME_STORAGE] themeMode=${theme} saved=${normalizedVar}=${normalizedValue}`);
    } catch {
      console.warn('[NexoUI] Error al guardar personalizacion.');
    }
  }

  /**
   * If the legacy flat key exists, migrate it to the target theme's key
   * (only if the target key does not yet exist) and remove the old key.
   */
  private migrateOldStorage(currentTheme: 'light' | 'dark'): void {
    const raw = localStorage.getItem(STORAGE_KEY_OLD);
    if (!raw) return;
    const targetKey = this.getStorageKey(currentTheme);
    if (!localStorage.getItem(targetKey)) {
      localStorage.setItem(targetKey, raw);
      console.log(`[UI_CUSTOMIZATION][THEME_STORAGE] migrated legacy storage → themeMode=${currentTheme}`);
    }
    localStorage.removeItem(STORAGE_KEY_OLD);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Load saved customizations for the given theme (or active theme if omitted).
   * Must be called AFTER the dark-mode class has been set on body.
   */
  public loadSavedTheme(themeMode?: 'light' | 'dark'): void {
    const theme = themeMode ?? this.getActiveTheme();
    this.migrateOldStorage(theme);

    const vars = this.getThemeVars(theme);
    vars.clear();

    try {
      const raw = localStorage.getItem(this.getStorageKey(theme));
      if (!raw) { this.flushStyleTag(theme); return; }

      const saved: Record<string, string> = JSON.parse(raw);
      for (const [cssVar, value] of Object.entries(saved)) {
        if (!this.isAllowedCssVar(cssVar)) continue;
        const normalized = this.normalizeValue(value);
        if (!normalized) continue;
        vars.set(cssVar, normalized);
      }
    } catch {
      console.warn('[NexoUI] Error al cargar tema guardado.');
    }
    this.flushStyleTag(theme);
  }

  public applyCustomization(area: NexoAreaId, property: NexoCssProperty, value: string): boolean {
    const theme        = this.getActiveTheme();
    const cssVar       = this.resolveCssVar(area, property);
    const resolvedValue = this.resolveValue(property, value);
    if (!cssVar || !resolvedValue) return false;

    this.applyVariable(cssVar, resolvedValue, theme);
    this.saveCustomization(cssVar, resolvedValue, theme);
    this.logApplyChange(area, property, cssVar, resolvedValue, theme);

    for (const companionVar of this.getCompanionVars(area, property)) {
      this.applyVariable(companionVar, resolvedValue, theme);
      this.saveCustomization(companionVar, resolvedValue, theme);
    }
    return true;
  }

  public previewCustomization(area: NexoAreaId, property: NexoCssProperty, value: string): boolean {
    const theme        = this.getActiveTheme();
    this.previewTheme  = theme;
    const cssVar       = this.resolveCssVar(area, property);
    const resolvedValue = this.resolveValue(property, value);
    if (!cssVar || !resolvedValue) return false;

    const vars = this.getThemeVars(theme);
    if (!this.previewVars.has(cssVar)) {
      this.previewVars.set(cssVar, vars.get(cssVar) ?? '');
    }
    this.applyVariable(cssVar, resolvedValue, theme);

    for (const companionVar of this.getCompanionVars(area, property)) {
      if (!this.previewVars.has(companionVar)) {
        this.previewVars.set(companionVar, vars.get(companionVar) ?? '');
      }
      this.applyVariable(companionVar, resolvedValue, theme);
    }
    return true;
  }

  public cancelPreview(): void {
    const theme = this.previewTheme;
    const vars  = this.getThemeVars(theme);
    for (const [cssVar, prevValue] of this.previewVars.entries()) {
      if (prevValue) {
        vars.set(cssVar, prevValue);
      } else {
        vars.delete(cssVar);
      }
    }
    this.flushStyleTag(theme);
    this.previewVars.clear();
  }

  public confirmPreview(): void {
    const theme = this.previewTheme;
    const vars  = this.getThemeVars(theme);
    for (const cssVar of this.previewVars.keys()) {
      const current = vars.get(cssVar);
      if (current) this.saveCustomization(cssVar, current, theme);
    }
    this.previewVars.clear();
  }

  /**
   * Reset custom styles. Pass a themeMode to reset only that theme;
   * omit to reset both (full reset).
   */
  public resetTheme(themeMode?: 'light' | 'dark'): void {
    this.cancelPreview();
    const themes: ('light' | 'dark')[] = themeMode ? [themeMode] : ['light', 'dark'];
    for (const t of themes) {
      this.getThemeVars(t).clear();
      this.flushStyleTag(t);
      localStorage.removeItem(this.getStorageKey(t));
    }
  }

  public validateCustomizationChange(change: UiCustomizationChange): boolean {
    if (!change?.area || !change?.property) return false;
    const cssVar = this.resolveCssVar(change.area as NexoAreaId, change.property as NexoCssProperty);
    if (!cssVar) return false;
    const raw = String(change.value ?? change.valuePreset ?? '');
    return this.resolveValue(change.property, raw) !== null;
  }

  public previewCustomizationGroup(changes: UiCustomizationChange[]): boolean {
    if (!changes?.length) return false;
    const theme = this.getActiveTheme();
    this.previewTheme = theme;
    const vars  = this.getThemeVars(theme);
    let applied = 0;
    let skipped = 0;
    let failed  = 0;
    const missingMappings: string[] = [];
    console.log(`[UI_CUSTOMIZATION][THEME_PREVIEW] themeMode=${theme} changes=${changes.length}`);

    for (const change of changes) {
      const area     = change.area as NexoAreaId;
      const property = change.property as NexoCssProperty;
      const cssVar   = this.resolveCssVar(area, property);

      if (!cssVar) {
        console.warn(`[UI_CUSTOMIZATION][MISSING_MAPPING] area=${change.area} property=${change.property}`);
        missingMappings.push(`${change.area}:${change.property}`);
        skipped++;
        continue;
      }

      const value = this.resolveValue(property, String(change.value ?? change.valuePreset ?? ''));
      if (!value) {
        console.warn(`[UI_CUSTOMIZATION][BAD_VALUE] area=${change.area} property=${change.property} cssVar=${cssVar} raw="${change.value ?? change.valuePreset ?? ''}"`);
        failed++;
        continue;
      }

      if (!this.previewVars.has(cssVar)) {
        this.previewVars.set(cssVar, vars.get(cssVar) ?? '');
      }
      this.applyVariable(cssVar, value, theme);
      this.logApplyChange(area, property, cssVar, value, theme);

      for (const companionVar of this.getCompanionVars(area, property)) {
        if (!this.previewVars.has(companionVar)) {
          this.previewVars.set(companionVar, vars.get(companionVar) ?? '');
        }
        this.applyVariable(companionVar, value, theme);
      }
      applied++;
    }

    console.log(
      `[UI_CUSTOMIZATION][APPLY_SUMMARY] total=${changes.length} applied=${applied} skipped=${skipped} failed=${failed}` +
      (missingMappings.length ? ` missingMappings=[${missingMappings.join(', ')}]` : '')
    );
    return applied > 0;
  }

  /** Apply via direct CSS variable name (bypasses area/property mapping). */
  public applyByCssVariable(cssVar: string, value: string): boolean {
    const v  = this.normalizeValue(value);
    const cv = this.normalizeValue(cssVar);
    if (!cv || !v || !this.isAllowedCssVar(cv)) return false;
    const theme = this.getActiveTheme();
    this.applyVariable(cv, v, theme);
    this.saveCustomization(cv, v, theme);
    return true;
  }

  /** Preview via direct CSS variable name. */
  public previewByCssVariable(cssVar: string, value: string): boolean {
    const v  = this.normalizeValue(value);
    const cv = this.normalizeValue(cssVar);
    if (!cv || !v || !this.isAllowedCssVar(cv)) return false;
    const theme = this.getActiveTheme();
    this.previewTheme = theme;
    const vars = this.getThemeVars(theme);
    if (!this.previewVars.has(cv)) {
      this.previewVars.set(cv, vars.get(cv) ?? '');
    }
    this.applyVariable(cv, v, theme);
    return true;
  }

  public applyCustomizationGroup(changes: UiCustomizationChange[]): boolean {
    if (!changes?.length) return false;
    const theme = this.getActiveTheme();
    let applied = 0;
    let skipped = 0;
    let failed  = 0;
    const missingMappings: string[] = [];
    console.log(`[UI_CUSTOMIZATION][THEME_APPLY] themeMode=${theme} changes=${changes.length}`);

    for (const change of changes) {
      const area     = change.area as NexoAreaId;
      const property = change.property as NexoCssProperty;
      const cssVar   = this.resolveCssVar(area, property);

      if (!cssVar) {
        console.warn(`[UI_CUSTOMIZATION][MISSING_MAPPING] area=${change.area} property=${change.property}`);
        missingMappings.push(`${change.area}:${change.property}`);
        skipped++;
        continue;
      }

      const value = this.resolveValue(property, String(change.value ?? change.valuePreset ?? ''));
      if (!value) {
        console.warn(`[UI_CUSTOMIZATION][BAD_VALUE] area=${change.area} property=${change.property} cssVar=${cssVar} raw="${change.value ?? change.valuePreset ?? ''}"`);
        failed++;
        continue;
      }

      this.applyVariable(cssVar, value, theme);
      this.saveCustomization(cssVar, value, theme);
      this.logApplyChange(area, property, cssVar, value, theme);

      for (const companionVar of this.getCompanionVars(area, property)) {
        this.applyVariable(companionVar, value, theme);
        this.saveCustomization(companionVar, value, theme);
      }
      applied++;
    }

    console.log(
      `[UI_CUSTOMIZATION][APPLY_SUMMARY] total=${changes.length} applied=${applied} skipped=${skipped} failed=${failed}` +
      (missingMappings.length ? ` missingMappings=[${missingMappings.join(', ')}]` : '')
    );
    return applied > 0;
  }

  public buildUiContext(scope: 'CHAT_LIST'): UiCustomizationContext {
    const themeMode: 'light' | 'dark' = this.getActiveTheme();

    const CHAT_LIST_AREA_IDS: NexoAreaId[] = [
      'CHAT_LIST_PANEL',
      'CHAT_LIST_HEADER',
      'CHAT_LIST_TITLE',
      'CHAT_LIST_HEADER_ACTIONS',
      'CHAT_LIST_ACTIONS_MENU',
      'CHAT_LIST_ACTIONS_MENU_ITEM',
      'CHAT_LIST_SEARCH',
      'CHAT_LIST_FILTERS',
      'CHAT_LIST_FILTER_BUTTONS',
      'CHAT_LIST_FILTER_BUTTONS_ACTIVE',
      'CHAT_LIST_SCROLL',
      'CHAT_LIST_ITEM',
      'CHAT_LIST_ITEM_ACTIVE',
      'CHAT_LIST_ITEM_UNREAD',
      'CHAT_LIST_ITEM_GROUP',
      'CHAT_LIST_AVATAR',
      'CHAT_LIST_ITEM_CONTENT',
      'CHAT_LIST_ITEM_NAME',
      'CHAT_LIST_PREVIEW',
      'CHAT_LIST_DRAFT_PREVIEW',
      'CHAT_LIST_AUDIO_PREVIEW',
      'CHAT_LIST_IMAGE_PREVIEW',
      'CHAT_LIST_FILE_PREVIEW',
      'CHAT_LIST_BADGES',
      'CHAT_LIST_GROUP_PILL',
      'CHAT_LIST_STATUS_PILLS',
      'CHAT_LIST_STATUS_PILL_REPORTED',
      'CHAT_LIST_STATUS_PILL_BLOCKED',
      'CHAT_LIST_ITEM_ACTIONS',
      'CHAT_LIST_ITEM_CHILDREN',
      'CHAT_LIST_PIN_TOGGLE',
      'CHAT_LIST_PIN_MENU',
      'CHAT_LIST_PIN_MENU_ITEM',
      'CHAT_LIST_PIN_MENU_DANGER',
      'CHAT_LIST_PIN_MENU_REPORT',
      // Group-scoped sub-areas
      'CHAT_LIST_ITEM_GROUP_NAME',
      'CHAT_LIST_ITEM_GROUP_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_DRAFT_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_AUDIO_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_IMAGE_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_FILE_PREVIEW',
      'CHAT_LIST_ITEM_GROUP_BADGES',
      'CHAT_LIST_ITEM_GROUP_ACTIONS',
      'CHAT_LIST_ITEM_GROUP_STATUS_PILLS',
      // Individual-chat-scoped sub-areas
      'CHAT_LIST_ITEM_NAME_SCOPED',
      'CHAT_LIST_ITEM_PREVIEW',
      'CHAT_LIST_ITEM_DRAFT_PREVIEW',
      'CHAT_LIST_ITEM_AUDIO_PREVIEW',
      'CHAT_LIST_ITEM_IMAGE_PREVIEW',
      'CHAT_LIST_ITEM_FILE_PREVIEW',
      'CHAT_LIST_ITEM_BADGES',
      'CHAT_LIST_ITEM_ACTIONS_SCOPED',
      'CHAT_LIST_ITEM_STATUS_PILLS',
    ];

    return {
      version: 2,
      themeMode,
      scope,
      currentStyles:       this.buildCurrentStyles(CHAT_LIST_AREA_IDS),
      areaCatalog:         this.buildAreaCatalog(CHAT_LIST_AREA_IDS),
      domState:            this.buildDomState(CHAT_LIST_AREA_IDS),
      computedStyles:      this.buildComputedStylesForAreas(CHAT_LIST_AREA_IDS),
      groupExpansionHints: { ...UiCustomizationService.GROUP_EXPANSION_HINTS },
    };
  }

  private buildCurrentStyles(areaIds: NexoAreaId[]): Record<string, Record<string, string | null>> {
    const theme = this.getActiveTheme();
    const vars  = this.getThemeVars(theme);

    const result: Record<string, Record<string, string | null>> = {};
    for (const areaId of areaIds) {
      const areaConfig = NEXO_CUSTOMIZABLE_AREAS[areaId];
      if (!areaConfig) continue;
      const areaStyles: Record<string, string | null> = {};
      for (const [property, cssVar] of Object.entries(areaConfig.cssVariables)) {
        if (!cssVar) continue;
        const value = vars.get(String(cssVar)) || this.readDomFallback(areaId, property);
        areaStyles[property] = value || null;
      }
      result[areaId] = areaStyles;
    }
    return result;
  }

  private buildAreaCatalog(areaIds: NexoAreaId[]): Record<string, UiCustomizationAreaCatalogEntry> {
    const catalog: Record<string, UiCustomizationAreaCatalogEntry> = {};
    for (const areaId of areaIds) {
      const areaConfig = NEXO_CUSTOMIZABLE_AREAS[areaId];
      if (!areaConfig) continue;
      catalog[areaId] = {
        label:      areaConfig.label,
        selectors:  UiCustomizationService.AREA_DOM_SELECTORS[areaId] ?? [],
        properties: Object.keys(areaConfig.cssVariables),
      };
    }
    return catalog;
  }

  private buildDomState(areaIds: NexoAreaId[]): Record<string, UiCustomizationDomStateEntry> {
    const domState: Record<string, UiCustomizationDomStateEntry> = {};
    for (const areaId of areaIds) {
      const selectors        = UiCustomizationService.AREA_DOM_SELECTORS[areaId];
      const fallbackAvailable = Object.keys(UiCustomizationService.DOM_FALLBACKS)
        .some(k => k.startsWith(`${areaId}:`));

      if (!selectors?.length) {
        domState[areaId] = { exists: false, selectorUsed: null, fallbackAvailable };
        continue;
      }

      let exists      = false;
      let selectorUsed: string | null = null;
      try {
        for (const sel of selectors) {
          if (document.querySelector(sel)) { exists = true; selectorUsed = sel; break; }
        }
      } catch { /* ignore */ }

      const entry: UiCustomizationDomStateEntry = { exists, selectorUsed, fallbackAvailable };
      if (!exists) {
        const reason = UiCustomizationService.CLOSED_AREA_REASONS[areaId];
        if (reason) entry.reason = reason;
      }
      domState[areaId] = entry;
    }
    return domState;
  }

  private buildComputedStylesForAreas(areaIds: NexoAreaId[]): Record<string, Record<string, string | null>> {
    const result: Record<string, Record<string, string | null>> = {};
    for (const areaId of areaIds) {
      const areaConfig = NEXO_CUSTOMIZABLE_AREAS[areaId];
      const selectors  = UiCustomizationService.AREA_DOM_SELECTORS[areaId];
      if (!areaConfig) { result[areaId] = {}; continue; }

      let el: Element | null = null;
      if (selectors?.length) {
        try {
          for (const sel of selectors) {
            el = document.querySelector(sel);
            if (el) break;
          }
        } catch { /* ignore */ }
      }

      const areaComputed: Record<string, string | null> = {};
      if (el) {
        const cs = getComputedStyle(el);
        for (const property of Object.keys(areaConfig.cssVariables)) {
          const cssProp = UiCustomizationService.CSS_COMPUTED_PROPS[property];
          if (!cssProp) { areaComputed[property] = null; continue; }
          try {
            const val = cs.getPropertyValue(cssProp).trim();
            areaComputed[property] = val || null;
          } catch { areaComputed[property] = null; }
        }
      } else {
        for (const property of Object.keys(areaConfig.cssVariables)) {
          areaComputed[property] = null;
        }
      }
      result[areaId] = areaComputed;
    }
    return result;
  }

  private getCompanionVars(area: string, property: string): string[] {
    const normArea = UiCustomizationService.AREA_ALIASES[area] ?? area;
    const normProp = UiCustomizationService.PROPERTY_ALIASES[`${normArea}:${property}`] ?? property;
    const key = `${normArea}:${normProp}`;
    return UiCustomizationService.COMPANION_VARS[key] ?? [];
  }

  private resolveCssVar(area: string, property: string): string | null {
    const normArea  = UiCustomizationService.AREA_ALIASES[area] ?? area;
    const normProp  = UiCustomizationService.PROPERTY_ALIASES[`${normArea}:${property}`] ?? property;
    const areaConfig = NEXO_CUSTOMIZABLE_AREAS[normArea as NexoAreaId];
    if (!areaConfig) return null;
    const cssVar = areaConfig.cssVariables[normProp as NexoCssProperty];
    return cssVar ? String(cssVar).trim() : null;
  }

  private normalizeArea(area: string): string {
    return UiCustomizationService.AREA_ALIASES[area] ?? area;
  }

  private getAreaSelectors(area: string, property?: string): string {
    const normalizedArea = this.normalizeArea(area);
    if (normalizedArea === 'CHAT_LIST_ITEM' && property === 'HOVER_BACKGROUND_COLOR') {
      return '.chat-item:not(.chat-item--group):hover';
    }
    const selectors = UiCustomizationService.AREA_DOM_SELECTORS[normalizedArea] ?? [];
    return selectors.join(',');
  }

  private logApplyChange(area: string, property: string, cssVar: string, value: string, themeMode: 'light' | 'dark'): void {
    const normalizedArea = this.normalizeArea(area);
    const selectors = this.getAreaSelectors(normalizedArea, property);
    console.log(
      `[UI_CUSTOMIZATION][APPLY_CHANGE] themeMode=${themeMode} area=${normalizedArea} property=${property} cssVar=${cssVar} selectors=${selectors} value=${value}`
    );
  }

  private isAllowedCssVar(cssVar: string): boolean {
    return this.allowedCssVars.has(this.normalizeValue(cssVar));
  }

  private readDomFallback(area: string, property: string): string | null {
    const key = `${area}:${property}`;
    const fb  = UiCustomizationService.DOM_FALLBACKS[key];
    if (!fb) return null;
    try {
      const el = document.querySelector(fb.selector);
      if (el) {
        const computed = getComputedStyle(el).getPropertyValue(fb.cssProperty).trim();
        if (computed) return computed;
      }
    } catch { /* ignore */ }
    return fb.default ?? null;
  }

  private resolveValue(property: string, value: string): string | null {
    const v = this.normalizeValue(value);
    if (!v) return null;
    if (property === 'SHADOW_PRESET' || property === 'SHADOW') {
      return UiCustomizationService.SHADOW_PRESETS[v.toUpperCase()] ?? v;
    }
    return v;
  }

  private normalizeValue(value: string): string {
    return String(value || '').trim();
  }
}
