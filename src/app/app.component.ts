import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { WebSocketService } from './Service/WebSocket/web-socket.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'chatFront';

  constructor(
    private wsService: WebSocketService,
    private router: Router
  ) {}

  ngOnInit() {
    this.checkBaneos();
  }

  private checkBaneos() {
    const id = localStorage.getItem('usuarioId');
    if (!id) return;

    this.wsService.suscribirseABaneos(Number(id), (payload) => {
      // 1. Limpiamos la sesión entera
      localStorage.clear();
      
      // 2. Cerramos la conexión STOMP si seguía activa
      this.wsService.desconectar();

      // 3. Informamos y expulsamos al Login
      Swal.fire({
        title: 'Cuenta Inhabilitada',
        text: payload?.motivo || 'Un administrador ha inhabilitado tu cuenta.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        this.router.navigate(['/login']);
      });
    });
  }
}
