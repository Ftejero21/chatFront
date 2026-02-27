import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { WebSocketService } from '../WebSocket/web-socket.service';

export interface LogoutOptions {
  clearE2EKeys?: boolean;
  clearAuditKeys?: boolean;
  broadcast?: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  public readonly logoutEventKey = 'tejechat:logout:event';

  private readonly sessionKeys = [
    'token',
    'usuarioId',
    'rememberMe',
    'usuarioFoto',
    'bloqueadosIds',
    'meHanBloqueadoIds',
    'leftGroupIds',
    'handledInviteIds',
  ];

  private readonly auditKeys = [
    'auditPublicKey',
    'publicKey_admin_audit',
    'forAdminPublicKey',
    'auditPrivateKey',
    'privateKey_admin_audit',
    'forAdminPrivateKey',
  ];

  constructor(
    private readonly wsService: WebSocketService,
    private readonly router: Router
  ) {}

  public logout(options: LogoutOptions = {}): void {
    const {
      clearE2EKeys = false,
      clearAuditKeys = false,
      broadcast = true,
      reason = 'manual',
    } = options;
    const usuarioId = Number(localStorage.getItem('usuarioId'));

    const finalizeLogout = (): void => {
      this.clearSessionStorage({ clearE2EKeys, clearAuditKeys });
      if (broadcast) this.broadcastLogout(reason);
      void this.wsService.desconectar();
      void this.router.navigate(['/login']);
    };

    if (Number.isFinite(usuarioId) && usuarioId > 0) {
      void this.wsService
        .enviarEstadoDesconectadoConFlush(usuarioId)
        .finally(finalizeLogout);
      return;
    }

    finalizeLogout();
  }

  public handleExternalLogout(): void {
    const usuarioId = Number(localStorage.getItem('usuarioId'));

    const finalizeExternalLogout = (): void => {
      this.clearSessionStorage({ clearE2EKeys: false, clearAuditKeys: false });
      void this.wsService.desconectar();
      void this.router.navigate(['/login']);
    };

    if (Number.isFinite(usuarioId) && usuarioId > 0) {
      void this.wsService
        .enviarEstadoDesconectadoConFlush(usuarioId)
        .finally(finalizeExternalLogout);
      return;
    }

    finalizeExternalLogout();
  }

  public clearSessionArtifacts(options?: {
    clearE2EKeys?: boolean;
    clearAuditKeys?: boolean;
  }): void {
    this.clearSessionStorage({
      clearE2EKeys: !!options?.clearE2EKeys,
      clearAuditKeys: !!options?.clearAuditKeys,
    });
  }

  private clearSessionStorage(opts: {
    clearE2EKeys: boolean;
    clearAuditKeys: boolean;
  }): void {
    for (const key of this.sessionKeys) {
      localStorage.removeItem(key);
    }

    if (opts.clearAuditKeys) {
      for (const key of this.auditKeys) {
        localStorage.removeItem(key);
      }
    }

    if (!opts.clearE2EKeys) return;

    const dynamicKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (/^privateKey_\d+$/.test(key) || /^publicKey_\d+$/.test(key)) {
        dynamicKeysToRemove.push(key);
      }
    }
    for (const key of dynamicKeysToRemove) {
      localStorage.removeItem(key);
    }
  }

  private broadcastLogout(reason: string): void {
    const payload = JSON.stringify({
      at: new Date().toISOString(),
      reason,
      nonce: Math.random().toString(36).slice(2),
    });
    localStorage.setItem(this.logoutEventKey, payload);
  }
}
