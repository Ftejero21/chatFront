import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
} from '@angular/core';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { AuthService } from '../../../Service/auth/auth.service';

declare const bootstrap: any;

export interface ChatGrupalCreateDTO {
  nombreGrupo: string;
  usuarios: Array<{ id: number }>;
  idCreador: number;
  fotoGrupo?: string; // dataURL opcional
  descripcion?: string;
  visibilidad?: 'PUBLICO' | 'PRIVADO';
}

@Component({
  selector: 'app-crear-grupo-modal',
  templateUrl: './crear-grupo-modal.component.html',
  styleUrls: ['./crear-grupo-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearGrupoModalComponent implements OnInit {
  @Input() currentUserId!: number;
  @Output() create = new EventEmitter<ChatGrupalCreateDTO>();

  @ViewChild('modalRoot', { static: true })
  modalRoot!: ElementRef<HTMLDivElement>;

  @ViewChild('fileInput')
  fileInput!: ElementRef<HTMLInputElement>;

  private modalRef: any;

  // Estado de UI
  loadingUsuarios = true;
  skeletons = Array.from({ length: 6 });

  usuariosLista: UsuarioDTO[] = [];

  nuevoGrupo = {
    nombre: '',
    fotoDataUrl: null as string | null,
    descripcion: '',
    visibilidad: 'PUBLICO' as 'PUBLICO' | 'PRIVADO',
    seleccionados: [] as UsuarioDTO[],
  };

  busquedaUsuario = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // inicializa modal
    this.modalRef = new bootstrap.Modal(this.modalRoot.nativeElement);
    // reset al cerrarse
    this.modalRoot.nativeElement.addEventListener('hidden.bs.modal', () => {
      this.resetForm();
      this.cdr.markForCheck();
    });

    this.cargarUsuariosActivos();
  }

  // ================== Modal ==================
  open(): void {
    this.resetForm();
    this.modalRef?.show();
  }

  close(): void {
    this.modalRef?.hide();
  }

  // ================== Data ==================
  public cargarUsuariosActivos(): void {
    this.loadingUsuarios = true;
    this.authService.listarActivos().subscribe({
      next: (list) => {
        this.usuariosLista = (list || []).filter(
          (u) => u.id != null && u.id !== this.currentUserId
        );
        this.loadingUsuarios = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        console.error('❌ listar activos:', e);
        this.loadingUsuarios = false;
        this.cdr.markForCheck();
      },
    });
  }

  // trackBy para *ngFor
  trackByUserId = (_: number, u: UsuarioDTO) => u.id ?? _;

  // fallback de imagen
  onUserPicError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = '/assets/usuario.png';
  }

  // ================== Filtro/selección ==================
  get usuariosFiltrados(): UsuarioDTO[] {
    const q = (this.busquedaUsuario || '').toLowerCase().trim();
    const selIds = new Set(this.nuevoGrupo.seleccionados.map((s) => s.id));
    return this.usuariosLista
      .filter((u) => !selIds.has(u.id!))
      .filter((u) =>
        !q
          ? true
          : `${u.nombre ?? ''} ${u.apellido ?? ''}`
              .toLowerCase()
              .includes(q)
      );
  }

  isSeleccionado(u: UsuarioDTO): boolean {
    return this.nuevoGrupo.seleccionados.some((s) => s.id === u.id);
  }

  toggleUsuario(u: UsuarioDTO): void {
    if (!u?.id) return;
    if (this.isSeleccionado(u)) {
      this.nuevoGrupo.seleccionados = this.nuevoGrupo.seleccionados.filter(
        (s) => s.id !== u.id
      );
    } else {
      this.nuevoGrupo.seleccionados = [u, ...this.nuevoGrupo.seleccionados];
    }
    this.cdr.markForCheck();
  }

  removeSeleccionado(u: UsuarioDTO): void {
    if (!u?.id) return;
    this.nuevoGrupo.seleccionados = this.nuevoGrupo.seleccionados.filter(
      (s) => s.id !== u.id
    );
    this.cdr.markForCheck();
  }

  // ================== Imagen (dataURL) ==================
  onGroupImageSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
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
      this.nuevoGrupo.fotoDataUrl = String(reader.result);
      // limpia SIEMPRE para que permita re-elegir la misma imagen
      if (this.fileInput?.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  // ================== Crear / Reset ==================
  crearGrupoClick(): void {
    const nombre = this.nuevoGrupo.nombre.trim();
    if (!nombre || this.nuevoGrupo.seleccionados.length === 0) return;

    const dto: ChatGrupalCreateDTO = {
      nombreGrupo: nombre,
      usuarios: this.nuevoGrupo.seleccionados
        .filter((u) => u.id != null)
        .map((u) => ({ id: u.id! })),
      idCreador: Number(this.currentUserId),
      fotoGrupo: this.nuevoGrupo.fotoDataUrl || undefined,
      descripcion:
        (this.nuevoGrupo.descripcion || '').trim() ||
        `Grupo ${nombre} creado en TejeChat.`,
      visibilidad: this.nuevoGrupo.visibilidad || 'PUBLICO',
    };

    this.create.emit(dto);
    this.close();
  }

  private resetForm(): void {
    this.nuevoGrupo = {
      nombre: '',
      fotoDataUrl: null,
      descripcion: '',
      visibilidad: 'PUBLICO',
      seleccionados: [],
    };
    this.busquedaUsuario = '';
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }
}
