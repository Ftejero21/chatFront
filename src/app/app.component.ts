import { Component, OnDestroy, OnInit } from '@angular/core';
import { WebSocketService } from './Service/WebSocket/web-socket.service';
import Swal from 'sweetalert2';
import { SessionService } from './Service/session/session.service';
import { Subscription } from 'rxjs';
import { RateLimitService } from './Service/rate-limit/rate-limit.service';
import { EmojiCatalogService } from './Service/emoji/emoji-catalog.service';
import { BrowserNotificationService } from './Service/Notification/browser-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'chatFront';
  private rateLimitSub?: Subscription;
  private readonly onStorageEvent = (event: StorageEvent): void => {
    if (event.key !== this.sessionService.logoutEventKey) return;
    if (!event.newValue) return;
    this.sessionService.handleExternalLogout();
  };

  constructor(
    private wsService: WebSocketService,
    private sessionService: SessionService,
    private rateLimitService: RateLimitService,
    private emojiCatalogService: EmojiCatalogService,
    private browserNotificationService: BrowserNotificationService
  ) {}

  ngOnInit() {
    this.browserNotificationService.requestPermissionIfNeeded();
    void this.emojiCatalogService.preload().catch((err) => {
      console.error('No se pudo precargar el catálogo de emojis:', err);
    });
    window.addEventListener('storage', this.onStorageEvent);
    this.bindRateLimitAlerts();
    this.checkBaneos();
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorageEvent);
    if (this.rateLimitSub) this.rateLimitSub.unsubscribe();
  }

  private bindRateLimitAlerts(): void {
    if (this.rateLimitSub) return;
    this.rateLimitSub = this.rateLimitService.events$.subscribe((event) => {
      const seconds = Math.max(1, Number(event?.retryAfterSeconds || 0));
      const subtitle =
        event?.source === 'ws' && event?.destination
          ? `Destino: ${event.destination}`
          : undefined;

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Límite temporal alcanzado',
        text: `${event?.message || 'Demasiadas solicitudes.'} Reintenta en ${seconds}s.`,
        footer: subtitle,
        showConfirmButton: false,
        timer: Math.min(6000, Math.max(2600, seconds * 1000)),
        timerProgressBar: true,
      });
    });
  }

  private checkBaneos() {
    const id = localStorage.getItem('usuarioId');
    if (!id) {
      return;
    }
    this.wsService.suscribirseABaneos(Number(id), (payload) => {
      console.warn('[APP] baneo WS recibido', payload);
      // Informamos y cerramos sesión conservando claves E2E del usuario.
      Swal.fire({
        title: 'Cuenta Inhabilitada',
        text: payload?.motivo || 'Un administrador ha inhabilitado tu cuenta.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        this.sessionService.logout({
          clearE2EKeys: false,
          clearAuditKeys: false,
          broadcast: true,
          reason: 'banned',
        });
      });
    });
  }
}


