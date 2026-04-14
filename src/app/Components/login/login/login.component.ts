import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AuthService,
  LoginRegistrationInitResponse,
} from '../../../Service/auth/auth.service';
import Swal from 'sweetalert2';

import { CryptoService } from '../../../Service/crypto/crypto.service';
import { Router } from '@angular/router';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { LoginRequestDTO } from '../../../Interface/LoginRequestDTO ';
import { AuthRespuestaDTO } from '../../../Interface/AuthRespuestaDTO';
import { SessionService } from '../../../Service/session/session.service';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments';
import {
  RATE_LIMIT_SCOPES,
  RateLimitService,
} from '../../../Service/rate-limit/rate-limit.service';
import { E2EBackupService } from '../../../Service/e2e-backup/e2e-backup.service';


type ToastVariant = 'danger' | 'success' | 'warning' | 'info';
type GoogleAuthFlow = 'login' | 'register';
interface ToastItem {
  id: number;
  message: string;
  title?: string;
  variant: ToastVariant;
  timeout?: any;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  toasts: ToastItem[] = [];
  login: LoginRequestDTO = { email: '', password: '' };
  rememberMe: boolean = false;
  showResetPasswordModal: boolean = false;
  showBanAppealButton: boolean = false;
  lastBannedEmail: string = '';
  showLoginPassword: boolean = false;
  showVerificationCodeInput = false;
  verificationCode = '';
  verifyingRegistrationCode = false;
  googleAuthInProgress = false;
  loginRateLimitSeconds = 0;
  unbanAppealRateLimitSeconds = 0;
  private loginRateLimitTimer: any = null;
  private unbanAppealRateLimitTimer: any = null;
  private googleIdentityScriptPromise: Promise<void> | null = null;
  private googleIdentityInitializedClientId = '';
  private readonly OPEN_PROFILE_AFTER_REGISTER_KEY = 'openProfileAfterRegister';

  constructor(
    private authService: AuthService,
    private cryptoService: CryptoService,
    private router: Router,
    private sessionService: SessionService,
    private rateLimitService: RateLimitService,
    private e2eBackupService: E2EBackupService
  ) {}

  ngOnInit(): void {
    // Si ya existe sesión activa y el usuario quiso ser recordado, redirige automático.
    const hasToken = !!localStorage.getItem('token');
    const isRemembered = localStorage.getItem('rememberMe') === 'true';

    if (hasToken && isRemembered) {
      this.router.navigate(['/inicio']);
    } else if (hasToken && !isRemembered) {
      // Si no marcó recuérdame y aterriza en login, limpiamos su sesión temporal.
      this.sessionService.clearSessionArtifacts({
        clearE2EKeys: false,
        clearAuditKeys: false,
      });
    }

    // Soporte dev: inyectar claves de auditoria desde window/global env al cargar login.
    this.persistAuditPublicKeyIfPresent(window as any, (window as any)?.__env);
    this.persistAuditPrivateKeyIfPresent(window as any, (window as any)?.__env);
    this.syncRateLimitCooldownsFromService();
    void this.prepareGoogleIdentity(false);
  }

  continuarConGoogle(): void {
    if (this.googleAuthInProgress) return;
    this.googleAuthInProgress = true;
    void this.startGoogleAuthFlow();
  }

  private async startGoogleAuthFlow(): Promise<void> {
    const ready = await this.prepareGoogleIdentity(true);
    if (!ready) {
      this.googleAuthInProgress = false;
      return;
    }

    try {
      const googleApi = window.google?.accounts?.id;
      if (!googleApi) {
        this.googleAuthInProgress = false;
        this.showToast('Google Identity no está disponible.', 'warning', 'Google');
        return;
      }

      googleApi.prompt((notification: GooglePromptMomentNotification) => {
        const notDisplayed =
          typeof notification?.isNotDisplayed === 'function' &&
          notification.isNotDisplayed();
        const skipped =
          typeof notification?.isSkippedMoment === 'function' &&
          notification.isSkippedMoment();
        const dismissed =
          typeof notification?.isDismissedMoment === 'function' &&
          notification.isDismissedMoment();
        if (notDisplayed || skipped || dismissed) {
          this.googleAuthInProgress = false;
          const reason = String(
            (typeof notification?.getNotDisplayedReason === 'function' &&
              notification.getNotDisplayedReason()) ||
              (typeof notification?.getSkippedReason === 'function' &&
                notification.getSkippedReason()) ||
              (typeof notification?.getDismissedReason === 'function' &&
                notification.getDismissedReason()) ||
              ''
          ).trim();

          if (notDisplayed || skipped) {
            const hint = reason
              ? `Google bloqueó el prompt (${reason}). En Brave desactiva Shields para este sitio y permite cookies de terceros para accounts.google.com.`
              : 'Google no pudo mostrar el prompt. En Brave desactiva Shields para este sitio y permite cookies de terceros para accounts.google.com.';
            this.showToast(hint, 'warning', 'Google');
          }
        }
      });

      // Fallback para desbloquear el botón si el prompt no termina en callback.
      setTimeout(() => {
        if (this.googleAuthInProgress) {
          this.googleAuthInProgress = false;
        }
      }, 12000);
    } catch (err) {
      console.error('Error iniciando Google Auth', err);
      this.googleAuthInProgress = false;
      this.showToast('No se pudo abrir Google. Inténtalo de nuevo.', 'warning', 'Google');
    }
  }

