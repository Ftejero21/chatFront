import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';

export type AdminMessageComposerSubmitEvent = {
  mode: 'all' | 'selected';
  message: string;
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
  @Input() hasMoreUsers: boolean = false;
  @Input() loadingMoreUsers: boolean = false;
  @Output() sendRequested = new EventEmitter<AdminMessageComposerSubmitEvent>();
  @Output() loadMoreRequested = new EventEmitter<void>();

  audienceMode: 'all' | 'selected' = 'all';
  selectedUserIds = new Set<number>();
  messageText: string = '';
  searchTerm: string = '';
  private usersSelectionInitialized = false;

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
  }

  setAudience(mode: 'all' | 'selected'): void {
    this.audienceMode = mode;
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
    return `Enviar a ${this.sendCount} usuarios`;
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
    const message = String(this.messageText || '').trim();
    if (!message || this.sending) return;
    if (this.audienceMode === 'selected' && this.selectedUserIds.size === 0) return;

    this.sendRequested.emit({
      mode: this.audienceMode,
      message,
      selectedUserIds: Array.from(this.selectedUserIds),
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

  private resetSelectedUsers(): void {
    this.selectedUserIds = new Set(
      (this.users || [])
        .map((user) => Number(user?.id || 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
  }
}
