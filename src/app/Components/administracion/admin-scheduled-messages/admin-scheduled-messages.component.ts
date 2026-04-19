import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  AdminDirectMessageEncryptedItemDTO,
  AdminUpdateScheduledDirectMessageRequestDTO,
  ChatService,
  MensajeProgramadoDTO,
} from '../../../Service/chat/chat.service';
import { AuthService } from '../../../Service/auth/auth.service';
import { CryptoService } from '../../../Service/crypto/crypto.service';

type ScheduledFilter = 'ALL' | 'PENDING' | 'SENT' | 'FAILED' | 'CANCELED';

type RecipientModalItem = {
  initials: string;
  name: string;
  email: string;
  colorClass: string;
};

@Component({
  selector: 'app-admin-scheduled-messages',
  templateUrl: './admin-scheduled-messages.component.html',
  styleUrls: ['./admin-scheduled-messages.component.css']
})
export class AdminScheduledMessagesComponent implements OnInit, OnChanges {
  @Input() active = false;

  activeFilter: ScheduledFilter = 'ALL';
  openRecipientsModal = false;
  openPreviewModal = false;
  previewSubject = '';
  previewBody = '';
  previewAttachmentCount = 0;
  previewAttachmentNames: string[] = [];
  loading = false;
  errorMessage = '';
  cancelingId: number | null = null;
  editingId: number | null = null;
  currentPage = 0;
  pageSize = 10;
  totalPages = 1;
  totalElements = 0;
  isLastPage = true;
  selectedRecipientsTitle = 'Destinatarios';
  recipientPreviewList: RecipientModalItem[] = [];
  recipientOverflowCount = 0;
  recipientModalLoading = false;
  items: MensajeProgramadoDTO[] = [];
  private adminAuditPublicKeyInitPromise: Promise<void> | null = null;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private cryptoService: CryptoService
  ) {}

  ngOnInit(): void {
    if (this.active) {
      this.loadScheduledMessages();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['active']?.currentValue === true) {
      this.loadScheduledMessages();
    }
  }

  get visibleItems(): MensajeProgramadoDTO[] {
    return this.items;
  }

  setFilter(filter: ScheduledFilter): void {
    if (this.activeFilter === filter) return;
    this.activeFilter = filter;
    this.currentPage = 0;
    this.loadScheduledMessages(0);
  }

  retry(): void {
    this.loadScheduledMessages(this.currentPage);
  }

  nextPage(): void {
    if (this.loading || this.isLastPage) return;
    this.loadScheduledMessages(this.currentPage + 1);
  }

  prevPage(): void {
    if (this.loading || this.currentPage <= 0) return;
    this.loadScheduledMessages(this.currentPage - 1);
  }

  loadScheduledMessages(page: number = this.currentPage): void {
    if (this.loading) return;

    this.loading = true;
    this.errorMessage = '';
    const targetPage = Number.isFinite(Number(page)) ? Math.max(0, Number(page)) : 0;
    const status = this.activeFilter === 'ALL' ? undefined : this.activeFilter;
    this.chatService
      .listarMensajesProgramados(targetPage, this.pageSize, status)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          const normalized = Array.isArray(response?.content) ? [...response.content] : [];
          normalized.sort((a, b) => {
            const timeA = new Date(String(a?.scheduledAt || a?.createdAt || '')).getTime() || 0;
            const timeB = new Date(String(b?.scheduledAt || b?.createdAt || '')).getTime() || 0;
            return timeB - timeA;
          });
          this.items = normalized;
          this.currentPage = Number(response?.number ?? targetPage);
          this.pageSize = Number(response?.size ?? this.pageSize);
          this.totalPages = Math.max(1, Number(response?.totalPages ?? 1));
          this.totalElements = Math.max(0, Number(response?.totalElements ?? normalized.length));
          this.isLastPage = Boolean(
            response?.last ?? (this.currentPage >= this.totalPages - 1)
          );
        },
        error: (err) => {
          console.error('Error cargando mensajes programados admin', err);
          this.items = [];
          this.totalPages = 1;
          this.totalElements = 0;
          this.isLastPage = true;
          this.errorMessage =
            String(err?.error?.message || err?.error?.mensaje || '').trim() ||
            'No se pudo cargar la lista de programados.';
        },
      });
  }

  cancel(item: MensajeProgramadoDTO): void {
    const id = Number(item?.id || 0);
    if (!Number.isFinite(id) || id <= 0 || this.cancelingId === id || !this.canCancel(item)) return;
    if (!window.confirm('Cancelar este envio programado?')) return;

    this.cancelingId = id;
    this.chatService
      .cancelarMensajeProgramado(id)
      .pipe(finalize(() => (this.cancelingId = null)))
      .subscribe({
        next: (updated) => {
          const normalizedUpdated = {
            ...item,
            ...(updated || {}),
            status: updated?.status || 'CANCELED',
          };
          this.items = this.items.map((current) =>
            Number(current?.id || 0) === id ? normalizedUpdated : current
          );
          if (
            this.activeFilter !== 'ALL' &&
            this.normalizeStatus(normalizedUpdated.status) !== this.activeFilter
          ) {
            this.items = this.items.filter((current) => Number(current?.id || 0) !== id);
            this.totalElements = Math.max(0, this.totalElements - 1);
          }
        },
        error: (err) => {
          console.error('Error cancelando mensaje programado admin', err);
          this.errorMessage =
            String(err?.error?.message || err?.error?.mensaje || '').trim() ||
            'No se pudo cancelar el envio programado.';
        },
      });
  }

  canCancel(item: MensajeProgramadoDTO): boolean {
    const status = this.normalizeStatus(item?.status);
    return status === 'PENDING' || status === 'PROCESSING';
  }

  canEdit(item: MensajeProgramadoDTO): boolean {
    return (
      this.normalizeStatus(item?.status) === 'PENDING' &&
      this.getDeliveryMode(item) === 'message'
    );
  }

  canResend(item: MensajeProgramadoDTO): boolean {
    return this.normalizeStatus(item?.status) === 'SENT';
  }

  canPreview(item: MensajeProgramadoDTO): boolean {
    return this.getDeliveryMode(item) === 'email';
  }

  async edit(item: MensajeProgramadoDTO): Promise<void> {
    if (this.editingId === Number(item?.id || 0) || !this.canEdit(item)) return;

    const currentMessage = String(item?.message || item?.contenido || '').trim();
    const result = await Swal.fire({
      title: 'Editar mensaje programado',
      input: 'textarea',
      inputValue: currentMessage,
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
        rows: '8',
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return 'Escribe un contenido.';
        if (normalized.length > 5000) return 'Maximo 5000 caracteres.';
        return null;
      },
    });

    if (!result.isConfirmed) return;

    const nextMessage = String(result.value || '').trim();
    if (!nextMessage || nextMessage === currentMessage) return;

    const id = Number(item?.id || 0);
    if (!Number.isFinite(id) || id <= 0) return;

      const batchRecipients = this.resolveBatchRecipientsForEdit(item);
      if (batchRecipients.length === 0) {
        await Swal.fire(
          'Edicion no disponible',
          'Este programado no trae el mapeo completo userId/chatId necesario para editarlo.',
          'warning'
        );
        return;
      }

    this.editingId = id;
    try {
      const keysReady = await this.ensureAdminMessagingKeysReady();
      if (!keysReady) {
        await Swal.fire(
          'Claves E2E no disponibles',
          'No se pudo preparar la clave publica del administrador para mensajeria cifrada.',
          'error'
        );
        return;
      }

      const encryptedPayloads: AdminDirectMessageEncryptedItemDTO[] = [];
      for (const recipient of batchRecipients) {
        const encryptedContent = await this.buildAdminOutgoingE2EContent(
          recipient.userId,
          nextMessage
        );
        encryptedPayloads.push({
          userId: recipient.userId,
          chatId: recipient.chatId,
          contenido: encryptedContent,
          content: encryptedContent,
        });
      }

      const payload: AdminUpdateScheduledDirectMessageRequestDTO = {
        message: nextMessage,
        encryptedPayloads,
        expiresAfterReadSeconds: Number(item?.expiresAfterReadSeconds || 0) || undefined,
      };

      const updated = await firstValueFrom(
        this.chatService.actualizarMensajeDirectoProgramadoAdmin(id, payload)
      );

      const merged = {
        ...item,
        ...(updated || {}),
        message: updated?.message || nextMessage,
        contenido: updated?.contenido || nextMessage,
      };
      this.items = this.items.map((current) =>
        Number(current?.id || 0) === id ? merged : current
      );

      await Swal.fire('Programado actualizado', 'El contenido programado se ha actualizado.', 'success');
    } catch (err: any) {
      console.error('Error editando mensaje programado admin', err);
      await Swal.fire(
        'Edicion fallida',
        String(err?.error?.message || err?.error?.mensaje || 'No se pudo actualizar el contenido programado.'),
        'error'
      );
    } finally {
      this.editingId = null;
    }
  }

  async resend(item: MensajeProgramadoDTO): Promise<void> {
    const label = this.getContentPreview(item);
    await Swal.fire({
      title: 'Reenvio pendiente',
      text: `Conectaremos el reenvio del item "${label}" cuando exista endpoint de reenvio o duplicado.`,
      icon: 'info',
      confirmButtonText: 'Cerrar',
    });
  }

  getStatusClass(status: string | null | undefined): string {
    const normalized = this.normalizeStatus(status);
    if (normalized === 'SENT') return 'status-pill status-sent';
    if (normalized === 'FAILED') return 'status-pill status-failed';
    if (normalized === 'CANCELED') return 'status-pill status-canceled';
    if (normalized === 'PROCESSING') return 'status-pill status-processing';
    return 'status-pill status-pending';
  }

  getStatusLabel(status: string | null | undefined): string {
    const normalized = this.normalizeStatus(status);
    if (normalized === 'SENT') return 'Enviado';
    if (normalized === 'FAILED') return 'Fallido';
    if (normalized === 'CANCELED') return 'Cancelado';
    if (normalized === 'PROCESSING') return 'Procesando';
    return 'Pendiente';
  }

  getDeliveryIconClass(item: MensajeProgramadoDTO): string {
    return this.getDeliveryMode(item) === 'email' ? 'fas fa-envelope' : 'fas fa-comment';
  }

  getDeliveryLabel(item: MensajeProgramadoDTO): string {
    return this.getDeliveryMode(item) === 'email' ? 'Email' : 'Mensaje';
  }

  getContentPreview(item: MensajeProgramadoDTO): string {
    return (
      String(item?.subject || item?.message || item?.contenido || item?.body || '').trim() ||
      'Sin contenido'
    );
  }

  getRecipientBadge(item: MensajeProgramadoDTO): string {
    const explicitCount = Number(item?.recipientCount || 0);
    if (Number.isFinite(explicitCount) && explicitCount > 0) return String(explicitCount);

    const userCount = Array.isArray(item?.userIds) ? item.userIds.length : 0;
    if (userCount > 0) return String(userCount);

    const emailCount = Array.isArray(item?.recipientEmails) ? item.recipientEmails.length : 0;
    if (emailCount > 0) return String(emailCount);

    return this.getDeliveryMode(item) === 'email' ? 'EM' : 'MSG';
  }

  getRecipientLabel(item: MensajeProgramadoDTO): string {
    const explicit = String(item?.recipientLabel || item?.recipientsSummary || '').trim();
    if (explicit) return explicit;

    const audienceMode = String(item?.audienceMode || '').trim().toLowerCase();
    if (audienceMode === 'all') return 'Todos los usuarios permitidos';

    const userCount = Array.isArray(item?.userIds) ? item.userIds.length : 0;
    if (userCount > 0) {
      return `${userCount} usuario${userCount === 1 ? '' : 's'} seleccionado${userCount === 1 ? '' : 's'}`;
    }

    const emailCount = Array.isArray(item?.recipientEmails) ? item.recipientEmails.length : 0;
    if (emailCount > 0) {
      return `${emailCount} email${emailCount === 1 ? '' : 's'} seleccionado${emailCount === 1 ? '' : 's'}`;
    }

    return 'Destinatarios no detallados';
  }

  getScheduleDate(item: MensajeProgramadoDTO): string {
    return String(item?.scheduledAt || item?.createdAt || '').trim();
  }

  async openRecipients(item: MensajeProgramadoDTO): Promise<void> {
    const users = Array.isArray(item?.recipientUsers) ? item.recipientUsers : [];
    const emails = Array.isArray(item?.recipientEmails) ? item.recipientEmails : [];
    const fallbackUserIds = Array.isArray(item?.userIds) ? item.userIds : [];
    this.selectedRecipientsTitle = this.getRecipientLabel(item);
    this.openRecipientsModal = true;
    this.recipientModalLoading = true;
    this.recipientPreviewList = [];
    this.recipientOverflowCount = 0;

    try {
      const recipients = await this.resolveRecipientModalItems(users, emails, fallbackUserIds);
      if (!recipients.length) {
        this.openRecipientsModal = false;
        return;
      }

      this.recipientPreviewList = recipients.slice(0, 25);
      this.recipientOverflowCount = Math.max(0, recipients.length - this.recipientPreviewList.length);
    } finally {
      this.recipientModalLoading = false;
    }
  }

  closeRecipients(): void {
    this.openRecipientsModal = false;
    this.recipientPreviewList = [];
    this.recipientOverflowCount = 0;
    this.recipientModalLoading = false;
  }

  openPreview(item: MensajeProgramadoDTO): void {
    this.previewSubject = String(item?.subject || '(Sin asunto)').trim();
    this.previewBody = String(item?.body || item?.message || item?.contenido || '').trim();
    this.previewAttachmentNames = this.resolveAttachmentNames(item);
    this.previewAttachmentCount = Math.max(
      Number(item?.attachmentCount || 0),
      this.previewAttachmentNames.length
    );
    this.openPreviewModal = true;
  }

  closePreview(): void {
    this.openPreviewModal = false;
  }

  closeRecipientsOutside(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeRecipients();
  }

  closePreviewOutside(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closePreview();
  }

  trackByScheduledId(_: number, item: MensajeProgramadoDTO): number | string {
    return Number(item?.id || 0) || `${item?.scheduledAt || ''}-${item?.createdAt || ''}-${item?.subject || item?.message || ''}`;
  }

  private normalizeStatus(status: string | null | undefined): ScheduledFilter | 'PROCESSING' {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'SENT') return 'SENT';
    if (normalized === 'FAILED') return 'FAILED';
    if (normalized === 'CANCELED') return 'CANCELED';
    if (normalized === 'PROCESSING') return 'PROCESSING';
    return 'PENDING';
  }

  private getDeliveryMode(item: MensajeProgramadoDTO): 'email' | 'message' {
    return String(item?.deliveryType || item?.type || '').trim().toLowerCase() === 'email'
      ? 'email'
      : 'message';
  }

  private buildInitials(value: string): string {
    const parts = String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'NA';
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private resolveRecipientColorClass(index: number): string {
    return index % 2 === 0 ? 'scheduled-avatar--teal' : 'scheduled-avatar--blue';
  }

  private resolveAttachmentNames(item: MensajeProgramadoDTO): string[] {
    const directNames = Array.isArray(item?.attachmentNames) ? item.attachmentNames : [];
    if (directNames.length > 0) {
      return directNames.map((name) => String(name || '').trim()).filter(Boolean);
    }

    const meta = Array.isArray(item?.attachmentsMeta) ? item.attachmentsMeta : [];
    return meta.map((file) => String(file?.fileName || '').trim()).filter(Boolean);
  }

  private async resolveRecipientModalItems(
    users: Array<{ userId?: number | null; email?: string | null; fullName?: string | null; name?: string | null }>,
    emails: string[],
    fallbackUserIds: number[]
  ): Promise<RecipientModalItem[]> {
    const deduped = new Map<string, RecipientModalItem>();
    const pushRecipient = (emailRaw: unknown, nameRaw: unknown, colorIndex: number): void => {
      const email = String(emailRaw || '').trim().toLowerCase();
      if (!email) return;
      if (deduped.has(email)) return;
      const displayName = String(nameRaw || '').trim() || email;
      deduped.set(email, {
        initials: this.buildInitials(displayName),
        name: displayName,
        email,
        colorClass: this.resolveRecipientColorClass(colorIndex),
      });
    };

    let colorIndex = 0;
    for (const recipient of users) {
      pushRecipient(recipient?.email, recipient?.fullName || recipient?.name, colorIndex);
      if (String(recipient?.email || '').trim()) colorIndex += 1;
    }

    for (const email of emails) {
      const before = deduped.size;
      pushRecipient(email, email, colorIndex);
      if (deduped.size > before) colorIndex += 1;
    }

    if (deduped.size > 0) {
      return Array.from(deduped.values());
    }

    const normalizedIds = fallbackUserIds
      .map((id) => Number(id))
      .filter((id, index, arr) => Number.isFinite(id) && id > 0 && arr.indexOf(id) === index);

    if (!normalizedIds.length) return [];

    const resolvedUsers = await Promise.all(
      normalizedIds.map(async (userId) => {
        try {
          const user = await firstValueFrom(this.authService.getById(userId));
          return {
            email: String(user?.email || '').trim(),
            name: String(`${user?.nombre || ''} ${user?.apellido || ''}`).trim() || `Usuario ${userId}`,
          };
        } catch {
          return null;
        }
      })
    );

    for (const resolved of resolvedUsers) {
      const before = deduped.size;
      pushRecipient(resolved?.email, resolved?.name, colorIndex);
      if (deduped.size > before) colorIndex += 1;
    }

    return Array.from(deduped.values());
  }

  private resolveBatchRecipientsForEdit(
    item: MensajeProgramadoDTO
  ): Array<{ userId: number; chatId: number }> {
    const rawItem = item as any;
    const fromUsers = Array.isArray(item?.recipientUsers)
      ? item.recipientUsers
      : Array.isArray(rawItem?.recipients)
      ? rawItem.recipients
      : Array.isArray(rawItem?.recipient_users)
      ? rawItem.recipient_users
      : [];
    const resolvedFromUsers = fromUsers
      .map((recipient: any) => this.resolveEditableRecipient(recipient))
      .filter(
        (
          recipient: { userId: number; chatId: number } | null
        ): recipient is { userId: number; chatId: number } => !!recipient
      );

    if (resolvedFromUsers.length > 0) {
      const deduped = new Map<string, { userId: number; chatId: number }>();
      for (const recipient of resolvedFromUsers) {
        deduped.set(`${recipient.userId}:${recipient.chatId}`, recipient);
      }
      return Array.from(deduped.values());
    }

    const singleChatId = Number(item?.chatId || 0);
    const fromUserIds = Array.isArray(item?.userIds)
      ? item.userIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (singleChatId > 0 && fromUserIds.length === 1) {
      return [{ userId: fromUserIds[0], chatId: singleChatId }];
    }

    return [];
  }

  private resolveEditableRecipient(source: any): { userId: number; chatId: number } | null {
    if (!source || typeof source !== 'object') return null;

    const userId = this.normalizePositiveNumber(
      source?.userId ??
      source?.usuarioId ??
      source?.recipientUserId ??
      source?.recipient_user_id ??
      source?.targetUserId ??
      source?.target_user_id ??
      source?.id
    );
    const chatId = this.normalizePositiveNumber(
      source?.chatId ??
      source?.chat_id ??
      source?.targetChatId ??
      source?.target_chat_id ??
      source?.conversationId ??
      source?.conversation_id
    );

    if (!userId || !chatId) return null;
    return { userId, chatId };
  }

  private normalizePositiveNumber(value: unknown): number | null {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric;
  }

  private async ensureAdminMessagingKeysReady(): Promise<boolean> {
    try {
      const adminId = Number(
        localStorage.getItem('usuarioId') || sessionStorage.getItem('usuarioId') || 0
      );
      if (!Number.isFinite(adminId) || adminId <= 0) return false;

      let publicKeyBase64 = String(localStorage.getItem(`publicKey_${adminId}`) || '').trim();
      let privateKeyBase64 = String(localStorage.getItem(`privateKey_${adminId}`) || '').trim();

      if (!publicKeyBase64 || !privateKeyBase64) {
        const keys = await this.cryptoService.generateKeyPair();
        publicKeyBase64 = await this.cryptoService.exportPublicKey(keys.publicKey);
        privateKeyBase64 = await this.cryptoService.exportPrivateKey(keys.privateKey);
        localStorage.setItem(`publicKey_${adminId}`, publicKeyBase64);
        localStorage.setItem(`privateKey_${adminId}`, privateKeyBase64);
      }

      if (!publicKeyBase64) return false;
      await firstValueFrom(this.authService.updatePublicKey(adminId, publicKeyBase64));
      await this.ensureAdminAuditPublicKeyForE2E();
      return !!this.getStoredAdminAuditPublicKey();
    } catch (err) {
      console.error('Error preparando claves E2E admin programados', err);
      return false;
    }
  }

  private async buildAdminOutgoingE2EContent(
    recipientId: number,
    plainText: string
  ): Promise<string> {
    const recipient = await firstValueFrom(this.authService.getById(recipientId));
    const recipientPubKeyBase64 = String(recipient?.publicKey || '').trim();
    if (!recipientPubKeyBase64) {
      throw new Error(`RECIPIENT_PUBLIC_KEY_MISSING_${recipientId}`);
    }

    const adminId = Number(
      localStorage.getItem('usuarioId') || sessionStorage.getItem('usuarioId') || 0
    );
    const adminPubKeyBase64 = String(localStorage.getItem(`publicKey_${adminId}`) || '').trim();
    if (!adminPubKeyBase64) {
      throw new Error('ADMIN_PUBLIC_KEY_MISSING');
    }

    await this.ensureAdminAuditPublicKeyForE2E();
    const auditPubKeyBase64 = this.getStoredAdminAuditPublicKey();
    if (!auditPubKeyBase64) {
      throw new Error('AUDIT_PUBLIC_KEY_MISSING');
    }

    const aesKey = await this.cryptoService.generateAESKey();
    const { iv, ciphertext } = await this.cryptoService.encryptAES(plainText, aesKey);
    const aesKeyRawBase64 = await this.cryptoService.exportAESKey(aesKey);

    const recipientRsaKey = await this.cryptoService.importPublicKey(recipientPubKeyBase64);
    const adminRsaKey = await this.cryptoService.importPublicKey(adminPubKeyBase64);
    const auditRsaKey = await this.cryptoService.importPublicKey(auditPubKeyBase64);

    return JSON.stringify({
      type: 'E2E',
      iv,
      ciphertext,
      forEmisor: await this.cryptoService.encryptRSA(aesKeyRawBase64, adminRsaKey),
      forReceptor: await this.cryptoService.encryptRSA(aesKeyRawBase64, recipientRsaKey),
      forAdmin: await this.cryptoService.encryptRSA(aesKeyRawBase64, auditRsaKey),
    });
  }

  private extractAuditPublicKeyFromSource(source: any): string | null {
    const candidates = [
      source,
      source?.publicKey,
      source?.auditPublicKey,
      source?.forAdminPublicKey,
      source?.public_key,
      source?.audit_public_key,
      source?.key,
      source?.value,
    ];
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) return normalized;
    }
    return null;
  }

  private persistAdminAuditPublicKeyLocal(key: string): void {
    const normalized = String(key || '').trim();
    if (!normalized) return;
    localStorage.setItem('auditPublicKey', normalized);
    localStorage.setItem('publicKey_admin_audit', normalized);
    localStorage.setItem('forAdminPublicKey', normalized);
  }

  private getStoredAdminAuditPublicKey(): string | null {
    const local =
      localStorage.getItem('auditPublicKey') ||
      localStorage.getItem('publicKey_admin_audit') ||
      localStorage.getItem('forAdminPublicKey') ||
      '';
    const normalized = String(local).trim();
    return normalized || null;
  }

  private async ensureAdminAuditPublicKeyForE2E(): Promise<void> {
    if (this.getStoredAdminAuditPublicKey()) return;
    if (this.adminAuditPublicKeyInitPromise) {
      await this.adminAuditPublicKeyInitPromise;
      return;
    }

    const initPromise = new Promise<void>((resolve) => {
      this.authService.getAuditPublicKey().subscribe({
        next: (resp: any) => {
          const key =
            this.extractAuditPublicKeyFromSource(resp) ||
            this.extractAuditPublicKeyFromSource(resp?.data) ||
            this.extractAuditPublicKeyFromSource(resp?.result);
          if (key) this.persistAdminAuditPublicKeyLocal(key);
          resolve();
        },
        error: () => resolve(),
      });
    });

    this.adminAuditPublicKeyInitPromise = initPromise;
    try {
      await initPromise;
    } finally {
      if (this.adminAuditPublicKeyInitPromise === initPromise) {
        this.adminAuditPublicKeyInitPromise = null;
      }
    }
  }
}
