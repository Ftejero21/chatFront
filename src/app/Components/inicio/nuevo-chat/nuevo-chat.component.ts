import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChatService } from '../../../Service/chat/chat.service';
import { CryptoService } from '../../../Service/crypto/crypto.service';
import { WebSocketService } from '../../../Service/WebSocket/web-socket.service';
import { decryptPreviewStringE2E } from '../../../utils/chat-utils';
import {
  UsuarioDisponibleChat,
  UsuariosDisponiblesChatResponse,
} from '../../../Interface/UsuarioDisponibleChatDTO';

type EstadoUsuario = 'Conectado' | 'Desconectado' | 'Ausente';

@Component({
  selector: 'app-nuevo-chat',
  templateUrl: './nuevo-chat.component.html',
  styleUrls: ['./nuevo-chat.component.css'],
})
export class NuevoChatComponent implements OnInit, OnDestroy {
  @Input() set open(value: boolean) {
    this._open = value;
    if (value && !this._loaded) {
      this.cargarUsuarios();
    }
  }
  get open(): boolean {
    return this._open;
  }

  @Output() closed = new EventEmitter<void>();
  @Output() contactoSeleccionado = new EventEmitter<UsuarioDisponibleChat>();
  @Output() nuevoGrupo = new EventEmitter<void>();

  busqueda = '';
  loading = false;
  error: string | null = null;

  conConversacion: UsuarioDisponibleChat[] = [];
  sinConversacion: UsuarioDisponibleChat[] = [];

  private _open = false;
  private _loaded = false;
  private destroy$ = new Subject<void>();
  /** StompSubscription refs para poder desuscribir al destruir */
  private estadoSubs: Array<{ unsubscribe(): void }> = [];
  /** IDs ya suscritos a estado, evita duplicados */
  private estadoSuscritos = new Set<number>();

  constructor(
    private chatService: ChatService,
    private cryptoService: CryptoService,
    private wsService: WebSocketService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this._open && !this._loaded) {
      this.cargarUsuarios();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.estadoSubs.forEach((s) => { try { s.unsubscribe(); } catch {} });
    this.estadoSubs = [];
    this.estadoSuscritos.clear();
  }

  private get myUserId(): number {
    return Number(localStorage.getItem('usuarioId') || 0);
  }

  private toEstado(s: string): EstadoUsuario {
    if (s === 'Conectado' || s === 'Ausente') return s;
    return 'Desconectado';
  }

  private cargarUsuarios(): void {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.chatService
      .obtenerUsuariosDisponiblesParaChat()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: UsuariosDisponiblesChatResponse) => {
          this.conConversacion = res.usuariosConConversacion ?? [];
          this.sinConversacion = res.usuariosSinConversacion ?? [];
          this._loaded = true;
          this.loading = false;
          this.cdr.markForCheck();
          this.decryptPreviews();
          this.subscribeEstados();
        },
        error: () => {
          this.error = 'No se pudieron cargar los contactos. Intenta de nuevo.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private subscribeEstados(): void {
    const todos = [...this.conConversacion, ...this.sinConversacion];
    const myId = this.myUserId;
    const ids = todos.map((u) => u.id).filter((id) => id && id !== myId);
    if (ids.length === 0) return;

    // 1) REST: estado inicial
    this.chatService.obtenerEstadosDeUsuarios(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (mapa: Record<number, boolean>) => {
          for (const u of todos) {
            if (mapa[u.id] !== undefined) {
              u.estado = mapa[u.id] ? 'Conectado' : 'Desconectado';
            }
          }
          this.cdr.markForCheck();
        },
        error: () => { /* silencioso */ },
      });

    // 2) WS: actualizaciones en vivo
    for (const id of ids) {
      if (this.estadoSuscritos.has(id)) continue;
      this.estadoSuscritos.add(id);

      const sub = this.wsService.suscribirseAEstado(id, (estadoStr: string) => {
        this.ngZone.run(() => {
          const estado = this.toEstado(estadoStr);
          for (const u of todos) {
            if (u.id === id) {
              u.estado = estado;
            }
          }
          this.cdr.markForCheck();
        });
      });

      if (sub) this.estadoSubs.push(sub);
    }
  }

  private decryptPreviews(): void {
    const myId = this.myUserId;
    for (const u of this.conConversacion) {
      const raw = u.ultimoMensaje;
      if (!raw) continue;
      const looksEncrypted =
        raw.includes('E2E') ||
        raw.includes('"iv"') ||
        raw.includes('"ciphertext"') ||
        raw.startsWith('{') ||
        raw.startsWith('"{');
      if (!looksEncrypted) {
        u.__previewDecrypted = raw;
        continue;
      }
      decryptPreviewStringE2E(raw, myId, this.cryptoService, {
        source: 'nuevo-chat-preview',
        chatId: Number(u.chatId ?? 0),
        mensajeId: Number(u.ultimoMensajeId ?? 0),
      }).then((decrypted) => {
        u.__previewDecrypted = decrypted;
        this.cdr.markForCheck();
      });
    }
  }

  recargar(): void {
    this._loaded = false;
    this.conConversacion = [];
    this.sinConversacion = [];
    // Limpiar suscripciones previas
    this.estadoSubs.forEach((s) => { try { s.unsubscribe(); } catch {} });
    this.estadoSubs = [];
    this.estadoSuscritos.clear();
    this.cargarUsuarios();
  }

  get conConversacionFiltrados(): UsuarioDisponibleChat[] {
    return this.filtrar(this.conConversacion);
  }

  get sinConversacionFiltrados(): UsuarioDisponibleChat[] {
    return this.filtrar(this.sinConversacion);
  }

  private filtrar(lista: UsuarioDisponibleChat[]): UsuarioDisponibleChat[] {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (u) =>
        u.nombreCompleto?.toLowerCase().includes(q) ||
        u.nombre?.toLowerCase().includes(q) ||
        u.apellido?.toLowerCase().includes(q),
    );
  }

  getInitials(u: UsuarioDisponibleChat): string {
    const n = (u.nombre ?? '').charAt(0).toUpperCase();
    const a = (u.apellido ?? '').charAt(0).toUpperCase();
    return a ? n + a : (u.nombreCompleto ?? '??').substring(0, 2).toUpperCase();
  }

  getPreview(u: UsuarioDisponibleChat): string {
    return u.__previewDecrypted ?? u.ultimoMensaje ?? '';
  }

  onBack(): void {
    this.busqueda = '';
    this.closed.emit();
  }

  onContactoClick(u: UsuarioDisponibleChat): void {
    this.contactoSeleccionado.emit(u);
    this.closed.emit();
  }

  onSaludar(u: UsuarioDisponibleChat, event: MouseEvent): void {
    event.stopPropagation();
    this.contactoSeleccionado.emit(u);
    this.closed.emit();
  }

  onNuevoGrupo(): void {
    this.closed.emit();
    this.nuevoGrupo.emit();
  }

  onUnirseEnlace(): void {
    // TODO: modal enlace invitación
  }

  trackById(_: number, item: UsuarioDisponibleChat): number {
    return item.id;
  }
}
