import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export const RATE_LIMIT_SCOPES = {
  LOGIN: 'LOGIN',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_VERIFY: 'PASSWORD_RESET_VERIFY',
  UNBAN_APPEAL: 'UNBAN_APPEAL',
  ADMIN_GLOBAL: 'ADMIN_GLOBAL',
  HTTP_GENERIC: 'HTTP_GENERIC',
} as const;

export interface RateLimitEvent {
  source: 'http' | 'ws';
  scope: string;
  retryAfterSeconds: number;
  message: string;
  ts: string;
  destination?: string;
  url?: string;
  code?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RateLimitService {
  private readonly defaultRetryAfterSeconds = 30;
  private readonly cooldownUntilByScope = new Map<string, number>();
  private readonly cooldownUntilByWsDestination = new Map<string, number>();
  private readonly eventsSubject = new Subject<RateLimitEvent>();
  private readonly lastNoticeAtByKey = new Map<string, number>();

  public readonly events$ = this.eventsSubject.asObservable();

  public isRateLimitHttpError(error: any): boolean {
    const status = Number(error?.status ?? 0);
    const code = String(error?.error?.code || error?.code || '')
      .trim()
      .toUpperCase();
    return status === 429 || code === 'RATE_LIMIT_EXCEEDED';
  }

  public parseRetryAfterSecondsFromHttpError(
    error: any,
    fallbackSeconds = this.defaultRetryAfterSeconds
  ): number {
    const headerValue = error?.headers?.get?.('Retry-After');
    if (headerValue != null) {
      return this.parseRetryAfterSecondsValue(headerValue, fallbackSeconds);
    }
    return this.parseRetryAfterSecondsValue(
      error?.error?.retryAfterSeconds,
      fallbackSeconds
    );
  }

  public resolveHttpScope(method: string, url: string): string {
    const m = String(method || '').trim().toUpperCase();
    const path = this.normalizePath(url);

    if (m === 'POST' && path === '/api/usuarios/login') {
      return RATE_LIMIT_SCOPES.LOGIN;
    }
    if (m === 'POST' && path === '/api/usuarios/recuperar-password/solicitar') {
      return RATE_LIMIT_SCOPES.PASSWORD_RESET_REQUEST;
    }
    if (
      m === 'POST' &&
      path === '/api/usuarios/recuperar-password/verificar-y-cambiar'
    ) {
      return RATE_LIMIT_SCOPES.PASSWORD_RESET_VERIFY;
    }
    if (m === 'POST' && path === '/api/usuarios/solicitudes-desbaneo') {
      return RATE_LIMIT_SCOPES.UNBAN_APPEAL;
    }
    if (path.includes('/admin/')) {
      return RATE_LIMIT_SCOPES.ADMIN_GLOBAL;
    }
    return RATE_LIMIT_SCOPES.HTTP_GENERIC;
  }

  public registerHttpRateLimit(
    method: string,
    url: string,
    error: any
  ): RateLimitEvent | null {
    if (!this.isRateLimitHttpError(error)) return null;

    const scope = this.resolveHttpScope(method, url);
    const retryAfterSeconds = this.parseRetryAfterSecondsFromHttpError(error);
    this.setScopeCooldown(scope, retryAfterSeconds);

    const backendMessage = String(
      error?.error?.message || error?.error?.mensaje || ''
    ).trim();
    const message =
      backendMessage ||
      `Demasiadas solicitudes. Reintenta en ${retryAfterSeconds}s.`;

    const event: RateLimitEvent = {
      source: 'http',
      scope,
      retryAfterSeconds,
      message,
      ts: new Date().toISOString(),
      url: this.normalizePath(url),
      code: 'RATE_LIMIT_EXCEEDED',
    };
    this.emitEvent(event);
    return event;
  }

  public registerWsRateLimit(payload: any): RateLimitEvent | null {
    const code = String(payload?.code || '').trim().toUpperCase();
    if (code !== 'RATE_LIMIT_EXCEEDED') return null;

    const destination = String(payload?.destination || '').trim();
    const retryAfterSeconds = this.parseRetryAfterSecondsValue(
      payload?.retryAfterSeconds,
      this.defaultRetryAfterSeconds
    );

    if (destination) {
      this.setWsDestinationCooldown(destination, retryAfterSeconds);
    }

    const scope = destination
      ? `WS_DEST:${destination}`
      : 'WS_RATE_LIMIT_GENERIC';
    this.setScopeCooldown(scope, retryAfterSeconds);

    const backendMessage = String(payload?.message || '').trim();
    const message =
      backendMessage ||
      `Límite temporal alcanzado en tiempo real. Reintenta en ${retryAfterSeconds}s.`;

    const event: RateLimitEvent = {
      source: 'ws',
      scope,
      destination: destination || undefined,
      retryAfterSeconds,
      message,
      ts: String(payload?.ts || '').trim() || new Date().toISOString(),
      code: 'RATE_LIMIT_EXCEEDED',
    };
    this.emitEvent(event);
    return event;
  }

  public announceWsActionBlocked(destination: string, remainingSeconds: number): void {
    const normalizedDestination = String(destination || '').trim();
    const remaining = Math.max(1, Math.floor(Number(remainingSeconds || 0)));
    if (!normalizedDestination || remaining <= 0) return;

    const noticeKey = `BLOCKED:${normalizedDestination}`;
    const now = Date.now();
    const lastNoticeAt = Number(this.lastNoticeAtByKey.get(noticeKey) || 0);
    if (now - lastNoticeAt < 1500) return;
    this.lastNoticeAtByKey.set(noticeKey, now);

    this.emitEvent({
      source: 'ws',
      scope: `WS_DEST:${normalizedDestination}`,
      destination: normalizedDestination,
      retryAfterSeconds: remaining,
      message: `Acción temporalmente pausada para ${normalizedDestination}. Reintenta en ${remaining}s.`,
      ts: new Date().toISOString(),
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  public setScopeCooldown(scope: string, retryAfterSeconds: number): number {
    const normalizedScope = String(scope || '').trim();
    if (!normalizedScope) return 0;
    const until = Date.now() + this.parseRetryAfterSecondsValue(retryAfterSeconds) * 1000;
    const prev = Number(this.cooldownUntilByScope.get(normalizedScope) || 0);
    this.cooldownUntilByScope.set(normalizedScope, Math.max(prev, until));
    return this.getScopeRemainingSeconds(normalizedScope);
  }

  public getScopeRemainingSeconds(scope: string): number {
    const normalizedScope = String(scope || '').trim();
    if (!normalizedScope) return 0;
    const until = Number(this.cooldownUntilByScope.get(normalizedScope) || 0);
    const remainingMs = until - Date.now();
    if (remainingMs <= 0) {
      this.cooldownUntilByScope.delete(normalizedScope);
      return 0;
    }
    return Math.ceil(remainingMs / 1000);
  }

  public setWsDestinationCooldown(destination: string, retryAfterSeconds: number): number {
    const normalizedDestination = String(destination || '').trim();
    if (!normalizedDestination) return 0;
    const until = Date.now() + this.parseRetryAfterSecondsValue(retryAfterSeconds) * 1000;
    const prev = Number(this.cooldownUntilByWsDestination.get(normalizedDestination) || 0);
    this.cooldownUntilByWsDestination.set(
      normalizedDestination,
      Math.max(prev, until)
    );
    return this.getWsDestinationRemainingSeconds(normalizedDestination);
  }

  public getWsDestinationRemainingSeconds(destination: string): number {
    const normalizedDestination = String(destination || '').trim();
    if (!normalizedDestination) return 0;
    const until = Number(this.cooldownUntilByWsDestination.get(normalizedDestination) || 0);
    const remainingMs = until - Date.now();
    if (remainingMs <= 0) {
      this.cooldownUntilByWsDestination.delete(normalizedDestination);
      return 0;
    }
    return Math.ceil(remainingMs / 1000);
  }

  private emitEvent(event: RateLimitEvent): void {
    this.eventsSubject.next(event);
  }

  private normalizePath(url: string): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw, window.location.origin);
      return parsed.pathname;
    } catch {
      const noQuery = raw.split('?')[0];
      const maybePathStart = noQuery.indexOf('/api/');
      if (maybePathStart >= 0) return noQuery.slice(maybePathStart);
      return noQuery;
    }
  }

  private parseRetryAfterSecondsValue(
    rawValue: any,
    fallbackSeconds = this.defaultRetryAfterSeconds
  ): number {
    const n = Number(rawValue);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
    return Math.max(1, Math.ceil(Number(fallbackSeconds) || this.defaultRetryAfterSeconds));
  }
}

