import { Component, EventEmitter, Output } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';

@Component({
  selector: 'app-password-reset',
  templateUrl: './password-reset.component.html',
  styleUrls: ['./password-reset.component.css']
})
export class PasswordResetComponent {
  @Output() close = new EventEmitter<void>();

  step = 1; // 1: Email, 2: Código + Nueva Contraseña
  email = '';
  code = '';
  newPassword = '';
  repeatPassword = '';
  
  errorMsg = '';
  successMsg = '';
  isLoading = false;
  showNewPassword = false;
  showRepeatPassword = false;

  timeLeft = 300;
  timerInterval: any;

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  constructor(private authService: AuthService) {}

  closeModal() {
    this.stopTimer();
    this.close.emit();
  }

  solicitarCodigo() {
    if (!this.email) {
      this.errorMsg = 'Por favor, ingrese un correo válido.';
      return;
    }
    
    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';

    this.authService.solicitarPasswordReset(this.email).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMsg = res.mensaje || 'Código enviado. Revise su bandeja.';
        this.step = 2; // Avanza al siguiente paso
        this.startTimer();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.mensaje || 'Error al enviar código. Verifique el correo.';
      }
    });
  }

  resendCode() {
    this.solicitarCodigo(); 
  }

  verificarYGuardar() {
    this.errorMsg = '';
    this.successMsg = '';

    if (!this.code || !this.newPassword || !this.repeatPassword) {
      this.errorMsg = 'Todos los campos son obligatorios.';
      return;
    }

    if (this.newPassword !== this.repeatPassword) {
      this.errorMsg = 'Las contraseñas no coinciden.';
      return;
    }

    if (this.timeLeft === 0) {
      this.errorMsg = 'El código ha caducado. Solicite uno nuevo.';
      return;
    }

    this.isLoading = true;

    this.authService.verificarYCambiarPassword(this.email, this.code, this.newPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.stopTimer();
        this.successMsg = res.mensaje || 'Contraseña actualizada. Ya puede iniciar sesión.';
        // Después de 2s, cierra el modal automáticamente
        setTimeout(() => this.closeModal(), 2000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.mensaje || 'Código inválido o error de servidor.';
      }
    });
  }

  private startTimer() {
    this.stopTimer();
    this.timeLeft = 300;
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleRepeatPasswordVisibility(): void {
    this.showRepeatPassword = !this.showRepeatPassword;
  }
}
