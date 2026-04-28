import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';
import { AiTextMode } from '../../../Interface/AiTextMode';
import { AiTextResponseDTO } from '../../../Interface/AiTextResponseDTO';
import { firstValueFrom } from 'rxjs';

export type AdminMessageComposerSubmitEvent = {
  mode: 'all' | 'selected';
  deliveryType: 'message' | 'email';
  message: string;
  subject?: string;
  attachments: File[];
  scheduledAt?: string;
  scheduledAtLocal?: string;
  selectedUserIds: number[];
};

@Component({
  selector: 'app-admin-message-composer',
  templateUrl: './admin-message-composer.component.html',
  styleUrls: ['./admin-message-composer.component.css']
})
export class AdminMessageComposerComponent implements OnChanges {
  @Input() users: UsuarioDTO[] = [];
  @Input() totalUsers: number = 0;
  @Input() sending: boolean = false;
  @Input() resetSignal: number = 0;
  @Input() hasMoreUsers: boolean = false;
  @Input() loadingMoreUsers: boolean = false;
  @Output() sendRequested = new EventEmitter<AdminMessageComposerSubmitEvent>();
  @Output() scheduleRequested = new EventEmitter<AdminMessageComposerSubmitEvent>();
  @Output() loadMoreRequested = new EventEmitter<void>();
  @ViewChild('emailAttachmentInput')
  private emailAttachmentInputRef?: ElementRef<HTMLInputElement>;

  audienceMode: 'all' | 'selected' = 'all';
  deliveryType: 'message' | 'email' = 'message';
  selectedUserIds = new Set<number>();
  messageText: string = '';
  subjectText: string = '';
  emailAttachments: File[] = [];
  emailDropActive: boolean = false;
  showEmailPreview: boolean = false;
  showSchedulePopup: boolean = false;
  searchTerm: string = '';
  mostrarPopupIaAdmin: boolean = false;
  textoIaAdmin: string = '';
  cargandoIaAdmin: boolean = false;
  errorIaAdmin: string = '';
  tipoFormularioIa: 'MENSAJE' | 'EMAIL' = 'MENSAJE';
  private emailDragDepth = 0;
  private usersSelectionInitialized = false;

  constructor(private mensajeriaService: MensajeriaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['users'] &&
      !this.usersSelectionInitialized &&
      Array.isArray(this.users) &&
      this.users.length > 0
    ) {
      this.resetSelectedUsers();
      this.usersSelectionInitialized = true;
    }

