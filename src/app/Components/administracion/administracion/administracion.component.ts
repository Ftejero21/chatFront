import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../Service/auth/auth.service';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { DashboardStatsDTO } from '../../../Interface/DashboardStatsDTO';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { ChatService } from '../../../Service/chat/chat.service';
import { decryptContenidoE2E, decryptPreviewStringE2E } from '../../../utils/chat-utils';
import { CryptoService } from '../../../Service/crypto/crypto.service';

@Component({
  selector: 'app-administracion',
  templateUrl: './administracion.component.html',
  styleUrl: './administracion.component.css'
})
export class AdministracionComponent implements OnInit, OnDestroy {

  // Variables de control de vista
  isDashboardView: boolean = true;
  isSidebarOpen: boolean = false;
  headerSubtitle: string = "Gestión centralizada de TejeChat.";
  currentUserName: string = "";
  loadingConversations: boolean = false;
  public usuarioActualId!: number;
  userChats: any[] = [];
  // Datos del servidor
  stats: DashboardStatsDTO = {
    totalUsuarios: 0, porcentajeUsuarios: 0,
    chatsActivos: 0, porcentajeChats: 0,
    reportes: 0, porcentajeReportes: 0,
    mensajesHoy: 0, porcentajeMensajes: 0
  };
  usuariosLocales: UsuarioDTO[] = [];
  usuariosMostrados: UsuarioDTO[] = [];
  busquedaTerm: string = "";

  // Suscripción a búsqueda por input en tiempo real (debounce)
  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  constructor(private authService: AuthService,private chatService:ChatService,private cryptoService:CryptoService) { }