  private async prepareGoogleIdentity(showErrorToast: boolean): Promise<boolean> {
    const clientId = this.resolveGoogleClientId();
    if (!clientId) {
      if (showErrorToast) {
        this.showToast(
          'Falta configurar GOOGLE_CLIENT_ID en el frontend.',
          'warning',
          'Google'
        );
      }
      return false;
    }

    try {
      await this.ensureGoogleIdentityScriptLoaded();
    } catch (err) {
      console.error('No se pudo cargar Google Identity', err);
      if (showErrorToast) {
        this.showToast('No se pudo cargar Google Identity.', 'warning', 'Google');
      }
      return false;
    }

    const googleApi = window.google?.accounts?.id;
    if (!googleApi) {
      if (showErrorToast) {
        this.showToast('Google Identity no está disponible.', 'warning', 'Google');
      }
      return false;
    }

    if (this.googleIdentityInitializedClientId !== clientId) {
      googleApi.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) =>
          this.onGoogleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
        itp_support: true,
      });
      this.googleIdentityInitializedClientId = clientId;
    }

    return true;
  }

  private ensureGoogleIdentityScriptLoaded(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }
    if (this.googleIdentityScriptPromise) {
      return this.googleIdentityScriptPromise;
    }

    this.googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Google Identity script timeout'));
      }, 10000);
      const safeResolve = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      const safeReject = (message: string) => {
        window.clearTimeout(timeoutId);
        reject(new Error(message));
      };

      const scriptId = 'google-identity-services';
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (existing) {
        if (window.google?.accounts?.id) {
          safeResolve();
          return;
        }
        existing.addEventListener('load', () => safeResolve(), { once: true });
        existing.addEventListener(
          'error',
          () => safeReject('Google Identity script error'),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => safeResolve();
      script.onerror = () => safeReject('Google Identity script load failed');
      document.head.appendChild(script);
    });

    return this.googleIdentityScriptPromise;
  }

  private resolveGoogleClientId(): string {
    const env = (window as any)?.__env || {};
    const fromWindowEnv = String(
      env?.GOOGLE_CLIENT_ID || env?.googleClientId || ''
    ).trim();
    const fromAngularEnv = String((environment as any)?.googleClientId || '').trim();
    const fromGlobal = String((globalThis as any)?.GOOGLE_CLIENT_ID || '').trim();
    return fromWindowEnv || fromAngularEnv || fromGlobal;
  }

  private onGoogleCredentialResponse(response: GoogleCredentialResponse): void {
    const loginFlow: GoogleAuthFlow = 'login';
    const credential = String(response?.credential || '').trim();
    if (!credential) {
      this.googleAuthInProgress = false;
      this.showToast('Google no devolvió credenciales válidas.', 'warning', 'Google');
      return;
    }

    this.authService.loginConGoogle(credential, loginFlow).subscribe({
      next: async (authResponse) => {
        await this.finalizeAuthSuccess(authResponse, loginFlow);
        this.googleAuthInProgress = false;
      },
      error: (err) => {
        const loginCode = String(err?.error?.code || '')
          .trim()
          .toUpperCase();
        if (loginCode === 'GOOGLE_USUARIO_NO_REGISTRADO') {
          const registerFlow: GoogleAuthFlow = 'register';
          this.authService.loginConGoogle(credential, registerFlow).subscribe({
            next: async (authResponse) => {
              await this.finalizeAuthSuccess(authResponse, registerFlow);
              this.googleAuthInProgress = false;
            },
            error: (registerErr) => {
              this.googleAuthInProgress = false;
              this.handleGoogleAuthError(registerErr, registerFlow);
            },
          });
          return;
        }
        this.googleAuthInProgress = false;
        this.handleGoogleAuthError(err, loginFlow);
      },
    });
  }

  private handleGoogleAuthError(err: any, flow: GoogleAuthFlow): void {
    if (this.rateLimitService.isRateLimitHttpError(err)) {
      const fromScope = this.rateLimitService.getScopeRemainingSeconds(
        RATE_LIMIT_SCOPES.LOGIN
      );
      const fromHeader = this.rateLimitService.parseRetryAfterSecondsFromHttpError(
        err
      );
      const seconds = fromScope || fromHeader || 30;
      this.rateLimitService.setScopeCooldown(RATE_LIMIT_SCOPES.LOGIN, seconds);
      this.startLoginRateLimit(seconds > 0 ? seconds : 30);
      return;
    }

    const status = Number(err?.status || 0);
    const code = String(err?.error?.code || '')
      .trim()
      .toUpperCase();
    if (status === 404 || status === 405 || status === 501) {
      this.showToast(
        'El acceso con Google no está disponible en backend.',
        'warning',
        'Google'
      );
      return;
    }

    const backendMsg = this.extractBackendErrorMessage(err);
    if (backendMsg) {
      this.showToast(backendMsg, 'danger', 'Google');
      return;
    }

    this.showToast(
      'No se pudo continuar con Google. Inténtalo de nuevo.',
      'warning',
      'Google'
    );
  }

  iniciarSesion(): void {
    if (this.loginRateLimitSeconds > 0) {
      this.showToast(
        `Has alcanzado el límite de intentos. Reintenta en ${this.loginRateLimitSeconds}s.`,
        'warning',
        'Rate limit'
      );
      return;
    }

    this.authService.login(this.login).subscribe({
      next: async (response) => {
        if (this.isVerificationStepResponse(response)) {
          this.showVerificationCodeInput = true;
          this.verificationCode = '';
          this.showBanAppealButton = false;
          this.lastBannedEmail = '';
          const msg = this.extractInitFlowMessage(response);
          this.showToast(
            msg || 'Te enviamos un código de verificación para completar el registro.',
            'info',
            'Verificación'
          );
          return;
        }
        await this.finalizeAuthSuccess(response, 'login');
      },
      error: (err) => {
        if (this.rateLimitService.isRateLimitHttpError(err)) {
          const fromScope = this.rateLimitService.getScopeRemainingSeconds(
            RATE_LIMIT_SCOPES.LOGIN
          );
          const fromHeader = this.rateLimitService.parseRetryAfterSecondsFromHttpError(
            err
          );
          const seconds = fromScope || fromHeader || 30;
          this.rateLimitService.setScopeCooldown(RATE_LIMIT_SCOPES.LOGIN, seconds);
          this.startLoginRateLimit(seconds > 0 ? seconds : 30);
          return;
        }

        const code = err?.error?.code as string | undefined;
        if (code === 'EMAIL_INVALIDO') {
          this.showBanAppealButton = false;
          this.showToast('Email incorrecto', 'danger', 'Error');
        } else if (code === 'PASSWORD_INCORRECTA') {
          this.showBanAppealButton = false;
          this.showToast('Contraseña incorrecta', 'danger', 'Error');
        } else if (code === 'USUARIO_INACTIVO') {
          this.showBanAppealButton = true;
          this.lastBannedEmail = String(this.login?.email || '').trim();
          Swal.fire({
            title: 'Cuenta Inhabilitada',
            text: err?.error?.mensaje || 'Un administrador ha inhabilitado tu cuenta. No puedes acceder.',
            icon: 'error',
            confirmButtonColor: '#ef4444'
          });
        } else {
          this.showBanAppealButton = false;
          this.showToast('No se pudo iniciar sesión', 'warning', 'Aviso');
        }
      },
    });
  }

  confirmarCodigoRegistro(): void {
    const email = String(this.login?.email || '').trim();
    const password = String(this.login?.password || '');
    const code = String(this.verificationCode || '').trim();
    if (!email || !password) {
      this.showToast('Debes indicar email y contraseña.', 'warning', 'Aviso');
      return;
    }
    if (!code) {
      this.showToast('Ingresa el código de verificación.', 'warning', 'Aviso');
      return;
    }

    this.verifyingRegistrationCode = true;
    this.authService.verificarRegistroDesdeLogin(email, password, code).subscribe({
      next: async (response) => {
        this.verifyingRegistrationCode = false;
        this.showVerificationCodeInput = false;
        this.verificationCode = '';
        await this.finalizeAuthSuccess(response, 'register');
      },
      error: (err) => {
        this.verifyingRegistrationCode = false;
        const backendMsg = this.extractBackendErrorMessage(err);
        this.showToast(
          backendMsg || 'Código inválido o expirado. Inténtalo de nuevo.',
          'danger',
          'Verificación'
        );
      },
    });
  }

  cancelarVerificacionRegistro(): void {
    this.showVerificationCodeInput = false;
    this.verificationCode = '';
  }

  private isVerificationStepResponse(
    response: AuthRespuestaDTO | LoginRegistrationInitResponse | any
  ): boolean {
    if (!response || typeof response !== 'object') return false;
    const hasAuthToken = String((response as any)?.token || '').trim().length > 0;
    const hasUsuarioId = Number.isFinite(
      Number((response as any)?.usuario?.id || (response as any)?.id || 0)
    );
    if (hasAuthToken && hasUsuarioId) return false;
    if ((response as any)?.requiresVerification === true) return true;
    const status = String(
      (response as any)?.status || (response as any)?.flow || ''
    )
      .trim()
      .toUpperCase();
    return (
      status === 'REGISTRATION_VERIFICATION_REQUIRED' ||
      status === 'PENDING_REGISTRATION' ||
      status === 'VERIFY_CODE'
    );
  }

  private extractInitFlowMessage(
    response: LoginRegistrationInitResponse | any
  ): string {
    return String(response?.mensaje || response?.message || '').trim();
  }

  async abrirReporteDesbaneo(): Promise<void> {
    if (this.unbanAppealRateLimitSeconds > 0) {
      this.showToast(
        `Debes esperar ${this.unbanAppealRateLimitSeconds}s para enviar otro reporte.`,
        'warning',
        'Rate limit'
      );
      return;
    }

    const email = String(this.lastBannedEmail || this.login?.email || '').trim();
    if (!email) {
      this.showToast('Ingresa tu email para poder reportar el caso.', 'warning', 'Aviso');
      return;
    }

    const { value: motivo } = await Swal.fire({
      title: '',
      html: `
        <div class="swal-ban-header">
          <div class="swal-ban-header-icon"><i class="bi bi-exclamation-circle-fill"></i></div>
          <div class="swal-ban-header-text">
            <h2>Solicitar desbaneo</h2>
            <p>Enviaremos tu reporte para revisar tu caso y restablecer acceso si aplica.</p>
          </div>
        </div>

        <div class="swal-ban-body">
          <label class="swal-ban-label">Cuéntanos qué pasó</label>
          <p class="swal-ban-helper">Incluye contexto breve para que administración pueda evaluarlo.</p>
        </div>
      `,
      input: 'textarea',
      inputPlaceholder:
        'Ej: Creo que mi cuenta fue baneada por error. Solicito revisión del caso.',
      showCancelButton: true,
      confirmButtonText: 'Enviar reporte',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'swal-ban-popup',
        htmlContainer: 'swal-ban-html',
        input: 'swal-ban-textarea',
        confirmButton: 'swal-ban-confirm',
        cancelButton: 'swal-ban-cancel',
        actions: 'swal-ban-actions',
      },
    });

    if (motivo === undefined) return;

    this.authService
      .solicitarDesbaneo({
        email,
        motivo: String(motivo || '').trim(),
      })
      .subscribe({
        next: (res) => {
          Swal.fire({
            icon: 'success',
            title: 'Reporte enviado',
            text:
              res?.mensaje ||
              'Tu solicitud de revisión fue enviada correctamente.',
            confirmButtonColor: '#2563eb',
          });
        },
        error: (err) => {
          if (this.rateLimitService.isRateLimitHttpError(err)) {
            const fromScope = this.rateLimitService.getScopeRemainingSeconds(
              RATE_LIMIT_SCOPES.UNBAN_APPEAL
            );
            const fromHeader = this.rateLimitService.parseRetryAfterSecondsFromHttpError(
              err
            );
            const seconds = fromScope || fromHeader || 30;
            this.rateLimitService.setScopeCooldown(
              RATE_LIMIT_SCOPES.UNBAN_APPEAL,
              seconds
            );
            this.startUnbanAppealRateLimit(seconds > 0 ? seconds : 30);
            return;
          }

          const status = Number(err?.status || 0);
          if (status === 404 || status === 405) {
            Swal.fire({
              icon: 'info',
              title: 'API pendiente',
              text:
                'La API para reportes de desbaneo aún no está disponible en backend.',
              confirmButtonColor: '#2563eb',
            });
            return;
          }
          Swal.fire({
            icon: 'error',
            title: 'No se pudo enviar',
            text:
              err?.error?.mensaje ||
              'No fue posible enviar el reporte de desbaneo. Intenta de nuevo.',
            confirmButtonColor: '#ef4444',
          });
        },
      });
  }


  private extractBackendErrorMessage(err: any): string {
    const asObject =
      String(err?.error?.mensaje || err?.error?.message || '').trim() ||
      String(err?.message || '').trim();
    if (asObject) return asObject;

    const raw = err?.error;
    if (typeof raw !== 'string') return '';
    const normalized = raw.trim();
    if (!normalized) return '';

    // Algunos backends devuelven texto plano; otros JSON serializado.
    try {
      const parsed = JSON.parse(normalized);
      return String(parsed?.mensaje || parsed?.message || normalized).trim();
    } catch {
      return normalized;
    }
  }

  private async finalizeAuthSuccess(
    response: any,
    source: GoogleAuthFlow
  ): Promise<void> {
    this.showBanAppealButton = false;
    this.lastBannedEmail = '';

    const usuario = response?.usuario || response;
    const userId = Number(usuario?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      this.showToast('Respuesta de autenticación inválida.', 'danger', 'Error');
      return;
    }

    const token = String(response?.token || '').trim();
    if (token) {
      localStorage.setItem('token', token);
    }
    localStorage.setItem('usuarioId', String(userId));
    if (source === 'login' || source === 'register') {
      localStorage.setItem('rememberMe', String(this.rememberMe));
    }

    this.persistAuditPublicKeyIfPresent(response, usuario);
    this.persistAuditPrivateKeyIfPresent(
      response,
      usuario,
      window as any,
      (window as any)?.__env
    );

    if (usuario?.foto) localStorage.setItem('usuarioFoto', String(usuario.foto));
    if (usuario?.bloqueadosIds) {
      localStorage.setItem(
        'bloqueadosIds',
        JSON.stringify(usuario.bloqueadosIds)
      );
    }
    if (usuario?.meHanBloqueadoIds) {
      localStorage.setItem(
        'meHanBloqueadoIds',
        JSON.stringify(usuario.meHanBloqueadoIds)
      );
    }

    try {
      const ready = await this.ensureE2EIdentityReadyForSession(usuario, source);
      if (!ready) return;

      if (source === 'login') {
        this.showToast(
          'Sesión iniciada correctamente (Claves E2E listas)',
          'success',
          'Éxito',
          2000
        );
        const isAdmin = Array.isArray(usuario?.roles)
          ? usuario.roles.includes('ADMIN')
          : false;
        this.router.navigate([isAdmin ? '/administracion' : '/inicio']);
        return;
      }

      if (source === 'register') {
        sessionStorage.setItem(this.OPEN_PROFILE_AFTER_REGISTER_KEY, 'true');
      }
      this.router.navigate(['/inicio']);
    } catch (e) {
      console.error('Error criptográfico', e);
      this.router.navigate(['/inicio']);
    }
  }

  private normalizePublicKey(raw?: string | null): string {
    return String(raw || '').replace(/\s+/g, '');
  }

  private async fingerprint12(rawPublicKey?: string | null): Promise<string> {
    const normalized = this.normalizePublicKey(rawPublicKey);
    if (!normalized) return '';
    try {
      const data = new TextEncoder().encode(normalized);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hex.slice(0, 12);
    } catch {
      return '';
    }
  }

  private async fetchServerE2EState(
    user: UsuarioDTO
  ): Promise<{ hasServerKey: boolean; serverFingerprint: string }> {
    const fallbackKey = this.normalizePublicKey((user as any)?.publicKey);
    const fallbackHas =
      typeof (user as any)?.hasPublicKey === 'boolean'
        ? !!(user as any).hasPublicKey
        : !!fallbackKey;
    const fallbackFingerprint = await this.fingerprint12(fallbackKey);

    const userId = Number(user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return { hasServerKey: fallbackHas, serverFingerprint: fallbackFingerprint };
    }

    try {
      const state = await firstValueFrom(this.authService.getE2EState(userId));
      const stateFp = String((state as any)?.publicKeyFingerprint || '').trim();
      const hasState =
        typeof (state as any)?.hasPublicKey === 'boolean'
          ? !!(state as any).hasPublicKey
          : !!stateFp;
      if (hasState) {
        return { hasServerKey: true, serverFingerprint: stateFp };
      }
    } catch {
      // compat fallback
    }

    try {
      const fresh = await firstValueFrom(this.authService.getById(userId));
      const serverPublicKey = this.normalizePublicKey((fresh as any)?.publicKey);
      const hasServerKey =
        typeof (fresh as any)?.hasPublicKey === 'boolean'
          ? !!(fresh as any).hasPublicKey
          : !!serverPublicKey;
      const serverFingerprint = await this.fingerprint12(serverPublicKey);
      return { hasServerKey, serverFingerprint };
    } catch {
      return { hasServerKey: fallbackHas, serverFingerprint: fallbackFingerprint };
    }
  }

  private async ensureE2EIdentityReadyForSession(
    user: UsuarioDTO,
    source: 'login' | 'register'
  ): Promise<boolean> {
    const userId = Number(user?.id);
    if (!Number.isFinite(userId) || userId <= 0) return false;

    let localPublicKey = this.normalizePublicKey(
      localStorage.getItem(`publicKey_${userId}`)
    );
    let localPrivateKey = String(
      localStorage.getItem(`privateKey_${userId}`) || ''
    ).trim();
    let hasLocalPair = !!localPublicKey && !!localPrivateKey;

    const serverState = await this.fetchServerE2EState(user);
    if (serverState.hasServerKey) {
      if (!hasLocalPair) {
        const restored = await this.tryRestoreE2EKeysFromBackup(
          userId,
          source,
          serverState.serverFingerprint
        );
        if (restored) {
          localPublicKey = this.normalizePublicKey(
            localStorage.getItem(`publicKey_${userId}`)
          );
          localPrivateKey = String(
            localStorage.getItem(`privateKey_${userId}`) || ''
          ).trim();
          hasLocalPair = !!localPublicKey && !!localPrivateKey;
        }
      }

      if (!hasLocalPair) {
        await Swal.fire({
          title: 'Clave privada no disponible',
          text: 'Este usuario ya tiene identidad E2E en servidor, pero este navegador no conserva su clave privada. Restaura el backup E2E o usa el flujo de rekey para no perder historial cifrado.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
        });
        this.sessionService.logout({
          clearE2EKeys: false,
          clearAuditKeys: false,
          broadcast: true,
          reason: 'e2e-missing-local-private-key',
        });
        return false;
      }

      const localFingerprint = await this.fingerprint12(localPublicKey);
      if (
        serverState.serverFingerprint &&
        localFingerprint &&
        localFingerprint !== serverState.serverFingerprint
      ) {
        await Swal.fire({
          title: 'Identidad E2E en conflicto',
          text: 'La clave local no coincide con la registrada en el servidor. Se bloquea el acceso para evitar rotacion accidental de claves.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
        });
        this.sessionService.logout({
          clearE2EKeys: false,
          clearAuditKeys: false,
          broadcast: true,
          reason: 'e2e-public-key-mismatch',
        });
        return false;
      }

      void this.tryCreateOrUpdateE2EBackup(
        userId,
        localPublicKey,
        localPrivateKey,
        source
      );
      return true;
    }

    if (!hasLocalPair) {
      const keys = await this.cryptoService.generateKeyPair();
      localPrivateKey = await this.cryptoService.exportPrivateKey(keys.privateKey);
      localPublicKey = this.normalizePublicKey(
        await this.cryptoService.exportPublicKey(keys.publicKey)
      );
      localStorage.setItem(`privateKey_${userId}`, localPrivateKey);
      localStorage.setItem(`publicKey_${userId}`, localPublicKey);
    }

    try {
      await firstValueFrom(this.authService.updatePublicKey(userId, localPublicKey));
      void this.tryCreateOrUpdateE2EBackup(
        userId,
        localPublicKey,
        localPrivateKey,
        source
      );
      return true;
    } catch (err) {
      const code = String((err as any)?.error?.code || '');
      if (Number((err as any)?.status) === 409 || code === 'E2E_REKEY_CONFLICT') {
        await Swal.fire({
          title: 'Conflicto de identidad E2E',
          text: 'El servidor rechazó la actualización de clave porque esta cuenta ya tiene otra identidad E2E. Usa el flujo de rekey para rotar la clave de forma controlada.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
        });
        this.sessionService.logout({
          clearE2EKeys: false,
          clearAuditKeys: false,
          broadcast: true,
          reason: 'e2e-rekey-required',
        });
        return false;
      }
      console.error('Error subiendo public key', err);
      await Swal.fire({
        title: 'Error E2E',
        text:
          source === 'register'
            ? 'No se pudo sincronizar tu clave pública tras el registro. Vuelve a iniciar sesión.'
            : 'No se pudo sincronizar tu clave pública. No se abrirá el chat para evitar mensajes cifrados no descifrables.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
      this.sessionService.logout({
        clearE2EKeys: false,
        clearAuditKeys: false,
        broadcast: true,
        reason:
          source === 'register'
            ? 'key-sync-failed-register'
            : 'key-sync-failed-login',
      });
      return false;
    }
  }

  private resolvePasswordCandidateForE2EBackup(
    source: 'login' | 'register'
  ): string {
    const loginPassword = String(this.login?.password || '').trim();
    return loginPassword;
  }

  private async promptPasswordForE2EBackupRestore(): Promise<string | null> {
    const result = await Swal.fire({
      title: 'Restaurar clave privada E2E',
      text: 'Ingresa tu password para restaurar tu clave privada cifrada.',
      input: 'password',
      inputPlaceholder: 'Password de tu cuenta',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
        autocomplete: 'current-password',
      },
      showCancelButton: true,
      confirmButtonText: 'Restaurar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      preConfirm: (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) {
          Swal.showValidationMessage('Debes ingresar tu password.');
          return;
        }
        return normalized;
      },
    });

    if (!result.isConfirmed) return null;
    return String(result.value || '').trim() || null;
  }

  private isNotFoundHttpError(err: unknown): boolean {
    return Number((err as any)?.status) === 404;
  }

  private async tryRestoreE2EKeysFromBackup(
    userId: number,
    source: 'login' | 'register',
    expectedServerFingerprint: string
  ): Promise<boolean> {
    try {
      const backup = await firstValueFrom(
        this.authService.getE2EPrivateKeyBackup(userId)
      );
      if (!backup) return false;
      const publicKey = this.normalizePublicKey((backup as any)?.publicKey);
      if (!publicKey) return false;

      const triedPasswords = new Set<string>();
      let password = this.resolvePasswordCandidateForE2EBackup(source);

      for (let attempt = 0; attempt < 2; attempt++) {
        if (!password || triedPasswords.has(password)) {
          const prompted = await this.promptPasswordForE2EBackupRestore();
          if (!prompted) return false;
          password = prompted;
        }

        triedPasswords.add(password);
        try {
          const privateKey = await this.e2eBackupService.decryptPrivateKeyFromBackup(
            backup,
            password
          );
          const restoredFingerprint = await this.fingerprint12(publicKey);
          const expected =
            String(expectedServerFingerprint || backup.publicKeyFingerprint || '').trim();
          if (expected && restoredFingerprint && restoredFingerprint !== expected) {
            console.warn('[E2E][backup-restore-fingerprint-mismatch]', {
              userId: Number(userId),
              restoredFingerprint,
              expected,
            });
            return false;
          }

          localStorage.setItem(`privateKey_${userId}`, privateKey);
          localStorage.setItem(`publicKey_${userId}`, publicKey);
          return true;
        } catch (decryptErr) {
          console.warn('[E2E][backup-restore-decrypt-failed]', {
            userId: Number(userId),
            attempt: attempt + 1,
            error: String((decryptErr as any)?.message || decryptErr),
          });
          password = '';
        }
      }

      return false;
    } catch (err) {
      if (this.isNotFoundHttpError(err)) return false;
      console.warn('[E2E][backup-restore-fetch-failed]', {
        userId: Number(userId),
        status: Number((err as any)?.status || 0),
      });
      return false;
    }
  }

  private async tryCreateOrUpdateE2EBackup(
    userId: number,
    publicKey: string,
    privateKey: string,
    source: 'login' | 'register'
  ): Promise<void> {
    const password = this.resolvePasswordCandidateForE2EBackup(source);
    if (!password) return;
    try {
      const payload = await this.e2eBackupService.buildEncryptedBackup(
        privateKey,
        publicKey,
        password
      );
      await firstValueFrom(this.authService.upsertE2EPrivateKeyBackup(userId, payload));
    } catch (err) {
      console.warn('[E2E][backup-upsert-failed]', {
        userId: Number(userId),
        status: Number((err as any)?.status || 0),
      });
    }
  }


  private extractAuditPublicKeyFromSource(source: any): string | null {
    if (!source || typeof source !== 'object') return null;
    const candidates = [
      source.auditPublicKey,
      source.publicKeyAdminAudit,
      source.publicKey_admin_audit,
      source.forAdminPublicKey,
      source?.audit?.publicKey,
      source?.keys?.auditPublicKey,
      source?.keys?.forAdminPublicKey,
    ];
    for (const candidate of candidates) {
      const key = String(candidate ?? '').trim();
      if (key) return key;
    }
    return null;
  }

  private normalizeAuditPrivateKey(raw: string): string {
    const text = String(raw || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\\n/g, '\n');
    if (!text) return '';
    // Admite PEM completo o base64 PKCS8.
    return text;
  }

  private extractAuditPrivateKeyFromSource(source: any): string | null {
    if (!source) return null;
    if (typeof source === 'string') {
      const normalized = this.normalizeAuditPrivateKey(source);
      return normalized || null;
    }
    if (typeof source !== 'object') return null;

    const candidates = [
      source.auditPrivateKey,
      source.forAdminPrivateKey,
      source.privateKeyAdminAudit,
      source.privateKey_admin_audit,
      source.auditPrivateKeyPem,
      source.app_audit_admin_private_key_pem,
      source?.audit?.privateKey,
      source?.audit?.privateKeyPem,
      source?.keys?.auditPrivateKey,
      source?.keys?.forAdminPrivateKey,
      source?.keys?.privateKey_admin_audit,
    ];
    for (const candidate of candidates) {
      const normalized = this.normalizeAuditPrivateKey(String(candidate ?? ''));
      if (normalized) return normalized;
    }
    return null;
  }

  private persistAuditPublicKeyIfPresent(...sources: any[]): void {
    for (const source of sources) {
      const key = this.extractAuditPublicKeyFromSource(source);
      if (!key) continue;
      localStorage.setItem('auditPublicKey', key);
      localStorage.setItem('publicKey_admin_audit', key);
      localStorage.setItem('forAdminPublicKey', key);
      return;
    }
  }

  private persistAuditPrivateKeyIfPresent(...sources: any[]): void {
    for (const source of sources) {
      const key = this.extractAuditPrivateKeyFromSource(source);
      if (!key) continue;
      localStorage.setItem('auditPrivateKey', key);
      localStorage.setItem('privateKey_admin_audit', key);
      localStorage.setItem('forAdminPrivateKey', key);
      return;
    }
  }

  private showToast(
    message: string,
    variant: ToastVariant = 'info',
    title?: string,
    ms = 3000
  ) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: ToastItem = { id, message, title, variant };
    this.toasts = [...this.toasts, toast];
    toast.timeout = setTimeout(() => this.dismissToast(id), ms);
  }

  dismissToast(id: number) {
    const t = this.toasts.find((x) => x.id === id);
    if (t?.timeout) clearTimeout(t.timeout);
    this.toasts = this.toasts.filter((x) => x.id !== id);
  }

  toggleLoginPasswordVisibility(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }


  ngOnDestroy(): void {
    if (this.loginRateLimitTimer) clearInterval(this.loginRateLimitTimer);
    if (this.unbanAppealRateLimitTimer) clearInterval(this.unbanAppealRateLimitTimer);
    const googleApi = window.google?.accounts?.id;
    if (typeof googleApi?.cancel === 'function') {
      googleApi.cancel();
    }
    for (const t of this.toasts) {
      if (t?.timeout) clearTimeout(t.timeout);
    }
  }

  private syncRateLimitCooldownsFromService(): void {
    const loginRemaining = this.rateLimitService.getScopeRemainingSeconds(
      RATE_LIMIT_SCOPES.LOGIN
    );
    if (loginRemaining > 0) this.startLoginRateLimit(loginRemaining);

    const appealRemaining = this.rateLimitService.getScopeRemainingSeconds(
      RATE_LIMIT_SCOPES.UNBAN_APPEAL
    );
    if (appealRemaining > 0) this.startUnbanAppealRateLimit(appealRemaining);
  }

  private startLoginRateLimit(seconds: number): void {
    const normalized = Math.max(0, Math.floor(Number(seconds || 0)));
    if (this.loginRateLimitTimer) clearInterval(this.loginRateLimitTimer);
    this.loginRateLimitSeconds = normalized;
    if (normalized <= 0) return;
    this.loginRateLimitTimer = setInterval(() => {
      this.loginRateLimitSeconds = Math.max(0, this.loginRateLimitSeconds - 1);
      if (this.loginRateLimitSeconds <= 0 && this.loginRateLimitTimer) {
        clearInterval(this.loginRateLimitTimer);
        this.loginRateLimitTimer = null;
      }
    }, 1000);
  }

  private startUnbanAppealRateLimit(seconds: number): void {
    const normalized = Math.max(0, Math.floor(Number(seconds || 0)));
    if (this.unbanAppealRateLimitTimer) clearInterval(this.unbanAppealRateLimitTimer);
    this.unbanAppealRateLimitSeconds = normalized;
    if (normalized <= 0) return;
    this.unbanAppealRateLimitTimer = setInterval(() => {
      this.unbanAppealRateLimitSeconds = Math.max(
        0,
        this.unbanAppealRateLimitSeconds - 1
      );
      if (
        this.unbanAppealRateLimitSeconds <= 0 &&
        this.unbanAppealRateLimitTimer
      ) {
        clearInterval(this.unbanAppealRateLimitTimer);
        this.unbanAppealRateLimitTimer = null;
      }
    }, 1000);
  }
}








