import { Component, OnDestroy, OnInit } from '@angular/core';
import { WebSocketService } from './Service/WebSocket/web-socket.service';
import Swal from 'sweetalert2';
import { SessionService } from './Service/session/session.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'chatFront';
  private readonly onStorageEvent = (event: StorageEvent): void => {
    if (event.key !== this.sessionService.logoutEventKey) return;
    if (!event.newValue) return;
    this.sessionService.handleExternalLogout();
  };

  constructor(
    private wsService: WebSocketService,
    private sessionService: SessionService
  ) {}

  ngOnInit() {
    console.log('[APP] ngOnInit checkBaneos');
    window.addEventListener('storage', this.onStorageEvent);
    this.checkBaneos();
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorageEvent);
  }

  private checkBaneos() {
    const id = localStorage.getItem('usuarioId');
    if (!id) {
      console.log('[APP] checkBaneos skipped: no usuarioId yet');
      return;
    }

    console.log('[APP] checkBaneos subscribe', { usuarioId: id });

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

