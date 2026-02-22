import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';
import Swal from 'sweetalert2';

import { CryptoService } from '../../../Service/crypto/crypto.service';
import { Router } from '@angular/router';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { LoginRequestDTO } from '../../../Interface/LoginRequestDTO ';


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
export class LoginComponent implements OnInit {
  toasts: ToastItem[] = [];
  login: LoginRequestDTO = { email: '', password: '' };
  rememberMe: boolean = false;
  showResetPasswordModal: boolean = false;

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
    private router: Router
  ) {}

  ngOnInit(): void {
    // Si ya existe sesión activa y el usuario quiso ser recordado, redirige automático.
    const hasToken = !!localStorage.getItem('token');
    const isRemembered = localStorage.getItem('rememberMe') === 'true';

    if (hasToken && isRemembered) {
      this.router.navigate(['/inicio']);
    } else if (hasToken && !isRemembered) {
      // Si no marcó recuérdame y aterriza en login, limpiamos su sesión temporal.
      localStorage.removeItem('token');
      localStorage.removeItem('usuarioId');
    }
  }

  // Cambio de tab con reseteo del uploader al pasar a login
  switchTo(login: boolean): void {
    this.modoLogin = login;
    if (login) this.resetAvatar(); // limpia al salir de registro
  }

  iniciarSesion(): void {
    this.authService.login(this.login).subscribe({
      next: async (response) => {
        const usuario = response.usuario;
        localStorage.setItem('token', response.token);
        localStorage.setItem('usuarioId', String(usuario.id));
        localStorage.setItem('rememberMe', String(this.rememberMe));
        
        if (usuario.foto) localStorage.setItem('usuarioFoto', usuario.foto);
        if (usuario.bloqueadosIds) localStorage.setItem('bloqueadosIds', JSON.stringify(usuario.bloqueadosIds));
        if (usuario.meHanBloqueadoIds) localStorage.setItem('meHanBloqueadoIds', JSON.stringify(usuario.meHanBloqueadoIds));
        
        // E2E KEY GENERATION
        try {
          let pubBase64 = localStorage.getItem(`publicKey_${usuario.id}`);
          let privBase64 = localStorage.getItem(`privateKey_${usuario.id}`);

          if (!pubBase64 || !privBase64) {
            const keys = await this.cryptoService.generateKeyPair();
            privBase64 = await this.cryptoService.exportPrivateKey(keys.privateKey);
            pubBase64 = await this.cryptoService.exportPublicKey(keys.publicKey);
            localStorage.setItem(`privateKey_${usuario.id}`, privBase64);
            localStorage.setItem(`publicKey_${usuario.id}`, pubBase64);
          }
          
          this.authService.updatePublicKey(usuario.id!, pubBase64).subscribe({
            next: () => {
              this.showToast('Sesión iniciada correctamente (Claves E2E listas)', 'success', 'Éxito', 2000);
              
              // Verificamos si tiene el rol ADMIN para mandarlo al dashboard, o usuario normal al chat
              const isAdmin = usuario.roles && usuario.roles.includes('ADMIN');
              if (isAdmin) {
                this.router.navigate(['/administracion']);
              } else {
                this.router.navigate(['/inicio']);
              }
            },
            error: (err) => {
               console.error('Error subiendo public key', err);
               this.showToast('Sesión iniciada, pero falló E2E', 'warning', 'Aviso');
               this.router.navigate(['/inicio']);
            }
          });
        } catch(e) {
          console.error("Error criptográfico", e);
          this.router.navigate(['/inicio']);
        }
      },
      error: (err) => {
        const code = err?.error?.code as string | undefined;
        if (code === 'EMAIL_INVALIDO') {
          this.showToast('Email incorrecto', 'danger', 'Error');
        } else if (code === 'PASSWORD_INCORRECTA') {
          this.showToast('Contraseña incorrecta', 'danger', 'Error');
        } else if (code === 'USUARIO_INACTIVO') {
          Swal.fire({
            title: 'Cuenta Inhabilitada',
            text: err?.error?.mensaje || 'Un administrador ha inhabilitado tu cuenta. No puedes acceder.',
            icon: 'error',
            confirmButtonColor: '#ef4444'
          });
        } else {
          this.showToast('No se pudo iniciar sesión', 'warning', 'Aviso');
        }
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
        if (usuario.bloqueadosIds) localStorage.setItem('bloqueadosIds', JSON.stringify(usuario.bloqueadosIds));
        if (usuario.meHanBloqueadoIds) localStorage.setItem('meHanBloqueadoIds', JSON.stringify(usuario.meHanBloqueadoIds));
        
        // E2E KEY GENERATION ON REGISTER
        try {
          let pubBase64 = localStorage.getItem(`publicKey_${usuario.id}`);
          let privBase64 = localStorage.getItem(`privateKey_${usuario.id}`);

          if (!pubBase64 || !privBase64) {
            const keys = await this.cryptoService.generateKeyPair();
            privBase64 = await this.cryptoService.exportPrivateKey(keys.privateKey);
            pubBase64 = await this.cryptoService.exportPublicKey(keys.publicKey);
            localStorage.setItem(`privateKey_${usuario.id}`, privBase64);
            localStorage.setItem(`publicKey_${usuario.id}`, pubBase64);
          }
          
          this.authService.updatePublicKey(usuario.id!, pubBase64).subscribe({
            next: () => this.router.navigate(['/inicio']),
            error: (err) => {
              console.error('Error subiendo public key', err);
              this.router.navigate(['/inicio']);
            }
          });
        } catch(e) {
          console.error("Error generacion llaves", e);
          this.router.navigate(['/inicio']);
        }
      },
      error: (err) => console.error('❌ Error al registrar:', err),
    });
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
}
