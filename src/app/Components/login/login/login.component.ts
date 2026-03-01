import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';
import Swal from 'sweetalert2';

import { CryptoService } from '../../../Service/crypto/crypto.service';
import { Router } from '@angular/router';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { LoginRequestDTO } from '../../../Interface/LoginRequestDTO ';
import { SessionService } from '../../../Service/session/session.service';
import { firstValueFrom } from 'rxjs';
import {
  RATE_LIMIT_SCOPES,
  RateLimitService,
} from '../../../Service/rate-limit/rate-limit.service';


type ToastVariant = 'danger' | 'success' | 'warning' | 'info';
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
  showRegisterPassword: boolean = false;
  loginRateLimitSeconds = 0;
  unbanAppealRateLimitSeconds = 0;
  private loginRateLimitTimer: any = null;
  private unbanAppealRateLimitTimer: any = null;

  // --- Registro (DTO limpio, sin File) ---
  registro: UsuarioDTO = {
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    // foto?: string (enviado como dataURL si el usuario sube avatar)
  };

  // --- UI ---
  modoLogin = true;
  avatarPreviewUrl: string | null = null; // para mostrar la imagen
  private avatarBase64: string | null = null; // lo que enviaremos en registro.foto

  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  constructor(
    private authService: AuthService,
    private cryptoService: CryptoService,
    private router: Router,
    private sessionService: SessionService,
    private rateLimitService: RateLimitService
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
  }

  // Cambio de tab con reseteo del uploader al pasar a login
  switchTo(login: boolean): void {
    this.modoLogin = login;
    if (login) this.resetAvatar(); // limpia al salir de registro
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
        this.showBanAppealButton = false;
        this.lastBannedEmail = '';
        const usuario = response.usuario;
        localStorage.setItem('token', response.token);
        localStorage.setItem('usuarioId', String(usuario.id));
        localStorage.setItem('rememberMe', String(this.rememberMe));
        this.persistAuditPublicKeyIfPresent(response, usuario);
        this.persistAuditPrivateKeyIfPresent(
          response,
          usuario,
          (window as any),
          (window as any)?.__env
        );

        if (usuario.foto) localStorage.setItem('usuarioFoto', usuario.foto);
        if (usuario.bloqueadosIds) localStorage.setItem('bloqueadosIds', JSON.stringify(usuario.bloqueadosIds));
        if (usuario.meHanBloqueadoIds) localStorage.setItem('meHanBloqueadoIds', JSON.stringify(usuario.meHanBloqueadoIds));

        // E2E identity guard: nunca rotar la clave del usuario en login sin flujo explicito.
        try {
          const ready = await this.ensureE2EIdentityReadyForSession(usuario, 'login');
          if (!ready) return;

          this.showToast('Sesión iniciada correctamente (Claves E2E listas)', 'success', 'Éxito', 2000);

          // Verificamos si tiene el rol ADMIN para mandarlo al dashboard, o usuario normal al chat
          const isAdmin = usuario.roles && usuario.roles.includes('ADMIN');
          if (isAdmin) {
            this.router.navigate(['/administracion']);
          } else {
            this.router.navigate(['/inicio']);
          }
        } catch (e) {
          console.error('Error criptográfico', e);
          this.router.navigate(['/inicio']);
        }
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

  registrarse(): void {
    const payload: UsuarioDTO = { ...this.registro };
    if (this.avatarBase64) {
      (payload as any).foto = this.avatarBase64; // el back ya sabe manejar dataURL
    }

    this.authService.registro(payload).subscribe({
      next: async (response: any) => {
        const usuario = response.usuario || response; // Fallback por si acaso
        if (response.token) {
           localStorage.setItem('token', response.token);
        }
        localStorage.setItem('usuarioId', String(usuario.id));
        this.persistAuditPublicKeyIfPresent(response, usuario);
        this.persistAuditPrivateKeyIfPresent(
          response,
          usuario,
          (window as any),
          (window as any)?.__env
        );
        if (usuario.bloqueadosIds) localStorage.setItem('bloqueadosIds', JSON.stringify(usuario.bloqueadosIds));
        if (usuario.meHanBloqueadoIds) localStorage.setItem('meHanBloqueadoIds', JSON.stringify(usuario.meHanBloqueadoIds));

        // E2E key setup for new account (still with strict mismatch guard).
        try {
          const ready = await this.ensureE2EIdentityReadyForSession(usuario, 'register');
          if (!ready) return;
          this.router.navigate(['/inicio']);
        } catch (e) {
          console.error('Error generacion llaves', e);
          this.router.navigate(['/inicio']);
        }
      },
      error: (err) => console.error('? Error al registrar:', err),
    });
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
    const hasLocalPair = !!localPublicKey && !!localPrivateKey;

    const serverState = await this.fetchServerE2EState(user);
    const localFingerprint = await this.fingerprint12(localPublicKey);
    if (serverState.hasServerKey) {
      if (!hasLocalPair) {
        await Swal.fire({
          title: 'Clave privada no disponible',
          text: 'Este usuario ya tiene identidad E2E en servidor, pero este navegador no conserva su clave privada. No se sobrescribira la clave para no romper mensajes anteriores.',
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

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecciona una imagen válida.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande (máx 5MB).');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.avatarPreviewUrl = dataUrl; // previsualización inmediata
      this.avatarBase64 = dataUrl; // se enviará en el DTO
      input.value = ''; // permite re-seleccionar el MISMO archivo
    };
    reader.readAsDataURL(file);
  }

  clearAvatar(): void {
    this.resetAvatar();
    // opcional: feedback
    // this.showToast('Imagen eliminada', 'info');
  }

  private resetAvatar(): void {
    this.avatarPreviewUrl = null;
    this.avatarBase64 = null;
    if (this.avatarInput?.nativeElement) {
      this.avatarInput.nativeElement.value = '';
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
      console.log('[E2E][audit-private-key-load-ok]', {
        keyLength: key.length,
      });
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

  toggleRegisterPasswordVisibility(): void {
    this.showRegisterPassword = !this.showRegisterPassword;
  }

  ngOnDestroy(): void {
    if (this.loginRateLimitTimer) clearInterval(this.loginRateLimitTimer);
    if (this.unbanAppealRateLimitTimer) clearInterval(this.unbanAppealRateLimitTimer);
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






