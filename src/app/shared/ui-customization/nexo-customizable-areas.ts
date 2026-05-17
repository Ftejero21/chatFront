export type NexoCssProperty =
  | 'BACKGROUND_COLOR'
  | 'BACKGROUND_IMAGE'
  | 'TEXT_COLOR'
  | 'SECONDARY_TEXT_COLOR'
  | 'ICON_COLOR'
  | 'BORDER_COLOR'
  | 'BORDER_RADIUS'
  | 'FONT_SIZE'
  | 'COLOR'
  | 'ACTIVE_BACKGROUND_COLOR'
  | 'ACTIVE_TEXT_COLOR'
  | 'ACTIVE_ICON_COLOR'
  | 'HOVER_BACKGROUND_COLOR'
  | 'HOVER_TEXT_COLOR'
  | 'HOVER_ICON_COLOR'
  | 'UNREAD_BACKGROUND_COLOR'
  | 'CARD_BACKGROUND_COLOR'
  | 'INPUT_BACKGROUND_COLOR'
  | 'PLACEHOLDER_COLOR'
  | 'SEND_BUTTON_COLOR'
  | 'CHECK_COLOR'
  | 'SHADOW_PRESET'
  | 'SHADOW'
  | 'OPACITY'
  | 'GAP'
  | 'WIDTH'
  | 'BADGE_COLOR'
  | 'SENDER_TEXT_COLOR'
  | 'PREVIEW_SENDER_TEXT_COLOR'
  | 'REPORTED_BACKGROUND_COLOR'
  | 'REPORTED_TEXT_COLOR'
  | 'BLOCKED_BACKGROUND_COLOR'
  | 'BLOCKED_TEXT_COLOR'
  | 'LABEL_COLOR'
  | 'SEPARATOR_COLOR'
  | 'TIME_COLOR'
  | 'FOCUS_BORDER_COLOR'
  | 'BORDER_WIDTH'
  | 'PREVIEW_TEXT_COLOR'
  | 'FONT_WEIGHT';

export type NexoAreaId =
  | 'MAIN_LAYOUT'
  | 'SIDEBAR_NAV'
  | 'SIDEBAR_NAV_ITEM'
  | 'SIDEBAR_NAV_ACTIVE_ITEM'
  | 'TOPBAR'
  | 'TOPBAR_PROFILE'
  | 'CHAT_LIST_PANEL'
  | 'CHAT_LIST_HEADER'
  | 'CHAT_LIST_ACTIONS_MENU'
  | 'CHAT_LIST_SEARCH'
  | 'CHAT_LIST_FILTERS'
  | 'CHAT_LIST_SCROLLBAR'
  | 'CHAT_LIST_ITEM'
  | 'CHAT_LIST_ITEM_ACTIVE'
  | 'CHAT_LIST_ITEM_UNREAD'
  | 'CHAT_LIST_ITEM_GROUP'
  | 'CHAT_LIST_PREVIEW'
  | 'CHAT_LIST_BADGES'
  | 'CHAT_LIST_EMPTY_STATE'
  | 'CHAT_LIST_SIDE_PANEL'
  | 'CHAT_HEADER'
  | 'CHAT_HEADER_STATUS'
  | 'CHAT_MESSAGES_AREA'
  | 'MESSAGE_BUBBLES'
  | 'OWN_MESSAGE_BUBBLE'
  | 'OTHER_MESSAGE_BUBBLE'
  | 'GROUP_MESSAGE_BUBBLE'
  | 'MESSAGE_META'
  | 'MESSAGE_REACTIONS'
  | 'CHAT_COMPOSER'
  | 'CHAT_COMPOSER_TEXTAREA'
  | 'CHAT_COMPOSER_ACTIONS'
  | 'CHAT_COMPOSER_SEND_BUTTON'
  | 'COMPOSE_ACTIONS_POPUP'
  | 'MESSAGE_OPTIONS_DROPDOWN'
  | 'REPLY_BANNER'
  | 'AI_SEARCH_POPUP'
  | 'AI_SEARCH_RESULTS'
  | 'AI_ASK_POPUP'
  | 'GROUP_INFO_PANEL'
  | 'USER_INFO_PANEL'
  | 'STARRED_MESSAGES_PANEL'
  | 'PUBLIC_CHATS_PANEL'
  | 'CREATE_GROUP_MODAL'
  | 'REPORT_USER_POPUP'
  | 'POLL_COMPOSER'
  | 'SCHEDULE_MESSAGE_COMPOSER'
  | 'TEMPORARY_MESSAGE_POPUP'
  | 'MEDIA_PREVIEW'
  | 'CHAT_LIST_ITEM_CHILDREN'
  | 'CHAT_LIST_GROUP_PILL'
  | 'CHAT_LIST_STATUS_PILLS'
  | 'CHAT_LIST_DRAFT_PREVIEW'
  | 'CHAT_LIST_AUDIO_PREVIEW'
  | 'CHAT_LIST_ITEM_ACTIONS'
  | 'CHAT_LIST_PIN_TOGGLE'
  | 'CHAT_LIST_PIN_MENU'
  | 'CHAT_LIST_PIN_MENU_ITEM'
  | 'CHAT_LIST_PIN_MENU_DANGER'
  | 'CHAT_LIST_PIN_MENU_REPORT'
  | 'CHAT_LIST_FILTER_BUTTONS'
  | 'CHAT_LIST_FILTER_BUTTONS_ACTIVE'
  | 'CHAT_LIST_TITLE'
  | 'CHAT_LIST_HEADER_ACTIONS'
  | 'CHAT_LIST_ACTIONS_MENU_ITEM'
  | 'CHAT_LIST_SCROLL'
  | 'CHAT_LIST_AVATAR'
  | 'CHAT_LIST_ITEM_CONTENT'
  | 'CHAT_LIST_ITEM_NAME'
  | 'CHAT_LIST_IMAGE_PREVIEW'
  | 'CHAT_LIST_FILE_PREVIEW'
  | 'CHAT_LIST_STATUS_PILL_REPORTED'
  | 'CHAT_LIST_STATUS_PILL_BLOCKED'
  | 'CHAT_LIST_ITEM_GROUP_PREVIEW'
  | 'CHAT_LIST_ITEM_GROUP_DRAFT_PREVIEW'
  | 'CHAT_LIST_ITEM_GROUP_AUDIO_PREVIEW'
  | 'CHAT_LIST_ITEM_GROUP_IMAGE_PREVIEW'
  | 'CHAT_LIST_ITEM_GROUP_FILE_PREVIEW'
  | 'CHAT_LIST_ITEM_GROUP_BADGES'
  | 'CHAT_LIST_ITEM_GROUP_ACTIONS'
  | 'CHAT_LIST_ITEM_GROUP_STATUS_PILLS'
  | 'CHAT_LIST_ITEM_PREVIEW'
  | 'CHAT_LIST_ITEM_DRAFT_PREVIEW'
  | 'CHAT_LIST_ITEM_AUDIO_PREVIEW'
  | 'CHAT_LIST_ITEM_IMAGE_PREVIEW'
  | 'CHAT_LIST_ITEM_FILE_PREVIEW'
  | 'CHAT_LIST_ITEM_BADGES'
  | 'CHAT_LIST_ITEM_ACTIONS_SCOPED'
  | 'CHAT_LIST_ITEM_STATUS_PILLS'
  | 'CHAT_LIST_ITEM_NAME_SCOPED'
  | 'CHAT_LIST_ITEM_GROUP_NAME'
  | 'CHAT_LIST_TYPING_PREVIEW'
  | 'CHAT_LIST_POLL_PREVIEW'
  | 'CHAT_LIST_CLOSED_PREVIEW'
  | 'CHAT_LIST_STATUS_INDICATOR'
  | 'CHAT_LIST_ITEM_GROUP_ACTIVE'
  | 'CHAT_LIST_ITEM_DATE'
  | 'SIDEBAR_NAV_PANEL'
  | 'SIDEBAR_NAV_GROUP'
  | 'SIDEBAR_NAV_BOTTOM'
  | 'SIDEBAR_NAV_ITEM_ACTIVE'
  | 'SIDEBAR_NAV_ACTIVE_INDICATOR'
  | 'SIDEBAR_NAV_LOGO'
  | 'SIDEBAR_NAV_ICON'
  | 'SIDEBAR_NAV_ICON_ACTIVE'
  | 'SIDEBAR_NAV_AI_ICON'
  | 'SIDEBAR_NAV_TOOLTIP'
  | 'SIDEBAR_NAV_AVATAR'
  | 'SIDEBAR_NAV_SETTINGS';