  ngOnInit(): void {
    const id = localStorage.getItem('usuarioId');
    this.cargarEstadisticas();
    this.cargarUsuariosRecientes();

    if (!id) {
      console.warn('⚠️ No hay usuario logueado');
      return;
    }

    this.usuarioActualId = parseInt(id, 10);
    // Configurar búsqueda con un poco de retraso (300ms) para no saturar al teclear
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.realizarBusqueda(term);
    });
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  cargarEstadisticas(): void {
    this.authService.getDashboardStats().subscribe({
      next: (data) => this.stats = data,
      error: (err) => console.error("Error cargando estadísticas", err)
    });
  }

  cargarUsuariosRecientes(): void {
    this.authService.getUsuariosRecientes().subscribe({
      next: (data) => {
        this.usuariosLocales = data;
        this.usuariosMostrados = data; // Al principio mostramos todos los recientes
      },
      error: (err) => console.error("Error cargando recientes", err)
    });
  }

  onSearchChange(event: any): void {
    const term = event.target.value || '';
    this.searchSubject.next(term);
  }

  realizarBusqueda(term: string): void {
    if (!term || term.trim() === '') {
      // Si se borra la búsqueda, mostrar la tabla de recientes inicial
      this.usuariosMostrados = this.usuariosLocales;
      return;
    }

    const lowerTerm = term.toLowerCase().trim();

    // 1) Filtrar la lista local memoria
    const filterLocals = this.usuariosLocales.filter(u =>
      u.nombre.toLowerCase().includes(lowerTerm) ||
      u.email.toLowerCase().includes(lowerTerm)
    );

    if (filterLocals.length > 0) {
      this.usuariosMostrados = filterLocals;
    } else {
      // 2) Si localmente no hay coincidencias directas, pedir al backend
      this.authService.searchUsuarios(lowerTerm).subscribe({
        next: (data) => this.usuariosMostrados = data,
        error: (err) => console.error("Error buscando usuarios remotamente", err)
      });
    }
  }

  getRoleName(roles: string[] | undefined): string {
    if (!roles || roles.length === 0) return 'Usuario';
    const mainRole = roles[0];
    return mainRole.replace('ROLE_', '').charAt(0) + mainRole.replace('ROLE_', '').slice(1).toLowerCase();
  }

  showConversations(user: any): void {
    this.isDashboardView = false;
    this.currentUserName = user.nombre;
    this.headerSubtitle = `Inspeccionando registros de: ${user.nombre}`;

    this.loadingConversations = true;
    this.userChats = [];

    this.chatService.listarConversacionesAdmin(Number(user.id)).subscribe({
      next: async (data: any) => {
        this.userChats = data || [];

        // 🔐 Intentar descifrar previews (si son E2E)
        await this.prepararPreviewsChatsAdmin();

        this.loadingConversations = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err: any) => {
        console.error("Error cargando chats", err);
        this.loadingConversations = false;
        this.userChats = [];
        Swal.fire('Error', 'No se pudieron cargar las conversaciones del usuario.', 'error');
      }
    });
  }

  private async prepararPreviewsChatsAdmin(): Promise<void> {
    if (!this.userChats || this.userChats.length === 0) return;

    await Promise.all(
      this.userChats.map(async (chat) => {
        if (!chat) return;

        const previewAdmin =
          chat.ultimoMensajeDescifrado ??
          chat.ultimoMensajePlano ??
          chat.previewAdmin ??
          chat.ultimoMensajeAdmin;

        if (previewAdmin) {
          chat.ultimoMensaje = await this.normalizeAdminPreview(previewAdmin);
          return;
        }

        if (chat.ultimoMensaje) {
          chat.ultimoMensaje = await this.decryptPreviewString(chat.ultimoMensaje);
        }
      })
    );
  }

  private async normalizeAdminPreview(preview: string): Promise<string> {
    if (!preview) return preview;

    const normalizedPreview = String(preview).trim();

    if (normalizedPreview === 'NO_AUDITABLE') {
      return '⚠️ [Mensaje legado no auditable]';
    }

    // Si backend envía por error JSON E2E en `ultimoMensajeDescifrado`, evitamos mostrarlo crudo.
    if (this.isEncryptedE2EPayload(normalizedPreview)) {
      return this.decryptPreviewString(normalizedPreview);
    }

    return normalizedPreview;
  }

  private isEncryptedE2EPayload(value: string): boolean {
    if (!value || !value.startsWith('{')) return false;

    try {
      const payload = JSON.parse(value);
      return payload?.type === 'E2E' && !!payload?.ciphertext;
    } catch {
      return false;
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  showDashboard() {
    this.isDashboardView = true;
    this.isSidebarOpen = false;
    this.headerSubtitle = "Gestión centralizada de TejeChat.";
  }

   async banUsuario(usuario: any) {
    const { value: motivo } = await Swal.fire({
      title: '',
      html: `
        <div class="swal-ban-header">
          <div class="swal-ban-header-icon">🚫</div>
          <div class="swal-ban-header-text">
            <h2>Banear usuario</h2>
            <p>Vas a restringir el acceso de <strong>${usuario.nombre}</strong> a TejeChat</p>
          </div>
        </div>

        <div class="swal-ban-body">
          <label class="swal-ban-label">Motivo del baneo (opcional)</label>
          <p class="swal-ban-helper">Puedes dejarlo vacío si no quieres indicar un motivo específico.</p>
        </div>
      `,
      input: 'textarea',
      inputPlaceholder: 'Ej: Insultos reiterados, spam, comportamiento inapropiado...',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'swal-ban-popup',
        htmlContainer: 'swal-ban-html',
        input: 'swal-ban-textarea',
        confirmButton: 'swal-ban-confirm',
        cancelButton: 'swal-ban-cancel',
        actions: 'swal-ban-actions'
      }
    });

    // Si cancela
    if (motivo === undefined) return;

    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `Vas a banear a ${usuario.nombre}. Perderá el acceso a TejeChat inmediatamente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, banear',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.authService.banearUsuario(Number(usuario.id), (motivo || '').trim()).subscribe({
      next: () => {
        Swal.fire('¡Usuario baneado!', `${usuario.nombre} ha sido baneado correctamente.`, 'success');
        usuario.activo = false;
      },
      error: (err) => {
        console.error('Error al banear usuario', err);
        Swal.fire('Error', 'No se pudo banear al usuario en el servidor.', 'error');
      }
    });
  }

  unbanUsuario(usuario: any) {
    Swal.fire({
      title: '¿Reactivar usuario?',
      text: `Estás a punto de desbanear a ${usuario.nombre}. Recuperará el acceso a TejeChat de forma inmediata.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6', // Un azul vibrante para diferenciar de la advertencia
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, desbanear',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Llamada al servicio que definiste
        this.authService.desbanearUsuario(Number(usuario.id)).subscribe({
          next: () => {
            Swal.fire({
              title: '¡Cuenta Reactivada!',
              text: `El usuario ${usuario.nombre} ya puede volver a iniciar sesión.`,
              icon: 'success',
              confirmButtonColor: '#10b981'
            });

            // Esto actualiza la interfaz automáticamente gracias al *ngIf
            usuario.activo = true;
          },
          error: (err) => {
            console.error("Error al desbanear", err);
            Swal.fire('Error', 'No se pudo reactivar al usuario en el servidor.', 'error');
          }
        });
      }
    });
  }

  private async decryptContenido(contenido: string, emisorId: number, receptorId: number): Promise<string> {
  return decryptContenidoE2E(
    contenido,
    emisorId,
    receptorId,
    this.usuarioActualId,
    this.cryptoService
  );
}

private async decryptPreviewString(contenido: string): Promise<string> {
  return decryptPreviewStringE2E(
    contenido,
    this.usuarioActualId,
    this.cryptoService
  );
}
}
