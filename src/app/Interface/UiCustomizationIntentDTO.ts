export interface UiCustomizationChange {
  area: string;
  property: string;
  value?: string | null;
  valuePreset?: string | null;
  requestedValue?: string | null;
  appliedValue?: string | null;
  minAllowedValue?: string | null;
  maxAllowedValue?: string | null;
  normalized?: boolean | null;
  normalizationReason?: string | null;
}

export interface UiCustomizationIntentRequest {
  consulta: string;
}

export interface UiCustomizationIntentResponse {
  success: boolean;
  /** UI_CUSTOMIZATION_OK | UI_CUSTOMIZATION_LOW_CONFIDENCE | UI_CUSTOMIZATION_NOT_ALLOWED | RESET_THEME */
  codigo: string;
  mensaje: string;
  /** UI_CUSTOMIZATION target */
  target?: string;
  /** UPDATE_STYLE | UPDATE_STYLE_GROUP | UPDATE_STYLE_MULTI | RESET_THEME */
  action?: string;
  area?: string;
  property?: string;
  value?: string;
  valuePreset?: string;
  requestedValue?: string;
  appliedValue?: string;
  minAllowedValue?: string;
  maxAllowedValue?: string;
  normalized?: boolean;
  normalizationReason?: string;
  label?: string;
  cssVariable?: string;
  confidence?: number;
  /** Only for UPDATE_STYLE_GROUP / UPDATE_STYLE_MULTI */
  changes?: UiCustomizationChange[];
}

export interface UiCustomizationAreaCatalogEntry {
  label: string;
  selectors: string[];
  properties: string[];
}

export interface UiCustomizationDomStateEntry {
  exists: boolean;
  selectorUsed?: string | null;
  reason?: string;
  fallbackAvailable?: boolean;
}

export interface UiCustomizationContext {
  version: 2;
  themeMode: 'light' | 'dark';
  scope: 'CHAT_LIST';
  currentStyles: Record<string, Record<string, string | null>>;
  areaCatalog: Record<string, UiCustomizationAreaCatalogEntry>;
  domState: Record<string, UiCustomizationDomStateEntry>;
  computedStyles: Record<string, Record<string, string | null>>;
  groupExpansionHints: Record<string, string[]>;
}
