import { Component, EventEmitter, Output } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';
import {
  RATE_LIMIT_SCOPES,
  RateLimitService,
} from '../../../Service/rate-limit/rate-limit.service';

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
  requestCooldownSec = 0;
  verifyCooldownSec = 0;
  requestCooldownTimer: any;
  verifyCooldownTimer: any;

  timeLeft = 300;
  timerInterval: any;

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  constructor(
    private authService: AuthService,
    private rateLimitService: RateLimitService
  ) {}

  ngOnInit(): void {
    const req = this.rateLimitService.getScopeRemainingSeconds(
      RATE_LIMIT_SCOPES.PASSWORD_RESET_REQUEST
    );
    if (req > 0) this.startRequestCooldown(req);

    const verify = this.rateLimitService.getScopeRemainingSeconds(
      RATE_LIMIT_SCOPES.PASSWORD_RESET_VERIFY
    );
    if (verify > 0) this.startVerifyCooldown(verify);
  }

  closeModal() {
    this.stopTimer();
    this.close.emit();
  }

  solicitarCodigo() {
    if (this.requestCooldownSec > 0) {
      this.errorMsg = `Demasiados intentos. Reintenta en ${this.requestCooldownSec}s.`;
      return;
    }

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
        if (this.rateLimitService.isRateLimitHttpError(err)) {
          const fromScope = this.rateLimitService.getScopeRemainingSeconds(
            RATE_LIMIT_SCOPES.PASSWORD_RESET_REQUEST
          );
          const fromHeader = this.rateLimitService.parseRetryAfterSecondsFromHttpError(
            err
          );
          const sec = fromScope || fromHeader || 30;
          this.rateLimitService.setScopeCooldown(
            RATE_LIMIT_SCOPES.PASSWORD_RESET_REQUEST,
            sec
          );
          this.startRequestCooldown(sec > 0 ? sec : 30);
          this.errorMsg = `Demasiados intentos. Reintenta en ${this.requestCooldownSec}s.`;
          return;
        }
        this.errorMsg = err.error?.mensaje || 'Error al enviar código. Verifique el correo.';
      }
    });
  }

  resendCode() {
    this.solicitarCodigo(); 
  }

  verificarYGuardar() {
    if (this.verifyCooldownSec > 0) {
      this.errorMsg = `Debes esperar ${this.verifyCooldownSec}s para volver a intentar.`;
      return;
    }

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
        if (this.rateLimitService.isRateLimitHttpError(err)) {
          const fromScope = this.rateLimitService.getScopeRemainingSeconds(
            RATE_LIMIT_SCOPES.PASSWORD_RESET_VERIFY
          );
          const fromHeader = this.rateLimitService.parseRetryAfterSecondsFromHttpError(
            err
          );
          const sec = fromScope || fromHeader || 30;
          this.rateLimitService.setScopeCooldown(
            RATE_LIMIT_SCOPES.PASSWORD_RESET_VERIFY,
            sec
          );
          this.startVerifyCooldown(sec > 0 ? sec : 30);
          this.errorMsg = `Demasiados intentos. Reintenta en ${this.verifyCooldownSec}s.`;
          return;
        }
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

  private startRequestCooldown(seconds: number): void {
    const normalized = Math.max(0, Math.floor(Number(seconds || 0)));
    if (this.requestCooldownTimer) clearInterval(this.requestCooldownTimer);
    this.requestCooldownSec = normalized;
    if (normalized <= 0) return;
    this.requestCooldownTimer = setInterval(() => {
      this.requestCooldownSec = Math.max(0, this.requestCooldownSec - 1);
      if (this.requestCooldownSec <= 0 && this.requestCooldownTimer) {
        clearInterval(this.requestCooldownTimer);
        this.requestCooldownTimer = null;
      }
    }, 1000);
  }

  private startVerifyCooldown(seconds: number): void {
    const normalized = Math.max(0, Math.floor(Number(seconds || 0)));
    if (this.verifyCooldownTimer) clearInterval(this.verifyCooldownTimer);
    this.verifyCooldownSec = normalized;
    if (normalized <= 0) return;
    this.verifyCooldownTimer = setInterval(() => {
      this.verifyCooldownSec = Math.max(0, this.verifyCooldownSec - 1);
      if (this.verifyCooldownSec <= 0 && this.verifyCooldownTimer) {
        clearInterval(this.verifyCooldownTimer);
        this.verifyCooldownTimer = null;
      }
    }, 1000);
  }

  ngOnDestroy() {
    this.stopTimer();
    if (this.requestCooldownTimer) clearInterval(this.requestCooldownTimer);
    if (this.verifyCooldownTimer) clearInterval(this.verifyCooldownTimer);
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleRepeatPasswordVisibility(): void {
    this.showRepeatPassword = !this.showRepeatPassword;
  }
}