export interface NexoCustomizableArea {
  id: NexoAreaId;
  label: string;
  aliases: string[];
  cssVariables: Partial<Record<NexoCssProperty, string>>;
}

const area = (
  id: NexoAreaId,
  label: string,
  aliases: string[],
  cssVariables: Partial<Record<NexoCssProperty, string>>
): NexoCustomizableArea => ({ id, label, aliases, cssVariables });

export const NEXO_CUSTOMIZABLE_AREAS: Record<NexoAreaId, NexoCustomizableArea> = {
  MAIN_LAYOUT: area('MAIN_LAYOUT', 'Layout principal', ['layout', 'pantalla principal'], {
    BACKGROUND_COLOR: '--nexo-main-bg',
    TEXT_COLOR: '--nexo-main-text-color',
  }),
  SIDEBAR_NAV: area('SIDEBAR_NAV', 'Barra lateral', ['sidebar', 'barra lateral'], {
    BACKGROUND_COLOR: '--nexo-sidebar-bg',
    BORDER_COLOR: '--nexo-sidebar-border',
    ICON_COLOR: '--nexo-sidebar-icon-color',
  }),
  SIDEBAR_NAV_ITEM: area('SIDEBAR_NAV_ITEM', 'Items barra lateral', ['iconos sidebar', 'botones sidebar'], {
    BACKGROUND_COLOR:       '--nexo-sidebar-nav-item-bg',
    TEXT_COLOR:             '--nexo-sidebar-nav-item-text',
    ICON_COLOR:             '--nexo-sidebar-nav-item-icon',
    BORDER_COLOR:           '--nexo-sidebar-nav-item-border',
    BORDER_WIDTH:           '--nexo-sidebar-nav-item-border-width',
    BORDER_RADIUS:          '--nexo-sidebar-nav-item-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-sidebar-nav-item-hover-bg',
    HOVER_TEXT_COLOR:       '--nexo-sidebar-nav-item-hover-text',
    HOVER_ICON_COLOR:       '--nexo-sidebar-nav-item-hover-icon',
  }),
  SIDEBAR_NAV_ACTIVE_ITEM: area('SIDEBAR_NAV_ACTIVE_ITEM', 'Item activo barra lateral', ['sidebar activo'], {
    ACTIVE_BACKGROUND_COLOR: '--nexo-sidebar-active-bg',
    ACTIVE_TEXT_COLOR: '--nexo-sidebar-active-text-color',
    ACTIVE_ICON_COLOR: '--nexo-sidebar-active-icon-color',
  }),
  TOPBAR: area('TOPBAR', 'Topbar', ['barra superior', 'topbar'], {
    BACKGROUND_COLOR: '--nexo-topbar-bg',
    TEXT_COLOR: '--nexo-topbar-text-color',
    ICON_COLOR: '--nexo-topbar-icon-color',
    BORDER_COLOR: '--nexo-topbar-border',
  }),
  TOPBAR_PROFILE: area('TOPBAR_PROFILE', 'Perfil topbar', ['menu perfil'], {
    BACKGROUND_COLOR: '--nexo-topbar-profile-bg',
    TEXT_COLOR: '--nexo-topbar-profile-text',
    BORDER_COLOR: '--nexo-topbar-profile-border',
    BORDER_RADIUS: '--nexo-topbar-profile-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-topbar-profile-hover-bg',
  }),
  CHAT_LIST_PANEL: area('CHAT_LIST_PANEL', 'Panel listado chats', ['lista chats'], {
    BACKGROUND_COLOR: '--nexo-chat-list-panel-bg',
    TEXT_COLOR: '--nexo-chat-list-text',
    BORDER_COLOR: '--nexo-chat-list-border',
  }),
  CHAT_LIST_HEADER: area('CHAT_LIST_HEADER', 'Cabecera listado chats', ['cabecera lista chats', 'header lista'], {
    BACKGROUND_COLOR: '--nexo-chat-list-header-bg',
    ICON_COLOR: '--nexo-chat-list-icon-color',
    TEXT_COLOR: '--nexo-chat-list-title-color',
    BORDER_COLOR: '--nexo-chat-list-header-border',
  }),
  CHAT_LIST_ACTIONS_MENU: area('CHAT_LIST_ACTIONS_MENU', 'Menu acciones lista chats', ['menu acciones chats', 'dropdown lista'], {
    BACKGROUND_COLOR: '--nexo-chat-list-menu-bg',
    TEXT_COLOR: '--nexo-chat-list-menu-text',
    BORDER_COLOR: '--nexo-chat-list-menu-border',
    BORDER_RADIUS: '--nexo-chat-list-menu-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-list-menu-hover-bg',
  }),
  CHAT_LIST_SEARCH: area('CHAT_LIST_SEARCH', 'Buscador chats', ['buscador chats'], {
    INPUT_BACKGROUND_COLOR: '--nexo-chat-list-search-bg',
    BACKGROUND_COLOR: '--nexo-chat-list-search-bg',
    TEXT_COLOR: '--nexo-chat-list-search-text',
    PLACEHOLDER_COLOR: '--nexo-chat-list-search-placeholder',
    BORDER_COLOR: '--nexo-chat-list-search-border',
    ICON_COLOR: '--nexo-chat-list-search-icon-color',
    BORDER_RADIUS: '--nexo-chat-list-search-radius',
    FONT_SIZE: '--nexo-chat-list-search-font-size',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-list-search-hover-bg',
    FOCUS_BORDER_COLOR: '--nexo-chat-list-search-focus-border',
    SHADOW_PRESET: '--nexo-chat-list-search-shadow',
    BORDER_WIDTH: '--nexo-chat-list-search-border-width',
  }),
  CHAT_LIST_FILTERS: area('CHAT_LIST_FILTERS', 'Contenedor filtros chats', ['filtros chats', 'zona filtros'], {
    BACKGROUND_COLOR: '--nexo-chat-filters-bg',
    TEXT_COLOR: '--nexo-chat-filters-text',
    BORDER_COLOR: '--nexo-chat-filters-border',
    BORDER_RADIUS: '--nexo-chat-filters-radius',
    SHADOW_PRESET: '--nexo-chat-filters-shadow',
    // backwards compat: redirect old filter properties to button vars
    ACTIVE_BACKGROUND_COLOR: '--nexo-chat-filter-btn-active-bg',
    ACTIVE_TEXT_COLOR: '--nexo-chat-filter-btn-active-text',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-filter-btn-hover-bg',
    FONT_SIZE: '--nexo-chat-filter-btn-font-size',
    ICON_COLOR: '--nexo-chat-filter-btn-icon',
  }),
  CHAT_LIST_FILTER_BUTTONS: area('CHAT_LIST_FILTER_BUTTONS', 'Botones filtros chats', ['botones filtros', 'chips filtro', 'botones chips filtro'], {
    BACKGROUND_COLOR: '--nexo-chat-filter-btn-bg',
    TEXT_COLOR: '--nexo-chat-filter-btn-text',
    BORDER_COLOR: '--nexo-chat-filter-btn-border',
    BORDER_WIDTH: '--nexo-chat-filter-btn-border-width',
    BORDER_RADIUS: '--nexo-chat-filter-btn-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-filter-btn-hover-bg',
    ACTIVE_BACKGROUND_COLOR: '--nexo-chat-filter-btn-active-bg',
    ACTIVE_TEXT_COLOR: '--nexo-chat-filter-btn-active-text',
    ICON_COLOR: '--nexo-chat-filter-btn-icon',
    FONT_SIZE: '--nexo-chat-filter-btn-font-size',
    SHADOW_PRESET: '--nexo-chat-filter-btn-shadow',
  }),
  CHAT_LIST_SCROLLBAR: area('CHAT_LIST_SCROLLBAR', 'Scrollbar lista chats', ['scrollbar chats'], {
    COLOR: '--nexo-chat-list-scrollbar-thumb',
    BACKGROUND_COLOR: '--nexo-chat-list-scrollbar-track',
  }),
  CHAT_LIST_ITEM: area('CHAT_LIST_ITEM', 'Item listado chats', ['chat item'], {
    BACKGROUND_COLOR: '--nexo-chat-list-item-bg',
    TEXT_COLOR: '--nexo-chat-item-text',
    BORDER_COLOR: '--nexo-chat-item-border',
    BORDER_RADIUS: '--nexo-chat-item-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-list-item-hover-bg',
    SHADOW_PRESET: '--nexo-chat-item-shadow',
    REPORTED_BACKGROUND_COLOR: '--nexo-chat-reported-pill-bg',
    REPORTED_TEXT_COLOR: '--nexo-chat-reported-pill-text',
    BLOCKED_BACKGROUND_COLOR: '--nexo-chat-blocked-pill-bg',
    BLOCKED_TEXT_COLOR: '--nexo-chat-blocked-pill-text',
  }),
  CHAT_LIST_ITEM_ACTIVE: area('CHAT_LIST_ITEM_ACTIVE', 'Item chat activo', ['chat activo'], {
    BACKGROUND_COLOR:        '--nexo-chat-item-active-bg',
    TEXT_COLOR:              '--nexo-chat-item-active-text',
    ICON_COLOR:              '--nexo-chat-item-active-icon',
    ACTIVE_BACKGROUND_COLOR: '--nexo-chat-item-active-bg',
    ACTIVE_TEXT_COLOR:       '--nexo-chat-item-active-text',
    BORDER_COLOR:            '--nexo-chat-item-active-border',
    BORDER_WIDTH:            '--nexo-chat-item-active-border-width',
    BORDER_RADIUS:           '--nexo-chat-item-active-radius',
  }),
  CHAT_LIST_ITEM_UNREAD: area('CHAT_LIST_ITEM_UNREAD', 'Item chat no leido', ['chat no leido'], {
    BACKGROUND_COLOR:        '--nexo-chat-item-unread-bg',
    UNREAD_BACKGROUND_COLOR: '--nexo-chat-item-unread-bg',
    TEXT_COLOR:              '--nexo-chat-item-unread-name-color',
    HOVER_BACKGROUND_COLOR:  '--nexo-chat-item-unread-hover-bg',
    BORDER_COLOR:            '--nexo-chat-item-unread-border',
    BADGE_COLOR:             '--nexo-chat-unread-badge-bg',
    BORDER_RADIUS:           '--nexo-chat-item-unread-radius',
  }),
  CHAT_LIST_ITEM_GROUP: area('CHAT_LIST_ITEM_GROUP', 'Item chat grupal', ['chat grupo item', 'item grupo lista'], {
    BACKGROUND_COLOR: '--nexo-chat-list-item-group-bg',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-item-group-hover-bg',
    TEXT_COLOR: '--nexo-chat-item-group-text',
    BORDER_COLOR: '--nexo-chat-item-group-border',
    BORDER_RADIUS: '--nexo-chat-item-group-radius',
  }),
  CHAT_LIST_PREVIEW: area('CHAT_LIST_PREVIEW', 'Preview mensaje en lista', ['preview mensaje', 'ultimo mensaje lista'], {
    TEXT_COLOR: '--nexo-chat-preview-color',
    FONT_SIZE: '--nexo-chat-preview-font-size',
    SECONDARY_TEXT_COLOR: '--nexo-chat-item-name-color',
    SENDER_TEXT_COLOR: '--nexo-chat-preview-sender-color',
    PREVIEW_SENDER_TEXT_COLOR: '--nexo-chat-preview-sender-color',
  }),
  CHAT_LIST_BADGES: area('CHAT_LIST_BADGES', 'Badges no leidos', ['badge no leido', 'contador mensajes'], {
    BACKGROUND_COLOR: '--nexo-chat-unread-badge-bg',
    TEXT_COLOR: '--nexo-chat-unread-badge-text',
    BORDER_COLOR: '--nexo-chat-unread-badge-border',
    BORDER_RADIUS: '--nexo-chat-unread-badge-radius',
    FONT_SIZE: '--nexo-chat-unread-badge-font-size',
    SHADOW_PRESET: '--nexo-chat-unread-badge-shadow',
  }),
  CHAT_LIST_EMPTY_STATE: area('CHAT_LIST_EMPTY_STATE', 'Estado vacio lista chats', ['sin chats', 'lista vacia'], {
    BACKGROUND_COLOR: '--nexo-chat-empty-bg',
    TEXT_COLOR: '--nexo-chat-empty-text',
    CARD_BACKGROUND_COLOR: '--nexo-chat-empty-pulse-bg',
  }),
  CHAT_LIST_SIDE_PANEL: area('CHAT_LIST_SIDE_PANEL', 'Panel lateral lista chats', ['panel nuevo chat', 'panel lateral'], {
    BACKGROUND_COLOR: '--nexo-chat-side-panel-bg',
    BORDER_COLOR: '--nexo-chat-side-panel-border',
    TEXT_COLOR: '--nexo-chat-side-panel-text',
  }),
  CHAT_HEADER: area('CHAT_HEADER', 'Cabecera chat', ['header chat'], {
    BACKGROUND_COLOR: '--nexo-chat-header-bg',
    TEXT_COLOR: '--nexo-chat-header-text',
    ICON_COLOR: '--nexo-chat-header-icon-color',
    BORDER_COLOR: '--nexo-chat-header-border',
  }),
  CHAT_HEADER_STATUS: area('CHAT_HEADER_STATUS', 'Estado cabecera chat', ['estado chat'], {
    TEXT_COLOR: '--nexo-chat-header-status-text',
    ICON_COLOR: '--nexo-chat-header-status-icon-color',
  }),
  CHAT_MESSAGES_AREA: area('CHAT_MESSAGES_AREA', 'Area mensajes', ['fondo chat'], {
    BACKGROUND_COLOR: '--nexo-chat-bg',
    BACKGROUND_IMAGE: '--nexo-chat-bg-image',
  }),
  MESSAGE_BUBBLES: area('MESSAGE_BUBBLES', 'Burbujas mensaje', ['burbujas'], {
    BORDER_RADIUS: '--nexo-message-radius',
    SHADOW_PRESET: '--nexo-message-shadow',
  }),
  OWN_MESSAGE_BUBBLE: area('OWN_MESSAGE_BUBBLE', 'Mensajes propios', ['mis mensajes'], {
    BACKGROUND_COLOR: '--nexo-own-message-bg',
    TEXT_COLOR: '--nexo-own-message-color',
    BORDER_RADIUS: '--nexo-message-radius',
    SHADOW_PRESET: '--nexo-message-shadow',
  }),
  OTHER_MESSAGE_BUBBLE: area('OTHER_MESSAGE_BUBBLE', 'Mensajes recibidos', ['mensajes recibidos'], {
    BACKGROUND_COLOR: '--nexo-other-message-bg',
    TEXT_COLOR: '--nexo-other-message-color',
    BORDER_RADIUS: '--nexo-message-radius',
    SHADOW_PRESET: '--nexo-message-shadow',
  }),
  GROUP_MESSAGE_BUBBLE: area('GROUP_MESSAGE_BUBBLE', 'Mensajes grupo', ['mensajes grupales'], {
    BACKGROUND_COLOR: '--nexo-group-message-bg',
    TEXT_COLOR: '--nexo-group-message-color',
    BORDER_RADIUS: '--nexo-message-radius',
    SHADOW_PRESET: '--nexo-message-shadow',
  }),
  MESSAGE_META: area('MESSAGE_META', 'Meta mensaje', ['hora mensaje', 'checks'], {
    TEXT_COLOR: '--nexo-message-meta-color',
    CHECK_COLOR: '--nexo-message-check-color',
  }),
  MESSAGE_REACTIONS: area('MESSAGE_REACTIONS', 'Reacciones mensaje', ['reacciones'], {
    BACKGROUND_COLOR: '--nexo-message-reaction-bg',
    TEXT_COLOR: '--nexo-message-reaction-text',
    BORDER_COLOR: '--nexo-message-reaction-border',
    BORDER_RADIUS: '--nexo-message-reaction-radius',
  }),
  CHAT_COMPOSER: area('CHAT_COMPOSER', 'Composer chat', ['barra escribir'], {
    BACKGROUND_COLOR: '--nexo-composer-bg',
    BORDER_COLOR: '--nexo-composer-border',
    BORDER_RADIUS: '--nexo-composer-radius',
  }),
  CHAT_COMPOSER_TEXTAREA: area('CHAT_COMPOSER_TEXTAREA', 'Textarea composer', ['input mensaje'], {
    INPUT_BACKGROUND_COLOR: '--nexo-composer-input-bg',
    TEXT_COLOR: '--nexo-composer-input-text',
    PLACEHOLDER_COLOR: '--nexo-composer-placeholder',
    BORDER_COLOR: '--nexo-composer-input-border',
    BORDER_RADIUS: '--nexo-composer-input-radius',
  }),
  CHAT_COMPOSER_ACTIONS: area('CHAT_COMPOSER_ACTIONS', 'Acciones composer', ['botones composer'], {
    BACKGROUND_COLOR: '--nexo-composer-actions-bg',
    ICON_COLOR: '--nexo-composer-actions-icon-color',
    BORDER_COLOR: '--nexo-composer-actions-border',
  }),
  CHAT_COMPOSER_SEND_BUTTON: area('CHAT_COMPOSER_SEND_BUTTON', 'Boton enviar', ['boton enviar'], {
    SEND_BUTTON_COLOR: '--nexo-send-button-bg',
    ICON_COLOR: '--nexo-send-button-icon',
    BORDER_RADIUS: '--nexo-send-button-radius',
    SHADOW_PRESET: '--nexo-send-button-shadow',
  }),
  COMPOSE_ACTIONS_POPUP: area('COMPOSE_ACTIONS_POPUP', 'Popup acciones composer', ['popup acciones'], {
    BACKGROUND_COLOR: '--nexo-compose-popup-bg',
    TEXT_COLOR: '--nexo-compose-popup-text',
    BORDER_COLOR: '--nexo-compose-popup-border',
    BORDER_RADIUS: '--nexo-compose-popup-radius',
  }),
  MESSAGE_OPTIONS_DROPDOWN: area('MESSAGE_OPTIONS_DROPDOWN', 'Menu opciones mensaje', ['menu mensaje'], {
    BACKGROUND_COLOR: '--nexo-message-menu-bg',
    TEXT_COLOR: '--nexo-message-menu-text',
    BORDER_COLOR: '--nexo-message-menu-border',
    BORDER_RADIUS: '--nexo-message-menu-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-message-menu-hover-bg',
  }),
  REPLY_BANNER: area('REPLY_BANNER', 'Banner respuesta', ['reply banner'], {
    BACKGROUND_COLOR: '--nexo-reply-banner-bg',
    TEXT_COLOR: '--nexo-reply-banner-text',
    BORDER_COLOR: '--nexo-reply-banner-border',
    BORDER_RADIUS: '--nexo-reply-banner-radius',
  }),
  AI_SEARCH_POPUP: area('AI_SEARCH_POPUP', 'Popup busqueda IA', ['popup busqueda ia'], {
    BACKGROUND_COLOR: '--nexo-ai-popup-bg',
    TEXT_COLOR: '--nexo-ai-popup-text',
    BORDER_COLOR: '--nexo-ai-popup-border',
    BORDER_RADIUS: '--nexo-ai-popup-radius',
  }),
  AI_SEARCH_RESULTS: area('AI_SEARCH_RESULTS', 'Resultados busqueda IA', ['resultados ia'], {
    CARD_BACKGROUND_COLOR: '--nexo-ai-result-card-bg',
    TEXT_COLOR: '--nexo-ai-result-text',
    BORDER_COLOR: '--nexo-ai-result-border',
    BORDER_RADIUS: '--nexo-ai-result-radius',
  }),
  AI_ASK_POPUP: area('AI_ASK_POPUP', 'Popup preguntar IA', ['popup preguntar ia'], {
    BACKGROUND_COLOR: '--nexo-ai-ask-bg',
    TEXT_COLOR: '--nexo-ai-ask-text',
    BORDER_COLOR: '--nexo-ai-ask-border',
    INPUT_BACKGROUND_COLOR: '--nexo-ai-ask-input-bg',
    PLACEHOLDER_COLOR: '--nexo-ai-ask-placeholder',
    BORDER_RADIUS: '--nexo-ai-ask-radius',
  }),
  GROUP_INFO_PANEL: area('GROUP_INFO_PANEL', 'Panel info grupo', ['info grupo'], {
    BACKGROUND_COLOR: '--nexo-group-panel-bg',
    TEXT_COLOR: '--nexo-group-panel-text',
    SECONDARY_TEXT_COLOR: '--nexo-group-panel-muted',
    BORDER_COLOR: '--nexo-group-panel-border',
    INPUT_BACKGROUND_COLOR: '--nexo-group-panel-input-bg',
    BORDER_RADIUS: '--nexo-group-panel-radius',
  }),
  USER_INFO_PANEL: area('USER_INFO_PANEL', 'Panel info usuario', ['info usuario'], {
    BACKGROUND_COLOR: '--nexo-user-panel-bg',
    TEXT_COLOR: '--nexo-user-panel-text',
    SECONDARY_TEXT_COLOR: '--nexo-user-panel-muted',
    BORDER_COLOR: '--nexo-user-panel-border',
    INPUT_BACKGROUND_COLOR: '--nexo-user-panel-input-bg',
    BORDER_RADIUS: '--nexo-user-panel-radius',
  }),
  STARRED_MESSAGES_PANEL: area('STARRED_MESSAGES_PANEL', 'Panel mensajes destacados', ['destacados'], {
    BACKGROUND_COLOR: '--nexo-starred-panel-bg',
    CARD_BACKGROUND_COLOR: '--nexo-starred-card-bg',
    TEXT_COLOR: '--nexo-starred-panel-text',
    BORDER_COLOR: '--nexo-starred-panel-border',
    INPUT_BACKGROUND_COLOR: '--nexo-starred-search-bg',
    BORDER_RADIUS: '--nexo-starred-panel-radius',
  }),
  PUBLIC_CHATS_PANEL: area('PUBLIC_CHATS_PANEL', 'Panel chats publicos', ['chats publicos'], {
    BACKGROUND_COLOR: '--nexo-public-panel-bg',
    CARD_BACKGROUND_COLOR: '--nexo-public-card-bg',
    TEXT_COLOR: '--nexo-public-panel-text',
    BORDER_COLOR: '--nexo-public-panel-border',
    INPUT_BACKGROUND_COLOR: '--nexo-public-search-bg',
    BORDER_RADIUS: '--nexo-public-panel-radius',
  }),
  CREATE_GROUP_MODAL: area('CREATE_GROUP_MODAL', 'Modal crear grupo', ['crear grupo'], {
    BACKGROUND_COLOR: '--nexo-create-group-bg',
    TEXT_COLOR: '--nexo-create-group-text',
    BORDER_COLOR: '--nexo-create-group-border',
    INPUT_BACKGROUND_COLOR: '--nexo-create-group-input-bg',
    BORDER_RADIUS: '--nexo-create-group-radius',
  }),
  REPORT_USER_POPUP: area('REPORT_USER_POPUP', 'Popup reportar usuario', ['reportar usuario'], {
    BACKGROUND_COLOR: '--nexo-report-user-bg',
    TEXT_COLOR: '--nexo-report-user-text',
    BORDER_COLOR: '--nexo-report-user-border',
    INPUT_BACKGROUND_COLOR: '--nexo-report-user-input-bg',
    PLACEHOLDER_COLOR: '--nexo-report-user-placeholder',
    BORDER_RADIUS: '--nexo-report-user-radius',
  }),
  POLL_COMPOSER: area('POLL_COMPOSER', 'Composer encuesta', ['encuesta'], {
    BACKGROUND_COLOR: '--nexo-poll-bg',
    TEXT_COLOR: '--nexo-poll-text',
    BORDER_COLOR: '--nexo-poll-border',
    INPUT_BACKGROUND_COLOR: '--nexo-poll-input-bg',
    BORDER_RADIUS: '--nexo-poll-radius',
  }),
  SCHEDULE_MESSAGE_COMPOSER: area('SCHEDULE_MESSAGE_COMPOSER', 'Programar mensaje', ['programar mensaje'], {
    BACKGROUND_COLOR: '--nexo-schedule-bg',
    TEXT_COLOR: '--nexo-schedule-text',
    BORDER_COLOR: '--nexo-schedule-border',
    INPUT_BACKGROUND_COLOR: '--nexo-schedule-input-bg',
    BORDER_RADIUS: '--nexo-schedule-radius',
  }),
  TEMPORARY_MESSAGE_POPUP: area('TEMPORARY_MESSAGE_POPUP', 'Popup mensajes temporales', ['mensajes temporales'], {
    BACKGROUND_COLOR: '--nexo-temp-popup-bg',
    TEXT_COLOR: '--nexo-temp-popup-text',
    BORDER_COLOR: '--nexo-temp-popup-border',
    BORDER_RADIUS: '--nexo-temp-popup-radius',
    ACTIVE_BACKGROUND_COLOR: '--nexo-temp-popup-active-bg',
    ACTIVE_TEXT_COLOR: '--nexo-temp-popup-active-text',
  }),
  MEDIA_PREVIEW: area('MEDIA_PREVIEW', 'Vista previa multimedia', ['vista previa multimedia'], {
    BACKGROUND_COLOR: '--nexo-media-preview-bg',
    TEXT_COLOR: '--nexo-media-preview-text',
    BORDER_COLOR: '--nexo-media-preview-border',
    CARD_BACKGROUND_COLOR: '--nexo-media-preview-card-bg',
    BORDER_RADIUS: '--nexo-media-preview-radius',
  }),
  CHAT_LIST_ITEM_CHILDREN: area('CHAT_LIST_ITEM_CHILDREN', 'Elementos hijos chat item', ['hijos chat item', 'subelementos chat'], {
    TEXT_COLOR: '--nexo-chat-item-children-text',
    ICON_COLOR: '--nexo-chat-item-children-icon',
    BADGE_COLOR: '--nexo-chat-item-children-badge-bg',
    BORDER_COLOR: '--nexo-chat-item-children-border',
  }),
  CHAT_LIST_GROUP_PILL: area('CHAT_LIST_GROUP_PILL', 'Pill grupo en lista chats', ['pill grupo', 'etiqueta grupo lista'], {
    BACKGROUND_COLOR: '--nexo-chat-group-pill-bg',
    TEXT_COLOR: '--nexo-chat-group-pill-text',
    BORDER_COLOR: '--nexo-chat-group-pill-border',
    BORDER_RADIUS: '--nexo-chat-group-pill-radius',
    FONT_SIZE: '--nexo-chat-group-pill-font-size',
    ICON_COLOR: '--nexo-chat-group-pill-icon',
  }),
  CHAT_LIST_STATUS_PILLS: area('CHAT_LIST_STATUS_PILLS', 'Pills de estado reportado/bloqueado', ['pill reportado', 'pill bloqueado', 'estado chat'], {
    REPORTED_BACKGROUND_COLOR: '--nexo-chat-reported-pill-bg',
    REPORTED_TEXT_COLOR: '--nexo-chat-reported-pill-text',
    BLOCKED_BACKGROUND_COLOR: '--nexo-chat-blocked-pill-bg',
    BLOCKED_TEXT_COLOR: '--nexo-chat-blocked-pill-text',
    BORDER_RADIUS: '--nexo-chat-status-pill-radius',
    BORDER_COLOR: '--nexo-chat-status-pill-border',
    BORDER_WIDTH: '--nexo-chat-status-pill-border-width',
    FONT_SIZE: '--nexo-chat-status-pill-font-size',
    ICON_COLOR: '--nexo-chat-status-pill-icon',
  }),
  CHAT_LIST_DRAFT_PREVIEW: area('CHAT_LIST_DRAFT_PREVIEW', 'Preview borrador en lista', ['preview draft', 'borrador lista'], {
    TEXT_COLOR: '--nexo-chat-preview-draft-text',
    LABEL_COLOR: '--nexo-chat-preview-draft-label',
    BACKGROUND_COLOR: '--nexo-chat-preview-draft-bg',
  }),
  CHAT_LIST_AUDIO_PREVIEW: area('CHAT_LIST_AUDIO_PREVIEW', 'Preview audio en lista', ['preview audio lista', 'audio chip lista'], {
    BACKGROUND_COLOR: '--nexo-chat-preview-audio-bg',
    TEXT_COLOR: '--nexo-chat-preview-audio-text',
    ICON_COLOR: '--nexo-chat-preview-audio-icon',
    BORDER_COLOR: '--nexo-chat-preview-audio-border',
    LABEL_COLOR: '--nexo-chat-preview-audio-label',
    SEPARATOR_COLOR: '--nexo-chat-preview-audio-separator',
    TIME_COLOR: '--nexo-chat-preview-audio-time',
  }),
  CHAT_LIST_ITEM_ACTIONS: area('CHAT_LIST_ITEM_ACTIONS', 'Acciones e iconos del chat item', ['iconos chat item', 'acciones lista chat'], {
    ICON_COLOR: '--nexo-chat-item-action-icon',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-item-action-hover-bg',
    ACTIVE_BACKGROUND_COLOR: '--nexo-chat-item-action-active-bg',
  }),
  CHAT_LIST_FILTER_BUTTONS_ACTIVE: area('CHAT_LIST_FILTER_BUTTONS_ACTIVE', 'Botón filtro activo', ['filtro activo', 'chip filtro activo', 'botón activo filtros'], {
    BACKGROUND_COLOR: '--nexo-chat-filter-btn-active-bg',
    TEXT_COLOR: '--nexo-chat-filter-btn-active-text',
    BORDER_COLOR: '--nexo-chat-filter-btn-active-border',
    BORDER_WIDTH: '--nexo-chat-filter-btn-active-border-width',
    BORDER_RADIUS: '--nexo-chat-filter-btn-active-radius',
    FONT_SIZE: '--nexo-chat-filter-btn-active-font-size',
    ICON_COLOR: '--nexo-chat-filter-btn-active-icon',
    SHADOW_PRESET: '--nexo-chat-filter-btn-active-shadow',
  }),
  CHAT_LIST_PIN_TOGGLE: area('CHAT_LIST_PIN_TOGGLE', 'Botón desplegable chat item', ['desplegable chat', 'tres puntos chat', 'opciones chat item'], {
    BACKGROUND_COLOR: '--nexo-chat-pin-toggle-bg',
    TEXT_COLOR: '--nexo-chat-pin-toggle-text',
    ICON_COLOR: '--nexo-chat-pin-toggle-icon',
    BORDER_COLOR: '--nexo-chat-pin-toggle-border',
    BORDER_RADIUS: '--nexo-chat-pin-toggle-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-pin-toggle-hover-bg',
    ACTIVE_BACKGROUND_COLOR: '--nexo-chat-pin-toggle-active-bg',
    ACTIVE_ICON_COLOR: '--nexo-chat-pin-toggle-active-icon',
  }),
  CHAT_LIST_PIN_MENU: area('CHAT_LIST_PIN_MENU', 'Menú desplegable chat item', ['menu desplegable chat', 'menu opciones chat'], {
    BACKGROUND_COLOR: '--nexo-chat-pin-menu-bg',
    TEXT_COLOR: '--nexo-chat-pin-menu-text',
    BORDER_COLOR: '--nexo-chat-pin-menu-border',
    BORDER_RADIUS: '--nexo-chat-pin-menu-radius',
    SHADOW_PRESET: '--nexo-chat-pin-menu-shadow',
    FONT_SIZE: '--nexo-chat-pin-menu-font-size',
  }),
  CHAT_LIST_PIN_MENU_ITEM: area('CHAT_LIST_PIN_MENU_ITEM', 'Item menú desplegable chat', ['opciones menu chat', 'item menu chat'], {
    BACKGROUND_COLOR: '--nexo-chat-pin-menu-item-bg',
    TEXT_COLOR: '--nexo-chat-pin-menu-item-text',
    ICON_COLOR: '--nexo-chat-pin-menu-item-icon',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-pin-menu-item-hover-bg',
    BORDER_RADIUS: '--nexo-chat-pin-menu-item-radius',
    FONT_SIZE: '--nexo-chat-pin-menu-item-font-size',
  }),
  CHAT_LIST_PIN_MENU_DANGER: area('CHAT_LIST_PIN_MENU_DANGER', 'Opción peligrosa menú chat', ['eliminar chat', 'vaciar chat', 'opcion peligrosa menu'], {
    BACKGROUND_COLOR: '--nexo-chat-pin-menu-danger-bg',
    TEXT_COLOR: '--nexo-chat-pin-menu-danger-text',
    ICON_COLOR: '--nexo-chat-pin-menu-danger-icon',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-pin-menu-danger-hover-bg',
    BORDER_COLOR: '--nexo-chat-pin-menu-danger-border',
  }),
  CHAT_LIST_PIN_MENU_REPORT: area('CHAT_LIST_PIN_MENU_REPORT', 'Opción denunciar menú chat', ['denunciar chat', 'reportar chat', 'opcion denuncia menu'], {
    BACKGROUND_COLOR: '--nexo-chat-pin-menu-report-bg',
    TEXT_COLOR: '--nexo-chat-pin-menu-report-text',
    ICON_COLOR: '--nexo-chat-pin-menu-report-icon',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-pin-menu-report-hover-bg',
    BORDER_COLOR: '--nexo-chat-pin-menu-report-border',
  }),
  CHAT_LIST_TITLE: area('CHAT_LIST_TITLE', 'Título cabecera chats', ['titulo chats', 'nombre cabecera lista'], {
    TEXT_COLOR:  '--nexo-chat-list-title-color',
    FONT_SIZE:   '--nexo-chat-list-title-font-size',
    ICON_COLOR:  '--nexo-chat-list-title-icon',
  }),
  CHAT_LIST_HEADER_ACTIONS: area('CHAT_LIST_HEADER_ACTIONS', 'Botones cabecera chats', ['iconos cabecera', 'botones cabecera lista'], {
    ICON_COLOR:              '--nexo-chat-list-header-action-icon',
    BACKGROUND_COLOR:        '--nexo-chat-list-header-action-bg',
    HOVER_BACKGROUND_COLOR:  '--nexo-chat-list-header-action-hover-bg',
    BORDER_RADIUS:           '--nexo-chat-list-header-action-radius',
  }),
  CHAT_LIST_ACTIONS_MENU_ITEM: area('CHAT_LIST_ACTIONS_MENU_ITEM', 'Item menú acciones lista', ['opcion menu lista', 'item dropdown lista'], {
    BACKGROUND_COLOR:        '--nexo-chat-list-menu-item-bg',
    TEXT_COLOR:              '--nexo-chat-list-menu-item-text',
    ICON_COLOR:              '--nexo-chat-list-menu-item-icon',
    HOVER_BACKGROUND_COLOR:  '--nexo-chat-list-menu-item-hover-bg',
    BORDER_RADIUS:           '--nexo-chat-list-menu-item-radius',
  }),
  CHAT_LIST_SCROLL: area('CHAT_LIST_SCROLL', 'Contenedor scroll lista chats', ['scroll lista chats'], {
    BACKGROUND_COLOR: '--nexo-chat-list-scroll-bg',
  }),
  CHAT_LIST_AVATAR: area('CHAT_LIST_AVATAR', 'Avatar chat item', ['avatar chat', 'foto perfil lista'], {
    BORDER_COLOR:  '--nexo-chat-avatar-border',
    BORDER_RADIUS: '--nexo-chat-avatar-radius',
    BORDER_WIDTH:  '--nexo-chat-avatar-border-width',
  }),
  CHAT_LIST_ITEM_CONTENT: area('CHAT_LIST_ITEM_CONTENT', 'Contenido item chat', ['contenido chat item', 'info chat item'], {
    BACKGROUND_COLOR: '--nexo-chat-item-content-bg',
    TEXT_COLOR:       '--nexo-chat-item-content-text',
  }),
  CHAT_LIST_ITEM_NAME: area('CHAT_LIST_ITEM_NAME', 'Nombre en chat item', ['nombre chat lista', 'nombre item lista'], {
    TEXT_COLOR: '--nexo-chat-item-name-color',
    FONT_SIZE:  '--nexo-chat-item-name-font-size',
  }),
  CHAT_LIST_IMAGE_PREVIEW: area('CHAT_LIST_IMAGE_PREVIEW', 'Preview imagen en lista', ['preview imagen lista', 'miniatura imagen lista'], {
    TEXT_COLOR:       '--nexo-chat-preview-image-text',
    BACKGROUND_COLOR: '--nexo-chat-preview-image-bg',
    BORDER_COLOR:     '--nexo-chat-preview-image-border',
    BORDER_RADIUS:    '--nexo-chat-preview-image-radius',
    ICON_COLOR:       '--nexo-chat-preview-image-icon',
  }),
  CHAT_LIST_FILE_PREVIEW: area('CHAT_LIST_FILE_PREVIEW', 'Preview archivo en lista', ['preview archivo lista', 'fichero lista'], {
    TEXT_COLOR:       '--nexo-chat-preview-file-text',
    BACKGROUND_COLOR: '--nexo-chat-preview-file-bg',
    BORDER_COLOR:     '--nexo-chat-preview-file-border',
    BORDER_RADIUS:    '--nexo-chat-preview-file-radius',
    ICON_COLOR:       '--nexo-chat-preview-file-icon',
  }),
  CHAT_LIST_STATUS_PILL_REPORTED: area('CHAT_LIST_STATUS_PILL_REPORTED', 'Pill estado reportado', ['pill reportado', 'etiqueta reportado'], {
    BACKGROUND_COLOR: '--nexo-chat-reported-pill-bg',
    TEXT_COLOR:       '--nexo-chat-reported-pill-text',
    BORDER_COLOR:     '--nexo-chat-status-pill-border',
    BORDER_RADIUS:    '--nexo-chat-status-pill-radius',
    FONT_SIZE:        '--nexo-chat-status-pill-font-size',
    ICON_COLOR:       '--nexo-chat-status-pill-icon',
  }),
  CHAT_LIST_STATUS_PILL_BLOCKED: area('CHAT_LIST_STATUS_PILL_BLOCKED', 'Pill estado bloqueado', ['pill bloqueado', 'etiqueta bloqueado'], {
    BACKGROUND_COLOR: '--nexo-chat-blocked-pill-bg',
    TEXT_COLOR:       '--nexo-chat-blocked-pill-text',
    BORDER_COLOR:     '--nexo-chat-status-pill-border',
    BORDER_RADIUS:    '--nexo-chat-status-pill-radius',
    FONT_SIZE:        '--nexo-chat-status-pill-font-size',
    ICON_COLOR:       '--nexo-chat-status-pill-icon',
  }),
  CHAT_LIST_ITEM_GROUP_PREVIEW: area('CHAT_LIST_ITEM_GROUP_PREVIEW', 'Preview mensaje chat grupal', ['preview grupo', 'ultimo mensaje grupo'], {
    TEXT_COLOR:                 '--nexo-group-item-preview-text',
    FONT_SIZE:                  '--nexo-group-item-preview-font-size',
    PREVIEW_SENDER_TEXT_COLOR:  '--nexo-group-item-preview-sender',
  }),
  CHAT_LIST_ITEM_GROUP_DRAFT_PREVIEW: area('CHAT_LIST_ITEM_GROUP_DRAFT_PREVIEW', 'Preview borrador chat grupal', ['draft preview grupo', 'borrador grupo'], {
    TEXT_COLOR:   '--nexo-group-item-draft-text',
    LABEL_COLOR:  '--nexo-group-item-draft-label',
    FONT_SIZE:    '--nexo-group-item-draft-font-size',
  }),
  CHAT_LIST_ITEM_GROUP_AUDIO_PREVIEW: area('CHAT_LIST_ITEM_GROUP_AUDIO_PREVIEW', 'Preview audio chat grupal', ['audio preview grupo', 'audio grupo lista'], {
    BACKGROUND_COLOR: '--nexo-group-item-audio-bg',
    TEXT_COLOR:       '--nexo-group-item-audio-text',
    ICON_COLOR:       '--nexo-group-item-audio-icon',
    BORDER_COLOR:     '--nexo-group-item-audio-border',
    LABEL_COLOR:      '--nexo-group-item-audio-label',
    TIME_COLOR:       '--nexo-group-item-audio-time',
    SEPARATOR_COLOR:  '--nexo-group-item-audio-separator',
  }),
  CHAT_LIST_ITEM_GROUP_IMAGE_PREVIEW: area('CHAT_LIST_ITEM_GROUP_IMAGE_PREVIEW', 'Preview imagen chat grupal', ['imagen preview grupo', 'foto preview grupo'], {
    BACKGROUND_COLOR: '--nexo-group-item-image-bg',
    TEXT_COLOR:       '--nexo-group-item-image-text',
    BORDER_COLOR:     '--nexo-group-item-image-border',
  }),
  CHAT_LIST_ITEM_GROUP_FILE_PREVIEW: area('CHAT_LIST_ITEM_GROUP_FILE_PREVIEW', 'Preview archivo chat grupal', ['archivo preview grupo', 'fichero preview grupo'], {
    BACKGROUND_COLOR: '--nexo-group-item-file-bg',
    TEXT_COLOR:       '--nexo-group-item-file-text',
    ICON_COLOR:       '--nexo-group-item-file-icon',
    BORDER_COLOR:     '--nexo-group-item-file-border',
  }),
  CHAT_LIST_ITEM_GROUP_BADGES: area('CHAT_LIST_ITEM_GROUP_BADGES', 'Badges no leidos chat grupal', ['badge grupo', 'contador grupo'], {
    BACKGROUND_COLOR: '--nexo-group-item-badge-bg',
    TEXT_COLOR:       '--nexo-group-item-badge-text',
    BORDER_COLOR:     '--nexo-group-item-badge-border',
  }),
  CHAT_LIST_ITEM_GROUP_ACTIONS: area('CHAT_LIST_ITEM_GROUP_ACTIONS', 'Iconos accion chat grupal', ['acciones grupo', 'iconos grupo lista'], {
    ICON_COLOR:             '--nexo-group-item-action-icon',
    HOVER_BACKGROUND_COLOR: '--nexo-group-item-action-hover-bg',
  }),
  CHAT_LIST_ITEM_GROUP_STATUS_PILLS: area('CHAT_LIST_ITEM_GROUP_STATUS_PILLS', 'Pills estado chat grupal', ['pills estado grupo', 'reportado bloqueado grupo'], {
    REPORTED_BACKGROUND_COLOR: '--nexo-group-item-reported-bg',
    REPORTED_TEXT_COLOR:       '--nexo-group-item-reported-text',
    BLOCKED_BACKGROUND_COLOR:  '--nexo-group-item-blocked-bg',
    BLOCKED_TEXT_COLOR:        '--nexo-group-item-blocked-text',
  }),
  CHAT_LIST_ITEM_PREVIEW: area('CHAT_LIST_ITEM_PREVIEW', 'Preview mensaje chat individual', ['preview individual', 'ultimo mensaje individual'], {
    TEXT_COLOR:                '--nexo-indiv-item-preview-text',
    FONT_SIZE:                 '--nexo-indiv-item-preview-font-size',
    PREVIEW_SENDER_TEXT_COLOR: '--nexo-indiv-item-preview-sender',
  }),
  CHAT_LIST_ITEM_DRAFT_PREVIEW: area('CHAT_LIST_ITEM_DRAFT_PREVIEW', 'Preview borrador chat individual', ['draft individual', 'borrador individual'], {
    TEXT_COLOR:  '--nexo-indiv-item-draft-text',
    LABEL_COLOR: '--nexo-indiv-item-draft-label',
    FONT_SIZE:   '--nexo-indiv-item-draft-font-size',
  }),
  CHAT_LIST_ITEM_AUDIO_PREVIEW: area('CHAT_LIST_ITEM_AUDIO_PREVIEW', 'Preview audio chat individual', ['audio individual', 'audio preview individual'], {
    BACKGROUND_COLOR: '--nexo-indiv-item-audio-bg',
    TEXT_COLOR:       '--nexo-indiv-item-audio-text',
    ICON_COLOR:       '--nexo-indiv-item-audio-icon',
    BORDER_COLOR:     '--nexo-indiv-item-audio-border',
    LABEL_COLOR:      '--nexo-indiv-item-audio-label',
    TIME_COLOR:       '--nexo-indiv-item-audio-time',
    SEPARATOR_COLOR:  '--nexo-indiv-item-audio-separator',
  }),
  CHAT_LIST_ITEM_IMAGE_PREVIEW: area('CHAT_LIST_ITEM_IMAGE_PREVIEW', 'Preview imagen chat individual', ['imagen individual', 'foto preview individual'], {
    BACKGROUND_COLOR: '--nexo-indiv-item-image-bg',
    TEXT_COLOR:       '--nexo-indiv-item-image-text',
    BORDER_COLOR:     '--nexo-indiv-item-image-border',
  }),
  CHAT_LIST_ITEM_FILE_PREVIEW: area('CHAT_LIST_ITEM_FILE_PREVIEW', 'Preview archivo chat individual', ['archivo individual', 'fichero preview individual'], {
    BACKGROUND_COLOR: '--nexo-indiv-item-file-bg',
    TEXT_COLOR:       '--nexo-indiv-item-file-text',
    ICON_COLOR:       '--nexo-indiv-item-file-icon',
    BORDER_COLOR:     '--nexo-indiv-item-file-border',
  }),
  CHAT_LIST_ITEM_BADGES: area('CHAT_LIST_ITEM_BADGES', 'Badges no leidos chat individual', ['badge individual', 'contador individual'], {
    BACKGROUND_COLOR: '--nexo-indiv-item-badge-bg',
    TEXT_COLOR:       '--nexo-indiv-item-badge-text',
    BORDER_COLOR:     '--nexo-indiv-item-badge-border',
  }),
  CHAT_LIST_ITEM_ACTIONS_SCOPED: area('CHAT_LIST_ITEM_ACTIONS_SCOPED', 'Iconos accion chat individual', ['acciones individual', 'iconos individual lista'], {
    ICON_COLOR:             '--nexo-indiv-item-action-icon',
    HOVER_BACKGROUND_COLOR: '--nexo-indiv-item-action-hover-bg',
  }),
  CHAT_LIST_ITEM_STATUS_PILLS: area('CHAT_LIST_ITEM_STATUS_PILLS', 'Pills estado chat individual', ['pills estado individual', 'reportado bloqueado individual'], {
    REPORTED_BACKGROUND_COLOR: '--nexo-indiv-item-reported-bg',
    REPORTED_TEXT_COLOR:       '--nexo-indiv-item-reported-text',
    BLOCKED_BACKGROUND_COLOR:  '--nexo-indiv-item-blocked-bg',
    BLOCKED_TEXT_COLOR:        '--nexo-indiv-item-blocked-text',
  }),
  CHAT_LIST_ITEM_NAME_SCOPED: area('CHAT_LIST_ITEM_NAME_SCOPED', 'Nombre chat individual', ['nombre individual', 'nombre item individual'], {
    TEXT_COLOR: '--nexo-indiv-item-name-color',
    FONT_SIZE:  '--nexo-indiv-item-name-font-size',
  }),
  CHAT_LIST_ITEM_GROUP_NAME: area('CHAT_LIST_ITEM_GROUP_NAME', 'Nombre chat grupal', ['nombre grupal', 'nombre item grupal'], {
    TEXT_COLOR: '--nexo-group-item-name-color',
    FONT_SIZE:  '--nexo-group-item-name-font-size',
  }),
  CHAT_LIST_TYPING_PREVIEW: area('CHAT_LIST_TYPING_PREVIEW', 'Preview escribiendo lista', ['escribiendo lista', 'typing lista', 'audio lista'], {
    TEXT_COLOR: '--nexo-chat-typing-preview-text',
    ICON_COLOR: '--nexo-chat-typing-preview-icon',
  }),
  CHAT_LIST_POLL_PREVIEW: area('CHAT_LIST_POLL_PREVIEW', 'Preview encuesta lista', ['encuesta lista', 'poll preview lista'], {
    TEXT_COLOR: '--nexo-chat-poll-preview-text',
    ICON_COLOR: '--nexo-chat-poll-preview-icon',
  }),
  CHAT_LIST_CLOSED_PREVIEW: area('CHAT_LIST_CLOSED_PREVIEW', 'Preview chat cerrado lista', ['chat cerrado lista', 'closed preview'], {
    TEXT_COLOR: '--nexo-chat-closed-preview-text',
    ICON_COLOR: '--nexo-chat-closed-preview-icon',
  }),
  CHAT_LIST_STATUS_INDICATOR: area('CHAT_LIST_STATUS_INDICATOR', 'Indicador estado usuario lista', ['estado online', 'punto conectado', 'indicador online'], {
    BACKGROUND_COLOR: '--nexo-chat-status-online-bg',
    BORDER_COLOR:     '--nexo-chat-status-online-border',
  }),
  CHAT_LIST_ITEM_GROUP_ACTIVE: area('CHAT_LIST_ITEM_GROUP_ACTIVE', 'Chat grupal activo/seleccionado', ['chat grupo activo', 'grupo seleccionado', 'grupo activo'], {
    BACKGROUND_COLOR:       '--nexo-chat-item-group-active-bg',
    TEXT_COLOR:             '--nexo-chat-item-group-active-text',
    BORDER_COLOR:           '--nexo-chat-item-group-active-border',
    BORDER_WIDTH:           '--nexo-chat-item-group-active-border-width',
    BORDER_RADIUS:          '--nexo-chat-item-group-active-radius',
    HOVER_BACKGROUND_COLOR: '--nexo-chat-item-group-active-hover-bg',
    ICON_COLOR:             '--nexo-chat-item-group-active-icon',
    PREVIEW_TEXT_COLOR:     '--nexo-chat-item-group-active-preview-text',
  }),
  CHAT_LIST_ITEM_DATE: area('CHAT_LIST_ITEM_DATE', 'Fecha última actividad chat', ['fecha chat', 'hora chat', 'ultima fecha chat', 'fecha item lista'], {
    TEXT_COLOR:   '--nexo-chat-item-date-color',
    FONT_SIZE:    '--nexo-chat-item-date-font-size',
    FONT_WEIGHT:  '--nexo-chat-item-date-font-weight',
  }),
  SIDEBAR_NAV_PANEL: area('SIDEBAR_NAV_PANEL', 'Panel barra lateral', ['barra lateral panel', 'sidebar panel', 'barra izquierda'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-bg',
    TEXT_COLOR:       '--nexo-sidebar-nav-text',
    BORDER_COLOR:     '--nexo-sidebar-nav-border',
    BORDER_WIDTH:     '--nexo-sidebar-nav-border-width',
    BORDER_RADIUS:    '--nexo-sidebar-nav-radius',
    SHADOW:           '--nexo-sidebar-nav-shadow',
    SHADOW_PRESET:    '--nexo-sidebar-nav-shadow',
  }),
  SIDEBAR_NAV_GROUP: area('SIDEBAR_NAV_GROUP', 'Grupo iconos barra lateral', ['grupo sidebar', 'iconos superiores sidebar'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-group-bg',
    BORDER_COLOR:     '--nexo-sidebar-nav-group-border',
    GAP:              '--nexo-sidebar-nav-group-gap',
  }),
  SIDEBAR_NAV_BOTTOM: area('SIDEBAR_NAV_BOTTOM', 'Zona inferior barra lateral', ['sidebar bottom', 'zona usuario sidebar'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-bottom-bg',
    BORDER_COLOR:     '--nexo-sidebar-nav-bottom-border',
  }),
  SIDEBAR_NAV_ITEM_ACTIVE: area('SIDEBAR_NAV_ITEM_ACTIVE', 'Item activo barra lateral', ['boton activo sidebar', 'item activo sidebar'], {
    BACKGROUND_COLOR:        '--nexo-sidebar-nav-item-active-bg',
    ACTIVE_BACKGROUND_COLOR: '--nexo-sidebar-nav-item-active-bg',
    TEXT_COLOR:              '--nexo-sidebar-nav-item-active-text',
    ACTIVE_TEXT_COLOR:       '--nexo-sidebar-nav-item-active-text',
    ICON_COLOR:              '--nexo-sidebar-nav-item-active-icon',
    ACTIVE_ICON_COLOR:       '--nexo-sidebar-nav-item-active-icon',
    BORDER_COLOR:            '--nexo-sidebar-nav-item-active-border',
    BORDER_WIDTH:            '--nexo-sidebar-nav-item-active-border-width',
    BORDER_RADIUS:           '--nexo-sidebar-nav-item-active-radius',
  }),
  SIDEBAR_NAV_ACTIVE_INDICATOR: area('SIDEBAR_NAV_ACTIVE_INDICATOR', 'Indicador activo barra lateral', ['indicador activo sidebar', 'barra activa sidebar'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-active-indicator-bg',
    BORDER_COLOR:     '--nexo-sidebar-nav-active-indicator-border',
    WIDTH:            '--nexo-sidebar-nav-active-indicator-width',
  }),
  SIDEBAR_NAV_LOGO: area('SIDEBAR_NAV_LOGO', 'Logo barra lateral', ['logo nexo sidebar', 'logo n sidebar'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-logo-bg',
    TEXT_COLOR:       '--nexo-sidebar-nav-logo-text',
    BORDER_COLOR:     '--nexo-sidebar-nav-logo-border',
    BORDER_RADIUS:    '--nexo-sidebar-nav-logo-radius',
    FONT_SIZE:        '--nexo-sidebar-nav-logo-font-size',
    SHADOW:           '--nexo-sidebar-nav-logo-shadow',
    SHADOW_PRESET:    '--nexo-sidebar-nav-logo-shadow',
  }),
  SIDEBAR_NAV_ICON: area('SIDEBAR_NAV_ICON', 'Iconos barra lateral', ['iconos sidebar', 'iconos barra lateral'], {
    ICON_COLOR: '--nexo-sidebar-nav-icon-color',
    TEXT_COLOR: '--nexo-sidebar-nav-icon-color',
    COLOR:      '--nexo-sidebar-nav-icon-color',
  }),
  SIDEBAR_NAV_ICON_ACTIVE: area('SIDEBAR_NAV_ICON_ACTIVE', 'Iconos activos barra lateral', ['iconos activos sidebar', 'iconos activos barra lateral'], {
    ICON_COLOR:        '--nexo-sidebar-nav-icon-active-color',
    TEXT_COLOR:        '--nexo-sidebar-nav-icon-active-color',
    ACTIVE_ICON_COLOR: '--nexo-sidebar-nav-icon-active-color',
    COLOR:             '--nexo-sidebar-nav-icon-active-color',
  }),
  SIDEBAR_NAV_AI_ICON: area('SIDEBAR_NAV_AI_ICON', 'Icono Nexo IA barra lateral', ['icono ia sidebar', 'nexo ai sidebar'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-ai-icon-bg',
    BORDER_COLOR:     '--nexo-sidebar-nav-ai-icon-border',
    BORDER_RADIUS:    '--nexo-sidebar-nav-ai-icon-radius',
    OPACITY:          '--nexo-sidebar-nav-ai-icon-opacity',
  }),
  SIDEBAR_NAV_TOOLTIP: area('SIDEBAR_NAV_TOOLTIP', 'Tooltip barra lateral', ['tooltip sidebar', 'tooltip barra lateral'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-tooltip-bg',
    TEXT_COLOR:       '--nexo-sidebar-nav-tooltip-text',
    BORDER_COLOR:     '--nexo-sidebar-nav-tooltip-border',
    BORDER_RADIUS:    '--nexo-sidebar-nav-tooltip-radius',
    SHADOW:           '--nexo-sidebar-nav-tooltip-shadow',
    SHADOW_PRESET:    '--nexo-sidebar-nav-tooltip-shadow',
  }),
  SIDEBAR_NAV_AVATAR: area('SIDEBAR_NAV_AVATAR', 'Avatar barra lateral', ['avatar sidebar', 'avatar barra lateral'], {
    BACKGROUND_COLOR: '--nexo-sidebar-nav-avatar-bg',
    TEXT_COLOR:       '--nexo-sidebar-nav-avatar-text',
    BORDER_COLOR:     '--nexo-sidebar-nav-avatar-border',
    BORDER_WIDTH:     '--nexo-sidebar-nav-avatar-border-width',
    BORDER_RADIUS:    '--nexo-sidebar-nav-avatar-radius',
  }),
  SIDEBAR_NAV_SETTINGS: area('SIDEBAR_NAV_SETTINGS', 'Botones ajustes barra lateral', ['ajustes sidebar', 'settings sidebar'], {
    BACKGROUND_COLOR:       '--nexo-sidebar-nav-settings-bg',
    ICON_COLOR:             '--nexo-sidebar-nav-settings-icon',
    TEXT_COLOR:             '--nexo-sidebar-nav-settings-text',
    HOVER_BACKGROUND_COLOR: '--nexo-sidebar-nav-settings-hover-bg',
  }),
};

export const NEXO_CUSTOMIZATION_CSS_VARIABLES = Array.from(
  new Set(
    Object.values(NEXO_CUSTOMIZABLE_AREAS).flatMap((item) =>
      Object.values(item.cssVariables).filter((cssVar): cssVar is string => !!cssVar)
    )
  )
);
