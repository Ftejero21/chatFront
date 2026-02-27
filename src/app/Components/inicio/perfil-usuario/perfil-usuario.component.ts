import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';

export interface PerfilUsuarioSavePayload {
  nombre: string;
  apellido: string;
  email: string;
  passwordActual: string;
  nuevaPassword: string;
  repetirNuevaPassword: string;
  verificationCode: string;
  foto: string;
}

@Component({
  selector: 'app-perfil-usuario',
  templateUrl: './perfil-usuario.component.html',
  styleUrls: ['./perfil-usuario.component.css']
})
export class PerfilUsuarioComponent implements OnChanges {
  @Input() usuario: UsuarioDTO | null = null;
  @Input() fotoUrl: string = '';
  @Input() passwordCodeRequested = false;
  @Input() saving = false;
  @Input() codeTimeLeftSec = 0;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<PerfilUsuarioSavePayload>();
  @Output() confirmPassword = new EventEmitter<PerfilUsuarioSavePayload>();
  @ViewChild('perfilAvatarInput') perfilAvatarInput!: ElementRef<HTMLInputElement>;

  public model: PerfilUsuarioSavePayload = {
    nombre: '',
    apellido: '',
    email: '',
    passwordActual: '',
    nuevaPassword: '',
    repetirNuevaPassword: '',
    verificationCode: '',
    foto: '',
  };

  public showPasswordActual = false;
  public showNuevaPassword = false;
  public showRepetirPassword = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['usuario'] || changes['fotoUrl']) {
      this.hydrateModel();
    }
  }

  public onGuardar(): void {
    this.save.emit({ ...this.model });
  }

  public onConfirmPassword(): void {
    this.confirmPassword.emit({ ...this.model });
  }

  public onCancelar(): void {
    this.close.emit();
  }

  public togglePasswordActual(): void {
    this.showPasswordActual = !this.showPasswordActual;
  }

  public toggleNuevaPassword(): void {
    this.showNuevaPassword = !this.showNuevaPassword;
  }

  public toggleRepetirPassword(): void {
    this.showRepetirPassword = !this.showRepetirPassword;
  }

  public openAvatarPicker(): void {
    this.perfilAvatarInput?.nativeElement?.click();
  }

  public onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      this.model.foto = dataUrl;
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  public clearAvatar(): void {
    this.model.foto = '';
    if (this.perfilAvatarInput?.nativeElement) {
      this.perfilAvatarInput.nativeElement.value = '';
    }
  }

  public get usuarioIniciales(): string {
    const nombre = (this.model.nombre || this.usuario?.nombre || '').trim();
    const apellido = (this.model.apellido || this.usuario?.apellido || '').trim();
    if (!nombre && !apellido) return 'US';
    if (!apellido) return nombre.slice(0, 2).toUpperCase();
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  }

  public get hasPhoto(): boolean {
    return !!(this.model.foto || '').trim();
  }

  public get canResendCode(): boolean {
    return this.passwordCodeRequested && this.codeTimeLeftSec <= 0;
  }

  public get codeTimerLabel(): string {
    const total = Math.max(0, Number(this.codeTimeLeftSec || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  private hydrateModel(): void {
    this.model = {
      nombre: this.usuario?.nombre || '',
      apellido: this.usuario?.apellido || '',
      email: this.usuario?.email || '',
      passwordActual: '',
      nuevaPassword: '',
      repetirNuevaPassword: '',
      verificationCode: '',
      foto: this.fotoUrl || this.usuario?.foto || '',
    };
  }
}
