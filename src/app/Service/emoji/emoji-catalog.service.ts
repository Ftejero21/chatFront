import { Injectable } from '@angular/core';

export interface EmojiLibraryItem {
  shortcodes?: string[];
  annotation?: string;
  tags?: string[];
  emoji?: string;
  hexcode?: string;
  order?: number;
  group?: number;
}

@Injectable({
  providedIn: 'root',
})
export class EmojiCatalogService {
  private readonly emojiDataSource =
    'https://cdn.jsdelivr.net/npm/emojibase-data@15.3.0/en/data.json';

  private inflightLoad: Promise<EmojiLibraryItem[]> | null = null;
  private cache: EmojiLibraryItem[] = [];
  private hasLoaded = false;

  public preload(): Promise<EmojiLibraryItem[]> {
    if (this.hasLoaded) return Promise.resolve(this.cache);
    if (this.inflightLoad) return this.inflightLoad;

    this.inflightLoad = fetch(this.emojiDataSource, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<EmojiLibraryItem[]>;
      })
      .then((data) => {
        this.cache = Array.isArray(data) ? data : [];
        this.hasLoaded = true;
        return this.cache;
      })
      .finally(() => {
        this.inflightLoad = null;
      });

    return this.inflightLoad;
  }

  public async getOrLoad(): Promise<EmojiLibraryItem[]> {
    if (this.hasLoaded) return this.cache;
    return this.preload();
  }
}
