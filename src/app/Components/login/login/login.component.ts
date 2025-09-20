import { Component, ElementRef, ViewChild } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';

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
export class LoginComponent {
  toasts: ToastItem[] = [];
  login: LoginRequestDTO = { email: '', password: '' };

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
    private router: Router
  ) {}

  // Cambio de tab con reseteo del uploader al pasar a login
  switchTo(login: boolean): void {
    this.modoLogin = login;
    if (login) this.resetAvatar(); // limpia al salir de registro
  }

  iniciarSesion(): void {
    this.authService.login(this.login).subscribe({
      next: async (usuario) => {
        localStorage.setItem('usuarioId', String(usuario.id));
        if (usuario.foto) localStorage.setItem('usuarioFoto', usuario.foto);
        this.showToast(
          'Sesión iniciada correctamente',
          'success',
          'Éxito',
          2000
        );
        this.router.navigate(['/inicio']);
      },
      error: (err) => {
        const code = err?.error?.code as string | undefined;
        if (code === 'EMAIL_INVALIDO') {
          this.showToast('Email incorrecto', 'danger', 'Error');
        } else if (code === 'PASSWORD_INCORRECTA') {
          this.showToast('Contraseña incorrecta', 'danger', 'Error');
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
      next: (usuario: any) => {
        localStorage.setItem('usuarioId', String(usuario.id));
        this.router.navigate(['/inicio']);
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
