import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { environment } from '../../../environments';
import { resolveMediaUrl } from '../../../utils/chat-utils';

interface ScheduleTargetItem {
  chatId: number;
  receptorId: number | null;
  name: string;
  subtitle: string;
  avatarUrl: string | null;
  initials: string;
  isGroup: boolean;
  isOnline: boolean;
  blockedByTarget: boolean;
  unavailableByMembership: boolean;
}

export interface ScheduleMessageDraftPayload {
  message: string;
  chatIds: number[];
  scheduledDate: string;
  scheduledTime: string;
  scheduledAtIso: string;
  scheduledAtLocal: string;
}

@Component({
  selector: 'app-schedule-message-composer',
  templateUrl: './schedule-message-composer.component.html',
  styleUrl: './schedule-message-composer.component.css',
})
export class ScheduleMessageComposerComponent implements OnChanges {
  @Input() public chats: any[] = [];
  @Input() public initialMessage = '';
  @Input() public blockedMeIds: number[] = [];
  @Input() public leftGroupIds: number[] = [];
  @Output() public close = new EventEmitter<void>();
  @Output() public submitSchedule = new EventEmitter<ScheduleMessageDraftPayload>();

  public draftMessage = '';
  public selectedChatIds = new Set<number>();
  public targets: ScheduleTargetItem[] = [];
  public scheduledDate = '';
  public scheduledTime = '';
  public minDate = '';
  public errorMessage = '';

  public constructor() {
    this.resetDateToToday();
    this.scheduledTime = this.defaultNextHourTime();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialMessage']) {
      this.draftMessage = String(this.initialMessage || '').trim();
    }
    if (changes['chats']) {
      this.rebuildTargets();
    }
  }

  public onClose(): void {
    this.close.emit();
  }

  public get selectedCount(): number {
    return this.selectedChatIds.size;
  }

  public trackTarget(_index: number, item: ScheduleTargetItem): number {
    return item.chatId;
  }

  public isTargetSelected(chatId: number): boolean {
    return this.selectedChatIds.has(Number(chatId));
  }

  public toggleTarget(chatIdRaw: number, event?: Event): void {
    event?.stopPropagation();
    const chatId = Number(chatIdRaw);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const target = this.targets.find((item) => Number(item.chatId) === chatId);
    if (target?.blockedByTarget || target?.unavailableByMembership) return;
    if (this.selectedChatIds.has(chatId)) {
      this.selectedChatIds.delete(chatId);
    } else {
      this.selectedChatIds.add(chatId);
    }
    this.errorMessage = '';
  }

  public onSubmit(): void {
    this.errorMessage = '';
    const message = String(this.draftMessage || '').trim();
    if (!message) {
      this.errorMessage = 'Debes escribir un mensaje.';
      return;
    }
    if (this.selectedChatIds.size === 0) {
      this.errorMessage = 'Selecciona al menos un destino.';
      return;
    }

    const date = String(this.scheduledDate || '').trim();
    const time = String(this.scheduledTime || '').trim();
    if (!date || !time) {
      this.errorMessage = 'Indica fecha y hora de envio.';
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.errorMessage = 'La fecha/hora indicada no es valida.';
      return;
    }

    const now = new Date();
    if (scheduledAt.getTime() <= now.getTime()) {
      this.errorMessage = 'La programacion debe ser en un momento futuro.';
      return;
    }

    this.submitSchedule.emit({
      message,
      chatIds: Array.from(this.selectedChatIds),
      scheduledDate: date,
      scheduledTime: time,
      scheduledAtIso: scheduledAt.toISOString(),
      scheduledAtLocal: `${date}T${time}:00`,
    });
  }

  private rebuildTargets(): void {
    const source = Array.isArray(this.chats) ? this.chats : [];
    const blockedMeSet = new Set(
      (Array.isArray(this.blockedMeIds) ? this.blockedMeIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    const leftGroupSet = new Set(
      (Array.isArray(this.leftGroupIds) ? this.leftGroupIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    const seen = new Set<number>();
    const targets: ScheduleTargetItem[] = [];

    for (const chat of source) {
      const chatId = Number(chat?.id);
      if (!Number.isFinite(chatId) || chatId <= 0 || seen.has(chatId)) continue;
      seen.add(chatId);

      const isGroup = !!chat?.esGrupo;
      const receptorIdRaw = Number(chat?.receptor?.id);
      const receptorId =
        !isGroup && Number.isFinite(receptorIdRaw) && receptorIdRaw > 0
          ? receptorIdRaw
          : null;
      const name = this.resolveTargetName(chat, isGroup);
      const subtitle = isGroup
        ? `${Math.max(0, Number(chat?.usuarios?.length || 0))} miembros`
        : String(chat?.estado || 'Contacto');
      const rawAvatar = String(chat?.foto || chat?.receptor?.foto || '').trim();
      const avatarUrl = resolveMediaUrl(rawAvatar, environment.backendBaseUrl) || null;
      const isOnline = !isGroup && String(chat?.estado || '').trim() === 'Conectado';
      const blockedByTarget = !!(receptorId && blockedMeSet.has(receptorId));
      const unavailableByMembership = !!(isGroup && leftGroupSet.has(chatId));
      const normalizedSubtitle = unavailableByMembership
        ? 'No eres miembro de este grupo'
        : subtitle;

      targets.push({
        chatId,
        receptorId,
        name,
        subtitle: normalizedSubtitle,
        avatarUrl,
        initials: this.buildInitials(name),
        isGroup,
        isOnline,
        blockedByTarget,
        unavailableByMembership,
      });
    }

    targets.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    this.targets = targets;

    const nextSelected = new Set<number>();
    for (const chatId of this.selectedChatIds) {
      const target = targets.find((item) => Number(item.chatId) === Number(chatId));
      if (
        seen.has(chatId) &&
        !target?.blockedByTarget &&
        !target?.unavailableByMembership
      ) {
        nextSelected.add(chatId);
      }
    }
    this.selectedChatIds = nextSelected;
  }

  private resolveTargetName(chat: any, isGroup: boolean): string {
    if (isGroup) {
      const groupName = String(chat?.nombre || chat?.nombreGrupo || '').trim();
      return groupName || `Grupo ${Number(chat?.id) || ''}`.trim();
    }
    const fromReceptor = `${chat?.receptor?.nombre || ''} ${chat?.receptor?.apellido || ''}`.trim();
    if (fromReceptor) return fromReceptor;
    return String(chat?.nombre || 'Contacto').trim();
  }

  private buildInitials(name: string): string {
    const clean = String(name || '').trim();
    if (!clean) return 'US';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  private resetDateToToday(): void {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const value = `${yyyy}-${mm}-${dd}`;
    this.minDate = value;
    this.scheduledDate = value;
  }

  private defaultNextHourTime(): string {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