    if (
      changes['resetSignal'] &&
      !changes['resetSignal'].firstChange &&
      changes['resetSignal'].currentValue !== changes['resetSignal'].previousValue
    ) {
      this.resetComposerState();
    }
  }

  setAudience(mode: 'all' | 'selected'): void {
    this.audienceMode = mode;
  }

  setDeliveryType(type: 'message' | 'email'): void {
    this.deliveryType = type;
  }

  toggleUserSelection(userId: number | undefined): void {
    const id = Number(userId || 0);
    if (!Number.isFinite(id) || id <= 0) return;

    if (this.selectedUserIds.has(id)) {
      this.selectedUserIds.delete(id);
      return;
    }

    this.selectedUserIds.add(id);
  }

  isUserSelected(userId: number | undefined): boolean {
    const id = Number(userId || 0);
    if (!Number.isFinite(id) || id <= 0) return false;
    return this.selectedUserIds.has(id);
  }

  get audienceText(): string {
    return this.audienceMode === 'all'
      ? 'Selecciona quien recibira el mensaje'
      : 'Mensajeria segmentada activa';
  }

  get composerTitle(): string {
    return this.deliveryType === 'email'
      ? 'Redactar correo'
      : 'Redactar mensaje';
  }

  get messageLabel(): string {
    return this.deliveryType === 'email'
      ? 'Cuerpo del email'
      : 'Mensaje';
  }

  get messagePlaceholder(): string {
    return this.deliveryType === 'email'
      ? 'Escribe el contenido del email...'
      : 'Escribe el contenido del mensaje...';
  }

  get adminIaPopupTitle(): string {
    return this.tipoFormularioIa === 'EMAIL'
      ? 'Asistente IA para email'
      : 'Asistente IA para mensaje';
  }

  get adminIaSubmitLabel(): string {
    return this.cargandoIaAdmin ? 'Generando...' : 'Formatear con IA';
  }

  get selectedUsersCount(): number {
    return this.selectedUserIds.size;
  }

  get sendCount(): number {
    if (this.audienceMode === 'all') {
      return Math.max(0, Number(this.totalUsers || this.users.length || 0));
    }
    return this.selectedUsersCount;
  }

  get sendLabel(): string {
    return this.deliveryType === 'email'
      ? `Enviar email a ${this.sendCount} usuarios`
      : `Enviar mensaje a ${this.sendCount} usuarios`;
  }

  get canSubmit(): boolean {
    const hasMessage = !!String(this.messageText || '').trim();
    const hasSubject = this.deliveryType === 'email'
      ? !!String(this.subjectText || '').trim()
      : true;
    const hasRecipients = this.audienceMode === 'selected'
      ? this.selectedUsersCount > 0
      : true;
    return !this.sending && hasMessage && hasSubject && hasRecipients;
  }

  get emailAttachmentCountLabel(): string {
    const count = this.emailAttachments.length;
    if (count === 0) return 'Sin archivos adjuntos';
    if (count === 1) return '1 archivo adjunto';
    return `${count} archivos adjuntos`;
  }

  openEmailAttachmentPicker(): void {
    this.emailAttachmentInputRef?.nativeElement?.click();
  }

  openPreview(): void {
    this.showEmailPreview = true;
  }

  closePreview(): void {
    this.showEmailPreview = false;
  }

  openSchedulePopup(): void {
    this.showSchedulePopup = true;
  }

  abrirPopupIaAdmin(tipo: 'MENSAJE' | 'EMAIL'): void {
    if (this.cargandoIaAdmin) return;
    this.tipoFormularioIa = tipo;
    this.mostrarPopupIaAdmin = true;
    this.errorIaAdmin = '';
  }

  cerrarPopupIaAdmin(): void {
    if (this.cargandoIaAdmin) return;
    this.mostrarPopupIaAdmin = false;
    this.errorIaAdmin = '';
  }

  closeSchedulePopup(): void {
    this.showSchedulePopup = false;
  }

  confirmSchedule(event: { scheduledAtIso: string; scheduledAtLocal: string }): void {
    this.showSchedulePopup = false;
    this.emitComposeEvent(this.scheduleRequested, {
      scheduledAt: String(event?.scheduledAtIso || '').trim(),
      scheduledAtLocal: String(event?.scheduledAtLocal || '').trim(),
    });
  }

  get emailAttachmentNames(): string[] {
    return (this.emailAttachments || []).map((file) => String(file?.name || '').trim()).filter(Boolean);
  }

  get scheduleLabel(): string {
    return this.deliveryType === 'email' ? 'Programar email' : 'Programar mensaje';
  }

  onEmailAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];
    if (input) input.value = '';
    this.addEmailAttachments(files);
  }

  onEmailDragEnter(event: DragEvent): void {
    if (!this.isFileDragEvent(event) || this.deliveryType !== 'email') return;
    event.preventDefault();
    event.stopPropagation();
    this.emailDragDepth++;
    this.emailDropActive = true;
  }

  onEmailDragOver(event: DragEvent): void {
    if (!this.isFileDragEvent(event) || this.deliveryType !== 'email') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.emailDropActive = true;
  }

  onEmailDragLeave(event: DragEvent): void {
    if (!this.isFileDragEvent(event) || this.deliveryType !== 'email') return;
    event.preventDefault();
    event.stopPropagation();
    this.emailDragDepth = Math.max(0, this.emailDragDepth - 1);
    if (this.emailDragDepth === 0) {
      this.emailDropActive = false;
    }
  }

  onEmailDrop(event: DragEvent): void {
    if (!this.isFileDragEvent(event) || this.deliveryType !== 'email') return;
    event.preventDefault();
    event.stopPropagation();
    this.emailDragDepth = 0;
    this.emailDropActive = false;
    this.addEmailAttachments(Array.from(event.dataTransfer?.files || []));
  }

  removeEmailAttachment(index: number): void {
    if (index < 0 || index >= this.emailAttachments.length) return;
    this.emailAttachments = this.emailAttachments.filter((_, idx) => idx !== index);
  }

  clearEmailAttachments(): void {
    this.emailAttachments = [];
    const input = this.emailAttachmentInputRef?.nativeElement;
    if (input) input.value = '';
  }

  formatAttachmentSize(size: number | undefined): string {
    const bytes = Number(size || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  get filteredUsers(): UsuarioDTO[] {
    const term = String(this.searchTerm || '').trim().toLowerCase();
    if (!term) return this.users || [];

    return (this.users || []).filter((user) => {
      const fullName = this.getUserDisplayName(user).toLowerCase();
      return fullName.includes(term);
    });
  }

  get allFilteredSelected(): boolean {
    const ids = this.filteredUsers
      .map((user) => Number(user?.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0);
    return ids.length > 0 && ids.every((id) => this.selectedUserIds.has(id));
  }

  toggleAllFilteredUsers(): void {
    const ids = this.filteredUsers
      .map((user) => Number(user?.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return;

    if (this.allFilteredSelected) {
      for (const id of ids) this.selectedUserIds.delete(id);
      return;
    }

    for (const id of ids) this.selectedUserIds.add(id);
  }

  onUsersScroll(event: Event): void {
    if (this.loadingMoreUsers || !this.hasMoreUsers) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining > 96) return;

    this.loadMoreRequested.emit();
  }

  submit(): void {
    this.emitComposeEvent(this.sendRequested);
  }

  async generarTextoAdminConIa(): Promise<void> {
    const idea = String(this.textoIaAdmin || '').trim();
    if (!idea || this.cargandoIaAdmin) {
      if (!idea) this.errorIaAdmin = 'Escribe una idea primero.';
      return;
    }

    this.cargandoIaAdmin = true;
    this.errorIaAdmin = '';

    try {
      const response = await firstValueFrom(
        this.mensajeriaService.procesarTextoConIa({
          texto: this.buildAdminIaPrompt(idea),
          modo:
            this.tipoFormularioIa === 'EMAIL'
              ? AiTextMode.GENERAR_EMAIL
              : AiTextMode.GENERAR_RESPUESTA,
        })
      );

      if (!response?.success) {
        this.errorIaAdmin =
          String(response?.mensaje || '').trim() || 'No se pudo generar el texto.';
        return;
      }

      this.aplicarTextoGeneradoAdmin(response);
      this.mostrarPopupIaAdmin = false;
    } catch (err: any) {
      this.errorIaAdmin = String(
        err?.error?.mensaje || err?.error?.message || err?.message || ''
      ).trim() || 'No se pudo generar el texto con IA.';
    } finally {
      this.cargandoIaAdmin = false;
    }
  }

  aplicarTextoGeneradoAdmin(response: AiTextResponseDTO): void {
    const textoGenerado = String(response?.textoGenerado || '').trim();
    if (!textoGenerado) return;

    if (this.tipoFormularioIa === 'EMAIL') {
      const parsed = this.parsearEmailIa(textoGenerado);
      if (parsed.subject) this.subjectText = parsed.subject;
      if (parsed.body) {
        this.messageText = parsed.body;
        return;
      }
      this.messageText = textoGenerado;
      return;
    }

    this.messageText = textoGenerado;
  }

  parsearEmailIa(textoGenerado: string): { subject: string; body: string } {
    const raw = String(textoGenerado || '').trim();
    const subjectMatch = raw.match(/ASUNTO:\s*([^\n\r]+)/i);
    const bodyMatch = raw.match(/CUERPO:\s*([\s\S]*)$/i);

    return {
      subject: String(subjectMatch?.[1] || '').trim(),
      body: String(bodyMatch?.[1] || '').trim(),
    };
  }

  private emitComposeEvent(
    emitter: EventEmitter<AdminMessageComposerSubmitEvent>,
    extra: Partial<AdminMessageComposerSubmitEvent> = {}
  ): void {
    const message = String(this.messageText || '').trim();
    const subject = String(this.subjectText || '').trim();
    if (!message || this.sending) return;
    if (this.deliveryType === 'email' && !subject) return;
    if (this.audienceMode === 'selected' && this.selectedUserIds.size === 0) return;

    emitter.emit({
      mode: this.audienceMode,
      deliveryType: this.deliveryType,
      message,
      subject: subject || undefined,
      attachments: [...this.emailAttachments],
      selectedUserIds: Array.from(this.selectedUserIds),
      ...extra,
    });
  }

  getUserDisplayName(user: UsuarioDTO): string {
    return `${user?.nombre || ''} ${user?.apellido || ''}`.trim() || user?.email || 'Usuario';
  }

  getUserInitials(user: UsuarioDTO): string {
    const fullName = this.getUserDisplayName(user);
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'US';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  trackByUser(_: number, user: UsuarioDTO): number | string {
    return Number(user?.id || 0) || user?.email || this.getUserDisplayName(user);
  }

  trackByAttachment(index: number, file: File): string {
    return `${file.name}-${file.size}-${index}`;
  }

  private resetSelectedUsers(): void {
    this.selectedUserIds = new Set(
      (this.users || [])
        .map((user) => Number(user?.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
  }

  private isFileDragEvent(event: DragEvent): boolean {
    const types = Array.from(event.dataTransfer?.types || []);
    return types.includes('Files');
  }

  private addEmailAttachments(files: File[]): void {
    if (!Array.isArray(files) || files.length === 0) return;

    const next = [...this.emailAttachments];
    for (const file of files) {
      if (!(file instanceof File)) continue;
      const duplicate = next.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified
      );
      if (!duplicate) next.push(file);
    }
    this.emailAttachments = next;
  }

  private resetComposerState(): void {
    this.messageText = '';
    this.subjectText = '';
    this.showEmailPreview = false;
    this.showSchedulePopup = false;
    this.searchTerm = '';
    this.mostrarPopupIaAdmin = false;
    this.textoIaAdmin = '';
    this.cargandoIaAdmin = false;
    this.errorIaAdmin = '';
    this.emailDragDepth = 0;
    this.emailDropActive = false;
    this.clearEmailAttachments();
  }

  private buildAdminIaPrompt(idea: string): string {
    return this.tipoFormularioIa === 'EMAIL'
      ? idea
      : 'Genera un mensaje claro y natural a partir de esta idea: ' +
          idea +
          '. Devuelve solo el mensaje final.';
  }
}
