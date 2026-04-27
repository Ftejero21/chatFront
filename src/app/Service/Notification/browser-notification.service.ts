import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';

export interface BrowserNewMessageNotificationPayload {
  messageId?: number | null;
  chatId?: number | null;
  senderId?: number | null;
  currentUserId?: number | null;
  senderName?: string | null;
  previewText?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class BrowserNotificationService {
  private readonly PERMISSION_REQUESTED_KEY =
    'browserNotifications.permissionRequested';
  private readonly DEDUPE_TTL_MS = 12000;
  private readonly AUTO_CLOSE_MS = 8000;
  private readonly OPEN_CHAT_QUERY_PARAM = 'openChatId';
  private readonly recentKeys = new Map<string, number>();

  constructor(private router: Router, private ngZone: NgZone) {}

  public requestPermissionIfNeeded(): void {
    if (!this.isSupported()) return;
    if (Notification.permission !== 'default') return;
    if (this.wasPermissionRequested()) return;

    this.markPermissionRequested();
    try {
      void Notification.requestPermission().catch(() => {});
    } catch {}
  }

  public canShowNotifications(): boolean {
    return this.isSupported() && Notification.permission === 'granted';
  }

  public showNewMessageNotification(
    payload: BrowserNewMessageNotificationPayload
  ): void {
    if (!this.canShowNotifications()) return;
    if (!this.isPageHidden()) return;
    if (this.isOwnMessage(payload)) return;

    const dedupeKey = this.buildDedupeKey(payload);
    if (!this.registerDedupeKey(dedupeKey)) return;

    const title = this.buildTitle(payload);
    const body = this.buildBody(payload);
    const normalizedChatId = this.normalizePositiveInt(payload?.chatId);

    try {
      const notification = new Notification(title, {
        body,
        tag: `chat-message-${dedupeKey}`,
        data: {
          chatId: normalizedChatId,
        },
      });

      notification.onclick = () => {
        try {
          window.focus();
        } catch {}

        this.ngZone.run(() => {
          if (normalizedChatId) {
            void this.router.navigate(['/inicio'], {
              queryParams: {
                [this.OPEN_CHAT_QUERY_PARAM]: normalizedChatId,
                ts: Date.now(),
              },
            });
            return;
          }
          void this.router.navigate(['/inicio']);
        });

        try {
          notification.close();
        } catch {}
      };

      setTimeout(() => {
        try {
          notification.close();
        } catch {}
      }, this.AUTO_CLOSE_MS);
    } catch {}
  }

  private isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Notification !== 'undefined';
  }

  private wasPermissionRequested(): boolean {
    try {
      return localStorage.getItem(this.PERMISSION_REQUESTED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private markPermissionRequested(): void {
    try {
      localStorage.setItem(this.PERMISSION_REQUESTED_KEY, '1');
    } catch {}
  }

  private isPageHidden(): boolean {
    try {
      return document.hidden === true;
    } catch {
      return false;
    }
  }

  private normalizePositiveInt(raw: unknown): number | null {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value);
  }

  private isOwnMessage(payload: BrowserNewMessageNotificationPayload): boolean {
    const senderId = this.normalizePositiveInt(payload?.senderId);
    const currentUserId = this.normalizePositiveInt(payload?.currentUserId);
    return !!senderId && !!currentUserId && senderId === currentUserId;
  }

  private buildTitle(payload: BrowserNewMessageNotificationPayload): string {
    const senderName = String(payload?.senderName || '').trim();
    return senderName
      ? `Nuevo mensaje de ${senderName}`
      : 'Nuevo mensaje recibido';
  }

  private buildBody(payload: BrowserNewMessageNotificationPayload): string {
    const previewRaw = String(payload?.previewText || '').trim();
    if (!previewRaw || this.isEncryptedPlaceholder(previewRaw)) {
      return 'Has recibido un nuevo mensaje';
    }
    return previewRaw.length > 180
      ? `${previewRaw.slice(0, 179).trimEnd()}...`
      : previewRaw;
  }

  private isEncryptedPlaceholder(textRaw: string): boolean {
    const text = String(textRaw || '').trim().toLowerCase();
    if (!text) return true;
    return (
      text === '[mensaje cifrado]' ||
      text.startsWith('[mensaje cifrado -') ||
      text === '[error de descifrado e2e]'
    );
  }

  private buildDedupeKey(payload: BrowserNewMessageNotificationPayload): string {
    const messageId = this.normalizePositiveInt(payload?.messageId);
    if (messageId) return `mid:${messageId}`;

    const chatId = this.normalizePositiveInt(payload?.chatId) || 0;
    const senderId = this.normalizePositiveInt(payload?.senderId) || 0;
    const preview = String(payload?.previewText || '')
      .trim()
      .toLowerCase()
      .slice(0, 80);
    return `chat:${chatId}|sender:${senderId}|preview:${preview || 'na'}`;
  }

  private registerDedupeKey(key: string): boolean {
    const now = Date.now();
    for (const [existingKey, createdAt] of this.recentKeys.entries()) {
      if (now - createdAt > this.DEDUPE_TTL_MS) {
        this.recentKeys.delete(existingKey);
      }
    }
    const previous = this.recentKeys.get(key);
    if (previous && now - previous <= this.DEDUPE_TTL_MS) {
      return false;
    }
    this.recentKeys.set(key, now);
    return true;
  }
}
